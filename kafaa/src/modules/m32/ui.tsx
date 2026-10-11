// M32 shared UI (FS41 CleanEnergyComp, FS42 energy-system integration, FS43 ESG and GHG literacy): reference-data hooks, area and level
// chips, the level-against-target bar, learning links, source lists, and the pathway panel both FS42 and FS43 pages use (M19's
// pathwayDetail / startPathway, a quick route and the credential route). Module-local; pages import from here.
import { useState, type ReactNode } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { Async, Card, ConfirmDialog, EmptyState, Icon, ProgressBar, SourceLink, StatTile, StatusPill } from '../../ui';
import { CEC_AREAS, CEC_MAX, byCecSort, type CecStatus, type LearningRef } from './cec';
import { credentialRoute, quickRoute, trackHours, type CriterionRoute } from './transition';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any;
const safe = (p: Promise<unknown>) => (p as Promise<Row[]>).catch(() => [] as Row[]);

/** Public reference rows (FS41): competences, family targets, families, skills. */
export function useCecRef() {
  const repo = useRepo();
  return useQuery(['cec_competences', 'cec_role_targets', 'job_families', 'skills'], async () => {
    const [comps, targets, families, skills] = await Promise.all([
      safe(repo.list('cec_competences' as never)), safe(repo.list('cec_role_targets' as never)), safe(repo.list('job_families')), safe(repo.list('skills')),
    ]);
    return { comps: (comps as Row[]).filter((c) => c.status !== 'retired').sort(byCecSort), targets: targets as Row[], families: families as Row[], skills: skills as Row[] };
  }, []);
}
export type CecRef = NonNullable<ReturnType<typeof useCecRef>['data']>;

/** Staff reference rows (FS42/FS43): value chains, tracks and the content they point at. */
export function useEtRef() {
  const repo = useRepo();
  return useQuery(['value_chains', 'transition_tracks', 'pathways', 'pathway_steps', 'courses', 'external_resources', 'adaptive_banks', 'performance_tasks', 'microcred_defs', 'horizon_lanes', 'skills', 'cec_competences', 'academies'], async () => {
    const names = ['value_chains', 'transition_tracks', 'pathways', 'pathway_steps', 'courses', 'external_resources', 'adaptive_banks', 'performance_tasks', 'microcred_defs', 'horizon_lanes', 'skills', 'cec_competences', 'academies'];
    const all = await Promise.all(names.map((n) => safe(repo.list(n as never))));
    const o = Object.fromEntries(names.map((n, i) => [n, all[i] as Row[]])) as Record<string, Row[]>;
    o.value_chains.sort((a, b) => a.sort - b.sort);
    o.transition_tracks.sort((a, b) => a.sort - b.sort);
    return o;
  }, []);
}
export type EtRef = NonNullable<ReturnType<typeof useEtRef>['data']>;

export const AREA_ICON: Record<string, string> = { values: 'shield', complexity: 'sparkle', futures: 'globe', acting: 'users' };
export const AREA_LIST = CEC_AREAS;
export const STATUS_TONE: Record<CecStatus, 'ok' | 'sim' | 'neutral' | 'info'> = { met: 'ok', below: 'sim', none: 'neutral', no_target: 'info' };

export function AreaChip({ area }: { area: string }) {
  const t = useT();
  return <span className="chip border-transparent bg-accent-soft normal-case tracking-normal text-eyebrow"><Icon name={AREA_ICON[area] ?? 'info'} size={12} />{t(`m32.area.${area}`)}</span>;
}

export function LevelPill({ level, testId }: { level: number; testId?: string }) {
  const t = useT();
  const f = useFormat();
  const tone = level >= 3 ? 'bg-ok-bg text-ok' : level === 2 ? 'bg-accent-soft text-eyebrow' : level === 1 ? 'bg-info-bg text-info' : 'bg-sunken text-ink-3';
  return (
    <span className={`chip border-transparent normal-case tracking-normal ${tone}`} data-testid={testId} data-level={level}>
      {level > 0 && <span className="num">{t('m32.levelShort', { n: f.num(level) })}</span>}
      <span>{t(`m32.level.${level}`)}</span>
    </span>
  );
}

