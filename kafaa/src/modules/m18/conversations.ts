/**
 * F12 Career conversations and aspirations: pure rules shared by the LocalBackend RPCs, the seed builder, the pages and the tests.
 * Mirrored 1:1 by the SQL in supabase/migrations/20261009122001_kafaa_w2e2_conversations.sql (kafaa_cc_prep_norm,
 * kafaa_cc_actions_norm, kafaa_cc_agenda, kafaa_cc_due_on / kafaa_cc_state, kafaa_cc_insights_compute);
 * scripts/validate/w2e2-conversations.mjs proves TS = SQL on the seed. Change both together.
 *
 *  - One open conversation per person: a private draft (the employee's preparation) becomes visible to the line manager of
 *    record only when the employee shares it; the manager records notes and agreed actions (status held); only the employee
 *    acknowledges (status acknowledged), optionally disagreeing with a comment.
 *  - The pre-filled agenda is built on the server from the person's own records: passport highlights (no security skills),
 *    the shortlist with readiness (F05, same computation as rpc.careerReadiness), the latest roadmap (F06), qualifications that
 *    expire within a year (no security-restricted standards), coach progress (F07). The manager's preview holds only what the
 *    person already shares with them.
 *  - Cadence: a conversation every 6 months (from the last one held, else from the hire date); overdue pairs get reminders.
 *  - The aspiration signal reaches HR only as aggregates by job family (groups of 10 or more; aspiration and mobility counts are
 *    suppressed cell by cell below 10) and reaches talent review (F18) only when the employee switched sharing on.
 * Import-free apart from `.ts` files that are themselves node-loadable (seed and validation scripts load this file directly).
 */
import { MIN_GROUP_SIZE } from '../../auth/policy.ts';
import { careerFacts, careerReadiness, type CareerData, type CareerReadiness, type Gap, type Reason } from './career.ts';
import { conceptReadiness, type ConceptBand, type ConceptGap, type ConceptVersion } from './futureRoles.ts';
import { lineManagerOf, type AssignmentLite, type PersonLite } from '../m20/domain.ts';

export const ASPIRATIONS = ['stay_deepen', 'grow_vertical', 'move_lateral', 'lead', 'specialise'] as const;
export const MOBILITY = ['current_site', 'other_sites', 'any'] as const;
export const LEADERSHIP = ['not_now', 'curious', 'ready'] as const;
export const SUPPORT = ['course', 'mentoring', 'rotation', 'stretch', 'coaching', 'time', 'other'] as const;
export const ACTION_KINDS = ['course', 'ojt', 'mentoring', 'project', 'assessment', 'reading'] as const;
export const ACTION_OWNERS = ['employee', 'manager'] as const;
export type Aspiration = (typeof ASPIRATIONS)[number];
export type Mobility = (typeof MOBILITY)[number];
export type ActionKind = (typeof ACTION_KINDS)[number];

export const CADENCE_MONTHS = 6;
export const DUE_SOON_DAYS = 30;
export const QUAL_AHEAD_DAYS = 365;
export const QUAL_PAST_DAYS = 90;
export const COACH_WINDOW_DAYS = 180;
export const MAX_TEXT = 500;
export const MAX_NOTES = 4000;
export const MAX_COMMENT = 1000;
export const MAX_ACTIONS = 8;
export const MAX_ASPIRATIONS = 3;
export const PASSPORT_TOP = 5;
export const QUALS_TOP = 5;
export const TARGET_GAPS = 3;
export const TARGET_REASONS = 4;
export const HELD_BACK_DAYS = 365;
export const MAX_PEOPLE = 200;

// ───────────── dates (calendar days, UTC; same as SQL date arithmetic)
const dayNo = (d: string) => Math.floor(Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`) / 86_400_000);
export const daysFrom = (from: string, to: string) => dayNo(to) - dayNo(from);
const pad = (n: number) => String(n).padStart(2, '0');
export function addDaysIso(iso: string, n: number) {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** date + interval 'n months' as in Postgres: month arithmetic, day clamped to the end of the target month. */
export function addMonthsIso(iso: string, n: number) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  const ny = Math.floor(t / 12);
  const nm = ((t % 12) + 12) % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, last))}`;
}
export const isIsoDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
/** Half-year label of a date: 2026-H2. */
export const cycleOf = (iso: string) => `${iso.slice(0, 4)}-H${Number(iso.slice(5, 7)) <= 6 ? 1 : 2}`;

