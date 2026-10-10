/**
 * F05 Career Navigator rules (pure, import-free: node seed and validation scripts load this file directly).
 * Mirrored 1:1 by the SQL function kafaa_career_readiness_compute in
 * supabase/migrations/20261009112001_kafaa_w1e2_career.sql; scripts/validate/w1e2-career.mjs proves TS = SQL. Change both together.
 *
 *  - Experience facts come from the person's own records: months in the current role count from the mirrored licence
 *    (licensed roles), else from the first current qualification on one of the role's standards, else from the hire date.
 *  - Readiness is weighted competency coverage: Σ min(level, required)/required × weight (core 3, important 2, useful 1) / Σ weight.
 *  - Gates are the role's entry routes (career_paths edges into the role, with their rule references), each condition marked
 *    met, pending or not met. A gate is never folded into the readiness %; a not-met gate means the role cannot be "ready now".
 *  - Security, safeguards and cyber roles: career path only, no readiness and no gate detail.
 */

export interface BiText {
  en: string;
  ar: string;
}
export interface Reason {
  code: string;
  key: string;
  vars?: Record<string, string | number | BiText>;
  ref?: { table: string; id: string };
  weight?: number;
}
export interface CondIn {
  kind: string;
  value: string | number;
  en: string;
  ar: string;
}
export interface EdgeIn {
  id: string;
  from_role_id: string | null;
  to_role_id: string;
  type: string;
  route_code?: string | null;
  label_en: string;
  label_ar: string;
  conditions: CondIn[] | unknown;
  rule_ref?: string | null;
  sort?: number | null;
}
export interface CareerData {
  people: { id: string; job_role_id?: string | null; hire_date?: string | null }[];
  roles: { id: string; title_en: string; title_ar: string; education: string; security_sensitive?: boolean | null }[];
  edges: EdgeIn[];
  roleComps: { role_id: string; competency_id: string; required_level: number; importance: string }[];
  competencies: { id: string; name_en: string; name_ar: string }[];
  skills: { id: string; competency_id: string; core: boolean }[];
  states: { person_id: string; skill_id: string; level: number; active?: boolean | null }[];
  licences: { person_id: string; type: string; issued_on: string; status: string }[];
  standards: { id: string; role_ids: string[] | null }[];
  qualRecords: { person_id: string; standard_id: string; status: string; qualified_on?: string | null; expires_on?: string | null }[];
  programmes: { id: string; code: string }[];
  courses: { id: string; programme_id?: string | null }[];
  trainingRecords: { person_id: string; course_id: string; result: string }[];
  enrolments: { person_id: string; course_id: string; status: string }[];
  /** Engine weights (surface 'recommend'): core / important / useful. */
  weights?: Record<string, number>;
}

export const READY_NOW = 0.85;
export const READY_IN_MAX_MONTHS = 36;
export const MONTHS_PER_LEVEL = 2;
export const MAX_MONTHS = 120;
export const MAX_ROLES = 40;
export const LICENCE_FOR_ROLE: Record<string, string> = { 'reactor-operator': 'RO', 'senior-reactor-operator': 'SRO' };
export const EDU_RANK: Record<string, number> = { high_school: 1, diploma: 2, bachelor: 3, master: 4 };
const IMP_DEFAULT: Record<string, number> = { core: 3, important: 2, useful: 1 };
/** Prerequisite kinds checked against records; route steps (programme, exam) are "to do"; licensee checks stay pending. */
export const LICENSEE_KINDS = ['clearance', 'medical', 'appointment'];

const r4 = (x: number) => Math.round(x * 10000) / 10000;
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const rsn = (code: string, key: string, vars?: Reason['vars'], ref?: Reason['ref']): Reason => ({ code, key, ...(vars ? { vars } : {}), ...(ref ? { ref } : {}) });
const condsOf = (e: Pick<EdgeIn, 'conditions'>): CondIn[] => (Array.isArray(e.conditions) ? (e.conditions as CondIn[]) : []);

/** Whole months from one ISO date to another (same formula in SQL). */
export function monthsBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.slice(0, 10).split('-').map(Number);
  const [y2, m2, d2] = to.slice(0, 10).split('-').map(Number);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
}

