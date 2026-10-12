/**
 * FS57 Curriculum coverage scorer and gap-filling backlog: pure rules shared by both backends, the seed builder, the pages and the
 * PGlite validator. Import-free apart from types and other import-free rule files (node loads it directly). SQL mirror: kafaa_cov_*
 * in supabase/migrations/20261010264001_kafaa_fs64_skill_change_coverage.sql; scripts/validate/fs64-skill-change-coverage.mjs proves
 * SQL = TS on the seed and on generated what-ifs.
 *
 * "Taught by" (one definition, shared with FS56 and exported for FS54's orphan-rate audit and FS66's university alignment):
 *   course    a staff or public catalogue course teaches (F01 mapping) the core skill of each competency it covers at its evidence cap
 *             (qualifying 2, otherwise 1), every skill that lists the course in evidence_keys at min(key_level, cap), and every active
 *             FS19 course-skill link at the link's level. Supplier-academy courses are for contractors and do not count for ENEC roles.
 *   pathway   a published, listed FS17 pathway teaches its skill at its level once its learn step has content (an open FS17 "learn" gap
 *             means nothing teaches it yet).
 *   external  a published, listed FS18 external resource teaches each of its skills at the stated level.
 *   Security-area skills (and skills of security competencies) are never scored: those roles are path-only.
 *
 * Coverage (Lightcast Skillabi pattern, 0-100 per role and horizon): requirements come from the published FS05 role profile of the
 * horizon (now, 2030); a competency requirement means its core skill. The catalogue teaches up to level 2 (LEARN_CEILING): levels 3
 * and 4 are built on the job, so a requirement's teachable target is min(need, 2). Credit = min(taught, target) / target; weight core 2,
 * otherwise 1. Score = round(100 x sum(weight x credit) / sum(weight)) with integer arithmetic (credit kept in halves). A requirement
 * whose taught level is below its target is uncovered. Path-only (security, safeguards, cyber) profiles are listed, never scored.
 *
 * Backlog: one row per (skill, level) the catalogue should reach: every uncovered requirement (skill, target) and every open FS17
 * pathway gap (skill, level), so the FS17 gap backlog is the feed and this table only carries the decision (owner, date,
 * build/partner/buy, plan). Rows are never removed: a row whose need has gone reads "covered". The default owner is the skill's
 * owner function (FS02 owner_role), so every uncovered skill always has an owner.
 *
 * What-if: a planned item teaching a skill at a level raises each affected requirement's taught level to max(taught, level); the
 * predicted score per role is the same rule on the changed world (whatIf), computed in memory and stored only by decideGap.
 */
import type { Reason } from '../../domain/engines/types';
import { OWNER_ROLES } from '../../domain/taxonomy.ts';

export const LEARN_CEILING = 2;
export const HORIZONS = ['now', '2030'] as const;
export type Horizon = (typeof HORIZONS)[number];
export const ROUTES_GB = ['build', 'partner', 'buy'] as const;
export type GapRoute = (typeof ROUTES_GB)[number];
/** Latest acceptable due date for a backlog decision (the 2030 horizon). */
export const DUE_MAX = '2030-12-31';
export const DEFAULT_OWNER = 'nuclear_training';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** a / b rounded half away from zero (SQL round(numeric)); b > 0. */
export function rdivC(a: number, b: number): number {
  const q = Math.round(Math.abs(a) / b);
  return a < 0 ? -q : q;
}
const byId = (a: Row, b: Row) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ───────────── taught by
export interface TaughtWorld {
  skills: Row[]; // id, competency_id, core, key_level, evidence_keys, area, name_en, name_ar, owner_role
  competencies: Row[]; // id, domain
  courses: Row[]; // id, code, title_en, title_ar, competency_ids, qualifying, audience
  course_skill_links: Row[]; // course_id, skill_id, level, active
  pathways: Row[]; // id, skill_id, level, status, listed, title_en, title_ar
  pathway_gaps: Row[]; // id, pathway_id, skill_id, level, kind, status
  external_resources: Row[]; // id, status, listed, skills [{skill_id, level}], title_en, title_ar
}
export interface TeachItem { kind: 'course' | 'pathway' | 'external' | 'planned'; id: string; level: number; title_en: string; title_ar: string }