// ───────────── cadence
export type CadenceState = 'ok' | 'due_soon' | 'overdue';
export interface Cadence { last_held_on: string | null; due_on: string | null; state: CadenceState; days: number | null }
export const dueOn = (lastHeld: string | null | undefined, hire: string | null | undefined) => {
  const base = lastHeld ?? hire ?? null;
  return base ? addMonthsIso(base, CADENCE_MONTHS) : null;
};
export function cadenceState(lastHeld: string | null | undefined, hire: string | null | undefined, today: string): CadenceState {
  const due = dueOn(lastHeld, hire);
  if (!due) return 'overdue';
  const d = daysFrom(today, due);
  return d < 0 ? 'overdue' : d <= DUE_SOON_DAYS ? 'due_soon' : 'ok';
}
export function cadenceOf(lastHeld: string | null | undefined, hire: string | null | undefined, today: string): Cadence {
  const due = dueOn(lastHeld, hire);
  return { last_held_on: lastHeld ?? null, due_on: due, state: cadenceState(lastHeld, hire, today), days: due ? daysFrom(today, due) : null };
}
/** A conversation held within the last six months (its six-month window still covers today). */
export const heldRecently = (lastHeld: string | null | undefined, today: string) => !!lastHeld && addMonthsIso(lastHeld, CADENCE_MONTHS) >= today;

// ───────────── rows
export type ConvStatus = 'draft' | 'held' | 'acknowledged';
export interface ConvRow {
  id: string; person_id: string; manager_person_id?: string | null; manager_read_id?: string | null; status: ConvStatus | string; cycle?: string;
  prep?: unknown; prep_submitted_at?: string | null; agenda?: unknown; held_on?: string | null; notes?: string | null; actions?: unknown;
  focus_role_id?: string | null; coach_hours?: number | string | null; plan_id?: string | null; employee_agrees?: boolean | null; employee_comment?: string | null;
  acknowledged_at?: string | null; share_with_talent_review?: boolean | null; created_at?: string; updated_at?: string; recorded_at?: string | null;
}
const HELD = ['held', 'acknowledged'];
/** The latest conversation actually held (held or acknowledged), by held date then id. */
export function lastHeldOf(rows: ConvRow[], personId: string): ConvRow | null {
  let best: ConvRow | null = null;
  for (const r of rows) {
    if (r.person_id !== personId || !HELD.includes(String(r.status)) || !r.held_on) continue;
    const h = String(r.held_on).slice(0, 10);
    if (!best || h > String(best.held_on).slice(0, 10) || (h === String(best.held_on).slice(0, 10) && r.id < best.id)) best = r;
  }
  return best;
}

// ───────────── preparation (employee) and actions (manager): validation + normalisation (SQL: kafaa_cc_prep_norm / kafaa_cc_actions_norm)
export interface Prep {
  aspirations: Aspiration[];
  mobility: Mobility;
  shift_ok: boolean;
  rotation_ok: boolean;
  leadership: (typeof LEADERSHIP)[number];
  goal_12m: string;
  goal_3y: string;
  support: string[];
  support_note: string;
  topics: string;
  include: { targets: boolean; roadmap: boolean; coach: boolean };
  share_with_talent_review: boolean;
}
export type PrepInput = Partial<Omit<Prep, 'include'>> & { include?: Partial<Prep['include']> };
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : null);
const bool = (v: unknown, dflt: boolean) => (typeof v === 'boolean' ? v : v == null ? dflt : null);

