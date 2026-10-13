/**
 * FS78 (future skills, wave I · E1, module M34): learning balance and protected study time. Pure and import-free (the seed builder,
 * the PGlite validator and both backends import it).
 *
 *   balance   kafaa_learning_balances: one SIMULATED annual balance per member of staff and calendar year, in notional learning hours
 *             shown as credits (FS30 unit: 1 credit = 10 hours, CREDIT_HOURS). Granted = a base grant for every member of staff plus a
 *             mid-career top-up for staff with MID_CAREER_YEARS or more years of service on 1 January (years of service as recorded
 *             by HR; age, gender and nationality are never read). The balance is grants minus approved use: balanceOf() = SQL
 *             kafaa_lb_compute, and the stored used / pending / remaining columns are refreshed by every request and decision.
 *   use       kafaa_study_time_requests: protected study hours for ONE item of the outcome-gated catalogue (FS18 external_resources:
 *             published, listed and still meeting every published required criterion = catalogueCheck / kafaa_xr_check). A request
 *             reserves hours (pending); the line manager in scope approves or declines (maker-checker: never the requester; the HR
 *             authority may decide when the line manager cannot); an approved request is the "approved use". Ungated items are never
 *             charged (refusal `ungated`), and nothing is charged beyond the balance (`insufficient_balance`).
 *
 * SQL mirror (supabase/migrations/20261010291001_kafaa_fs91_balance_external_certs.sql): kafaa_lb_grant = grantFor,
 * kafaa_lb_compute = balanceOf, kafaa_sb_check_request = checkRequest, kafaa_sb_check_decide = checkDecide, kafaa_sb_message = SB_MSG.
 */
export const CREDIT_HOURS = 10; // FS30 (credits.ts): 1 credit = 10 notional hours
export const BASE_HOURS = 60; // 6 credits a year for every member of staff (SIMULATED)
export const TOPUP_HOURS = 40; // 4 credits mid-career top-up (SIMULATED)
export const MID_CAREER_YEARS = 8; // years of service on 1 January of the balance year
export const REQ_MIN = 2;
export const REQ_MAX = 40; // hours in one request
export const MAX_SPAN_DAYS = 92;
export const REASON_MIN = 10;
export const REASON_MAX = 300;
export const NOTE_MIN = 5;
export const PATTERNS = ['release_days', 'shift_blocks', 'non_shift_week'] as const;
export type Pattern = (typeof PATTERNS)[number];
export const REQ_STATUSES = ['requested', 'approved', 'declined', 'withdrawn'] as const;
export const DECISIONS = ['approve', 'decline'] as const;
export const balanceId = (person: string, year: number) => `lb:${person}:${year}`;

const s = (v: unknown) => (typeof v === 'string' ? v.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '') : '');
const isInt = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && Math.trunc(v) === v;
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const d10 = (v: unknown) => (v == null ? null : String(v).slice(0, 10));
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
export const creditsOfHours = (h: number) => Math.max(0, Math.trunc(Number(h) || 0)) / CREDIT_HOURS;

// ───────────── Grant (SQL kafaa_lb_grant)
export interface PersonLite { id: string; kind?: string | null; status?: string | null; hire_date?: string | null }
export interface Grant { eligible: boolean; base_hours: number; topup_hours: number; topup_basis: 'mid_career' | 'none'; service_years: number; granted_hours: number }
/** Whole years of service on 1 January of `year` (0 when no hire date or hired later). */
export function serviceYears(hire: string | null | undefined, year: number): number {
  const h = d10(hire);
  if (!h || !isDate(h)) return 0;
  const [y, m, d] = h.split('-').map(Number);
  let n = year - y;
  if (m > 1 || d > 1) n -= 1; // 1 January is reached only from the next year when hired after 1 January
  return Math.max(0, n);
}
/** The annual grant of one person: staff only (contractors and leavers have none); top-up from years of service, never age. */
export function grantFor(p: PersonLite | null | undefined, year: number): Grant {
  const eligible = !!p && p.kind === 'staff' && p.status !== 'leaver';
  const sy = p ? serviceYears(p.hire_date, year) : 0;
  const top = eligible && sy >= MID_CAREER_YEARS;
  const base = eligible ? BASE_HOURS : 0;
  const topup = top ? TOPUP_HOURS : 0;
  return { eligible, base_hours: base, topup_hours: topup, topup_basis: top ? 'mid_career' : 'none', service_years: sy, granted_hours: base + topup };
}

