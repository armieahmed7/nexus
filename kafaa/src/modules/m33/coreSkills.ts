// FS25 Nuclear Critical Core Skills (M33 Human Skills Studio, FS wave C · E5): the pure rules shared by the pages, the LocalBackend
// and the seed builder, mirrored 1:1 by SQL in supabase/migrations/20261010235001_kafaa_fs35_core_skills.sql (kafaa_cs_*).
//   coreProfile()      my level per core skill from F01 person skill states of the linked catalogue skills, my family target, the
//                      status (met / below / no evidence / no target), the evidence and reasons, and my SJT practice signal (FS26),
//                      which is shown for development only and never changes the level.
//   coreStats()        the HR aggregate (skills_profile Agg): per core skill, per cluster and per family, suppressed under 10.
//   inclusionProblems() the McKinsey DELTA inclusion rule as a check: a core skill exists only if it has its own development route
//                      and its own assessment route (beyond the generic SJT practice), at least two benchmark mappings, and is not a
//                      wellbeing competency (SSG 2025 review: wellbeing is an outcome, not a skill).
// Import-free except `import type` (node seed scripts and the PGlite validator load this file directly).
import type { Reason } from '../../domain/engines/types';

export const CLUSTERS = ['thinking_critically', 'interacting_with_others', 'staying_relevant'] as const;
export type Cluster = (typeof CLUSTERS)[number];
/** Core-skill proficiency: 1 Foundation, 2 Proficient, 3 Role model. A catalogue skill state at level 3 or above counts as 3. */
export const CORE_MAX = 3;
export const MIN_BENCHMARK_MAPPINGS = 2;
export const CORE_SKILL_COUNT = 16;
/** Families never broken out in aggregates (security, safeguards and cyber stay at career-path level). */
export const NO_BREAKOUT = ['security', 'safeguards', 'cyber'];
export const BASIS_RANK: Record<string, number> = { verified: 4, evidenced: 3, validated: 2, claimed: 1 };
/** Arabic label of an evidence basis in reasons (same CASE in SQL kafaa_cs_view). */
export const BASIS_AR: Record<string, string> = { verified: 'موثّق', evidenced: 'مُثبت بالأدلة', validated: 'مُصادق عليه', claimed: 'مُعلَن ذاتياً' };
/** Development route kinds and assessment route kinds. `practice` / `sjt` pointing at the skill itself are the generic FS26 routes. */
export const DEV_KINDS = ['course', 'practice', 'page', 'ojt'] as const;
export const ASSESS_KINDS = ['sjt', 'checkin', '360', 'observation', 'simulator', 'fitness'] as const;
export const MAPPING_FRAMEWORKS = ['inpo', 'wef', 'lifecomp', 'entrecomp', 'greencomp', 'ssg_ccs', 'delta', 'iaea_1917'] as const;
const WELLBEING = /well-?being|wellness|mental health|عافية|رفاه/i;

export interface RouteRef { kind: string; ref: string; title_en: string; title_ar: string }
export interface Mapping { framework: string; benchmark_id: string | null; ref: string | null; label_en: string; label_ar: string }
export interface CoreSkillRow {
  id: string; code: string; cluster: Cluster | string; name_en: string; name_ar: string; sort: number; status?: string;
  skill_ids: string[]; trait_ids?: string[]; mappings: Mapping[]; development: RouteRef[]; assessment: RouteRef[];
  dev_approach_en?: string; dev_approach_ar?: string; assess_approach_en?: string; assess_approach_ar?: string;
}
export interface TargetRow { family_id: string; core_skill_id: string; level: number }
export interface StateLite { id?: string; person_id?: string; skill_id: string; level: number; basis: string; active: boolean }
export interface SkillName { id: string; name_en: string; name_ar: string }
/** Per-attempt practice tally stored on kafaa_sjt_attempts.by_skill: { <core skill id>: { n: items answered, sum: expert effectiveness 0-3 summed } }. */
export interface PracticeAttemptLite { person_id: string; status: string; period: string; by_skill: Record<string, { n: number; sum: number }> }
export interface PersonLite { id: string; kind: string; status: string; job_family_id: string | null }

