// FS81 Transition plans and ladder-rung protection (FS wave I · E3, M30): the pure rules shared by the pages, the LocalBackend RPCs,
// the seed builder and (mirrored in SQL) supabase/migrations/20261010293001_kafaa_fs93_transition_plans.sql. Import-free apart from
// the FS11 rule file it builds on (transform.ts, itself import-free) and types, so node seed and validator scripts load it directly.
// PGlite proves SQL = TS on the seed and on generated cases (scripts/validate/fs93-transition-plans.mjs).
//
// Benchmarks: SkillsFuture Singapore (2025) role archetypes: for Mastery Builders "skill grows step by step on the job; the risk is
// that tools take on the junior tasks people used to learn on"; Jobs Transformation Maps (Workforce Singapore, 2025): a dated
// reskilling path per changing role; corporate reskilling programmes (AT&T and others): role changes managed as an investment in
// the person, with a protected role while they retrain.
//
// A transition plan (SIMULATED HR record) is for one person whose role is changing: the role kept (protected) while they retrain,
// the retraining plan, the target role, the horizon and dated reviews. It is visible to the person and to HR (transformation A)
// only: managers get nothing, whatever their scope.
//
// rungAlert(role): for a Mastery Builder role (published FS11 map, archetype mastery_builder), the "junior tasks" are the rated tasks
// of the rungs below it on the career ladder (vertical moves into the role) and the role's own routine (non-critical) tasks. When
// FS06 shows such a task moving to tools (band automate_partly = FS11 move "shrink") by the plan horizon, the alert names the task and
// the synthetic practice that keeps the judgement it built: approved simulator scenarios (F28) for the role's position that train a
// competency the task needs, and OJT repetitions (F38) of the task's own qualification-card task, else of a qualification-card task
// of the same role that shares a skill and stays with people. A plan names, for every alerted task, the practice it adds; a plan
// cannot become active while a task has none.
import { bannedWording, isPathOnly, mapTasks, type MapTask, type SkillLite, type TaskLite, type TaskSkillLite } from './transform.ts';
import type { CapLevel } from '../m26/future.ts';
import type { Reason } from '../../domain/engines/types';

export const FS81 = 'FS81';
export const PLAN_HORIZONS = ['2030', '2035'] as const;
export type PlanHorizon = (typeof PLAN_HORIZONS)[number];
export const HORIZON_RANK: Record<string, number> = { now: 0, '2030': 1, '2035': 2 };
export const TRIGGERS = ['task_automation', 'role_redesign', 'new_technology', 'career_move'] as const;
export const PLAN_STATUSES = ['draft', 'active', 'completed', 'withdrawn'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];
export const RETRAIN_KINDS = ['course', 'practice', 'microcred', 'rotation', 'mentoring'] as const;
export const PRACTICE_KINDS = ['simulator', 'ojt'] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];
export const REVIEW_OUTCOMES = ['on_track', 'at_risk'] as const;
export const CLOSE_OUTCOMES = ['completed', 'withdrawn'] as const;
/** Simulator positions of the operations ladder (F28 sim_scenarios.positions). Roles without a position practise through OJT. */
export const SIM_POSITION: Record<string, string> = {
  'local-operator': 'lo', 'reactor-operator': 'ro', 'senior-reactor-operator': 'sro', 'shift-supervisor': 'ss', 'shift-technical-advisor': 'sta',
};
export const FIDELITY_RANK: Record<string, number> = { full_scope: 0, limited_scope: 1, desktop: 2 };
export const SIM_REPS = { def: 2, max: 6 } as const;
export const OJT_REPS = { def: 3, max: 10 } as const;
/** Reviews at most every six months (183 days), from the start date and between reviews. */
export const REVIEW_MAX_GAP = 183;
/** A review may be recorded from 14 days before its date; "due soon" uses the same window. */
export const REVIEW_WINDOW = 14;
export const MAX_REVIEWS = 12;
export const MAX_ITEMS = 20;
export const TITLE_MAX = 160;
export const NOTE_MAX = 600;
export const HOURS_MAX = 400;

const R = (code: string, vars: Record<string, string | number> = {}): Reason => ({ code, key: `m30.reasons.${code}`, vars });
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ───────────── dates (UTC calendar days, like SQL date arithmetic)
export function isDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s) || s.startsWith('0000')) return false; // year 0 is not a SQL date
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const dayNo = (s: string) => Math.floor(Date.parse(`${s}T00:00:00Z`) / 86400000);
export const daysFrom = (a: string, b: string) => dayNo(b) - dayNo(a);
export const addDays = (s: string, n: number) => new Date((dayNo(s) + n) * 86400000).toISOString().slice(0, 10);

