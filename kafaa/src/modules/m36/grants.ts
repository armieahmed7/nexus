/**
 * M36 · FS82 Rolling mobility micro-grants (FS wave I · E4). Pure rules, import-free apart from types (the seed builder, the PGlite
 * validator and both backends load this file). SQL twins in supabase/migrations/20261010294001_kafaa_fs94_grants_consortium.sql
 * (kafaa_gr_*), proved by scripts/validate/fs94-grants-consortium.mjs.
 *
 * Benchmark NUC-NET (ENEN2plus mobility fund: small grants paid to the learner, deadlines every two months, early-career segment). The
 * design is borrowed; no figure is typed here (figures only through <BenchmarkChips feature="FS82" />).
 *  - Rounds are bi-monthly and contiguous: a round opens the day after the previous deadline and closes on its own deadline, the 10th of
 *    an even month (Feb, Apr, Jun, Aug, Oct, Dec). Decisions are due 14 days after the deadline. The phase comes from the dates only
 *    (roundPhase), so rounds open and close on schedule without anyone pressing a button. Budgets are SIMULATED (AED, demo figures).
 *  - Eligible: early-career ENEC staff (fewer than 10 full years since hire) and students on an ENEC-sponsored placement (a scholar
 *    in study; HR files on the student's behalf with a consent reference: the FS29/FS69 assessor-on-behalf precedent).
 *  - A light application: kind, activity, purpose, organiser or place, dates after the deadline, cost lines (transport, subsistence,
 *    registration) up to the round's maximum award, the skill it builds and the output promised (report or presentation).
 *  - Decisions (HR director) after the deadline only, never by the applicant, within the round's budget; every decision is audited.
 *  - Outputs (report, presentation) are logged by the grantee after the activity and accepted by HR (never the grantee): an accepted
 *    output is the person's validated evidence on the named skill (F01 kind `rating`, basis `validated`, ref_table `grant_applications`,
 *    report level 1, presentation level 2). Staff only: a placement student's accepted output is kept on the application.
 *  - grantStats(): every count of 1 to 9 is suppressed; a rate needs its base at 10 or more and an unsuppressed count; money committed in
 *    a round shows only when 10 or more awards stand behind it.
 */
import type { Reason } from '../../domain/engines/types';

export const GRANT_KINDS = ['conference', 'short_course', 'site_visit', 'exchange'] as const;
export type GrantKind = (typeof GRANT_KINDS)[number];
export const COST_ITEMS = ['transport', 'subsistence', 'registration'] as const;
export const OUTPUT_KINDS = ['report', 'presentation'] as const;
export type OutputKind = (typeof OUTPUT_KINDS)[number];
export const APP_STATUSES = ['submitted', 'approved', 'declined', 'withdrawn'] as const;
export const OUTPUT_STATUSES = ['none', 'submitted', 'accepted', 'returned'] as const;
/** Early career: fewer than this many full years since hire. */
export const EARLY_CAREER_YEARS = 10;
export const DEADLINE_DAY = 10;
export const DEADLINE_MONTHS = [2, 4, 6, 8, 10, 12];
export const DECIDE_DAYS = 14;
/** A new round's window is at least this long before its deadline (first round, or after a gap). */
export const MIN_WINDOW_DAYS = 27;
export const ACTIVITY_WINDOW_DAYS = 180;
export const ACTIVITY_MAX_DAYS = 30;
export const OUTPUT_DAYS = 30;
export const MIN_AMOUNT = 500;
export const BUDGET_MIN = 10000;
export const BUDGET_MAX = 500000;
export const AWARD_MIN = 1000;
export const AWARD_MAX = 25000;
export const MIN_GROUP = 10;
export const CURRENCY = 'AED';
export const GRANT_EVIDENCE_KIND = 'rating';
export const GRANT_REF_TABLE = 'grant_applications';

