/**
 * F13 Mentoring 2.0 (M04, wave 2 · E3): pure rules shared by the LocalBackend (backend/local.ts), the seed builder
 * (scripts/seed/ext/f13-mentoring.mjs), the pages, the PGlite validator and the tests. Node loads this file directly, so it
 * imports only other import-free .ts files.
 * SQL mirror: supabase/migrations/20261009123001_kafaa_w2e3_mentoring_refreshers.sql (kafaa_request_mentoring,
 * kafaa_propose_agreement, kafaa_respond_agreement, kafaa_log_session, kafaa_close_agreement, kafaa_nominate_sme,
 * kafaa_mentoring_programme, kafaa_my_reporting_line). Same checks, order, refusal codes and messages: change both together.
 */
import { lineManagerOf, type AssignmentLite, type PersonLite } from '../m20/domain.ts';
import { MIN_GROUP_SIZE } from '../../auth/policy.ts';

export const MENTORING_TYPES = ['career', 'knowledge_transfer', 'leadership', 'reverse', 'peer_onboarding'] as const;
export type MentoringType = (typeof MENTORING_TYPES)[number];
export const CADENCES = ['weekly', 'fortnightly', 'monthly'] as const;
export type Cadence = (typeof CADENCES)[number];
export const CADENCE_DAYS: Record<Cadence, number> = { weekly: 7, fortnightly: 14, monthly: 30 };
export const AGREEMENT_STATUSES = ['proposed', 'active', 'closing', 'closed', 'declined'] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];
/** Agreements that count as a mentoring pair (started). */
export const STARTED: AgreementStatus[] = ['active', 'closing', 'closed'];
export const LIVE: AgreementStatus[] = ['active', 'closing'];
export const MAX_GOALS = 5;
export const MAX_REQUEST_SKILLS = 5;
export const MIN_DAYS = 28;
export const MAX_DAYS = 366;
export const BACKDATE_DAYS = 30;
export const FUTURE_START_DAYS = 60;
export const RATING_MIN = 1;
export const RATING_MAX = 4;
/** A goal rated 3 (met) or 4 (exceeded) counts as attained. */
export const MET = 3;
export const GOAL_TEXT_MAX = 200;
export const MESSAGE_MAX = 500;
export const NOTE_MAX = 2000;
export const TOPICS_MAX = 300;
export const MIN_MINUTES = 15;
export const MAX_MINUTES = 480;
/** Levels a mentor offers on a skill (the passport shows the mentor's own level only to the mentor). SME skills count as expert. */
export const MENTOR_LEVEL = 3;
export const SME_LEVEL = 4;
export const MIN_GROUP = MIN_GROUP_SIZE;

export const MSG = {
  not_signed_in: 'Sign in to use mentoring',
  forbidden: 'Mentoring is for staff',
  invalid_type: 'Choose a mentoring type: career, knowledge transfer, leadership, reverse or peer onboarding',
  mentor_not_found: 'Mentor not found',
  not_opted_in: 'This mentor is not taking new mentees',
  self: 'You cannot ask yourself for mentoring',
  own_manager: 'Your line manager cannot be your mentor: mentoring works across reporting lines',
  own_manager_pair: 'A line manager cannot mentor their own team member: mentoring works across reporting lines',
  no_capacity: 'This mentor has no free places',
  already_open: 'You already have an open request or agreement with this mentor',
  invalid_skills: 'Choose up to five skills from the skills catalogue (security skills are excluded)',
  invalid_message: 'Keep your message under 500 characters',
  request_not_found: 'Request not found',
  not_matched: 'The mentor must accept the request before an agreement is proposed',
  agreement_exists: 'This mentoring already has an agreement in force',
  invalid_goals: 'Give one to five goals, each tied to a different catalogue skill (no security skills), with a target level from 1 to 4 and up to 200 characters of text',
  invalid_cadence: 'Choose a weekly, fortnightly or monthly cadence',
  invalid_dates: 'Start no more than 30 days ago or 60 days ahead, and run for 4 weeks to 12 months',
  agreement_not_found: 'Agreement not found',
  not_proposed: 'This agreement is not waiting for a response',
  own_proposal: 'The other person responds to your proposal',
  invalid_decision: 'Unknown decision',
  not_active: 'Sessions are logged on an active agreement',
  invalid_session: 'Give a session date between the start of the agreement and today, 15 to 480 minutes, and skills from the agreement goals',
  invalid_note: 'Keep notes under 2,000 characters and topics under 300',
  not_closable: 'Only an active agreement can be closed',
  already_closed: 'You have already submitted your close-out',
  invalid_ratings: 'Rate every goal from 1 (not met) to 4 (exceeded)',
  validate_kt_only: 'Skills are validated only by the mentor, at the close-out of a knowledge-transfer agreement',
  not_sme: 'Only a manager-nominated subject-matter expert can validate skills at a knowledge-transfer close-out',
  forbidden_nominate: "Only the mentor's line manager or the training manager can nominate a subject-matter expert",
  self_nominate: 'You cannot nominate yourself',
  programme_forbidden: 'The mentoring programme dashboard is for the training manager (aggregates only)',
} as const;
export type MentoringCode = keyof typeof MSG;

