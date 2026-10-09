/**
 * F31 Instructor and SME qualification pipeline (W4 · E5, module M02): pure rules shared by the pages, the LocalBackend
 * (src/modules/m02/backend/local.ts) and, line for line, the SQL in supabase/migrations/20261009145001_kafaa_w4e5_instructors.sql
 * (kafaa_ins_*). The PGlite validator (scripts/validate/w4e5-instructors.mjs) proves SQL = TS. Import-free: node scripts load it.
 *
 * Track: SME nomination -> accepted by the training manager -> instructor initial training (INSTR-101, or ASIP-101 on the ASIP route)
 *        -> two co-teach observations -> one solo observed delivery -> ready -> qualified (maker-checker, training manager)
 *        -> annual currency (teaching hours and continuing development in each 12-month window from the qualification date).
 * Observation forms reuse the F25 L3 mechanics: a checklist of observable behaviours tied to the course objectives, rated
 * met / partly / not met, with critical items; the record carries the observer, the date and the items.
 */

export const INS_ROUTES = ['sme', 'asip'] as const;
export type InsRoute = (typeof INS_ROUTES)[number];
export const STAGES = ['nominated', 'initial_training', 'co_teach', 'solo', 'ready', 'qualified'] as const;
export type Stage = (typeof STAGES)[number];
export const TRACK_STATUSES = ['active', 'qualified', 'lapsed', 'withdrawn', 'declined'] as const;
export type TrackStatus = (typeof TRACK_STATUSES)[number];
export const OBS_KINDS = ['co_teach', 'solo', 'currency'] as const;
export type ObsKind = (typeof OBS_KINDS)[number];
export const RATINGS = ['met', 'partly', 'not_met'] as const;
export type Rating = (typeof RATINGS)[number];
export const HOUR_KINDS = ['delivery', 'cpd'] as const;
export type HourKind = (typeof HOUR_KINDS)[number];
export const CURRENCY_STATUSES = ['current', 'due', 'at_risk', 'lapsed'] as const;
export type CurrencyStatus = (typeof CURRENCY_STATUSES)[number];

/** Initial-training course per route (both already in the M04 catalogue: INSTR-101 and ASIP-101). */
export const INITIAL_COURSE: Record<InsRoute, string> = { sme: 'c-instr', asip: 'c-asip' };
/** F01 skill that a qualified instructor holds as `credential` evidence (lapsed with the currency). */
export const INSTRUCT_SKILL = 'sk-ld-01-instruct';
export const INSTRUCT_LEVEL = 3;
/** Job families that are career-path only (security, cyber, safeguards): never on the instructor track. */
export const RESTRICTED_FAMILIES = ['security', 'cyber', 'safeguards'];

/**
 * Demo rules (SAMPLE settings, not ENEC or FANR figures): currency needs 40 delivery hours and 8 hours of continuing development in
 * every 12-month window counted from the (re)qualification date; observations pass at 75 % with no critical item "not met".
 */
export const INS_RULES = { minDeliveryHours: 40, minCpdHours: 8, passScore: 75, coTeachNeeded: 2, noticeDays: [90, 60, 30], maxEntryHours: 12, maxStandards: 3, maxSkills: 6, maxText: 600 } as const;

export interface ObsItemDef {
  key: string;
  critical: boolean;
  en: string;
  ar: string;
}
/** The observation checklist (F25 L3-style): eight observable behaviours; three are critical. */
export const OBS_ITEMS: ObsItemDef[] = [
  { key: 'objectives', critical: false, en: 'States the learning objectives and links them to the task or qualification standard', ar: 'يحدد أهداف التعلم ويربطها بالمهمة أو بمعيار التأهيل' },
  { key: 'accuracy', critical: true, en: 'Technical content is accurate and matches current procedures', ar: 'المحتوى الفني دقيق ومطابق للإجراءات المعمول بها' },
  { key: 'safety', critical: true, en: 'Models safety and human-performance standards (procedure use, STAR, three-way communication)', ar: 'يجسّد معايير السلامة والأداء البشري (الالتزام بالإجراءات، STAR، التواصل الثلاثي)' },
  { key: 'engagement', critical: false, en: 'Engages learners with questions and checks understanding', ar: 'يشرك المتعلمين بالأسئلة ويتحقق من الفهم' },
  { key: 'oe', critical: false, en: 'Uses operating experience and plant examples', ar: 'يستخدم الخبرة التشغيلية وأمثلة من المحطة' },
  { key: 'assessment', critical: true, en: 'Assesses learning against the objectives (performance-based)', ar: 'يقيّم التعلم مقابل الأهداف (قائم على الأداء)' },
  { key: 'feedback', critical: false, en: 'Gives clear, specific feedback', ar: 'يقدّم ملاحظات واضحة ومحددة' },
  { key: 'time', critical: false, en: 'Manages time and the learning environment', ar: 'يدير الوقت وبيئة التعلم' },
];
export const OBS_KEYS = OBS_ITEMS.map((i) => i.key);