/** Returns the normalised preparation, or null when invalid. `submit` needs at least one aspiration and a 12-month goal. */
export function normPrep(raw: unknown, submit: boolean): Prep | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  const asp = p.aspirations == null ? [] : p.aspirations;
  if (!Array.isArray(asp) || asp.some((a) => typeof a !== 'string' || !(ASPIRATIONS as readonly string[]).includes(a))) return null;
  const aspirations = [...new Set(asp as string[])] as Aspiration[];
  if (aspirations.length > MAX_ASPIRATIONS) return null;
  const sup = p.support == null ? [] : p.support;
  if (!Array.isArray(sup) || sup.some((a) => typeof a !== 'string' || !(SUPPORT as readonly string[]).includes(a))) return null;
  const support = SUPPORT.filter((s) => (sup as string[]).includes(s));
  const mobility = (p.mobility ?? 'current_site') as Mobility;
  const leadership = (p.leadership ?? 'not_now') as Prep['leadership'];
  if (!(MOBILITY as readonly string[]).includes(mobility as string) || !(LEADERSHIP as readonly string[]).includes(leadership as string)) return null;
  const texts = ['goal_12m', 'goal_3y', 'support_note', 'topics'].map((k) => str(p[k]));
  if (texts.some((x) => x === null || x.length > MAX_TEXT)) return null;
  const inc = p.include == null ? {} : p.include;
  if (typeof inc !== 'object' || Array.isArray(inc)) return null;
  const i = inc as Record<string, unknown>;
  const flags = [bool(p.shift_ok, false), bool(p.rotation_ok, false), bool(i.targets, true), bool(i.roadmap, true), bool(i.coach, true), bool(p.share_with_talent_review, false)];
  if (flags.some((x) => x === null)) return null;
  const [goal_12m, goal_3y, support_note, topics] = texts as string[];
  if (submit && (aspirations.length === 0 || goal_12m.length < 3)) return null;
  return {
    aspirations, mobility, shift_ok: flags[0]!, rotation_ok: flags[1]!, leadership, goal_12m, goal_3y, support, support_note, topics,
    include: { targets: flags[2]!, roadmap: flags[3]!, coach: flags[4]! }, share_with_talent_review: flags[5]!,
  };
}

export interface Action { id: string; kind: ActionKind; title: { en: string; ar: string }; due_on: string | null; course_id: string | null; owner: 'employee' | 'manager' }
/** Normalises agreed actions (ids a1..aN when missing). Returns null when invalid. `courseExists` checks course ids. */
export function normActions(raw: unknown, courseExists: (id: string) => boolean): Action[] | null {
  const list = raw == null ? [] : raw;
  if (!Array.isArray(list) || list.length > MAX_ACTIONS) return null;
  const out: Action[] = [];
  const seen = new Set<string>();
  for (const [i, x] of list.entries()) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
    const a = x as Record<string, unknown>;
    const id = a.id == null ? `a${i + 1}` : a.id;
    if (typeof id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(id) || seen.has(id)) return null;
    seen.add(id);
    if (!(ACTION_KINDS as readonly string[]).includes(String(a.kind))) return null;
    const t = a.title as Record<string, unknown> | undefined;
    const en = str(t?.en), ar = str(t?.ar);
    if (en === null || ar === null || (!en && !ar) || en.length > 200 || ar.length > 200) return null;
    const due = a.due_on == null || a.due_on === '' ? null : a.due_on;
    if (due !== null && !isIsoDate(due)) return null;
    const course = a.course_id == null || a.course_id === '' ? null : a.course_id;
    if (course !== null && (typeof course !== 'string' || !courseExists(course))) return null;
    const owner = a.owner == null ? 'employee' : a.owner;
    if (!(ACTION_OWNERS as readonly string[]).includes(String(owner))) return null;
    out.push({ id, kind: a.kind as ActionKind, title: { en: en || ar, ar: ar || en }, due_on: due as string | null, course_id: course as string | null, owner: owner as Action['owner'] });
  }
  return out;
}
export const activityId = (convId: string, actionId: string) => `pa-cc-${convId}-${actionId}`;
export const planIdFor = (convId: string) => `dp-cc-${convId}`;
export const goalIdFor = (personId: string) => `lg:${personId}`;