// ───────────── world
export interface RoleRow { id: string; family_id: string; lifecycle?: string | null; security_sensitive?: boolean | null; sort?: number | null }
export interface MapRow { role_id: string; archetype: string | null; status: string }
export interface PathRow { from_role_id: string | null; to_role_id: string; type: string; kind?: string | null }
export interface TaskRow extends TaskLite { task_item_id?: string | null }
export interface ScenarioRow { id: string; code: string; title_en: string; title_ar: string; status: string; positions: string[]; competency_ids: string[]; fidelity: string; duration_min: number }
export interface RungWorld {
  roles: RoleRow[]; maps: MapRow[]; paths: PathRow[]; tasks: TaskRow[]; levels: CapLevel[]; taskSkills: TaskSkillLite[]; skills: SkillLite[]; scenarios: ScenarioRow[];
}
export interface PracticeItem { task_id: string; kind: PracticeKind; ref_id: string; reps: number }
export interface PracticeOption {
  kind: PracticeKind; ref_id: string; code: string; title_en: string; title_ar: string; basis: 'shared_competency' | 'own_task' | 'shared_skill';
  overlap: number; minutes: number | null; fidelity: string | null; reps: number; reasons: Reason[];
}
export interface AlertTask {
  task_id: string; role_id: string; rung: 'below' | 'own'; code: string; title_en: string; title_ar: string; horizon: string; driver: string | null;
  reasons: Reason[]; options: PracticeOption[]; practice: PracticeItem[]; covered: boolean;
}
export interface RungAlert {
  role_id: string | null; basis: 'target' | 'protected' | 'none'; archetype: string | null; applies: boolean; fires: boolean; horizon: PlanHorizon;
  rungs: string[]; tasks: AlertTask[]; covered: number; uncovered: string[]; reasons: Reason[];
}

const horizonOf = (h: unknown): PlanHorizon => (h === '2035' ? '2035' : '2030');
const isCurrent = (r: RoleRow | undefined) => !!r && (r.lifecycle ?? 'current') === 'current';
const roleSort = (roles: RoleRow[]) => { const m = new Map(roles.map((r) => [r.id, Number(r.sort ?? 0)])); return (a: string, b: string) => (m.get(a) ?? 0) - (m.get(b) ?? 0) || cmp(a, b); };

/** A current, non-restricted role whose published FS11 map has the Mastery Builder archetype. */
export function isMasteryBuilder(roleId: string | null | undefined, w: Pick<RungWorld, 'roles' | 'maps'>): boolean {
  const r = w.roles.find((x) => x.id === roleId);
  if (!isCurrent(r) || isPathOnly(r)) return false;
  return w.maps.some((m) => m.role_id === roleId && m.status === 'published' && m.archetype === 'mastery_builder');
}
/** The rungs below a role on the career ladder: current roles with a vertical (non-future) move into it, ordered by role sort. */
export function rungsBelow(roleId: string, w: Pick<RungWorld, 'roles' | 'paths'>): string[] {
  const roles = new Map(w.roles.map((r) => [r.id, r]));
  const ids = new Set<string>();
  for (const p of w.paths) {
    if (p.to_role_id !== roleId || p.type !== 'vertical' || (p.kind ?? 'current') === 'future' || !p.from_role_id || p.from_role_id === roleId) continue;
    const r = roles.get(p.from_role_id);
    if (isCurrent(r) && !isPathOnly(r)) ids.add(p.from_role_id);
  }
  return [...ids].sort(roleSort(w.roles));
}

function taskCompetencies(taskId: string, w: Pick<RungWorld, 'taskSkills' | 'skills'>): Set<string> {
  const sk = new Map(w.skills.map((s) => [s.id, s]));
  const out = new Set<string>();
  for (const x of w.taskSkills) if (x.active && x.task_id === taskId) { const c = sk.get(x.skill_id)?.competency_id; if (c) out.add(c); }
  return out;
}
const taskSkillSet = (taskId: string, w: Pick<RungWorld, 'taskSkills'>) => new Set(w.taskSkills.filter((x) => x.active && x.task_id === taskId).map((x) => x.skill_id));