/** Security-area skills and skills of security competencies: never scored, never taught here. */
export function restrictedSkills(skills: Row[], competencies: Row[]): Set<string> {
  const sec = new Set(competencies.filter((c) => c.domain === 'security').map((c) => String(c.id)));
  return new Set(skills.filter((s) => s.area === 'security' || sec.has(String(s.competency_id))).map((s) => String(s.id)));
}

/** Skills one course teaches (skill -> level): F01 mapping (core skill per competency at the cap; evidence_keys at min(key_level, cap))
 *  plus active FS19 links at their level; the higher level wins; restricted skills left out. */
export function courseSkills(course: Row, skills: Row[], links: Row[], restricted: Set<string>): Map<string, number> {
  const cap = course.qualifying === true ? 2 : 1;
  const comps = new Set<string>((course.competency_ids ?? []).map(String));
  const out = new Map<string, number>();
  const put = (s: string, l: number) => { if (l > 0 && !restricted.has(s)) out.set(s, Math.max(out.get(s) ?? 0, l)); };
  for (const s of skills) {
    if (s.core === true && comps.has(String(s.competency_id))) put(String(s.id), cap);
    if ((s.evidence_keys ?? []).includes(course.id)) put(String(s.id), Math.min(Number(s.key_level), cap));
  }
  for (const l of links) if (l.active !== false && l.course_id === course.id) put(String(l.skill_id), Number(l.level));
  return out;
}

/** The courses that count for ENEC roles: every catalogue course except supplier-academy courses. */
export const countsForRoles = (c: Row) => c.audience !== 'supplier';

/** skill -> teaching items (sorted: kind, id), from courses, pathways and externals. */
export function taughtBy(w: TaughtWorld): Map<string, TeachItem[]> {
  const restricted = restrictedSkills(w.skills, w.competencies);
  const out = new Map<string, TeachItem[]>();
  const add = (s: string, it: TeachItem) => { if (!restricted.has(s)) (out.get(s) ?? out.set(s, []).get(s)!).push(it); };
  for (const c of [...w.courses].sort(byId)) {
    if (!countsForRoles(c)) continue;
    for (const [s, l] of courseSkills(c, w.skills, w.course_skill_links, restricted)) add(s, { kind: 'course', id: c.id, level: l, title_en: String(c.title_en ?? ''), title_ar: String(c.title_ar ?? '') });
  }
  const openLearn = new Set(w.pathway_gaps.filter((g) => g.status === 'open' && g.kind === 'learn').map((g) => String(g.pathway_id)));
  for (const p of [...w.pathways].sort(byId)) {
    if (p.status !== 'published' || p.listed !== true || openLearn.has(p.id)) continue;
    add(String(p.skill_id), { kind: 'pathway', id: p.id, level: Number(p.level), title_en: String(p.title_en ?? ''), title_ar: String(p.title_ar ?? '') });
  }
  for (const x of [...w.external_resources].sort(byId)) {
    if (x.status !== 'published' || x.listed !== true) continue;
    const per = new Map<string, number>();
    for (const s of (Array.isArray(x.skills) ? x.skills : []) as Row[]) if (s && typeof s.skill_id === 'string') per.set(s.skill_id, Math.max(per.get(s.skill_id) ?? 0, typeof s.level === 'number' ? Math.floor(s.level) : 0));
    for (const [s, l] of [...per].sort((a, b) => cmp(a[0], b[0]))) if (l > 0) add(s, { kind: 'external', id: x.id, level: l, title_en: String(x.title_en ?? ''), title_ar: String(x.title_ar ?? '') });
  }
  const order = { course: 0, pathway: 1, external: 2, planned: 3 } as const;
  for (const list of out.values()) list.sort((a, b) => order[a.kind] - order[b.kind] || cmp(a.id, b.id));
  return out;
}
export const taughtLevel = (items: TeachItem[] | undefined) => (items ?? []).reduce((m, i) => Math.max(m, i.level), 0);