export type CoreStatus = 'met' | 'below' | 'no_evidence' | 'no_target';
export interface CoreEvidence { skill_id: string; level: number; basis: string }
export interface CoreSkillView {
  core_skill_id: string; cluster: string; level: number; target: number | null; status: CoreStatus; top_basis: string | null;
  evidence: CoreEvidence[]; practice: { n: number; pct: number } | null; reasons: Reason[];
}
export interface CoreProfile {
  person_id: string; family_id: string | null;
  summary: { met: number; below: number; no_evidence: number; no_target: number; total: number };
  skills: CoreSkillView[];
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const byCoreSort = (a: Pick<CoreSkillRow, 'sort' | 'id'>, b: Pick<CoreSkillRow, 'sort' | 'id'>) => a.sort - b.sort || cmp(a.id, b.id);
/** round(100 * sum / (3 n)) half up, in integers (identical in SQL). */
export const practicePct = (sum: number, n: number) => Math.floor((200 * sum + CORE_MAX * n) / (2 * CORE_MAX * n));
/** One-decimal percentage a / b, half up, in integers (identical in SQL). */
export const pct1 = (a: number, b: number) => Math.floor((2000 * a + b) / (2 * b)) / 10;
export const quarterOf = (d: string) => `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
export function quarterShift(q: string, k: number): string {
  const [y, n] = q.split('-Q').map(Number);
  const i = y * 4 + (n - 1) + k;
  return `${Math.floor(i / 4)}-Q${(i % 4) + 1}`;
}
/** The practice window: this quarter and the three before it. */
export const windowStart = (today: string) => quarterShift(quarterOf(today), -3);
export const coreLevel = (stateLevel: number) => Math.max(0, Math.min(CORE_MAX, Math.floor(stateLevel)));

/** Practice tally per core skill over my completed attempts in the window. */
export function practiceOf(attempts: PracticeAttemptLite[], personId: string, today: string): Map<string, { n: number; sum: number }> {
  const from = windowStart(today);
  const out = new Map<string, { n: number; sum: number }>();
  for (const a of attempts) {
    if (a.person_id !== personId || a.status !== 'completed' || a.period < from) continue;
    for (const [cs, v] of Object.entries(a.by_skill ?? {})) {
      const cur = out.get(cs) ?? { n: 0, sum: 0 };
      out.set(cs, { n: cur.n + Number(v.n), sum: cur.sum + Number(v.sum) });
    }
  }
  return out;
}

export function coreSkillView(cs: CoreSkillRow, target: number | null, states: StateLite[], names: Map<string, SkillName>, practice: { n: number; sum: number } | undefined): CoreSkillView {
  const linked = states
    .filter((s) => s.active && cs.skill_ids.includes(s.skill_id) && Number(s.level) >= 1)
    .sort((a, b) => Number(b.level) - Number(a.level) || (BASIS_RANK[b.basis] ?? 0) - (BASIS_RANK[a.basis] ?? 0) || cmp(a.skill_id, b.skill_id));
  const top = linked[0];
  const level = top ? coreLevel(Number(top.level)) : 0;
  const status: CoreStatus = level === 0 ? 'no_evidence' : target == null ? 'no_target' : level >= target ? 'met' : 'below';
  const nm = (id: string) => { const s = names.get(id); return { en: s?.name_en ?? id, ar: s?.name_ar ?? id }; };
  const reasons: Reason[] = linked.slice(0, 3).map((s) => ({
    code: 'cs_evidence', key: 'm33.reason.evidence', vars: { skill: nm(s.skill_id), level: Number(s.level), basis: { en: s.basis, ar: BASIS_AR[s.basis] ?? s.basis } },
    ref: { table: 'person_skills', id: s.id ?? `ps:${s.person_id ?? ''}:${s.skill_id}` },
  }));
  if (status === 'no_evidence') reasons.push({ code: 'cs_none', key: 'm33.reason.none', vars: { n: cs.skill_ids.length } });
  else if (status === 'met') reasons.push({ code: 'cs_met', key: 'm33.reason.met', vars: { level, target: target! } });
  else if (status === 'below') reasons.push({ code: 'cs_below', key: 'm33.reason.below', vars: { level, target: target! } });
  else reasons.push({ code: 'cs_no_target', key: 'm33.reason.noTarget', vars: { level } });
  const pr = practice && practice.n > 0 ? { n: practice.n, pct: practicePct(practice.sum, practice.n) } : null;
  if (pr) reasons.push({ code: 'cs_practice', key: 'm33.reason.practice', vars: { pct: pr.pct, n: pr.n } });
  return {
    core_skill_id: cs.id, cluster: cs.cluster, level, target, status, top_basis: top ? top.basis : null,
    evidence: linked.map((s) => ({ skill_id: s.skill_id, level: Number(s.level), basis: s.basis })), practice: pr, reasons,
  };
}

export function coreProfile(
  personId: string, familyId: string | null, skills: CoreSkillRow[], targets: TargetRow[], states: StateLite[], names: Map<string, SkillName>,
  attempts: PracticeAttemptLite[], today: string,
): CoreProfile {
  const pr = practiceOf(attempts, personId, today);
  const active = skills.filter((s) => (s.status ?? 'active') === 'active').sort(byCoreSort);
  const views = active.map((cs) => {
    const t = familyId ? targets.find((x) => x.family_id === familyId && x.core_skill_id === cs.id) : undefined;
    return coreSkillView(cs, t ? Number(t.level) : null, states, names, pr.get(cs.id));
  });
  const count = (s: CoreStatus) => views.filter((v) => v.status === s).length;
  return {
    person_id: personId, family_id: familyId,
    summary: { met: count('met'), below: count('below'), no_evidence: count('no_evidence'), no_target: count('no_target'), total: views.length },
    skills: views,
  };
}

// ───────────── HR aggregate (skills_profile Agg)
export interface CoreStatRow { core_skill_id: string; met: number | null; below: number | null; no_evidence: number | null; pct_met: number | null }
export interface CoreStats {
  staff: number;
  pct_met: number | null;
  pct_evidenced: number | null;
  by_skill: CoreStatRow[];
  by_cluster: { cluster: string; pct_met: number | null }[];
  by_family: { family_id: string; n: number | null; pct_met: number | null }[];
}
const sup = (v: number, total: number, min: number) => (total >= min && v >= min ? v : null);

export function coreStats(people: PersonLite[], skills: CoreSkillRow[], targets: TargetRow[], statesBy: Map<string, StateLite[]>, minGroup: number): CoreStats {
  const staff = people.filter((p) => p.kind === 'staff' && p.status === 'active').sort((a, b) => cmp(a.id, b.id));
  const active = skills.filter((s) => (s.status ?? 'active') === 'active').sort(byCoreSort);
  const empty = new Map<string, SkillName>();
  const cells: { person: string; family: string | null; cs: string; cluster: string; status: CoreStatus }[] = [];
  for (const p of staff) {
    for (const cs of active) {
      const t = p.job_family_id ? targets.find((x) => x.family_id === p.job_family_id && x.core_skill_id === cs.id) : undefined;
      const v = coreSkillView(cs, t ? Number(t.level) : null, statesBy.get(p.id) ?? [], empty, undefined);
      cells.push({ person: p.id, family: p.job_family_id, cs: cs.id, cluster: cs.cluster, status: v.status });
    }
  }
  const n = staff.length;
  const ok = n >= minGroup;
  const metPairs = cells.filter((c) => c.status === 'met').length;
  const evidenced = new Set(cells.filter((c) => c.status !== 'no_evidence').map((c) => c.person)).size;
  const fams = new Map<string, string[]>();
  for (const p of staff) if (p.job_family_id && !NO_BREAKOUT.includes(p.job_family_id)) (fams.get(p.job_family_id) ?? fams.set(p.job_family_id, []).get(p.job_family_id)!).push(p.id);
  return {
    staff: n,
    pct_met: ok && cells.length ? pct1(metPairs, cells.length) : null,
    pct_evidenced: ok && evidenced >= minGroup ? pct1(evidenced, n) : null,
    by_skill: active.map((cs) => {
      const c = cells.filter((x) => x.cs === cs.id);
      const met = c.filter((x) => x.status === 'met').length;
      return {
        core_skill_id: cs.id, met: sup(met, n, minGroup), below: sup(c.filter((x) => x.status === 'below').length, n, minGroup),
        no_evidence: sup(c.filter((x) => x.status === 'no_evidence').length, n, minGroup), pct_met: ok && met >= minGroup ? pct1(met, n) : null,
      };
    }),
    by_cluster: [...CLUSTERS].map((cl) => {
      const c = cells.filter((x) => x.cluster === cl);
      return { cluster: cl, pct_met: ok && c.length ? pct1(c.filter((x) => x.status === 'met').length, c.length) : null };
    }),
    by_family: [...fams.keys()].sort(cmp).map((f) => {
      const ids = new Set(fams.get(f));
      const c = cells.filter((x) => ids.has(x.person));
      const big = ids.size >= minGroup;
      return { family_id: f, n: big ? ids.size : null, pct_met: big && c.length ? pct1(c.filter((x) => x.status === 'met').length, c.length) : null };
    }),
  };
}

// ───────────── The inclusion rule (McKinsey DELTA) applied to the definitions
export type InclusionCode = 'no_development' | 'no_assessment' | 'shared_approach' | 'few_mappings' | 'wellbeing' | 'no_descriptors' | 'bad_cluster' | 'count';
export interface InclusionProblem { id: string; code: InclusionCode }
const own = (cs: CoreSkillRow, r: RouteRef) => (r.kind === 'practice' || r.kind === 'sjt') && r.ref === cs.id;
/** The routes that make the skill's development and assessment its own: every route except the generic SJT practice on itself. */
export const approachSignature = (cs: CoreSkillRow) =>
  `${cs.development.filter((r) => !own(cs, r)).map((r) => `${r.kind}:${r.ref}`).sort().join(',')}|${cs.assessment.filter((r) => !own(cs, r)).map((r) => `${r.kind}:${r.ref}`).sort().join(',')}`;
export const benchmarkIdsOf = (cs: Pick<CoreSkillRow, 'mappings'>) => [...new Set(cs.mappings.map((m) => m.benchmark_id).filter((x): x is string => !!x))].sort(cmp);

export function inclusionProblems(skills: (CoreSkillRow & { descriptors?: unknown[] })[], expected = CORE_SKILL_COUNT): InclusionProblem[] {
  const out: InclusionProblem[] = [];
  const active = skills.filter((s) => (s.status ?? 'active') === 'active');
  if (active.length !== expected) out.push({ id: '*', code: 'count' });
  const sig = new Map<string, number>();
  for (const s of active) sig.set(approachSignature(s), (sig.get(approachSignature(s)) ?? 0) + 1);
  for (const s of active.sort(byCoreSort)) {
    if (!(CLUSTERS as readonly string[]).includes(s.cluster)) out.push({ id: s.id, code: 'bad_cluster' });
    if (!s.development.some((r) => !own(s, r))) out.push({ id: s.id, code: 'no_development' });
    if (!s.assessment.some((r) => !own(s, r))) out.push({ id: s.id, code: 'no_assessment' });
    if ((sig.get(approachSignature(s)) ?? 0) > 1) out.push({ id: s.id, code: 'shared_approach' });
    if (benchmarkIdsOf(s).length < MIN_BENCHMARK_MAPPINGS) out.push({ id: s.id, code: 'few_mappings' });
    if (WELLBEING.test(`${s.name_en} ${s.name_ar}`)) out.push({ id: s.id, code: 'wellbeing' });
    if (s.descriptors && s.descriptors.length !== CORE_MAX) out.push({ id: s.id, code: 'no_descriptors' });
  }
  return out;
}