/** Every eligible practice for one alerted task: simulator scenarios first (most shared competencies, full scope first, shortest),
 *  then OJT on the task's own qualification-card task, else on qualification-card tasks of the task's role that share a skill and
 *  stay with people (most shared skills first). */
export function practiceOptions(task: Pick<TaskRow, 'id' | 'role_id'>, alertRoleId: string, w: RungWorld): PracticeOption[] {
  const out: PracticeOption[] = [];
  const pos = SIM_POSITION[alertRoleId];
  const comps = taskCompetencies(task.id, w);
  if (pos) {
    const sims = w.scenarios
      .filter((s) => s.status === 'approved' && (s.positions ?? []).includes(pos))
      .map((s) => ({ s, overlap: (s.competency_ids ?? []).filter((c) => comps.has(c)).length }))
      .filter((x) => x.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap || (FIDELITY_RANK[a.s.fidelity] ?? 9) - (FIDELITY_RANK[b.s.fidelity] ?? 9) || Number(a.s.duration_min) - Number(b.s.duration_min) || cmp(a.s.id, b.s.id));
    for (const { s, overlap } of sims) {
      out.push({ kind: 'simulator', ref_id: s.id, code: s.code, title_en: s.title_en, title_ar: s.title_ar, basis: 'shared_competency', overlap, minutes: Number(s.duration_min), fidelity: s.fidelity, reps: SIM_REPS.def,
        reasons: [R('opt_sim', { overlap, position: pos.toUpperCase(), minutes: Number(s.duration_min) }), R(`opt_fidelity_${s.fidelity}`)] });
    }
  }
  const own = w.tasks.find((t) => t.id === task.id);
  if (own?.task_item_id) {
    out.push({ kind: 'ojt', ref_id: own.task_item_id, code: own.code, title_en: own.title_en, title_ar: own.title_ar, basis: 'own_task', overlap: 0, minutes: null, fidelity: null, reps: OJT_REPS.def,
      reasons: [R('opt_ojt_own', { reps: OJT_REPS.def })] });
  } else {
    const mine = taskSkillSet(task.id, w);
    const human = new Set(mapTasks(w.tasks, w.levels, task.role_id).filter((t) => t.move !== 'shrink').map((t) => t.id));
    const sib = w.tasks
      .filter((t) => t.role_id === task.role_id && t.id !== task.id && !!t.task_item_id && human.has(t.id))
      .map((t) => ({ t, shared: [...taskSkillSet(t.id, w)].filter((x) => mine.has(x)).length }))
      .filter((x) => x.shared > 0)
      .sort((a, b) => b.shared - a.shared || Number(a.t.sort) - Number(b.t.sort) || cmp(a.t.id, b.t.id));
    for (const { t, shared } of sib) {
      out.push({ kind: 'ojt', ref_id: t.task_item_id as string, code: t.code, title_en: t.title_en, title_ar: t.title_ar, basis: 'shared_skill', overlap: shared, minutes: null, fidelity: null, reps: OJT_REPS.def,
        reasons: [R('opt_ojt_sibling', { shared, reps: OJT_REPS.def })] });
    }
  }
  return out;
}

/** The junior tasks of a Mastery Builder role that move to tools by the horizon (rungs below first, then the role's own routine tasks). */
export function juniorTasks(roleId: string, horizon: PlanHorizon, w: RungWorld): (MapTask & { role_id: string; rung: 'below' | 'own' })[] {
  const lim = HORIZON_RANK[horizon];
  const out: (MapTask & { role_id: string; rung: 'below' | 'own' })[] = [];
  const pick = (rid: string, rung: 'below' | 'own') => {
    for (const t of mapTasks(w.tasks, w.levels, rid)) {
      if (t.move !== 'shrink' || (HORIZON_RANK[t.horizon] ?? 9) > lim || (rung === 'own' && t.critical)) continue;
      out.push({ ...t, role_id: rid, rung });
    }
  };
  for (const rid of rungsBelow(roleId, w)) pick(rid, 'below');
  pick(roleId, 'own');
  return out;
}