// ───────────── dates (UTC calendar days, like SQL date arithmetic)
const dayNo = (iso: string) => Math.floor(Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`) / 86_400_000);
export const daysBetween = (from: string, to: string) => dayNo(to) - dayNo(from);
export const addDaysIso = (iso: string, n: number) => new Date((dayNo(iso) + n) * 86_400_000).toISOString().slice(0, 10);
export const isIsoDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

// ───────────── rows (structural)
export interface SkillLite { id: string; competency_id: string; area?: string | null; evidence_keys?: string[] | null; name_en?: string; name_ar?: string }
export interface MentorRowLite {
  id: string; person_id: string; role_id?: string | null; interests?: string[] | null; capacity: number; opt_in: boolean;
  types?: string[] | null; skill_ids?: string[] | null; sme?: boolean | null; sme_skill_ids?: string[] | null; khnp_paired?: boolean | null;
}
export interface RequestLite { id: string; person_id: string; mentor_id?: string | null; mentor_person_id?: string | null; status: string; mentoring_type?: string | null; skill_ids?: string[] | null }
export interface Goal { skill_id: string; target_level: number; text: string }
export interface Rating { skill_id: string; rating: number }
export interface AgreementLite {
  id: string; request_id: string; mentor_id: string; person_id: string; mentor_person_id: string; mentoring_type: string; goals: Goal[]; cadence: string;
  starts_on: string; ends_on: string; status: string; mentee_ratings?: Rating[] | null; mentor_ratings?: Rating[] | null; closed_at?: string | null;
  validated_skill_ids?: string[] | null;
}
export interface SessionLite { id: string; agreement_id: string; held_on: string; minutes?: number | null; skill_ids?: string[] | null }
export interface ClaimLite { id: string; person_id: string; skill_id: string; status: string; level: number }

export const isSecuritySkill = (s: SkillLite | undefined | null) => !s || s.area === 'security';
/** Skills whose evidence keys name a qualification standard are verified by qualification only (never by mentoring). */
export const isQualOnly = (s: SkillLite, standardIds: Set<string>) => (s.evidence_keys ?? []).some((k) => standardIds.has(k));
export const isMentoringType = (t: unknown): t is MentoringType => typeof t === 'string' && (MENTORING_TYPES as readonly string[]).includes(t);
export const isCadence = (c: unknown): c is Cadence => typeof c === 'string' && (CADENCES as readonly string[]).includes(c);

/** Unique catalogue skills, no security skills, at most `max`. Null when anything is wrong. */
export function cleanSkillIds(ids: unknown, skills: Map<string, SkillLite>, max = MAX_REQUEST_SKILLS, min = 0): string[] | null {
  if (ids == null) return min === 0 ? [] : null;
  if (!Array.isArray(ids)) return null;
  const out: string[] = [];
  for (const x of ids) {
    if (typeof x !== 'string' || isSecuritySkill(skills.get(x)) || out.includes(x)) return null;
    out.push(x);
  }
  return out.length >= min && out.length <= max ? out : null;
}

/** Agreement goals: 1..5, distinct catalogue skills (no security), integer target level 1..4, text up to 200 characters. */
export function cleanGoals(goals: unknown, skills: Map<string, SkillLite>): Goal[] | null {
  if (!Array.isArray(goals) || goals.length < 1 || goals.length > MAX_GOALS) return null;
  const out: Goal[] = [];
  for (const g of goals as Record<string, unknown>[]) {
    if (!g || typeof g !== 'object') return null;
    const sid = g.skill_id;
    const lvl = g.target_level;
    const text = typeof g.text === 'string' ? g.text.trim() : g.text == null ? '' : null;
    if (typeof sid !== 'string' || isSecuritySkill(skills.get(sid)) || out.some((o) => o.skill_id === sid)) return null;
    if (typeof lvl !== 'number' || !Number.isInteger(lvl) || lvl < 1 || lvl > 4) return null;
    if (text == null || text.length > GOAL_TEXT_MAX) return null;
    out.push({ skill_id: sid, target_level: lvl, text });
  }
  return out;
}

/** Terms: cadence and dates. Start from 30 days ago to 60 days ahead; duration 28..366 days. */
export function termsError(cadence: unknown, startsOn: unknown, endsOn: unknown, today: string): MentoringCode | null {
  if (!isCadence(cadence)) return 'invalid_cadence';
  if (!isIsoDate(startsOn) || !isIsoDate(endsOn)) return 'invalid_dates';
  const s = daysBetween(today, startsOn);
  const len = daysBetween(startsOn, endsOn);
  if (s < -BACKDATE_DAYS || s > FUTURE_START_DAYS || len < MIN_DAYS || len > MAX_DAYS) return 'invalid_dates';
  return null;
}

/** Ratings must cover every goal skill exactly once, each an integer 1..4. Returned in goal order. */
export function cleanRatings(ratings: unknown, goals: Goal[]): Rating[] | null {
  if (!Array.isArray(ratings) || ratings.length !== goals.length) return null;
  const by = new Map<string, number>();
  for (const r of ratings as Record<string, unknown>[]) {
    if (!r || typeof r.skill_id !== 'string' || by.has(r.skill_id)) return null;
    const v = r.rating;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < RATING_MIN || v > RATING_MAX) return null;
    by.set(r.skill_id, v);
  }
  const out: Rating[] = [];
  for (const g of goals) {
    if (!by.has(g.skill_id)) return null;
    out.push({ skill_id: g.skill_id, rating: by.get(g.skill_id)! });
  }
  return out;
}

/** Share of goal ratings (both parties pooled) at "met" or better, as a whole percentage; null without ratings. */
export function attainmentPct(...sets: (Rating[] | null | undefined)[]): number | null {
  const all = sets.flatMap((s) => s ?? []);
  if (!all.length) return null;
  return Math.round((100 * all.filter((r) => r.rating >= MET).length) / all.length);
}

/** Sessions planned over the whole agreement, and expected by `today`, from the cadence. */
export function sessionPlan(cadence: string, startsOn: string, endsOn: string, today: string) {
  const cd = CADENCE_DAYS[cadence as Cadence] ?? 30;
  const total = Math.max(1, Math.floor(daysBetween(startsOn, endsOn) / cd));
  const upto = daysBetween(startsOn, today < endsOn ? today : endsOn);
  const due = upto < 0 ? 0 : Math.min(total, Math.floor(upto / cd) + 1);
  return { total, due };
}
export function agreementProgress(a: Pick<AgreementLite, 'cadence' | 'starts_on' | 'ends_on'>, logged: number, today: string) {
  const { total, due } = sessionPlan(a.cadence, a.starts_on, a.ends_on, today);
  const state: 'ahead' | 'on_track' | 'behind' | 'not_started' = due === 0 ? 'not_started' : logged > due ? 'ahead' : logged >= due - 1 ? 'on_track' : 'behind';
  return { total, due, logged, pct: Math.min(100, Math.round((100 * logged) / total)), state, daysLeft: daysBetween(today, a.ends_on) };
}

// ───────────── reporting line (who is excluded from matching)
/** My line manager and the managers above them (up to `depth` levels), using the F08 line-manager rule. */
export function reportingChain(personId: string, people: PersonLite[], assignments: AssignmentLite[], today: string, depth = 3): string[] {
  const out: string[] = [];
  let cur: string | null = personId;
  for (let i = 0; i < depth && cur; i++) {
    const next = lineManagerOf(cur, people, assignments, today);
    if (!next || next === personId || out.includes(next)) break;
    out.push(next);
    cur = next;
  }
  return out;
}
export { lineManagerOf };

// ───────────── knowledge-transfer validation at close-out
export type SkipCode = 'not_met' | 'not_sme_skill' | 'no_claim' | 'qual_only' | 'security';
/**
 * Which goal skills a knowledge-transfer close-out by an SME mentor validates: goals the mentor rated met or better, within the
 * SME's nominated skills (all offered skills when the nomination names none), where the mentee holds an open claim. Skills that a
 * qualification standard verifies, and security skills, are never raised by mentoring.
 */
export function ktValidation(args: {
  goals: Goal[]; mentorRatings: Rating[]; mentor: MentorRowLite; menteeId: string; claims: ClaimLite[]; skills: Map<string, SkillLite>; standardIds: Set<string>;
}): { validated: { skill_id: string; claim_id: string }[]; skipped: { skill_id: string; code: SkipCode }[] } {
  const scope = new Set((args.mentor.sme_skill_ids?.length ? args.mentor.sme_skill_ids : args.mentor.skill_ids) ?? []);
  const validated: { skill_id: string; claim_id: string }[] = [];
  const skipped: { skill_id: string; code: SkipCode }[] = [];
  const rating = new Map(args.mentorRatings.map((r) => [r.skill_id, r.rating]));
  for (const g of [...args.goals].sort((a, b) => (a.skill_id < b.skill_id ? -1 : a.skill_id > b.skill_id ? 1 : 0))) {
    const sk = args.skills.get(g.skill_id);
    if (!sk || isSecuritySkill(sk)) { skipped.push({ skill_id: g.skill_id, code: 'security' }); continue; }
    if (isQualOnly(sk, args.standardIds)) { skipped.push({ skill_id: g.skill_id, code: 'qual_only' }); continue; }
    if ((rating.get(g.skill_id) ?? 0) < MET) { skipped.push({ skill_id: g.skill_id, code: 'not_met' }); continue; }
    if (!scope.has(g.skill_id)) { skipped.push({ skill_id: g.skill_id, code: 'not_sme_skill' }); continue; }
    const claim = args.claims
      .filter((c) => c.person_id === args.menteeId && c.skill_id === g.skill_id && c.status === 'claimed')
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
    if (!claim) { skipped.push({ skill_id: g.skill_id, code: 'no_claim' }); continue; }
    validated.push({ skill_id: g.skill_id, claim_id: claim.id });
  }
  return { validated, skipped };
}

// ───────────── programme dashboard (training manager): aggregates only, suppressed under MIN_GROUP pairs
export interface ProgrammeCell {
  key: string;
  pairs: number | null;
  active: number | null;
  closed: number | null;
  completion_pct: number | null;
  attainment_pct: number | null;
  sessions: number | null;
  suppressed: boolean;
}
export interface ProgrammeStats {
  min_group: number;
  as_of: string;
  total: ProgrammeCell;
  by_type: ProgrammeCell[];
  mentors: { opted_in: number; capacity: number; matched: number; sme: number; khnp_paired: number };
  /** Skills raised to validated by SME close-outs (count of skills), suppressed with the knowledge-transfer cell. */
  kt_validated: number | null;
}
function cellOf(key: string, list: AgreementLite[], sessionsByAgreement: Map<string, number>, today: string): ProgrammeCell {
  const started = list.filter((a) => (STARTED as string[]).includes(a.status));
  const n = started.length;
  if (n < MIN_GROUP) return { key, pairs: null, active: null, closed: null, completion_pct: null, attainment_pct: null, sessions: null, suppressed: true };
  const closed = started.filter((a) => a.status === 'closed');
  const overdue = started.filter((a) => (LIVE as string[]).includes(a.status) && a.ends_on < today).length;
  const ratings = closed.flatMap((a) => [...(a.mentee_ratings ?? []), ...(a.mentor_ratings ?? [])]);
  return {
    key,
    pairs: n,
    active: started.filter((a) => (LIVE as string[]).includes(a.status)).length,
    closed: closed.length,
    completion_pct: closed.length + overdue > 0 ? Math.round((100 * closed.length) / (closed.length + overdue)) : null,
    attainment_pct: ratings.length ? Math.round((100 * ratings.filter((r) => r.rating >= MET).length) / ratings.length) : null,
    sessions: started.reduce((s, a) => s + (sessionsByAgreement.get(a.id) ?? 0), 0),
    suppressed: false,
  };
}
export function programmeStats(agreements: AgreementLite[], sessions: SessionLite[], mentors: MentorRowLite[], requests: RequestLite[], today: string): ProgrammeStats {
  const per = new Map<string, number>();
  for (const s of sessions) per.set(s.agreement_id, (per.get(s.agreement_id) ?? 0) + 1);
  const by_type = MENTORING_TYPES.map((t) => cellOf(t, agreements.filter((a) => a.mentoring_type === t), per, today));
  const kt = by_type.find((c) => c.key === 'knowledge_transfer')!;
  const opted = mentors.filter((m) => m.opt_in);
  return {
    min_group: MIN_GROUP,
    as_of: today,
    total: cellOf('total', agreements, per, today),
    by_type,
    mentors: {
      opted_in: opted.length,
      capacity: opted.reduce((s, m) => s + Number(m.capacity || 0), 0),
      matched: requests.filter((r) => r.status === 'matched').length,
      sme: mentors.filter((m) => m.sme).length,
      khnp_paired: mentors.filter((m) => m.khnp_paired).length,
    },
    kt_validated: kt.suppressed ? null : agreements.filter((a) => a.mentoring_type === 'knowledge_transfer' && a.status === 'closed').reduce((s, a) => s + (a.validated_skill_ids?.length ?? 0), 0),
  };
}

/** Free places of a mentor: capacity minus requests in the matched state (the G2 capacity rule). */
export const freePlaces = (m: MentorRowLite, requests: RequestLite[]) => Math.max(0, Number(m.capacity || 0) - requests.filter((r) => r.mentor_id === m.id && r.status === 'matched').length);
export const agreementIdFor = (requestId: string) => `ma-${requestId}`;
export const privateNoteId = (sessionId: string, author: string) => `mpn:${sessionId}:${author}`;
