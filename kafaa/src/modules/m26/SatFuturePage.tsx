// /training/sat/future (M26 · FS06): the task layer with AI exposure and change horizon. Every non-restricted JTA task rated on the
// OECD AI capability dimensions (need versus the SIMULATED AI capability reference at the task's horizon), its exposure (AI-assisted,
// partly automatable, human core) with "Why this?", the technology driver and the skills it needs; the exposure mix, drivers and
// O*NET-style driver badges with a published threshold; sourced reference figures (SkillsFuture Singapore, OECD, O*NET) as stored
// rows; the explorer with filters and CSV; and the SAT analysts the training manager designates. Restricted (security, safeguards,
// cyber) tasks are never returned. Readers: sat R (instructors, the training manager, auditors).
import { useMemo, useState } from 'react';
import { Page, Section, Card, Async, EmptyState, Callout, StatTile, DataTable, FilterBar, useFilters, Donut, BarChart, Heatmap, SimChip, ConfirmDialog, SelectField, type Column } from '../../ui';
import { useAction, useRepo } from '../../data';
import { L, useFormat, useNav, usePick, useT } from '../../i18n';
import { DRIVERS, EXPOSURES, HORIZONS, HOT_DRIVER_MIN_TASKS, HOT_DRIVER_PCT, TASK_DIMS, futureSummary, hotDrivers, type FutureRow } from './future';
import { DecisionPill } from './ui';
import { BenchTies, FutureCell, RefFigure, useFutureData, type FutureData } from './fxui';
import type { FutureTask } from './backend/rpc';

export const FS06_BENCH = ['OECD-AICI', 'SSG-SF', 'ONET'];

export default function SatFuturePage() {
  const t = useT();
  const q = useFutureData();
  return (
    <Page title={t('m26.routes.training-sat-future.title')} intro={t('m26.fx.intro')} wide
      eyebrow={<span className="inline-flex flex-wrap items-center gap-2"><SimChip label={t('m26.fx.simChip')} /><BenchTies ids={FS06_BENCH} /></span>}
      actions={<L to="/training/sat" className="btn-outline no-underline" data-testid="m26-fx-back">{t('m26.routes.training-sat.title')}</L>}>
      <Async state={q}>{(d) => (d.view ? <Overview d={d} /> : <EmptyState title={t('m26.fx.noAccess')} />)}</Async>
    </Page>
  );
}

const rowsOf = (tasks: FutureTask[]): FutureRow[] => tasks.map((x) => ({ id: x.id, role_id: x.role_id, exposure: x.exposure, change_horizon: x.change_horizon, tech_driver: x.tech_driver, restricted: false, status: 'active' }));