// ───────────── Balance (SQL kafaa_lb_compute): grants minus approved use
export interface RequestLite { id: string; person_id: string; year: number; hours: number; status: string; resource_id?: string; starts_on?: string | null; ends_on?: string | null; line_manager_id?: string | null }
export interface BalanceRowLite { person_id: string; year: number; base_hours: number; topup_hours: number }
export interface Balance {
  person_id: string; year: number; granted_hours: number; used_hours: number; pending_hours: number; remaining_hours: number; available_hours: number;
  granted_credits: number; used_credits: number; pending_credits: number; remaining_credits: number; available_credits: number; approved: number; requested: number;
}
export function balanceOf(row: BalanceRowLite, requests: RequestLite[]): Balance {
  const mine = requests.filter((r) => r.person_id === row.person_id && Number(r.year) === Number(row.year));
  const granted = Math.trunc(Number(row.base_hours) || 0) + Math.trunc(Number(row.topup_hours) || 0);
  const ap = mine.filter((r) => r.status === 'approved');
  const pe = mine.filter((r) => r.status === 'requested');
  const used = ap.reduce((a, r) => a + Math.trunc(Number(r.hours) || 0), 0);
  const pending = pe.reduce((a, r) => a + Math.trunc(Number(r.hours) || 0), 0);
  const remaining = granted - used;
  const available = remaining - pending;
  return {
    person_id: row.person_id, year: Number(row.year), granted_hours: granted, used_hours: used, pending_hours: pending, remaining_hours: remaining, available_hours: available,
    granted_credits: granted / CREDIT_HOURS, used_credits: used / CREDIT_HOURS, pending_credits: pending / CREDIT_HOURS, remaining_credits: remaining / CREDIT_HOURS,
    available_credits: available / CREDIT_HOURS, approved: ap.length, requested: pe.length,
  };
}

// ───────────── Requests (SQL kafaa_sb_check_request)
export interface StudyInput { resource_id?: unknown; hours?: unknown; starts_on?: unknown; ends_on?: unknown; pattern?: unknown; reason?: unknown }
export interface ItemLite { id: string; hours?: number | null; gated: boolean }
export interface RequestCtx {
  today: string;
  person: PersonLite | null;
  item: ItemLite | null;
  /** available hours (granted - approved - pending) in the balance year of starts_on */
  available: number;
  /** an open (requested or approved) request of the same person for the same item in that year */
  openSame: boolean;
  lineManager: string | null;
}
export type RequestCode = 'ok' | 'not_eligible' | 'item' | 'ungated' | 'hours' | 'pattern' | 'dates' | 'reason' | 'conflict' | 'balance' | 'no_line_manager';
/** Most hours one request may ask for this item: REQ_MAX, or the item's notional hours when lower. */
export const hoursCap = (item: { hours?: number | null } | null | undefined) =>
  item && item.hours != null && Number.isFinite(Number(item.hours)) ? Math.min(REQ_MAX, Math.floor(Number(item.hours))) : REQ_MAX;
export function checkRequest(input: StudyInput, ctx: RequestCtx): RequestCode {
  if (!ctx.person || ctx.person.kind !== 'staff' || ctx.person.status === 'leaver') return 'not_eligible';
  if (!ctx.item) return 'item';
  if (!ctx.item.gated) return 'ungated';
  if (!isInt(input.hours) || (input.hours as number) < REQ_MIN || (input.hours as number) > hoursCap(ctx.item)) return 'hours';
  if (!(PATTERNS as readonly string[]).includes(s(input.pattern))) return 'pattern';
  const a = input.starts_on;
  const b = input.ends_on;
  if (!isDate(a) || !isDate(b) || (a as string) < ctx.today || (b as string) < (a as string) || String(a).slice(0, 4) !== String(b).slice(0, 4) || days(a as string, b as string) > MAX_SPAN_DAYS) return 'dates';
  const r = s(input.reason);
  if (r.length < REASON_MIN || r.length > REASON_MAX) return 'reason';
  if (ctx.openSame) return 'conflict';
  if ((input.hours as number) > ctx.available) return 'balance';
  if (!ctx.lineManager) return 'no_line_manager';
  return 'ok';
}
/** The balance year a request is charged to. */
export const yearOf = (startsOn: unknown) => (isDate(startsOn) ? Number(String(startsOn).slice(0, 4)) : null);

