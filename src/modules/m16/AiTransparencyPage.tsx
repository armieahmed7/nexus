// M16 · /admin/ai-transparency (W3 · E5 · F24 Recommendation transparency, opt-out and fairness monitor).
//  - Engine cards: one model/engine card per recommendation surface (inputs used and never used, live weights, oversight).
//  - Fairness monitor: weekly outcome rates by gender and nationality, suppressed below 10, four-fifths flag, trend.
//    Admin / AI governance run the weekly snapshot (rpc.runFairnessSnapshot: confirmed, audited, ledgered).
//  - Change log: every engine and weight change (F02 settings) with before, after, rationale, audit and ledger numbers;
//    admins change weights with a rationale (rpc.changeEngineWeights).
//  - Opt-outs and corrections: opt-out counts per surface (suppressed below 10) and AI correction requests.
// RBAC: admin and ai-governance (integrations A) all; auditors (integrations R) read-only; HR (skills_profile Agg) cards and fairness.
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { useFormat, useLang, usePick, useT } from '../../i18n';
import { Async, BarChart, Callout, Card, DataTable, Drawer, EmptyState, Grid, Icon, LineChart, Page, RadioGroup, Section, SimChip, SourceLink, StatTile, StatusPill, Tabs, type Column } from '../../ui';
import { DEFAULT_SETTINGS, SURFACES, modelGatewayUrl, resolveEngine, type Surface } from '../../domain/engines';
import { todayIso } from '../../domain/rules';
import type { EngineCardsRow, EngineChangesRow, EngineSettingsRow, FairnessSnapshotsRow } from '../../data/types';
import { GatedConfirm } from './parts';
import { EngineCardView } from './EngineCardView';
import { FOUR_FIFTHS, METRICS, comparisons, isoWeek, type Comparison, type FairnessRow } from './fairness';
import { RATIONALE_MIN, weightDiff } from './transparency';
import type { OptoutStat } from './backend/rpc';

const CFR = 'https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1607/section-1607.4';

export default function AiTransparencyPage() {
  const t = useT();
  const s = useSession();
  const repo = useRepo();
  const canLog = s.can('integrations', ['R', 'A']);
  const canRun = s.can('integrations', ['A']);
  const q = useQuery(['engine_cards', 'engine_settings', 'fairness_snapshots', 'engine_changes', 'reco_optouts', 'data_requests'], async () => {
    const [cards, settings, snaps, changes, stats, requests] = await Promise.all([
      repo.list('engine_cards', { order: [['sort', 'asc']] }),
      repo.list('engine_settings'),
      repo.list('fairness_snapshots', { order: [['as_of', 'asc']] }).catch(() => [] as FairnessSnapshotsRow[]),
      canLog ? repo.list('engine_changes', { order: [['changed_at', 'desc']] }).catch(() => [] as EngineChangesRow[]) : Promise.resolve([] as EngineChangesRow[]),
      repo.rpc.optoutStats().catch(() => [] as OptoutStat[]),
      canLog ? repo.list('data_requests', { filter: { kind: 'correction' }, order: [['created_at', 'desc']] }).catch(() => []) : Promise.resolve([]),
    ]);
    return { cards, settings, snaps, changes, stats, requests: requests.filter((r) => (r.note ?? '').startsWith('[AI')) };
  }, [canLog]);
  return (
    <Page title={t('m16.routes.admin-ai-transparency.title')} eyebrow={t('m16.ai.eyebrow')} intro={t('m16.ai.intro')} wide actions={<SimChip label={t('m16.ai.synthetic')} />}>
      <Async state={q}>
        {(d) => {
          const periods = [...new Set(d.snaps.map((r) => r.period))].sort();
          const latest = periods[periods.length - 1] ?? null;
          const latestRows = d.snaps.filter((r) => r.period === latest) as unknown as FairnessRow[];
          const comps = comparisons(latestRows);
          const coach = d.stats.find((x) => x.surface === 'coach');
          return (
            <div className="space-y-6">
              <Grid cols={4}>
                <StatTile label={t('m16.ai.stat.cards')} value={d.cards.length} sub={t('m16.ai.stat.cardsSub', { n: d.cards.filter((c) => c.opt_out).length })} />
                <StatTile label={t('m16.ai.stat.protected')} value="0" tone="ok" sub={t('m16.ai.stat.protectedSub')} />
                <StatTile label={t('m16.ai.stat.flagged')} value={latest ? comps.filter((c) => c.flagged).length : '—'} tone={comps.some((c) => c.flagged) ? 'bad' : 'ok'} sub={latest ? t('m16.ai.stat.flaggedSub', { period: latest, n: comps.filter((c) => c.suppressed).length }) : t('m16.ai.fair.none')} />
                <StatTile label={t('m16.ai.stat.optouts')} value={coach ? (coach.suppressed ? t('m16.ai.fewer') : coach.n ?? 0) : '—'} sub={t('m16.ai.stat.optoutsSub')} />
              </Grid>
              <Tabs initial="cards" tabs={[
                { id: 'cards', label: t('m16.ai.tab.cards'), badge: d.cards.length, content: <CardsTab cards={d.cards} settings={d.settings} stats={d.stats} /> },
                { id: 'fairness', label: t('m16.ai.tab.fairness'), badge: comps.filter((c) => c.flagged).length || undefined, content: <FairnessTab snaps={d.snaps as unknown as FairnessRow[]} periods={periods} canRun={canRun} /> },
                ...(canLog ? [{ id: 'changes', label: t('m16.ai.tab.changes'), badge: d.changes.length, content: <ChangesTab changes={d.changes} settings={d.settings} cards={d.cards} canChange={canRun} /> }] : []),
                { id: 'optouts', label: t('m16.ai.tab.optouts'), content: <OptoutsTab stats={d.stats} requests={canLog ? d.requests : null} cards={d.cards} /> },
              ]} />
              <Callout title={t('m16.ai.footerTitle')}>{t('m16.ai.footerBody')}</Callout>
            </div>
          );
        }}
      </Async>
    </Page>
  );
}

