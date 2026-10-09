/**
 * F07: assemble the coach input from repository rows (the page) or seed tables (tests), so both run the same mapping.
 * Targets come from the person's coach focus roles, the F05 shortlist (career_targets, when that table exists) and
 * the target role of an open development plan, in that order. Active F09 Future Me goals (future_goals) add their skills
 * as extra needs at the target-role weight.
 */
import { competencyLevels } from '../../domain/engines/skills';
import type { Weights } from '../../domain/engines/types';
import type { CoachInput } from './coach';

// Rows are passed as loose records: the shape is checked by the CoachInput fields that read them.
type Rows = Record<string, unknown>[];
export interface CoachTables {
  person: { id: string; job_role_id?: string | null; crew?: string | null } | null;
  person_skills: Rows; skills: Rows; job_roles: Rows; role_competencies: Rows; competencies: Rows; courses: Rows; sessions: Rows;
  enrolments: Rows; training_records: Rows; qual_records: Rows; qual_standards: Rows; requal_rules: Rows; curriculum_rules: Rows;
  assessment_forms: Rows; items: Rows; task_items: Rows; evaluations: Rows; mentors: Rows; mentoring_requests: Rows; oe_lessons: Rows;
  dev_plans: Rows; coach_feedback: Rows; learning_goals: Rows; career_targets?: Rows; opportunities?: Rows; future_goals?: Rows;
  programmes?: Rows; faqs?: Rows; course_modules?: Rows;
}
const PLAN_OPEN = ['draft', 'submitted', 'approved', 'active'];

export function targetCandidates(t: Pick<CoachTables, 'learning_goals' | 'career_targets' | 'dev_plans' | 'person'>): string[] {
  const me = t.person?.id;
  const goal = t.learning_goals.find((g) => g.person_id === me) as { focus_role_ids?: string[] } | undefined;
  const shortlist = (t.career_targets ?? []).filter((x) => x.person_id === me && x.active !== false).sort((a, b) => Number(a.rank ?? 0) - Number(b.rank ?? 0)).map((x) => String(x.role_id));
  const plans = t.dev_plans.filter((p) => p.person_id === me && PLAN_OPEN.includes(String(p.status))).sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))).map((p) => String(p.target_role_id));
  return [...(goal?.focus_role_ids ?? []), ...shortlist, ...plans];
}

export function coachInputFrom(t: CoachTables, now: string, extra: { availability?: CoachInput['availability']; weights?: Weights; lineManager?: string | null } = {}): CoachInput | null {
  if (!t.person) return null;
  const me = t.person.id;
  const mine = (rows: Rows) => rows.filter((x) => x.person_id === me);
  const states = mine(t.person_skills).filter((s) => s.active !== false);
  const have = competencyLevels(states as never, t.skills as never);
  return {
    now, personId: me, roleId: t.person.job_role_id ?? null, crew: t.person.crew ?? null, targets: targetCandidates(t), have,
    roles: t.job_roles as never, roleComps: t.role_competencies as never, competencies: t.competencies as never, courses: t.courses as never, sessions: t.sessions as never,
    availability: extra.availability, enrolments: mine(t.enrolments) as never, records: mine(t.training_records) as never, quals: mine(t.qual_records) as never,
    standards: t.qual_standards as never, requalRules: t.requal_rules as never, curriculum: t.curriculum_rules as never, forms: t.assessment_forms as never, items: t.items as never,
    tasks: t.task_items as never, evaluations: mine(t.evaluations) as never, mentors: t.mentors as never, mentorRequests: mine(t.mentoring_requests) as never, lessons: t.oe_lessons as never,
    opportunities: (t.opportunities ?? []).filter((o) => o.listed !== false && (o.seats == null || Number(o.seats_taken ?? 0) < Number(o.seats))) as never,
    futureGoals: mine(t.future_goals ?? []).filter((g) => (g.status ?? 'active') === 'active') as never, skills: t.skills as never, feedback: mine(t.coach_feedback) as never, weights: extra.weights,
    excludeMentorPersons: extra.lineManager ? [extra.lineManager] : [],
  };
}