// ───────────── Decisions (SQL kafaa_sb_check_decide): maker-checker
export interface DecideInput { id?: unknown; decision?: unknown; note?: unknown }
export interface DecideCtx { today: string; hr: boolean; remaining: number }
export type DecideCode = 'ok' | 'invalid' | 'self' | 'forbidden' | 'state' | 'note' | 'late' | 'overdraw';
export function checkDecide(input: DecideInput, req: RequestLite, me: string, ctx: DecideCtx): DecideCode {
  if (!(DECISIONS as readonly string[]).includes(s(input.decision))) return 'invalid';
  if (req.person_id === me) return 'self';
  if (!(req.line_manager_id === me || ctx.hr)) return 'forbidden';
  if (req.status !== 'requested') return 'state';
  if (s(input.decision) === 'decline' && s(input.note).length < NOTE_MIN) return 'note';
  if (s(input.decision) === 'approve' && d10(req.ends_on) != null && (d10(req.ends_on) as string) < ctx.today) return 'late';
  if (s(input.decision) === 'approve' && Math.trunc(Number(req.hours) || 0) > ctx.remaining) return 'overdraw';
  return 'ok';
}
export type WithdrawCode = 'ok' | 'forbidden' | 'state' | 'started';
export function checkWithdraw(req: RequestLite, me: string, today: string): WithdrawCode {
  if (req.person_id !== me) return 'forbidden';
  if (req.status !== 'requested' && req.status !== 'approved') return 'state';
  if (req.status === 'approved' && d10(req.starts_on) != null && (d10(req.starts_on) as string) <= today) return 'started';
  return 'ok';
}

export const SB_MSG: Record<string, string> = {
  not_signed_in: 'Sign in to use your learning balance',
  forbidden_request: 'Only staff with a learning balance ask for protected study time',
  not_eligible: 'Protected study time and the learning balance are for ENEC staff (contractors and leavers have none)',
  item: 'Choose an item from the outcome-gated catalogue',
  ungated: 'Only items of the outcome-gated catalogue (published, meeting every published criterion) can be charged to the balance',
  hours: 'Ask for 2 to 40 whole hours, and no more than the item\'s notional hours',
  pattern: 'Choose how the study time is protected (release days, blocks inside the roster or a week away from shift)',
  dates: 'Give a start date from today and an end date in the same year, at most 92 days later',
  reason: 'Say in 10 to 300 characters what the study time is for',
  conflict: 'You already have an open request for this item this year',
  balance: 'Not enough learning balance left this year for these hours (pending requests are reserved)',
  no_line_manager: 'No line manager is recorded for you; ask HR to update your record',
  invalid: 'Unknown decision',
  self: 'You cannot decide your own protected study time',
  forbidden: 'Only the line manager (or the HR authority) decides protected study time',
  state: 'This request is not waiting for a decision',
  note: 'Give a reason of at least 5 characters when you decline',
  late: 'This request has already ended; ask the person to send a new one',
  overdraw: 'Approving these hours would take the balance below zero',
  not_found: 'Study-time request not found',
  w_forbidden: 'Only the person who asked can withdraw a request',
  w_state: 'This request can no longer be withdrawn',
  w_started: 'The study time has already started; ask your line manager to close it',
  read_forbidden: 'You can read your own balance; line managers read their team\'s and HR reads everyone\'s',
};
export const sbResultCode = (c: string): string =>
  ({ self: 'maker_checker', forbidden: 'forbidden', not_eligible: 'not_eligible', conflict: 'conflict', ungated: 'ungated', balance: 'insufficient_balance', overdraw: 'insufficient_balance',
    no_line_manager: 'no_line_manager', item: 'not_found', not_found: 'not_found', w_forbidden: 'forbidden' } as Record<string, string>)[c] ?? 'invalid';