// ───────────── agenda (SQL: kafaa_cc_agenda)
/** A shortlisted FS15 concept role (concept: true) carries its FS05-profile readiness: concept band, gate_status 'none' and FS15 gaps. */
export interface AgendaTarget { role_id: string; rank: number; pct: number | null; band: CareerReadiness['band'] | ConceptBand; gate_status: CareerReadiness['gate_status']; months: number | null; gaps: (Gap | ConceptGap)[]; reasons: Reason[]; concept?: true }
export interface Agenda {
  built_on: string;
  role_id: string | null;
  shared_only: boolean;
  included: { targets: boolean; roadmap: boolean; coach: boolean };
  passport: { skill_id: string; level: number; basis: string }[];
  targets: AgendaTarget[];
  roadmap: { id: string; name: string; target_role_id: string; earliest_on: string | null; end_on: string | null; dev_blocks: number } | null;
  quals: { record_id: string; standard_id: string; expires_on: string; days: number }[];
  coach: { hours_per_week: number; focus_role_ids: string[]; enrolled: number; passed: number } | null;
  last: { id: string; held_on: string; status: string } | null;
}
type Row = Record<string, unknown>;
/** The tables the agenda reads (same rows in both backends; the RPC runs as definer). */
export interface AgendaTables extends CareerData {
  skillRows: { id: string; competency_id: string; area: string }[];
  competencyRows: { id: string; domain?: string | null }[];
  personSkills: { person_id: string; skill_id: string; level: number; confidence: number | string; basis: string; active?: boolean | null }[];
  targets: { id: string; person_id: string; role_id: string; rank: number; shared: boolean; active: boolean }[];
  roadmaps: { id: string; person_id: string; target_role_id: string; name: string; plan: unknown; earliest_on?: string | null; end_on?: string | null; shared: boolean; active: boolean; updated_at?: string | null }[];
  qualRows: { id: string; person_id: string; standard_id: string; status: string; expires_on?: string | null; security_mirror_only?: boolean | null }[];
  standardRows: { id: string; security_restricted?: boolean | null }[];
  goals: { person_id: string; hours_per_week: number | string; focus_role_ids?: string[] | null }[];
  feedback: { person_id: string; signal: string; at: string }[];
  training: { person_id: string; result: string; completed_on?: string | null }[];
  conversations: ConvRow[];
  /** FS wave B: FS05 role-profile versions, for shortlisted concept roles (absent: concept targets are left out) */
  versions?: ConceptVersion[];
}
export interface AgendaOptions { targets: boolean; roadmap: boolean; coach: boolean; sharedOnly: boolean }

const ts = (s: string | null | undefined) => (s ? Date.parse(s.length === 10 ? `${s}T00:00:00Z` : s) : 0);
const dateStr = (s: unknown) => (s == null ? null : String(s).slice(0, 10));