export function StatusTag({ status }: { status: CecStatus }) {
  const t = useT();
  return <StatusPill tone={STATUS_TONE[status]}>{t(`m32.status.${status}`)}</StatusPill>;
}

/** Level against the family target: three steps, filled to the level, a marker at the target. */
export function TargetBar({ level, target, testId = 'm32-bar' }: { level: number; target: number | null; testId?: string }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="grid grid-cols-3 gap-1" data-testid={testId} data-level={level} data-target={target ?? ''} role="img"
      aria-label={t('m32.bar.aria', { level: f.num(level), target: target == null ? '—' : f.num(target) })}>
      {Array.from({ length: CEC_MAX }, (_, i) => i + 1).map((n) => {
        const on = n <= level;
        const short = target != null && n <= target && !on;
        return (
          <div key={n} className={`relative h-3 rounded-sm border ${on ? 'border-accent bg-[rgb(var(--accent))]' : short ? 'border-dashed border-[rgb(var(--sim))] bg-sunken' : 'border-line bg-sunken'}`}>
            {target === n && <span className="absolute -top-1.5 end-0 h-6 w-0.5 rounded bg-[rgb(var(--ok))]" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}

const HREF: Record<string, (ref: string) => string> = {
  course: (r) => `/learn/course/${r}`,
  pathway: (r) => `/learn/pathways/${r}`,
  external: (r) => `/learn/external?item=${r}`,
  adaptive: (r) => `/my/assessments/adaptive/${r}`,
  task: (r) => `/my/assessments/tasks/${r}`,
  credential: (r) => `/my/skills/credentials/c/${r}`,
  lane: () => '/my/future',
  chain: (r) => `/learn/energy-transition/${r}`,
  academy: (r) => `/learn/academies/${r}`,
  opportunity: (r) => `/opportunities/${r}`,
};
export const KIND_ICON: Record<string, string> = { course: 'book', pathway: 'chart', external: 'external', adaptive: 'check', task: 'check', credential: 'grad', lane: 'globe', chain: 'link', academy: 'users', opportunity: 'briefcase' };
export function LearningLink({ r, testId = 'm32-learning' }: { r: LearningRef; testId?: string }) {
  const t = useT();
  const pick = usePick();
  return (
    <L to={(HREF[r.kind] ?? (() => '/learn'))(r.ref)} className="inline-flex items-center gap-1.5 text-[13px]" data-testid={testId} data-kind={r.kind}>
      <Icon name={KIND_ICON[r.kind] ?? 'link'} size={13} className="text-accent" />
      <span className="caps text-[10.5px] text-ink-3">{t(`m32.kind.${r.kind}`)}</span>
      <span>{pick(r as Row, 'title')}</span>
    </L>
  );
}

export function SkillChips({ ids, skills, testId = 'm32-skills' }: { ids: string[]; skills: Row[]; testId?: string }) {
  const pick = usePick();
  return (
    <span className="flex flex-wrap gap-1.5" data-testid={testId}>
      {ids.map((id) => {
        const s = skills.find((x: Row) => x.id === id);
        return (
          <L key={id} to={`/skills/${id}`} className={`chip normal-case tracking-normal no-underline ${s?.fs_area ? 'border-accent/40 bg-accent-soft text-eyebrow' : 'border-line bg-panel text-ink-2'}`}>
            {s ? pick(s, 'name') : id}
          </L>
        );
      })}
    </span>
  );
}

export function SourceList({ sources, testId = 'm32-sources' }: { sources: Row[]; testId?: string }) {
  const f = useFormat();
  return (
    <ul className="space-y-1 text-[12.5px]" data-testid={testId}>
      {sources.map((s: Row) => <li key={s.url}><SourceLink href={s.url} date={f.date(s.as_of ?? s.accessed)}>{s.label}</SourceLink></li>)}
    </ul>
  );
}

export function SignInCta({ children }: { children?: ReactNode }) {
  const t = useT();
  return (
    <Card title={t('m32.cta.signInTitle')}>
      <div className="flex flex-wrap items-center gap-3"><p className="text-[13.5px] text-ink-2">{children}</p>
        <L to="/sign-in" className="btn-primary no-underline" data-testid="m32-signin">{t('m32.cta.signIn')}</L></div>
    </Card>
  );
}

// ───────────── FS42 / FS43 pathway panel (M19 pathway rows; resolution and progress from M19's pathwayDetail RPC)
export function PathwayPanel({ track, d, showQuick }: { track: Row; d: EtRef; showQuick?: boolean }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const [confirm, setConfirm] = useState(false);
  const pathway = d.pathways.find((p: Row) => p.id === track.pathway_id);
  const det = useQuery(['pathways', 'pathway_enrolments', 'training_records', 'external_completions', 'adaptive_attempts', 'task_attempts'], () => repo.rpc.pathwayDetail(track.pathway_id), [track.pathway_id]);
  if (!pathway) return <EmptyState title={t('m32.track.notFound')} />;
  const hours = trackHours({ ...pathway, weekly_hours: Number(pathway.weekly_hours) }, d.pathway_steps.map((x: Row) => ({ ...x, hours: Number(x.hours) })), track.max_hours == null ? null : Number(track.max_hours));
  return (
    <div className="space-y-4" data-testid="m32-track" data-id={track.id} data-total={hours.total_hours} data-cap={track.max_hours ?? ''}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m32-track-tiles">
        <StatTile label={t('m32.track.envelope')} value={t('m32.monthsN', { n: f.num(Number(pathway.envelope_months)) })} sub={t('m32.track.weeksN', { n: f.num(hours.weeks) })} />
        <StatTile label={t('m32.track.weekly')} value={t('m32.hoursN', { n: f.num(hours.weekly_hours) })} sub={t('m32.track.weeklySub')} />
        <StatTile label={t('m32.track.total')} value={t('m32.hoursN', { n: f.num(hours.total_hours) })} sub={track.max_hours == null ? t('m32.track.capacity', { n: f.num(hours.capacity) }) : t('m32.track.cap', { n: f.num(Number(track.max_hours)) })} tone={hours.under_cap && hours.fits ? 'ok' : 'bad'} />
        <StatTile label={t('m32.track.steps')} value={f.num(hours.steps)} sub={t('m32.track.stepsSub')} />
      </div>
      <Async state={det} isEmpty={(x) => !x} empty={<EmptyState title={t('m32.track.staffOnly')} />}>
        {(x) => {
          if (!x) return null;
          const prog = x.mine?.progress ?? null;
          const done = new Map((prog?.steps ?? []).map((p) => [p.step_id, p]));
          const quick = quickRoute(x.resolved);
          const def = track.credential_code ? d.microcred_defs.filter((m: Row) => m.code === track.credential_code).sort((a: Row, b: Row) => b.version - a.version)[0] : null;
          const route: CriterionRoute[] = def ? credentialRoute(def.criteria ?? [], x.resolved, { courses: d.courses, adaptive: d.adaptive_banks, tasks: d.performance_tasks }) : [];
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {x.can_follow && (!x.mine || x.mine.status === 'withdrawn') && s.identity.personId && (
                  <button type="button" className="btn-primary btn-sm" onClick={() => setConfirm(true)} data-testid="m32-track-start"><Icon name="plus" size={14} />{t('m32.track.start')}</button>)}
                {x.mine && <StatusPill tone={x.mine.status === 'completed' ? 'ok' : x.mine.status === 'active' ? 'accent' : 'neutral'}>{t(`m32.track.mine.${x.mine.status}`)}</StatusPill>}
                <L to={`/learn/pathways/${track.pathway_id}`} className="btn-outline btn-sm no-underline" data-testid="m32-track-open">{t('m32.track.open')}</L>
              </div>
              {prog && <div data-testid="m32-track-progress" data-pct={prog.pct}><ProgressBar value={prog.pct} label={t('m32.track.progress', { done: f.num(prog.done), total: f.num(prog.total) })} /></div>}
              <ol className="relative space-y-3 border-s-2 border-line ps-5" data-testid="m32-track-steps">
                {x.resolved.steps.map((st) => {
                  const q = quick.steps.find((y) => y.step_id === st.step_id);
                  return (
                    <li key={st.step_id} className="relative" data-testid="m32-track-step" data-kind={st.kind} data-status={st.status} data-fits={q?.fits ? 'true' : 'false'}>
                      <span className={`absolute -start-[31px] top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 ${done.get(st.step_id)?.done ? 'border-ok bg-ok-bg text-ok' : 'border-accent/50 bg-panel text-eyebrow'}`} aria-hidden="true">
                        <Icon name={done.get(st.step_id)?.done ? 'check' : st.kind === 'assess' ? 'check' : st.kind === 'practice' ? 'briefcase' : 'book'} size={12} />
                      </span>
                      <div className="card p-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="num text-[12px] text-ink-3">{f.num(st.n)}.</span>
                          <span className="caps">{t(`m32.stepKind.${st.kind}`)}</span>
                          <span className="font-semibold">{lang === 'ar' ? st.title_ar : st.title_en}</span>
                          <span className="text-[12.5px] text-ink-3">{t('m32.hoursN', { n: f.num(st.hours) })}</span>
                          {done.get(st.step_id)?.done && <StatusPill tone="ok">{t('m32.track.stepDone')}</StatusPill>}
                        </div>
                        <ul className="mt-2 space-y-1">
                          {st.items.map((it) => (
                            <li key={`${it.type}:${it.id}`} className="flex flex-wrap items-center gap-2 text-[13px]">
                              <L to={it.link} className="inline-flex items-center gap-1.5"><Icon name={it.type === 'external' ? 'external' : it.type === 'course' ? 'book' : 'check'} size={13} className="text-accent" />{lang === 'ar' ? it.title_ar : it.title_en}</L>
                              <span className="caps text-[10.5px] text-ink-3">{t(`m32.itemType.${it.type}`)}</span>
                              <span className="text-[12px] text-ink-3">{it.hours == null ? t('m32.track.shortItem') : t('m32.hoursN', { n: f.num(it.hours) })}</span>
                              {showQuick && q?.quickest?.id === it.id && q.quickest.type === it.type && <StatusPill tone="info">{t('m32.track.quickest')}</StatusPill>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {showQuick && (
                <p className={`text-[13px] ${quick.all_fit ? 'text-ok' : 'text-bad'}`} data-testid="m32-quick" data-fit={quick.all_fit ? 'true' : 'false'}>
                  <Icon name={quick.all_fit ? 'check' : 'alert'} size={14} className="me-1 inline" />{t(quick.all_fit ? 'm32.track.quickOk' : 'm32.track.quickNo', { n: f.num(quick.planned) })}
                </p>)}
              {def && (
                <Card title={t('m32.cred.title', { code: def.code })} eyebrow={<span className="flex items-center gap-2">{pick(def, 'title')}<StatusPill tone={def.status === 'current' ? 'ok' : 'sim'}>{t(`m32.cred.status.${def.status === 'current' ? 'current' : 'draft'}`)}</StatusPill></span>}>
                  {def.status !== 'current' && <p className="mb-2 text-[13px] text-ink-2" data-testid="m32-cred-draft">{t('m32.cred.draftBody')}</p>}
                  <ul className="space-y-1.5" data-testid="m32-cred-route">
                    {route.map((r) => (
                      <li key={r.key} className="flex flex-wrap items-center gap-2 text-[13px]" data-testid="m32-cred-criterion" data-covered={r.covered ? 'true' : 'false'}>
                        <Icon name={r.covered ? 'check' : 'info'} size={14} className={r.covered ? 'text-ok' : 'text-ink-3'} />
                        <span>{lang === 'ar' ? r.label_ar : r.label_en}</span>
                        <span className="text-[12px] text-ink-3">{r.covered ? t('m32.cred.via', { steps: r.via.map((v) => f.num(v.n)).filter((v, i, a) => a.indexOf(v) === i).join(', ') }) : t('m32.cred.notOnRoute')}</span>
                      </li>
                    ))}
                  </ul>
                  {def.status === 'current' && <L to={`/my/skills/credentials/c/${def.code}`} className="mt-2 inline-block text-[13px]" data-testid="m32-cred-link">{t('m32.cred.open')}</L>}
                </Card>
              )}
              <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m32.track.startTitle')} consequence={t('m32.track.startBody', { title: pick(pathway, 'title') })}
                onConfirm={() => run(() => repo.rpc.startPathway(track.pathway_id), { success: t('m32.track.started') })} />
            </div>
          );
        }}
      </Async>
    </div>
  );
}
