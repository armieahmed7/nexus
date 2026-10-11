// FS39 Plant literacy for everyone and a reference-plant log: the pure rules for the visit log, shared by the pages, the LocalBackend RPCs,
// the seed builder and (mirrored in SQL) supabase/migrations/20261010251001_kafaa_fs51_next_gen.sql (kafaa_pv_problem, kafaa_pv_level,
// kafaa_pv_hosts). Import-free apart from types. The browser explainer itself is static data in ./plantModel.ts (no network after load).
//
// Benchmarks: SMR-WF (NuScale E2 Centers: a simulated control room as outreach for non-operators), NEA (Plan 2035 INSPIRE pathway).
//
//  - A person logs a reference-plant visit, a simulator observation or a partner reference-plant visit, with a named host, a date in the
//    last 365 days (never in the future) and 0.5 to 12 hours in half-hour steps. The host is an active ENEC staff member who holds an
//    instructor, training manager or line manager role, and never the visitor (maker-checker).
//  - Only the host confirms (or declines with a reason). A confirmed visit writes F01 evidence: kind `ojt`, basis `validated`, ref_table
//    `plant_visits`, skill VISIT_SKILL (FS02 technological literacy). Level 1; level 2 once confirmed visits reach L2_HOURS hours over at
//    least two kinds (this one included). Logged, declined and withdrawn visits write no evidence at all.

export const VISIT_KINDS = ['reference_plant', 'simulator_observation', 'partner_facility'] as const;
export type VisitKind = (typeof VISIT_KINDS)[number];
export const VISIT_STATUSES = ['logged', 'confirmed', 'declined', 'withdrawn'] as const;
/** FS02 transversal skill evidenced by confirmed visits (technological literacy: how the plant's technology works). */
export const VISIT_SKILL = 'sk-fs-tr-techlit';
export const HOST_ROLES = ['instructor', 'training_manager', 'manager'];
export const MIN_HOURS = 0.5;
export const MAX_HOURS = 12;
export const LOOKBACK_DAYS = 365;
export const L2_HOURS = 12;
export const VISIT_EVIDENCE_CAP = 2;

/** Email and phone patterns (identical to M20 CONTACT_PATTERN and SQL kafaa_res_contact); notes never carry contact data. */
export const CONTACT_PATTERN = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}|(\\+|00)[0-9][0-9 -]{7,}[0-9]|(^|[^0-9])0[2-9][0-9]?[ -]?[0-9]{3}[ -]?[0-9]{4}([^0-9]|$)';
const CONTACT_RE = new RegExp(CONTACT_PATTERN);

export interface VisitInput { kind: string; host_person_id: string; visit_on: string; hours: number; note?: string | null }
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const dayNo = (iso: string) => Math.floor(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000);

/** First problem code of a visit to log, or null (mirror of SQL kafaa_pv_problem): kind, host, date, hours, note. */
export function visitProblem(v: VisitInput, today: string): string | null {
  if (!v || !(VISIT_KINDS as readonly string[]).includes(v.kind)) return 'kind';
  if (typeof v.host_person_id !== 'string' || !v.host_person_id.trim()) return 'host';
  if (typeof v.visit_on !== 'string' || !ISO.test(v.visit_on) || Number.isNaN(dayNo(v.visit_on)) || new Date(`${v.visit_on}T00:00:00Z`).toISOString().slice(0, 10) !== v.visit_on) return 'date';
  const age = dayNo(today) - dayNo(v.visit_on);
  if (age < 0 || age > LOOKBACK_DAYS) return 'date';
  const h = v.hours;
  if (typeof h !== 'number' || !Number.isFinite(h) || h < MIN_HOURS || h > MAX_HOURS || Math.round(h * 2) !== h * 2) return 'hours';
  const note = v.note ?? '';
  if (typeof note !== 'string' || note.trim().length > 300 || CONTACT_RE.test(note)) return 'note';
  return null;
}

export interface ConfirmedLite { id: string; kind: string; hours: number }
/** Evidence level of a visit confirmed now, given the person's visits already confirmed (mirror of SQL kafaa_pv_level). */
export function visitLevel(confirmedBefore: ConfirmedLite[], current: { kind: string; hours: number }): number {
  const all = [...confirmedBefore, { id: '', ...current }];
  const hours = all.reduce((m, v) => m + Number(v.hours), 0);
  const kinds = new Set(all.map((v) => v.kind)).size;
  return hours >= L2_HOURS && kinds >= 2 ? 2 : 1;
}

export interface HostPerson { id: string; kind: string; status: string }
export interface RoleAssignmentLite { person_id: string; role: string; status: string }
/** Eligible hosts for a visitor (mirror of SQL kafaa_pv_hosts): active staff with an active instructor, training manager or manager role, never the visitor. */
export function eligibleHosts(people: HostPerson[], assignments: RoleAssignmentLite[], visitor: string | null): string[] {
  const roles = new Set(assignments.filter((r) => r.status === 'active' && HOST_ROLES.includes(r.role)).map((r) => r.person_id));
  return people.filter((p) => p.kind === 'staff' && p.status === 'active' && roles.has(p.id) && p.id !== visitor).map((p) => p.id).sort();
}

export interface VisitLite { person_id: string; kind: string; hours: number; status: string; visit_on: string }
/** Summary for my log: confirmed hours by kind and whether level 2 is reached. */
export function logSummary(visits: VisitLite[]) {
  const conf = visits.filter((v) => v.status === 'confirmed');
  const byKind = Object.fromEntries(VISIT_KINDS.map((k) => [k, conf.filter((v) => v.kind === k).reduce((m, v) => m + Number(v.hours), 0)])) as Record<VisitKind, number>;
  const hours = conf.reduce((m, v) => m + Number(v.hours), 0);
  const kinds = new Set(conf.map((v) => v.kind)).size;
  return { confirmed: conf.length, pending: visits.filter((v) => v.status === 'logged').length, hours, byKind, kinds, level: conf.length === 0 ? 0 : hours >= L2_HOURS && kinds >= 2 ? 2 : 1, toL2: Math.max(0, L2_HOURS - hours) };
}
