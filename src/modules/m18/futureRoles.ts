/**
 * FS15 Future roles in the Navigator and Roadmap (FS wave B · E5). Pure rules, import-free apart from the F05 rules in
 * ./career.ts (also pure), so the seed builder, the PGlite validator, the LocalBackend and the pages share them.
 * SQL mirror, change both together: supabase/migrations/20261010225001_kafaa_fs25_future_roles.sql
 *   conceptReadiness   = kafaa_fs15_concept_readiness_compute
 *   transitionEvidence = kafaa_fs15_transition_compute
 * scripts/validate/fs25-future-roles.mjs proves SQL = TS for every seeded staff member x every concept role, and for every
 * current role x every target.
 *
 * Concept roles (FS05: job_roles.lifecycle = 'concept') have no vacancy and imply no deployment decision. Readiness for them is
 * measured against their FS05 profile (the earliest published horizon: 2030, else 2035, highest version), never against
 * role_competencies (they have none):
 *   score   = sum(min(have, need) / need x w) / sum(w), w = the Navigator's engine weights (core / important / useful)
 *   have    = competency requirement: the person's competency level (F05 rule: core skill, else best skill of the competency)
 *             skill requirement: the person's active level in that skill (FS02 future skills have no holders yet: honest 0)
 *   bridge  = the inbound FS05 "future" edge (current role -> concept role), the person's own role first; its months condition
 *             is counted from the person's own records (F05 careerFacts)
 *   months  = max(bridge months still to serve, 2 months per missing level, capped at 120)
 *   band    = profile_met (score >= 0.85 and nothing left to serve), within (<= 36 months), stretch
 * Transition evidence: how many colleagues made a move and the median months they had spent in the previous role, from the
 * SIMULATED anonymised kafaa_role_moves mirror. Counts under MIN_GROUP are suppressed (no count, no median). Nobody can have
 * moved into a concept role yet, so a concept target shows the closest real evidence instead: moves from the same role into
 * current roles of the concept role's job family (also suppressed under 10). Security, safeguards and cyber roles: path only.
 */
import { competencyLevelsOf, monthsBetween, type BiText, type CareerFacts, type Reason } from './career.ts';

export const MIN_GROUP = 10;
export const READY_SCORE = 0.85;
export const WITHIN_MONTHS = 36;
export const MONTHS_PER_LEVEL = 2;
export const MAX_MONTHS = 120;
export const MAX_ROLES = 40;
/** Horizon preference for a concept role's profile: the earliest one described. */
export const CONCEPT_HORIZONS = ['2030', '2035'] as const;
const IMP_DEFAULT: Record<string, number> = { core: 3, important: 2, useful: 1 };

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const r4 = (x: number) => Math.floor(x * 10000 + 0.5) / 10000;
const rsn = (code: string, key: string, vars?: Reason['vars'], ref?: Reason['ref']): Reason => ({ code, key, ...(vars ? { vars } : {}), ...(ref ? { ref } : {}) });

export interface ConceptReq { kind: 'competency' | 'skill'; ref_id: string; level: number; importance: string; why_en?: string; why_ar?: string; driver?: string | null }
export interface ConceptRole { id: string; title_en: string; title_ar: string; lifecycle?: string | null; security_sensitive?: boolean | null; family_id?: string | null }
export interface ConceptVersion { id: string; role_id: string; horizon: string; version: number; status: string; requirements: unknown }
export interface ConceptEdge { id: string; from_role_id: string | null; to_role_id: string; conditions: unknown; sort?: number | null; kind?: string | null }
export interface ConceptData {
  roles: ConceptRole[];
  versions: ConceptVersion[];
  edges: ConceptEdge[];
  skills: { id: string; competency_id: string; core: boolean; name_en?: string; name_ar?: string }[];
  competencies: { id: string; name_en: string; name_ar: string }[];
  states: { person_id: string; skill_id: string; level: number; active?: boolean | null }[];
  weights?: Record<string, number>;
}
export type ConceptBand = 'profile_met' | 'within' | 'stretch';
export interface ConceptGap { kind: 'competency' | 'skill'; ref_id: string; have: number; need: number; importance: string; why: BiText }
export interface ConceptBridge { edge_id: string; from_role_id: string | null; mine: boolean; need_months: number; remaining_months: number }
export interface ConceptReadiness {
  role_id: string;
  concept: true;
  profile_id: string;
  horizon: string;
  version: number;
  score: number;
  pct: number;
  band: ConceptBand;
  months: number;
  gap_months: number;
  bridge: ConceptBridge | null;
  bridges: number;
  gaps: ConceptGap[];
  reasons: Reason[];
}

export const isConcept = (r: Pick<ConceptRole, 'lifecycle'> | null | undefined) => r?.lifecycle === 'concept';
export const isFutureEdge = (e: { kind?: string | null }) => (e.kind ?? 'current') === 'future';
export const reqsOfVersion = (v: Pick<ConceptVersion, 'requirements'> | null | undefined): ConceptReq[] => (v && Array.isArray(v.requirements) ? (v.requirements as ConceptReq[]) : []);