/** The ladder-rung alert of one role at a horizon, with the practice a plan adds (empty for the role-level view). */
export function rungAlert(roleId: string | null, horizon: unknown, practice: PracticeItem[], w: RungWorld, basis: RungAlert['basis'] = 'target'): RungAlert {
  const h = horizonOf(horizon);
  const map = w.maps.find((m) => m.role_id === roleId && m.status === 'published');
  const base: RungAlert = { role_id: roleId, basis: roleId ? basis : 'none', archetype: map?.archetype ?? null, applies: false, fires: false, horizon: h, rungs: [], tasks: [], covered: 0, uncovered: [], reasons: [] };
  if (!roleId || !isMasteryBuilder(roleId, w)) return { ...base, reasons: [R(roleId ? 'rung_not_mastery' : 'rung_no_role')] };
  const rungs = rungsBelow(roleId, w);
  const items = Array.isArray(practice) ? practice : [];
  const tasks: AlertTask[] = juniorTasks(roleId, h, w).map((t) => {
    const options = practiceOptions({ id: t.id, role_id: t.role_id }, roleId, w);
    const mine = items.filter((p) => p && typeof p === 'object' && p.task_id === t.id && options.some((o) => o.kind === p.kind && o.ref_id === p.ref_id))
      .map((p) => ({ task_id: p.task_id, kind: p.kind, ref_id: p.ref_id, reps: typeof p.reps === 'number' ? p.reps : 0 }));
    const covered = mine.length > 0;
    return {
      task_id: t.id, role_id: t.role_id, rung: t.rung, code: t.code, title_en: t.title_en, title_ar: t.title_ar, horizon: t.horizon, driver: t.driver,
      reasons: [R(t.rung === 'below' ? 'rung_task_below' : 'rung_task_own', { horizon: t.horizon }), ...t.reasons, R(covered ? 'rung_covered' : 'rung_uncovered', { n: mine.length })],
      options, practice: mine, covered,
    };
  });
  const uncovered = tasks.filter((t) => !t.covered).map((t) => t.task_id);
  const fires = tasks.length > 0;
  return {
    ...base, applies: true, fires, rungs, tasks, covered: tasks.length - uncovered.length, uncovered,
    reasons: [R('rung_mastery'), fires ? R('rung_tasks', { n: tasks.length, rungs: rungs.length, horizon: h }) : R('rung_none', { horizon: h })],
  };
}

/** The role a plan's alert is about: the target role when it is a Mastery Builder role, else the protected role when it is one. */
export function alertRoleOf(plan: { target_role_id?: string | null; protected_role_id?: string | null }, w: Pick<RungWorld, 'roles' | 'maps'>): { role_id: string | null; basis: RungAlert['basis'] } {
  if (isMasteryBuilder(plan.target_role_id, w)) return { role_id: plan.target_role_id as string, basis: 'target' };
  if (isMasteryBuilder(plan.protected_role_id, w)) return { role_id: plan.protected_role_id as string, basis: 'protected' };
  return { role_id: null, basis: 'none' };
}
export function planAlert(plan: { target_role_id?: string | null; protected_role_id?: string | null; horizon?: string | null; practice?: unknown }, w: RungWorld): RungAlert {
  const a = alertRoleOf(plan, w);
  const alert = rungAlert(a.role_id, plan.horizon, (Array.isArray(plan.practice) ? plan.practice : []) as PracticeItem[], w, a.basis);
  return a.role_id ? { ...alert, reasons: [R(`rung_role_${a.basis}`), ...alert.reasons] } : alert;
}
/** Role-level ladder-rung alerts (no person): every Mastery Builder role at the horizon, ordered by role sort. */
export function roleRungAlerts(horizon: unknown, w: RungWorld): RungAlert[] {
  return w.roles.filter((r) => isMasteryBuilder(r.id, w)).map((r) => r.id).sort(roleSort(w.roles)).map((id) => rungAlert(id, horizon, [], w));
}

// ───────────── plan checks (order mirrored by SQL kafaa_tp_problem)
export type PlanCode =
  | 'invalid_person' | 'self_plan' | 'open_plan_exists' | 'invalid_role' | 'invalid_horizon' | 'invalid_trigger' | 'invalid_dates' | 'reviews_required'
  | 'invalid_retraining' | 'invalid_practice' | 'banned_wording' | 'retraining_required' | 'rung_practice_required';
