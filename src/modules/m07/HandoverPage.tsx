// M07 /workforce/handover (F22): Handover 2030 readiness board. Counts only, by function or role: positions with external or
// partner cover (KHNP OSSA, SAMPLE plan), ENEC successors by readiness band (F19 slates, else F05 shortlists), the training
// pipeline (COIT, LOIT, GPO, DNT and discipline cohorts) and the projected ready dates (SIMULATED), as a burn-down to the OSSA
// end, a risk list with reasons, and the Emirati share of ready successors. Every cell under 10 is "suppressed"; no
// person-level row reaches the client (rpc.handoverAggregate). HR can draft an observer-safe release (existing workflow).
import { useMemo, useState } from 'react';
import { useAction, useRepo, useQuery } from '../../data';
import type { Table } from '../../data/types';
import { useSession } from '../../auth/session';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { Page, Section, Grid, Card, Async, EmptyState, Callout, DataTable, StatusPill, ConfirmDialog, SimChip, SourceLink, Heatmap, BarChart, WhyThis, Icon } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { groupReasons, isWhatIf, riskList, OSSA_END_DEFAULT, PIPE_ROUTES, type HoGroup } from './handover';
import type { HandoverResult } from './backend/rpc';
import { DefLink, ExportButton, MetricTile, PeriodSelect, useWatermarkedExport } from './shared';
import { HandoverBurndown, LinkOrNote, Sup, cellText, useOpenable } from './handoverUi';

const OSSA_SOURCE = 'https://world-nuclear-news.org/articles/agreement-assures-korean-expert-support-for-uae-pl';
const NAFIS_SOURCE = 'https://gulfnews.com/uae/nafis-2026-introduces-5-ai-enabled-priorities-to-measure-the-quality-of-emiratisation-in-the-private-sector-1.500427621';
/** Tables whose changes refresh the board (F19 succession tables included when they exist). */
const WATCH = ['external_cover', 'handover_cohorts', 'career_targets', 'person_skills', 'job_roles', 'successors', 'succession_slates'] as unknown as Table[];
const OSSA_CHOICES = [2028, 2029, 2030, 2031, 2032];
const SLIP_CHOICES = [0, 6, 12, 18, 24];

