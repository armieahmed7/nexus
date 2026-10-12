// FS77 /pathways/journey/starter: the student future-skills starter (FS wave H · E5). Public. Two tracks of short lessons (AI literacy;
// SMR orientation, "no deployment decision implied"), each fact with its source and as-of date and a non-scoring self-check; a preview of
// the induction a given intake year will get (from the published intake baselines, client-side); and the induction catalogue.
// Anonymous visitors store nothing: no RPC, no write, no browser storage (unit-tested). Signed-in students may keep their progress in
// their own F34 journey (checklist keys "starter:<lesson>") through the existing saveStudentJourney RPC.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { Async, BenchmarkChips, Callout, Card, EmptyState, Grid, Icon, Page, ProgressBar, Section, StatTile, StatusPill } from '../../ui';
import { L, useFormat, useI18n, usePick, useT } from '../../i18n';
import { PLAN_PROGRAMMES, STARTER_TRACKS, baselineFor, entriesOf, inductionPlan, listedModules, starterKey, starterProgress, type StarterTrack } from './starter';
import { LessonCard, PlanTable, useStarterRefs, type ModuleRow } from './starterUi';

type Checklist = Record<string, string>;

export default function StarterPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const act = useAction();
  const refs = useStarterRefs();
  const canSave = s.status === 'signed_in' && s.can('applications', ['Own']);
  const me = s.persona?.persona ?? null;
  const saved = useQuery('student_journeys', async () => (canSave ? { who: me, rows: await repo.list('student_journeys', {}) } : null), [canSave, me]);
  const [checked, setChecked] = useState<Checklist>({});
  const [busy, setBusy] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const row = saved.data?.who === me ? saved.data?.rows.find((j) => !j.cleared_at) ?? null : null;

  // A signed-in student gets their earlier starter progress back; anonymous visitors start empty every time.
  useEffect(() => {
    if (!canSave || !row || loadedFor.current === me) return;
    loadedFor.current = me;
    const c = ((row.milestones ?? {}) as { checklist?: Checklist }).checklist ?? {};
    setChecked(Object.fromEntries(Object.entries(c).filter(([k]) => k.startsWith('starter:'))));
  }, [canSave, row, me]);

  const progress = starterProgress(refs.lessons as never, checked);
  const modTitle = (id: string | null | undefined) => refs.modules.find((m) => m.id === id);
  const pick = usePick();

  const save = async () => {
    setBusy(true);
    try {
      // The journey row is replaced as a whole, so its stage, route, answers and checklist travel back unchanged with the starter keys.
      const i = (row?.interests ?? {}) as { answers?: Record<string, string> };
      const m = ((row?.milestones ?? {}) as { checklist?: Checklist }).checklist ?? {};
      const checklist = { ...Object.fromEntries(Object.entries(m).filter(([k]) => !k.startsWith('starter:'))), ...checked };
      await act(() => repo.rpc.saveStudentJourney({ stage: row?.stage ?? null, route: row?.route ?? null, answers: i.answers ?? {}, checklist }), { success: t('m06.starter.saved') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={t('m06.routes.pathways-starter.title')} eyebrow={t('m06.starter.eyebrow')} intro={t('m06.starter.intro')} wide>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <BenchmarkChips feature="FS77" />
            <StatusPill tone={canSave ? 'info' : 'neutral'}>{canSave ? t('m06.starter.storeSigned') : t('m06.starter.storeNothing')}</StatusPill>
          </div>
          <nav aria-label={t('m06.starter.jump')} className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
            {['ai', 'smr', 'induction', 'catalogue'].map((a) => <a key={a} href={`#${a}`}>{t(`m06.starter.nav.${a}`)}</a>)}
            <L to="/pathways/journey">{t('m06.starter.backJourney')}</L>
          </nav>
        </div>
      </Card>

      <Async state={refs.lessonsState} empty={<EmptyState title={t('m06.starter.noLessons')} />}>
        {() => (
          <>
            {STARTER_TRACKS.map((track) => (
              <Section key={track} id={track} title={t(`m06.starter.track.${track}`)} description={t(`m06.starter.trackHint.${track}`)}
                actions={<TrackProgress done={progress[track].done} total={progress[track].total} track={track} />}>
                {track === 'smr' && <Callout tone="sim" title={t('m06.starter.noDeployTitle')}>{t('m06.starter.noDeploy')}</Callout>}
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid={`m06-starter-track-${track}`}>
                  {refs.lessons.filter((l) => l.track === track).map((l) => {
                    const mt = modTitle(l.induction_module_id);
                    return (
                      <LessonCard key={l.id} lesson={l} done={checked[starterKey(l.id)] === 'done'} moduleTitle={mt ? pick(mt as never, 'title') : null}
                        onChecked={(id) => setChecked((c) => ({ ...c, [starterKey(id)]: 'done' }))} />
                    );
                  })}
                </ul>
              </Section>
            ))}
          </>
        )}
      </Async>

      <SaveCard canSave={canSave} signedIn={s.status === 'signed_in'} busy={busy} onSave={save} any={Object.keys(checked).length > 0} />

      <Section id="induction" title={t('m06.starter.baselinesTitle')} description={t('m06.starter.baselinesHint')}>
        <Async state={refs.modulesState} empty={<EmptyState title={t('m06.starter.noModules')} />}>
          {() => <IntakePreview modules={refs.modules} baselines={refs.baselines} />}
        </Async>
      </Section>

      <Section id="catalogue" title={t('m06.starter.catalogueTitle')} description={t('m06.starter.catalogueHint')}>
        <Catalogue modules={refs.modules} />
      </Section>

      <Callout tone="info" title={t('m06.starter.rulesTitle')}>{t('m06.starter.rulesBody')}</Callout>
    </Page>
  );
}

function TrackProgress({ done, total, track }: { done: number; total: number; track: StarterTrack }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="w-44" data-testid={`m06-starter-progress-${track}`}>
      <div className="mb-1 text-[12px] text-ink-2">{t('m06.starter.progress', { done: f.num(done), total: f.num(total) })}</div>
      <ProgressBar value={total ? (100 * done) / total : 0} label={t('m06.starter.progress', { done: f.num(done), total: f.num(total) })} />
    </div>
  );
}

function SaveCard({ canSave, signedIn, busy, onSave, any }: { canSave: boolean; signedIn: boolean; busy: boolean; onSave: () => void; any: boolean }) {
  const t = useT();
  const { path } = useI18n();
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3" data-testid="m06-starter-savebar">
        <p className="max-w-2xl text-[13px] text-ink-2">{canSave ? t('m06.starter.saveHint') : signedIn ? t('m06.starter.saveNotForRole') : t('m06.starter.saveAnon')}</p>
        {canSave ? (
          <button type="button" className="btn-primary" onClick={onSave} disabled={busy || !any} data-testid="m06-starter-save">
            <Icon name="check" size={15} />
            {t('m06.starter.save')}
          </button>
        ) : !signedIn ? (
          <L to={`/sign-in?next=${encodeURIComponent(path)}`} className="btn-outline" data-testid="m06-starter-signin">
            <Icon name="user" size={15} />
            {t('m06.starter.signIn')}
          </L>
        ) : null}
      </div>
    </Card>
  );
}

