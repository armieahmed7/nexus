// M22 shared page pieces (F16 Leadership journeys, F17 Communities of practice): data hooks, labels, status pills, the CNS
// source line and the "Why this?"-ready ranked lists. Pages never import backend/*.
import { useMemo, type ReactNode } from 'react';
import { useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, useLang, usePick, useT } from '../../i18n';
import { SourceLink, StatusPill, Icon, type PillTone } from '../../ui';
import type { BiText } from '../../domain/engines/types';
import { STEPS, type Step } from './domain';

export type Programme = RowOf<'leadership_programmes'>;
export type Nomination = RowOf<'leadership_nominations'>;
export type Source = { id?: string; label: string; url: string; as_of?: string };

/** Everything the leadership pages read. Row-level security limits nominations to the caller's own, scope or HR view. */
export function useLeadership() {
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const q = useQuery(['leadership_programmes', 'leadership_nominations', 'skills', 'person_skills', 'training_records', 'sc_traits', 'job_roles'], async () => {
    const [programmes, nominations, skills, states, records, traits, roles] = await Promise.all([
      repo.list('leadership_programmes', { order: [['sort', 'asc']] }),
      repo.list('leadership_nominations', { order: [['updated_at', 'desc']] }).catch(() => [] as Nomination[]),
      repo.list('skills', { order: [['sort', 'asc']] }),
      me ? repo.list('person_skills', { filter: { person_id: me, active: true } }).catch(() => [] as RowOf<'person_skills'>[]) : Promise.resolve([] as RowOf<'person_skills'>[]),
      me ? repo.list('training_records', { filter: { person_id: me } }).catch(() => [] as RowOf<'training_records'>[]) : Promise.resolve([] as RowOf<'training_records'>[]),
      repo.list('sc_traits').catch(() => [] as RowOf<'sc_traits'>[]),
      repo.list('job_roles', { order: [['sort', 'asc']] }),
    ]);
    return { programmes, nominations, skills, states, records, traits, roles };
  }, [me]);
  return { q, me, person: s.person, session: s };
}
export type LeadData = NonNullable<ReturnType<typeof useLeadership>['q']['data']>;

export function useLabels(skills: RowOf<'skills'>[] | undefined, roles?: RowOf<'job_roles'>[]) {
  const pick = usePick();
  const t = useT();
  return useMemo(() => {
    const sk = new Map((skills ?? []).map((s) => [s.id, s]));
    const ro = new Map((roles ?? []).map((r) => [r.id, r]));
    return {
      skill: (id: string) => (sk.get(id) ? pick(sk.get(id), 'name') : id),
      skillBi: (id: string): BiText => ({ en: sk.get(id)?.name_en ?? id, ar: sk.get(id)?.name_ar ?? id }),
      role: (id: string | null | undefined) => (id && ro.get(id) ? pick(ro.get(id), 'title') : t('m22.common.roleCard')),
    };
  }, [skills, roles, pick, t]);
}

export function StepName({ step }: { step: Step | string }) {
  const t = useT();
  return <>{t(`m22.steps.${step}`)}</>;
}
export const stepIndex = (s: Step) => STEPS.indexOf(s);

const NOM_TONE: Record<string, PillTone> = { nominated: 'info', approved: 'ok', declined: 'bad', completed: 'accent' };
export function NomPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={NOM_TONE[status] ?? 'neutral'} status={status}>{t(`m22.nomStatus.${status}`)}</StatusPill>;
}
const POST_TONE: Record<string, PillTone> = { published: 'ok', held: 'sim', hidden: 'bad', sent: 'info', accepted: 'ok', declined: 'neutral', invited: 'info', submitted: 'ok', upcoming: 'accent', held_session: 'neutral' };
export function M22Pill({ status, kind = 'post' }: { status: string; kind?: 'post' | 'request' | 'invite' | 'session' }) {
  const t = useT();
  return <StatusPill tone={POST_TONE[kind === 'session' && status === 'held' ? 'held_session' : status] ?? 'neutral'} status={status}>{t(`m22.pill.${kind}.${status}`)}</StatusPill>;
}

/** The CNS source line with its as-of date (every programme fact cites it). */
export function Sources({ sources, className = '' }: { sources: unknown; className?: string }) {
  const f = useFormat();
  const list = (Array.isArray(sources) ? sources : []) as Source[];
  if (!list.length) return null;
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`} data-testid="m22-sources">
      {list.map((s, i) => <SourceLink key={i} href={s.url} date={s.as_of ? f.date(s.as_of) : null}>{s.label}</SourceLink>)}
    </span>
  );
}

/** A small key fact (number + label) used on programme cards. */
export function Fact({ icon, children }: { icon: string; children: ReactNode }) {
  return <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-2"><Icon name={icon} size={13} className="text-ink-3" />{children}</span>;
}

export function usePersonName() {
  const lang = useLang();
  return (row: { name?: string; name_ar?: string } | null | undefined, en?: string, ar?: string) => (lang === 'ar' ? (ar || row?.name_ar || en || row?.name) : (en || row?.name)) ?? '';
}

/** Level dots 0..4 (readable alone: the number is in the label). */
export function LevelDots({ level, need, label }: { level: number; need?: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-full border ${i <= level ? 'border-accent bg-accent' : need && i <= need ? 'border-sim-line bg-sim-bg' : 'border-line bg-sunken'}`} />
      ))}
    </span>
  );
}

export function useCommunities() {
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const q = useQuery(['communities', 'community_members', 'threads', 'ks_sessions'], async () => {
    const [communities, members, threads, sessions] = await Promise.all([
      repo.list('communities', { order: [['sort', 'asc']] }),
      repo.list('community_members'),
      repo.list('threads', { order: [['last_post_at', 'desc']] }),
      repo.list('ks_sessions', { order: [['held_on', 'desc']] }),
    ]);
    return { communities, members, threads, sessions };
  }, [me]);
  return { q, me, session: s };
}
export type CopData = NonNullable<ReturnType<typeof useCommunities>['q']['data']>;
export const isMember = (d: CopData, cid: string, me: string | null) => !!me && d.members.some((m) => m.community_id === cid && m.person_id === me && m.active);
export const isStewardOf = (d: CopData, cid: string, me: string | null) => !!me && d.members.some((m) => m.community_id === cid && m.person_id === me && m.active && m.role === 'steward');
