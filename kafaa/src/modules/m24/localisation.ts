/**
 * FS45 Localisation countdown to 2030 (FS wave E · E3, module M24). Pure rules shared by the pages, the LocalBackend
 * (src/modules/m24/backend/local.fs44.ts) and, line for line, the SQL in supabase/migrations/20261010253001_kafaa_fs53_lectures_localisation.sql
 * (kafaa_lz_*). The PGlite validator (scripts/validate/fs53-lectures-localisation.mjs) proves SQL = TS. Import-free.
 *
 * Each item is a programme or qualification step that a partner organisation still delivers or signs off (a SAMPLE plan: illustrative,
 * not an ENEC or partner commitment), with the qualification standards it covers, the number of in-house instructors needed to take it
 * over, a target transfer date no later than 31 Dec 2030 and a status the training manager sets.
 * Readiness is computed from the F31 instructor pipeline (M02 instructor_tracks, observations, teaching hours), never entered or stored:
 *   - a track covers an item when it shares a qualification standard with it, or (items without standards) has the item's discipline;
 *   - a qualified instructor whose annual currency has not lapsed counts as ready now (10 tenths); a lapsed one counts 0;
 *   - an active pipeline track counts by its derived stage: ready 8, solo 6, co-teach 4, initial training 2, nominated 1 tenths;
 *   - withdrawn and declined tracks are ignored; nationality, gender and age are never read (ENEC's own instructors only);
 *   - readiness % = min(100, floor(weighted tenths x 10 / needed)).
 * Risk: transferred -> done; past the target date and not transferred -> overdue (flagged, and listed on the F22 handover board);
 * high when readiness < 50% with 18 months (548 days) or less left, or < 80% with 6 months (183 days) or less; medium when < 80% with
 * two years (730 days) or less, or < 50%, or on hold; otherwise low. Marking an item transferred needs ready-now >= needed.
 */

export const LOC_STATUSES = ['partner_led', 'co_delivery', 'uae_led_supervised', 'transferred', 'on_hold'] as const;
export type LocStatus = (typeof LOC_STATUSES)[number];
export const LOC_SCOPES = ['delivery', 'signoff', 'both'] as const;
export const TARGET_MAX = '2030-12-31';
export const STAGE_TENTHS: Record<string, number> = { ready: 8, solo: 6, co_teach: 4, initial_training: 2, nominated: 1 };
export const QUALIFIED_TENTHS = 10;
export const RISK_LEVELS = ['overdue', 'high', 'medium', 'low', 'done'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];
export const LZ_DAYS = { high50: 548, high80: 183, medium80: 730 } as const;
export const LZ_NOTE_MAX = 600;

export const LZ_MSG = {
  not_signed_in: 'Sign in to see the localisation countdown',
  forbidden: 'The localisation countdown is open to ENEC staff',
  forbidden_edit: 'Only the training manager sets localisation status',
  not_found: 'Localisation item not found',
  status: 'Choose partner-led, co-delivery, UAE-led with partner sign-off, transferred or on hold',
  target: 'The target transfer date is a real date between the plan baseline and 31 Dec 2030',
  unchanged: 'Nothing to change: choose a different status or target date',
  note_required: 'Give a reason of at least 10 characters when you move the target date, put an item on hold or reopen a transferred item',
  note_long: 'Keep the note under 600 characters',
  not_ready: 'Not yet: readiness is computed from the instructor pipeline, and fewer current in-house instructors cover this item than it needs',
} as const;

export interface LocItem {
  id: string; programme_id?: string | null; title_en?: string; title_ar?: string; scope?: string; partner_org_id?: string; standard_ids: string[];
  discipline?: string | null; instructors_needed: number; baseline_on: string; target_on: string; status: LocStatus | string; sort?: number;
}
/** A track as the readiness rule needs it: derived stage (M02 deriveStage / kafaa_ins_stage) and currency (currencyView / kafaa_ins_currency). */
export interface TrackState { id: string; person_id: string; status: string; stage: string; discipline?: string | null; standard_ids: string[]; currency: string | null }
export interface InstructorLine { track_id: string; person_id: string; state: string; tenths: number }
export interface Readiness { needed: number; ready_now: number; pipeline: number; lapsed: number; tenths: number; pct: number; gap: number; lines: InstructorLine[] }
export interface ReasonLite { code: string; key: string; vars?: Record<string, string | number> }
export interface Risk { level: RiskLevel; overdue: boolean; days_left: number; regressed: boolean; reasons: ReasonLite[] }

