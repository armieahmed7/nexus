/**
 * F36 Personal weekly digest and nudges: the pure rules (import-free: the seed builder and the PGlite validator load this file
 * directly). Mirrored 1:1 by kafaa_dg_gather / kafaa_dg_compose in supabase/migrations/20261009155001_kafaa_w5e5_digest_dalil.sql;
 * scripts/validate/w5e5-digest-dalil.mjs proves TS = SQL for every seeded person. Change both together.
 *
 * A digest holds at most 7 items, each with a deep link and its reasons ("why"):
 *   expiry       my current qualifications (non-restricted standards) and mirrored licences expiring within 90 days     urgency 1
 *   approval     things I owe someone: skill ratings asked of me, mentoring requests and agreement proposals addressed to me,
 *                opportunity releases waiting for me, my own career-conversation record to acknowledge                      urgency 2
 *   coach        the top Learning Coach action (F07 engine card passed as a hint by the page), else my soonest mandatory
 *                training due within 60 days (the coach's "must keep" rule)                                                urgency 3
 *   opportunity  open opportunities posted in the last 21 days that match me at 70% or more (F08 match formula, below)      urgency 3
 *   mentoring    an active mentoring agreement whose next session (cadence after the last one) falls within 7 days         urgency 3
 *   conversation my six-monthly career conversation when it is due within 30 days or overdue (F12 cadence)                 urgency 3
 *   refresher    refresher questions due today or earlier (F14), unless I paused refreshers                                urgency 3
 * Order: urgency (expiry < approvals < others), then days to the date (no date last), then kind, then score, then id.
 * Opting out of ranked recommendations (F24) removes the ranked kinds: no coach hint (coach), no match-based items (marketplace).
 * Expiry reminders cannot be muted. Speak-up routes never show or build a digest (the page guard has noTelemetry).
 */

export type DigestKind = 'expiry' | 'approval' | 'coach' | 'opportunity' | 'mentoring' | 'conversation' | 'refresher';
export type DigestFrequency = 'weekly' | 'fortnightly' | 'monthly';
export const DIGEST_KINDS: DigestKind[] = ['expiry', 'approval', 'coach', 'opportunity', 'mentoring', 'conversation', 'refresher'];
export const MUTABLE_KINDS: DigestKind[] = ['approval', 'coach', 'opportunity', 'mentoring', 'conversation', 'refresher'];
export const FREQUENCIES: DigestFrequency[] = ['weekly', 'fortnightly', 'monthly'];
export const DIGEST_MAX = 7;
export const EXPIRY_WINDOW_DAYS = 90;
export const MUST_KEEP_DAYS = 60;
export const NEW_OPP_DAYS = 21;
export const MATCH_MIN = 0.7;
export const MENTORING_AHEAD_DAYS = 7;
export const CONVERSATION_DUE_SOON_DAYS = 30;
export const CAPS: Record<DigestKind, number> = { expiry: 3, approval: 3, coach: 1, opportunity: 2, mentoring: 1, conversation: 1, refresher: 1 };
export const URGENCY: Record<DigestKind, 1 | 2 | 3> = { expiry: 1, approval: 2, coach: 3, opportunity: 3, mentoring: 3, conversation: 3, refresher: 3 };
export const KIND_RANK: Record<DigestKind, number> = { expiry: 1, approval: 2, coach: 3, opportunity: 4, mentoring: 5, conversation: 6, refresher: 7 };
export const CADENCE_DAYS: Record<string, number> = { weekly: 7, fortnightly: 14, monthly: 30 };
/** Asia/Dubai is UTC+4 all year (no daylight saving). */
export const DUBAI_OFFSET_HOURS = 4;
export const NO_DAYS = 100000;
export const MATCH_DEFAULTS = { skills: 0.7, development: 0.2, target: 0.1 };
export const NEED_LEVEL = 2;
const CURRENT_QUAL = ['qualified', 'due', 'renewed'];
const OPEN_ENROL = ['assigned', 'requested', 'approved', 'waitlisted', 'enrolled', 'in_progress'];
const LIVE_APP = ['applied', 'released', 'selected', 'completed', 'declined_release', 'not_selected'];