export const TP_MSG = {
  not_signed_in: 'Sign in first',
  forbidden: 'Transition plans are decided by HR (transformation A) only',
  not_found: 'Transition plan not found',
  not_editable: 'Completed or withdrawn plans cannot be changed',
  invalid_person: 'Choose an active staff member (the person of a plan cannot change)',
  self_plan: 'You cannot decide your own transition plan: another HR decision-maker must',
  open_plan_exists: 'This person already has an open transition plan',
  invalid_role: 'Choose the protected role (the person\'s current role) and a different target role (a current or concept role)',
  invalid_horizon: 'Choose the 2030 or 2035 horizon',
  invalid_trigger: 'Choose why the role is changing',
  invalid_dates: 'Dates must be real dates: the plan ends after it starts, and the role stays protected until a date within the plan',
  reviews_required: 'Plans carry review dates: 1 to 12, in order, within the plan, at most 183 days apart (from the start)',
  invalid_retraining: 'Each retraining step needs a kind, English and Arabic titles (up to 160 characters), 1 to 400 hours and a due date within the plan; a course step names a catalogue course',
  invalid_practice: 'Practice must be an eligible simulator scenario or OJT task for an alerted task, each once, with 1 to 6 simulator runs or 1 to 10 OJT repetitions',
  banned_wording: 'Describe how tasks change, not people: wording such as "replace" or "redundant" is not used (English and Arabic)',
  retraining_required: 'An active plan needs at least one retraining step',
  rung_practice_required: 'Ladder-rung alert: add simulator or OJT practice for every junior task moving to tools before activating the plan',
  no_review_due: 'No review is due yet (a review can be recorded from 14 days before its date)',
  invalid_outcome: 'Choose a review outcome (on track or at risk) and, when no review date is left, the next one (within 183 days and the plan)',
  invalid_close: 'Choose completed or withdrawn and give a reason (5 to 600 characters)',
  not_active: 'Only an active plan can be reviewed, acknowledged or closed',
  not_person: 'Only the person can acknowledge their plan',
  already: 'Already acknowledged',
} as const;

export interface RetrainItem { kind: string; ref_id?: string | null; title_en: string; title_ar: string; hours: number; due_on: string }
export interface PlanInput {
  plan_id?: string | null; person_id: string; protected_role_id: string; protected_until: string; target_role_id: string; horizon: string; trigger: string;
  start_on: string; end_on: string; review_dates: string[]; retraining: RetrainItem[]; practice: PracticeItem[]; note_en?: string; note_ar?: string; activate?: boolean;
}
export interface ReviewEntry { due_on: string; done_on: string | null; outcome: string | null; note: string | null; by: string | null }
export interface PlanRow {
  id: string; person_id: string; current_role_id: string | null; protected_role_id: string; protected_until: string; target_role_id: string; horizon: string; trigger: string;
  start_on: string; end_on: string; reviews: ReviewEntry[]; next_review_on: string | null; retraining: RetrainItem[]; practice: PracticeItem[];
  note_en: string; note_ar: string; status: PlanStatus; simulated: boolean; acknowledged_at: string | null; revision: number; history: unknown[];
  created_by: string | null; created_at: string; updated_by: string | null; updated_at: string; activated_by: string | null; activated_at: string | null; closed_by: string | null; closed_at: string | null; close_note: string | null;
}
export interface PersonRow { id: string; kind: string; status: string; job_role_id: string | null }
export interface CheckCtx { me: string; people: PersonRow[]; plans: Pick<PlanRow, 'id' | 'person_id' | 'status' | 'reviews'>[]; courseIds: string[]; world: RungWorld }

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : null);
const isInt = (v: unknown, lo: number, hi: number) => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const textOk = (v: unknown, lo: number, hi: number) => { const x = s(v); return x !== null && x.length >= lo && x.length <= hi; };
const optText = (v: unknown, hi: number) => v === undefined || v === null || (typeof v === 'string' && v.trim().length <= hi);

/** The done reviews of a stored plan (kept on every save). */
export const doneReviews = (plan: Pick<PlanRow, 'reviews'> | null | undefined): ReviewEntry[] => (Array.isArray(plan?.reviews) ? plan!.reviews.filter((r) => r && r.done_on) : []);
/** The first review without a done date. */
export const nextReview = (reviews: ReviewEntry[]): string | null => reviews.find((r) => !r.done_on)?.due_on ?? null;