/** User-facing refusal messages: identical in the LocalBackend and the SQL functions. */
export const INSMSG = {
  not_signed_in: 'Sign in to use the instructor pipeline',
  nominate_forbidden: 'You can volunteer yourself; line managers nominate people in their team and the training manager nominates anyone',
  not_found_person: 'Person not found',
  not_staff: 'Only ENEC staff can join the instructor track',
  restricted: 'Security, cyber and safeguards roles are career-path only and cannot join the instructor track',
  invalid_nomination: 'Choose a route, one to three current qualification standards (never security), up to six catalogue skills and a motivation under 600 characters',
  already_active: 'This person already has an open or qualified instructor track',
  asip_needs_sro: 'The ASIP route is for holders of a valid SRO licence (mirror)',
  decide_forbidden: 'Only the training manager decides nominations',
  not_found_track: 'Instructor track not found',
  own_track: 'You cannot decide or qualify your own instructor track',
  not_nominated: 'This nomination has already been decided',
  invalid_decision: 'Choose accept or decline; a decline needs a reason of at least 5 characters',
  observe_forbidden: 'Only instructors and the training manager record observations',
  self_observation: 'An observer cannot observe themselves',
  invalid_observation: 'Rate all eight checklist items (met, partly or not met), give an observation date that is not in the future and keep the note under 600 characters',
  not_active: 'This instructor track is closed',
  needs_acceptance: 'The training manager has not accepted this nomination yet',
  needs_initial: 'Complete the instructor initial training course before co-teach observations',
  needs_co_teach: 'A solo observation needs two passed co-teach observations by different observers first',
  co_teach_done: 'Co-teach and solo observations are complete; currency observations start after qualification',
  currency_only: 'This instructor is qualified: record a currency observation instead',
  before_acceptance: 'The observation date is before the nomination was accepted',
  qualify_forbidden: 'Only the training manager qualifies instructors',
  not_ready: 'Qualification needs two co-teach observations and one solo observation, all passed and by three different observers',
  maker_checker: 'You observed this candidate: another training manager must qualify them (maker-checker)',
  needs_currency_obs: 'Reinstatement needs a passed currency observation after the lapse, by another observer',
  already_qualified: 'This instructor is already qualified',
  sweep_forbidden: 'Only the training manager runs the currency sweep',
  hours_forbidden: 'You can log your own continuing development; the training manager logs delivery hours for anyone on the track',
  invalid_hours: 'Give 0.5 to 12 hours in half-hour steps, a date in the last 12 months that is not in the future and a note under 600 characters',
  no_track: 'This person has no qualified or open instructor track',
  sync_forbidden: 'You can sync your own teaching hours; the training manager syncs everyone',
  withdraw_forbidden: 'Only the person or the training manager can close this track',
  already_closed: 'This instructor track is already closed',
  invalid_withdraw: 'Give a reason of 5 to 600 characters',
} as const;

export interface Refusal {
  code: string;
  message: string;
}
const refuse = (code: string, message: string): Refusal => ({ code, message });

