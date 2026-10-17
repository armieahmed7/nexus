// M20 FS27 + FS28 shared page helpers (FS wave D · E1): data hooks for future-skills gigs, time envelopes, future-role rotations and
// secondments, and the small chips and meters the pages share. Rules live in futureGigs.ts and secondment.ts (import-free).
import { useMemo } from 'react';
import { useQuery, useRepo } from '../../data';
import type { JobRolesRow, OpportunitiesRow, OpportunityApplicationsRow, PersonSkillsRow, SkillsRow, TimeEnvelopesRow } from '../../data/types';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import { Icon, ProgressBar, StatusPill, type PillTone } from '../../ui';
import { EMSG, envelopeFit, envelopeView, type Fit, type FitCode } from './futureGigs';
import { SMSG, type SecPhase, type TransferState } from './secondment';

export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Everything the future-gig pages read for the signed-in person (rows are RLS-filtered by the repository). */
export function useFutureData() {
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const q = useQuery(['opportunities', 'opportunity_applications', 'time_envelopes', 'person_skills', 'skills', 'job_families', 'job_roles'], async () => {
    const [opps, apps, envs, states, skills, families, roles, stats] = await Promise.all([
      repo.list('opportunities', { order: [['start_on', 'asc']] }),
      repo.list('opportunity_applications', { order: [['updated_at', 'desc']] }),
      repo.list('time_envelopes', { order: [['starts_on', 'desc']] }),
      me ? repo.list('person_skills', { filter: { person_id: me, active: true } }) : Promise.resolve([] as PersonSkillsRow[]),
      repo.list('skills', { order: [['sort', 'asc']] }),
      repo.list('job_families', { order: [['sort', 'asc']] }),
      repo.list('job_roles', { order: [['sort', 'asc']] }),
      repo.rpc.futureGigStats().catch(() => null),
    ]);
    return { opps, apps, envs, states, skills, families, roles, stats };
  }, [me]);
  return { q, me };
}
export type FutureData = NonNullable<ReturnType<typeof useFutureData>['q']['data']>;

/** My envelopes, the fit of each future gig and a view per envelope, memoised. */
export function useMyEnvelopes(d: FutureData | undefined, me: string | null) {
  return useMemo(() => {
    const today = todayIso();
    const gigs = new Map((d?.opps ?? []).map((o) => [o.id, o]));
    const mine = (d?.envs ?? []).filter((e) => e.person_id === me) as TimeEnvelopesRow[];
    const myApps = (d?.apps ?? []).filter((a) => a.person_id === me);
    const fitOf = (o: OpportunitiesRow): Fit => envelopeFit(me ?? '', o as never, mine as never, myApps as never, gigs, today);
    const viewOf = (e: TimeEnvelopesRow) => envelopeView(e as never, (d?.apps ?? []) as never, gigs, today);
    const current = mine.find((e) => e.status === 'approved' && e.starts_on <= today && e.ends_on >= today) ?? mine.find((e) => e.status === 'approved' && e.ends_on >= today) ?? mine.find((e) => e.status === 'requested') ?? null;
    return { mine, myApps, fitOf, viewOf, current, gigs, today };
  }, [d, me]);
}

const CHANNEL_ICON: Record<string, string> = { advance_study: 'book', digital_innovation: 'sparkle', ai_pilot: 'shield', data_cleanup: 'filter', knowledge_capture: 'chat' };
export function ChannelChip({ channel }: { channel: string | null | undefined }) {
  const t = useT();
  if (!channel) return null;
  return (
    <span className="chip border-info-line bg-info-bg text-info" data-channel={channel}>
      <Icon name={CHANNEL_ICON[channel] ?? 'sparkle'} size={12} />
      {t(`m20.fs.channel.${channel}`)}
    </span>
  );
}
const FIT_TONE: Record<FitCode, string> = { fits: 'border-ok-line bg-ok-bg text-ok', over_limit: 'border-sim-line bg-sim-bg text-sim', poster_is_approver: 'border-sim-line bg-sim-bg text-sim', no_envelope: 'border-line bg-sunken text-ink-2', not_future: 'border-line bg-sunken text-ink-2' };
/** Whether applying would skip the per-gig release (and why not). */
export function FitBadge({ fit }: { fit: Fit }) {
  const t = useT();
  const f = useFormat();
  return (
    <span className={`chip ${FIT_TONE[fit.code]}`} data-testid="m20-fs-fit" data-fit={fit.code} title={t(`m20.fs.fitHint.${fit.code}`, { used: f.num(fit.used), cap: f.num(fit.cap) })}>
      <Icon name={fit.fits ? 'check' : 'info'} size={11} />
      {t(`m20.fs.fit.${fit.code}`)}
    </span>
  );
}
const ENV_TONE: Record<string, PillTone> = { requested: 'info', approved: 'ok', declined: 'bad', withdrawn: 'neutral', running: 'ok', upcoming: 'accent', ended: 'neutral' };
export function EnvelopePill({ status }: { status: string }) {
  const t = useT();
  return <StatusPill status={status} tone={ENV_TONE[status] ?? 'neutral'}>{t(`m20.fs.envStatus.${status}`)}</StatusPill>;
}
/** Weekly hours used against the envelope's cap. */
export function EnvelopeMeter({ used, cap, label }: { used: number; cap: number; label?: string }) {
  const t = useT();
  const f = useFormat();
  const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  return (
    <div data-testid="m20-fs-meter">
      <div className="mb-1 flex justify-between text-[12.5px]"><span className="text-ink-2">{label ?? t('m20.fs.meter.label')}</span><span className="num">{t('m20.fs.meter.value', { used: f.num(used), cap: f.num(cap) })}</span></div>
      <ProgressBar value={pct} tone={used >= cap ? 'sim' : 'ok'} label={label ?? t('m20.fs.meter.label')} />
    </div>
  );
}
const LIFE_TONE: Record<string, string> = { emerging: 'border-accent/30 bg-accent-soft text-eyebrow', growing: 'border-ok-line bg-ok-bg text-ok', stable: 'border-line bg-sunken text-ink-2', declining: 'border-sim-line bg-sim-bg text-sim' };
/** Future skills a gig grows, with their FS02 lifecycle and my level now. */
export function FutureSkillChips({ ids, skills, levels }: { ids: string[]; skills: SkillsRow[]; levels?: Map<string, number> }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const sk = new Map(skills.map((s) => [s.id, s]));
  return (
    <ul className="flex flex-wrap gap-1.5" data-testid="m20-fs-skills">
      {ids.map((id) => {
        const s = sk.get(id);
        const future = !!s?.fs_area;
        return (
          <li key={id} className={`chip ${future ? LIFE_TONE[s?.lifecycle ?? 'stable'] ?? LIFE_TONE.stable : 'border-line bg-panel text-ink-2'}`} title={future ? t(`m20.fs.lifecycle.${s?.lifecycle ?? 'stable'}`) : undefined}>
            {future && <Icon name="sparkle" size={11} />}
            <span>{s ? pick(s, 'name') : id}</span>
            {levels && <span className="num">{t('m20.fs.levelNow', { n: f.num(levels.get(id) ?? 0) })}</span>}
          </li>
        );
      })}
    </ul>
  );
}