/** The FS05 profile a concept role is measured against: earliest published horizon, highest version. */
export function conceptProfile<V extends ConceptVersion>(versions: V[], roleId: string): V | null {
  for (const h of CONCEPT_HORIZONS) {
    let best: V | null = null;
    for (const v of versions) if (v.role_id === roleId && v.status === 'published' && v.horizon === h && (!best || v.version > best.version)) best = v;
    if (best) return best;
  }
  return null;
}

const edgeMonths = (e: { conditions: unknown }) =>
  (Array.isArray(e.conditions) ? (e.conditions as { kind: string; value: unknown }[]) : []).reduce((m, c) => (c.kind === 'months' && typeof c.value === 'number' ? Math.max(m, c.value) : m), 0);

/** Inbound future edges to a concept role, evaluated for the person: their own role first, then by sort and id. */
export function conceptBridges(edges: ConceptEdge[], roleId: string, f: Pick<CareerFacts, 'role_id' | 'qualified_in_role' | 'months_in_role'>): ConceptBridge[] {
  return edges
    .filter((e) => e.to_role_id === roleId && isFutureEdge(e))
    .map((e) => {
      const mine = !!f.role_id && e.from_role_id === f.role_id;
      const need = edgeMonths(e);
      const remaining = mine && f.qualified_in_role ? Math.max(0, need - f.months_in_role) : need;
      return { edge_id: e.id, from_role_id: e.from_role_id, mine, need_months: need, remaining_months: remaining, _sort: e.sort ?? 0 };
    })
    .sort((a, b) => Number(b.mine) - Number(a.mine) || a._sort - b._sort || cmp(a.edge_id, b.edge_id))
    .map(({ _sort, ...x }) => x);
}

/** Readiness for concept roles against their FS05 profiles (read-only; same output in SQL). Unknown, current and security roles are skipped. */
export function conceptReadiness(d: ConceptData, f: CareerFacts, personId: string, roleIds: string[] | null): ConceptReadiness[] {
  const comp = competencyLevelsOf(d, personId);
  const skill = new Map<string, number>();
  for (const s of d.states) if (s.person_id === personId && s.active !== false) skill.set(s.skill_id, Math.max(skill.get(s.skill_id) ?? 0, s.level));
  const compName = new Map(d.competencies.map((c) => [c.id, { en: c.name_en, ar: c.name_ar }]));
  const skillName = new Map(d.skills.map((s) => [s.id, { en: s.name_en ?? s.id, ar: s.name_ar ?? s.name_en ?? s.id }]));
  const roleTitle = new Map(d.roles.map((r) => [r.id, { en: r.title_en, ar: r.title_ar }]));
  const ids = roleIds == null ? d.roles.filter((r) => isConcept(r)).map((r) => r.id).sort(cmp) : [...new Set(roleIds)];
  const out: ConceptReadiness[] = [];
  for (const roleId of ids.slice(0, MAX_ROLES)) {
    const role = d.roles.find((r) => r.id === roleId);
    if (!role || !isConcept(role) || role.security_sensitive) continue;
    const prof = conceptProfile(d.versions, roleId);
    if (!prof) continue;
    let num = 0, den = 0;
    const gaps: ConceptGap[] = [];
    for (const q of reqsOfVersion(prof)) {
      const have = q.kind === 'skill' ? skill.get(q.ref_id) ?? 0 : comp.get(q.ref_id) ?? 0;
      const w = typeof d.weights?.[q.importance] === 'number' ? (d.weights[q.importance] as number) : IMP_DEFAULT[q.importance] ?? 1;
      num += (Math.min(have, q.level) / q.level) * w;
      den += w;
      if (have < q.level) gaps.push({ kind: q.kind, ref_id: q.ref_id, have, need: q.level, importance: q.importance, why: { en: q.why_en ?? '', ar: q.why_ar || q.why_en || '' } });
    }
    gaps.sort((a, b) => b.need - b.have - (a.need - a.have) || cmp(`${a.kind}:${a.ref_id}`, `${b.kind}:${b.ref_id}`));
    const score = den ? r4(num / den) : 0;
    const pct = Math.floor(score * 100 + 0.5);
    const gapMonths = Math.min(MAX_MONTHS, MONTHS_PER_LEVEL * gaps.reduce((s, g) => s + (g.need - g.have), 0));
    const bridges = conceptBridges(d.edges, roleId, f);
    const bridge = bridges[0] ?? null;
    const months = Math.max(gapMonths, bridge ? bridge.remaining_months : 0);
    const band: ConceptBand = score >= READY_SCORE && months === 0 ? 'profile_met' : months <= WITHIN_MONTHS ? 'within' : 'stretch';
    const reasons: Reason[] = [rsn('readiness', 'common.engines.reason.readiness', { pct })];
    reasons.push(rsn('fs15_profile', 'm18.fs15.reason.profile', { horizon: prof.horizon, version: prof.version }, { table: 'role_profile_versions', id: prof.id }));
    if (!bridge) reasons.push(rsn('fs15_bridge_none', 'm18.fs15.reason.bridge_none'));
    else {
      const from = roleTitle.get(bridge.from_role_id ?? '') ?? { en: bridge.from_role_id ?? '', ar: bridge.from_role_id ?? '' };
      const ref = { table: 'career_paths', id: bridge.edge_id };
      if (!bridge.mine) reasons.push(rsn('fs15_bridge_other', 'm18.fs15.reason.bridge_other', { role: from, months: bridge.need_months }, ref));
      else if (bridge.remaining_months > 0) reasons.push(rsn('fs15_bridge_wait', 'm18.fs15.reason.bridge_wait', { months: bridge.remaining_months }, ref));
      else reasons.push(rsn('fs15_bridge_met', 'm18.fs15.reason.bridge_met', { role: from }, ref));
    }
    for (const g of gaps.slice(0, 3)) {
      const name = (g.kind === 'skill' ? skillName.get(g.ref_id) : compName.get(g.ref_id)) ?? { en: g.ref_id, ar: g.ref_id };
      reasons.push(rsn('fs15_gap', 'm18.fs15.reason.gap', { skill: name, from: g.have, to: g.need }, { table: g.kind === 'skill' ? 'skills' : 'competencies', id: g.ref_id }));
    }
    if (band === 'profile_met') reasons.push(rsn('fs15_band_met', 'm18.fs15.reason.band_met'));
    else reasons.push(rsn(`fs15_band_${band}`, `m18.fs15.reason.band_${band}`, { months }));
    reasons.push(rsn('fs15_concept', 'm18.fs15.reason.concept'));
    out.push({ role_id: roleId, concept: true, profile_id: prof.id, horizon: prof.horizon, version: prof.version, score, pct, band, months, gap_months: gapMonths, bridge, bridges: bridges.length, gaps, reasons });
  }
  return out;
}

