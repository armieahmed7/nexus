/**
 * FS68 Supplier future-skills readiness (FS wave G · E5, M09): pure rules shared by the pages, the LocalBackend RPC
 * (backend/local.fs75.ts) and, rule for rule, the SQL in supabase/migrations/20261010275001_kafaa_fs75_supplier_readiness.sql
 * (kafaa_fr_*). PGlite proves SQL = TS (scripts/validate/fs75-supplier-readiness.mjs). Import-free apart from the F33 rules
 * (./contractor.ts, itself import-free), so node scripts load it directly.
 *
 * For every supplier organisation, the contractor workforce on the F33 passport (people of kind `contractor`; company representatives
 * of kind `partner` are not counted) is compared with the FS05 2030 version of each ENEC role profile the organisation is contracted
 * to staff (F33 contract_role_targets). A 2030 requirement is "future" when the role's current ("now") profile does not ask for it, or
 * asks for a lower level. Future requirements are grouped as digital, AI literacy, cyber hygiene and other future skills.
 *
 *   met      the contractor holds the skill (or, for a competency, the F02 competency level) at the 2030 level, backed by records
 *            (self-claimed levels never count)
 *   bridge   not met, but a foundation is held: the skill itself one level short, or a recorded level 2+ in a skill of the same
 *            competency or an adjacent skill (F01 adjacency); for a competency, one level short
 *   fresh    neither: the skill is new to the contractor
 *
 * An organisation with fewer than 10 contractors returns no counts at all (suppressed), only the requirements and the course
 * suggestions. Suggestions come from the F33 engine: courseSkills() mapping, the same reason codes (academy_course / enec_course /
 * closes_gap), supplier academy courses first; the course pool adds the ENEC future-skills pack (pg-fs-pack) to the F33 programmes.
 */
import { GAP_PROGRAMMES, SUGGESTION_MAX, courseSkills, isSecuritySkill, m09r, securityCompsOf, type SkillLite } from './contractor.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
type Bi = { en: string; ar: string };
interface Reason { code: string; key: string; vars?: Record<string, unknown>; ref?: { table: string; id: string } }

export const FR_MIN_GROUP = 10;
export const FR_GROUPS = ['digital', 'ai_literacy', 'cyber_hygiene', 'other_future'] as const;
export type FrGroup = (typeof FR_GROUPS)[number];
export const FR_PROGRAMMES = [...GAP_PROGRAMMES, 'pg-fs-pack'];
export const FR_IMPORTANCE_W: Record<string, number> = { core: 3, important: 2, useful: 1 };

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Half-up whole percentage a/b (0 when b is 0). Same integer formula in SQL. */
export const frPct = (a: number, b: number) => (b > 0 ? Math.floor((200 * a + b) / (2 * b)) : 0);

/** The future-skill group of a requirement (skill row or competency id). */
export function frGroupOf(kind: string, ref: string, skill: Row | undefined): FrGroup {
  if (kind === 'competency') return ref === 'da-02' ? 'ai_literacy' : ref === 'da-01' ? 'digital' : 'other_future';
  if (!skill) return 'other_future';
  if (skill.fs_area === 'cyber_hygiene') return 'cyber_hygiene';
  if (skill.fs_area === 'ai_data' || skill.competency_id === 'da-02') return 'ai_literacy';
  if (skill.area === 'digital' || skill.fs_area === 'digital_plant' || skill.competency_id === 'da-01') return 'digital';
  return 'other_future';
}

export interface FrReq {
  kind: 'skill' | 'competency'; ref_id: string; level: number; now_level: number | null; importance: string; driver: string | null;
  group: FrGroup; name: Bi; met: number | null; bridge: number | null; fresh: number | null; pct: number | null;
}
export interface FrRole {
  role_id: string; title: Bi; band: string; profile_id: string | null; version: number | null; now_profile_id: string | null;
  today_total: number; today_pct: number | null; future: FrReq[]; future_pct: number | null; bridge_pct: number | null; reasons: Reason[];
}
export interface FrGroupRow { group: FrGroup; reqs: number; pct: number | null; bridge_pct: number | null }
export interface FrSuggestion { id: string; score: number; reasons: Reason[]; code: string; title: Bi; audience: string; hours: number | null }
export interface FrOrg {
  org_id: string; name: Bi; n: number | null; suppressed: boolean; roles: FrRole[]; groups: FrGroupRow[]; future_pct: number | null;
  suggestions: FrSuggestion[]; academy_gaps: { skill_id: string; name: Bi }[];
}
export interface FrReport { allowed: boolean; scope: 'own' | 'all' | 'none'; min_group: number; orgs: FrOrg[] }