export function buildAgenda(d: AgendaTables, personId: string, o: AgendaOptions, today: string): Agenda {
  const person = d.people.find((p) => p.id === personId);
  const skill = new Map(d.skillRows.map((s) => [s.id, s]));
  const domain = new Map(d.competencyRows.map((c) => [c.id, c.domain ?? '']));
  const passport = d.personSkills
    .filter((s) => s.person_id === personId && s.active !== false && Number(s.level) >= 1)
    .filter((s) => { const k = skill.get(s.skill_id); return !!k && k.area !== 'security' && domain.get(k.competency_id) !== 'security'; })
    .sort((a, b) => Number(b.level) - Number(a.level) || Number(b.confidence) - Number(a.confidence) || (a.skill_id < b.skill_id ? -1 : a.skill_id > b.skill_id ? 1 : 0))
    .slice(0, PASSPORT_TOP)
    .map((s) => ({ skill_id: s.skill_id, level: Number(s.level), basis: s.basis }));

  let targets: AgendaTarget[] = [];
  if (o.targets) {
    const mine = d.targets.filter((t) => t.person_id === personId && t.active && (!o.sharedOnly || t.shared))
      .sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (mine.length) {
      // FS wave B: shortlisted FS15 concept roles read their FS05-profile readiness (conceptReadiness), never F05's 0 % (SQL kafaa_cc_agenda)
      const concept = new Set(d.roles.filter((r) => (r as { lifecycle?: string | null }).lifecycle === 'concept').map((r) => r.id));
      const cIds = mine.map((t) => t.role_id).filter((id) => concept.has(id));
      const rd = careerReadiness(d, personId, mine.map((t) => t.role_id).filter((id) => !concept.has(id)), today);
      const cd = cIds.length && d.versions ? conceptReadiness({ roles: d.roles as never, versions: d.versions, edges: d.edges as never, skills: d.skills as never, competencies: d.competencies, states: d.states, weights: d.weights }, careerFacts(d, personId, today), personId, cIds) : [];
      targets = mine.flatMap((t): AgendaTarget[] => {
        const c = cd.find((r) => r.role_id === t.role_id);
        if (c) return [{ role_id: t.role_id, rank: t.rank, pct: c.pct, band: c.band, gate_status: 'none', months: c.months, gaps: c.gaps.slice(0, TARGET_GAPS), reasons: c.reasons.slice(0, TARGET_REASONS), concept: true }];
        const x = rd.find((r) => r.role_id === t.role_id);
        return x ? [{ role_id: t.role_id, rank: t.rank, pct: x.pct, band: x.band, gate_status: x.gate_status, months: x.months, gaps: x.gaps.slice(0, TARGET_GAPS), reasons: x.reasons.slice(0, TARGET_REASONS) }] : [];
      });
    }
  }

  let roadmap: Agenda['roadmap'] = null;
  if (o.roadmap) {
    const rm = d.roadmaps.filter((m) => m.person_id === personId && m.active && (!o.sharedOnly || m.shared))
      .sort((a, b) => ts(b.updated_at) - ts(a.updated_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
    if (rm) roadmap = { id: rm.id, name: rm.name, target_role_id: rm.target_role_id, earliest_on: dateStr(rm.earliest_on), end_on: dateStr(rm.end_on), dev_blocks: (Array.isArray(rm.plan) ? rm.plan : []).filter((b: Row) => b && b.lane === 'development').length };
  }

  const secStd = new Set(d.standardRows.filter((s) => s.security_restricted).map((s) => s.id));
  const stdIds = new Set(d.standardRows.map((s) => s.id));
  const quals = d.qualRows
    .filter((q) => q.person_id === personId && ['qualified', 'due', 'renewed'].includes(q.status) && q.expires_on && stdIds.has(q.standard_id) && !secStd.has(q.standard_id) && !q.security_mirror_only)
    .map((q) => ({ record_id: q.id, standard_id: q.standard_id, expires_on: String(q.expires_on).slice(0, 10), days: daysFrom(today, String(q.expires_on)) }))
    .filter((q) => q.days >= -QUAL_PAST_DAYS && q.days <= QUAL_AHEAD_DAYS)
    .sort((a, b) => (a.expires_on < b.expires_on ? -1 : a.expires_on > b.expires_on ? 1 : a.record_id < b.record_id ? -1 : 1))
    .slice(0, QUALS_TOP);

  let coach: Agenda['coach'] = null;
  if (o.coach) {
    const g = d.goals.find((x) => x.person_id === personId);
    const from = addDaysIso(today, -COACH_WINDOW_DAYS);
    coach = {
      hours_per_week: Number(g?.hours_per_week ?? 0),
      focus_role_ids: [...(g?.focus_role_ids ?? [])],
      enrolled: d.feedback.filter((f) => f.person_id === personId && f.signal === 'enrolled' && String(f.at).slice(0, 10) >= from).length,
      passed: d.training.filter((t) => t.person_id === personId && ['passed', 'completed'].includes(t.result) && t.completed_on && String(t.completed_on).slice(0, 10) >= from && String(t.completed_on).slice(0, 10) <= today).length,
    };
  }
  const l = lastHeldOf(d.conversations, personId);
  return {
    built_on: today, role_id: person?.job_role_id ?? null, shared_only: o.sharedOnly, included: { targets: o.targets, roadmap: o.roadmap, coach: o.coach },
    passport, targets, roadmap, quals, coach, last: l ? { id: l.id, held_on: String(l.held_on).slice(0, 10), status: String(l.status) } : null,
  };
}

// ───────────── pairs (employee + line manager of record), team view and HR aggregates (SQL: kafaa_cc_insights_compute)
export interface PeopleRow extends PersonLite { kind?: string | null; hire_date?: string | null; display_name?: string; display_name_ar?: string; job_role_id?: string | null }
/** Active staff with a line manager of record (people.manager_id, else the narrowest manager assignment: F08's rule). */
export function pairsOf(people: PeopleRow[], assignments: AssignmentLite[], today: string): { person_id: string; manager_id: string }[] {
  const out: { person_id: string; manager_id: string }[] = [];
  for (const p of [...people].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (p.kind !== 'staff' || p.status !== 'active') continue;
    const m = lineManagerOf(p.id, people, assignments, today);
    if (m) out.push({ person_id: p.id, manager_id: m });
  }
  return out;
}

export interface InsightCell {
  key: string; people: number | null; held_6m: number | null; coverage_pct: number | null; overdue: number | null; acknowledged: number | null; disagreed: number | null;
  aspirations: Record<Aspiration, number | null>; mobility: Record<Mobility, number | null>; suppressed: boolean;
}
export interface ConversationInsights { min_group: number; as_of: string; total: InsightCell; by_family: InsightCell[] }
interface Member { fam: string; held: string | null; status: string | null; agrees: boolean | null; asp: string | null; mob: string | null; state: CadenceState; recent: boolean }
const nullRec = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, null])) as Record<K, number | null>;
function cellOf(key: string, ms: Member[]): InsightCell {
  const n = ms.length;
  if (n < MIN_GROUP_SIZE) return { key, people: null, held_6m: null, coverage_pct: null, overdue: null, acknowledged: null, disagreed: null, aspirations: nullRec(ASPIRATIONS), mobility: nullRec(MOBILITY), suppressed: true };
  const held = ms.filter((m) => m.recent).length;
  const cnt = (v: number) => (v >= MIN_GROUP_SIZE ? v : null);
  return {
    key, people: n, held_6m: held, coverage_pct: Math.round((1000 * held) / n) / 10, overdue: ms.filter((m) => m.state === 'overdue').length,
    acknowledged: ms.filter((m) => m.status === 'acknowledged').length, disagreed: ms.filter((m) => m.status === 'acknowledged' && m.agrees === false).length,
    aspirations: Object.fromEntries(ASPIRATIONS.map((a) => [a, cnt(ms.filter((m) => m.asp === a).length)])) as Record<Aspiration, number | null>,
    mobility: Object.fromEntries(MOBILITY.map((a) => [a, cnt(ms.filter((m) => m.mob === a).length)])) as Record<Mobility, number | null>,
    suppressed: false,
  };
}
/** HR aggregates: each pair's latest conversation held; by job family, suppressed below MIN_GROUP_SIZE. */
export function conversationInsightsOf(rows: ConvRow[], people: PeopleRow[], assignments: AssignmentLite[], today: string): ConversationInsights {
  const byId = new Map(people.map((p) => [p.id, p]));
  const members = pairsOf(people, assignments, today).map(({ person_id }) => {
    const p = byId.get(person_id)!;
    const l = lastHeldOf(rows, person_id);
    const prep = l?.prep && typeof l.prep === 'object' ? (l.prep as Row) : {};
    const asp = Array.isArray(prep.aspirations) && typeof prep.aspirations[0] === 'string' ? (prep.aspirations[0] as string) : null;
    const held = l ? String(l.held_on).slice(0, 10) : null;
    return { fam: p.job_family_id ?? 'unassigned', held, status: l ? String(l.status) : null, agrees: l?.employee_agrees ?? null, asp, mob: typeof prep.mobility === 'string' ? (prep.mobility as string) : null, state: cadenceState(held, p.hire_date ?? null, today), recent: heldRecently(held, today) } as Member;
  });
  const fams = [...new Set(members.map((m) => m.fam))].sort();
  return { min_group: MIN_GROUP_SIZE, as_of: today, total: cellOf('all', members), by_family: fams.map((f) => cellOf(f, members.filter((m) => m.fam === f))) };
}