// ───────────── Transition evidence (SG-CAREER: adjacency moves backed by real transitions)
export interface MoveRow { id: string; from_role_id: string; to_role_id: string; moved_on: string; months_before: number }
export interface TransitionCell { n: number | null; median_months: number | null; suppressed: boolean }
export interface TransitionEvidence extends TransitionCell {
  from_role_id: string;
  to_role_id: string;
  concept: boolean;
  path_only: boolean;
  analogue: (TransitionCell & { family_id: string }) | null;
  reasons: Reason[];
}

export function medianOf(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function cellOf(months: number[], min = MIN_GROUP): TransitionCell {
  if (months.length < min) return { n: null, median_months: null, suppressed: true };
  return { n: months.length, median_months: medianOf(months), suppressed: false };
}

/** Evidence for moves from one role to each target (read-only; suppressed under MIN_GROUP; same output in SQL). */
export function transitionEvidence(moves: MoveRow[], roles: ConceptRole[], fromRoleId: string, toRoleIds: string[], min = MIN_GROUP): TransitionEvidence[] {
  const byId = new Map(roles.map((r) => [r.id, r]));
  const from = byId.get(fromRoleId);
  const out: TransitionEvidence[] = [];
  for (const to of [...new Set(toRoleIds)].slice(0, MAX_ROLES)) {
    const role = byId.get(to);
    if (!role || !from || to === fromRoleId) continue;
    if (role.security_sensitive || from.security_sensitive) {
      out.push({ from_role_id: fromRoleId, to_role_id: to, concept: isConcept(role), path_only: true, n: null, median_months: null, suppressed: true, analogue: null, reasons: [rsn('path_only', 'common.engines.reason.path_only')] });
      continue;
    }
    const concept = isConcept(role);
    const cell = cellOf(moves.filter((m) => m.from_role_id === fromRoleId && m.to_role_id === to).map((m) => m.months_before), min);
    let analogue: TransitionEvidence['analogue'] = null;
    const reasons: Reason[] = [];
    if (concept) {
      reasons.push(rsn('fs15_tr_concept', 'm18.fs15.reason.tr_concept'));
      if (role.family_id) {
        const fam = new Set(roles.filter((r) => r.family_id === role.family_id && !isConcept(r) && !r.security_sensitive && r.id !== fromRoleId).map((r) => r.id));
        const a = cellOf(moves.filter((m) => m.from_role_id === fromRoleId && fam.has(m.to_role_id)).map((m) => m.months_before), min);
        analogue = { family_id: role.family_id, ...a };
        reasons.push(a.suppressed ? rsn('fs15_tr_analogue_suppressed', 'm18.fs15.reason.tr_analogue_suppressed', { min }) : rsn('fs15_tr_analogue', 'm18.fs15.reason.tr_analogue', { n: a.n!, months: a.median_months! }));
      }
    } else reasons.push(cell.suppressed ? rsn('fs15_tr_suppressed', 'm18.fs15.reason.tr_suppressed', { min }) : rsn('fs15_tr_count', 'm18.fs15.reason.tr_count', { n: cell.n!, months: cell.median_months! }));
    out.push({ from_role_id: fromRoleId, to_role_id: to, concept, path_only: false, ...cell, analogue, reasons });
  }
  return out;
}

/** Months between two ISO dates (re-exported for the seed builder and the pages). */
export { monthsBetween };