// ───────────── coverage
export interface Requirement { skill_id: string; need: number; target: number; weight: number; taught: number; credit: number }
export interface RoleCoverage {
  role_id: string; horizon: Horizon; version_id: string; path_only: boolean;
  score: number | null; n: number; covered: number;
  reqs: Requirement[]; uncovered: string[];
}
export interface CoverageWorld extends TaughtWorld {
  job_roles: Row[]; // id, sort, lifecycle
  role_profile_versions: Row[]; // id, role_id, horizon, status, path_only, requirements
}
export interface CoverageResult { ceiling: number; roles: RoleCoverage[]; taught: Map<string, TeachItem[]> }

/** Requirements of one profile version as skills (competency -> its core skill), deduplicated (highest need and weight), restricted
 *  and unknown skills left out, sorted by skill id. */
export function requirementsOf(version: Row, skills: Row[], restricted: Set<string>): { skill_id: string; need: number; weight: number }[] {
  const known = new Set(skills.map((s) => String(s.id)));
  const core = new Map<string, string>();
  for (const s of [...skills].sort(byId)) if (s.core === true && !core.has(String(s.competency_id))) core.set(String(s.competency_id), String(s.id));
  const m = new Map<string, { need: number; weight: number }>();
  for (const r of (Array.isArray(version.requirements) ? version.requirements : []) as Row[]) {
    const sid = r.kind === 'competency' ? core.get(String(r.ref_id)) : r.kind === 'skill' ? String(r.ref_id) : undefined;
    const need = typeof r.level === 'number' ? r.level : NaN;
    if (!sid || !known.has(sid) || restricted.has(sid) || !Number.isInteger(need) || need < 1) continue;
    const w = r.importance === 'core' ? 2 : 1;
    const cur = m.get(sid);
    m.set(sid, { need: Math.max(cur?.need ?? 0, need), weight: Math.max(cur?.weight ?? 0, w) });
  }
  return [...m].sort((a, b) => cmp(a[0], b[0])).map(([skill_id, v]) => ({ skill_id, ...v }));
}

/** Score one requirement list against taught levels (skill -> level). Credit in halves (0..2). */
export function scoreReqs(reqs: { skill_id: string; need: number; weight: number }[], taught: (skill: string) => number): { reqs: Requirement[]; score: number | null; covered: number } {
  let num = 0, den = 0, covered = 0;
  const out: Requirement[] = reqs.map((r) => {
    const target = Math.min(r.need, LEARN_CEILING);
    const t = taught(r.skill_id);
    const credit = Math.min(t, target) * (2 / target); // target 1 -> 0|2, target 2 -> 0|1|2
    num += r.weight * credit;
    den += r.weight * 2;
    if (t >= target) covered++;
    return { skill_id: r.skill_id, need: r.need, target, weight: r.weight, taught: t, credit };
  });
  return { reqs: out, score: den > 0 ? rdivC(100 * num, den) : null, covered };
}