// ───────────── dates (UTC calendar days, like SQL date arithmetic)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
/** SQL `(d + make_interval(months => n))::date`: the day is clamped to the end of the target month. */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = m - 1 + n;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ny, nm, Math.min(d, last))).toISOString().slice(0, 10);
}
export function daysFrom(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
export function addDays(iso: string, n: number): string {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
const r1 = (x: number) => Math.round(x * 10) / 10;
const textLen = (v: unknown) => (typeof v === 'string' ? v.trim().length : -1);

// ───────────── rows
export interface TrackRow {
  id: string;
  person_id: string;
  person_name?: string;
  person_name_ar?: string;
  route: InsRoute | string;
  discipline?: string;
  standard_ids: string[];
  skill_ids?: string[];
  stage: Stage | string;
  status: TrackStatus | string;
  started_on: string;
  nominated_by?: string | null;
  nomination_kind?: string;
  motivation?: string | null;
  accepted_on?: string | null;
  accepted_by?: string | null;
  initial_done_on?: string | null;
  qualified_on?: string | null;
  first_qualified_on?: string | null;
  qualified_by?: string | null;
  currency_due?: string | null;
  currency_status?: string | null;
  lapsed_on?: string | null;
  decision_note?: string | null;
}
export interface ObsRow {
  id: string;
  track_id: string;
  person_id?: string;
  observer_person_id: string;
  observer_name?: string;
  observer_name_ar?: string;
  kind: ObsKind | string;
  observed_on: string;
  items: { key: string; rating: string }[] | unknown;
  score: number;
  result: 'pass' | 'fail' | string;
  session_id?: string | null;
  course_id?: string | null;
  note?: string | null;
}
export interface HoursRow {
  id?: string;
  person_id: string;
  kind: HourKind | string;
  delivered_on: string;
  hours: number;
  source?: string;
  session_id?: string | null;
  course_id?: string | null;
}

// ───────────── observation checklist
export interface ObsScore {
  score: number;
  result: 'pass' | 'fail';
  critical_failed: string[];
}
/** Score = met 2, partly 1, not met 0 over the eight items, as a percentage (rounded); pass needs >= 75 and no critical item "not met". */
export function scoreObservation(items: { key: string; rating: string }[]): ObsScore {
  const by = new Map(items.map((i) => [i.key, i.rating]));
  let pts = 0;
  for (const k of OBS_KEYS) pts += by.get(k) === 'met' ? 2 : by.get(k) === 'partly' ? 1 : 0;
  const score = Math.round((pts * 100) / (2 * OBS_KEYS.length));
  const critical_failed = OBS_ITEMS.filter((i) => i.critical && by.get(i.key) === 'not_met').map((i) => i.key);
  return { score, result: score >= INS_RULES.passScore && critical_failed.length === 0 ? 'pass' : 'fail', critical_failed };
}

export interface ObservationInput {
  track_id: string;
  kind: ObsKind | string;
  observed_on: string;
  items: { key: string; rating: string }[];
  session_id?: string | null;
  course_id?: string | null;
  note?: string | null;
}
/** Shape checks (kafaa_ins_validate_obs): the kind, every checklist key exactly once with a valid rating, a past date, a short note. */
export function validateObservation(p: Partial<ObservationInput> | Record<string, unknown>, today: string): Refusal | null {
  const x = p as Record<string, unknown>;
  const items = x.items;
  const bad = refuse('invalid', INSMSG.invalid_observation);
  if (typeof x.kind !== 'string' || !(OBS_KINDS as readonly string[]).includes(x.kind)) return bad;
  if (!Array.isArray(items) || items.length !== OBS_KEYS.length) return bad;
  const seen = new Set<string>();
  for (const it of items as unknown[]) {
    if (!it || typeof it !== 'object' || Array.isArray(it)) return bad;
    const k = (it as Record<string, unknown>).key;
    const r = (it as Record<string, unknown>).rating;
    if (typeof k !== 'string' || !OBS_KEYS.includes(k) || seen.has(k) || typeof r !== 'string' || !(RATINGS as readonly string[]).includes(r)) return bad;
    seen.add(k);
  }
  if (!isIsoDate(x.observed_on) || (x.observed_on as string) > today || (x.observed_on as string) < addMonths(today, -24)) return bad;
  if (x.note != null && (typeof x.note !== 'string' || textLen(x.note) > INS_RULES.maxText)) return bad;
  return null;
}

// ───────────── nomination
export interface NominationInput {
  person_id: string;
  route: InsRoute | string;
  standard_ids: string[];
  skill_ids?: string[];
  motivation?: string | null;
}
export interface StdLite {
  id: string;
  status: string;
  security_restricted?: boolean | null;
  discipline?: string;
}
export interface SkillLite {
  id: string;
  area?: string;
  evidence_keys?: string[] | null;
}
/** kafaa_ins_validate_nomination: route, 1-3 distinct current standards, up to 6 distinct catalogue skills, motivation length; security never. */
export function validateNomination(p: Partial<NominationInput> | Record<string, unknown>, stds: StdLite[], skills: SkillLite[]): Refusal | null {
  const x = p as Record<string, unknown>;
  const bad = refuse('invalid', INSMSG.invalid_nomination);
  const sids = x.standard_ids;
  const kids = x.skill_ids == null ? [] : x.skill_ids;
  if (typeof x.route !== 'string' || !(INS_ROUTES as readonly string[]).includes(x.route)) return bad;
  if (!Array.isArray(sids) || sids.length < 1 || sids.length > INS_RULES.maxStandards || new Set(sids).size !== sids.length || sids.some((s) => typeof s !== 'string')) return bad;
  if (!Array.isArray(kids) || kids.length > INS_RULES.maxSkills || new Set(kids).size !== kids.length || kids.some((s) => typeof s !== 'string')) return bad;
  const byStd = new Map(stds.map((s) => [s.id, s]));
  const bySkill = new Map(skills.map((s) => [s.id, s]));
  if ((sids as string[]).some((s) => byStd.get(s)?.security_restricted) || (kids as string[]).some((k) => bySkill.get(k)?.area === 'security')) return refuse('security_restricted', INSMSG.restricted);
  if ((sids as string[]).some((s) => byStd.get(s)?.status !== 'current') || (kids as string[]).some((k) => !bySkill.has(k))) return bad;
  if (x.motivation != null && (typeof x.motivation !== 'string' || textLen(x.motivation) > INS_RULES.maxText)) return bad;
  return null;
}
/** The skills a standard evidences (F01 `evidence_keys`), never security-area skills: the default subject-matter skills of a track. */
export function standardSkills(stdIds: string[], skills: SkillLite[]): string[] {
  return skills.filter((k) => k.area !== 'security' && (k.evidence_keys ?? []).some((e) => stdIds.includes(e))).map((k) => k.id).sort();
}

// ───────────── observation sets and stages
const obsKey = (o: ObsRow) => `${o.observed_on}|${o.id}`;
const sorted = (xs: ObsRow[]) => [...xs].sort((a, b) => (obsKey(a) < obsKey(b) ? -1 : obsKey(a) > obsKey(b) ? 1 : 0));
const passed = (obs: ObsRow[], kind: string, exclude?: string | null) => sorted(obs.filter((o) => o.kind === kind && o.result === 'pass' && (!exclude || o.observer_person_id !== exclude)));

/** First pair (by date, id) of passed co-teach observations by two different observers (kafaa_ins_co_pair). */
export function coTeachPair(obs: ObsRow[], exclude?: string | null): [ObsRow, ObsRow] | null {
  const co = passed(obs, 'co_teach', exclude);
  for (let i = 0; i < co.length; i++) for (let j = i + 1; j < co.length; j++) if (co[i].observer_person_id !== co[j].observer_person_id) return [co[i], co[j]];
  return null;
}
/** The qualifying set (kafaa_ins_qual_set): two passed co-teach and one passed solo observation by three different observers. */
export function qualifyingSet(obs: ObsRow[], exclude?: string | null): { co: [ObsRow, ObsRow]; solo: ObsRow } | null {
  const co = passed(obs, 'co_teach', exclude);
  const solo = passed(obs, 'solo', exclude);
  for (let i = 0; i < co.length; i++)
    for (let j = i + 1; j < co.length; j++) {
      if (co[i].observer_person_id === co[j].observer_person_id) continue;
      for (const s of solo) if (s.observer_person_id !== co[i].observer_person_id && s.observer_person_id !== co[j].observer_person_id) return { co: [co[i], co[j]], solo: s };
    }
  return null;
}
/** Passed currency observation on or after the lapse date, by someone other than `exclude` (reinstatement). */
export function reinstateObservation(obs: ObsRow[], lapsedOn: string | null | undefined, exclude?: string | null): ObsRow | null {
  if (!lapsedOn) return null;
  return passed(obs, 'currency', exclude).find((o) => o.observed_on >= lapsedOn) ?? null;
}

/** The stage of a track from its data (kafaa_ins_stage). Closed tracks keep their stored stage. */
export function deriveStage(t: Pick<TrackRow, 'status' | 'stage' | 'accepted_on'>, obs: ObsRow[], initialDoneOn: string | null | undefined): Stage {
  if (t.status === 'withdrawn' || t.status === 'declined') return (STAGES as readonly string[]).includes(t.stage) ? (t.stage as Stage) : 'nominated';
  if (t.status === 'qualified' || t.status === 'lapsed') return 'qualified';
  if (!t.accepted_on) return 'nominated';
  if (!initialDoneOn) return 'initial_training';
  if (!coTeachPair(obs)) return 'co_teach';
  if (!qualifyingSet(obs)) return 'solo';
  return 'ready';
}
/** Date the person completed the route's initial course (training_records completed/passed), or null (kafaa_ins_initial_done). */
export function initialDoneOn(personId: string, route: string, records: { person_id: string; course_id: string; completed_on: string; result: string }[]): string | null {
  const course = INITIAL_COURSE[route as InsRoute];
  const ds = records.filter((r) => r.person_id === personId && r.course_id === course && (r.result === 'completed' || r.result === 'passed')).map((r) => r.completed_on).sort();
  return ds[0] ?? null;
}
/** Which observation kind a track needs next (or null): the "observe" queue. */
export function nextObservation(stage: Stage, status: string): ObsKind | null {
  if (status === 'qualified' || status === 'lapsed') return 'currency';
  if (status !== 'active') return null;
  return stage === 'co_teach' ? 'co_teach' : stage === 'solo' ? 'solo' : null;
}
/** Can this observation kind be recorded on the track now? (kafaa_ins_obs_gate) Returns a refusal or null. */
export function observationGate(t: Pick<TrackRow, 'status' | 'accepted_on'>, kind: string, obs: ObsRow[], initialDone: string | null, observedOn: string): Refusal | null {
  if (t.status === 'withdrawn' || t.status === 'declined') return refuse('not_active', INSMSG.not_active);
  if (t.status === 'qualified' || t.status === 'lapsed') return kind === 'currency' ? null : refuse('wrong_stage', INSMSG.currency_only);
  if (kind === 'currency') return refuse('wrong_stage', INSMSG.co_teach_done);
  if (!t.accepted_on) return refuse('wrong_stage', INSMSG.needs_acceptance);
  if (observedOn < t.accepted_on) return refuse('invalid', INSMSG.before_acceptance);
  if (!initialDone) return refuse('wrong_stage', INSMSG.needs_initial);
  if (kind === 'solo' && !coTeachPair(obs)) return refuse('wrong_stage', INSMSG.needs_co_teach);
  if (qualifyingSet(obs)) return refuse('wrong_stage', INSMSG.co_teach_done);
  return null;
}

// ───────────── currency
export interface CurrencyView {
  status: CurrencyStatus;
  due: string;
  window_start: string;
  hours: number;
  cpd: number;
  days: number;
  met: boolean;
  notice: 90 | 60 | 30 | null;
  renewals: number;
  lapsed_on: string | null;
  short_hours: number;
  short_cpd: number;
}
const sumIn = (hours: HoursRow[], kind: string, from: string, toExcl: string) => r1(hours.filter((h) => h.kind === kind && h.delivered_on >= from && h.delivered_on < toExcl).reduce((a, h) => a + Number(h.hours), 0));

/**
 * Annual currency (kafaa_ins_currency). Window k runs [q + 12(k-1) months, q + 12k months) from the (re)qualification date q.
 * A window that has ended with fewer than 40 delivery hours or 8 hours of continuing development lapses the instructor on its end
 * date; a stored lapse (track status `lapsed`) stays until reinstatement. In the current window: met -> current; not met -> at_risk
 * within 30 days of the due date, due within 90 days (notices at 90, 60 and 30 days, as qualView), otherwise current.
 */
export function currencyView(t: Pick<TrackRow, 'status' | 'qualified_on' | 'lapsed_on' | 'currency_due'>, hours: HoursRow[], today: string): CurrencyView | null {
  if ((t.status !== 'qualified' && t.status !== 'lapsed') || !t.qualified_on) return null;
  const q = t.qualified_on;
  const min = INS_RULES.minDeliveryHours;
  const minC = INS_RULES.minCpdHours;
  if (t.status === 'lapsed') {
    const at = t.lapsed_on ?? t.currency_due ?? today;
    let k = 1;
    while (k < 60 && addMonths(q, 12 * k) < at) k++;
    const start = addMonths(q, 12 * (k - 1));
    const h = sumIn(hours, 'delivery', start, at);
    const c = sumIn(hours, 'cpd', start, at);
    return { status: 'lapsed', due: at, window_start: start, hours: h, cpd: c, days: daysFrom(today, at), met: false, notice: null, renewals: k - 1, lapsed_on: at, short_hours: r1(Math.max(0, min - h)), short_cpd: r1(Math.max(0, minC - c)) };
  }
  let k = 1;
  for (; k < 60; k++) {
    const end = addMonths(q, 12 * k);
    const start = addMonths(q, 12 * (k - 1));
    if (end > today) {
      const nextDay = addDays(today, 1);
      const h = sumIn(hours, 'delivery', start, nextDay);
      const c = sumIn(hours, 'cpd', start, nextDay);
      const days = daysFrom(today, end);
      const met = h >= min && c >= minC;
      const notice = met ? null : days <= 30 ? 30 : days <= 60 ? 60 : days <= 90 ? 90 : null;
      const status: CurrencyStatus = met ? 'current' : days <= 30 ? 'at_risk' : days <= 90 ? 'due' : 'current';
      return { status, due: end, window_start: start, hours: h, cpd: c, days, met, notice: notice as CurrencyView['notice'], renewals: k - 1, lapsed_on: null, short_hours: r1(Math.max(0, min - h)), short_cpd: r1(Math.max(0, minC - c)) };
    }
    const h = sumIn(hours, 'delivery', start, end);
    const c = sumIn(hours, 'cpd', start, end);
    if (h < min || c < minC) return { status: 'lapsed', due: end, window_start: start, hours: h, cpd: c, days: daysFrom(today, end), met: false, notice: null, renewals: k - 1, lapsed_on: end, short_hours: r1(Math.max(0, min - h)), short_cpd: r1(Math.max(0, minC - c)) };
  }
  return null;
}

/** Monthly delivery hours over the last 12 months (oldest first) for charts: [{ month: 'YYYY-MM', delivery, cpd }]. */
export function monthlyHours(hours: HoursRow[], today: string): { month: string; delivery: number; cpd: number }[] {
  const out: { month: string; delivery: number; cpd: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = addMonths(`${today.slice(0, 7)}-01`, -i).slice(0, 7);
    const rows = hours.filter((h) => h.delivered_on.slice(0, 7) === m);
    out.push({ month: m, delivery: r1(rows.filter((h) => h.kind === 'delivery').reduce((a, h) => a + Number(h.hours), 0)), cpd: r1(rows.filter((h) => h.kind === 'cpd').reduce((a, h) => a + Number(h.hours), 0)) });
  }
  return out;
}

// ───────────── hours log
export interface HoursInput {
  person_id: string;
  kind: HourKind | string;
  hours: number;
  delivered_on: string;
  course_id?: string | null;
  note?: string | null;
}
/** kafaa_ins_validate_hours: kind, 0.5-12 hours in half-hour steps, a date in the last 12 months that is not in the future, a short note. */
export function validateHours(p: Partial<HoursInput> | Record<string, unknown>, today: string): Refusal | null {
  const x = p as Record<string, unknown>;
  const bad = refuse('invalid', INSMSG.invalid_hours);
  if (typeof x.kind !== 'string' || !(HOUR_KINDS as readonly string[]).includes(x.kind)) return bad;
  if (typeof x.hours !== 'number' || !Number.isFinite(x.hours) || x.hours < 0.5 || x.hours > INS_RULES.maxEntryHours || Math.round(x.hours * 2) !== x.hours * 2) return bad;
  if (!isIsoDate(x.delivered_on) || (x.delivered_on as string) > today || (x.delivered_on as string) < addMonths(today, -12)) return bad;
  if (x.note != null && (typeof x.note !== 'string' || textLen(x.note) > INS_RULES.maxText)) return bad;
  return null;
}
/** Teaching hours of a delivered M04 session (fed by attendance): duration rounded to the nearest half hour, capped at 12 (kafaa_ins_session_hours). */
export function sessionHours(startsAt: string, endsAt: string): number {
  const h = (Date.parse(endsAt) - Date.parse(startsAt)) / 3_600_000;
  if (!Number.isFinite(h) || h <= 0) return 0;
  return Math.min(INS_RULES.maxEntryHours, Math.round(h * 2) / 2);
}

// ───────────── pool summary (the board)
export interface PoolSummary {
  qualified: number;
  current: number;
  due: number;
  at_risk: number;
  lapsed: number;
  pipeline: Record<'nominated' | 'initial_training' | 'co_teach' | 'solo' | 'ready', number>;
}
export function poolSummary(rows: { status: string; stage: Stage; currency: CurrencyView | null }[]): PoolSummary {
  const s: PoolSummary = { qualified: 0, current: 0, due: 0, at_risk: 0, lapsed: 0, pipeline: { nominated: 0, initial_training: 0, co_teach: 0, solo: 0, ready: 0 } };
  for (const r of rows) {
    if (r.currency) {
      if (r.currency.status === 'lapsed') s.lapsed++;
      else {
        s.qualified++;
        s[r.currency.status]++;
      }
    } else if (r.status === 'active' && r.stage in s.pipeline) s.pipeline[r.stage as keyof PoolSummary['pipeline']]++;
  }
  return s;
}
