/**
 * EMP-02: suggested courses on /my/plan, ranked by the gap they help close (pure; tested in tests/unit/emp02-plan-suggest.test.ts).
 *   gap       EMP-03 (planGaps): the target role's required level minus the person's OWN level for that competency, read from their
 *             skill states the way My levels and the coach do (SkillsEngine.competencyLevels: the competency's core skill, else the
 *             best of its skills). No evidence for a competency counts as level 0 and is flagged, never filled in from the current
 *             role's requirement (the proxy used before, still shown for comparison). Tested in tests/unit/emp03-plan-own-level.test.tsx.
 *   score     sum, over the course's competencies that have a gap towards the target role, of gap x importance weight
 *             (core 3, important 2, useful 1: the weights the FS34 translator in m18/translate.ts uses)
 *   excluded  courses already on the plan, completed, or with an open enrolment (assigned ... in progress); the initial-training
 *             courses of track stages below the person's current stage (e.g. LOIT and COIT for a licensed Reactor Operator); and
 *             any other initial-training course (GET, ONB ...) once the person is established in a role (past the first stage of
 *             their track, or qualified for their current role)
 *   order     score (highest first), then the shorter course, then the course id; at most `limit` courses
 * Display only: nothing is recorded about the person, and the rule never edits a plan or an enrolment.
 */
import type { Reason } from '../../domain/engines/types';
import { competencyLevels } from '../../domain/engines/skills';
import { trackForRole } from './paths';

export const IMPORTANCE_WEIGHT: Record<string, number> = { core: 3, important: 2, useful: 1 };
/** Enrolment statuses that mean "already doing it" (same list as the digest's OPEN_ENROL) or done. */
export const TAKEN_ENROLMENT = ['assigned', 'requested', 'approved', 'waitlisted', 'enrolled', 'in_progress', 'completed'];
const CURRENT_QUAL = ['qualified', 'due', 'renewed'];
export const SUGGEST_LIMIT = 8;

/** have: the person's own level (0 when not evidenced); roleAsks: what their current role requires (for comparison only). */
export interface PlanGap { competency_id: string; gap: number; have: number; required_level: number; importance: string; roleAsks?: number; evidenced?: boolean }
interface RoleCompIn { role_id: string; competency_id: string; required_level: number; importance: string }

/** The person's own level per competency from their skill states (same rule as My levels' competency view and the coach). */
export function ownCompetencyLevels(states: { skill_id: string; level: number | string; active?: boolean | null }[], skills: { id: string; competency_id: string; core?: boolean | null }[]): Map<string, number> {
  const live = states.filter((s) => s.active !== false && Number(s.level) > 0).map((s) => ({ skill_id: s.skill_id, level: Number(s.level) }));
  return competencyLevels(live, skills.map((s) => ({ id: s.id, competency_id: s.competency_id, core: !!s.core })));
}

/** EMP-03: the competencies where the person's own level is below the target role's requirement, biggest gap first
 *  (then importance, then competency id). */
export function planGaps<R extends RoleCompIn>(x: { roleComps: R[]; targetRoleId: string; currentRoleId: string | null; own: Map<string, number> }): (R & Required<PlanGap>)[] {
  const asks = new Map(x.roleComps.filter((r) => x.currentRoleId && r.role_id === x.currentRoleId).map((r) => [r.competency_id, Number(r.required_level)]));
  const w = (g: PlanGap) => IMPORTANCE_WEIGHT[g.importance] ?? 1;
  return x.roleComps
    .filter((r) => r.role_id === x.targetRoleId)
    .map((r) => {
      const mine = x.own.get(r.competency_id);
      const have = mine ?? 0;
      return { ...r, required_level: Number(r.required_level), have, evidenced: mine != null, roleAsks: asks.get(r.competency_id) ?? 0, gap: Number(r.required_level) - have };
    })
    .filter((g) => g.gap > 0)
    .sort((a, b) => b.gap - a.gap || w(b) - w(a) || (a.competency_id < b.competency_id ? -1 : a.competency_id > b.competency_id ? 1 : 0));
}
interface CourseIn { id: string; code: string; audience: string; initial?: boolean | null; competency_ids?: string[] | null; duration_hours?: number | null }
interface Bi { en: string; ar: string }
export interface SuggestInput<C extends CourseIn> {
  gaps: PlanGap[];
  courses: C[];
  /** Course ids already on the plan. */
  planned: Set<string>;
  /** The person's enrolments (course_id, status). */
  enrolments: { course_id: string; status: string }[];
  /** The person's current job role. */
  roleId: string | null;
  /** The person's qualification records and the standards (to tell whether they are qualified for their current role). */
  quals?: { standard_id: string; status: string }[];
  standards?: { id: string; role_ids?: string[] | null }[];
  /** Competency names for the reasons. */
  compName?: (id: string) => Bi | null;
  limit?: number;
}
export interface Suggestion<C> { course: C; score: number; covers: PlanGap[]; reasons: Reason[] }