/** Coverage of every published role profile for the two horizons (roles in job-role sort order, then id; now before 2030). */
export function coverage(w: CoverageWorld, extra: TeachItem[] = [], extraSkill: string | null = null): CoverageResult {
  const restricted = restrictedSkills(w.skills, w.competencies);
  const taught = taughtBy(w);
  if (extraSkill && extra.length && !restricted.has(extraSkill)) taught.set(extraSkill, [...(taught.get(extraSkill) ?? []), ...extra]);
  const roleSort = new Map(w.job_roles.map((r) => [String(r.id), Number(r.sort ?? 0)]));
  const roles: RoleCoverage[] = [];
  for (const h of HORIZONS) {
    const vs = w.role_profile_versions
      .filter((v) => v.horizon === h && v.status === 'published' && roleSort.has(String(v.role_id)))
      .sort((a, b) => (roleSort.get(a.role_id)! - roleSort.get(b.role_id)!) || cmp(a.role_id, b.role_id) || cmp(a.id, b.id));
    const seen = new Set<string>();
    for (const v of vs) {
      if (seen.has(v.role_id)) continue;
      seen.add(v.role_id);
      if (v.path_only === true) { roles.push({ role_id: v.role_id, horizon: h, version_id: v.id, path_only: true, score: null, n: 0, covered: 0, reqs: [], uncovered: [] }); continue; }
      const s = scoreReqs(requirementsOf(v, w.skills, restricted), (k) => taughtLevel(taught.get(k)));
      roles.push({ role_id: v.role_id, horizon: h, version_id: v.id, path_only: false, score: s.score, n: s.reqs.length, covered: s.covered, reqs: s.reqs, uncovered: s.reqs.filter((r) => r.taught < r.target).map((r) => r.skill_id) });
    }
  }
  return { ceiling: LEARN_CEILING, roles, taught };
}

/** Mean score of the scored roles of one horizon (null when none). */
export function meanScore(roles: RoleCoverage[], h: Horizon): number | null {
  const xs = roles.filter((r) => r.horizon === h && r.score !== null).map((r) => r.score as number);
  return xs.length ? rdivC(xs.reduce((a, b) => a + b, 0), xs.length) : null;
}

// ───────────── what-if
export interface WhatIfMove { role_id: string; horizon: Horizon; before: number; after: number; delta: number }
/** Score moves if one planned item taught `skill` at `level` (in memory; roles whose score does not change are left out). */
export function whatIf(roles: RoleCoverage[], skill: string, level: number): WhatIfMove[] {
  const out: WhatIfMove[] = [];
  for (const r of roles) {
    if (r.path_only || r.score === null || !r.reqs.some((q) => q.skill_id === skill)) continue;
    const s = scoreReqs(r.reqs, (k) => (k === skill ? Math.max(r.reqs.find((q) => q.skill_id === k)!.taught, level) : r.reqs.find((q) => q.skill_id === k)!.taught));
    if (s.score !== r.score) out.push({ role_id: r.role_id, horizon: r.horizon, before: r.score, after: s.score!, delta: s.score! - r.score });
  }
  return out;
}

// ───────────── backlog
export const backlogId = (skill: string, level: number) => `gb:${skill}:${level}`;
export interface BacklogNeed { id: string; skill_id: string; level: number; roles: string[]; gap_ids: string[] }
/** Every (skill, level) the catalogue should reach now: uncovered requirements (at their teachable target) and open FS17 gaps. */
export function backlogNeeds(roles: RoleCoverage[], gaps: Row[], restricted: Set<string> = new Set()): BacklogNeed[] {
  const m = new Map<string, BacklogNeed>();
  const get = (s: string, l: number) => { const id = backlogId(s, l); return m.get(id) ?? m.set(id, { id, skill_id: s, level: l, roles: [], gap_ids: [] }).get(id)!; };
  for (const r of roles) for (const q of r.reqs) if (q.taught < q.target) get(q.skill_id, q.target).roles.push(`${r.role_id}@${r.horizon}`);
  for (const g of gaps) if (g.status === 'open' && !restricted.has(String(g.skill_id))) get(String(g.skill_id), Number(g.level)).gap_ids.push(String(g.id));
  for (const n of m.values()) { n.roles.sort(); n.gap_ids.sort(); }
  return [...m.values()].sort(byId);
}

/** The default owner of a new backlog row: the skill's owner function (FS02), else Nuclear Training. */
export function defaultOwner(skill: Row | undefined): string {
  const o = skill?.owner_role;
  return typeof o === 'string' && (OWNER_ROLES as readonly string[]).includes(o) ? o : DEFAULT_OWNER;
}

export type BacklogState = 'open' | 'planned' | 'covered';
/** Live state of a stored backlog row: covered when nothing needs it now, else planned once decided, else open. */
export function backlogState(row: { id: string; status: string }, needs: Map<string, BacklogNeed>): BacklogState {
  if (!needs.has(row.id)) return 'covered';
  return row.status === 'decided' ? 'planned' : 'open';
}