function CardsTab({ cards, settings, stats }: { cards: EngineCardsRow[]; settings: EngineSettingsRow[]; stats: OptoutStat[] }) {
  const t = useT();
  if (!cards.length) return <EmptyState title={t('m16.ai.cards.none')} />;
  return (
    <div className="space-y-3">
      <p className="text-[13.5px] text-ink-2">{t('m16.ai.cards.intro')}</p>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-testid="m16-engine-cards">
        {cards.map((c) => <EngineCardView key={c.id} card={c} setting={settings.find((x) => x.id === c.engine_surface) ?? null} optouts={stats.find((x) => x.surface === c.id) ?? null} />)}
      </div>
    </div>
  );
}

function FairnessTab({ snaps, periods, canRun }: { snaps: FairnessRow[]; periods: string[]; canRun: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const [period, setPeriod] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const cur = period ?? periods[periods.length - 1] ?? null;
  const rows = snaps.filter((r) => r.period === cur);
  const comps = comparisons(rows);
  const thisWeek = isoWeek(todayIso());
  const due = !periods.includes(thisWeek);
  const trend = useMemo(() => METRICS.map((m) => ({
    name: t(`m16.ai.metric.${m.metric}`),
    points: periods.map((p) => {
      const c = comparisons(snaps.filter((r) => r.period === p && r.metric === m.metric));
      const ratios = c.map((x) => x.minRatio).filter((x): x is number => x != null);
      return { x: p.slice(5), y: ratios.length ? Math.round(Math.min(...ratios) * 100) : null };
    }),
  })), [snaps, periods, t]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex flex-col gap-1">
          <span className="caps">{t('m16.ai.fair.week')}</span>
          <select className="input" value={cur ?? ''} onChange={(e) => setPeriod(e.target.value)} data-testid="m16-fair-week">
            {[...periods].reverse().map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {due ? <StatusPill tone="sim">{t('m16.ai.fair.due', { period: thisWeek })}</StatusPill> : <StatusPill tone="ok">{t('m16.ai.fair.upToDate', { period: thisWeek })}</StatusPill>}
          {canRun && <button className="btn-primary btn-sm" onClick={() => setConfirm(true)} data-testid="m16-fair-run"><Icon name="reset" size={14} />{t('m16.ai.fair.run')}</button>}
        </div>
      </div>
      <Callout title={t('m16.ai.fair.howTitle')}>
        <p>{t('m16.ai.fair.howBody', { pct: f.num(FOUR_FIFTHS * 100) })}</p>
        <p className="mt-1"><SourceLink href={CFR} date="2026-10-09">{t('m16.ai.fair.cfr')}</SourceLink></p>
      </Callout>
      {!cur ? <EmptyState icon="chart" title={t('m16.ai.fair.none')}>{t('m16.ai.fair.noneBody')}</EmptyState> : (
        <Section title={t('m16.ai.fair.resultsTitle', { period: cur })} description={t('m16.ai.fair.resultsDesc', { date: f.date(rows[0]?.as_of) })}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" data-testid="m16-fair-comparisons">
            {comps.map((c) => <ComparisonCard key={`${c.metric}:${c.dimension}`} c={c} />)}
          </div>
        </Section>
      )}
      {periods.length > 1 && (
        <Card title={t('m16.ai.fair.trendTitle')}>
          <p className="mb-2 text-[12.5px] text-ink-2">{t('m16.ai.fair.trendBody')}</p>
          <LineChart title={t('m16.ai.fair.trendTitle')} unit="%" yMin={0} yMax={100} series={[...trend, { name: t('m16.ai.fair.threshold'), points: periods.map((p) => ({ x: p.slice(5), y: 80 })), tone: 'bad', dashed: true }]} />
        </Card>
      )}
      <Callout tone="sim" title={t('m16.ai.fair.flagTitle')}>{t('m16.ai.fair.flagBody')}</Callout>
      <GatedConfirm open={confirm} onClose={() => setConfirm(false)} title={t('m16.ai.fair.confirmTitle', { period: thisWeek })} consequence={t('m16.ai.fair.confirmBody')} actingAs={t('m16.ai.asGovernance')}
        onConfirm={async () => { const r = await run(() => repo.rpc.runFairnessSnapshot(null), { success: t('m16.ai.fair.saved') }); if (r.ok) setPeriod(r.data?.period ?? null); }} />
    </div>
  );
}

function ComparisonCard({ c }: { c: Comparison }) {
  const t = useT();
  const f = useFormat();
  const best = Math.max(0, ...c.rows.map((r) => r.rate ?? 0));
  return (
    <div className={`card min-w-0 p-4 ${c.flagged ? 'border-bad-line' : ''}`} data-testid="m16-fair-comparison" data-metric={c.metric} data-dimension={c.dimension} data-flagged={c.flagged} data-suppressed={c.suppressed}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="caps">{t(`m16.ai.surface.${c.surface}`)}</div>
          <h3 className="font-semibold">{t(`m16.ai.metric.${c.metric}`)} · {t(`m16.ai.dimension.${c.dimension}`)}</h3>
        </div>
        {c.suppressed ? <StatusPill tone="neutral">{t('m16.ai.fair.suppressed')}</StatusPill> : c.flagged ? <StatusPill tone="bad">{t('m16.ai.fair.flagged')}</StatusPill> : <StatusPill tone="ok">{t('m16.ai.fair.within')}</StatusPill>}
      </div>
      <p className="mb-2 text-[12.5px] text-ink-2">{t(`m16.ai.metricHelp.${c.metric}`)}</p>
      {c.suppressed ? (
        <p className="rounded-btn border border-line bg-sunken p-2 text-[12.5px] text-ink-2" data-testid="m16-fair-suppressed">{t('m16.ai.fair.suppressedBody')}</p>
      ) : (
        <>
          <BarChart title={`${t(`m16.ai.metric.${c.metric}`)} · ${t(`m16.ai.dimension.${c.dimension}`)}`} unit="%" max={100} target={Math.round(best * FOUR_FIFTHS * 1000) / 10}
            data={c.rows.map((r) => ({ label: t(`m16.ai.group.${r.group_key}`), value: r.rate == null ? null : Math.round(r.rate * 1000) / 10, tone: r.flagged ? 'bad' : 'accent' }))} />
          <ul className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-ink-3">
            {c.rows.map((r) => (
              <li key={r.group_key}>{t(`m16.ai.group.${r.group_key}`)}: {t('m16.ai.fair.counts', { k: f.num(r.positives ?? 0), n: f.num(r.n ?? 0) })} · {t('m16.ai.fair.ratio', { r: f.num(r.ratio ?? 0, { maximumFractionDigits: 2 }) })}</li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-2 text-[11.5px] text-ink-3">{t('m16.ai.fair.source', { source: t(`m16.ai.source.${c.rows[0]?.source ?? 'none'}`) })}</p>
    </div>
  );
}

function ChangesTab({ changes, settings, cards, canChange }: { changes: EngineChangesRow[]; settings: EngineSettingsRow[]; cards: EngineCardsRow[]; canChange: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [open, setOpen] = useState(false);
  const cardTitle = (id: string) => { const c = cards.find((x) => x.id === id); return c ? pick(c, 'title') : id; };
  const cols: Column<EngineChangesRow>[] = [
    { key: 'when', header: t('m16.ai.log.when'), value: (r) => r.changed_at, sortable: true, render: (r) => <span title={r.id}>{f.dateTime(r.changed_at)}</span> },
    { key: 'surface', header: t('m16.ai.log.surface'), value: (r) => r.surface, render: (r) => <div><div className="font-semibold">{t(`common.engines.surface.${r.surface}`)}</div><div className="text-[11.5px] text-ink-3">{r.card_ids.map(cardTitle).join(' · ')}</div></div> },
    { key: 'engine', header: t('m16.ai.log.engine'), value: (r) => `${r.engine_before ?? ''}>${r.engine_after}`, render: (r) => r.engine_before && r.engine_before !== r.engine_after ? <span>{t(`common.engines.kind.${r.engine_before}`)} → <strong>{t(`common.engines.kind.${r.engine_after}`)}</strong></span> : t(`common.engines.kind.${r.engine_after}`) },
    { key: 'weights', header: t('m16.ai.log.weights'), value: (r) => JSON.stringify(r.weights_after), render: (r) => {
      const diff = weightDiff(r.weights_before as Record<string, number>, r.weights_after as Record<string, number>);
      if (!r.engine_before) return <span className="text-[12px] text-ink-3">{t('m16.ai.log.baseline')}</span>;
      return diff.length ? <span className="flex flex-wrap gap-1" dir="ltr">{diff.map((x) => <span key={x.key} className="chip border-line bg-sunken font-mono text-[11px]">{x.key} {x.from ?? '∅'}→{x.to ?? '∅'}</span>)}</span> : <span className="text-[12px] text-ink-3">{t('m16.ai.log.noWeightChange')}</span>;
    } },
    { key: 'why', header: t('m16.ai.log.rationale'), value: (r) => r.rationale ?? '', render: (r) => <span className="text-[12.5px]">{r.rationale ?? <span className="text-ink-3">{t('m16.ai.log.noRationale')}</span>}</span> },
    { key: 'by', header: t('m16.ai.log.by'), value: (r) => r.changed_by_role ?? '', render: (r) => r.changed_by_role ? t(`m16.ai.role.${r.changed_by_role}`) : <span className="text-ink-3">{t('m16.ai.log.seed')}</span> },
    { key: 'evidence', header: t('m16.ai.log.evidence'), value: (r) => r.audit_seq ?? '', render: (r) => r.audit_seq != null
      ? <span className="flex flex-wrap gap-1"><StatusPill tone="info">{t('m16.ai.log.audit', { n: f.num(r.audit_seq) })}</StatusPill>{r.ledger_seq != null ? <StatusPill tone="ok">{t('m16.ai.log.ledger', { n: f.num(r.ledger_seq) })}</StatusPill> : <StatusPill tone="neutral">{t('m16.ai.log.ledgerSkipped')}</StatusPill>}</span>
      : <span className="text-[12px] text-ink-3">—</span> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] text-ink-2">{t('m16.ai.log.intro')}</p>
        {canChange && <button className="btn-primary btn-sm" onClick={() => setOpen(true)} data-testid="m16-change-weights"><Icon name="filter" size={14} />{t('m16.ai.log.change')}</button>}
      </div>
      <div data-testid="m16-change-log"><DataTable rows={changes} rowKey={(r) => r.id} columns={cols} csvName="kafaa-engine-changes" /></div>
      {canChange && <WeightsDrawer open={open} onClose={() => setOpen(false)} settings={settings} />}
    </div>
  );
}

function WeightsDrawer({ open, onClose, settings }: { open: boolean; onClose: () => void; settings: EngineSettingsRow[] }) {
  const t = useT();
  const lang = useLang();
  const repo = useRepo();
  const run = useAction();
  const [surface, setSurface] = useState<Surface>('match');
  const eng = resolveEngine(surface, settings.find((x) => x.id === surface) ?? DEFAULT_SETTINGS[surface], modelGatewayUrl());
  const editable = Object.entries(eng.weights).filter(([, v]) => v >= 0 && v <= 10);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [engine, setEngine] = useState<'deterministic' | 'model' | null>(null);
  const [why, setWhy] = useState('');
  const [confirm, setConfirm] = useState(false);
  const pickSurface = (s: Surface) => { setSurface(s); setDraft({}); setEngine(null); };
  const weights = Object.fromEntries(editable.map(([k, v]) => [k, draft[k] != null && draft[k] !== '' ? Number(draft[k]) : v]));
  const bad = Object.values(weights).some((v) => !Number.isFinite(v) || v < 0 || v > 10);
  const ok = !bad && why.trim().length >= RATIONALE_MIN;
  const nextEngine = engine ?? eng.requested;
  return (
    <Drawer open={open} onClose={onClose} title={t('m16.ai.log.change')} footer={
      <>
        <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn-primary" disabled={!ok} onClick={() => setConfirm(true)} data-testid="m16-weights-save">{t('m16.ai.weights.review')}</button>
      </>
    }>
      <div className="space-y-4">
        <RadioGroup label={t('m16.ai.log.surface')} name="m16-surface" value={surface} onChange={(v) => pickSurface(v as Surface)} options={SURFACES.map((s) => ({ value: s, label: t(`common.engines.surface.${s}`) }))} />
        <RadioGroup label={t('m16.ai.weights.engine')} name="m16-engine" value={nextEngine} onChange={(v) => setEngine(v as 'deterministic' | 'model')} options={(['deterministic', 'model'] as const).map((k) => ({ value: k, label: t(`common.engines.kind.${k}`) }))} />
        {nextEngine === 'model' && !modelGatewayUrl() && <Callout tone="sim">{t('m16.ai.weights.noModel')}</Callout>}
        <fieldset className="space-y-2">
          <legend className="text-[13px] font-semibold">{t('m16.ai.weights.title')}</legend>
          {editable.length === 0 && <p className="text-[12.5px] text-ink-3">{t('m16.ai.weights.none')}</p>}
          {editable.map(([k, v]) => (
            <label key={k} className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-2 text-[13px]">
              <span>{t(`m16.ai.weight.${k}`)} <span className="font-mono text-[11px] text-ink-3" dir="ltr">({k})</span></span>
              <input className="input num" type="number" step="0.05" min={0} max={10} dir="ltr" lang={lang} value={draft[k] ?? String(v)} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} data-testid={`m16-weight-${k}`} />
            </label>
          ))}
          {bad && <p className="text-[12px] text-bad" role="alert">{t('m16.ai.weights.range')}</p>}
        </fieldset>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="font-semibold">{t('m16.ai.weights.rationale')} <span className="text-bad">*</span></span>
          <textarea className="input" rows={3} maxLength={500} value={why} onChange={(e) => setWhy(e.target.value)} data-testid="m16-weights-rationale" />
          <span className="text-[12px] text-ink-3">{t('m16.ai.weights.rationaleHint', { n: RATIONALE_MIN })}</span>
        </label>
      </div>
      <GatedConfirm open={confirm} onClose={() => setConfirm(false)} title={t('m16.ai.weights.confirmTitle', { surface: t(`common.engines.surface.${surface}`) })} consequence={t('m16.ai.weights.confirmBody')} actingAs={t('m16.ai.asGovernance')}
        onConfirm={async () => { const r = await run(() => repo.rpc.changeEngineWeights(surface, nextEngine, editable.length ? weights : null, why.trim()), { success: t('m16.ai.weights.saved') }); if (r.ok) { setWhy(''); setDraft({}); setEngine(null); onClose(); } }} />
    </Drawer>
  );
}

function OptoutsTab({ stats, requests, cards }: { stats: OptoutStat[]; requests: { id: string; note?: string | null; status: string; created_at: string }[] | null; cards: EngineCardsRow[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title={t('m16.ai.opt.title')}>
        <p className="mb-2 text-[13px] text-ink-2">{t('m16.ai.opt.body')}</p>
        <BarChart title={t('m16.ai.opt.title')} data={stats.map((x) => { const c = cards.find((k) => k.id === x.surface); return { label: c ? pick(c, 'title') : x.surface, value: x.n, suppressed: x.suppressed }; })} />
        <p className="mt-2 text-[12px] text-ink-3">{t('m16.ai.opt.suppressedNote')}</p>
      </Card>
      <Card title={t('m16.ai.opt.requestsTitle')}>
        {requests == null ? <p className="text-[13px] text-ink-3">{t('m16.ai.opt.requestsHidden')}</p> : requests.length === 0 ? <p className="text-[13px] text-ink-3">{t('m16.ai.opt.requestsNone')}</p> : (
          <ul className="divide-y divide-line text-[13px]" data-testid="m16-ai-requests">
            {requests.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="min-w-0 flex-1 truncate" title={r.note ?? ''}>{r.note}</span><span className="flex items-center gap-2 text-[12px] text-ink-3">{f.date(r.created_at)} <StatusPill status={r.status} /></span></li>)}
          </ul>
        )}
        <p className="mt-2 text-[12px] text-ink-3">{t('m16.ai.opt.requestsNote')}</p>
      </Card>
    </div>
  );
}