export interface WhyReason {
  code: string;
  /** Full i18n key; defaults to digest.why.<code>. Coach hints carry the F07 engine's own keys. */
  key?: string;
  vars?: Record<string, unknown>;
}
export interface DigestItem {
  id: string;
  kind: DigestKind;
  urgency: 1 | 2 | 3;
  ref_table: string;
  ref_id: string;
  title_en: string;
  title_ar: string;
  meta_en: string | null;
  meta_ar: string | null;
  link: string;
  due_on: string | null;
  days: number | null;
  score: number | null;
  why: WhyReason[];
}
export interface DigestPrefs {
  enabled: boolean;
  frequency: DigestFrequency;
  quiet_start: number | null;
  quiet_end: number | null;
  muted_kinds: string[];
}
export const DEFAULT_PREFS: DigestPrefs = { enabled: true, frequency: 'weekly', quiet_start: null, quiet_end: null, muted_kinds: [] };

/** The top Learning Coach card, computed in the browser by the F07 engine and passed to buildDigest. */
export interface CoachHint {
  id: string;
  item_id: string;
  title_en: string;
  title_ar: string;
  link: string;
  reasons: { code: string; key: string; vars?: Record<string, unknown> }[];
}
export interface DigestHints {
  coach?: CoachHint | null;
}

type Row = Record<string, any>;
export interface DigestData {
  people: Row[];
  qual_records: Row[];
  qual_standards: Row[];
  licences: Row[];
  skill_checkins: Row[];
  skill_ratings: Row[];
  mentoring_requests: Row[];
  mentoring_agreements: Row[];
  mentoring_sessions: Row[];
  opportunities: Row[];
  opportunity_applications: Row[];
  career_conversations: Row[];
  refresh_state: Row[];
  refresh_prefs: Row[];
  enrolments: Row[];
  courses: Row[];
  person_skills: Row[];
  skills: Row[];
  role_competencies: Row[];
  career_paths: Row[];
  career_targets: Row[];
  engine_settings: Row[];
  reco_optouts: Row[];
  /** W5 integration (F38): OJT practice entries and evaluation requests that name me (optional: older callers omit them). */
  ojt_logs?: Row[];
  ojt_eval_requests?: Row[];
}