export interface DecisionInput { id?: unknown; owner_role?: unknown; owner_person_id?: unknown; due_on?: unknown; route?: unknown; rationale?: unknown; plan?: unknown }
export interface PlanInput { title: string; level: number; hours: number }
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const txt = (s: unknown) => (typeof s === 'string' ? s.trim() : '');
/** First problem of a backlog decision (null = valid). `people` answers whether an id is an active staff member. */
export function decisionProblem(d: DecisionInput, row: Row | undefined, today: string, isStaff: (id: string) => boolean):
  'not_found' | 'route' | 'owner' | 'person' | 'due' | 'rationale' | 'plan' | null {
  if (!row) return 'not_found';
  if (typeof d.route !== 'string' || !(ROUTES_GB as readonly string[]).includes(d.route)) return 'route';
  if (typeof d.owner_role !== 'string' || !(OWNER_ROLES as readonly string[]).includes(d.owner_role)) return 'owner';
  if (d.owner_person_id != null && d.owner_person_id !== '' && (typeof d.owner_person_id !== 'string' || !isStaff(d.owner_person_id))) return 'person';
  if (!isDate(d.due_on) || d.due_on < today || d.due_on > DUE_MAX) return 'due';
  const r = txt(d.rationale);
  if (r.length < 10 || r.length > 500) return 'rationale';
  if (d.plan != null) {
    const p = d.plan as Row;
    if (typeof p !== 'object' || Array.isArray(p)) return 'plan';
    const t = txt(p.title);
    if (t.length < 3 || t.length > 120) return 'plan';
    if (!Number.isInteger(p.level) || p.level < 1 || p.level > 3) return 'plan';
    if (!Number.isInteger(p.hours) || p.hours < 1 || p.hours > 200) return 'plan';
  }
  return null;
}
export function cleanPlan(plan: unknown): PlanInput | null {
  if (plan == null || typeof plan !== 'object') return null;
  const p = plan as Row;
  return { title: txt(p.title), level: Number(p.level), hours: Number(p.hours) };
}

/** Reasons for a backlog row (WhyThis). */
export function backlogReasons(n: BacklogNeed | undefined, taught: number): Reason[] {
  const R = (code: string, vars?: Reason['vars']): Reason => ({ code, key: `m25.reasons.${code}`, ...(vars ? { vars } : {}) });
  if (!n) return [R('gb_covered')];
  const out: Reason[] = [];
  if (n.roles.length) out.push(R('gb_roles', { n: n.roles.length, level: n.level, taught }));
  if (n.gap_ids.length) out.push(R('gb_gaps', { n: n.gap_ids.length }));
  return out;
}

// ───────────── report (the shape both backends return)
export interface CoverageSkill { id: string; name_en: string; name_ar: string; owner_role: string; area: string; fs_area: string | null }
export interface BacklogView {
  id: string; skill_id: string; level: number; owner_role: string; owner_person_id: string | null; owner_name: string; owner_name_ar: string;
  due_on: string | null; route: GapRoute | null; rationale: string; rationale_ar: string | null;
  plan: PlanInput | null; predicted: WhatIfMove[]; status: 'open' | 'decided'; first_seen: string;
  decided_by: string | null; decided_by_name: string; decided_at: string | null; history: Row[];
  state: BacklogState; roles: string[]; gap_ids: string[]; taught: number; reasons: Reason[];
}
export interface CoverageReport {
  as_of: string; ceiling: number; horizons: Horizon[]; roles: RoleCoverage[]; teach: { skill_id: string; items: TeachItem[] }[]; skills: CoverageSkill[];
  backlog: BacklogView[]; can_edit: boolean; owners: string[]; staff: { id: string; name: string; name_ar: string }[];
}
export interface ReportWorld extends CoverageWorld { people: Row[]; gap_backlog: Row[] }
const d10c = (v: unknown) => (v == null ? null : String(v).slice(0, 10));
const tsC = (v: unknown) => (v == null ? null : String(v).replace(/\.\d{3}Z$/, 'Z'));
export const isActiveStaff = (p: Row | undefined) => !!p && p.kind === 'staff' && p.status === 'active';