/** Course ids of the stages of the person's track that come before their current stage (initial training already behind them). */
export function coursesBelowStage(roleId: string | null): { below: Set<string>; atOrAbove: Set<string>; hereIdx: number } {
  const track = trackForRole(roleId);
  const hereIdx = track && roleId ? track.stages.findIndex((s) => s.roles?.includes(roleId)) : -1;
  const below = new Set<string>();
  const atOrAbove = new Set<string>();
  if (track) track.stages.forEach((s, i) => (s.courses ?? []).forEach((c) => (hereIdx >= 0 && i < hereIdx ? below : atOrAbove).add(c)));
  return { below, atOrAbove, hereIdx };
}

export function rankPlanSuggestions<C extends CourseIn>(x: SuggestInput<C>): Suggestion<C>[] {
  const gapBy = new Map(x.gaps.filter((g) => g.gap > 0).map((g) => [g.competency_id, g]));
  const taken = new Set(x.enrolments.filter((e) => TAKEN_ENROLMENT.includes(e.status)).map((e) => e.course_id));
  const { below, atOrAbove, hereIdx } = coursesBelowStage(x.roleId);
  const roleStd = new Set((x.standards ?? []).filter((s) => x.roleId && (s.role_ids ?? []).includes(x.roleId)).map((s) => s.id));
  const qualifiedForRole = (x.quals ?? []).some((q) => CURRENT_QUAL.includes(q.status) && roleStd.has(q.standard_id));
  const established = hereIdx > 0 || qualifiedForRole;
  const out: Suggestion<C>[] = [];
  for (const c of x.courses) {
    if (c.audience !== 'staff' || x.planned.has(c.id) || taken.has(c.id) || below.has(c.id)) continue;
    if (c.initial && established && !atOrAbove.has(c.id)) continue;
    const covers = (c.competency_ids ?? []).map((k) => gapBy.get(k)).filter((g): g is PlanGap => !!g);
    if (!covers.length) continue;
    const score = covers.reduce((s, g) => s + g.gap * (IMPORTANCE_WEIGHT[g.importance] ?? 1), 0);
    covers.sort((a, b) => b.gap * (IMPORTANCE_WEIGHT[b.importance] ?? 1) - a.gap * (IMPORTANCE_WEIGHT[a.importance] ?? 1) || (a.competency_id < b.competency_id ? -1 : 1));
    const reasons: Reason[] = covers.slice(0, 3).map((g) => ({
      code: 'plan_gap', key: `m04.plan.why.gap_${IMPORTANCE_WEIGHT[g.importance] ? g.importance : 'useful'}`,
      vars: { comp: x.compName?.(g.competency_id) ?? { en: g.competency_id, ar: g.competency_id }, gap: g.gap, need: g.required_level },
    }));
    reasons.push({ code: 'plan_new', key: 'm04.plan.why.new', vars: {} });
    out.push({ course: c, score, covers, reasons });
  }
  out.sort((a, b) => b.score - a.score || (Number(a.course.duration_hours ?? 0) - Number(b.course.duration_hours ?? 0)) || (a.course.id < b.course.id ? -1 : a.course.id > b.course.id ? 1 : 0));
  return out.slice(0, x.limit ?? SUGGEST_LIMIT);
}