export interface TeamRow {
  person_id: string; name: string; name_ar: string; role_id: string | null; family_id: string | null;
  cadence: Cadence; open: { id: string; status: string; prep_submitted: boolean } | null; last: { id: string; held_on: string; status: string; agrees: boolean | null } | null;
}
/** The line manager's reports with cadence and the conversation the manager can see (SQL: kafaa_team_conversations). */
export function teamRowsOf(managerId: string, rows: ConvRow[], people: PeopleRow[], assignments: AssignmentLite[], today: string): TeamRow[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  return pairsOf(people, assignments, today).filter((x) => x.manager_id === managerId).map(({ person_id }) => {
    const p = byId.get(person_id)!;
    const l = lastHeldOf(rows, person_id);
    const open = rows.filter((r) => r.person_id === person_id && r.manager_read_id === managerId && (r.status === 'draft' || r.status === 'held'))
      .sort((a, b) => ts(b.created_at) - ts(a.created_at) || (a.id < b.id ? -1 : 1))[0];
    return {
      person_id, name: p.display_name ?? person_id, name_ar: p.display_name_ar || p.display_name || person_id, role_id: p.job_role_id ?? null, family_id: p.job_family_id ?? null,
      cadence: cadenceOf(l ? String(l.held_on).slice(0, 10) : null, p.hire_date ?? null, today),
      open: open ? { id: open.id, status: String(open.status), prep_submitted: !!open.prep_submitted_at } : null,
      last: l ? { id: l.id, held_on: String(l.held_on).slice(0, 10), status: String(l.status), agrees: l.employee_agrees ?? null } : null,
    };
  });
}

