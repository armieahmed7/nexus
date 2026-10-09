/**
 * F26 Training needs analysis and demand forecast: pure rules shared by both backends, the seed builder, the pages and the
 * PGlite validator. Import-free apart from types. SQL mirror: kafaa_dm_* in 20261009141001_kafaa_w4e1_effectiveness.sql.
 *
 * Demand per course per quarter is built from six sources, in priority order (a person who needs the same course for two
 * reasons in the same quarter is counted once, under the higher-priority source, so the sources always add up to the total):
 *   expiry     qualification records (M02) expiring: the requalification course 90 days before expiry (expired: now)
 *   mandatory  the role curriculum (M04): never completed (open assignment due date, else hire date + due window), or a
 *              completion whose validity runs out
 *   klra       open F20 cross-training actions: the family's cross-training course by the action's due date
 *   roadmap    F06 roadmap course blocks that have not ended, by their start date
 *   coach      F07 recommendations the person saved or enrolled in (last 180 days), 45 days after the signal
 *   future     F09 interest in a technology or horizon lane: its linked course, 120 days out
 * Anything already overdue lands in the current quarter. Capacity is the scheduled sessions × seats in the quarter (M04),
 * plus draft proposals, plus free full-scope simulator slots for simulator courses. Cells under 10 are suppressed in exports
 * (and on screen for aggregate-only viewers) but always counted in the totals.
 */
import type { Reason } from '../../domain/engines/types';

export const MIN_N = 10;
export const SOURCES = ['expiry', 'mandatory', 'klra', 'roadmap', 'coach', 'future'] as const;
export type Source = (typeof SOURCES)[number];
export const HORIZON_QUARTERS = 4;
export const EXPIRY_LEAD_DAYS = 90;
export const COACH_WINDOW_DAYS = 180;
export const COACH_LEAD_DAYS = 45;
export const FUTURE_LEAD_DAYS = 120;
export const SIM_SEATS = 6;
export const MAX_PROPOSED = 12;
export const OPEN_ENROLMENT = ['assigned', 'requested', 'approved', 'waitlisted', 'enrolled', 'in_progress'];
/** SIMULATED intake scenario: the initial courses every new DNT or GPO trainee needs in the quarter they join. */
export const INTAKE_COURSES: Record<'dnt' | 'gpo', string[]> = {
  dnt: ['c-get', 'c-onb', 'c-hu', 'c-sec-aw', 'c-loit-sys'],
  gpo: ['c-get', 'c-onb', 'c-hu', 'c-sec-aw', 'c-coit-gf'],
};

