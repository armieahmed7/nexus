/**
 * F23 Alumni and expert reserve (W3 · E4): pure rules shared by the LocalBackend (backend/reserve.local.ts), the seed builder
 * (scripts/seed/ext/f23-reserve.mjs), the pages and the tests. Import-free (node loads it directly).
 * SQL mirror: supabase/migrations/20261009134001_kafaa_w3e4_reserve.sql (kafaa_res_*). Same checks in the same order, the same
 * refusal codes and messages: change both together.
 *
 * The reserve is opt-in. A member is a synthetic person of kind `alumni` (departed ENEC staff), `partner_alumni` (an ended
 * KHNP or partner secondment) or `pre_departure` (staff who consent now and join the active reserve when they leave). The
 * skill snapshot is frozen from the F01 skill state at departure (or at the moment of consent). Kafa'a stores no contract,
 * no payment and no contact data: an approved engagement is simply "handed to HR".
 */

export const MEMBER_KINDS = ['alumni', 'partner_alumni', 'pre_departure'] as const;
export type MemberKind = (typeof MEMBER_KINDS)[number];
export const ENGAGEMENTS = ['mentor', 'capture_interview', 'instructor', 'reviewer'] as const;
export type Engagement = (typeof ENGAGEMENTS)[number];
export const AVAILABILITY = ['open', 'limited', 'outage_only', 'paused'] as const;
export type Availability = (typeof AVAILABILITY)[number];
export const BANDS = ['departing', 'lt_1y', 'y1_3', 'y3_5', 'gt_5y'] as const;
export type Band = (typeof BANDS)[number];
export const DEPARTURE_REASONS = ['retired', 'secondment_ended', 'moved_on', 'planned'] as const;
export const REQ_STATUSES = ['pending_hr', 'open', 'filled', 'closed', 'declined'] as const;
export type ReqStatus = (typeof REQ_STATUSES)[number];
export const ENG_STATUSES = ['invited', 'interested', 'handed_to_hr', 'declined', 'withdrawn', 'completed'] as const;
export type EngStatus = (typeof ENG_STATUSES)[number];
export const RES_LOCATIONS = ['remote', 'office', 'site_non_protected'] as const;
/** Statuses that count as a live or finished engagement (a second one for the same request is refused). */
export const BLOCKING_ENG: EngStatus[] = ['invited', 'interested', 'handed_to_hr', 'completed', 'declined'];
/** Open engagements that a consent withdrawal ends. */
export const OPEN_ENG: EngStatus[] = ['invited', 'interested', 'handed_to_hr'];
export const HR_ROLES = ['hr_analyst', 'hr_director'] as const;
export const RESTRICTED_FAMILIES = ['security', 'cyber', 'safeguards'];
export const RESTRICTED_SKILL_AREAS = ['security'];
export const RESTRICTED_LOCATIONS = ['protected_area'];
/** Withdrawal schedules erasure after six months, as M06 applications do. */
export const ERASE_AFTER_MONTHS = 6;
export const SNAPSHOT_MAX = 12;
export const MIN_GROUP = 10;
/** Email addresses and phone numbers (international, UAE mobile and landline). The same pattern is used by the SQL functions. */
export const CONTACT_PATTERN = '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}|(\\+|00)[0-9][0-9 -]{7,}[0-9]|(^|[^0-9])0[2-9][0-9]?[ -]?[0-9]{3}[ -]?[0-9]{4}([^0-9]|$)';
const CONTACT_RE = new RegExp(CONTACT_PATTERN);
export const hasContactData = (...texts: (string | null | undefined)[]) => texts.some((s) => typeof s === 'string' && CONTACT_RE.test(s));

