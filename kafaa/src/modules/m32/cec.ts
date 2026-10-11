// FS41 CleanEnergyComp (M32 Energy Transition Skills, FS wave E · E2): ENEC's sustainability competence framework, authored with the
// GreenComp method (12 competences in 4 areas, three per area, each with learning outcomes). Pure rules shared by the pages, the
// LocalBackend, the seed builder and the PGlite validator, mirrored 1:1 by SQL in
// supabase/migrations/20261010252001_kafaa_fs52_energy_transition.sql:
//   competenceLevel() / cecProfile()  = kafaa_cec_comp / kafaa_cec_profile   my level per competence from F01 person skill states of the
//                                        linked catalogue skills (self-claimed states never count), my family target, reasons
//   cecLevel()                         = kafaa_cec_level                       the overall CleanEnergyComp level: the highest level reached
//                                        in every one of the four areas (exported for FS74, the Future Skills Wallet target, wave H)
//   cecStats()                         = kafaa_cec_stats_core                  the HR aggregate (skills_profile Agg), suppressed under 10
//   competenceProblems() / targetProblems()                                    framework checks run by the seed builder and the tests
// Import-free except `.ts` domain rules that are themselves import-free (node scripts load this file directly).
import type { Reason } from '../../domain/engines/types';
import { publicTextIsClean } from '../../domain/future.ts';

export const CEC_AREAS = ['values', 'complexity', 'futures', 'acting'] as const;
export type CecArea = (typeof CEC_AREAS)[number];
/** The GreenComp area each CleanEnergyComp area is authored from (JRC GreenComp 2022, four areas of three competences). */
export const GREENCOMP_AREA: Record<CecArea, string> = {
  values: 'embodying_sustainability_values', complexity: 'embracing_complexity_in_sustainability',
  futures: 'envisioning_sustainable_futures', acting: 'acting_for_sustainability',
};
/** Area names inside reasons (identical CASE in SQL kafaa_cec_area_name). */
export const AREA_NAME: Record<CecArea, { en: string; ar: string }> = {
  values: { en: 'Embodying values', ar: 'تجسيد القيم' },
  complexity: { en: 'Embracing complexity', ar: 'تقبّل التعقيد' },
  futures: { en: 'Envisioning futures', ar: 'استشراف المستقبل' },
  acting: { en: 'Acting for sustainability', ar: 'العمل من أجل الاستدامة' },
};
/** 1 Aware, 2 Practitioner, 3 Advocate. A catalogue skill state at level 3 or above counts as 3. */
export const CEC_MAX = 3;
export const CEC_COUNT = 12;
export const PER_AREA = 3;
/** Bases that count: verified, evidenced, validated. A self-claimed state never counts until a manager validates it. */
export const COUNTED_BASES = ['verified', 'evidenced', 'validated'];
export const BASIS_RANK: Record<string, number> = { verified: 4, evidenced: 3, validated: 2, claimed: 1 };
export const BASIS_AR: Record<string, string> = { verified: 'موثّق', evidenced: 'مُثبت بالأدلة', validated: 'مُصادق عليه', claimed: 'مُعلَن ذاتياً' };
/** Families never broken out in aggregates (security, safeguards and cyber stay at career-path level). */
export const NO_BREAKOUT = ['security', 'safeguards', 'cyber'];
export const LEARNING_KINDS = ['course', 'pathway', 'external', 'adaptive', 'task', 'credential', 'lane', 'chain', 'academy', 'opportunity'] as const;

export interface LearningRef { kind: string; ref: string; title_en: string; title_ar: string }
export interface CecRow {
  id: string; code: string; area: CecArea | string; name_en: string; name_ar: string; skill_ids: string[]; sort: number; status?: string;
  summary_en?: string; summary_ar?: string; plant_en?: string; plant_ar?: string; outcomes?: { en: string; ar: string }[];
  greencomp_area?: string; learning?: LearningRef[]; jahiz_group?: string; net_zero?: boolean; benchmark_ids?: string[]; sources?: { url: string; as_of?: string; label?: string }[];
}
export interface CecTargetRow { id?: string; family_id: string; level: number; focus_ids?: string[] | null; rationale_en?: string; rationale_ar?: string }
export interface StateLite { id?: string; person_id?: string; skill_id: string; level: number | string; basis: string; active: boolean }
export interface SkillName { id: string; name_en: string; name_ar: string }
export interface PersonLite { id: string; kind: string; status: string; job_family_id: string | null }