type Row = Record<string, any>;
const iso = (d: unknown) => String(d ?? '').slice(0, 10);
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ───────────── dates and quarters (same arithmetic as SQL date + integer and date + interval 'n months')
export function addDaysIso(d: string, n: number): string {
  const x = new Date(`${iso(d)}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
/** Month arithmetic clamped to the month end, like Postgres (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsIso(d: string, n: number): string {
  const [y, m, day] = iso(d).split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  const ny = Math.floor(t / 12), nm = t % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${String(ny).padStart(4, '0')}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}
export function quarterOfIso(d: string): string {
  const [y, m] = iso(d).split('-').map(Number);
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}
export function quarterBounds(q: string): { start: string; end: string } {
  const [y, n] = q.split('-Q').map(Number);
  const start = `${y}-${String((n - 1) * 3 + 1).padStart(2, '0')}-01`;
  return { start, end: addDaysIso(addMonthsIso(start, 3), -1) };
}
export function addQuarters(q: string, k: number): string {
  return quarterOfIso(addMonthsIso(quarterBounds(q).start, 3 * k));
}
/** The forecast horizon: the current quarter and the next three. */
export function periodsFrom(now: string): string[] {
  const q0 = quarterOfIso(now);
  return Array.from({ length: HORIZON_QUARTERS }, (_, i) => addQuarters(q0, i));
}
export const isPeriod = (p: unknown): p is string => typeof p === 'string' && /^\d{4}-Q[1-4]$/.test(p);
/** Quarter a need falls in: overdue needs land in the current quarter. */
export function needQuarter(due: string, now: string): string {
  return quarterOfIso(due < now ? now : due);
}

// ───────────── demand
export interface DemandInput {
  people: Row[]; courses: Row[]; curriculum_rules: Row[]; training_records: Row[]; enrolments: Row[]; qual_records: Row[]; qual_standards: Row[];
  links: Row[]; roadmaps: Row[]; coach_feedback: Row[]; future_interest: Row[]; future_resources: Row[]; klra_actions: Row[]; klra_positions: Row[];
}
export interface DetailCell { key: string; count: number | null }
export interface DemandRow { id: string; period: string; course_id: string; source: Source; count: number; suppressed: boolean; detail: { key: string; count: number }[] }
interface Need { who: string; course: string; source: Source; due: string; group: string }

export const demandId = (period: string, course: string, source: string) => `dm:${period}:${course}:${source}`;
export const courseAllowed = (c: Row | undefined) => !!c && c.audience !== 'supplier' && c.audience !== 'contractor';

/** Every dated need of the demo tenant, before quarter filtering and de-duplication. */
export function needsOf(x: DemandInput, now: string): Need[] {
  const staff = new Map(x.people.filter((p) => p.kind === 'staff' && p.status === 'active').map((p) => [p.id, p]));
  const course = new Map(x.courses.map((c) => [c.id, c]));
  const grp = (pid: string) => staff.get(pid)?.job_role_id ?? 'none';
  const out: Need[] = [];
  // expiry
  const std = new Map(x.qual_standards.map((s) => [s.id, s]));
  const requal = (sid: string) => x.links.filter((l) => l.kind === 'requal' && l.from_id === sid).map((l) => l.course_id as string);
  for (const r of x.qual_records) {
    const s = std.get(r.standard_id);
    if (!staff.has(r.person_id) || !s || s.security_restricted || !r.expires_on || !['qualified', 'due', 'renewed', 'expired'].includes(r.status)) continue;
    const due = r.status === 'expired' ? iso(r.expires_on) : addDaysIso(iso(r.expires_on), -EXPIRY_LEAD_DAYS);
    for (const c of requal(r.standard_id)) out.push({ who: r.person_id, course: c, source: 'expiry', due, group: grp(r.person_id) });
  }
  // mandatory
  for (const p of staff.values()) {
    if (!p.job_role_id) continue;
    for (const rule of x.curriculum_rules) {
      if (rule.role_id !== p.job_role_id || rule.mandatory === false) continue;
      const c = course.get(rule.course_id);
      if (!c) continue;
      const done = [
        ...x.training_records.filter((t) => t.person_id === p.id && t.course_id === c.id && ['passed', 'completed'].includes(t.result)).map((t) => iso(t.completed_on)),
        ...x.enrolments.filter((e) => e.person_id === p.id && e.course_id === c.id && e.status === 'completed' && e.completed_at).map((e) => iso(e.completed_at)),
      ].sort();
      let due: string | null;
      if (done.length) due = c.validity_months ? addMonthsIso(done[done.length - 1], Number(c.validity_months)) : null;
      else {
        const open = x.enrolments.filter((e) => e.person_id === p.id && e.course_id === c.id && OPEN_ENROLMENT.includes(e.status) && e.due_on).map((e) => iso(e.due_on)).sort()[0];
        due = open ?? (p.hire_date ? addDaysIso(iso(p.hire_date), Number(rule.due_within_days ?? 90)) : now);
      }
      if (due) out.push({ who: p.id, course: c.id, source: 'mandatory', due, group: grp(p.id) });
    }
  }
  // klra
  const pos = new Map(x.klra_positions.map((q) => [q.id, q]));
  for (const a of x.klra_actions) {
    if (a.kind !== 'cross_training' || !['planned', 'in_progress'].includes(a.status)) continue;
    const q = pos.get(a.position_id);
    if (!q?.family_id) continue;
    for (const l of x.links.filter((l) => l.kind === 'family' && l.from_id === q.family_id))
      out.push({ who: `klra:${a.id}`, course: l.course_id, source: 'klra', due: iso(a.due_on), group: q.department ?? 'none' });
  }
  // roadmap
  for (const r of x.roadmaps) {
    if (r.active === false || !staff.has(r.person_id)) continue;
    for (const blk of (r.plan as Row[]) ?? []) {
      if (blk?.kind !== 'course' || !blk.course_id || !blk.start || iso(blk.end ?? blk.start) < now) continue;
      out.push({ who: r.person_id, course: blk.course_id, source: 'roadmap', due: iso(blk.start), group: grp(r.person_id) });
    }
  }
  // coach: the latest signal per person and course
  const last = new Map<string, Row>();
  for (const f of x.coach_feedback) {
    if (f.item_kind !== 'course' || !staff.has(f.person_id)) continue;
    const k = `${f.person_id}|${f.item_id}`;
    const cur = last.get(k);
    const t = Date.parse(String(f.at)), ct = cur ? Date.parse(String(cur.at)) : -Infinity;
    if (!cur || t > ct || (t === ct && f.id > cur.id)) last.set(k, f);
  }
  for (const f of last.values()) {
    if (!['saved', 'enrolled'].includes(f.signal) || iso(f.at) < addDaysIso(now, -COACH_WINDOW_DAYS)) continue;
    out.push({ who: f.person_id, course: f.item_id, source: 'coach', due: addDaysIso(iso(f.at), COACH_LEAD_DAYS), group: grp(f.person_id) });
  }
  // future
  for (const i of x.future_interest) {
    if (i.active === false || !staff.has(i.person_id)) continue;
    const base = iso(i.updated_at) > now ? iso(i.updated_at) : now;
    for (const r of x.future_resources) {
      if (r.kind !== 'course' || !r.course_id) continue;
      const hit = i.target_kind === 'tech' ? (r.tech_ids ?? []).includes(i.tech_id) : (r.lane_ids ?? []).includes(i.lane_id);
      if (hit) out.push({ who: i.person_id, course: r.course_id, source: 'future', due: addDaysIso(base, FUTURE_LEAD_DAYS), group: grp(i.person_id) });
    }
  }
  return out.filter((n) => courseAllowed(course.get(n.course)));
}

/** Demand rows for one quarter: count per course and source, de-duplicated per person and course, with the role drill-down. */
export function computeDemand(x: DemandInput, period: string, now: string): DemandRow[] {
  const best = new Map<string, Need>();
  for (const n of needsOf(x, now)) {
    if (needQuarter(n.due, now) !== period) continue;
    const k = `${n.who}|${n.course}`;
    const cur = best.get(k);
    if (!cur || SOURCES.indexOf(n.source) < SOURCES.indexOf(cur.source)) best.set(k, n);
  }
  const agg = new Map<string, Map<string, number>>();
  for (const n of best.values()) {
    const k = `${n.course}|${n.source}`;
    const m = agg.get(k) ?? new Map<string, number>();
    m.set(n.group, (m.get(n.group) ?? 0) + 1);
    agg.set(k, m);
  }
  return [...agg.entries()]
    .map(([k, m]) => {
      const [course_id, source] = k.split('|') as [string, Source];
      const detail = [...m.entries()].sort((a, b) => cmp(a[0], b[0])).map(([key, count]) => ({ key, count }));
      const count = detail.reduce((s, d) => s + d.count, 0);
      return { id: demandId(period, course_id, source), period, course_id, source, count, suppressed: count < MIN_N, detail };
    })
    .sort((a, b) => cmp(a.course_id, b.course_id) || SOURCES.indexOf(a.source) - SOURCES.indexOf(b.source));
}

// ───────────── capacity and the report
export interface CapacityInput { sessions: Row[]; simulator_slots: Row[]; proposals: Row[]; courses: Row[] }
export interface NeedsRow {
  course_id: string; modality: string; total: number; sources: Record<Source, number | null>; detail: Record<Source, DetailCell[]>;
  sessions: number; seats: number; draft_seats: number; shortfall: number; sim_free: number | null; reasons: Reason[];
}
export interface NeedsReport { period: string; exact: boolean; computed_at: string | null; total: number; seats: number; shortfall: number; short_courses: number; rows: NeedsRow[] }
const within = (ts: unknown, b: { start: string; end: string }) => iso(ts) >= b.start && iso(ts) <= b.end;
const R = (code: string, vars?: Reason['vars']): Reason => ({ code, key: `m25.reasons.${code}`, ...(vars ? { vars } : {}) });

export function needsReport(snaps: Row[], cap: CapacityInput, period: string, exact: boolean, computedAt: string | null = null): NeedsReport {
  const b = quarterBounds(period);
  const course = new Map(cap.courses.map((c) => [c.id, c]));
  const by = new Map<string, Row[]>();
  for (const s of snaps) if (s.period === period && Number(s.count) > 0) by.set(s.course_id, [...(by.get(s.course_id) ?? []), s]);
  const simFree = cap.simulator_slots.filter((s) => ['free', 'tentative'].includes(s.status) && within(s.starts_at, b)).length;
  const sup = (n: number) => (exact || n >= MIN_N ? n : null);
  const rows: NeedsRow[] = [...by.keys()].sort().map((cid) => {
    const c = course.get(cid) ?? {};
    const src = Object.fromEntries(SOURCES.map((s) => [s, 0])) as Record<Source, number>;
    const detail = Object.fromEntries(SOURCES.map((s) => [s, [] as DetailCell[]])) as Record<Source, DetailCell[]>;
    for (const s of by.get(cid)!) {
      src[s.source as Source] = Number(s.count);
      detail[s.source as Source] = ((s.detail as Row[]) ?? []).map((d) => ({ key: String(d.key), count: sup(Number(d.count)) }));
    }
    const total = SOURCES.reduce((t, s) => t + src[s], 0);
    const sess = cap.sessions.filter((x) => x.course_id === cid && x.status === 'scheduled' && within(x.starts_at, b));
    const seats = sess.reduce((t, x) => t + Number(x.capacity ?? 0), 0);
    const draft = cap.proposals.filter((p) => p.course_id === cid && p.period === period && p.status === 'draft').reduce((t, p) => t + Number(p.sessions) * Number(p.seats_each), 0);
    const shortfall = Math.max(0, total - seats);
    const sim = c.modality === 'simulator' ? simFree : null;
    const reasons: Reason[] = [];
    for (const s of SOURCES) if (src[s] > 0) reasons.push(exact || src[s] >= MIN_N ? R(`src_${s}`, { n: src[s] }) : R(`src_${s}_small`, { min: MIN_N }));
    if (shortfall > 0) reasons.push(R('shortfall', { n: shortfall, seats }));
    else reasons.push(R('covered', { seats }));
    if (draft > 0) reasons.push(R('draft_cover', { n: draft }));
    if (sim !== null && shortfall > 0 && sim * SIM_SEATS < shortfall) reasons.push(R('sim_short', { slots: sim }));
    return {
      course_id: cid, modality: c.modality ?? 'classroom', total, sources: Object.fromEntries(SOURCES.map((s) => [s, sup(src[s])])) as Record<Source, number | null>,
      detail, sessions: sess.length, seats, draft_seats: draft, shortfall, sim_free: sim, reasons,
    };
  });
  return {
    period, exact, computed_at: computedAt, total: rows.reduce((t, r) => t + r.total, 0), seats: rows.reduce((t, r) => t + r.seats, 0),
    shortfall: rows.reduce((t, r) => t + r.shortfall, 0), short_courses: rows.filter((r) => r.shortfall > 0).length, rows,
  };
}

// ───────────── SIMULATED intake scenario (client-side what-if; never stored)
export interface Intake { dnt: number; gpo: number }
export function applyIntake(rep: NeedsReport, intake: Intake, courses: Row[]): NeedsReport & { intake: Record<string, number>; simulated: boolean } {
  const add: Record<string, number> = {};
  for (const k of ['dnt', 'gpo'] as const) for (const c of INTAKE_COURSES[k]) add[c] = (add[c] ?? 0) + Math.max(0, Math.round(intake[k] || 0));
  const simulated = Object.values(add).some((v) => v > 0);
  const rows = rep.rows.map((r) => ({ ...r }));
  for (const [cid, n] of Object.entries(add)) {
    if (!n || rows.some((r) => r.course_id === cid)) continue;
    const c = courses.find((x) => x.id === cid);
    if (!c) continue;
    rows.push({
      course_id: cid, modality: c.modality, total: 0, sources: Object.fromEntries(SOURCES.map((s) => [s, rep.exact ? 0 : null])) as Record<Source, number | null>,
      detail: Object.fromEntries(SOURCES.map((s) => [s, []])) as unknown as Record<Source, DetailCell[]>, sessions: 0, seats: 0, draft_seats: 0, shortfall: 0, sim_free: null, reasons: [],
    });
  }
  rows.sort((a, b) => cmp(a.course_id, b.course_id));
  for (const r of rows) {
    const n = add[r.course_id] ?? 0;
    r.total += n;
    r.shortfall = Math.max(0, r.total - r.seats);
  }
  return {
    ...rep, rows, intake: add, simulated, total: rows.reduce((t, r) => t + r.total, 0), shortfall: rows.reduce((t, r) => t + r.shortfall, 0),
    short_courses: rows.filter((r) => r.shortfall > 0).length,
  };
}

// ───────────── session proposals (drafts only; the scheduler creates sessions through the M04 path)
export function seatsFor(modality: string): number {
  return modality === 'simulator' ? SIM_SEATS : modality === 'elearning' ? 40 : modality === 'ojt' ? 4 : 16;
}
export function sessionKindFor(modality: string): 'class' | 'simulator' | 'drill' | 'elearning' | 'clinic' {
  return modality === 'simulator' ? 'simulator' : modality === 'drill' ? 'drill' : modality === 'elearning' ? 'elearning' : modality === 'clinic' ? 'clinic' : 'class';
}
/** n suggested start dates spread evenly across the quarter (drafts; the scheduler moves them). */
export function proposalDates(period: string, n: number): string[] {
  const b = quarterBounds(period);
  const days = Math.round((Date.parse(`${b.end}T00:00:00Z`) - Date.parse(`${b.start}T00:00:00Z`)) / 86400000) + 1;
  return Array.from({ length: n }, (_, i) => addDaysIso(b.start, Math.floor(((i + 1) * days) / (n + 1))));
}
/** Sizing of a proposal: sessions needed to close the shortfall not already covered by drafts. */
export function proposalSize(shortfall: number, draftSeats: number, modality: string): { sessions: number; seats_each: number } {
  const seats_each = seatsFor(modality);
  const gap = Math.max(0, shortfall - draftSeats);
  return { sessions: Math.min(MAX_PROPOSED, Math.ceil(gap / seats_each)), seats_each };
}

// ───────────── exports: cells under 10 print "<10"; totals are exact
export function exportRows(rep: NeedsReport, label: (courseId: string) => { code: string; title: string }): Record<string, string>[] {
  const c = (n: number | null) => (n === null || n < MIN_N ? '<10' : String(n));
  return rep.rows.map((r) => ({
    code: label(r.course_id).code, course: label(r.course_id).title, period: rep.period,
    ...Object.fromEntries(SOURCES.map((s) => [s, (r.sources[s] ?? 0) === 0 && r.sources[s] !== null ? '' : c(r.sources[s])])),
    total: String(r.total), seats: String(r.seats), draft_seats: String(r.draft_seats), shortfall: String(r.shortfall),
  }));
}
