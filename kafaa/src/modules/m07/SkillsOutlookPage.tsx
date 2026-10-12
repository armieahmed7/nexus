// M07 /workforce/skills-outlook (F35): skills supply and demand over 5 to 10 years, SIMULATED. Demand from role profiles x the
// chosen staffing scenario plus the KHNP handover and ADVANCE adoption; supply from today's F01 skill states minus attrition and
// F20 KLRA departures plus F22 pipeline intakes and reskilling. Gap chart by skill family, sensitivity sliders, a "what changes the
// gap most" tornado and saved outlooks (HR saves, the HR director releases to line managers). Everything is computed on the server
// (rpc.computeOutlook): aggregate only, skill families under 10 measured people suppressed, no person-level row reaches the page.
// FS52 (wave F · E2): an AI and automation adoption assumption (FS06 task exposure per family, in the tornado with its range) and the
// automation card (rpc.outlookAutomation). FS53: market statistics beside numbers measured at ENEC, never summed (MarketPanel).
import { useEffect, useMemo, useState } from 'react';
import { useAction, useRepo, useQuery } from '../../data';
import type { Table } from '../../data/types';
import { useSession } from '../../auth/session';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { publicTextIsClean } from '../../domain/future';
import { Page, Section, Grid, Card, Async, EmptyState, Callout, DataTable, StatusPill, ConfirmDialog, Modal, Drawer, SimChip, LineChart, BarChart, WhyThis, TextField, TextArea, Icon, type Column } from '../../ui';
import { L, useFormat, useLang, useT } from '../../i18n';
import { AUTO_PARAM, BASELINE, LIMITS, OVERRIDE_MAX, adoptionOf, familyReasons, isBaseline, withAutoBar, type AutoParam, type FamilyOutlook, type NumParam, type OutlookParams, type OutlookResult } from './outlook';
import { AutoSlider, AutomationCard } from './automationUi'; // FS52
import { MarketPanel, ReleasedMarketPanel } from './marketUi'; // FS53
import { measuresFrom } from './market'; // FS53
import type { ReleasedOutlook } from './backend/outlook.rpc';
import { DefLink, ExportButton, MetricTile, useWatermarkedExport } from './shared';
import { LinkOrNote, useOpenable } from './handoverUi';
import { GapBars, ParamSlider, Tornado, useFamilyLabel } from './outlookUi';

/** Tables whose changes refresh the outlook. */
const WATCH = ['person_skills', 'scenarios', 'klra_assessments', 'klra_positions', 'handover_cohorts', 'external_cover', 'future_skills', 'jta_tasks', 'jta_task_skills'] as unknown as Table[];
const SLIDERS: NumParam[] = ['attrition_pct', 'klra_weight', 'pipeline_factor', 'annual_intake', 'reskill_rate', 'adv_factor', 'adv_start', 'ossa_end'];
const YEARS = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