/** Review cadence over all due dates (done ones first): in order, strictly after the start, on or before the end, gaps <= 183 days. */
export function reviewsOk(start: string, end: string, dues: string[]): boolean {
  if (dues.length < 1 || dues.length > MAX_REVIEWS || !dues.every(isDate)) return false;
  let prev = start;
  for (const d of dues) {
    if (daysFrom(prev, d) <= 0 || daysFrom(prev, d) > REVIEW_MAX_GAP || daysFrom(d, end) < 0) return false;
    prev = d;
  }
  return true;
}

export function planProblem(input: Partial<PlanInput> | null | undefined, cur: Pick<PlanRow, 'id' | 'person_id' | 'reviews'> | null, ctx: CheckCtx): PlanCode | null {
  const p = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const pid = s(p.person_id);
  const person = ctx.people.find((x) => x.id === pid);
  if (!person || person.kind !== 'staff' || person.status !== 'active' || (cur && cur.person_id !== pid)) return 'invalid_person';
  if (pid === ctx.me) return 'self_plan';
  if (!cur && ctx.plans.some((x) => x.person_id === pid && (x.status === 'draft' || x.status === 'active'))) return 'open_plan_exists';
  const roles = new Map(ctx.world.roles.map((r) => [r.id, r]));
  const prot = roles.get(String(s(p.protected_role_id)));
  const tgt = roles.get(String(s(p.target_role_id)));
  if (!prot || !tgt || !isCurrent(prot) || prot.id !== person.job_role_id || tgt.id === prot.id || !['current', 'concept'].includes(tgt.lifecycle ?? 'current')) return 'invalid_role';
  if (!(PLAN_HORIZONS as readonly unknown[]).includes(p.horizon)) return 'invalid_horizon';
  if (!(TRIGGERS as readonly unknown[]).includes(p.trigger)) return 'invalid_trigger';
  const start = p.start_on, end = p.end_on, until = p.protected_until;
  if (!isDate(start) || !isDate(end) || !isDate(until) || daysFrom(start, end) <= 0 || daysFrom(start, until) < 0 || daysFrom(until, end) < 0) return 'invalid_dates';
  const pend = Array.isArray(p.review_dates) ? p.review_dates : null;
  const done = doneReviews(cur);
  if (!pend || !reviewsOk(start, end, [...done.map((r) => r.due_on), ...(pend as string[])])) return 'reviews_required';
  const rt = Array.isArray(p.retraining) ? p.retraining : null;
  if (!rt || rt.length > MAX_ITEMS || rt.some((x) => {
    const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    return !(RETRAIN_KINDS as readonly unknown[]).includes(r.kind) || !textOk(r.title_en, 1, TITLE_MAX) || !textOk(r.title_ar, 1, TITLE_MAX) || !isInt(r.hours, 1, HOURS_MAX)
      || !isDate(r.due_on) || daysFrom(start, r.due_on as string) < 0 || daysFrom(r.due_on as string, end) < 0
      || !(r.ref_id === undefined || r.ref_id === null || typeof r.ref_id === 'string')
      || (r.kind === 'course' && !ctx.courseIds.includes(String(r.ref_id ?? '')));
  })) return 'invalid_retraining';
  const pr = Array.isArray(p.practice) ? p.practice : null;
  const alert = planAlert({ target_role_id: tgt.id, protected_role_id: prot.id, horizon: p.horizon as string, practice: [] }, ctx.world);
  const seen = new Set<string>();
  if (!pr || pr.length > MAX_ITEMS || pr.some((x) => {
    const r = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    const task = alert.tasks.find((t) => t.task_id === r.task_id);
    const key = `${r.task_id}|${r.kind}|${r.ref_id}`;
    const bad = !task || !task.options.some((o) => o.kind === r.kind && o.ref_id === r.ref_id) || seen.has(key)
      || !isInt(r.reps, 1, r.kind === 'simulator' ? SIM_REPS.max : OJT_REPS.max);
    seen.add(key);
    return bad;
  })) return 'invalid_practice';
  if (!optText(p.note_en, NOTE_MAX) || !optText(p.note_ar, NOTE_MAX)) return 'invalid_retraining';
  const texts = [p.note_en, p.note_ar, ...rt.flatMap((x) => [(x as RetrainItem).title_en, (x as RetrainItem).title_ar])];
  if (texts.some((t) => bannedWording(t) !== null)) return 'banned_wording';
  if (p.activate === true) {
    if (rt.length === 0) return 'retraining_required';
    const full = planAlert({ target_role_id: tgt.id, protected_role_id: prot.id, horizon: p.horizon as string, practice: pr as PracticeItem[] }, ctx.world);
    if (full.uncovered.length > 0) return 'rung_practice_required';
  }
  return null;
}