/** Email and phone patterns (identical to FS39 CONTACT_PATTERN in m31/literacy.ts and SQL kafaa_res_contact; a unit test keeps them equal). */
export const CONTACT_PATTERN = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}|(\\+|00)[0-9][0-9 -]{7,}[0-9]|(^|[^0-9])0[2-9][0-9]?[ -]?[0-9]{3}[ -]?[0-9]{4}([^0-9]|$)';
const CONTACT_RE = new RegExp(CONTACT_PATTERN);

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
export const validDate = (s: unknown): s is string => typeof s === 'string' && ISO.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const dayNo = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86400000);
/** ISO date plus n days (UTC). */
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const daysFrom = (from: string, to: string) => dayNo(to) - dayNo(from);
const d10 = (v: unknown) => (v == null ? '' : String(v).slice(0, 10));
const reason = (code: string, vars?: Reason['vars']): Reason => ({ code, key: `m36.reasons.${code}`, vars });

// ───────────── Rounds
/** The first deadline (10th of an even month) strictly after `after`. */
export function nextDeadline(after: string): string {
  let y = Number(after.slice(0, 4));
  let m = Number(after.slice(5, 7));
  for (let i = 0; i < 14; i++) {
    if (DEADLINE_MONTHS.includes(m)) {
      const d = `${y}-${String(m).padStart(2, '0')}-${String(DEADLINE_DAY).padStart(2, '0')}`;
      if (d > after) return d;
    }
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return `${y}-12-10`;
}
export const roundIdFor = (closesOn: string) => `gr-${closesOn.slice(0, 7)}`;
export interface RoundSlot { id: string; opens_on: string; closes_on: string; decide_by: string }
/** The next round after the latest one: contiguous (opens the day after its deadline) unless that day has passed, then from today. */
export function nextRoundSlot(latestClosesOn: string | null, today: string): RoundSlot {
  let start = latestClosesOn ? addDays(latestClosesOn, 1) : today;
  if (start < today) start = today;
  const closes = nextDeadline(addDays(start, MIN_WINDOW_DAYS));
  return { id: roundIdFor(closes), opens_on: start, closes_on: closes, decide_by: addDays(closes, DECIDE_DAYS) };
}
export type RoundPhase = 'scheduled' | 'open' | 'closed';
/** Phase from the dates only: before the window, inside it (deadline day included), after the deadline. */
export function roundPhase(r: { opens_on?: unknown; closes_on?: unknown }, today: string): RoundPhase {
  if (today < d10(r.opens_on)) return 'scheduled';
  if (today <= d10(r.closes_on)) return 'open';
  return 'closed';
}
/** The round open today (at most one, rounds are contiguous). */
export const openRound = (rounds: Row[], today: string) => rounds.find((r) => roundPhase(r, today) === 'open') ?? null;
export interface ScheduleInput { budget: number; max_award: number; note?: string | null }
export type ScheduleProblem = 'exists' | 'budget' | 'award' | 'note';
/** Scheduling the next round (HR): only when no round is waiting to open; budget and maximum award in range, award <= budget. */
export function scheduleProblem(p: Partial<ScheduleInput> | null | undefined, rounds: Row[], today: string): ScheduleProblem | null {
  if (rounds.some((r) => roundPhase(r, today) === 'scheduled')) return 'exists';
  if (!p || !isInt(p.budget) || p.budget < BUDGET_MIN || p.budget > BUDGET_MAX) return 'budget';
  if (!isInt(p.max_award) || p.max_award < AWARD_MIN || p.max_award > AWARD_MAX || p.max_award > p.budget) return 'award';
  const n = p.note == null ? '' : p.note;
  if (typeof n !== 'string' || n.trim().length > 300 || CONTACT_RE.test(n)) return 'note';
  return null;
}
export const latestRound = (rounds: Row[]) => rounds.slice().sort((a, b) => (d10(a.closes_on) < d10(b.closes_on) ? 1 : -1))[0] ?? null;

// ───────────── Eligibility
/** Full years from `from` to `to` (anniversary rule). */
export function fullYears(from: string, to: string): number {
  let y = Number(to.slice(0, 4)) - Number(from.slice(0, 4));
  if (to.slice(5) < from.slice(5)) y--;
  return y;
}
export type EligibilityBasis = 'early_career' | 'placement';
export interface Eligibility { eligible: boolean; basis: EligibilityBasis | null; years: number | null; reasons: Reason[] }
/** Early-career staff (active, fewer than 10 full years since hire), or a student on an ENEC-sponsored placement (scholar in study). */
export function eligibility(person: Row | null | undefined, today: string, onPlacement: boolean): Eligibility {
  if (!person) return { eligible: false, basis: null, years: null, reasons: [reason('gr_not_found')] };
  if (person.kind === 'staff') {
    if (person.status !== 'active' || !validDate(d10(person.hire_date))) return { eligible: false, basis: null, years: null, reasons: [reason('gr_not_active')] };
    const years = fullYears(d10(person.hire_date), today);
    if (years < EARLY_CAREER_YEARS) return { eligible: true, basis: 'early_career', years, reasons: [reason('gr_early_career', { years, max: EARLY_CAREER_YEARS })] };
    return { eligible: false, basis: null, years, reasons: [reason('gr_experienced', { years, max: EARLY_CAREER_YEARS })] };
  }
  if (person.kind === 'applicant' && onPlacement) return { eligible: true, basis: 'placement', years: null, reasons: [reason('gr_placement')] };
  return { eligible: false, basis: null, years: null, reasons: [reason('gr_not_staff')] };
}

// ───────────── Applications
export interface CostLine { item: string; amount: number }
export interface ApplicationInput {
  round_id?: string;
  person_id?: string | null;
  consent_ref?: string | null;
  kind: string;
  title: string;
  purpose: string;
  destination: string;
  starts_on: string;
  ends_on: string;
  costs: CostLine[];
  skill_id: string;
  output_kind: string;
}
export interface SkillLite { area?: string | null; lifecycle?: string | null }
export interface AppCtx { closes_on: string; max_award: number; skills: Record<string, SkillLite> }
export type AppProblem = 'kind' | 'title' | 'purpose' | 'destination' | 'dates' | 'costs' | 'skill' | 'output';
export const costTotal = (lines: unknown) => (Array.isArray(lines) ? lines.reduce((m: number, l) => m + (l && isInt((l as CostLine).amount) ? (l as CostLine).amount : 0), 0) : 0);
/** First problem of an application, in field order (SQL kafaa_gr_app_problem). */
export function applicationProblem(a: Partial<ApplicationInput> | null | undefined, ctx: AppCtx): AppProblem | null {
  if (!a || typeof a !== 'object' || !(GRANT_KINDS as readonly string[]).includes(a.kind as string)) return 'kind';
  const title = txt(a.title);
  if (title.length < 5 || title.length > 160 || CONTACT_RE.test(title)) return 'title';
  const purpose = txt(a.purpose);
  if (purpose.length < 20 || purpose.length > 600 || CONTACT_RE.test(purpose)) return 'purpose';
  const dest = txt(a.destination);
  if (dest.length < 2 || dest.length > 120 || CONTACT_RE.test(dest)) return 'destination';
  if (!validDate(a.starts_on) || !validDate(a.ends_on) || a.starts_on <= ctx.closes_on || a.starts_on > addDays(ctx.closes_on, ACTIVITY_WINDOW_DAYS)
    || a.ends_on < a.starts_on || a.ends_on > addDays(a.starts_on, ACTIVITY_MAX_DAYS)) return 'dates';
  const lines = a.costs;
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > COST_ITEMS.length) return 'costs';
  const seen = new Set<string>();
  for (const l of lines) {
    if (!l || typeof l !== 'object' || !(COST_ITEMS as readonly string[]).includes(l.item) || seen.has(l.item) || !isInt(l.amount) || l.amount < 0 || l.amount > ctx.max_award) return 'costs';
    seen.add(l.item);
  }
  const total = costTotal(lines);
  if (total < MIN_AMOUNT || total > ctx.max_award) return 'costs';
  const s = typeof a.skill_id === 'string' ? ctx.skills[a.skill_id] : undefined;
  if (!s || s.area === 'security' || s.lifecycle === 'obsolete') return 'skill';
  if (!(OUTPUT_KINDS as readonly string[]).includes(a.output_kind as string)) return 'output';
  return null;
}