// ───────────── talent review (F18) read: aspiration only with the employee's consent
export interface AspirationSignal {
  person_id: string; shared: boolean; reason: 'shared' | 'not_shared' | 'none';
  conversation_id?: string; held_on?: string; aspirations?: string[]; mobility?: string | null; leadership?: string | null; goal_12m?: string; goal_3y?: string;
}
export function aspirationOf(rows: ConvRow[], personId: string): AspirationSignal {
  const l = lastHeldOf(rows, personId);
  if (!l) return { person_id: personId, shared: false, reason: 'none' };
  if (!l.share_with_talent_review) return { person_id: personId, shared: false, reason: 'not_shared' };
  const p = l.prep && typeof l.prep === 'object' ? (l.prep as Row) : {};
  return {
    person_id: personId, shared: true, reason: 'shared', conversation_id: l.id, held_on: String(l.held_on).slice(0, 10),
    aspirations: Array.isArray(p.aspirations) ? (p.aspirations as string[]) : [], mobility: typeof p.mobility === 'string' ? p.mobility : null,
    leadership: typeof p.leadership === 'string' ? p.leadership : null, goal_12m: typeof p.goal_12m === 'string' ? p.goal_12m : '', goal_3y: typeof p.goal_3y === 'string' ? p.goal_3y : '',
  };
}

// ───────────── suggested actions for the manager (deterministic, with reasons): pages only
export interface SuggestCourse { id: string; title_en: string; title_ar: string; competency_ids?: string[] | null; duration_hours?: number | string | null; audience?: string | null; programme_id?: string | null }
export interface Suggestion { id: string; score: number; reasons: Reason[]; item: Omit<Action, 'id'> }
const rsn = (code: string, vars?: Reason['vars'], ref?: Reason['ref']): Reason => ({ code, key: `m18.reasons.cc_${code}`, ...(vars ? { vars } : {}), ...(ref ? { ref } : {}) });
/**
 * Up to six suggested actions from the agenda and the preparation: courses that close the top target's gaps (shortest first),
 * requalification for expiring qualifications, then actions that answer the stated aspirations and support needs.
 */