/** Clean stored forms of the input lists (same keys and order as SQL kafaa_tp_clean_*). */
export const cleanRetraining = (rt: RetrainItem[]): RetrainItem[] => rt.map((r) => ({ kind: r.kind, ref_id: r.ref_id ? String(r.ref_id) : null, title_en: String(r.title_en).trim(), title_ar: String(r.title_ar).trim(), hours: Number(r.hours), due_on: r.due_on }));
export const cleanPractice = (pr: PracticeItem[]): PracticeItem[] => pr.map((x) => ({ task_id: x.task_id, kind: x.kind, ref_id: x.ref_id, reps: Number(x.reps) }));
export const planIdFor = (personId: string, plans: Pick<PlanRow, 'person_id'>[]) => `tp-${personId}-${plans.filter((x) => x.person_id === personId).length + 1}`;

// ───────────── review state and practice progress
export type ReviewState = 'none' | 'on_time' | 'due_soon' | 'overdue';
export function reviewState(next: string | null | undefined, today: string): ReviewState {
  if (!next) return 'none';
  const d = daysFrom(today, next);
  return d < 0 ? 'overdue' : d <= REVIEW_WINDOW ? 'due_soon' : 'on_time';
}
export interface OjtLogLite { person_id: string; task_id: string; status: string; on_date: string }
export interface ProgressRow { task_id: string; kind: PracticeKind; ref_id: string; reps: number; done: number | null }
/** OJT repetitions acknowledged by a preceptor since the plan started count as done; simulator runs are booked through the F28 plan (null). */
export function practiceProgress(plan: Pick<PlanRow, 'person_id' | 'start_on' | 'practice'>, logs: OjtLogLite[]): ProgressRow[] {
  return (plan.practice ?? []).map((x) => ({
    task_id: x.task_id, kind: x.kind, ref_id: x.ref_id, reps: Number(x.reps),
    done: x.kind === 'ojt' ? logs.filter((l) => l.person_id === plan.person_id && l.task_id === x.ref_id && l.status === 'acknowledged' && daysFrom(String(plan.start_on), String(l.on_date).slice(0, 10)) >= 0).length : null,
  }));
}
export const STATUS_ORDER: Record<string, number> = { active: 0, draft: 1, completed: 2, withdrawn: 3 };

/** People HR can open a plan for: active staff in a current role, with their open plan if any (ordered by person id). */
export interface Candidate { person_id: string; name: string; name_ar: string; role_id: string; open_plan_id: string | null }
export function planCandidates(people: (PersonRow & { display_name?: string | null; display_name_ar?: string | null })[], roles: RoleRow[], plans: Pick<PlanRow, 'id' | 'person_id' | 'status'>[]): Candidate[] {
  const cur = new Map(roles.map((r) => [r.id, r]));
  return people
    .filter((p) => p.kind === 'staff' && p.status === 'active' && !!p.job_role_id && isCurrent(cur.get(p.job_role_id)))
    .sort((a, b) => cmp(a.id, b.id))
    .map((p) => ({
      person_id: p.id, name: String(p.display_name ?? p.id), name_ar: String(p.display_name_ar ?? p.display_name ?? p.id), role_id: p.job_role_id as string,
      open_plan_id: plans.filter((x) => x.person_id === p.id && (x.status === 'draft' || x.status === 'active')).map((x) => x.id).sort(cmp)[0] ?? null,
    }));
}
/** The editor preview: the first problem of an input (as saving would refuse it) and the alert of its roles with its practice. */
export function previewOf(input: Partial<PlanInput> | null | undefined, cur: Pick<PlanRow, 'id' | 'person_id' | 'reviews' | 'status'> | null, ctx: CheckCtx): { problem: PlanCode | null; alert: RungAlert } {
  const p = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const activate = p.activate === true || cur?.status === 'active';
  const role = (k: string) => (typeof p[k] === 'string' ? (p[k] as string).trim() : null);
  return {
    problem: planProblem({ ...p, activate } as Partial<PlanInput>, cur, ctx),
    alert: planAlert({ target_role_id: role('target_role_id'), protected_role_id: role('protected_role_id'), horizon: typeof p.horizon === 'string' ? p.horizon : null, practice: p.practice }, ctx.world),
  };
}
