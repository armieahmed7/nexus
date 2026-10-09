// F13: loads everything the mentoring pages need through the repository (both backends; RLS applies, so a person sees only the
// agreements, sessions and private notes they are entitled to). Pages never compute access themselves.
import { useMemo } from 'react';
import { SCHEMA } from '../../data/schema';
import { useQuery, useRepo, type Table } from '../../data';
import { useEngine } from '../../data/useEngine';
import { useSession } from '../../auth/session';
import { competencyLevels } from '../../domain/engines/skills';
import type { AgreementLite, MentorRowLite, RequestLite, SessionLite, SkillLite } from './mentoring';

const has = (t: string) => Object.prototype.hasOwnProperty.call(SCHEMA, t);
export type Agreement = AgreementLite & { proposed_by: string; proposed_at: string; responded_at?: string | null; decline_note?: string | null; mentee_note?: string | null; mentor_note?: string | null; mentee_closed_at?: string | null; mentor_closed_at?: string | null; attainment_pct?: number | null; validated_claim_ids?: string[] };
export type Mentor = MentorRowLite & { bio_en: string; bio_ar: string; interests: string[]; sme_nominated_on?: string | null };
export type Request = RequestLite & { message: string; created_at: string; responded_at?: string | null; interest: string };
export type Session = SessionLite & { person_id: string; mentor_person_id: string; topics: string; note_shared: string; logged_by: string; logged_at: string };
export interface PrivateNote { id: string; session_id: string; agreement_id: string; author_person_id: string; note: string }

export function useMentoring() {
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const eng = useEngine('match');
  const tables: Table[] = ['mentors', 'mentoring_requests', 'mentoring_agreements', 'mentoring_sessions', 'mentoring_private_notes', 'person_skills', ...(has('career_targets') ? ['career_targets' as Table] : [])];
  const q = useQuery(tables, async () => {
    const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
    const mine = { filter: { person_id: me } } as never;
    const [mentors, requests, agreements, sessions, notes, skills, roles, comps, roleComps, states, targets, line] = await Promise.all([
      safe(repo.list('mentors')), safe(repo.list('mentoring_requests', { order: [['created_at', 'desc']] })), safe(repo.list('mentoring_agreements')),
      safe(repo.list('mentoring_sessions', { order: [['held_on', 'desc']] })), safe(repo.list('mentoring_private_notes')), safe(repo.list('skills', { order: [['sort', 'asc']] })),
      safe(repo.list('job_roles', { order: [['sort', 'asc']] })), safe(repo.list('competencies')), safe(repo.list('role_competencies')),
      me ? safe(repo.list('person_skills', mine)) : Promise.resolve([]),
      me && has('career_targets') ? safe(repo.list('career_targets' as Table, mine)) : Promise.resolve([]),
      me ? repo.rpc.myReportingLine().catch(() => ({ line_manager: null, chain: [] as string[] })) : Promise.resolve({ line_manager: null, chain: [] as string[] }),
    ]);
    return {
      forMe: me,
      mentors: mentors as unknown as Mentor[], requests: requests as unknown as Request[], agreements: agreements as unknown as Agreement[], sessions: sessions as unknown as Session[],
      notes: notes as unknown as PrivateNote[], skills: skills as unknown as (SkillLite & { name_en: string; name_ar: string; code: string; area: string })[], roles, comps, roleComps,
      states: (states as { skill_id: string; level: number; active?: boolean }[]).filter((x) => x.active !== false),
      targets: (targets as { role_id: string; active?: boolean; rank?: number }[]).filter((x) => x.active !== false).sort((a, b) => Number(a.rank ?? 0) - Number(b.rank ?? 0)).map((x) => x.role_id),
      line,
    };
  }, [me, s.status]);
  // Rows loaded for an earlier identity (the session resolves after the first render) are not shown: without the reporting
  // line the matcher could not exclude my own line manager.
  const stale = !!q.data && (q.data.forMe !== me || s.status === 'loading');
  const state = useMemo(() => (stale ? { ...q, data: undefined, loading: true } : q), [q, stale]);
  const derived = useMemo(() => {
    const d = state.data;
    if (!d) return null;
    const have = competencyLevels(d.states as never, d.skills as never);
    const skillBy = new Map(d.skills.map((x) => [x.id, x]));
    const mentorBy = new Map(d.mentors.map((m) => [m.id, m]));
    return { have, skillBy, mentorBy, myLevel: new Map(d.states.map((x) => [x.skill_id, x.level])) };
  }, [state.data]);
  return { q: state, me, eng, derived, person: s.person, roles: s.roles };
}
