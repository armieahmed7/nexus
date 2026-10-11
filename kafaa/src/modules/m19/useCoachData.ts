// F07: loads everything the coach needs for the signed-in person through the repository (both backends, RLS applies),
// then builds the feed with the F02 engine weights. Tables of later wave features (F05 career_targets, F08 opportunities)
// are read only when they exist in the schema, so the page never requests a table the backend does not have.
import { useMemo } from 'react';
import { SCHEMA } from '../../data/schema';
import { useEngine, useQuery, useRepo, type Table } from '../../data';
import { useSession } from '../../auth/session';
import { todayIso } from '../../domain/rules';
import { buildCoachFeed, type CoachResult } from './coach';
import { coachInputFrom, type CoachTables } from './inputs';

const has = (t: string) => Object.prototype.hasOwnProperty.call(SCHEMA, t);

export function useCoachData() {
  const repo = useRepo();
  const s = useSession();
  const eng = useEngine('recommend');
  const me = s.identity.personId;
  const tables: Table[] = ['person_skills', 'enrolments', 'training_records', 'qual_records', 'coach_feedback', 'learning_goals', 'dev_plans', 'mentoring_requests', 'sessions', 'evaluations', ...(['career_targets', 'opportunities', 'future_goals', 'career_conversations'].filter(has) as Table[])];
  const q = useQuery(tables, async () => {
    if (!me) return null;
    const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
    const mine = { filter: { person_id: me } } as never;
    const [person, person_skills, skills, job_roles, role_competencies, competencies, courses, sessions, enrolments, training_records, qual_records, qual_standards, requal_rules, curriculum_rules,
      assessment_forms, items, task_items, evaluations, mentors, mentoring_requests, oe_lessons, dev_plans, coach_feedback, learning_goals, career_targets, opportunities, programmes, faqs, course_modules, future_goals, career_conversations] = await Promise.all([
      repo.get('people', me),
      safe(repo.list('person_skills', mine)), safe(repo.list('skills')), safe(repo.list('job_roles', { order: [['sort', 'asc']] })), safe(repo.list('role_competencies')), safe(repo.list('competencies')),
      safe(repo.list('courses')), safe(repo.list('sessions', { order: [['starts_at', 'asc']] })), safe(repo.list('enrolments', mine)), safe(repo.list('training_records', mine)),
      safe(repo.list('qual_records', mine)), safe(repo.list('qual_standards')), safe(repo.list('requal_rules')), safe(repo.list('curriculum_rules')),
      safe(repo.list('assessment_forms', { filter: { is_practice: true } })), safe(repo.list('items', { filter: { bank: 'practice' } })), safe(repo.list('task_items')), safe(repo.list('evaluations', mine)),
      safe(repo.list('mentors')), safe(repo.list('mentoring_requests', mine)), safe(repo.list('oe_lessons')), safe(repo.list('dev_plans', mine)),
      safe(repo.list('coach_feedback', mine)), safe(repo.list('learning_goals', mine)),
      has('career_targets') ? safe(repo.list('career_targets' as Table, mine)) : Promise.resolve([]),
      has('opportunities') ? safe(repo.list('opportunities' as Table, { filter: { status: 'open' } } as never)) : Promise.resolve([]),
      safe(repo.list('programmes')), safe(repo.list('faqs', { order: [['sort', 'asc']] })), safe(repo.list('course_modules')),
      has('future_goals') ? safe(repo.list('future_goals' as Table, mine)) : Promise.resolve([]),
      has('career_conversations') ? safe(repo.list('career_conversations' as Table, mine)) : Promise.resolve([]),
    ]);
    const now = todayIso();
    const upcoming = [...new Set(sessions.filter((x) => x.status === 'scheduled' && x.starts_at > `${now}T00:00:00Z`).map((x) => x.course_id))];
    const avail = await Promise.all(upcoming.map((c) => repo.rpc.sessionAvailability(c).catch(() => null)));
    // W2E3 (F13): my line manager is never suggested as a mentor
    const line = await repo.rpc.myReportingLine().catch(() => ({ line_manager: null, chain: [] as string[] }));
    const availability: Record<string, { taken: number; waiting: number }> = {};
    for (const a of avail) for (const x of a?.ok ? a.data ?? [] : []) availability[x.session_id] = { taken: x.taken, waiting: x.waiting };
    const t: CoachTables = {
      person, person_skills, skills, job_roles, role_competencies, competencies, courses, sessions, enrolments, training_records, qual_records, qual_standards, requal_rules, curriculum_rules,
      assessment_forms, items, task_items, evaluations, mentors, mentoring_requests, oe_lessons, dev_plans, coach_feedback, learning_goals, career_targets, opportunities,
      programmes, faqs, course_modules, future_goals, career_conversations,
    } as never;
    return { t, availability, now, lineManager: line.line_manager };
  }, [me]);
  const result = useMemo((): (CoachResult & { input: NonNullable<ReturnType<typeof coachInputFrom>>; t: CoachTables }) | null => {
    if (!q.data) return null;
    const input = coachInputFrom(q.data.t, q.data.now, { availability: q.data.availability, weights: eng.weights, lineManager: q.data.lineManager });
    if (!input) return null;
    return { ...buildCoachFeed(input), input, t: q.data.t };
  }, [q.data, eng.weights]);
  return { q, result, eng, me };
}
