// M21 shared pieces: data hook for Future Me, the SIMULATED index badge (every index carries the chip and the no-decision line),
// source links with as-of dates, the interest toggle (direct own write) and the "Add to my learning goals" button (rpc.setFutureGoal).
import { useMemo, type ReactNode } from 'react';
import { SimChip, SourceLink, Icon } from '../../ui';
import { useAction, useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, useT } from '../../i18n';
import type { BiText } from '../../domain/engines/types';
import { interestId, readinessIndex, type GoalKind, type Readiness } from './future';
import type { FutureReadiness } from './backend/rpc';

export type FutureSource = { id?: string; label: string; url: string; as_of?: string };
export const NO_DECISION_KEY = 'm11.common.noDecision';

export interface FutureMeData {
  me: string;
  person: RowOf<'people'> | null;
  states: RowOf<'person_skills'>[];
  skills: RowOf<'skills'>[];
  techs: RowOf<'adv_technologies'>[];
  advSkills: RowOf<'adv_skills'>[];
  bridges: RowOf<'skill_bridges'>[];
  roles: RowOf<'future_roles'>[];
  lanes: RowOf<'horizon_lanes'>[];
  resources: RowOf<'future_resources'>[];
  edges: RowOf<'career_paths'>[];
  jobRoles: RowOf<'job_roles'>[];
  interest: RowOf<'future_interest'>[];
  goals: RowOf<'future_goals'>[];
  // FS13 / FS14
  rv2: FutureReadiness | null;
  links: RowOf<'horizon_lane_links'>[];
  milestones: RowOf<'horizon_milestones'>[];
  tracks: RowOf<'adv_tracks'>[];
  progress: RowOf<'future_track_progress'>[];
  courses: RowOf<'courses'>[];
  gigs: RowOf<'opportunities'>[];
  enrolments: RowOf<'enrolments'>[];
}
export const FUTURE_TABLES = ['person_skills', 'skills', 'adv_technologies', 'adv_skills', 'skill_bridges', 'future_roles', 'horizon_lanes', 'future_resources', 'career_paths', 'job_roles', 'future_interest', 'future_goals',
  'horizon_lane_links', 'horizon_milestones', 'adv_tracks', 'future_track_progress', 'courses', 'opportunities', 'enrolments', 'training_records', 'future_skill_map'] as const;

/** Everything Future Me reads for the signed-in person. Row-level security limits interest, goals and skill states to their own rows. */
export function useFutureMe() {
  const repo = useRepo();
  const { identity, person } = useSession();
  const me = identity.personId;
  return useQuery([...FUTURE_TABLES], async (): Promise<FutureMeData | null> => {
    if (!me) return null;
    const soft = <X,>(p: Promise<X[]>) => p.catch(() => [] as X[]);
    const [states, skills, techs, advSkills, bridges, roles, lanes, resources, edges, jobRoles, interest, goals, rv2, links, milestones, tracks, progress, courses, gigs, enrolments] = await Promise.all([
      repo.list('person_skills', { filter: { person_id: me, active: true } }),
      repo.list('skills', { order: [['sort', 'asc']] }),
      repo.list('adv_technologies', { order: [['sort', 'asc']] }),
      repo.list('adv_skills', { order: [['sort', 'asc']] }),
      repo.list('skill_bridges'),
      repo.list('future_roles', { order: [['sort', 'asc']] }),
      repo.list('horizon_lanes', { order: [['sort', 'asc']] }),
      repo.list('future_resources', { order: [['sort', 'asc']] }),
      repo.list('career_paths'),
      repo.list('job_roles'),
      repo.list('future_interest', { filter: { person_id: me } }),
      repo.list('future_goals', { filter: { person_id: me } }),
      repo.rpc.futureReadiness().catch(() => null),
      soft(repo.list('horizon_lane_links', { order: [['sort', 'asc']] })),
      soft(repo.list('horizon_milestones', { order: [['year', 'asc'], ['sort', 'asc']] })),
      soft(repo.list('adv_tracks', { order: [['sort', 'asc']] })),
      soft(repo.list('future_track_progress', { filter: { person_id: me } })),
      soft(repo.list('courses')),
      soft(repo.list('opportunities')),
      soft(repo.list('enrolments', { filter: { person_id: me } })),
    ]);
    return { me, person, states, skills, techs, advSkills, bridges, roles, lanes, resources, edges, jobRoles, interest, goals, rv2, links, milestones, tracks, progress, courses, gigs, enrolments };
  }, [me, person?.id]);
}

export interface Labels { skills: Record<string, BiText>; adv: Record<string, BiText>; roles: Record<string, BiText>; techs: Record<string, BiText> }
export function useLabels(d: FutureMeData): Labels {
  return useMemo(() => ({
    skills: Object.fromEntries(d.skills.map((s) => [s.id, { en: s.name_en, ar: s.name_ar }])),
    adv: Object.fromEntries(d.advSkills.map((s) => [s.id, { en: s.skill_en, ar: s.skill_ar }])),
    roles: Object.fromEntries(d.jobRoles.map((r) => [r.id, { en: r.title_en, ar: r.title_ar }])),
    techs: Object.fromEntries(d.techs.map((x) => [x.id, { en: x.family_en, ar: x.family_ar }])),
  }), [d]);
}
export function useReadiness(d: FutureMeData, labels: Labels): Readiness {
  return useMemo(() => readinessIndex(d.techs, d.advSkills, d.skills, d.states, { skills: labels.skills, adv: labels.adv }), [d, labels]);
}