export type CecStatus = 'met' | 'below' | 'none' | 'no_target';
export interface CecEvidence { skill_id: string; level: number; basis: string }
export interface CecCompView {
  competence_id: string; area: string; level: number; target: number | null; focus: boolean; status: CecStatus; top_basis: string | null;
  evidence: CecEvidence[]; claimed: string[]; reasons: Reason[];
}
export interface CecAreaView { area: string; level: number; competence_id: string | null }
export interface CecProfile {
  person_id: string; family_id: string | null; level: number; target: number | null; status: CecStatus;
  areas: CecAreaView[]; competences: CecCompView[]; grow: string[]; reasons: Reason[];
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const byCecSort = (a: Pick<CecRow, 'sort' | 'id'>, b: Pick<CecRow, 'sort' | 'id'>) => Number(a.sort) - Number(b.sort) || cmp(a.id, b.id);
export const cecLevelOf = (stateLevel: number) => Math.max(0, Math.min(CEC_MAX, Math.floor(Number(stateLevel))));
/** One-decimal percentage a / b, half up, in integers (identical in SQL kafaa_cec_pct1). */
export const pct1 = (a: number, b: number) => Math.floor((2000 * a + b) / (2 * b)) / 10;
const active = (rows: CecRow[]) => rows.filter((c) => (c.status ?? 'active') === 'active').sort(byCecSort);

/** One competence for one person: the counted evidence (level desc, basis rank desc, skill id), the level and the self-claimed-only skills. */
export function competenceLevel(c: Pick<CecRow, 'skill_ids'>, states: StateLite[]): { level: number; evidence: (StateLite & { level: number })[]; claimed: string[] } {
  const linked = states.filter((s) => s.active && c.skill_ids.includes(s.skill_id) && Number(s.level) >= 1);
  const counted = linked.filter((s) => COUNTED_BASES.includes(s.basis)).map((s) => ({ ...s, level: Number(s.level) }))
    .sort((a, b) => b.level - a.level || (BASIS_RANK[b.basis] ?? 0) - (BASIS_RANK[a.basis] ?? 0) || cmp(a.skill_id, b.skill_id));
  const countedIds = new Set(counted.map((s) => s.skill_id));
  const claimed = [...new Set(linked.filter((s) => s.basis === 'claimed' && !countedIds.has(s.skill_id)).map((s) => s.skill_id))].sort(cmp);
  return { level: counted.length ? cecLevelOf(counted[0].level) : 0, evidence: counted, claimed };
}

const statusOf = (level: number, target: number | null): CecStatus => (level === 0 ? 'none' : target == null ? 'no_target' : level >= target ? 'met' : 'below');

export function competenceView(personId: string, c: CecRow, target: number | null, focusTargetId: string | null, states: StateLite[], names: Map<string, SkillName>): CecCompView {
  const focus = focusTargetId != null;
  const { level, evidence, claimed } = competenceLevel(c, states);
  const status = statusOf(level, target);
  const nm = (id: string) => { const s = names.get(id); return { en: s?.name_en ?? id, ar: s?.name_ar ?? id }; };
  const reasons: Reason[] = evidence.slice(0, 2).map((s) => ({
    code: 'cec_evidence', key: 'm32.reason.evidence', vars: { skill: nm(s.skill_id), level: s.level, basis: { en: s.basis, ar: BASIS_AR[s.basis] ?? s.basis } },
    ref: { table: 'person_skills', id: s.id ?? `ps:${personId}:${s.skill_id}` },
  }));
  if (claimed.length) reasons.push({ code: 'cec_claimed', key: 'm32.reason.claimed', vars: { n: claimed.length } });
  if (status === 'none') reasons.push({ code: 'cec_none', key: 'm32.reason.none', vars: { n: c.skill_ids.length } });
  else if (status === 'met') reasons.push({ code: 'cec_met', key: 'm32.reason.met', vars: { level, target: target! } });
  else if (status === 'below') reasons.push({ code: 'cec_below', key: 'm32.reason.below', vars: { level, target: target! } });
  else reasons.push({ code: 'cec_no_target', key: 'm32.reason.noTarget', vars: { level } });
  if (focus) reasons.push({ code: 'cec_focus', key: 'm32.reason.focus', ref: { table: 'cec_role_targets', id: focusTargetId! } });
  return {
    competence_id: c.id, area: c.area, level, target, focus, status, top_basis: evidence[0]?.basis ?? null,
    evidence: evidence.map((s) => ({ skill_id: s.skill_id, level: s.level, basis: s.basis })), claimed, reasons,
  };
}

/** The overall level: per area the best competence (level desc, then sort), overall = the lowest area level. */
export function areasOf(views: CecCompView[], comps: CecRow[]): CecAreaView[] {
  const sortOf = new Map(comps.map((c) => [c.id, Number(c.sort)]));
  return CEC_AREAS.map((a) => {
    const best = views.filter((v) => v.area === a && v.level > 0)
      .sort((x, y) => y.level - x.level || (sortOf.get(x.competence_id) ?? 0) - (sortOf.get(y.competence_id) ?? 0) || cmp(x.competence_id, y.competence_id))[0];
    return { area: a, level: best ? best.level : 0, competence_id: best ? best.competence_id : null };
  });
}

export function cecProfile(personId: string, familyId: string | null, comps: CecRow[], targets: CecTargetRow[], states: StateLite[], names: Map<string, SkillName>): CecProfile {
  const t = familyId ? [...targets].sort((a, b) => cmp(String(a.id ?? ''), String(b.id ?? ''))).find((x) => x.family_id === familyId) : undefined;
  const target = t ? Number(t.level) : null;
  const focusIds = new Set(t?.focus_ids ?? []);
  const list = active(comps);
  const views = list.map((c) => competenceView(personId, c, target, focusIds.has(c.id) ? String(t?.id ?? '') : null, states, names));
  const areas = areasOf(views, list);
  const level = Math.min(...areas.map((a) => a.level));
  const status = statusOf(level, target);
  const reasons: Reason[] = areas.map((a) => ({ code: 'cec_area', key: 'm32.reason.area', vars: { area: AREA_NAME[a.area as CecArea], level: a.level } }));
  reasons.push(status === 'none' ? { code: 'cec_level_none', key: 'm32.reason.levelNone' }
    : status === 'met' ? { code: 'cec_level_met', key: 'm32.reason.levelMet', vars: { level, target: target! } }
    : status === 'below' ? { code: 'cec_level_below', key: 'm32.reason.levelBelow', vars: { level, target: target! } }
    : { code: 'cec_level_no_target', key: 'm32.reason.levelNoTarget', vars: { level } });
  const sortOf = new Map(list.map((c) => [c.id, Number(c.sort)]));
  const gap = (v: CecCompView) => (v.target ?? 1) - v.level;
  const grow = views.filter((v) => v.status === 'below' || v.status === 'none')
    .sort((a, b) => Number(b.focus) - Number(a.focus) || gap(b) - gap(a) || (sortOf.get(a.competence_id) ?? 0) - (sortOf.get(b.competence_id) ?? 0) || cmp(a.competence_id, b.competence_id))
    .map((v) => v.competence_id);
  return { person_id: personId, family_id: familyId, level, target, status, areas, competences: views, grow, reasons };
}

/** FS74 hand-off: the overall CleanEnergyComp level of a person (0 when any area has no counted evidence). SQL kafaa_cec_level. */
export function cecLevel(comps: CecRow[], states: StateLite[]): number {
  const list = active(comps);
  return Math.min(...CEC_AREAS.map((a) => Math.max(0, ...list.filter((c) => c.area === a).map((c) => competenceLevel(c, states).level))));
}

// ───────────── HR aggregate (skills_profile Agg)
export interface CecStats {
  staff: number;
  pct_l1: number | null;
  pct_met: number | null;
  by_level: { level: number; n: number | null }[];
  by_area: { area: string; pct_l1: number | null }[];
  by_family: { family_id: string; n: number | null; target: number | null; pct_met: number | null }[];
}
export function cecStats(people: PersonLite[], comps: CecRow[], targets: CecTargetRow[], statesBy: Map<string, StateLite[]>, min: number): CecStats {
  const staff = people.filter((p) => p.kind === 'staff' && p.status === 'active').sort((a, b) => cmp(a.id, b.id));
  const empty = new Map<string, SkillName>();
  const prof = staff.map((p) => ({ p, v: cecProfile(p.id, p.job_family_id, comps, targets, statesBy.get(p.id) ?? [], empty) }));
  const n = staff.length;
  const ok = n >= min;
  const l1 = prof.filter((x) => x.v.level >= 1).length;
  const withT = prof.filter((x) => x.v.target != null);
  const met = withT.filter((x) => x.v.status === 'met').length;
  const tgtOf = (f: string) => { const t = [...targets].sort((a, b) => cmp(String(a.id ?? ''), String(b.id ?? ''))).find((x) => x.family_id === f); return t ? Number(t.level) : null; };
  const fams = [...new Set(staff.map((p) => p.job_family_id).filter((f): f is string => !!f && !NO_BREAKOUT.includes(f)))].sort(cmp);
  return {
    staff: n,
    pct_l1: ok && l1 >= min ? pct1(l1, n) : null,
    pct_met: withT.length >= min && met >= min ? pct1(met, withT.length) : null,
    by_level: [0, 1, 2, 3].map((l) => { const c = prof.filter((x) => x.v.level === l).length; return { level: l, n: ok && c >= min ? c : null }; }),
    by_area: CEC_AREAS.map((a) => { const c = prof.filter((x) => (x.v.areas.find((y) => y.area === a)?.level ?? 0) >= 1).length; return { area: a, pct_l1: ok && c >= min ? pct1(c, n) : null }; }),
    by_family: fams.map((f) => {
      const g = prof.filter((x) => x.p.job_family_id === f);
      const m = g.filter((x) => x.v.status === 'met').length;
      const big = g.length >= min;
      return { family_id: f, n: big ? g.length : null, target: tgtOf(f), pct_met: big && m >= min ? pct1(m, g.length) : null };
    }),
  };
}

// ───────────── Framework checks (seed builder, tests)
export type CecProblem = 'code' | 'area' | 'name' | 'outcomes' | 'greencomp' | 'skills' | 'fs02' | 'learning' | 'sources' | 'clean' | 'count';
export interface SkillRef { id: string; fs_area?: string | null; area?: string | null; lifecycle?: string | null }
const HTTPS = /^https:\/\/[^\s]+$/;
const txt = (v: unknown, lo = 3, hi = 400) => typeof v === 'string' && v.trim().length >= lo && v.trim().length <= hi;
/** Problems with one competence: EN/AR text, 2-4 outcomes in both languages, the GreenComp area and a GreenComp source, at least one
 *  FS02 future skill (never security or obsolete), at least one existing learning item, https sources with an as-of date, clean copy. */
export function competenceProblems(c: CecRow, skills: SkillRef[], learningExists: (r: LearningRef) => boolean): CecProblem[] {
  const out: CecProblem[] = [];
  if (!/^CEC-[1-4]\.[1-3]$/.test(c.code)) out.push('code');
  if (!(CEC_AREAS as readonly string[]).includes(c.area) || c.code.slice(4, 5) !== String(CEC_AREAS.indexOf(c.area as CecArea) + 1)) out.push('area');
  if (!txt(c.name_en, 3, 120) || !txt(c.name_ar, 3, 120) || !txt(c.summary_en, 10) || !txt(c.summary_ar, 10)) out.push('name');
  const oc = c.outcomes ?? [];
  if (oc.length < 2 || oc.length > 4 || !oc.every((o) => txt(o.en, 10, 300) && txt(o.ar, 10, 300))) out.push('outcomes');
  if (c.greencomp_area !== GREENCOMP_AREA[c.area as CecArea] || !(c.sources ?? []).some((s) => /joint-research-centre\.ec\.europa\.eu\/greencomp|GreenComp/i.test(`${s.url} ${s.label ?? ''}`)) || !(c.benchmark_ids ?? []).includes('GREENCOMP')) out.push('greencomp');
  const sk = c.skill_ids.map((id) => skills.find((s) => s.id === id));
  if (!sk.length || sk.some((s) => !s || s.area === 'security' || s.lifecycle === 'obsolete')) out.push('skills');
  if (!sk.some((s) => s && s.fs_area)) out.push('fs02');
  if (!(c.learning ?? []).length || !(c.learning ?? []).every((r) => (LEARNING_KINDS as readonly string[]).includes(r.kind) && txt(r.title_en, 2) && txt(r.title_ar, 2) && learningExists(r))) out.push('learning');
  if (!(c.sources ?? []).length || !(c.sources ?? []).every((s) => HTTPS.test(s.url) && /^\d{4}-\d{2}-\d{2}$/.test(s.as_of ?? ''))) out.push('sources');
  if (!publicTextIsClean([c.name_en, c.name_ar, c.summary_en, c.summary_ar, c.plant_en, c.plant_ar, c.outcomes])) out.push('clean');
  return out;
}
/** The framework as a whole: 12 competences, three per area, unique codes, no problem in any competence. */
export function frameworkProblems(comps: CecRow[], skills: SkillRef[], learningExists: (r: LearningRef) => boolean): { id: string; code: CecProblem }[] {
  const list = active(comps);
  const out: { id: string; code: CecProblem }[] = [];
  if (list.length !== CEC_COUNT || CEC_AREAS.some((a) => list.filter((c) => c.area === a).length !== PER_AREA) || new Set(list.map((c) => c.code)).size !== list.length) out.push({ id: '*', code: 'count' });
  for (const c of list) for (const p of competenceProblems(c, skills, learningExists)) out.push({ id: c.id, code: p });
  return out;
}
/** Role targets: one per job family, level 1-3, focus competences that exist, rationale in both languages, clean copy. */
export function targetProblems(targets: CecTargetRow[], familyIds: string[], compIds: string[]): string[] {
  const out: string[] = [];
  for (const f of familyIds) if (targets.filter((t) => t.family_id === f).length !== 1) out.push(`family:${f}`);
  for (const t of targets) {
    if (!Number.isInteger(Number(t.level)) || Number(t.level) < 1 || Number(t.level) > CEC_MAX) out.push(`level:${t.family_id}`);
    if (!(t.focus_ids ?? []).length || !(t.focus_ids ?? []).every((x) => compIds.includes(x))) out.push(`focus:${t.family_id}`);
    if (!txt(t.rationale_en, 10) || !txt(t.rationale_ar, 10) || !publicTextIsClean([t.rationale_en, t.rationale_ar])) out.push(`rationale:${t.family_id}`);
  }
  return out;
}

// ───────────── wave E integration (FS41 -> FS31): the competences a micro-credential's criteria cite
export interface CriterionLite { key: string; kind: string; ref: string }
/**
 * CleanEnergyComp competences cited by credential criteria: a skill criterion cites every competence that links the skill; any other
 * criterion cites the competences that list its item (course, adaptive bank, performance task, pathway, opportunity) as learning.
 * Framework order; each with the criterion keys that cite it. Same rule as the SQL helper kafaa_cec_cites (fs5qa migration).
 */
export function cecCitations(criteria: CriterionLite[], comps: CecRow[]): { id: string; code: string; keys: string[] }[] {
  const out: { id: string; code: string; keys: string[] }[] = [];
  for (const c of [...comps].filter((x) => x.status !== 'retired').sort(byCecSort)) {
    const keys = criteria.filter((k) => (k.kind === 'skill' ? (c.skill_ids ?? []).includes(k.ref) : (c.learning ?? []).some((l) => l.kind === k.kind && l.ref === k.ref))).map((k) => k.key);
    if (keys.length) out.push({ id: c.id, code: c.code, keys });
  }
  return out;
}