export interface FrWorld {
  orgs: Row[]; people: Row[]; states: Row[]; skills: SkillLite[] & Row[]; comps: Row[]; targets: Row[]; profiles: Row[]; roles: Row[]; courses: Row[];
}

/** Level, basis of a requirement for one person's active, recorded (non-claimed) states. */
function haveOf(kind: string, ref: string, st: Row[], skillBy: Map<string, Row>): number {
  if (kind === 'skill') return Math.max(0, ...st.filter((s) => s.skill_id === ref).map((s) => Number(s.level)));
  // F02 competencyLevels: the core skill's level when held, else the strongest specialised skill of the competency
  const own = st.filter((s) => skillBy.get(s.skill_id)?.competency_id === ref);
  const core = own.filter((s) => skillBy.get(s.skill_id)?.core === true);
  return Math.max(0, ...(core.length ? core : own).map((s) => Number(s.level)));
}
function statusOf(kind: string, ref: string, need: number, st: Row[], skillBy: Map<string, Row>): 'met' | 'bridge' | 'fresh' {
  const have = haveOf(kind, ref, st, skillBy);
  if (have >= need) return 'met';
  if (have > 0 && have === need - 1) return 'bridge';
  if (kind === 'skill') {
    const sk = skillBy.get(ref);
    const adj = new Set<string>(sk?.adjacent_ids ?? []);
    if (st.some((s) => s.skill_id !== ref && Number(s.level) >= 2 && (adj.has(s.skill_id) || (sk && skillBy.get(s.skill_id)?.competency_id === sk.competency_id)))) return 'bridge';
  }
  return 'fresh';
}

/** Requirements of the published 2030 profile, each marked future or today against the published "now" profile. */
export function frRequirements(p2030: Row | undefined, pNow: Row | undefined): { kind: 'skill' | 'competency'; ref_id: string; level: number; importance: string; driver: string | null; now_level: number | null; future: boolean }[] {
  const now = new Map<string, number>();
  for (const r of (pNow?.requirements ?? []) as Row[]) now.set(`${r.kind}:${r.ref_id}`, Math.max(now.get(`${r.kind}:${r.ref_id}`) ?? 0, Number(r.level)));
  return ((p2030?.requirements ?? []) as Row[])
    .filter((r) => r.kind === 'skill' || r.kind === 'competency')
    .map((r) => {
      const nl = now.get(`${r.kind}:${r.ref_id}`) ?? null;
      return { kind: r.kind, ref_id: String(r.ref_id), level: Number(r.level), importance: String(r.importance ?? 'useful'), driver: r.driver ?? null, now_level: nl, future: nl == null || Number(r.level) > nl };
    });
}