export const ALMSG = {
  not_signed_in: 'Sign in to use the alumni and expert reserve',
  forbidden_join: 'Only staff can join the expert reserve',
  restricted_join: 'Security, cyber and safeguards roles are career-path only and cannot join the expert reserve',
  invalid_join: 'Choose an availability, 0 to 40 hours a month and one to four engagement types; keep each headline under 160 characters',
  contact_data: "Do not include contact details (email addresses or phone numbers): HR arranges contact outside Kafa'a",
  not_member: 'You are not an active member of the expert reserve',
  forbidden_request: 'Only managers and the training manager can request support from the reserve',
  restricted_request: 'Security, cyber, safeguards and protected-area work cannot be requested from the reserve',
  invalid_request: 'Give an English and an Arabic title (5 to 120 characters) and summary (20 to 1,000 characters), one to six catalogue skills, 1 to 120 hours, 1 to 3 places, a start date from today and an end date within 12 months',
  request_not_found: 'Reserve request not found',
  invalid_decision: 'Unknown decision',
  forbidden_hr: 'Only HR (the HR analyst or the CHCO office) decides reserve requests and engagements',
  maker_checker: 'You cannot approve a reserve request or engagement that you raised or that involves you',
  not_pending: 'This request is not waiting for HR approval',
  decline_reason: 'Give a reason of at least 5 characters',
  forbidden_close: 'Only the requesting manager or HR can close this request',
  not_open: 'This request is not open to the reserve',
  own_request: 'You cannot take part in your own reserve request',
  invalid_note: 'Keep the note under 500 characters',
  already_engaged: 'There is already an engagement for this alumnus on this request',
  member_not_found: 'Alumnus not found or no longer in the reserve',
  eng_not_found: 'Engagement not found',
  invalid_transition: 'That engagement change is not allowed',
  no_seats: 'All places on this request are filled',
  forbidden_complete: 'Only the requesting manager or HR can confirm the outcome',
  outcome_note: 'Describe the outcome in at least one sentence',
  forbidden_withdraw: 'Only the alumnus can withdraw from an engagement',
} as const;

export interface JoinInput {
  consent: boolean;
  availability?: string;
  hours_month?: number;
  engagement_prefs?: string[];
  finder_optin?: boolean;
  headline_en?: string | null;
  headline_ar?: string | null;
}
export interface RequestInput {
  engagement: string;
  title_en: string; title_ar: string; summary_en: string; summary_ar: string;
  skills_needed: string[];
  hours_total: number;
  seats?: number;
  location_type: string;
  start_on: string; end_on: string;
}
export interface SnapshotSkill { skill_id: string; level: number; basis: string }
export interface Refusal { code: string; message: string }

const isInt = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const len = (s: unknown) => (typeof s === 'string' ? s.trim().length : -1);
const DAY = 86_400_000;
export const dayNo = (d: string) => Math.floor(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / DAY);
export const isDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
/** SQL `date + make_interval(months => n)`: the day is clamped to the end of the target month. */
export function addMonths(d: string, n: number): string {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  const idx = y * 12 + (m - 1) + n;
  const ty = Math.floor(idx / 12);
  const tm = idx - ty * 12;
  const dim = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return `${String(ty).padStart(4, '0')}-${String(tm + 1).padStart(2, '0')}-${String(Math.min(day, dim)).padStart(2, '0')}`;
}

/** Time since departure: departing (not yet left), under a year, 1-3, 3-5 or more than 5 years (365-day years, like SQL date - date). */
export function bandOf(departedOn: string | null | undefined, today: string): Band {
  if (!departedOn) return 'departing';
  const d = dayNo(today) - dayNo(departedOn);
  if (d < 0) return 'departing';
  if (d < 365) return 'lt_1y';
  if (d < 1095) return 'y1_3';
  if (d < 1825) return 'y3_5';
  return 'gt_5y';
}

/** The HR role a caller acts in for reserve approvals (first alphabetically), or null. */
export function hrRoleOf(roles: readonly string[]): string | null {
  return [...HR_ROLES].sort().find((r) => roles.includes(r)) ?? null;
}

/** Consent form checks (joinReserve with consent = true). */
export function validateJoin(p: JoinInput): Refusal | null {
  const prefs = p.engagement_prefs;
  if (!AVAILABILITY.includes(p.availability as Availability) || !isInt(p.hours_month, 0, 40)
    || !Array.isArray(prefs) || prefs.length < 1 || prefs.length > 4 || new Set(prefs).size !== prefs.length || prefs.some((x) => !ENGAGEMENTS.includes(x as Engagement))
    || (p.finder_optin != null && typeof p.finder_optin !== 'boolean')
    || (p.headline_en != null && (typeof p.headline_en !== 'string' || p.headline_en.trim().length > 160))
    || (p.headline_ar != null && (typeof p.headline_ar !== 'string' || p.headline_ar.trim().length > 160)))
    return { code: 'invalid', message: ALMSG.invalid_join };
  if (hasContactData(p.headline_en, p.headline_ar)) return { code: 'contact_data', message: ALMSG.contact_data };
  return null;
}