export function suggestActions(a: Agenda | null, prep: Partial<Prep> | null, courses: SuggestCourse[], roleTitle: (id: string) => { en: string; ar: string }, compName: (id: string) => { en: string; ar: string }, stdTitle: (id: string) => { en: string; ar: string }, done: Set<string>, today: string): Suggestion[] {
  const out: Suggestion[] = [];
  const push = (s: Suggestion) => { if (!out.some((x) => x.id === s.id)) out.push(s); };
  const due = (days: number) => addDaysIso(today, days);
  // FS wave B: suggestions close F05 competency gaps of a current target (a concept target's FS05 gaps are planning assumptions)
  const top = a?.targets.find((t) => t.pct != null && !t.concept);
  if (top) {
    const role = roleTitle(top.role_id);
    for (const g of top.gaps as Gap[]) {
      const c = courses.filter((x) => x.audience !== 'supplier' && !done.has(x.id) && (x.competency_ids ?? []).includes(g.competency_id) && !String(x.programme_id ?? '').match(/^(coit|loit)/))
        .sort((x, y) => (Number(x.duration_hours) || 999) - (Number(y.duration_hours) || 999) || (x.id < y.id ? -1 : 1))[0];
      if (!c) continue;
      push({ id: `course-${c.id}`, score: 0.9 - out.length * 0.02, reasons: [rsn('gap', { skill: compName(g.competency_id), from: g.have, to: g.need, role }, { table: 'competencies', id: g.competency_id }), rsn('target', { role })],
        item: { kind: 'course', title: { en: `Complete ${c.title_en}`, ar: `إتمام ${c.title_ar}` }, due_on: due(120), course_id: c.id, owner: 'employee' } });
    }
  }
  for (const q of a?.quals ?? []) {
    const s = stdTitle(q.standard_id);
    push({ id: `requal-${q.standard_id}`, score: 0.8, reasons: [rsn('expiring', { std: s, date: q.expires_on }, { table: 'qual_records', id: q.record_id })],
      item: { kind: 'assessment', title: { en: `Plan requalification: ${s.en}`, ar: `التخطيط لإعادة التأهيل: ${s.ar}` }, due_on: q.days > 60 ? addDaysIso(q.expires_on, -60) : due(30), course_id: null, owner: 'employee' } });
  }
  const asp = prep?.aspirations ?? [];
  const sup = prep?.support ?? [];
  const tr = top ? roleTitle(top.role_id) : null;
  if (asp.includes('lead') || prep?.leadership === 'ready') {
    const c = courses.find((x) => x.id === 'c-intilaqa' && !done.has(x.id));
    push({ id: 'lead', score: 0.75, reasons: [rsn('aspiration', { asp: { en: 'lead people', ar: 'قيادة الفرق' } })],
      item: c ? { kind: 'course', title: { en: `Join ${c.title_en}`, ar: `الانضمام إلى ${c.title_ar}` }, due_on: due(180), course_id: c.id, owner: 'employee' }
        : { kind: 'project', title: { en: 'Lead a small improvement project with the team', ar: 'قيادة مشروع تحسين صغير مع الفريق' }, due_on: due(180), course_id: null, owner: 'employee' } });
  }
  if (asp.includes('move_lateral') || sup.includes('rotation') || prep?.rotation_ok) {
    push({ id: 'shadow', score: 0.7, reasons: [rsn(asp.includes('move_lateral') ? 'aspiration' : 'support', { asp: { en: 'move laterally', ar: 'الانتقال إلى مسار موازٍ' }, need: { en: 'a rotation', ar: 'تدوير وظيفي' } })],
      item: { kind: 'ojt', title: tr ? { en: `Shadow a ${tr.en} for two weeks`, ar: `مرافقة ${tr.ar} لمدة أسبوعين` } : { en: 'Two-week job shadowing in a neighbouring team', ar: 'مرافقة وظيفية لمدة أسبوعين في فريق مجاور' }, due_on: due(90), course_id: null, owner: 'manager' } });
  }
  if (asp.includes('specialise') || sup.includes('mentoring')) {
    push({ id: 'mentor', score: 0.68, reasons: [rsn(sup.includes('mentoring') ? 'support' : 'aspiration', { asp: { en: 'specialise', ar: 'التخصص' }, need: { en: 'mentoring', ar: 'الإرشاد' } })],
      item: { kind: 'mentoring', title: { en: 'Agree a mentor in the target specialism', ar: 'الاتفاق على مرشد في مجال التخصص المستهدف' }, due_on: due(60), course_id: null, owner: 'manager' } });
  }
  if (asp.includes('grow_vertical') || sup.includes('stretch')) {
    push({ id: 'stretch', score: 0.66, reasons: [rsn(sup.includes('stretch') ? 'support' : 'aspiration', { asp: { en: 'grow into the next role', ar: 'التقدم إلى الدور التالي' }, need: { en: 'a stretch assignment', ar: 'مهمة تطويرية' } })],
      item: { kind: 'project', title: tr ? { en: `Stretch assignment towards ${tr.en}`, ar: `مهمة تطويرية نحو ${tr.ar}` } : { en: 'Stretch assignment in the current role', ar: 'مهمة تطويرية في الدور الحالي' }, due_on: due(150), course_id: null, owner: 'manager' } });
  }
  if (asp.includes('stay_deepen')) {
    push({ id: 'deepen', score: 0.6, reasons: [rsn('aspiration', { asp: { en: 'stay and deepen', ar: 'البقاء والتعمق' } })],
      item: { kind: 'reading', title: { en: 'Pick one system to master and teach back to the crew', ar: 'اختيار نظام واحد لإتقانه وشرحه للطاقم' }, due_on: due(120), course_id: null, owner: 'employee' } });
  }
  return out.sort((x, y) => y.score - x.score || (x.id < y.id ? -1 : 1)).slice(0, 6);
}