export interface CareerFacts {
  person_id: string;
  role_id: string | null;
  role_since: string | null;
  role_since_basis: 'licence' | 'qualification' | 'hire' | 'none';
  months_in_role: number;
  qualified_in_role: boolean;
  months_at_barakah: number;
  education: string | null;
  programmes: Record<string, 'done' | 'in_progress'>;
}

const CURRENT_QUAL = ['qualified', 'due', 'renewed'];
const ACTIVE_ENROL = ['enrolled', 'in_progress', 'assigned', 'completed'];

export function careerFacts(d: CareerData, personId: string, now: string): CareerFacts {
  const p = d.people.find((x) => x.id === personId);
  const role = p?.job_role_id ?? null;
  const roleRow = d.roles.find((r) => r.id === role);
  let since: string | null = null;
  let basis: CareerFacts['role_since_basis'] = 'none';
  let qualified = false;
  const lic = role ? LICENCE_FOR_ROLE[role] : undefined;
  const stds = role ? d.standards.filter((s) => (s.role_ids ?? []).includes(role)).map((s) => s.id) : [];
  if (lic) {
    const l = d.licences.filter((x) => x.person_id === personId && x.type === lic && x.status === 'valid').map((x) => x.issued_on).sort(cmp)[0];
    if (l) { since = l; basis = 'licence'; qualified = true; }
  } else if (stds.length) {
    const q = d.qualRecords
      .filter((r) => r.person_id === personId && stds.includes(r.standard_id) && CURRENT_QUAL.includes(r.status) && r.qualified_on && (!r.expires_on || r.expires_on >= now))
      .map((r) => r.qualified_on as string).sort(cmp)[0];
    if (q) { since = q; basis = 'qualification'; qualified = true; }
  } else if (role && p?.hire_date) {
    since = p.hire_date; basis = 'hire'; qualified = true;
  }
  const programmes: Record<string, 'done' | 'in_progress'> = {};
  for (const pr of d.programmes) {
    const cs = d.courses.filter((c) => c.programme_id === pr.id).map((c) => c.id);
    if (!cs.length) continue;
    const passed = new Set(d.trainingRecords.filter((t) => t.person_id === personId && cs.includes(t.course_id) && (t.result === 'passed' || t.result === 'completed')).map((t) => t.course_id));
    if (passed.size === cs.length) programmes[pr.code.toUpperCase()] = 'done';
    else if (passed.size > 0 || d.enrolments.some((e) => e.person_id === personId && cs.includes(e.course_id) && ACTIVE_ENROL.includes(e.status))) programmes[pr.code.toUpperCase()] = 'in_progress';
  }
  return {
    person_id: personId,
    role_id: role,
    role_since: since,
    role_since_basis: basis,
    months_in_role: since ? monthsBetween(since, now) : 0,
    qualified_in_role: qualified,
    months_at_barakah: p?.hire_date ? monthsBetween(p.hire_date, now) : 0,
    education: roleRow?.education ?? null,
    programmes,
  };
}

/** Competency level per competency: its core skill's level, else the best of its other skills (F02 competencyLevels). */
export function competencyLevelsOf(d: Pick<CareerData, 'skills' | 'states'>, personId: string): Map<string, number> {
  const byId = new Map(d.skills.map((s) => [s.id, s]));
  const core = new Map<string, number>();
  const any = new Map<string, number>();
  for (const s of d.states) {
    if (s.person_id !== personId || s.active === false) continue;
    const sk = byId.get(s.skill_id);
    if (!sk) continue;
    const m = sk.core ? core : any;
    m.set(sk.competency_id, Math.max(m.get(sk.competency_id) ?? 0, s.level));
  }
  for (const [k, v] of any) if (!core.has(k)) core.set(k, v);
  return core;
}

export interface Gap { competency_id: string; have: number; need: number; importance: string }
/** Same formula as the F02 engine's readiness(): weighted coverage 0..1 and the gaps, largest first. */
export function readinessScore(have: Map<string, number>, roleComps: CareerData['roleComps'], roleId: string, weights?: Record<string, number>) {
  let num = 0, den = 0;
  const gaps: Gap[] = [];
  for (const r of roleComps) {
    if (r.role_id !== roleId) continue;
    const h = have.get(r.competency_id) ?? 0;
    const wt = typeof weights?.[r.importance] === 'number' ? (weights[r.importance] as number) : (IMP_DEFAULT[r.importance] ?? 1);
    num += (Math.min(h, r.required_level) / r.required_level) * wt;
    den += wt;
    if (h < r.required_level) gaps.push({ competency_id: r.competency_id, have: h, need: r.required_level, importance: r.importance });
  }
  return { score: den ? r4(num / den) : 0, gaps: gaps.sort((a, b) => b.need - b.have - (a.need - a.have) || cmp(a.competency_id, b.competency_id)) };
}

