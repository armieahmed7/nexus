/**
 * FS33 Skills I want to grow (FS wave D · E3, module M17): pure rules shared by the pages, the LocalBackend (backend/local.fs4.ts),
 * the seed builder and, line for line, the SQL in supabase/migrations/20261010243001_kafaa_fs43_credentials_record_goals.sql
 * (kafaa_sg_*). Import-free.
 *
 *   goal        one skill at a target level by a target date, set from the passport, a skill page (FS07 "Add to my goals") or
 *               /my/skills/goals. The goal row itself is FS07's kafaa_skill_goals (id sg:<person>:<skill>, status active | removed),
 *               which the Coach already reads (m19 rankPathways: "<skill> is one of your skill goals", weight 2 next to the 2030
 *               role gap's 3); FS33 adds the plan (kafaa_skill_goal_plans: target date, note, sharing) through its own RPCs.
 *   sharing     private by default. A goal shared with my manager is readable by managers whose scope covers me (Scope) through
 *               share_person, which is set only while the goal is active and shared; never by HR, the training manager's A grant or
 *               peers (the always-false open_read column blocks R/W/A reads). Withdrawing a goal unshares it.
 *   view        reached (my level is at or above the target), overdue (target date passed), due soon (90 days), on track.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
type Reason = { code: string; key: string; vars?: Record<string, string | number | { en: string; ar: string }>; ref?: { table: string; id: string } };
const R = (code: string, vars?: Reason['vars'], ref?: Reason['ref']): Reason => ({ code, key: `m17.reasons.${code}`, ...(vars ? { vars } : {}), ...(ref ? { ref } : {}) });

export const GOAL_RULES = { maxActive: 12, minDays: 14, maxDays: 1096, noteMax: 300, dueSoonDays: 90, levelMin: 1, levelMax: 4 } as const;
export const goalId = (person: string, skill: string) => `sg:${person}:${skill}`;

/** Refusal and result messages: identical in SQL. */
export const SG_MSG = {
  not_signed_in: 'Sign in to keep skill goals',
  forbidden: 'Skill goals are for staff with a skills passport',
  not_found: 'Skill not found',
  restricted: 'Security skills are not personal goals: they follow the security career path',
  obsolete: 'This skill is obsolete: choose its replacement instead',
  invalid: 'Choose a level from 1 to 4 and a target date between two weeks and three years from today (note up to 300 characters)',
  limit: 'You can keep up to 12 active skill goals: withdraw one first',
  saved: 'Goal saved',
  no_goal: 'This skill is not on your goals',
  withdrawn: 'Goal withdrawn: it is no longer shared and the Coach stops weighing it',
  shared: 'Goal shared with your manager',
  unshared: 'Goal is private again',
  no_change: 'Nothing changes',
  no_plan: 'Add a target date to this goal before sharing it',
} as const;

export interface GoalInput { skill_id: string; target_level: number; target_date: string; note?: string | null; shared?: boolean }
const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
const isInt = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
/** Input check after the skill lookup (same order and codes as kafaa_save_skill_goal). */
export function goalProblem(x: GoalInput, skill: Row | null, today: string, sec: Set<string>): 'ok' | 'not_found' | 'restricted' | 'obsolete' | 'invalid' {
  if (!skill) return 'not_found';
  if (skill.area === 'security' || sec.has(String(skill.competency_id))) return 'restricted';
  if (skill.lifecycle === 'obsolete') return 'obsolete';
  if (!isInt(x.target_level, GOAL_RULES.levelMin, GOAL_RULES.levelMax)) return 'invalid';
  if (typeof x.target_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.target_date) || Number.isNaN(Date.parse(`${x.target_date}T00:00:00Z`))) return 'invalid';
  const d = dayDiff(today, x.target_date);
  if (d < GOAL_RULES.minDays || d > GOAL_RULES.maxDays) return 'invalid';
  if (x.note != null && (typeof x.note !== 'string' || x.note.trim().length > GOAL_RULES.noteMax)) return 'invalid';
  return 'ok';
}

export type GoalStatus = 'reached' | 'overdue' | 'due_soon' | 'on_track' | 'removed';
export interface GoalView { id: string; skill_id: string; target_level: number; target_date: string | null; level: number; gap: number; days_left: number | null; status: GoalStatus; shared: boolean; reasons: Reason[] }
/** The state of one goal today for its holder (or a manager reading a shared goal). */
export function goalView(plan: Row, state: Row | null | undefined, today: string, skillName?: { en: string; ar: string }): GoalView {
  const level = state && state.active !== false ? Number(state.level) || 0 : 0;
  const target = Number(plan.target_level) || 1;
  const date = plan.target_date ? String(plan.target_date).slice(0, 10) : null;
  const days = date ? dayDiff(today, date) : null;
  const gap = Math.max(0, target - level);
  const name = skillName ?? { en: String(plan.skill_id), ar: String(plan.skill_id) };
  const status: GoalStatus = plan.status === 'removed' ? 'removed' : gap === 0 ? 'reached' : days != null && days < 0 ? 'overdue' : days != null && days <= GOAL_RULES.dueSoonDays ? 'due_soon' : 'on_track';
  const reasons: Reason[] = [R(`sg_${status}`, { skill: name, level, target, ...(date ? { date } : {}) }, state?.id ? { table: 'person_skills', id: String(state.id) } : undefined)];
  if (status !== 'reached' && status !== 'removed') reasons.push(R('sg_gap', { gap, skill: name }));
  reasons.push(R(plan.shared ? 'sg_shared' : 'sg_private'));
  return { id: String(plan.id), skill_id: String(plan.skill_id), target_level: target, target_date: date, level, gap, days_left: days, status, shared: plan.shared === true && plan.status !== 'removed', reasons };
}
/** Sort for lists: overdue, due soon, on track, reached, removed; then by date, then skill. */
export const GOAL_ORDER: Record<GoalStatus, number> = { overdue: 0, due_soon: 1, on_track: 2, reached: 3, removed: 4 };
export const sortGoals = (xs: GoalView[]) => [...xs].sort((a, b) => GOAL_ORDER[a.status] - GOAL_ORDER[b.status] || String(a.target_date ?? '9999').localeCompare(String(b.target_date ?? '9999')) || (a.skill_id < b.skill_id ? -1 : a.skill_id > b.skill_id ? 1 : 0));

/** The plan row a goal leaves after save / share / withdraw (share_person only while active and shared). */
export function planRow(person: string, skill: string, x: { target_level: number; target_date: string; note: string | null; shared: boolean; status: 'active' | 'removed' }, now: string, prev?: Row | null): Row {
  return {
    id: goalId(person, skill), person_id: person, skill_id: skill, target_level: x.target_level, target_date: x.target_date, note: x.note, shared: x.shared && x.status === 'active',
    share_person: x.shared && x.status === 'active' ? person : null, status: x.status, open_read: false,
    created_at: prev?.created_at ?? now, updated_at: now, removed_at: x.status === 'removed' ? now : null,
  };
}