// ───────────── dates (ISO yyyy-mm-dd, UTC)
const DAY = 86_400_000;
const dayNo = (s: string) => Math.floor(Date.parse(`${String(s).slice(0, 10)}T00:00:00Z`) / DAY);
export const daysBetween = (from: string, to: string) => dayNo(to) - dayNo(from);
export const addDays = (s: string, n: number) => new Date((dayNo(s) + n) * DAY).toISOString().slice(0, 10);
export function addMonths(s: string, n: number): string {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
}
/** ISO week year and number (Monday weeks; the week with the year's first Thursday is week 1), like SQL IYYY / IW. */
export function isoWeekParts(s: string): { year: number; week: number } {
  const d = new Date(`${s.slice(0, 10)}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday 0
  const thu = new Date(d.getTime() + (3 - dow) * DAY);
  const year = thu.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week1Mon = jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY;
  return { year, week: Math.floor((thu.getTime() - week1Mon) / (7 * DAY)) + 1 };
}
const pad2 = (n: number) => String(n).padStart(2, '0');
/** Period key: weekly 2026-W41, fortnightly 2026-F21 (ISO weeks 41-42), monthly 2026-M10. One digest per person and period. */
export function periodOf(date: string, frequency: DigestFrequency): string {
  if (frequency === 'monthly') return `${date.slice(0, 4)}-M${date.slice(5, 7)}`;
  const { year, week } = isoWeekParts(date);
  return frequency === 'fortnightly' ? `${year}-F${pad2(Math.ceil(week / 2))}` : `${year}-W${pad2(week)}`;
}
export const digestId = (person: string, period: string) => `dg:${person}:${period}`;
export const digestNoticeId = (person: string, period: string) => `nt-dg-${person}-${period}`;
/** Local hour in Abu Dhabi (UTC+4) for an ISO timestamp. */
export const dubaiHour = (ts: string | Date) => ((typeof ts === 'string' ? new Date(ts) : ts).getUTCHours() + DUBAI_OFFSET_HOURS) % 24;
/** Quiet hours [start, end) in local hours; a window may wrap midnight (22 -> 6). Equal or missing ends mean no quiet hours. */
export function inQuietHours(hour: number, start: number | null | undefined, end: number | null | undefined): boolean {
  if (start == null || end == null || start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}
export const prefsOf = (row: Row | null | undefined): DigestPrefs =>
  row ? { enabled: row.enabled !== false, frequency: (FREQUENCIES.includes(row.frequency) ? row.frequency : 'weekly') as DigestFrequency, quiet_start: row.quiet_start ?? null, quiet_end: row.quiet_end ?? null, muted_kinds: Array.isArray(row.muted_kinds) ? row.muted_kinds : [] } : { ...DEFAULT_PREFS };

/** Validation shared with kafaa_set_digest_prefs (same messages). Returns null when valid. */
export const PREFS_MSG = {
  enabled: 'Say whether nudges are on or off',
  frequency: 'Choose weekly, fortnightly or monthly',
  quiet: 'Quiet hours run from one whole hour (0 to 23) to another',
  muted: 'Unknown nudge type',
  expiry: 'Expiry reminders cannot be muted: renewing before expiry is a safety requirement',
};
export function checkPrefs(p: { enabled?: unknown; frequency?: unknown; quiet_start?: unknown; quiet_end?: unknown; muted_kinds?: unknown }): string | null {
  if (typeof p.enabled !== 'boolean') return PREFS_MSG.enabled;
  if (!FREQUENCIES.includes(p.frequency as DigestFrequency)) return PREFS_MSG.frequency;
  const h = (x: unknown) => x === null || (typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 23);
  const qs = p.quiet_start ?? null, qe = p.quiet_end ?? null; // a missing hour is "no quiet hours", as in SQL
  if (!h(qs) || !h(qe) || (qs === null) !== (qe === null)) return PREFS_MSG.quiet;
  if (!Array.isArray(p.muted_kinds) || p.muted_kinds.length > DIGEST_KINDS.length || p.muted_kinds.some((k) => typeof k !== 'string' || !DIGEST_KINDS.includes(k as DigestKind))) return PREFS_MSG.muted;
  if ((p.muted_kinds as string[]).includes('expiry')) return PREFS_MSG.expiry;
  return null;
}

/** Coach hint check shared with SQL kafaa_dg_hint_ok: short bilingual text, an internal link, up to 6 keyed reasons. */
export function hintOk(h: unknown): h is CoachHint {
  if (!h || typeof h !== 'object' || Array.isArray(h)) return false;
  const x = h as Row;
  const s = (v: unknown, max = 200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  if (!s(x.id, 120) || !s(x.item_id, 120) || !s(x.title_en) || !s(x.title_ar) || !s(x.link, 200)) return false;
  if (!/^\/[A-Za-z0-9/_\-?=&#.:]*$/.test(x.link) || x.link.startsWith('//')) return false;
  if (!Array.isArray(x.reasons) || x.reasons.length > 6) return false;
  return x.reasons.every((r: unknown) => !!r && typeof r === 'object' && !Array.isArray(r) && typeof (r as Row).code === 'string' && typeof (r as Row).key === 'string' && /^[a-z0-9]+\.[\w.-]+$/i.test((r as Row).key)
    && ((r as Row).vars === undefined || (r as Row).vars === null || (typeof (r as Row).vars === 'object' && !Array.isArray((r as Row).vars))));
}

// ───────────── F08 match formula (same as src/modules/m20/match.ts matchOpportunities; unit-tested equal)
const r4 = (x: number) => Math.round(x * 10000) / 10000;
function roleNeed(roleComps: Row[], roleId: string | null, s: Row | undefined): number {
  if (!roleId || !s) return 0;
  const rc = roleComps.find((r) => r.role_id === roleId && r.competency_id === s.competency_id);
  if (!rc) return 0;
  return s.core ? Number(rc.required_level) : Math.min(Number(s.key_level), Number(rc.required_level));
}
export function matchScore(o: Row, lv: Map<string, number>, sk: Map<string, Row>, roleComps: Row[], currentRole: string | null, targetRole: string | null, weights: Record<string, number>): number {
  const ws = { ...MATCH_DEFAULTS, ...weights };
  const wsum = (ws.skills ?? 0) + (ws.development ?? 0) + (ws.target ?? 0) || 1;
  const needed: string[] = o.skills_needed ?? [];
  let fit = 1;
  if (needed.length) fit = needed.reduce((a, id) => a + Math.min(lv.get(id) ?? 0, NEED_LEVEL), 0) / (NEED_LEVEL * needed.length);
  const gained: string[] = o.skills_gained ?? [];
  let dev = 0;
  for (const id of gained) {
    const my = lv.get(id) ?? 0;
    const needLv = Math.max(roleNeed(roleComps, currentRole, sk.get(id)), roleNeed(roleComps, targetRole, sk.get(id)));
    if (needLv > my) dev += Math.min(needLv - my, 2) / 2;
  }
  dev = gained.length ? dev / gained.length : 0;
  let tcount = 0;
  if (targetRole) for (const id of new Set([...needed, ...gained])) if (roleNeed(roleComps, targetRole, sk.get(id)) > (lv.get(id) ?? 0)) tcount++;
  const target = Math.min(1, tcount / 2);
  return r4((ws.skills * fit + ws.development * dev + ws.target * target) / wsum);
}
/** F05 hand-off as on the marketplace: my top shortlist role, else the next vertical step, else the first path out (by sort, id). */
export function defaultTargetRole(paths: Row[], current: string | null, shortlist: string[]): string | null {
  // FS wave-B integration: a shortlisted FS15 concept role (the target of an FS05 "future" edge) has no vacancy and no F02 role
  // profile, so it never becomes the digest's or Dalil's target role; the next shortlisted current role does (SQL: kafaa_dg_gather).
  const concept = new Set(paths.filter((p) => (p.kind ?? 'current') === 'future').map((p) => p.to_role_id));
  const top = shortlist.find((x) => x && x !== current && !concept.has(x));
  if (top) return top;
  if (!current) return null;
  // FS wave-A integration: FS05 "future" edges (to concept roles) never become the digest's target role (SQL: kafaa_dg_gather).
  const out = paths.filter((p) => p.from_role_id === current && (p.kind ?? 'current') !== 'future').sort((a, b) => Number(a.sort ?? 0) - Number(b.sort ?? 0) || cmp(a.id, b.id));
  return (out.find((p) => p.type === 'vertical') ?? out[0])?.to_role_id ?? null;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const nameOf = (people: Row[], id: string | null | undefined): [string, string] => {
  const p = people.find((x) => x.id === id);
  return p ? [p.display_name, p.display_name_ar || p.display_name] : ['A colleague', 'زميل'];
};
const item = (x: Omit<DigestItem, 'urgency' | 'meta_en' | 'meta_ar' | 'score' | 'due_on' | 'days'> & Partial<DigestItem>): DigestItem => ({
  meta_en: null, meta_ar: null, score: null, due_on: null, days: null, ...x, urgency: URGENCY[x.kind],
});
const optedOut = (d: DigestData, me: string, surface: string) => d.reco_optouts.some((o) => o.person_id === me && o.surface === surface && o.opted_out);

/** Every candidate item for one person on one day (before mutes, caps and the 7-item limit). Same rules as SQL kafaa_dg_gather. */
export function gatherDigest(d: DigestData, me: string, today: string, hints: DigestHints = {}): DigestItem[] {
  const out: DigestItem[] = [];
  const person = d.people.find((p) => p.id === me);
  if (!person) return out;
  const until = addDays(today, EXPIRY_WINDOW_DAYS);
  // expiry: qualifications
  const std = new Map(d.qual_standards.map((s) => [s.id, s]));
  for (const r of d.qual_records) {
    const s = std.get(r.standard_id);
    if (r.person_id !== me || !s || s.security_restricted || r.security_mirror_only || !CURRENT_QUAL.includes(r.status) || !r.expires_on) continue;
    const exp = String(r.expires_on).slice(0, 10);
    if (exp < today || exp > until) continue;
    const days = daysBetween(today, exp);
    out.push(item({ id: `expiry:qual_records:${r.id}`, kind: 'expiry', ref_table: 'qual_records', ref_id: r.id, title_en: `${s.code} · ${s.title_en}`, title_ar: `${s.code} · ${s.title_ar}`, link: '/my/quals', due_on: exp, days,
      why: [{ code: 'expiry_qual', vars: { days, date: exp } }, { code: 'expiry_notice' }] }));
  }
  // expiry: mirrored licences
  for (const l of d.licences) {
    if (l.person_id !== me || l.status !== 'valid' || !l.expires_on) continue;
    const exp = String(l.expires_on).slice(0, 10);
    if (exp < today || exp > until) continue;
    const days = daysBetween(today, exp);
    out.push(item({ id: `expiry:licences:${l.id}`, kind: 'expiry', ref_table: 'licences', ref_id: l.id, title_en: `${l.type} operator certificate (licensee mirror)`, title_ar: `شهادة ${l.type} (نسخة مطابقة لسجلات المرخَّص له)`, link: '/my/licence', due_on: exp, days,
      why: [{ code: 'expiry_licence', vars: { days, date: exp } }, { code: 'mirror' }] }));
  }
  // approvals: skill ratings asked of me (one per check-in)
  const openCk = new Map(d.skill_checkins.filter((c) => c.status === 'open').map((c) => [c.id, c]));
  const seenCk = new Set<string>();
  for (const r of [...d.skill_ratings].sort((a, b) => cmp(a.checkin_id, b.checkin_id) || cmp(a.rater_kind, b.rater_kind))) {
    const c = openCk.get(r.checkin_id);
    if (!c || r.rater_person_id !== me || r.status !== 'pending' || !['manager', 'peer'].includes(r.rater_kind) || c.person_id === me || seenCk.has(c.id)) continue;
    seenCk.add(c.id);
    const [en, ar] = nameOf(d.people, c.person_id);
    const due = c.due_on ? String(c.due_on).slice(0, 10) : null;
    const mgr = r.rater_kind === 'manager';
    out.push(item({ id: `approval:skill_checkins:${c.id}`, kind: 'approval', ref_table: 'skill_checkins', ref_id: c.id, title_en: `Skill check-in: ${en}`, title_ar: `تقييم مهارات: ${ar}`, meta_en: en, meta_ar: ar,
      link: mgr ? '/team/skills/validate' : '/my/skills/checkins', due_on: due, days: due ? daysBetween(today, due) : null, why: [{ code: mgr ? 'approval_rating_manager' : 'approval_rating_peer', vars: due ? { date: due } : {} }] }));
  }
  // approvals: mentoring requests addressed to me
  for (const r of d.mentoring_requests) {
    if (r.mentor_person_id !== me || r.status !== 'requested' || r.person_id === me) continue;
    const [en, ar] = nameOf(d.people, r.person_id);
    const since = String(r.created_at).slice(0, 10);
    out.push(item({ id: `approval:mentoring_requests:${r.id}`, kind: 'approval', ref_table: 'mentoring_requests', ref_id: r.id, title_en: `Mentoring request from ${en}`, title_ar: `طلب إرشاد من ${ar}`, meta_en: en, meta_ar: ar,
      link: '/my/mentoring', why: [{ code: 'approval_mentoring', vars: { date: since } }] }));
  }
  // approvals: mentoring agreements proposed to me
  for (const a of d.mentoring_agreements) {
    if (a.status !== 'proposed' || (a.person_id !== me && a.mentor_person_id !== me) || a.proposed_by === me) continue;
    const other = a.person_id === me ? a.mentor_person_id : a.person_id;
    const [en, ar] = nameOf(d.people, other);
    out.push(item({ id: `approval:mentoring_agreements:${a.id}`, kind: 'approval', ref_table: 'mentoring_agreements', ref_id: a.id, title_en: `Mentoring agreement with ${en}`, title_ar: `اتفاقية إرشاد مع ${ar}`, meta_en: en, meta_ar: ar,
      link: `/my/mentoring/${a.id}`, why: [{ code: 'approval_agreement' }] }));
  }
  // approvals: opportunity releases waiting for me
  const oppById = new Map(d.opportunities.map((o) => [o.id, o]));
  for (const a of d.opportunity_applications) {
    if (a.releaser_id !== me || a.status !== 'applied' || a.person_id === me) continue;
    const o = oppById.get(a.opportunity_id);
    const [en, ar] = [a.applicant_name || nameOf(d.people, a.person_id)[0], a.applicant_name_ar || a.applicant_name || nameOf(d.people, a.person_id)[1]];
    out.push(item({ id: `approval:opportunity_applications:${a.id}`, kind: 'approval', ref_table: 'opportunity_applications', ref_id: a.id, title_en: `Release decision: ${o?.title_en ?? a.opportunity_id}`, title_ar: `قرار الإفراج: ${o?.title_ar || o?.title_en || a.opportunity_id}`,
      meta_en: en, meta_ar: ar, link: '/opportunities/manage', why: [{ code: 'approval_release', vars: { date: String(a.created_at).slice(0, 10) } }] }));
  }
  // approvals: my career-conversation record to acknowledge
  for (const c of d.career_conversations) {
    if (c.person_id !== me || c.status !== 'held') continue;
    const held = c.held_on ? String(c.held_on).slice(0, 10) : null;
    out.push(item({ id: `approval:career_conversations:${c.id}`, kind: 'approval', ref_table: 'career_conversations', ref_id: c.id, title_en: 'Acknowledge your career conversation record', title_ar: 'أكّد سجل حوارك المهني',
      link: '/my/career/conversations', why: [{ code: 'approval_ack', vars: held ? { date: held } : {} }] }));
  }
  // approvals (W5 integration, F38): practice entries naming me as preceptor, logged by today and waiting for my acknowledgement
  for (const l of d.ojt_logs ?? []) {
    const on = String(l.on_date).slice(0, 10);
    if (l.preceptor_person_id !== me || l.status !== 'pending_ack' || l.person_id === me || on > today) continue;
    const [en, ar] = nameOf(d.people, l.person_id);
    out.push(item({ id: `approval:ojt_logs:${l.id}`, kind: 'approval', ref_table: 'ojt_logs', ref_id: l.id, title_en: `OJT practice to acknowledge: ${en}`, title_ar: `تدريب عملي بانتظار إقرارك: ${ar}`, meta_en: en, meta_ar: ar,
      link: '/my/ojt?tab=acknowledge', why: [{ code: 'approval_ojt_ack', vars: { date: on } }] }));
  }
  // approvals (W5 integration, F38): OJT evaluation requests addressed to me as evaluator, made by today
  for (const r of d.ojt_eval_requests ?? []) {
    const at = String(r.requested_at).slice(0, 10);
    if (r.evaluator_person_id !== me || r.status !== 'requested' || r.person_id === me || at > today) continue;
    const [en, ar] = nameOf(d.people, r.person_id);
    out.push(item({ id: `approval:ojt_eval_requests:${r.id}`, kind: 'approval', ref_table: 'ojt_eval_requests', ref_id: r.id, title_en: `OJT evaluation requested: ${en}`, title_ar: `طلب تقييم تدريب عملي: ${ar}`, meta_en: en, meta_ar: ar,
      link: '/my/ojt?tab=evaluate', why: [{ code: 'approval_ojt_eval', vars: { date: at } }] }));
  }
  // coach: the F07 top card (hint), else my soonest mandatory training due within 60 days
  const coachOff = optedOut(d, me, 'coach');
  if (hints.coach && !coachOff && hintOk(hints.coach)) {
    const h = hints.coach;
    out.push(item({ id: `coach:coach:${h.id}`, kind: 'coach', ref_table: 'coach', ref_id: h.id, title_en: h.title_en, title_ar: h.title_ar, link: h.link,
      why: [{ code: 'coach_top' }, ...h.reasons.slice(0, 5).map((r) => ({ code: r.code, key: r.key, vars: r.vars ?? {} }))] }));
  } else {
    const course = new Map(d.courses.map((c) => [c.id, c]));
    const due = d.enrolments
      .filter((e) => e.person_id === me && OPEN_ENROL.includes(e.status) && e.due_on && String(e.due_on).slice(0, 10) >= today && String(e.due_on).slice(0, 10) <= addDays(today, MUST_KEEP_DAYS) && course.has(e.course_id))
      .sort((a, b) => cmp(String(a.due_on).slice(0, 10), String(b.due_on).slice(0, 10)) || cmp(a.id, b.id))[0];
    if (due) {
      const c = course.get(due.course_id)!;
      const dd = String(due.due_on).slice(0, 10);
      out.push(item({ id: `coach:enrolments:${due.id}`, kind: 'coach', ref_table: 'enrolments', ref_id: due.id, title_en: `${c.code} · ${c.title_en}`, title_ar: `${c.code} · ${c.title_ar}`, link: `/learn/course/${c.id}`,
        due_on: dd, days: daysBetween(today, dd), why: [{ code: 'coach_due', vars: { days: daysBetween(today, dd), date: dd } }] }));
    }
  }
  // opportunity: new, open, eligible, not mine, not applied, match >= 70% (skipped when I opted out of the marketplace ranking)
  if (!optedOut(d, me, 'marketplace')) {
    const lv = new Map<string, number>();
    for (const s of d.person_skills) if (s.person_id === me && s.active !== false && Number(s.level) > 0) lv.set(s.skill_id, Math.max(lv.get(s.skill_id) ?? 0, Number(s.level)));
    const sk = new Map(d.skills.map((s) => [s.id, s]));
    const shortlist = d.career_targets.filter((t) => t.person_id === me && t.active !== false).sort((a, b) => Number(a.rank ?? 0) - Number(b.rank ?? 0) || cmp(a.id, b.id)).map((t) => t.role_id);
    const current = person.job_role_id ?? null;
    const target = defaultTargetRole(d.career_paths, current, shortlist);
    const weights = (d.engine_settings.find((s) => s.id === 'match')?.weights ?? {}) as Record<string, number>;
    const applied = new Set(d.opportunity_applications.filter((a) => a.person_id === me && LIVE_APP.includes(a.status)).map((a) => a.opportunity_id));
    const since = addDays(today, -NEW_OPP_DAYS);
    for (const o of d.opportunities) {
      const created = String(o.created_at).slice(0, 10);
      if (o.status !== 'open' || o.listed === false || o.posted_by === me || applied.has(o.id) || created < since || created > today) continue;
      if (o.seats != null && Number(o.seats_taken ?? 0) >= Number(o.seats)) continue;
      const fam: string[] = o.eligible_families ?? [];
      if (fam.length && !(person.job_family_id && fam.includes(person.job_family_id))) continue;
      const score = matchScore(o, lv, sk, d.role_competencies, current, target, weights);
      if (score < MATCH_MIN) continue;
      out.push(item({ id: `opportunity:opportunities:${o.id}`, kind: 'opportunity', ref_table: 'opportunities', ref_id: o.id, title_en: o.title_en, title_ar: o.title_ar || o.title_en, link: `/opportunities/${o.id}`, score,
        why: [{ code: 'opp_match', vars: { pct: Math.round(score * 100) } }, { code: 'opp_new', vars: { date: created } }] }));
    }
  }
  // mentoring: next session within 7 days on an active agreement
  const nextSessions: { a: Row; next: string }[] = [];
  for (const a of d.mentoring_agreements) {
    if (a.status !== 'active' || (a.person_id !== me && a.mentor_person_id !== me)) continue;
    const held = d.mentoring_sessions.filter((s) => s.agreement_id === a.id).map((s) => String(s.held_on).slice(0, 10)).sort();
    const last = held.length ? held[held.length - 1] : String(a.starts_on).slice(0, 10);
    const next = addDays(last, CADENCE_DAYS[a.cadence] ?? 30);
    if (next <= addDays(today, MENTORING_AHEAD_DAYS)) nextSessions.push({ a, next });
  }
  nextSessions.sort((x, y) => cmp(x.next, y.next) || cmp(x.a.id, y.a.id));
  if (nextSessions.length) {
    const { a, next } = nextSessions[0];
    const other = a.person_id === me ? a.mentor_person_id : a.person_id;
    const [en, ar] = nameOf(d.people, other);
    out.push(item({ id: `mentoring:mentoring_agreements:${a.id}`, kind: 'mentoring', ref_table: 'mentoring_agreements', ref_id: a.id, title_en: `Mentoring session with ${en}`, title_ar: `جلسة إرشاد مع ${ar}`, meta_en: en, meta_ar: ar,
      link: `/my/mentoring/${a.id}`, due_on: next, days: daysBetween(today, next), why: [{ code: next < today ? 'mentoring_overdue' : 'mentoring_due', vars: { date: next } }, { code: `cadence_${a.cadence}` }] }));
  }
  // conversation: my six-monthly career conversation (staff only)
  if (person.kind === 'staff' && person.status === 'active') {
    const lastHeld = d.career_conversations.filter((c) => c.person_id === me && ['held', 'acknowledged'].includes(c.status) && c.held_on).map((c) => String(c.held_on).slice(0, 10)).sort().pop() ?? null;
    const base = lastHeld ?? (person.hire_date ? String(person.hire_date).slice(0, 10) : null);
    const due = base ? addMonths(base, 6) : null;
    const state = !due || due < today ? 'overdue' : daysBetween(today, due) <= CONVERSATION_DUE_SOON_DAYS ? 'due_soon' : 'ok';
    if (state !== 'ok' && due) {
      out.push(item({ id: `conversation:career_conversations:${me}`, kind: 'conversation', ref_table: 'career_conversations', ref_id: me, title_en: 'Your six-monthly career conversation', title_ar: 'حوارك المهني نصف السنوي',
        link: '/my/career/conversations', due_on: due, days: daysBetween(today, due), why: [{ code: state === 'overdue' ? 'conversation_overdue' : 'conversation_due', vars: { date: due } }] }));
    }
  }
  // refresher: questions due, unless paused
  const paused = d.refresh_prefs.some((p) => p.person_id === me && p.cadence === 'paused');
  const dueN = paused ? 0 : d.refresh_state.filter((r) => r.person_id === me && String(r.due_on).slice(0, 10) <= today).length;
  if (dueN > 0) {
    out.push(item({ id: `refresher:refresh_state:${me}`, kind: 'refresher', ref_table: 'refresh_state', ref_id: me, title_en: `${dueN} refresher ${dueN === 1 ? 'question' : 'questions'} due`, title_ar: `أسئلة تنشيط مستحقة: ${dueN}`,
      link: '/my/coach/refresh', days: 0, due_on: today, why: [{ code: 'refresher_due', vars: { n: dueN } }] }));
  }
  return out;
}

/** Final order (same as SQL): urgency, days (no date last), kind, score (higher first), id. */
export function compareItems(a: DigestItem, b: DigestItem): number {
  return a.urgency - b.urgency || (a.days ?? NO_DAYS) - (b.days ?? NO_DAYS) || KIND_RANK[a.kind] - KIND_RANK[b.kind] || (b.score ?? 0) - (a.score ?? 0) || cmp(a.id, b.id);
}
/** Mutes (never expiry), per-kind caps (opportunities by score first), then the urgency order and the 7-item limit. */
export function composeDigest(cands: DigestItem[], prefs: Pick<DigestPrefs, 'muted_kinds'>): DigestItem[] {
  const muted = new Set(prefs.muted_kinds.filter((k) => k !== 'expiry'));
  const kept: DigestItem[] = [];
  for (const k of DIGEST_KINDS) {
    if (muted.has(k)) continue;
    const xs = cands.filter((c) => c.kind === k).sort((a, b) => (k === 'opportunity' ? (b.score ?? 0) - (a.score ?? 0) || cmp(a.id, b.id) : compareItems(a, b)));
    kept.push(...xs.slice(0, CAPS[k]));
  }
  return kept.sort(compareItems).slice(0, DIGEST_MAX);
}
export function buildDigestItems(d: DigestData, me: string, today: string, prefs: Pick<DigestPrefs, 'muted_kinds'>, hints: DigestHints = {}): DigestItem[] {
  return composeDigest(gatherDigest(d, me, today, hints), prefs);
}

/** The notification written with a digest (same text in SQL). */
export function digestNotice(items: DigestItem[], frequency: DigestFrequency): { title_en: string; title_ar: string; body_en: string; body_ar: string; severity: 'warn' | 'info' } {
  const n = items.length;
  const fen = frequency === 'monthly' ? 'monthly' : frequency === 'fortnightly' ? 'fortnightly' : 'weekly';
  const far = frequency === 'monthly' ? 'الشهري' : frequency === 'fortnightly' ? 'نصف الشهري' : 'الأسبوعي';
  return {
    title_en: `Your ${fen} digest: ${n} ${n === 1 ? 'thing' : 'things'} for you`,
    title_ar: `ملخصك ${far}: ${n} ${n === 1 ? 'أمر' : 'أمور'} تخصك`,
    body_en: items.slice(0, 3).map((i) => i.title_en).join(' · '),
    body_ar: items.slice(0, 3).map((i) => i.title_ar).join(' · '),
    severity: items.some((i) => i.kind === 'expiry') ? 'warn' : 'info',
  };
}

/** Admin aggregate (open rate per period), suppressed below 10 delivered digests. Same as SQL kafaa_digest_stats. */
export interface DigestPeriodStat { period: string; delivered: number | null; opened: number | null; rate: number | null; suppressed: boolean }
export interface DigestStats { periods: DigestPeriodStat[]; kinds: { kind: DigestKind; n: number | null; suppressed: boolean }[]; off: number | null; quiet: number | null; muted: number | null }
export function digestStats(runs: Row[], notices: Row[], prefs: Row[], min = 10): DigestStats {
  const read = new Map(notices.map((n) => [n.id, !!n.read_at]));
  const periods = [...new Set(runs.map((r) => r.period))].sort().reverse().slice(0, 8).map((p) => {
    const ds = runs.filter((r) => r.period === p && r.notification_id);
    const opened = ds.filter((r) => read.get(r.notification_id)).length;
    const sup = ds.length < min;
    return { period: p, delivered: sup ? null : ds.length, opened: sup ? null : opened, rate: sup ? null : r4(opened / ds.length), suppressed: sup };
  });
  const latest = periods[0]?.period;
  const kinds = DIGEST_KINDS.map((k) => {
    const n = runs.filter((r) => r.period === latest).reduce((a, r) => a + (Array.isArray(r.items) ? r.items.filter((i: Row) => i.kind === k).length : 0), 0);
    return { kind: k, n: n < min ? null : n, suppressed: n < min };
  });
  const cnt = (f: (r: Row) => boolean) => { const n = prefs.filter(f).length; return n < min ? null : n; };
  return { periods, kinds, off: cnt((r) => r.enabled === false), quiet: cnt((r) => r.quiet_start != null && r.quiet_end != null && r.quiet_start !== r.quiet_end), muted: cnt((r) => Array.isArray(r.muted_kinds) && r.muted_kinds.length > 0) };
}