function Overview({ d }: { d: FutureData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const v = d.view!;
  const rows = useMemo(() => rowsOf(v.tasks), [v.tasks]);
  const s = futureSummary(rows);
  const roleIds = [...new Set(v.tasks.map((x) => x.role_id))];
  const roleName = (id: string) => pick(d.roles.find((r) => r.id === id), 'title') || id;
  const hot = roleIds.map((r) => ({ role: r, badges: hotDrivers(rows, r) })).filter((x) => x.badges.length);
  const ssg = d.refs.find((r) => r.id === 'ref-ssg-tasks-aided');
  const onet = d.refs.find((r) => r.id === 'ref-onet-growth');
  return (
    <div className="space-y-6">
      <Callout tone="sim" title={t('m26.fx.assumptionTitle')}>{t('m26.fx.assumptionBody')}</Callout>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="m26-fx-tiles">
        <StatTile label={t('m26.fx.tileRated')} value={`${f.num(s.rated)} / ${f.num(s.total)}`} tone={s.rated === s.total ? 'ok' : 'info'} sub={t('m26.fx.tileRatedSub')} />
        <StatTile label={t('m26.fx.tileAugmentable')} value={f.pct(s.augmentablePct, 0)} sub={t('m26.fx.tileAugmentableSub', { a: f.num(s.byExposure.augment), p: f.num(s.byExposure.automate_partly) })} />
        <StatTile label={t('m26.fx.tileHuman')} value={f.num(s.byExposure.human_core)} tone="ok" sub={t('m26.fx.tileHumanSub')} />
        <StatTile label={t('m26.fx.tile2030')} value={f.num(s.byHorizon.now + s.byHorizon['2030'])} sub={t('m26.fx.tile2030Sub', { n: f.num(s.byHorizon['2035']) })} />
        <StatTile label={t('m26.fx.tileHot')} value={f.num(hot.length)} sub={t('m26.fx.tileHotSub', { pct: f.num(HOT_DRIVER_PCT) })} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title={t('m26.fx.mixTitle')} eyebrow={t('m26.fx.mixEyebrow')}>
          <Donut title={t('m26.fx.mixTitle')} data={EXPOSURES.map((e, i) => ({ label: t(`m26.fx.exposure.${e}`), value: s.byExposure[e], tone: ['accent', 'sim', 'leaf'][i] }))}
            center={<span className="num text-[18px] font-semibold">{f.num(s.rated)}</span>} />
          <p className="mt-2 text-[12px] text-ink-3">{t('m26.fx.mixNote')}</p>
        </Card>
        <Card title={t('m26.fx.driversTitle')} eyebrow={t('m26.fx.driversEyebrow')}>
          <BarChart title={t('m26.fx.driversTitle')} data={DRIVERS.map((x) => ({ label: t(`m26.fx.driver.${x}`), value: s.byDriver[x] }))} />
        </Card>
        <Card title={t('m26.fx.refTitle')} eyebrow={t('m26.fx.refEyebrow')}>
          <div className="space-y-3">
            <div className="rounded-card border border-accent/40 p-3" data-testid="m26-fx-ours">
              <div className="flex flex-wrap items-baseline gap-2"><span className="num text-[18px] font-semibold">{f.pct(s.augmentablePct, 0)}</span><span className="text-[12.5px] text-ink-2">{t('m26.fx.oursLabel', { n: f.num(s.rated) })}</span></div>
              <p className="mt-1 text-[12px] text-ink-3">{t('m26.fx.oursNote')}</p>
            </div>
            <RefFigure row={ssg} />
            <RefFigure row={onet} />
          </div>
        </Card>
      </div>

      <Section title={t('m26.fx.heatTitle')} description={t('m26.fx.heatBody')}>
        <Heatmap title={t('m26.fx.heatTitle')} rows={roleIds} cols={[...EXPOSURES]} rowLabel={roleName} colLabel={(c) => t(`m26.fx.exposure.${c}`)}
          value={(r, c) => { const n = rows.filter((x) => x.role_id === r && x.exposure === c).length; return { v: n, tone: c === 'human_core' ? 'ok' : c === 'automate_partly' ? 'sim' : 'info' }; }} />
      </Section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title={t('m26.fx.hotTitle')} eyebrow={t('m26.fx.hotEyebrow')}>
          <p className="mb-3 text-[12.5px] text-ink-2" data-testid="m26-fx-hot-criteria">{t('m26.fx.hotCriteria', { pct: f.num(HOT_DRIVER_PCT), min: f.num(HOT_DRIVER_MIN_TASKS) })}</p>
          {hot.length === 0 ? <EmptyState title={t('m26.fx.hotNone')} /> : (
            <ul className="divide-y divide-line" data-testid="m26-fx-hot">
              {hot.map((x) => (
                <li key={x.role} className="flex flex-wrap items-center gap-2 py-2 text-[13px]">
                  <L to={`/training/sat/roles/${x.role}`} className="link min-w-0 flex-1 font-semibold">{roleName(x.role)}</L>
                  {x.badges.map((b) => <span key={b.driver} className="chip border-accent bg-accent-soft text-eyebrow">{t(`m26.fx.driver.${b.driver}`)} · {t('m26.fx.hotShare', { n: f.num(b.n), of: f.num(b.of), pct: f.pct(b.pct, 0) })}</span>)}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <RuleAndLevels d={d} />
      </div>

      <Explorer d={d} roleName={roleName} />
      <Analysts d={d} />
    </div>
  );
}

function RuleAndLevels({ d }: { d: FutureData }) {
  const t = useT();
  const f = useFormat();
  return (
    <Card title={t('m26.fx.ruleTitle')} eyebrow={t('m26.fx.ruleEyebrow')}>
      <ol className="list-decimal space-y-1 ps-5 text-[13px]" data-testid="m26-fx-rule">
        {['below_half', 'critical_all', 'all_covered', 'some_covered'].map((k) => <li key={k}>{t(`m26.fx.rule.${k}`)}</li>)}
      </ol>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-[12.5px]" data-testid="m26-fx-levels">
          <caption className="caps mb-1 text-start">{t('m26.fx.levelsCaption')}</caption>
          <thead><tr className="text-ink-3"><th scope="col" className="text-start font-normal">{t('m26.fx.col.dimension')}</th>{HORIZONS.map((h) => <th key={h} scope="col" className="text-end font-normal">{t(`m26.fx.horizon.${h}`)}</th>)}</tr></thead>
          <tbody>
            {TASK_DIMS.map((dim) => (
              <tr key={dim} className="border-t border-line">
                <th scope="row" className="py-1 text-start font-semibold">{t(`m26.fx.dim.${dim}`)}</th>
                {HORIZONS.map((h) => <td key={h} className="num py-1 text-end">{f.num(d.levels.find((l) => l.dimension === dim && l.horizon === h)?.level ?? 0)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">{t('m26.fx.levelsNote')}</p>
    </Card>
  );
}

function Explorer({ d, roleName }: { d: FutureData; roleName: (id: string) => string }) {
  const t = useT();
  const pick = usePick();
  const nav = useNav();
  const [flt, setFlt] = useFilters({ role: '', exposure: '', horizon: '', driver: '' }, true);
  const v = d.view!;
  const xs = v.tasks.filter((x) => (!flt.role || x.role_id === flt.role) && (!flt.exposure || x.exposure === flt.exposure) && (!flt.horizon || x.change_horizon === flt.horizon) && (!flt.driver || x.tech_driver === flt.driver));
  const cols: Column<FutureTask>[] = [
    { key: 'code', header: t('m26.task.code'), value: (x) => x.code, sortable: true, width: '7rem', render: (x) => <span className="num font-semibold">{x.code}</span> },
    { key: 'title', header: t('m26.task.title'), value: (x) => pick(x, 'title'), sortable: true, render: (x) => (
      <div className="min-w-0">
        <L to={`/training/sat/tasks/${x.id}`} className="link font-semibold">{pick(x, 'title')}</L>
        <div className="mt-0.5 text-[11.5px] text-ink-2">{roleName(x.role_id)}{x.critical && <span className="chip ms-1.5 border-bad-line bg-bad-bg text-bad">{t('m26.task.critical')}</span>}</div>
      </div>
    ) },
    { key: 'exposure', header: t('m26.fx.col.exposure'), value: (x) => (x.exposure ? t(`m26.fx.exposure.${x.exposure}`) : ''), sortable: true, render: (x) => <FutureCell task={x} /> },
    { key: 'horizon', header: t('m26.fx.col.horizon'), value: (x) => x.change_horizon ?? '', sortable: true, render: (x) => (x.change_horizon ? t(`m26.fx.horizon.${x.change_horizon}`) : '—') },
    { key: 'driver', header: t('m26.fx.col.driver'), value: (x) => (x.tech_driver ? t(`m26.fx.driver.${x.tech_driver}`) : ''), sortable: true },
    { key: 'skills', header: t('m26.fx.col.skills'), value: (x) => x.skills.length, align: 'end', sortable: true, render: (x) => (
      <span className="num" title={x.skills.map((s) => pick(d.skills.find((k) => k.id === s.skill_id), 'name')).join(', ')}>{x.skills.length}{x.skills.some((s) => s.kind === 'future') && <span className="chip ms-1 border-accent bg-accent-soft text-eyebrow">{t('m26.fx.kind.future')}</span>}</span>
    ) },
    { key: 'decision', header: t('m26.task.decision'), value: (x) => x.decision, render: (x) => <DecisionPill decision={x.decision} /> },
  ];
  return (
    <Section title={t('m26.fx.explorerTitle')} description={t('m26.fx.explorerBody')}>
      <div className="space-y-3">
        <FilterBar value={flt} onChange={setFlt} fields={[
          { key: 'role', label: t('m26.changes.filterRole'), options: [...new Set(v.tasks.map((x) => x.role_id))].map((r) => ({ value: r, label: roleName(r) })) },
          { key: 'exposure', label: t('m26.fx.col.exposure'), options: EXPOSURES.map((e) => ({ value: e, label: t(`m26.fx.exposure.${e}`) })) },
          { key: 'horizon', label: t('m26.fx.col.horizon'), options: HORIZONS.map((h) => ({ value: h, label: t(`m26.fx.horizon.${h}`) })) },
          { key: 'driver', label: t('m26.fx.col.driver'), options: DRIVERS.map((x) => ({ value: x, label: t(`m26.fx.driver.${x}`) })) },
        ]} />
        <div data-testid="m26-fx-explorer">
          <DataTable rows={xs} columns={cols} rowKey={(x) => x.id} csvName="sat-task-future.csv" onRowClick={(x) => nav(`/training/sat/tasks/${x.id}`)} empty={<EmptyState title={t('m26.fx.noTasks')} />} />
        </div>
        <p className="text-[12px] text-ink-3">{t('m26.fx.restrictedNote')}</p>
      </div>
    </Section>
  );
}

function Analysts({ d }: { d: FutureData }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const v = d.view!;
  const [pickPid, setPick] = useState('');
  const [act, setAct] = useState<{ pid: string; active: boolean; name: string } | null>(null);
  const activeIds = new Set(v.analysts.filter((a) => a.active).map((a) => a.person_id));
  const nameOf = (x: { name: string; name_ar: string }) => pick({ name_en: x.name, name_ar: x.name_ar }, 'name');
  return (
    <Section title={t('m26.fx.analystsTitle')} description={t('m26.fx.analystsBody')}>
      <Card>
        {v.analysts.length === 0 ? <EmptyState title={t('m26.fx.analystsNone')} /> : (
          <ul className="divide-y divide-line" data-testid="m26-fx-analysts">
            {v.analysts.map((a) => (
              <li key={a.person_id} className="flex flex-wrap items-center gap-2 py-2 text-[13px]">
                <span className="min-w-0 flex-1 font-semibold">{nameOf(a)}</span>
                <span className={`chip ${a.active ? 'border-ok-line bg-ok-bg text-ok' : 'border-line bg-sunken text-ink-3'}`}>{t(a.active ? 'm26.fx.analystActive' : 'm26.fx.analystWithdrawn')}</span>
                <span className="text-[12px] text-ink-3">{f.date(a.designated_on)}</span>
                {v.can_designate && a.active && <button className="btn-ghost btn-sm" onClick={() => setAct({ pid: a.person_id, active: false, name: nameOf(a) })} data-testid="m26-fx-withdraw">{t('m26.fx.withdraw')}</button>}
              </li>
            ))}
          </ul>
        )}
        {v.can_designate && (
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
            <div className="min-w-0 flex-1">
              <SelectField label={t('m26.fx.designateLabel')} name="analyst" value={pickPid} onChange={setPick} placeholder={t('m26.fx.designatePick')}
                options={v.candidates.filter((c) => !activeIds.has(c.person_id)).map((c) => ({ value: c.person_id, label: nameOf(c) }))} />
            </div>
            <button className="btn-primary btn-sm" disabled={!pickPid} data-testid="m26-fx-designate"
              onClick={() => { const c = v.candidates.find((x) => x.person_id === pickPid); if (c) setAct({ pid: c.person_id, active: true, name: nameOf(c) }); }}>{t('m26.fx.designate')}</button>
          </div>
        )}
        {!v.can_write && <p className="mt-3 text-[12.5px] text-ink-2" data-testid="m26-fx-readonly">{t('m26.fx.readOnly')}</p>}
      </Card>
      <ConfirmDialog open={!!act} onClose={() => setAct(null)} title={act?.active ? t('m26.fx.designate') : t('m26.fx.withdraw')}
        consequence={act ? t(act.active ? 'm26.fx.designateBody' : 'm26.fx.withdrawBody', { name: act.name }) : ''} actingAs={t('m26.common.asTm')}
        confirmLabel={act?.active ? t('m26.fx.designate') : t('m26.fx.withdraw')}
        onConfirm={async () => { if (act) { const r = await run(() => repo.rpc.designateSatAnalyst(act.pid, act.active)); if (r.ok) setPick(''); } }} />
    </Section>
  );
}