// ───────────── Decisions
export interface DecisionInput { application_id: string; decision: string; award?: number | null; note?: string | null }
export type DecisionProblem = 'round_open' | 'decision' | 'note' | 'award' | 'budget';
/** Committed money in a round: the awards of approved applications. */
export const committedIn = (apps: Row[], roundId: string) => apps.filter((x) => x.round_id === roundId && x.status === 'approved').reduce((m, x) => m + Number(x.awarded ?? 0), 0);
/** A decision check (SQL kafaa_gr_decision_problem): after the deadline only; approve within the request, the maximum and the budget left. */
export function decisionProblem(d: Partial<DecisionInput> | null | undefined, app: Row, round: Row, committed: number, today: string): DecisionProblem | null {
  if (roundPhase(round, today) !== 'closed') return 'round_open';
  if (!d || (d.decision !== 'approve' && d.decision !== 'decline')) return 'decision';
  const note = txt(d.note);
  if (note.length > 300 || (d.decision === 'decline' && note.length < 5)) return 'note';
  if (d.decision === 'decline') return null;
  const award = d.award == null ? Number(app.amount) : d.award;
  if (!isInt(award) || award < MIN_AMOUNT || award > Number(app.amount) || award > Number(round.max_award)) return 'award';
  if (committed + award > Number(round.budget)) return 'budget';
  return null;
}