/** Reserve request checks (requestReserve). skills: the catalogue (id, area). */
export function validateRequest(p: RequestInput, skills: { id: string; area: string }[], today: string): Refusal | null {
  const area = new Map(skills.map((s) => [s.id, s.area]));
  const sk = Array.isArray(p?.skills_needed) ? p.skills_needed : [];
  if (RESTRICTED_LOCATIONS.includes(p?.location_type) || sk.some((id) => RESTRICTED_SKILL_AREAS.includes(area.get(id) ?? '')))
    return { code: 'restricted_kind', message: ALMSG.restricted_request };
  const seats = p?.seats ?? 1;
  if (!ENGAGEMENTS.includes(p?.engagement as Engagement) || !RES_LOCATIONS.includes(p?.location_type as (typeof RES_LOCATIONS)[number])
    || len(p.title_en) < 5 || len(p.title_en) > 120 || len(p.title_ar) < 5 || len(p.title_ar) > 120
    || len(p.summary_en) < 20 || len(p.summary_en) > 1000 || len(p.summary_ar) < 20 || len(p.summary_ar) > 1000
    || !Array.isArray(p.skills_needed) || sk.length < 1 || sk.length > 6 || new Set(sk).size !== sk.length || sk.some((id) => typeof id !== 'string' || !area.has(id))
    || !isInt(p.hours_total, 1, 120) || !isInt(seats, 1, 3)
    || !isDate(p.start_on) || !isDate(p.end_on) || p.start_on < today || p.end_on < p.start_on || p.end_on > addMonths(p.start_on, 12))
    return { code: 'invalid', message: ALMSG.invalid_request };
  if (hasContactData(p.title_en, p.title_ar, p.summary_en, p.summary_ar)) return { code: 'contact_data', message: ALMSG.contact_data };
  return null;
}

/** Freeze the F01 skill state: active, level 1+, never a security-area skill; strongest first, at most 12. */
export function snapshotFrom(states: { skill_id: string; level: number; basis: string; active?: boolean | null }[], skills: { id: string; area: string }[]): SnapshotSkill[] {
  const area = new Map(skills.map((s) => [s.id, s.area]));
  return states
    .filter((s) => s.active !== false && s.level >= 1 && area.has(s.skill_id) && !RESTRICTED_SKILL_AREAS.includes(area.get(s.skill_id)!))
    .map((s) => ({ skill_id: s.skill_id, level: s.level, basis: s.basis }))
    .sort((a, b) => b.level - a.level || (a.skill_id < b.skill_id ? -1 : a.skill_id > b.skill_id ? 1 : 0))
    .slice(0, SNAPSHOT_MAX);
}

/** Request counters after any engagement change: expressions of interest, places taken and open/filled. */
export function recount(req: { status: string; seats: number }, engs: { status: string }[]) {
  const interest = engs.filter((e) => ['interested', 'handed_to_hr', 'completed'].includes(e.status)).length;
  const taken = engs.filter((e) => ['handed_to_hr', 'completed'].includes(e.status)).length;
  const status = req.status === 'open' || req.status === 'filled' ? (taken >= req.seats ? 'filled' : 'open') : req.status;
  return { interest_count: interest, seats_taken: taken, status };
}

export const ENG_TRANSITIONS: Record<string, { from: EngStatus[]; to: EngStatus }> = {
  approve: { from: ['interested'], to: 'handed_to_hr' },
  decline: { from: ['invited', 'interested'], to: 'declined' },
  complete: { from: ['handed_to_hr'], to: 'completed' },
  withdraw: { from: ['invited', 'interested', 'handed_to_hr'], to: 'withdrawn' },
};