export type CondStatus = 'met' | 'pending' | 'not_met';
export interface CondGate { kind: string; value: string | number; en: string; ar: string; status: CondStatus; note: string; remaining_months: number }
export interface RouteGate {
  edge_id: string;
  from_role_id: string | null;
  type: string;
  route_code: string | null;
  rule_ref: string | null;
  label: BiText;
  mine: boolean;
  status: CondStatus;
  remaining_months: number;
  conditions: CondGate[];
}
const STATUS_RANK: Record<CondStatus, number> = { met: 0, pending: 1, not_met: 2 };

/** Evaluate one condition of a route into the role. */
export function evaluateCondition(c: CondIn, mine: boolean, f: CareerFacts): CondGate {
  const base = { kind: c.kind, value: c.value, en: c.en, ar: c.ar, remaining_months: 0 };
  if (c.kind === 'months') {
    const need = Number(c.value) || 0;
    if (mine && f.qualified_in_role && f.months_in_role >= need) return { ...base, status: 'met', note: 'months_met' };
    const have = mine && f.qualified_in_role ? f.months_in_role : 0;
    return { ...base, status: 'not_met', note: mine ? (f.qualified_in_role ? 'months_short' : 'not_qualified_yet') : 'other_role', remaining_months: need - have };
  }
  if (c.kind === 'degree') {
    const ok = (EDU_RANK[f.education ?? ''] ?? 0) >= (EDU_RANK[String(c.value)] ?? 99);
    return { ...base, status: ok ? 'met' : 'pending', note: ok ? 'degree_role' : 'degree_unknown' };
  }
  if (c.kind === 'programme') {
    const codes = String(c.value).toUpperCase().split('/');
    if (codes.some((k) => f.programmes[k] === 'done')) return { ...base, status: 'met', note: 'programme_done' };
    return { ...base, status: 'pending', note: codes.some((k) => f.programmes[k] === 'in_progress') ? 'programme_in_progress' : 'programme_to_do' };
  }
  if (c.kind === 'exam') return { ...base, status: 'pending', note: 'exam_to_do' };
  if (LICENSEE_KINDS.includes(c.kind)) return { ...base, status: 'pending', note: 'licensee' };
  return { ...base, status: 'pending', note: 'other' };
}

/** Every route into the target (entry routes included), evaluated against the person's facts; the person's own route first. */
export function evaluateRoutes(d: Pick<CareerData, 'edges'>, f: CareerFacts, targetId: string): RouteGate[] {
  const into = d.edges.filter((e) => e.to_role_id === targetId).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || cmp(a.id, b.id));
  const out = into.map((e) => {
    const mine = !!f.role_id && e.from_role_id === f.role_id;
    const conditions = condsOf(e).map((c) => evaluateCondition(c, mine, f));
    const status: CondStatus = conditions.some((c) => c.status === 'not_met') ? 'not_met' : conditions.every((c) => c.status === 'met') ? 'met' : 'pending';
    return {
      edge_id: e.id, from_role_id: e.from_role_id, type: e.type, route_code: e.route_code ?? null, rule_ref: e.rule_ref ?? null,
      label: { en: e.label_en, ar: e.label_ar }, mine, status, remaining_months: Math.max(0, ...conditions.map((c) => c.remaining_months)), conditions,
    };
  });
  return out.sort((a, b) => Number(b.mine) - Number(a.mine) || STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.remaining_months - b.remaining_months);
}

export type Band = 'ready_now' | 'ready_in' | 'stretch' | 'path_only' | 'current';
export interface CareerReadiness {
  role_id: string;
  path_only: boolean;
  score: number | null;
  pct: number | null;
  band: Band;
  months: number | null;
  gate_status: CondStatus | 'none';
  primary_route: string | null;
  routes: RouteGate[];
  gaps: Gap[];
  reasons: Reason[];
}