// ───────────── FS28
const PHASE_TONE: Record<SecPhase, PillTone> = { upcoming: 'accent', on_secondment: 'info', return_due: 'sim', returned: 'ok', cancelled: 'neutral' };
export function SecPhasePill({ phase }: { phase: SecPhase }) {
  const t = useT();
  return <StatusPill status={phase} tone={PHASE_TONE[phase] ?? 'neutral'}>{t(`m20.sec.phase.${phase}`)}</StatusPill>;
}
const TRANSFER_TONE: Record<TransferState, PillTone> = { none: 'neutral', due: 'info', overdue: 'bad', done: 'ok' };
export function TransferPill({ state }: { state: TransferState }) {
  const t = useT();
  if (state === 'none') return null;
  return <StatusPill status={state} tone={TRANSFER_TONE[state]}>{t(`m20.sec.transfer.${state}`)}</StatusPill>;
}
const HOST_ICON: Record<string, string> = { iaea: 'globe', partner_utility: 'home', vendor: 'briefcase', university: 'grad', research_centre: 'sparkle' };
export function HostKindChip({ kind }: { kind: string }) {
  const t = useT();
  return <span className="chip border-accent/30 bg-accent-soft text-eyebrow"><Icon name={HOST_ICON[kind] ?? 'globe'} size={12} />{t(`m20.sec.host.${kind}`)}</span>;
}
export function TrackChip({ track }: { track: string | null | undefined }) {
  const t = useT();
  if (!track) return null;
  return <span className="chip border-info-line bg-info-bg text-info" data-track={track}><Icon name="sparkle" size={12} />{t(`m20.sec.track.${track}`)}</span>;
}
/** Concept and current role titles by id. */
export function useRoleTitle(roles: JobRolesRow[] | undefined) {
  const pick = usePick();
  return useMemo(() => {
    const m = new Map((roles ?? []).map((r) => [r.id, r]));
    return (id: string | null | undefined) => (id && m.get(id) ? pick(m.get(id)!, 'title') : id ?? '');
  }, [roles, pick]);
}
export type App = OpportunityApplicationsRow;

/** A rule refusal (English message from futureGigs.ts / secondment.ts) in the reader's language. */
export function useRuleMessage() {
  const t = useT();
  return (message: string) => {
    const e = Object.entries(EMSG).find(([, v]) => v === message);
    if (e) return t(`m20.fs.msg.${e[0]}`);
    const s = Object.entries(SMSG).find(([, v]) => v === message);
    return s ? t(`m20.sec.msg.${s[0]}`) : message;
  };
}

/** FS27 note on a future gig's apply card: whether my approved time envelope releases me at once, and why not. */
export function EnvelopeFitNote({ o }: { o: OpportunitiesRow }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const s = useSession();
  const me = s.identity.personId;
  const q = useQuery(['time_envelopes', 'opportunity_applications', 'opportunities'], async () => {
    const [envs, apps, opps] = await Promise.all([repo.list('time_envelopes'), repo.list('opportunity_applications'), repo.list('opportunities')]);
    return { envs, apps, opps };
  }, [me]);
  if (!q.data || !me) return null;
  const gigs = new Map(q.data.opps.map((x) => [x.id, x]));
  const fit = envelopeFit(me, o as never, q.data.envs.filter((e) => e.person_id === me) as never, q.data.apps.filter((a) => a.person_id === me) as never, gigs, todayIso());
  return (
    <div className={`mb-3 rounded-card border p-3 text-[13px] ${fit.fits ? 'border-ok-line bg-ok-bg' : 'border-line bg-sunken'}`} data-testid="m20-fs-apply-fit">
      <div className="mb-1"><FitBadge fit={fit} /></div>
      <p className="text-ink-2">{t(`m20.fs.fitHint.${fit.code}`, { used: f.num(fit.used), cap: f.num(fit.cap) })}</p>
      {(fit.code === 'no_envelope' || fit.code === 'over_limit') && <L to="/opportunities/envelope" className="mt-1 inline-block font-semibold underline">{t('m20.fs.hub.myEnvelope')}</L>}
    </div>
  );
}