/** A SIMULATED index (0-100). Always shows the SIMULATED chip and the "no deployment decision" line (F09 acceptance). */
export function IndexBadge({ value, label, sub, size = 'md', testId = 'm21-index' }: { value: number; label: ReactNode; sub?: ReactNode; size?: 'lg' | 'md' | 'sm'; testId?: string }) {
  const t = useT();
  const f = useFormat();
  const big = size === 'lg' ? 'text-[44px]' : size === 'md' ? 'text-[28px]' : 'text-[20px]';
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="caps">{label}</span>
        <SimChip />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`num font-semibold leading-none text-ink ${big}`}>{f.num(value, { maximumFractionDigits: 1 })}</span>
        <span className="num text-[12.5px] text-ink-3">/ {f.num(100)}</span>
      </div>
      {sub && <div className="text-[12.5px] text-ink-2">{sub}</div>}
      <p className="text-[11.5px] leading-snug text-sim" data-testid="m21-no-decision">{t(NO_DECISION_KEY)}</p>
    </div>
  );
}

/** Thin meter for an index, with the SIMULATED value as text for screen readers. */
export function IndexMeter({ value, ceiling, label }: { value: number; ceiling?: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  const c = ceiling == null ? null : Math.max(0, Math.min(100, ceiling));
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-sunken" role="img" aria-label={label}>
      {c != null && <div className="absolute inset-y-0 start-0 rounded-full bg-sim-bg" style={{ width: `${c}%` }} />}
      {c != null && <div className="absolute inset-y-0 w-0.5 bg-sim" style={{ insetInlineStart: `calc(${c}% - 1px)` }} />}
      <div className="absolute inset-y-0 start-0 rounded-full bg-accent transition-[width] duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

/** Level dots 0-4. */
export function LevelDots({ level, max = 4, label }: { level: number; max?: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
      {Array.from({ length: max }, (_, i) => <span key={i} className={`inline-block h-2 w-2 rounded-full ${i < level ? 'bg-accent' : 'bg-sunken ring-1 ring-line'}`} />)}
    </span>
  );
}

export function SourceLinks({ sources, compact }: { sources: FutureSource[]; compact?: boolean }) {
  const t = useT();
  const f = useFormat();
  if (!sources?.length) return null;
  return (
    <ul className={compact ? 'flex flex-wrap gap-x-3 gap-y-1' : 'space-y-1'} data-testid="m21-sources">
      {sources.map((s, i) => (
        <li key={`${s.url}-${i}`}><SourceLink href={s.url} date={s.as_of ? t('common.asOf', { date: f.date(s.as_of) }) : null}>{s.label}</SourceLink></li>
      ))}
    </ul>
  );
}

/** "Interested" toggle: a direct write to the person's own future_interest row (row trigger audits it). */
export function InterestToggle({ d, kind, target }: { d: FutureMeData; kind: 'tech' | 'lane'; target: string }) {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  const id = interestId(d.me, target);
  const cur = d.interest.find((i) => i.id === id);
  const on = !!cur?.active;
  const toggle = () => act(
    () => (cur ? repo.update('future_interest', id, { active: !on, updated_at: new Date().toISOString() }) : repo.insert('future_interest', { id, person_id: d.me, target_kind: kind, tech_id: kind === 'tech' ? target : null, lane_id: kind === 'lane' ? target : null, active: true })),
    { success: on ? t('m21.interest.removed') : t('m21.interest.added') },
  );
  return (
    <button type="button" className={`btn-sm ${on ? 'btn-primary' : 'btn-outline'}`} aria-pressed={on} onClick={toggle} data-testid="m21-interest">
      <Icon name={on ? 'check' : 'plus'} size={13} /> {on ? t('m21.interest.on') : t('m21.interest.off')}
    </button>
  );
}

/** "Add to my learning goals": stores a coach target for the Learning Coach (F07) through rpc.setFutureGoal. */
export function GoalButton({ d, kind, refId, compact }: { d: FutureMeData; kind: GoalKind; refId: string; compact?: boolean }) {
  const t = useT();
  const repo = useRepo();
  const act = useAction();
  const active = d.goals.some((g) => g.kind === kind && g.ref_id === refId && g.status === 'active');
  const run = () => act(() => repo.rpc.setFutureGoal(kind, refId, !active));
  return (
    <button type="button" className={`btn-sm ${active ? 'btn-ghost' : 'btn-outline'}`} onClick={run} aria-pressed={active} data-testid="m21-goal">
      <Icon name={active ? 'check' : 'sparkle'} size={13} /> {active ? t(compact ? 'm21.goal.inShort' : 'm21.goal.in') : t(compact ? 'm21.goal.addShort' : 'm21.goal.add')}
    </button>
  );
}

export const RELATION_TONE: Record<string, string> = {
  transfers: 'border-ok-line bg-ok-bg text-ok',
  adapts: 'border-info-line bg-info-bg text-info',
  new: 'border-sim-line bg-sim-bg text-sim',
};
export const techSlug = (id: string) => id.replace(/^tech-/, '');