/** The readiness of the listed organisations (`orgIds` null = every supplier organisation with contractors or contracted roles). */
export function supplierFutureReadiness(w: FrWorld, orgIds: string[] | null): FrOrg[] {
  const sec = securityCompsOf(w.comps);
  const skillBy = new Map<string, Row>(w.skills.map((s) => [s.id, s]));
  const compBy = new Map(w.comps.map((c) => [c.id, c]));
  const roleBy = new Map(w.roles.map((r) => [r.id, r]));
  const orgBy = new Map(w.orgs.filter((o) => o.kind === 'supplier').map((o) => [o.id, o]));
  const contractors = w.people.filter((p) => p.kind === 'contractor' && p.status === 'active' && p.org_id && orgBy.has(p.org_id));
  const targets = w.targets.filter((t) => t.active === true && orgBy.has(t.org_id));
  const pubProfile = (role: string, horizon: string) => w.profiles.filter((p) => p.role_id === role && p.horizon === horizon && p.status === 'published')
    .sort((a, b) => Number(b.version) - Number(a.version) || cmp(String(a.id), String(b.id)))[0];
  const ids = [...new Set([...contractors.map((p) => p.org_id as string), ...targets.map((t) => t.org_id as string)])]
    .filter((id) => orgIds == null || orgIds.includes(id)).sort(cmp);
  const nameOfReq = (kind: string, ref: string): Bi => {
    if (kind === 'skill') { const s = skillBy.get(ref); return { en: s?.name_en ?? ref, ar: s?.name_ar ?? ref }; }
    const c = compBy.get(ref); return { en: `${c?.code ?? ref} ${c?.name_en ?? ''}`.trim(), ar: `${c?.code ?? ref} ${c?.name_ar ?? ''}`.trim() };
  };
  const out: FrOrg[] = [];
  for (const orgId of ids) {
    const org = orgBy.get(orgId)!;
    const people = contractors.filter((p) => p.org_id === orgId).map((p) => p.id as string);
    const n = people.length;
    const suppressed = n < FR_MIN_GROUP;
    const stBy = new Map<string, Row[]>(people.map((id) => [id, w.states.filter((s) => s.person_id === id && s.active !== false && Number(s.level) > 0 && s.basis !== 'claimed'
      && skillBy.has(s.skill_id) && !isSecuritySkill(skillBy.get(s.skill_id) as SkillLite, sec))]));
    const roles: FrRole[] = [];
    const groupAcc = new Map<FrGroup, { reqs: number; met: number; bridge: number }>();
    const gapW = new Map<string, number>();
    const orgTargets = targets.filter((t) => t.org_id === orgId).sort((a, b) => Number(roleBy.get(a.role_id)?.sort ?? 0) - Number(roleBy.get(b.role_id)?.sort ?? 0) || cmp(a.role_id, b.role_id));
    let futMet = 0; let futAll = 0;
    for (const t of orgTargets) {
      const role = roleBy.get(t.role_id);
      const p30 = pubProfile(t.role_id, '2030');
      const pNow = pubProfile(t.role_id, 'now');
      const reqs = frRequirements(p30, pNow).filter((r) => r.kind === 'competency' ? !sec.has(r.ref_id) : skillBy.has(r.ref_id) && !isSecuritySkill(skillBy.get(r.ref_id) as SkillLite, sec));
      const today = reqs.filter((r) => !r.future);
      let todayMet = 0;
      for (const r of today) for (const id of people) if (statusOf(r.kind, r.ref_id, r.level, stBy.get(id)!, skillBy) === 'met') todayMet++;
      const future: FrReq[] = [];
      const reasons: Reason[] = [];
      let rMet = 0; let rBridge = 0;
      for (const r of reqs.filter((x) => x.future)) {
        let met = 0; let bridge = 0;
        for (const id of people) { const s = statusOf(r.kind, r.ref_id, r.level, stBy.get(id)!, skillBy); if (s === 'met') met++; else if (s === 'bridge') bridge++; }
        const group = frGroupOf(r.kind, r.ref_id, skillBy.get(r.ref_id));
        rMet += met; rBridge += bridge;
        const g = groupAcc.get(group) ?? { reqs: 0, met: 0, bridge: 0 };
        groupAcc.set(group, { reqs: g.reqs + 1, met: g.met + met, bridge: g.bridge + bridge });
        const name = nameOfReq(r.kind, r.ref_id);
        future.push({
          kind: r.kind, ref_id: r.ref_id, level: r.level, now_level: r.now_level, importance: r.importance, driver: r.driver, group, name,
          met: suppressed ? null : met, bridge: suppressed ? null : bridge, fresh: suppressed ? null : n - met - bridge, pct: suppressed ? null : frPct(met, n),
        });
        // a gap skill for the course suggestions: every future requirement not met by everyone (suppressed: every future requirement)
        if (suppressed || met < n) {
          const skillIds = r.kind === 'skill' ? [r.ref_id] : w.skills.filter((s) => s.core && s.competency_id === r.ref_id).map((s) => s.id);
          for (const sid of skillIds) gapW.set(sid, Math.max(gapW.get(sid) ?? 0, FR_IMPORTANCE_W[r.importance] ?? 1));
        }
        reasons.push(suppressed
          ? m09r('fr_req_suppressed', { skill: name, need: r.level })
          : m09r(met === n ? 'fr_req_met' : bridge > 0 ? 'fr_req_bridge' : 'fr_req_new', { skill: name, need: r.level, met, bridge, n }, r.kind === 'skill' ? { table: 'skills', id: r.ref_id } : { table: 'competencies', id: r.ref_id }));
      }
      futMet += rMet; futAll += future.length * n;
      if (!future.length) reasons.push(m09r('fr_no_future', { role: { en: role?.title_en ?? t.role_id, ar: role?.title_ar ?? t.role_id } }));
      if (!p30) reasons.unshift(m09r('fr_no_profile', { role: { en: role?.title_en ?? t.role_id, ar: role?.title_ar ?? t.role_id } }));
      roles.push({
        role_id: t.role_id, title: { en: role?.title_en ?? t.role_id, ar: role?.title_ar ?? t.role_id }, band: String(t.headcount_band), profile_id: p30?.id ?? null,
        version: p30 ? Number(p30.version) : null, now_profile_id: pNow?.id ?? null, today_total: today.length,
        today_pct: suppressed ? null : frPct(todayMet, today.length * n), future,
        future_pct: suppressed ? null : frPct(rMet, future.length * n), bridge_pct: suppressed ? null : frPct(rBridge, future.length * n), reasons,
      });
    }
    const groups: FrGroupRow[] = FR_GROUPS.map((g) => {
      const a = groupAcc.get(g) ?? { reqs: 0, met: 0, bridge: 0 };
      return { group: g, reqs: a.reqs, pct: suppressed || !a.reqs ? null : frPct(a.met, a.reqs * n), bridge_pct: suppressed || !a.reqs ? null : frPct(a.bridge, a.reqs * n) };
    });
    // course suggestions: the F33 engine (courseSkills + the F33 reason codes), supplier academy first on ties
    const sugg: FrSuggestion[] = [];
    for (const c of w.courses) {
      if (!FR_PROGRAMMES.includes(c.programme_id) || (c.competency_ids ?? []).some((id: string) => sec.has(id))) continue;
      const covers = courseSkills(c, w.skills, sec).filter((x) => gapW.has(x.skill_id)).map((x) => x.skill_id);
      if (!covers.length) continue;
      const supplier = c.audience === 'supplier';
      sugg.push({
        id: c.id, score: covers.reduce((a, s) => a + gapW.get(s)!, 0) + (supplier ? 0.5 : 0),
        reasons: [m09r(supplier ? 'academy_course' : 'enec_course', { code: { en: String(c.code ?? ''), ar: String(c.code ?? '') } }, { table: 'courses', id: c.id }),
          ...covers.map((s) => m09r('closes_gap', { skill: { en: skillBy.get(s)?.name_en ?? s, ar: skillBy.get(s)?.name_ar ?? s } }, { table: 'skills', id: s }))],
        code: String(c.code ?? ''), title: { en: String(c.title_en ?? ''), ar: String(c.title_ar ?? '') }, audience: String(c.audience ?? ''), hours: c.duration_hours == null ? null : Number(c.duration_hours),
      });
    }
    sugg.sort((a, b) => b.score - a.score || cmp(a.id, b.id));
    // gap skills no supplier academy course evidences yet (an insight for ENEC supplier management)
    const academy = new Set<string>();
    for (const c of w.courses) if (c.programme_id === 'supplier-academy' && !(c.competency_ids ?? []).some((id: string) => sec.has(id))) for (const x of courseSkills(c, w.skills, sec)) academy.add(x.skill_id);
    const academy_gaps = [...gapW.keys()].filter((s) => !academy.has(s)).sort(cmp).map((s) => ({ skill_id: s, name: { en: skillBy.get(s)?.name_en ?? s, ar: skillBy.get(s)?.name_ar ?? s } }));
    out.push({
      org_id: orgId, name: { en: String(org.name_en ?? orgId), ar: String(org.name_ar ?? org.name_en ?? orgId) }, n: suppressed ? null : n, suppressed, roles, groups,
      future_pct: suppressed ? null : frPct(futMet, futAll), suggestions: sugg.slice(0, SUGGESTION_MAX), academy_gaps,
    });
  }
  return out;
}