// ───────────── Read models (both backends return the same shapes)
export interface MemberRow {
  id: string; person_id: string | null; kind: string; name: string; name_ar: string; former_role_id: string | null; former_family_id: string | null; former_org: string | null;
  departed_on: string | null; departure_reason: string; departed_band: string; years_service: number | null; skill_snapshot: unknown; snapshot_on: string;
  availability: string; hours_month: number; engagement_prefs: string[]; finder_optin: boolean; finder_visible: boolean; headline_en: string | null; headline_ar: string | null;
  consent_on: string | null; status: string; withdrawn_on: string | null; erase_after: string | null;
}
export interface RequestRow {
  id: string; posted_by: string; poster_name: string; poster_name_ar: string; family_id: string | null; host_team_en: string; host_team_ar: string; engagement: string;
  title_en: string; title_ar: string; summary_en: string; summary_ar: string; skills_needed: string[]; hours_total: number; seats: number; seats_taken: number; interest_count: number;
  location_type: string; start_on: string; end_on: string; status: string; hr_by: string | null; hr_at: string | null; hr_note: string | null; created_at: string;
}
export interface EngagementRow {
  id: string; request_id: string; alumni_id: string; person_id: string | null; poster_id: string; status: string; engagement: string; alumni_name: string; alumni_name_ar: string;
  note: string | null; hr_by: string | null; hr_at: string | null; hr_note: string | null; outcome_note: string | null; completed_at: string | null; history: unknown; created_at: string; updated_at: string;
}
/** One open request as an alumnus sees it: never the poster's identity; the team only because HR approved the request. */
export interface BoardRequest {
  id: string; engagement: string; title_en: string; title_ar: string; summary_en: string; summary_ar: string; skills_needed: string[]; hours_total: number;
  seats_left: number; location_type: string; start_on: string; end_on: string; family_id: string | null; host_team_en: string; host_team_ar: string;
  my_status: string | null; my_engagement_id: string | null;
}
export interface BoardEngagement {
  id: string; request_id: string; status: string; engagement: string; title_en: string; title_ar: string; host_team_en: string; host_team_ar: string;
  start_on: string; end_on: string; hours_total: number; note: string | null; outcome_note: string | null; updated_at: string;
}
export interface ReserveBoard {
  member: { id: string; kind: string; status: string; availability: string; hours_month: number; engagement_prefs: string[]; skill_snapshot: SnapshotSkill[]; snapshot_on: string; finder_optin: boolean; erase_after: string | null; withdrawn_on: string | null };
  requests: BoardRequest[];
  engagements: BoardEngagement[];
}
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function computeBoard(member: MemberRow, requests: RequestRow[], engs: EngagementRow[]): ReserveBoard {
  const mine = engs.filter((e) => e.alumni_id === member.id);
  const active = member.status === 'active';
  const reqById = new Map(requests.map((r) => [r.id, r]));
  return {
    member: {
      id: member.id, kind: member.kind, status: member.status, availability: member.availability, hours_month: member.hours_month, engagement_prefs: [...(member.engagement_prefs ?? [])],
      skill_snapshot: (member.skill_snapshot as SnapshotSkill[]) ?? [], snapshot_on: member.snapshot_on, finder_optin: member.finder_optin, erase_after: member.erase_after, withdrawn_on: member.withdrawn_on,
    },
    requests: active
      ? requests.filter((r) => r.status === 'open' && r.posted_by !== member.person_id).sort((a, b) => cmp(a.start_on, b.start_on) || cmp(a.id, b.id)).map((r) => {
          const e = mine.find((x) => x.request_id === r.id);
          return {
            id: r.id, engagement: r.engagement, title_en: r.title_en, title_ar: r.title_ar, summary_en: r.summary_en, summary_ar: r.summary_ar, skills_needed: [...r.skills_needed], hours_total: r.hours_total,
            seats_left: Math.max(0, r.seats - r.seats_taken), location_type: r.location_type, start_on: r.start_on, end_on: r.end_on, family_id: r.family_id, host_team_en: r.host_team_en, host_team_ar: r.host_team_ar,
            my_status: e?.status ?? null, my_engagement_id: e?.id ?? null,
          };
        })
      : [],
    engagements: active
      ? mine.filter((e) => reqById.has(e.request_id)).sort((a, b) => cmp(b.updated_at, a.updated_at) || cmp(a.id, b.id)).map((e) => {
          const r = reqById.get(e.request_id)!;
          return { id: e.id, request_id: e.request_id, status: e.status, engagement: e.engagement, title_en: r.title_en, title_ar: r.title_ar, host_team_en: r.host_team_en, host_team_ar: r.host_team_ar, start_on: r.start_on, end_on: r.end_on, hours_total: r.hours_total, note: e.note, outcome_note: e.outcome_note, updated_at: e.updated_at };
        })
      : [],
  };
}