function useParamFormat() {
  const t = useT();
  const f = useFormat();
  return (k: NumParam | AutoParam, v: number): string => {
    switch (k) {
      case 'automation_adoption': return f.pct(v, 0);
      case 'attrition_pct': return `${f.num(v, { maximumFractionDigits: 1 })}%`;
      case 'reskill_rate': return t('m07.so.pctYear', { n: f.num(v) });
      case 'annual_intake': return t('m07.so.perYear', { n: f.num(v) });
      case 'klra_weight': case 'pipeline_factor': case 'adv_factor': return `× ${f.num(v, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
      default: return f.num(v, { useGrouping: false });
    }
  };
}

export default function SkillsOutlookPage() {
  const t = useT();
  const s = useSession();
  const canCompute = s.hasRole('hr_director', 'hr_analyst', 'auditor');
  const [loadReq, setLoadReq] = useState<{ params: OutlookParams; id: string | null; name: string; n: number } | null>(null);
  return (
    <Page title={t('m07.routes.workforce-skills-outlook.title')} intro={t('m07.so.intro')} wide actions={<SimChip />}>
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2" data-testid="m07-so-labels">
        <SimChip />
        <span>{t('m07.so.labels', { n: MIN_GROUP_SIZE })}</span>
        <DefLink metric="outlook_gap" />
        <a href="#so-method" className="inline-flex items-center gap-1 text-[12px]"><Icon name="info" size={12} />{t('m07.so.howTitle')}</a>
      </div>
      <Callout tone="sim" title={t('m07.so.simTitle')}>{t('m07.so.simBody')}</Callout>
      {canCompute ? <Workbench loadReq={loadReq} /> : (
        <>
          <Callout tone="info" title={t('m07.so.managerTitle')}>{t('m07.so.managerBody')}</Callout>
          <ReleasedMarketPanel dashboard="skills_outlook" />
        </>
      )}
      <Released canLoad={canCompute} onLoad={(o) => setLoadReq({ params: o.results.params, id: null, name: o.name, n: Date.now() })} />
      <Method />
    </Page>
  );
}

function Workbench({ loadReq }: { loadReq: { params: OutlookParams; id: string | null; name: string; n: number } | null }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const label = useFamilyLabel();
  const fmt = useParamFormat();
  const exportCsv = useWatermarkedExport();
  const canSave = s.hasRole('hr_analyst', 'hr_director');
  const isDirector = s.hasRole('hr_director');
  const [params, setParams] = useState<OutlookParams>(BASELINE);
  const [debounced, setDebounced] = useState<OutlookParams>(BASELINE);
  const [picked, setPicked] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<{ id: string | null; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [overrides, setOverrides] = useState(false);
  const [release, setRelease] = useState<{ id: string; name: string } | null>(null);
  const [withdraw, setWithdraw] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => { const h = setTimeout(() => setDebounced(params), 250); return () => clearTimeout(h); }, [params]);
  useEffect(() => {
    if (!loadReq) return;
    setParams(loadReq.params); setLoaded({ id: loadReq.id, name: loadReq.name }); setName(loadReq.name.replace(/\s*\(SIMULATED\)\s*$/i, ''));
    document.getElementById('so-workbench')?.scrollIntoView({ block: 'start' });
  }, [loadReq]);

  const key = JSON.stringify(debounced);
  const q = useQuery(WATCH, async () => {
    const r = await repo.rpc.computeOutlook(debounced);
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data;
  }, [key]);
  const baseQ = useQuery(WATCH, async () => {
    const r = await repo.rpc.computeOutlook(BASELINE);
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data;
  });
  const scen = useQuery('scenarios', () => repo.list('scenarios', { order: [['created_at', 'asc']] }));
  const saved = useQuery('skill_outlooks' as Table, () => repo.list('skill_outlooks' as never, { order: [['created_at', 'desc']] }) as unknown as Promise<Record<string, any>[]>);
  const a = q.data;
  const updating = q.loading || key !== JSON.stringify(params);
  const set = (k: NumParam, v: number) => setParams((p) => ({ ...p, [k]: v }));
  // FS52: 0 removes the key, so the parameters stay exactly the F35 ones
  const setAdoption = (v: number) => setParams((p) => { const n = { ...p }; if (v > 0) n.automation_adoption = v; else delete n.automation_adoption; return n; });
  const autoQ = useQuery(WATCH, async () => {
    const r = await repo.rpc.outlookAutomation(debounced);
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data;
  }, [key]);
  const baseline = isBaseline(params);
  const visible = (a?.families ?? []).filter((x) => !x.suppressed);
  const famKey = picked && visible.some((x) => x.key === picked) ? picked : [...visible].sort((x, y) => (y.horizon_gap ?? 0) - (x.horizon_gap ?? 0))[0]?.key ?? null;
  const fam = visible.find((x) => x.key === famKey) ?? null;
  const delta = a && baseQ.data ? a.totals.shortfall - baseQ.data.totals.shortfall : null;

  const exportOutlook = (r: OutlookResult) => exportCsv(`skills-outlook-SIMULATED-${r.horizon}`,
    ['skill_family', 'year', 'demand_SIMULATED', 'supply_SIMULATED', 'gap_SIMULATED', 'note'],
    r.families.flatMap((x) => (x.suppressed ? [[x.key, '', 'suppressed', 'suppressed', 'suppressed', `fewer than ${MIN_GROUP_SIZE} people measured`]]
      : x.years.map((c) => [x.key, c.year, c.demand, c.supply, c.gap, 'SIMULATED · people-equivalents']))));

  return (
    <div className="space-y-4" id="so-workbench">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <Card title={t('m07.so.assumptions')} actions={baseline ? <StatusPill tone="ok">{t('m07.so.baseline')}</StatusPill> : <StatusPill tone="sim">{t('m07.so.whatIf')}</StatusPill>}>
          <div className="space-y-4" data-testid="m07-so-controls">
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold">{t('m07.so.scenario')}</span>
              <select className="input" value={params.scenario_id ?? ''} onChange={(e) => setParams((p) => ({ ...p, scenario_id: e.target.value || null }))} data-testid="m07-so-scenario">
                <option value="">{t('m07.so.currentFleet')}</option>
                {(scen.data ?? []).filter((x) => x.kind === 'headcount' || x.kind === 'technology').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <span className="text-[11.5px] text-ink-3">{t('m07.so.scenarioHint')} <L to="/workforce/scenarios">{t('m07.so.scenarioLink')}</L></span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold">{t('m07.so.param.horizon')}</span>
              <select className="input" value={params.horizon} onChange={(e) => set('horizon', Number(e.target.value))} data-testid="m07-so-horizon">
                {YEARS(LIMITS.horizon[0], LIMITS.horizon[1]).map((y) => <option key={y} value={y}>{f.num(y, { useGrouping: false })}{y === BASELINE.horizon ? ` · ${t('m07.so.baseline')}` : ''}</option>)}
              </select>
            </label>
            {SLIDERS.map((k) => <ParamSlider key={k} k={k} value={params[k]} onChange={(v) => set(k, v)} format={(v) => fmt(k, v)} />)}
            <AutoSlider value={adoptionOf(params)} onChange={setAdoption} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-outline btn-sm" onClick={() => setOverrides(true)} data-testid="m07-so-overrides">
                {t('m07.so.overrides')}{Object.keys(params.reskill_overrides).length ? ` (${f.num(Object.keys(params.reskill_overrides).length)})` : ''}
              </button>
              <button type="button" className="btn-ghost btn-sm" disabled={baseline} onClick={() => { setParams(BASELINE); setLoaded(null); setName(''); }} data-testid="m07-so-reset">
                <Icon name="reset" size={14} />{t('m07.so.reset')}
              </button>
            </div>
          </div>
        </Card>

        <div className="min-w-0 space-y-4" aria-busy={updating}>
          {loaded && <Callout tone="info" title={t('m07.so.loadedTitle', { name: loaded.name })}>{t('m07.so.loadedBody')}</Callout>}
          <Async state={{ ...q, data: a }}>
            {(r) => (
              <>
                <div data-testid="m07-so-tiles" className={updating ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
                  <Grid cols={4}>
                    <MetricTile metric="outlook_gap" label={t('m07.so.tile.short', { year: r.horizon })} value={`${f.num(r.totals.families_short)} / ${f.num(r.totals.visible)}`}
                      sub={t('m07.so.tile.shortSub', { n: f.num(r.totals.suppressed) })} sample tone={r.totals.families_short ? 'bad' : 'ok'} source={t('common.simulated')} />
                    <MetricTile metric="outlook_gap" label={t('m07.so.tile.shortfall', { year: r.horizon })} value={f.num(r.totals.shortfall)}
                      sub={delta == null || baseline ? t('m07.so.tile.peopleEq') : t('m07.so.tile.vsBaseline', { delta: `${delta >= 0 ? '+' : ''}${f.num(delta)}` })} sample tone={r.totals.shortfall ? 'bad' : 'ok'} source={t('common.simulated')} />
                    <MetricTile metric="outlook_gap" label={t('m07.so.tile.first')} value={r.totals.first_gap_year == null ? t('m07.so.none') : f.num(r.totals.first_gap_year, { useGrouping: false })}
                      sub={t('m07.so.tile.firstSub')} sample source={t('common.simulated')} />
                    <MetricTile metric="outlook_tornado" label={t('m07.so.tile.cumulative')} value={f.num(r.totals.cumulative)}
                      sub={t('m07.so.tile.cumulativeSub', { from: r.base_year, to: r.horizon })} sample source={t('common.simulated')} />
                  </Grid>
                </div>
                <Grid cols={2}>
                  <Card title={t('m07.so.gapTitle', { year: r.horizon })} eyebrow={r.scenario ? r.scenario.name : t('m07.so.currentFleet')} actions={<span className="flex items-center gap-2"><DefLink metric="outlook_gap" /><SimChip /></span>}>
                    <GapBars families={r.families} year={r.horizon} label={label} onPick={setPicked} picked={famKey} />
                    <p className="mt-2 text-[12px] text-ink-3">{t('m07.so.gapNote', { n: MIN_GROUP_SIZE })}</p>
                  </Card>
                  <Card title={fam ? t('m07.so.trendTitle', { family: label(fam.key) }) : t('m07.so.trendTitleNone')} actions={<span className="flex items-center gap-2"><DefLink metric="outlook_supply" /><SimChip /></span>}>
                    {fam ? (
                      <div data-testid="m07-so-trend">
                        <LineChart title={t('m07.so.trendTitle', { family: label(fam.key) })} height={200} series={[
                          { name: t('m07.so.demand'), points: fam.years.map((c) => ({ x: String(c.year), y: c.demand })), tone: 'bad', dashed: true },
                          { name: t('m07.so.supply'), points: fam.years.map((c) => ({ x: String(c.year), y: c.supply })), tone: 'accent' },
                        ]} />
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
                          <label className="flex items-center gap-2">
                            <span className="caps">{t('m07.so.family')}</span>
                            <select className="input py-1" value={fam.key} onChange={(e) => setPicked(e.target.value)} data-testid="m07-so-family">
                              {visible.map((x) => <option key={x.key} value={x.key}>{label(x.key)}</option>)}
                            </select>
                          </label>
                          <WhyThis reasons={familyReasons(fam, r.params)} label={t('m07.so.whyGap')} testId="m07-so-why" />
                        </div>
                        <DriverChips f={fam} />
                        {r.automation && (() => { const af = r.automation.families.find((x) => x.key === fam.key); return af && !af.suppressed ? (
                          <p className="mt-2 text-[12px] text-ink-2" data-testid="m07-so-trend-auto">{t('m07.au.trendNote', { n: f.num(af.cut_now ?? 0), year: r.horizon, adoption: f.pct(r.automation.adoption, 0) })}</p>
                        ) : null; })()}
                      </div>
                    ) : <EmptyState title={t('m07.so.allSuppressed')} />}
                  </Card>
                </Grid>
                <Grid cols={2}>
                  <Card title={t('m07.so.tornadoTitle')} eyebrow={t('m07.so.tornadoEyebrow', { from: r.base_year, to: r.horizon })} actions={<span className="flex items-center gap-2"><DefLink metric="outlook_tornado" /><SimChip /></span>}>
                    {(() => {
                      // FS52: the automation bar is in the result when adoption > 0; at adoption 0 it comes from the automation profile
                      const bars = r.tornado.some((b) => b.param === AUTO_PARAM) || !autoQ.data ? r.tornado : withAutoBar(r.tornado, autoQ.data.bar);
                      return (
                        <>
                          <Tornado bars={bars} current={r.totals.cumulative} format={fmt} />
                          <p className="mt-2 text-[12px] text-ink-3">{t('m07.so.tornadoNote', { top: t(`m07.so.param.${bars[0]?.param ?? 'attrition_pct'}`) })}</p>
                        </>
                      );
                    })()}
                  </Card>
                  <Card title={t('m07.so.byYearTitle')} actions={<span className="flex items-center gap-2"><DefLink metric="outlook_gap" /><SimChip /></span>}>
                    <div data-testid="m07-so-byyear">
                      <BarChart title={t('m07.so.byYearTitle')} data={r.years.map((y, i) => ({ label: String(y), value: r.totals.shortfall_by_year[i], tone: 'bad' }))} />
                    </div>
                    <p className="mt-2 text-[12px] text-ink-3">{t('m07.so.byYearNote')}</p>
                  </Card>
                </Grid>
                <div id="so-automation" className="scroll-mt-24 space-y-4">
                  <AutomationCard profile={autoQ.data} loading={autoQ.loading} />
                  <MarketPanel dashboard="skills_outlook" measures={measuresFrom(r, autoQ.data)} basis={{
                    demand_growth_2030: t('m07.mk.basisOutlook', { n: f.num(r.totals.visible) }),
                    digital_holders: t('m07.mk.basisSample', { n: f.num(measuresFrom(r, autoQ.data).digital_holders.basis ?? 0) }),
                    ai_task_share: t('m07.mk.basisTasks', { n: f.num(autoQ.data?.rated ?? 0) }),
                  }} />
                </div>
                <Section title={t('m07.so.tableTitle')} description={t('m07.so.tableDesc')} actions={<ExportButton onClick={() => exportOutlook(r)} />}>
                  <div data-testid="m07-so-table">
                    <DataTable rows={r.families} rowKey={(x) => x.key} searchable={false} pageSize={20} caption={t('m07.so.tableTitle')} columns={tableCols(r)} />
                  </div>
                </Section>
              </>
            )}
          </Async>
          {canSave && (
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn-primary" disabled={!a || updating} onClick={() => setSaving(true)} data-testid="m07-so-save">
                {loaded?.id ? t('m07.so.update') : t('m07.so.save')}
              </button>
              <span className="text-[12px] text-ink-3">{t('m07.so.saveHint')}</span>
            </div>
          )}
        </div>
      </div>

      <Section title={t('m07.so.savedTitle')} description={t('m07.so.savedDesc')}>
        <Async state={saved} empty={<EmptyState title={t('m07.so.noneSaved')} />}>
          {(rows) => (
            <div data-testid="m07-so-saved">
              <DataTable rows={rows} rowKey={(r) => r.id} searchable={false} pageSize={10} caption={t('m07.so.savedTitle')} columns={[
                { key: 'name', header: t('m07.so.name'), value: (r) => r.name, render: (r) => <span className="font-semibold">{r.name}</span> },
                { key: 'status', header: t('m07.so.status'), value: (r) => r.status, render: (r) => <StatusPill tone={r.status === 'released' ? 'ok' : r.status === 'withdrawn' ? 'neutral' : 'sim'}>{t(`m07.so.st.${r.status}`)}</StatusPill> },
                { key: 'short', header: t('m07.so.shortCol'), value: (r) => r.results?.totals?.families_short ?? 0, align: 'end', render: (r) => <span className="num">{f.num(r.results?.totals?.families_short)} / {f.num(r.results?.totals?.visible)}</span> },
                { key: 'auto', header: t('m07.au.savedCol'), value: (r) => Number(r.params?.automation_adoption ?? 0), align: 'end', render: (r) => <span className="num">{r.params?.automation_adoption ? f.pct(Number(r.params.automation_adoption), 0) : '—'}</span> },
                { key: 'created', header: t('m07.so.created'), value: (r) => r.created_at, render: (r) => f.date(r.created_at) },
                { key: 'released', header: t('m07.so.releasedOn'), value: (r) => r.released_at ?? '', render: (r) => (r.released_at ? f.date(r.released_at) : '—') },
                { key: 'sim', header: '', csv: false, render: () => <SimChip /> },
                { key: 'act', header: '', csv: false, render: (r) => (
                  <span className="flex flex-wrap gap-1">
                    <button className="btn-ghost btn-sm" onClick={() => { setParams(r.params as OutlookParams); setLoaded({ id: r.created_by === s.identity.personId && r.status !== 'released' ? r.id : null, name: r.name }); setName(String(r.name).replace(/\s*\(SIMULATED\)\s*$/i, '')); }} data-testid={`m07-so-load-${r.id}`}>{t('m07.so.load')}</button>
                    {isDirector && r.status !== 'released' && <button className="btn-outline btn-sm" onClick={() => setRelease({ id: r.id, name: r.name })} data-testid={`m07-so-release-${r.id}`}><Icon name="shield" size={14} />{t('m07.so.release')}</button>}
                    {isDirector && r.status === 'released' && <button className="btn-ghost btn-sm" onClick={() => setWithdraw({ id: r.id, name: r.name })} data-testid={`m07-so-withdraw-${r.id}`}>{t('m07.so.withdraw')}</button>}
                  </span>
                ) },
              ]} />
            </div>
          )}
        </Async>
      </Section>

      <Modal open={saving} onClose={() => setSaving(false)} title={loaded?.id ? t('m07.so.update') : t('m07.so.save')} size="sm" footer={
        <>
          <button className="btn-outline" onClick={() => setSaving(false)}>{t('common.cancel')}</button>
          <button className="btn-primary" disabled={name.trim().length < 3} data-testid="m07-so-save-confirm" onClick={async () => {
            const r = await run(() => repo.rpc.saveOutlook({ id: loaded?.id ?? null, name, params }));
            if (r.ok && r.data) { setLoaded({ id: r.data.id, name: r.data.name }); setSaving(false); }
          }}>{t('common.save')}</button>
        </>
      }>
        <TextField label={t('m07.so.name')} name="so-name" value={name} onChange={setName} required hint={t('m07.so.nameHint')} />
      </Modal>

      <OverridesDrawer open={overrides} onClose={() => setOverrides(false)} families={(a?.families ?? []).filter((x) => !x.suppressed).map((x) => x.key)} params={params}
        onChange={(ov) => setParams((p) => ({ ...p, reskill_overrides: ov }))} />
      <ReleaseModal target={release} onClose={() => setRelease(null)} />
      <ConfirmDialog open={!!withdraw} onClose={() => setWithdraw(null)} title={t('m07.so.withdrawTitle')} consequence={t('m07.so.withdrawBody', { name: withdraw?.name ?? '' })}
        actingAs={t('m07.so.asDirector')} requireReason reasonLabel={t('m07.so.withdrawReason')} confirmLabel={t('m07.so.withdraw')} danger
        onConfirm={async (reason) => { await run(() => repo.rpc.withdrawOutlook(withdraw!.id, reason)); }} />
    </div>
  );

  function tableCols(r: OutlookResult): Column<FamilyOutlook>[] {
    const at = (x: FamilyOutlook, y: number) => x.years.find((c) => c.year === y);
    const sup = <span className="chip bg-sunken text-ink-3" data-testid="m07-so-suppressed">{t('m07.so.suppressed')}</span>;
    const n = (x: FamilyOutlook, v: number | null | undefined) => (x.suppressed ? sup : <span className="num">{f.num(v)}</span>);
    return [
      { key: 'family', header: t('m07.so.family'), value: (x) => label(x.key), sortable: true, render: (x) => <span className="font-semibold">{label(x.key)}</span> },
      { key: 's0', header: t('m07.so.col.supplyNow', { year: r.base_year }), value: (x) => x.s0 ?? -1, sortable: true, align: 'end', render: (x) => n(x, x.s0) },
      { key: 'd0', header: t('m07.so.col.demandNow', { year: r.base_year }), value: (x) => x.d0 ?? -1, sortable: true, align: 'end', render: (x) => n(x, x.d0) },
      { key: 'sH', header: t('m07.so.col.supplyH', { year: r.horizon }), value: (x) => at(x, r.horizon)?.supply ?? -1, sortable: true, align: 'end', render: (x) => n(x, at(x, r.horizon)?.supply) },
      { key: 'dH', header: t('m07.so.col.demandH', { year: r.horizon }), value: (x) => at(x, r.horizon)?.demand ?? -1, sortable: true, align: 'end', render: (x) => n(x, at(x, r.horizon)?.demand) },
      { key: 'gap', header: t('m07.so.col.gapH', { year: r.horizon }), value: (x) => x.horizon_gap ?? -99999, sortable: true, align: 'end',
        render: (x) => (x.suppressed ? sup : <span className={`num font-semibold ${(x.horizon_gap ?? 0) > 0 ? 'text-bad' : 'text-ok'}`}>{(x.horizon_gap ?? 0) > 0 ? '+' : ''}{f.num(x.horizon_gap)}</span>) },
      { key: 'first', header: t('m07.so.col.first'), value: (x) => x.first_gap_year ?? 9999, sortable: true, align: 'end', render: (x) => (x.suppressed ? '—' : x.first_gap_year == null ? t('m07.so.none') : <span className="num">{x.first_gap_year}</span>) },
      { key: 'status', header: t('m07.so.status'), value: (x) => (x.suppressed ? 2 : (x.horizon_gap ?? 0) > 0 ? 0 : 1), sortable: true,
        render: (x) => (x.suppressed ? <StatusPill tone="neutral">{t('m07.so.suppressed')}</StatusPill> : (x.horizon_gap ?? 0) > 0 ? <StatusPill tone="bad">{t('m07.so.shortPill')}</StatusPill> : <StatusPill tone="ok">{t('m07.so.coveredPill')}</StatusPill>) },
      { key: 'why', header: '', csv: false, render: (x) => <WhyThis reasons={familyReasons(x, r.params)} testId="m07-so-row-why" /> },
    ];
  }
}

function DriverChips({ f: fam }: { f: FamilyOutlook }) {
  const t = useT();
  if (!fam.drivers.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t('m07.so.drivers')} data-testid="m07-so-drivers">
      {fam.drivers.map((d) => (
        <li key={d.code} className={`chip ${d.effect === 'widens' ? 'border-bad-line bg-bad-bg text-bad' : 'border-ok-line bg-ok-bg text-ok'}`}>
          {d.effect === 'widens' ? '▲' : '▼'} {t(`m07.so.driver.${d.code}`)} · {t(`m07.so.band.${d.band}`)}
        </li>
      ))}
    </ul>
  );
}

function OverridesDrawer({ open, onClose, families, params, onChange }: { open: boolean; onClose: () => void; families: string[]; params: OutlookParams; onChange: (ov: Record<string, number>) => void }) {
  const t = useT();
  const f = useFormat();
  const label = useFamilyLabel();
  const ov = params.reskill_overrides;
  return (
    <Drawer open={open} onClose={onClose} title={t('m07.so.overrides')} footer={<button className="btn-primary" onClick={onClose}>{t('m07.so.done')}</button>}>
      <p className="mb-3 text-[13px] text-ink-2">{t('m07.so.overridesBody', { n: f.num(params.reskill_rate) })}</p>
      <div className="space-y-3" data-testid="m07-so-overrides-list">
        {families.map((k) => (
          <label key={k} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-[13px]">
            <span>{label(k)}</span>
            <input type="number" className="input w-20" min={0} max={OVERRIDE_MAX} step={1} placeholder={String(params.reskill_rate)} value={ov[k] ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? null : Math.max(0, Math.min(OVERRIDE_MAX, Math.round(Number(e.target.value))));
                const next = { ...ov };
                if (v == null || Number.isNaN(v)) delete next[k]; else next[k] = v;
                onChange(next);
              }} aria-label={t('m07.so.overrideFor', { family: label(k) })} />
            <span className="text-ink-3">%</span>
          </label>
        ))}
      </div>
      {Object.keys(ov).length > 0 && <button className="btn-ghost btn-sm mt-3" onClick={() => onChange({})}><Icon name="reset" size={14} />{t('m07.so.clearOverrides')}</button>}
    </Drawer>
  );
}

function ReleaseModal({ target, onClose }: { target: { id: string; name: string } | null; onClose: () => void }) {
  const t = useT();
  const repo = useRepo();
  const run = useAction();
  const [en, setEn] = useState('');
  const [ar, setAr] = useState('');
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (target) { setEn(''); setAr(''); } }, [target]);
  const clean = publicTextIsClean([target?.name ?? '', en, ar]);
  const lenOk = [en, ar].every((x) => x.trim().length >= 10 && x.trim().length <= 600);
  return (
    <>
      <Modal open={!!target && !confirm} onClose={onClose} title={t('m07.so.releaseTitle', { name: target?.name ?? '' })} footer={
        <>
          <button className="btn-outline" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn-primary" disabled={!clean || !lenOk} onClick={() => setConfirm(true)} data-testid="m07-so-release-next">{t('m07.so.release')}</button>
        </>
      }>
        <div className="space-y-3">
          <p className="text-[13px] text-ink-2">{t('m07.so.releaseBody')}</p>
          <TextArea label={t('m07.so.summaryEn')} name="so-sum-en" value={en} onChange={setEn} required hint={t('m07.so.summaryHint')} />
          <TextArea label={t('m07.so.summaryAr')} name="so-sum-ar" value={ar} onChange={setAr} required hint={t('m07.so.summaryHint')} />
          <div className="flex items-center gap-2 text-[12.5px]" data-testid="m07-so-clean" aria-live="polite">
            {clean ? <StatusPill tone="ok">{t('m07.so.cleanOk')}</StatusPill> : <StatusPill tone="bad">{t('m07.so.cleanBad')}</StatusPill>}
            <span className="text-ink-3">{t('m07.so.cleanRule')}</span>
          </div>
        </div>
      </Modal>
      <ConfirmDialog open={!!target && confirm} onClose={() => setConfirm(false)} title={t('m07.so.releaseConfirmTitle')} consequence={t('m07.so.releaseConfirmBody', { name: target?.name ?? '' })}
        actingAs={t('m07.so.asDirector')} confirmLabel={t('m07.so.release')}
        onConfirm={async () => {
          const r = await run(() => repo.rpc.releaseOutlook(target!.id, en, ar));
          setConfirm(false);
          if (r.ok) onClose();
        }} />
    </>
  );
}

function Released({ canLoad, onLoad }: { canLoad: boolean; onLoad: (o: ReleasedOutlook) => void }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const repo = useRepo();
  const label = useFamilyLabel();
  const q = useQuery('skill_outlooks' as Table, async () => {
    const r = await repo.rpc.releasedOutlooks();
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data;
  });
  return (
    <Section title={t('m07.so.releasedTitle')} description={t('m07.so.releasedDesc')}>
      <Async state={q} empty={<EmptyState title={t('m07.so.noneReleased')}>{t('m07.so.noneReleasedBody')}</EmptyState>}>
        {(rows) => (
          <div className="space-y-4" data-testid="m07-so-released">
            {rows.map((o) => {
              const r = o.results;
              return (
                <Card key={o.id} title={o.name} eyebrow={t('m07.so.releasedOnX', { date: f.date(o.released_at) })} actions={<span className="flex items-center gap-2"><DefLink metric="outlook_gap" /><SimChip /></span>}>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                    <div className="space-y-3">
                      <p className="text-[13.5px]">{lang === 'ar' ? o.summary_ar : o.summary_en}</p>
                      <dl className="grid grid-cols-2 gap-2 text-[12.5px]">
                        <div><dt className="caps">{t('m07.so.tile.short', { year: r.horizon })}</dt><dd className="num text-[20px] font-semibold text-bad"><bdi dir="ltr">{f.num(r.totals.families_short)} / {f.num(r.totals.visible)}</bdi></dd></div>
                        <div><dt className="caps">{t('m07.so.tile.first')}</dt><dd className="num text-[20px] font-semibold">{r.totals.first_gap_year == null ? t('m07.so.none') : f.num(r.totals.first_gap_year, { useGrouping: false })}</dd></div>
                      </dl>
                      <p className="text-[12px] text-ink-3">{r.scenario ? r.scenario.name : t('m07.so.currentFleet')} · {t('m07.so.horizonTo', { year: r.horizon })}</p>
                      {r.automation && <p className="text-[12px]"><span className="chip border-line bg-sunken text-ink-2" data-testid={`m07-so-released-auto-${o.id}`}>{t('m07.au.releasedChip', { adoption: f.pct(r.automation.adoption, 0) })}</span></p>}
                      {canLoad && <button className="btn-outline btn-sm" onClick={() => onLoad(o)} data-testid={`m07-so-open-${o.id}`}>{t('m07.so.openInWorkbench')}</button>}
                    </div>
                    <GapBars families={r.families} year={r.horizon} label={label} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Async>
    </Section>
  );
}

function Method() {
  const t = useT();
  const openable = useOpenable();
  const notYet = t('m07.so.notOpen');
  const links: [string, string][] = [
    ['/workforce/scenarios', 'scenarios'], ['/workforce/handover', 'handover'], ['/knowledge/klra', 'klra'], ['/workforce/future', 'future'], ['/team/skills', 'skills'], ['/workforce/definitions', 'definitions'],
    ['/training/sat/future', 'taskFuture'], // FS52
  ];
  const items = useMemo(() => ['demand', 'handover', 'advance', 'supply', 'klra', 'pipeline', 'reskill', 'scale', 'suppression', 'tornado', 'automation', 'market'], []);
  return (
    <section id="so-method" className="scroll-mt-24">
      <Card title={t('m07.so.howTitle')} actions={<SimChip />}>
        <ul className="list-disc space-y-1.5 ps-5 text-[13px] text-ink-2" data-testid="m07-so-method">
          {items.map((k) => <li key={k}><span className="font-semibold text-ink">{t(`m07.so.how.${k}.t`)}</span> {t(`m07.so.how.${k}.b`, { n: MIN_GROUP_SIZE })}</li>)}
        </ul>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
          {links.map(([to, k]) => <LinkOrNote key={k} to={openable(to)} note={notYet}>{t(`m07.so.links.${k}`)}</LinkOrNote>)}
        </p>
      </Card>
    </section>
  );
}
