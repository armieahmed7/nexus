// FS55 (wave F · E3): the two /admin/ai-transparency tabs added by FS55.
//  - SurfacesTab: the ranked-surface registry (src/modules/m16/surfaces.ts) next to the engine cards: every place that ranks options for a
//    person, its card, kernel surface (transform and assess are defaults only), what it ranks and its fairness outcome. The lint test
//    tests/unit/fs63-engine-lint.test.ts keeps this list complete.
//  - SurfaceFairnessTab: weekly fairness of the FS55 surfaces (kafaa_surface_fairness), F24 rules: groups under 10 suppress the whole
//    comparison, four-fifths flag. Platform admins run this week's snapshot (rpc.runSurfaceFairness: confirmed, audited, ledgered).
import { useMemo, useState } from 'react';
import { useAction, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { BarChart, Callout, DataTable, EmptyState, Icon, Section, StatTile, StatusPill, type Column } from '../../ui';
import { todayIso } from '../../domain/rules';
import type { EngineCardsRow, SurfaceFairnessRow } from '../../data/types';
import { FOUR_FIFTHS, isoWeek } from './fairness';
import { RANKED_SURFACES, SURFACE_METRICS, type RankedSurface } from './surfaces';
import { GatedConfirm } from './parts';

export function SurfacesTab({ cards }: { cards: EngineCardsRow[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const byId = new Map(cards.map((c) => [c.id, c]));
  const missing = RANKED_SURFACES.filter((s) => !byId.has(s.card));
  const fsCount = RANKED_SURFACES.filter((s) => s.wave === 'FS55').length;
  const defaultsOnly = RANKED_SURFACES.filter((s) => s.kernel === 'transform' || s.kernel === 'assess').length;
  const fairness = (s: RankedSurface) => ('none' in s.fairness ? t(`m16.reg.none.${s.fairness.none}`) : t('m16.reg.metricBasis', { metric: t(`m16.reg.metric.${'f24' in s.fairness ? s.fairness.f24 : s.fairness.metric}`) }));
  const cols: Column<RankedSurface>[] = [
    { key: 'card', header: t('m16.reg.col.card'), value: (s) => s.card, sortable: true, render: (s) => { const c = byId.get(s.card); return <span className="min-w-0"><span className="font-semibold">{c ? pick(c, 'title') : s.card}</span> <span className="font-mono text-[11px] text-ink-3" dir="ltr">{s.feature}</span></span>; } },
    { key: 'module', header: t('m16.reg.col.module'), value: (s) => s.module, sortable: true, render: (s) => <L to={s.route} className="link font-mono text-[12px]" dir="ltr">{s.module}</L> },
    { key: 'kernel', header: t('m16.reg.col.kernel'), value: (s) => s.kernel, sortable: true, render: (s) => <span className="flex flex-wrap items-center gap-1"><StatusPill tone={s.kernel === 'transform' || s.kernel === 'assess' ? 'sim' : s.kernel === 'rules' ? 'neutral' : 'info'}>{t(`m16.reg.kernel.${s.kernel}`)}</StatusPill>{s.kernel !== s.stored && <span className="text-[11px] text-ink-3">{t('m16.reg.stored', { s: t(`common.engines.surface.${s.stored}`) })}</span>}</span> },
    { key: 'ranks', header: t('m16.reg.col.ranks'), value: (s) => s.ranks, render: (s) => t(`m16.reg.ranks.${s.ranks}`) },
    { key: 'fairness', header: t('m16.reg.col.fairness'), value: (s) => ('none' in s.fairness ? s.fairness.none : 'metric'), render: (s) => <span className="text-[12.5px]">{fairness(s)}</span> },
    { key: 'fns', header: t('m16.reg.col.functions'), value: (s) => s.functions.length, sortable: true, render: (s) => <span title={s.functions.join('\n')} className="num">{f.num(s.functions.length)}</span> },
    { key: 'status', header: t('m16.reg.col.status'), value: (s) => (byId.has(s.card) ? 1 : 0), render: (s) => (byId.has(s.card) ? <StatusPill tone="ok">{t('m16.reg.carded')}</StatusPill> : <StatusPill tone="bad">{t('m16.reg.missing')}</StatusPill>) },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="m16-reg-tiles">
        <StatTile label={t('m16.reg.tile.surfaces')} value={f.num(RANKED_SURFACES.length)} sub={t('m16.reg.tile.surfacesSub', { n: f.num(fsCount) })} />
        <StatTile label={t('m16.reg.tile.missing')} value={f.num(missing.length)} tone={missing.length ? 'bad' : 'ok'} sub={t('m16.reg.tile.missingSub')} />
        <StatTile label={t('m16.reg.tile.defaults')} value={f.num(defaultsOnly)} tone="sim" sub={t('m16.reg.tile.defaultsSub')} />
        <StatTile label={t('m16.reg.tile.fairness')} value={f.num(RANKED_SURFACES.filter((s) => !('none' in s.fairness)).length)} sub={t('m16.reg.tile.fairnessSub', { n: f.num(SURFACE_METRICS.length) })} />
      </div>
      <Callout title={t('m16.reg.howTitle')}>
        <p>{t('m16.reg.howBody')}</p>
        <p className="mt-1 text-[12.5px]">{t('m16.reg.defaultsNote')}</p>
        <p className="mt-2 flex flex-wrap gap-3 text-[12.5px]"><L to="/admin/ai-transparency/model-risk" className="link" data-testid="m16-reg-model-risk">{t('m16.reg.toModelRisk')}</L><L to="/skills/datasheet" className="link">{t('m16.reg.toDatasheet')}</L></p>
      </Callout>
      <div data-testid="m16-reg-table" data-missing={missing.length}><DataTable rows={RANKED_SURFACES} rowKey={(s) => s.card} columns={cols} csvName="kafaa-ranked-surfaces" pageSize={40} /></div>
    </div>
  );
}

export function SurfaceFairnessTab({ rows, canRun, cards }: { rows: SurfaceFairnessRow[]; canRun: boolean; cards: EngineCardsRow[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const periods = useMemo(() => [...new Set(rows.map((r) => r.period))].sort(), [rows]);
  const [period, setPeriod] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const cur = period ?? periods[periods.length - 1] ?? null;
  const thisWeek = isoWeek(todayIso());
  const latest = rows.filter((r) => r.period === cur);
  const comps = SURFACE_METRICS.flatMap((m) => (['gender', 'nationality'] as const).map((dim) => {
    const rs = latest.filter((r) => r.metric === m.metric && r.dimension === dim);
    return { m, dim, rs, suppressed: rs.some((r) => r.suppressed), flagged: rs.some((r) => r.flagged) };
  })).filter((c) => c.rs.length);
  const cardTitle = (id: string) => { const c = cards.find((x) => x.id === id); return c ? pick(c, 'title') : id; };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1"><span className="caps">{t('m16.ai.fair.week')}</span>
          <select className="input" value={cur ?? ''} onChange={(e) => setPeriod(e.target.value)} data-testid="m16-sf-week">
            {[...periods].reverse().map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {periods.includes(thisWeek) ? <StatusPill tone="ok">{t('m16.ai.fair.upToDate', { period: thisWeek })}</StatusPill> : <StatusPill tone="sim">{t('m16.ai.fair.due', { period: thisWeek })}</StatusPill>}
          {canRun && <button className="btn-primary btn-sm" onClick={() => setConfirm(true)} data-testid="m16-sf-run"><Icon name="reset" size={14} />{t('m16.sf.run')}</button>}
        </div>
      </div>
      <Callout title={t('m16.sf.howTitle')}>{t('m16.sf.howBody', { pct: f.num(FOUR_FIFTHS * 100) })}</Callout>
      {!cur ? <EmptyState icon="chart" title={t('m16.ai.fair.none')} /> : (
        <Section title={t('m16.sf.resultsTitle', { period: cur })}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="m16-sf-comparisons">
            {comps.map((c) => {
              const best = Math.max(0, ...c.rs.map((r) => Number(r.rate ?? 0)));
              return (
                <div key={`${c.m.metric}:${c.dim}`} className={`card min-w-0 p-4 ${c.flagged ? 'border-bad-line' : ''}`} data-testid="m16-sf-comparison" data-metric={c.m.metric} data-dimension={c.dim} data-suppressed={c.suppressed} data-flagged={c.flagged}>
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0"><div className="caps">{cardTitle(c.m.card)}</div><h3 className="font-semibold">{t(`m16.reg.metric.${c.m.metric}`)} · {t(`m16.ai.dimension.${c.dim}`)}</h3></div>
                    {c.suppressed ? <StatusPill tone="neutral">{t('m16.ai.fair.suppressed')}</StatusPill> : c.flagged ? <StatusPill tone="bad">{t('m16.ai.fair.flagged')}</StatusPill> : <StatusPill tone="ok">{t('m16.ai.fair.within')}</StatusPill>}
                  </div>
                  <p className="mb-2 text-[12.5px] text-ink-2">{t(`m16.reg.metricHelp.${c.m.metric}`)}</p>
                  {c.suppressed ? <p className="rounded-btn border border-line bg-sunken p-2 text-[12.5px] text-ink-2" data-testid="m16-sf-suppressed">{t('m16.ai.fair.suppressedBody')}</p> : (
                    <>
                      <BarChart title={`${t(`m16.reg.metric.${c.m.metric}`)} · ${t(`m16.ai.dimension.${c.dim}`)}`} unit="%" max={100} target={Math.round(best * FOUR_FIFTHS * 1000) / 10}
                        data={c.rs.map((r) => ({ label: t(`m16.ai.group.${r.group_key}`), value: r.rate == null ? null : Math.round(Number(r.rate) * 1000) / 10, tone: r.flagged ? 'bad' : 'accent' }))} />
                      <ul className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-ink-3">
                        {c.rs.map((r) => <li key={r.group_key}>{t(`m16.ai.group.${r.group_key}`)}: {t('m16.ai.fair.counts', { k: f.num(r.positives ?? 0), n: f.num(r.n ?? 0) })}{r.ratio != null ? ` · ${t('m16.ai.fair.ratio', { r: f.num(Number(r.ratio), { maximumFractionDigits: 2 }) })}` : ''}</li>)}
                      </ul>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}
      <GatedConfirm open={confirm} onClose={() => setConfirm(false)} title={t('m16.sf.confirmTitle', { period: thisWeek })} consequence={t('m16.sf.confirmBody')} actingAs={t('m16.ai.asGovernance')}
        onConfirm={async () => { const r = await run(() => repo.rpc.runSurfaceFairness(null), { success: t('m16.sf.saved') }); if (r.ok) setPeriod(r.data?.period ?? null); }} />
    </div>
  );
}