export const sbMsgKey = (c: string, withdraw = false) => (withdraw ? `w_${c}` : c);

// ───────────── Explanations (<WhyThis>) and HR aggregates
export interface Reason { code: string; key: string; vars?: Record<string, string | number | { en: string; ar: string }> }
export function grantReasons(g: Grant): Reason[] {
  if (!g.eligible) return [{ code: 'not_eligible', key: 'm34.sb.why.notEligible' }];
  const out: Reason[] = [{ code: 'base', key: 'm34.sb.why.base', vars: { c: BASE_HOURS / CREDIT_HOURS, h: BASE_HOURS } }];
  out.push(g.topup_hours > 0
    ? { code: 'topup', key: 'm34.sb.why.topup', vars: { c: TOPUP_HOURS / CREDIT_HOURS, y: g.service_years, min: MID_CAREER_YEARS } }
    : { code: 'no_topup', key: 'm34.sb.why.noTopup', vars: { y: g.service_years, min: MID_CAREER_YEARS } });
  out.push({ code: 'never_age', key: 'm34.sb.why.neverAge' });
  return out;
}
export interface CriterionLite { id: string; name_en: string; name_ar: string; min_score: number; required: boolean; status?: string | null; sort?: number | null }
/** Why an item can (or cannot) be charged: its status and its score on every published criterion. */
export function gateReasons(item: { status?: string | null; listed?: boolean | null; criteria?: Record<string, unknown> | null }, criteria: CriterionLite[], gated: boolean): Reason[] {
  const out: Reason[] = [{ code: gated ? 'gated' : 'ungated', key: gated ? 'm34.sb.why.gated' : 'm34.sb.why.ungated' }];
  const sc = item.criteria && typeof item.criteria === 'object' ? item.criteria : {};
  for (const c of [...criteria].filter((x) => (x.status ?? 'published') === 'published').sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0) || (a.id < b.id ? -1 : 1))) {
    const v = Number(sc[c.id] ?? 0);
    out.push({ code: c.required ? (v >= c.min_score ? 'meets' : 'below') : 'info', key: c.required ? (v >= c.min_score ? 'm34.sb.why.meets' : 'm34.sb.why.below') : 'm34.sb.why.optional', vars: { name: { en: c.name_en, ar: c.name_ar }, v, min: c.min_score } });
  }
  return out;
}
/** HR overview by entity: people, granted / used / pending hours; any group under minGroup is suppressed (no values). */
export function balanceStats(rows: { person_id: string; granted_hours: number; used_hours: number; pending_hours: number; topup_hours: number }[], groupOf: (person: string) => string, minGroup = 10) {
  const g = new Map<string, { key: string; people: number; granted: number; used: number; pending: number; topup: number }>();
  for (const r of rows) {
    const k = groupOf(r.person_id) || 'other';
    const x = g.get(k) ?? { key: k, people: 0, granted: 0, used: 0, pending: 0, topup: 0 };
    x.people++; x.granted += Number(r.granted_hours) || 0; x.used += Number(r.used_hours) || 0; x.pending += Number(r.pending_hours) || 0; x.topup += Number(r.topup_hours) > 0 ? 1 : 0;
    g.set(k, x);
  }
  return [...g.values()].sort((a, b) => (a.key < b.key ? -1 : 1)).map((x) => (x.people < minGroup
    ? { key: x.key, people: null, suppressed: true as const, granted: null, used: null, pending: null, topup: null, usedPct: null }
    : { key: x.key, people: x.people, suppressed: false as const, granted: x.granted, used: x.used, pending: x.pending, topup: x.topup, usedPct: x.granted ? Math.round((x.used / x.granted) * 100) : 0 }));
}
