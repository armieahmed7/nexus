// FS46-FS48 (wave E · E4, M22) shared page pieces: the behaviour catalogue hook, anchor text, status pills of the Future Leaders
// track and the women-in-future-nuclear network, and the "future leadership" strip on /leadership. Pages never import backend/*.
import type { ReactNode } from 'react';
import { useQuery, useRepo, type RowOf } from '../../data';
import { useSession } from '../../auth/session';
import { L, useLang, useT } from '../../i18n';
import { Icon, StatusPill, type PillTone } from '../../ui';
import { wfnArea } from './future';

export type Behaviour = RowOf<'leadership_behaviours'>;
type BiCell = { en?: string; ar?: string };

/** The behaviour catalogue (12 rows: form 1 has the first eight; form 2 adds the four future behaviours). Public reference data. */
export function useBehaviours() {
  const repo = useRepo();
  return useQuery(['leadership_behaviours'], () => repo.list('leadership_behaviours', { order: [['sort', 'asc']] }), []);
}

/** Text of a bilingual cell ({en, ar}) in the reader's language. */
export function useBi() {
  const lang = useLang();
  return (x: unknown) => { const c = (x ?? {}) as BiCell; return (lang === 'ar' ? c.ar || c.en : c.en || c.ar) ?? ''; };
}

/** The anchor text of a behaviour at a rating point (1-5). */
export function useAnchor() {
  const bi = useBi();
  return (b: Behaviour | undefined, point: number) => (b ? bi((b.anchors as Record<string, BiCell> | null)?.[String(point)]) : '');
}

export function useArea() {
  const lang = useLang();
  return (id: string) => wfnArea(id)[lang === 'ar' ? 'ar' : 'en'];
}

const PROJECT_TONE: Record<string, PillTone> = { none: 'neutral', draft: 'sim', submitted: 'info', returned: 'bad', accepted: 'ok' };
export function ProjectPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={PROJECT_TONE[status] ?? 'neutral'} status={status}>{t(`m22.fl.project.${status}`)}</StatusPill>;
}
const REQ_TONE: Record<string, PillTone> = { interested: 'info', shortlisted: 'accent', placed: 'ok', completed: 'ok', declined: 'neutral', withdrawn: 'neutral' };
export function RequestPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={REQ_TONE[status] ?? 'neutral'} status={status}>{t(`m22.wfn.req.${status}`)}</StatusPill>;
}
const COHORT_TONE: Record<string, PillTone> = { completed: 'neutral', running: 'ok', open: 'info' };
export function CohortPill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill tone={COHORT_TONE[status] ?? 'neutral'} status={status}>{t(`m22.fl.cohortStatus.${status}`)}</StatusPill>;
}

/** "Suppressed" for a count under the group threshold, the formatted number otherwise. */
export function Cell({ n, fmt }: { n: number | null; fmt: (v: number) => string }): ReactNode {
  const t = useT();
  return n == null ? <span className="text-ink-3" title={t('common.suppressed')}>{t('common.suppressedShort')}</span> : <>{fmt(n)}</>;
}

/** /leadership: the FS46-FS48 links (behaviours with anchors and coach cards, the Future Leaders track, the network). */
export function FutureLeadershipStrip() {
  const t = useT();
  const s = useSession();
  const hr = s.hasRole('hr_analyst', 'hr_director', 'training_manager', 'auditor');
  const items: { to: string; icon: string; title: string; body: string; id: string }[] = [
    { id: 'behaviours', to: '/leadership/behaviours', icon: 'sparkle', title: t('m22.future.stripBehaviours'), body: t('m22.future.stripBehavioursBody') },
    { id: 'track', to: '/leadership/future-leaders', icon: 'grad', title: t('m22.future.stripTrack'), body: t('m22.future.stripTrackBody') },
    { id: 'network', to: '/communities/women-in-nuclear', icon: 'users', title: t('m22.future.stripNetwork'), body: t('m22.future.stripNetworkBody') },
  ];
  return (
    <section className="space-y-3" data-testid="m22-future-strip">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">{t('m22.future.stripTitle')}</h2>
        {hr && <span className="flex flex-wrap gap-2">
          <L to="/leadership/future-leaders/manage" className="btn-ghost btn-sm">{t('m22.future.stripManage')}</L>
          <L to="/communities/women-in-nuclear/programme" className="btn-ghost btn-sm">{t('m22.future.stripProgramme')}</L>
        </span>}
      </div>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {items.map((x) => (
          <li key={x.id} className="card flex flex-col gap-1.5 p-4">
            <span className="flex items-center gap-2 font-semibold"><Icon name={x.icon} size={16} className="text-accent" />{x.title}</span>
            <span className="text-[13px] text-ink-2">{x.body}</span>
            <L to={x.to} className="mt-auto text-[13px] font-semibold">{t('m22.future.open')}</L>
          </li>
        ))}
      </ul>
    </section>
  );
}