export interface Cell { key: string; n: number | null; suppressed: boolean }
export interface ReserveStats {
  members: number | null; suppressed: boolean; finder_optin: number | null; hours_month: number | null;
  by_kind: Cell[]; by_band: Cell[]; by_family: Cell[]; by_engagement: Cell[]; engagements_active: number; engagements_completed: number; requests_pending: number; requests_open: number; min_group: number;
}
const cell = (key: string, n: number): Cell => (n < MIN_GROUP ? { key, n: null, suppressed: true } : { key, n, suppressed: false });

/** HR "reserve at a glance": every cell below MIN_GROUP_SIZE is suppressed. Withdrawn members are never counted. */
export function computeStats(members: MemberRow[], requests: RequestRow[], engs: EngagementRow[], today: string): ReserveStats {
  const act = members.filter((m) => m.status === 'active');
  const n = act.length;
  const fams = [...new Set(act.map((m) => m.former_family_id ?? 'none'))].sort(cmp);
  const done = engs.filter((e) => e.status === 'handed_to_hr' || e.status === 'completed');
  return {
    members: n < MIN_GROUP ? null : n, suppressed: n < MIN_GROUP,
    finder_optin: n < MIN_GROUP || act.filter((m) => m.finder_optin).length < MIN_GROUP ? null : act.filter((m) => m.finder_optin).length,
    hours_month: n < MIN_GROUP ? null : act.filter((m) => m.availability !== 'paused').reduce((s, m) => s + m.hours_month, 0),
    by_kind: MEMBER_KINDS.map((k) => cell(k, act.filter((m) => m.kind === k).length)),
    by_band: BANDS.map((b) => cell(b, act.filter((m) => bandOf(m.departed_on, today) === b).length)),
    by_family: fams.map((f) => cell(f, act.filter((m) => (m.former_family_id ?? 'none') === f).length)),
    by_engagement: ENGAGEMENTS.map((k) => cell(k, done.filter((e) => e.engagement === k).length)),
    engagements_active: engs.filter((e) => OPEN_ENG.includes(e.status as EngStatus)).length,
    engagements_completed: engs.filter((e) => e.status === 'completed').length,
    requests_pending: requests.filter((r) => r.status === 'pending_hr').length,
    requests_open: requests.filter((r) => r.status === 'open').length,
    min_group: MIN_GROUP,
  };
}

export interface ReserveDesk {
  members: MemberRow[];
  requests: RequestRow[];
  engagements: EngagementRow[];
  /** Withdrawn records awaiting deletion: id and date only, never a name. */
  erasures: { id: string; kind: string; withdrawn_on: string | null; erase_after: string | null }[];
  stats: ReserveStats;
}
export function computeDesk(members: MemberRow[], requests: RequestRow[], engs: EngagementRow[], today: string): ReserveDesk {
  return {
    members: members.filter((m) => m.status === 'active').sort((a, b) => cmp(a.id, b.id)),
    requests: [...requests].sort((a, b) => cmp(b.created_at, a.created_at) || cmp(a.id, b.id)),
    engagements: [...engs].sort((a, b) => cmp(b.updated_at, a.updated_at) || cmp(a.id, b.id)),
    erasures: members.filter((m) => m.status === 'withdrawn').sort((a, b) => cmp(a.erase_after ?? '', b.erase_after ?? '') || cmp(a.id, b.id)).map((m) => ({ id: m.id, kind: m.kind, withdrawn_on: m.withdrawn_on, erase_after: m.erase_after })),
    stats: computeStats(members, requests, engs, today),
  };
}