// ───────────── Outputs
export interface OutputInput { application_id: string; kind: string; title: string; summary: string }
export type OutputProblem = 'too_early' | 'kind' | 'title' | 'summary';
export const outputDue = (app: Row) => addDays(d10(app.ends_on), OUTPUT_DAYS);
/** The output check (SQL kafaa_gr_output_problem): after the activity has ended; report or presentation; title and summary. */
export function outputProblem(o: Partial<OutputInput> | null | undefined, app: Row, today: string): OutputProblem | null {
  if (today < d10(app.ends_on)) return 'too_early';
  if (!o || !(OUTPUT_KINDS as readonly string[]).includes(o.kind as string)) return 'kind';
  const title = txt(o.title);
  if (title.length < 5 || title.length > 160 || CONTACT_RE.test(title)) return 'title';
  const sum = txt(o.summary);
  if (sum.length < 20 || sum.length > 1200 || CONTACT_RE.test(sum)) return 'summary';
  return null;
}
/** Evidence level of an accepted output: a presentation 2, a report 1. */
export const outputLevel = (kind: string) => (kind === 'presentation' ? 2 : 1);
export type OutputState = 'not_due' | 'due' | 'overdue' | 'submitted' | 'accepted' | 'returned';
/** Where an approved grant's output stands today (null for an application that was not approved). */
export function outputState(app: Row, today: string): OutputState | null {
  if (app.status !== 'approved') return null;
  const s = String(app.output_status ?? 'none');
  if (s === 'submitted' || s === 'accepted' || s === 'returned') return s;
  if (today < d10(app.ends_on)) return 'not_due';
  return today > outputDue(app) ? 'overdue' : 'due';
}

/** Status reasons for <WhyThis> on an application (deterministic, i18n keys m36.reasons.*). */
export function applicationReasons(app: Row, round: Row | null, today: string): Reason[] {
  const out: Reason[] = [];
  const st = String(app.status);
  if (round) out.push(reason(`gr_round_${roundPhase(round, today)}`, { date: d10(round.closes_on) }));
  if (st === 'submitted') out.push(reason(round && roundPhase(round, today) === 'closed' ? 'gr_awaiting_decision' : 'gr_awaiting_deadline', { date: round ? d10(round.decide_by) : '' }));
  if (st === 'approved') out.push(reason('gr_approved', { amount: Number(app.awarded ?? 0) }));
  if (st === 'declined') out.push(reason('gr_declined'));
  if (st === 'withdrawn') out.push(reason('gr_withdrawn'));
  const os = outputState(app, today);
  if (os) out.push(reason(`gr_output_${os}`, { date: outputDue(app) }));
  if (app.on_behalf) out.push(reason('gr_on_behalf'));
  return out;
}