/** "What will induction look like for my intake?": the published baseline for an intake year and route, applied client-side. */
function IntakePreview({ modules, baselines }: { modules: ModuleRow[]; baselines: ReturnType<typeof useStarterRefs>['baselines'] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const published = baselines.filter((b) => b.status === 'published');
  const years = [...new Set(published.map((b) => b.intake_year))].sort((a, b) => b - a);
  const [year, setYear] = useState<number | null>(null);
  const [prog, setProg] = useState<string>('dnt');
  const y = year ?? years[0] ?? null;
  const base = y ? baselineFor(published, y, prog) : null;
  const plan = useMemo(() => inductionPlan(modules, base), [modules, base]);
  if (!y) return <EmptyState title={t('m06.starter.noBaselines')} />;
  const byId = new Map(modules.map((m) => [m.id, m]));
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card title={t('m06.starter.previewTitle')}>
        <div className="space-y-3">
          <div>
            <div className="caps mb-1">{t('m06.starter.previewYear')}</div>
            <div role="radiogroup" aria-label={t('m06.starter.previewYear')} className="flex flex-wrap gap-1.5">
              {years.map((x) => (
                <button key={x} type="button" role="radio" aria-checked={x === y} className={x === y ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setYear(x)} data-testid={`m06-starter-year-${x}`}>
                  <span className="num">{f.num(x, { useGrouping: false })}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="caps mb-1">{t('m06.starter.previewRoute')}</div>
            <div role="radiogroup" aria-label={t('m06.starter.previewRoute')} className="flex flex-wrap gap-1.5">
              {PLAN_PROGRAMMES.map((p) => (
                <button key={p} type="button" role="radio" aria-checked={p === prog} className={p === prog ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} onClick={() => setProg(p)} data-testid={`m06-starter-prog-${p}`}>
                  {t(`m06.ind.programme.${p}`)}
                </button>
              ))}
            </div>
          </div>
          <Grid cols={3}>
            <StatTile label={t('m06.ind.totals.planned')} value={<span data-testid="m06-starter-planned">{t('m06.ind.hoursN', { n: f.num(plan.hours_planned) })}</span>} />
            <StatTile label={t('m06.ind.totals.saved')} value={t('m06.ind.hoursN', { n: f.num(plan.hours_saved) })} tone="ok" />
            <StatTile label={t('m06.ind.totals.total')} value={t('m06.ind.hoursN', { n: f.num(plan.hours_total) })} />
          </Grid>
          {base ? (
            <div className="space-y-1 text-[12.5px] text-ink-2" data-testid="m06-starter-baseline">
              <div>{t('m06.starter.previewFrom', { scope: t(`m06.ind.programme.${base.programme}`), version: f.num(base.version), date: f.date(base.published_at ?? null) })}</div>
              {pick(base as never, 'note') && <div>{pick(base as never, 'note')}</div>}
              <ul className="space-y-0.5">
                {entriesOf(base).filter((e) => e.status !== 'not_held').map((e) => (
                  <li key={e.module_id}>
                    · {byId.get(e.module_id) ? pick(byId.get(e.module_id) as never, 'title') : e.module_id}: {t(`m06.ind.status.${e.status}`)} ({t(`m06.ind.basis.${e.basis}`)})
                    {e.source_url && <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="ms-1 inline-flex items-center gap-0.5">{t('common.source')}<Icon name="external" size={11} /></a>}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Callout tone="info">{t('m06.starter.previewNone')}</Callout>
          )}
        </div>
      </Card>
      <PlanTable plan={plan} modules={modules} year={y} testId="m06-starter-plan" />
    </div>
  );
}

function Catalogue({ modules }: { modules: ModuleRow[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="m06-starter-catalogue">
      {listedModules(modules).map((m0) => {
        const m = m0 as ModuleRow;
        return (
          <li key={m.id} className="card p-4" data-testid="m06-starter-module" data-mandatory={m.mandatory ? 'true' : undefined}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="font-semibold">{pick(m as never, 'title')}</span>
              <span className="num text-[12.5px] text-ink-2">{t('m06.ind.hoursN', { n: f.num(m.hours) })}</span>
            </div>
            <p className="mt-1 text-[12.5px] text-ink-2">{pick(m as never, 'summary')}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="chip border-line bg-panel text-ink-2">{t(`m06.ind.area.${m.area}`)}</span>
              {m.mandatory ? <span className="chip border-line bg-sunken text-ink">{t('m06.ind.mandatory')}</span> : <span className="chip border-line bg-panel text-ink-2">{t('m06.ind.refresherN', { n: f.num(m.refresh_hours) })}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