/** The full coverage report: roles, teaching items, referenced skills and the backlog with its live state. */
export function coverageReport(w: ReportWorld, today: string, canEdit: boolean): CoverageReport {
  const restricted = restrictedSkills(w.skills, w.competencies);
  const cov = coverage(w);
  const needs = new Map(backlogNeeds(cov.roles, w.pathway_gaps, restricted).map((n) => [n.id, n]));
  const people = new Map(w.people.map((p) => [String(p.id), p]));
  const name = (id: unknown) => { const p = id ? people.get(String(id)) : undefined; return { en: p ? String(p.display_name ?? '') : '', ar: p ? String(p.display_name_ar || p.display_name || '') : '' }; };
  const backlog: BacklogView[] = [...w.gap_backlog].sort(byId).map((r) => {
    const n = needs.get(r.id);
    const taught = taughtLevel(cov.taught.get(String(r.skill_id)));
    const o = name(r.owner_person_id), by = name(r.decided_by);
    return {
      id: r.id, skill_id: r.skill_id, level: Number(r.level), owner_role: r.owner_role, owner_person_id: r.owner_person_id ?? null, owner_name: o.en, owner_name_ar: o.ar,
      due_on: d10c(r.due_on), route: r.route ?? null, rationale: String(r.rationale ?? ''), rationale_ar: r.rationale_ar ?? null, plan: (r.plan ?? null) as PlanInput | null,
      predicted: (r.predicted ?? []) as WhatIfMove[], status: r.status, first_seen: d10c(r.first_seen) ?? '', decided_by: r.decided_by ?? null, decided_by_name: by.en,
      decided_at: tsC(r.decided_at), history: (r.history ?? []) as Row[],
      state: backlogState(r as { id: string; status: string }, needs), roles: n ? n.roles : [], gap_ids: n ? n.gap_ids : [], taught, reasons: backlogReasons(n, taught),
    };
  });
  const ref = new Set<string>([...cov.roles.flatMap((r) => r.reqs.map((q) => q.skill_id)), ...backlog.map((b) => b.skill_id)]);
  const skills: CoverageSkill[] = [...w.skills].filter((s) => ref.has(String(s.id))).sort(byId).map((s) => ({
    id: s.id, name_en: String(s.name_en ?? s.id), name_ar: String(s.name_ar || s.name_en || s.id), owner_role: defaultOwner(s), area: String(s.area ?? ''), fs_area: s.fs_area ?? null,
  }));
  const teach = [...cov.taught].sort((a, b) => cmp(a[0], b[0])).map(([skill_id, items]) => ({ skill_id, items }));
  const staff = canEdit ? w.people.filter(isActiveStaff).sort(byId).map((p) => ({ id: String(p.id), name: String(p.display_name ?? ''), name_ar: String(p.display_name_ar || p.display_name || '') })) : [];
  return { as_of: today, ceiling: LEARN_CEILING, horizons: [...HORIZONS], roles: cov.roles, teach, skills, backlog, can_edit: canEdit, owners: [...OWNER_ROLES], staff };
}

/** Rows a sync adds: every current need without a stored row (default owner; status open), sorted by id. */
export function backlogToCreate(w: CoverageWorld, existing: Set<string>): { id: string; skill_id: string; level: number; owner_role: string }[] {
  const restricted = restrictedSkills(w.skills, w.competencies);
  const sk = new Map(w.skills.map((s) => [String(s.id), s]));
  return backlogNeeds(coverage(w).roles, w.pathway_gaps, restricted).filter((n) => !existing.has(n.id)).map((n) => ({ id: n.id, skill_id: n.skill_id, level: n.level, owner_role: defaultOwner(sk.get(n.skill_id)) }));
}