// ───────────── Statistics (suppressed)
export interface Cell { value: number | null; suppressed: boolean }
/** A count of 1 to 9 is suppressed (0 shows as 0). */
export const cellOf = (v: number): Cell => (v > 0 && v < MIN_GROUP ? { value: null, suppressed: true } : { value: v, suppressed: false });
/** A rate (whole percent) needs its base at 10 or more and an unsuppressed count. */
export const rateOf = (n: number, base: number): number | null => (base >= MIN_GROUP && !(n > 0 && n < MIN_GROUP) ? Math.round((100 * n) / base) : null);
export interface RoundStat {
  round_id: string; phase: RoundPhase; opens_on: string; closes_on: string; budget: number; max_award: number;
  applications: Cell; approved: Cell; declined: Cell; approval_rate: number | null; committed: number | null; outputs_submitted: Cell; outputs_accepted: Cell;
}
export interface GrantStats {
  as_of: string; min_group: number;
  totals: { applications: Cell; approved: Cell; outputs_accepted: Cell; approval_rate: number | null };
  rounds: RoundStat[];
  by_kind: { key: string; applications: Cell; approved: Cell }[];
  by_output: { key: string; promised: Cell }[];
}
/** The statistics every staff reader sees (SQL kafaa_gr_stats): withdrawn applications are not counted. */
export function grantStats(rounds: Row[], apps: Row[], today: string): GrantStats {
  const live = apps.filter((a) => a.status !== 'withdrawn');
  const isOut = (a: Row, s: string[]) => a.status === 'approved' && s.includes(String(a.output_status ?? 'none'));
  const rs = rounds.slice().sort((a, b) => (d10(a.closes_on) < d10(b.closes_on) ? -1 : 1)).map((r): RoundStat => {
    const xs = live.filter((a) => a.round_id === r.id);
    const ap = xs.filter((a) => a.status === 'approved');
    return {
      round_id: String(r.id), phase: roundPhase(r, today), opens_on: d10(r.opens_on), closes_on: d10(r.closes_on), budget: Number(r.budget), max_award: Number(r.max_award),
      applications: cellOf(xs.length), approved: cellOf(ap.length), declined: cellOf(xs.filter((a) => a.status === 'declined').length),
      approval_rate: rateOf(ap.length, xs.filter((a) => a.status === 'approved' || a.status === 'declined').length),
      committed: ap.length >= MIN_GROUP ? ap.reduce((m, a) => m + Number(a.awarded ?? 0), 0) : null,
      outputs_submitted: cellOf(xs.filter((a) => isOut(a, ['submitted', 'accepted', 'returned'])).length), outputs_accepted: cellOf(xs.filter((a) => isOut(a, ['accepted'])).length),
    };
  });
  const apAll = live.filter((a) => a.status === 'approved');
  return {
    as_of: today, min_group: MIN_GROUP,
    totals: {
      applications: cellOf(live.length), approved: cellOf(apAll.length), outputs_accepted: cellOf(live.filter((a) => isOut(a, ['accepted'])).length),
      approval_rate: rateOf(apAll.length, live.filter((a) => a.status === 'approved' || a.status === 'declined').length),
    },
    rounds: rs,
    by_kind: GRANT_KINDS.map((k) => ({ key: k, applications: cellOf(live.filter((a) => a.kind === k).length), approved: cellOf(apAll.filter((a) => a.kind === k).length) })),
    by_output: OUTPUT_KINDS.map((k) => ({ key: k, promised: cellOf(apAll.filter((a) => a.output_kind === k).length) })),
  };
}