/** careerReadiness: per-role readiness %, separate gates, readiness band and reasons. Read-only; same output in SQL. */
export function careerReadiness(d: CareerData, personId: string, roleIds: string[], now: string): CareerReadiness[] {
  const f = careerFacts(d, personId, now);
  const have = competencyLevelsOf(d, personId);
  const compName = new Map(d.competencies.map((c) => [c.id, { en: c.name_en, ar: c.name_ar }]));
  const out: CareerReadiness[] = [];
  for (const roleId of [...new Set(roleIds)].slice(0, MAX_ROLES)) {
    const role = d.roles.find((r) => r.id === roleId);
    if (!role) continue;
    if (role.security_sensitive) {
      out.push({ role_id: roleId, path_only: true, score: null, pct: null, band: 'path_only', months: null, gate_status: 'none', primary_route: null, routes: [], gaps: [], reasons: [rsn('path_only', 'common.engines.reason.path_only')] });
      continue;
    }
    const { score, gaps } = readinessScore(have, d.roleComps, roleId, d.weights);
    const pct = Math.round(score * 100);
    const routes = evaluateRoutes(d, f, roleId);
    const primary = routes[0] ?? null;
    const gate = primary ? primary.status : 'none';
    const gateMonths = primary && primary.status === 'not_met' ? primary.remaining_months : 0;
    const gapMonths = Math.min(MAX_MONTHS, MONTHS_PER_LEVEL * gaps.reduce((s, g) => s + (g.need - g.have), 0));
    const months = Math.max(gateMonths, gapMonths);
    let band: Band;
    if (roleId === f.role_id) band = 'current';
    else if (score >= READY_NOW && gate !== 'not_met') band = 'ready_now';
    else if (months <= READY_IN_MAX_MONTHS) band = 'ready_in';
    else band = 'stretch';
    const reasons: Reason[] = [rsn('readiness', 'common.engines.reason.readiness', { pct })];
    if (primary) {
      const route = { en: primary.label.en, ar: primary.label.ar };
      if (gate === 'met') reasons.push(rsn('gates_met', 'm18.reasons.gates_met', { route }, { table: 'career_paths', id: primary.edge_id }));
      else if (gate === 'pending') reasons.push(rsn('gates_pending', 'm18.reasons.gates_pending', { route, n: primary.conditions.filter((c) => c.status === 'pending').length }, { table: 'career_paths', id: primary.edge_id }));
      else reasons.push(rsn('gates_not_met', 'm18.reasons.gates_not_met', { route, months: gateMonths }, { table: 'career_paths', id: primary.edge_id }));
    } else reasons.push(rsn('gates_none', 'm18.reasons.gates_none'));
    for (const g of gaps.slice(0, 3)) reasons.push(rsn('gap', 'm18.reasons.gap', { skill: compName.get(g.competency_id) ?? { en: g.competency_id, ar: g.competency_id }, from: g.have, to: g.need }, { table: 'competencies', id: g.competency_id }));
    if (band === 'ready_now') reasons.push(rsn('band_ready_now', 'm18.reasons.band_ready_now'));
    else if (band === 'ready_in') reasons.push(rsn('band_ready_in', 'm18.reasons.band_ready_in', { months }));
    else if (band === 'stretch') reasons.push(rsn('band_stretch', 'm18.reasons.band_stretch', { months }));
    out.push({ role_id: roleId, path_only: false, score, pct, band, months: band === 'current' ? 0 : months, gate_status: gate, primary_route: primary?.edge_id ?? null, routes, gaps, reasons });
  }
  return out;
}

/** Roles within maxSteps over progression edges (entry edges excluded), with the step count: BFS as careerGraph.reachable. */
export function reachableRoles(edges: EdgeIn[], from: string, maxSteps = 2): Map<string, number> {
  const dist = new Map<string, number>([[from, 0]]);
  const q = [from];
  while (q.length) {
    const at = q.shift()!;
    // FS wave-A integration: FS05 "future" edges (current role -> concept role) are not progression routes; concept roles come
    // into readiness deliberately with FS13. Same rule in SQL (kafaa_fairness_compute, kafaa_dg_gather).
    for (const e of edges) if (e.from_role_id === at && !dist.has(e.to_role_id) && ((e as { kind?: string | null }).kind ?? 'current') !== 'future') { dist.set(e.to_role_id, dist.get(at)! + 1); q.push(e.to_role_id); }
  }
  dist.delete(from);
  return new Map([...dist].filter(([, n]) => n <= maxSteps));
}