const R = (code: string, vars: Record<string, string | number> = {}): ReasonLite => ({ code, key: `m24.lz.reason.${code}`, vars });
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export function isIsoDay(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
/** Calendar days from `from` to `to` (SQL date - date). */
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/** Does this F31 track cover the item? */
export function trackCovers(item: Pick<LocItem, 'standard_ids' | 'discipline'>, t: Pick<TrackState, 'standard_ids' | 'discipline'>): boolean {
  const stds = item.standard_ids ?? [];
  if (stds.length) return (t.standard_ids ?? []).some((s) => stds.includes(s));
  return !!item.discipline && (t.discipline ?? '') === item.discipline;
}

/** Computed readiness of one item from the instructor tracks (kafaa_lz_readiness). */
export function readiness(item: LocItem, tracks: TrackState[]): Readiness {
  const lines: InstructorLine[] = [];
  for (const t of [...tracks].sort((a, b) => cmp(a.id, b.id))) {
    if (!trackCovers(item, t)) continue;
    if (t.status === 'withdrawn' || t.status === 'declined') continue;
    if (t.status === 'qualified' || t.status === 'lapsed') {
      const ok = t.status === 'qualified' && t.currency !== null && t.currency !== 'lapsed';
      lines.push({ track_id: t.id, person_id: t.person_id, state: ok ? 'qualified' : 'lapsed', tenths: ok ? QUALIFIED_TENTHS : 0 });
      continue;
    }
    if (t.status !== 'active') continue;
    lines.push({ track_id: t.id, person_id: t.person_id, state: t.stage, tenths: STAGE_TENTHS[t.stage] ?? 0 });
  }
  const needed = Math.max(1, Math.trunc(Number(item.instructors_needed) || 0));
  const ready_now = lines.filter((l) => l.state === 'qualified').length;
  const lapsed = lines.filter((l) => l.state === 'lapsed').length;
  const pipeline = lines.filter((l) => l.state !== 'qualified' && l.state !== 'lapsed').length;
  const tenths = lines.reduce((a, l) => a + l.tenths, 0);
  const pct = Math.min(100, Math.floor((tenths * 10) / needed));
  return { needed, ready_now, pipeline, lapsed, tenths, pct, gap: Math.max(0, needed - ready_now), lines };
}

/** Risk and countdown for an item (kafaa_lz_risk). */
export function riskOf(item: Pick<LocItem, 'status' | 'target_on'>, r: Readiness, today: string): Risk {
  const days = daysBetween(today, item.target_on);
  const reasons: ReasonLite[] = [R('ready', { n: r.ready_now, need: r.needed })];
  if (r.pipeline > 0) reasons.push(R('pipeline', { n: r.pipeline }));
  if (r.lapsed > 0) reasons.push(R('lapsed', { n: r.lapsed }));
  reasons.push(R('pct', { pct: r.pct }));
  if (item.status === 'transferred') {
    const regressed = r.ready_now < r.needed;
    reasons.push(R(regressed ? 'regressed' : 'transferred'));
    return { level: 'done', overdue: false, days_left: days, regressed, reasons };
  }
  if (days < 0) {
    reasons.push(R('overdue', { days: -days }));
    return { level: 'overdue', overdue: true, days_left: days, regressed: false, reasons };
  }
  reasons.push(R('days', { days }));
  let level: RiskLevel = 'low';
  if ((r.pct < 50 && days <= LZ_DAYS.high50) || (r.pct < 80 && days <= LZ_DAYS.high80)) level = 'high';
  else if ((r.pct < 80 && days <= LZ_DAYS.medium80) || r.pct < 50 || item.status === 'on_hold') level = 'medium';
  if (item.status === 'on_hold') reasons.push(R('on_hold'));
  return { level, overdue: false, days_left: days, regressed: false, reasons };
}

export interface BoardItem { id: string; readiness: Readiness; risk: Risk }
export interface BoardSummary { items: number; transferred: number; overdue: number; high: number; medium: number; low: number; avg_pct: number; days_to_2030: number; by_year: { year: number; items: number; transferred: number }[] }
/** Readiness and risk for every item plus the summary tiles (kafaa_lz_compute). Items ordered by target date, then sort, then id. */
export function computeBoard(items: LocItem[], tracks: TrackState[], today: string): { items: BoardItem[]; summary: BoardSummary } {
  const ordered = [...items].sort((a, b) => cmp(a.target_on, b.target_on) || (Number(a.sort ?? 0) - Number(b.sort ?? 0)) || cmp(a.id, b.id));
  const out: BoardItem[] = ordered.map((it) => { const r = readiness(it, tracks); return { id: it.id, readiness: r, risk: riskOf(it, r, today) }; });
  const years = [...new Set(ordered.map((i) => Number(i.target_on.slice(0, 4))))].sort((a, b) => a - b);
  const summary: BoardSummary = {
    items: out.length,
    transferred: out.filter((x) => x.risk.level === 'done').length,
    overdue: out.filter((x) => x.risk.level === 'overdue').length,
    high: out.filter((x) => x.risk.level === 'high').length,
    medium: out.filter((x) => x.risk.level === 'medium').length,
    low: out.filter((x) => x.risk.level === 'low').length,
    avg_pct: out.length ? Math.floor(out.reduce((a, x) => a + x.readiness.pct, 0) / out.length) : 0,
    days_to_2030: daysBetween(today, TARGET_MAX),
    by_year: years.map((y) => ({ year: y, items: ordered.filter((i) => Number(i.target_on.slice(0, 4)) === y).length, transferred: ordered.filter((i) => Number(i.target_on.slice(0, 4)) === y && i.status === 'transferred').length })),
  };
  return { items: out, summary };
}

export interface StatusInput { status?: unknown; target_on?: unknown; note?: unknown }
export type StatusCode = 'ok' | 'status' | 'target' | 'unchanged' | 'note_long' | 'note_required' | 'not_ready';
/** Can the training manager set this status / target now? (kafaa_lz_status_problem) */
export function statusProblem(item: LocItem, x: StatusInput, r: Readiness): StatusCode {
  if (!(LOC_STATUSES as readonly unknown[]).includes(x.status)) return 'status';
  const target = x.target_on === undefined || x.target_on === null || x.target_on === '' ? item.target_on : x.target_on;
  if (!isIsoDay(target) || target > TARGET_MAX || target < item.baseline_on) return 'target';
  if (x.status === item.status && target === item.target_on) return 'unchanged';
  const note = typeof x.note === 'string' ? x.note.trim() : '';
  if (note.length > LZ_NOTE_MAX) return 'note_long';
  if ((target !== item.target_on || x.status === 'on_hold' || (item.status === 'transferred' && x.status !== 'transferred')) && note.length < 10) return 'note_required';
  if (x.status === 'transferred' && item.status !== 'transferred' && r.ready_now < r.needed) return 'not_ready';
  return 'ok';
}

/** Items past their target and not transferred, most overdue first: the F22 handover board panel (kafaa_lz_overdue). */
export function overdueOf(items: LocItem[], board: BoardItem[]): { id: string; days_overdue: number; pct: number }[] {
  const by = new Map(board.map((b) => [b.id, b]));
  return items.filter((i) => by.get(i.id)?.risk.overdue).map((i) => ({ id: i.id, days_overdue: -by.get(i.id)!.risk.days_left, pct: by.get(i.id)!.readiness.pct }))
    .sort((a, b) => b.days_overdue - a.days_overdue || cmp(a.id, b.id));
}