export default function HandoverPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const exportCsv = useWatermarkedExport();
  const openable = useOpenable();
  const [period, setPeriod] = useState('');
  const [dim, setDim] = useState<'functions' | 'roles'>('functions');
  const [ossa, setOssa] = useState(OSSA_END_DEFAULT);
  const [slip, setSlip] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const canRelease = s.can('observer_release', ['W', 'A']);

  const q = useQuery(WATCH, async () => {
    const r = await repo.rpc.handoverAggregate(period, { ossa_end: ossa, slip_months: slip });
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data;
  }, [period, ossa, slip]);
  const labels = useQuery(['job_families', 'job_roles'], async () => {
    const [fams, roles] = await Promise.all([repo.list('job_families'), repo.list('job_roles')]);
    return { fams, roles };
  });
  const label = (g: HoGroup, kind: 'functions' | 'roles') =>
    g.key === 'total' ? t('m07.ho.total') : kind === 'functions' ? pick(labels.data?.fams.find((x) => x.id === g.key), 'name') || g.key : pick(labels.data?.roles.find((x) => x.id === g.key), 'title') || g.key;
  const whatIf = isWhatIf({ ossa_end: ossa, slip_months: slip });

  return (
    <Page
      title={t('m07.routes.workforce-handover.title')}
      intro={t('m07.ho.intro')}
      wide
      actions={q.data ? <ExportButton onClick={() => exportBoard(q.data!)} /> : undefined}
    >
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2" data-testid="m07-ho-labels">
        <SimChip label={t('common.sample')} />
        <SimChip label={t('common.simulated')} />
        <span>{t('m07.ho.labels', { n: MIN_GROUP_SIZE })}</span>
        <DefLink metric="handover_cover" />
      </div>
      <Callout tone="info" title={t('m07.ho.mirrorTitle')}>
        {t('m07.ho.mirrorBody')} <SourceLink href={OSSA_SOURCE} date="2026-10-08">{t('m07.ho.ossaSource')}</SourceLink>
      </Callout>

      <Card>
        <div className="flex flex-wrap items-end gap-4" data-testid="m07-ho-controls">
          {q.data && <PeriodSelect periods={q.data.periods} value={q.data.period} onChange={setPeriod} />}
          <fieldset className="flex flex-col gap-1">
            <legend className="caps">{t('m07.ho.view')}</legend>
            <div className="flex gap-1" role="group">
              {(['functions', 'roles'] as const).map((d) => (
                <button key={d} type="button" className={dim === d ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} aria-pressed={dim === d} onClick={() => setDim(d)} data-testid={`m07-ho-dim-${d}`}>
                  {t(`m07.ho.dim.${d}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1">
            <span className="caps">{t('m07.ho.ossaEnd')}</span>
            <select className="input min-w-[120px]" value={ossa} onChange={(e) => setOssa(Number(e.target.value))} data-testid="m07-ho-ossa">
              {OSSA_CHOICES.map((y) => <option key={y} value={y}>{y}{y === OSSA_END_DEFAULT ? ` · ${t('m07.ho.plan')}` : ''}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="caps">{t('m07.ho.slip')}</span>
            <select className="input min-w-[120px]" value={slip} onChange={(e) => setSlip(Number(e.target.value))} data-testid="m07-ho-slip">
              {SLIP_CHOICES.map((m) => <option key={m} value={m}>{t('m07.ho.months', { n: f.num(m) })}</option>)}
            </select>
          </label>
          {whatIf && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => { setOssa(OSSA_END_DEFAULT); setSlip(0); }} data-testid="m07-ho-reset">
              <Icon name="reset" size={14} />
              {t('m07.ho.reset')}
            </button>
          )}
        </div>
        {whatIf && (
          <div className="mt-3" data-testid="m07-ho-whatif">
            <Callout tone="sim" title={t('m07.ho.whatIfTitle')}>{t('m07.ho.whatIfBody', { year: ossa, months: f.num(slip) })}</Callout>
          </div>
        )}
      </Card>

      <Async state={q} empty={<EmptyState title={t('m07.noData')} />} isEmpty={(d) => d.roles.length === 0}>
        {(a) => <Board a={a} dim={dim} label={label} openable={openable} />}
      </Async>

      {canRelease && q.data && (
        <Section title={t('m07.ho.release.title')} description={t('m07.ho.release.hint')}>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-[60ch] text-[13.5px] text-ink-2">{t('m07.ho.release.body')}</p>
              <button className="btn-primary btn-sm" onClick={() => setConfirm(true)} data-testid="m07-ho-release">
                <Icon name="shield" size={14} />
                {t('m07.ho.release.prepare')}
              </button>
            </div>
            {draftId && (
              <p className="mt-2 text-[13px]" data-testid="m07-ho-release-done">
                {t('m07.ho.release.saved', { id: draftId })} <L to="/workforce">{t('m07.ho.release.open')}</L>
              </p>
            )}
          </Card>
        </Section>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('m07.ho.release.confirmTitle')}
        consequence={t('m07.ho.release.confirmBody', { period: q.data?.period ?? '' })}
        actingAs={t('m07.releases.asHr')}
        confirmLabel={t('m07.ho.release.prepare')}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.prepareHandoverRelease(q.data?.period ?? ''));
          if (r.ok && r.data) setDraftId(r.data.id);
        }}
      />

      <p className="text-[12px] text-ink-3">
        {t('m07.ho.footer')} <SourceLink href={NAFIS_SOURCE} date="2026-10-08">{t('m07.ho.nafisSource')}</SourceLink>
      </p>
    </Page>
  );

  function exportBoard(a: HandoverResult) {
    const groups = [a.total, ...(dim === 'functions' ? a.functions : a.roles)];
    exportCsv(`handover-2030-${a.period}${isWhatIf(a) ? '-whatif' : ''}`,
      ['group', 'period', 'ossa_end', 'slip_months', ...a.years.map((y) => `cover_${y}`), 'ready_now', 'ready_1_2y', 'ready_3_5y', 'pipeline', ...a.years.map((y) => `ready_by_${y}`), 'first_shortfall', 'emirati_share_pct', 'label'],
      groups.map((g) => [label(g, dim), a.period, a.ossa_end, a.slip_months, ...g.cover.map(cellText), cellText(g.bands.now), cellText(g.bands.y1_2), cellText(g.bands.y3_5), cellText(g.pipeline_total), ...g.ready.map(cellText),
        g.first_shortfall ?? 'none', g.emirati_share_pm == null ? 'suppressed' : (g.emirati_share_pm / 10).toFixed(1), 'SAMPLE plan; SIMULATED projection']));
  }
}

function Board({ a, dim, label, openable }: { a: HandoverResult; dim: 'functions' | 'roles'; label: (g: HoGroup, k: 'functions' | 'roles') => string; openable: (p: string) => string | null }) {
  const t = useT();
  const f = useFormat();
  const groups = dim === 'functions' ? a.functions : a.roles;
  const endIdx = a.years.indexOf(Math.min(a.ossa_end, a.years[a.years.length - 1]));
  const risks = useMemo(() => riskList(groups, a), [groups, a]);
  const share = (pm: number | null) => (pm == null ? null : pm / 10);
  const klra = openable('/knowledge/klra');
  const capture = openable('/knowledge/capture');
  const succession = openable('/talent/succession');
  const bench = openable('/workforce/critical-roles');
  const notYet = t('m07.ho.links.notYet');
  return (
    <>
      <div data-testid="m07-ho-tiles">
        <Grid cols={4}>
          <MetricTile metric="handover_cover" label={t('m07.metric.handover_cover')} value={<Sup c={a.total.cover[0]} />} sub={t('m07.ho.tile.coverSub', { year: a.as_of_year })} sample source={t('m07.ho.tile.planSource')} asOf={a.period} />
          <MetricTile metric="handover_ready" label={t('m07.metric.handover_ready')} value={<Sup c={a.total.ready[endIdx]} />} sub={t('m07.ho.tile.readySub', { year: a.years[endIdx] })} sample tone="sim" source={t('common.simulated')} />
          <MetricTile metric="handover_pipeline" label={t('m07.metric.handover_pipeline')} value={<Sup c={a.total.pipeline_total} />} sub={t('m07.ho.tile.pipelineSub')} sample source={t('m07.ho.tile.planSource')} asOf={a.period} />
          <MetricTile metric="handover_risk" label={t('m07.metric.handover_risk')} value={f.num(a.functions.filter((g) => g.risk).length)} tone={a.functions.some((g) => g.risk) ? 'bad' : 'ok'}
            sub={a.total.first_shortfall ? t('m07.ho.tile.firstShort', { year: a.total.first_shortfall }) : t('m07.ho.tile.noShort')} sample source={t('common.simulated')} />
        </Grid>
      </div>

      <Grid cols={2}>
        <Card title={t('m07.ho.burndown.title')} eyebrow={t('m07.ho.burndown.eyebrow', { year: a.ossa_end })} actions={<span className="flex items-center gap-2"><DefLink metric="handover_burndown" /><SimChip label={t('common.simulated')} /></span>}>
          <HandoverBurndown years={a.years} cover={a.total.cover} ready={a.total.ready} />
        </Card>
        <Card title={t('m07.ho.risk.title')} eyebrow={t(`m07.ho.dim.${dim}`)} actions={<DefLink metric="handover_burndown" />}>
          {risks.length === 0 ? (
            <EmptyState icon="check" title={t('m07.ho.risk.none')}>{t('m07.ho.risk.noneBody')}</EmptyState>
          ) : (
            <ol className="space-y-2" data-testid="m07-ho-risks">
              {risks.map((r) => (
                <li key={r.id} className="rounded-card border border-line p-3" data-testid="m07-ho-risk">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{label(r.item, dim)}</span>
                    <span className="flex items-center gap-2">
                      <StatusPill tone="bad">{t('m07.ho.risk.from', { year: r.item.first_shortfall ?? '' })}</StatusPill>
                      <WhyThis reasons={r.reasons} testId="m07-ho-why" />
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-2">
                    {t('m07.ho.risk.max')} <Sup c={r.item.max_shortfall} /> · {t('m07.ho.risk.years')} {r.item.at_risk_years.join(', ')}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
                    <LinkOrNote to={klra} note={notYet}>{t('m07.ho.links.klra')}</LinkOrNote>
                    <LinkOrNote to={capture} note={notYet}>{t('m07.ho.links.capture')}</LinkOrNote>
                    <LinkOrNote to={succession} note={notYet}>{t('m07.ho.links.succession')}</LinkOrNote>
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </Grid>

      <Card title={t('m07.ho.matrix.title')} eyebrow={t(`m07.ho.dim.${dim}`)} actions={<span className="flex items-center gap-2"><DefLink metric="handover_burndown" /><SimChip label={t('common.simulated')} /></span>}>
        <div data-testid="m07-ho-matrix">
          <Heatmap
            title={t('m07.ho.matrix.title')}
            rows={groups.map((g) => g.key)}
            cols={a.years.map(String)}
            rowLabel={(k) => label(groups.find((g) => g.key === k)!, dim)}
            value={(k, y) => {
              const g = groups.find((x) => x.key === k)!;
              const yr = Number(y);
              if (g.cover[0] == null) return { v: null, suppressed: true };
              return g.at_risk_years.includes(yr) ? { v: null, tone: 'bad', label: t('m07.ho.matrix.short') } : { v: null, tone: 'ok', label: t('m07.ho.matrix.ok') };
            }}
          />
        </div>
        <p className="mt-2 text-[12px] text-ink-3">{t('m07.ho.matrix.note', { n: MIN_GROUP_SIZE })}</p>
      </Card>

      <div data-testid="m07-ho-table">
        <DataTable
          rows={[a.total, ...groups]}
          rowKey={(g) => g.key}
          searchable={false}
          pageSize={40}
          caption={t('m07.ho.table.caption')}
          columns={[
            { key: 'group', header: t(`m07.ho.dim.${dim}`), value: (g) => label(g, dim), render: (g) => (g.key === 'total' ? <strong>{label(g, dim)}</strong> : dim === 'roles' ? <L to={`/careers/roles/${g.key}`}>{label(g, dim)}</L> : label(g, dim)) },
            { key: 'cover', header: t('m07.ho.table.cover', { year: a.as_of_year }), value: (g) => g.cover[0] ?? -1, sortable: true, align: 'end', render: (g) => <Sup c={g.cover[0]} /> },
            { key: 'now', header: t('m07.ho.band.now'), value: (g) => g.bands.now ?? -1, align: 'end', render: (g) => <Sup c={g.bands.now} /> },
            { key: 'y12', header: t('m07.ho.band.y1_2'), value: (g) => g.bands.y1_2 ?? -1, align: 'end', render: (g) => <Sup c={g.bands.y1_2} /> },
            { key: 'y35', header: t('m07.ho.band.y3_5'), value: (g) => g.bands.y3_5 ?? -1, align: 'end', render: (g) => <Sup c={g.bands.y3_5} /> },
            { key: 'pipe', header: t('m07.ho.table.pipeline'), value: (g) => g.pipeline_total ?? -1, align: 'end', render: (g) => <Sup c={g.pipeline_total} /> },
            { key: 'ready', header: t('m07.ho.table.readyBy', { year: a.years[endIdx] }), value: (g) => g.ready[endIdx] ?? -1, align: 'end', render: (g) => <Sup c={g.ready[endIdx]} /> },
            { key: 'em', header: t('m07.ho.table.emirati'), value: (g) => g.emirati_share_pm ?? -1, align: 'end', render: (g) => (g.emirati_share_pm == null ? <Sup c={null} /> : <span className="num">{f.pct(share(g.emirati_share_pm))}</span>) },
            { key: 'src', header: t('m07.ho.table.source'), value: (g) => g.source, render: (g) => <span className="text-[12px] text-ink-2">{t(`m07.ho.source.${g.source}`)}</span> },
            { key: 'status', header: t('m07.ho.table.status'), value: (g) => (g.risk ? 0 : 1), sortable: true, render: (g) => (g.risk ? <StatusPill tone="bad">{t('m07.ho.risk.from', { year: g.first_shortfall ?? '' })}</StatusPill> : <StatusPill tone="ok">{t('m07.ho.onTrack')}</StatusPill>) },
            { key: 'why', header: '', csv: false, render: (g) => <WhyThis reasons={groupReasons(g, a)} testId="m07-ho-row-why" /> },
          ]}
        />
      </div>

      <Grid cols={2}>
        <Card title={t('m07.ho.pipeline.title')} actions={<span className="flex items-center gap-2"><DefLink metric="handover_pipeline" /><SimChip label={t('common.sample')} /></span>}>
          <div data-testid="m07-ho-pipeline">
            <BarChart
              title={t('m07.ho.pipeline.title')}
              data={PIPE_ROUTES.map((r) => ({ label: t(`m07.ho.route.${r}`), value: a.total.pipeline[r], suppressed: a.total.pipeline[r] == null, tone: r === 'gpo' || r === 'dnt' ? 'leaf' : 'accent' }))}
            />
          </div>
          <p className="mt-2 text-[12px] text-ink-3">{t('m07.ho.pipeline.note')}</p>
        </Card>
        <Card title={t('m07.ho.emirati.title')} actions={<span className="flex items-center gap-2"><DefLink metric="handover_emirati" /><SimChip label={t('common.simulated')} /></span>}>
          <div className="flex items-baseline gap-3" data-testid="m07-ho-emirati">
            <span className="text-[30px] font-semibold">{a.total.emirati_share_pm == null ? <Sup c={null} /> : f.pct(share(a.total.emirati_share_pm))}</span>
            <span className="text-[13px] text-ink-2">{t('m07.ho.emirati.of', { year: a.years[endIdx] })}</span>
          </div>
          <p className="mt-2 text-[12.5px] text-ink-2">{t('m07.ho.emirati.body')}</p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
            <LinkOrNote to={bench} note={notYet}>{t('m07.ho.links.bench')}</LinkOrNote>
            <LinkOrNote to={succession} note={notYet}>{t('m07.ho.links.succession')}</LinkOrNote>
          </p>
        </Card>
      </Grid>
    </>
  );
}
