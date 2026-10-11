// /knowledge/klra (M24 · F20): Knowledge Loss Risk Assessment. The KM owner (knowledge A) sees every position, a department head
// (knowledge Scope) the positions in scope, HR (knowledge Agg) only the department heatmap (every cell under 10 suppressed).
// Positions carry bands only (retirement window, contract end, KHNP OSSA cover): no birth date, age or exact date anywhere.
// Total = attrition x position (IAEA KLRM); thresholds are set by the KM owner and audited; high-risk rows need a mitigation action
// before their quarter closes, or they read "overdue".
import { useMemo, useState } from 'react';
import {
  Page, Section, Card, Async, EmptyState, Callout, Tabs, StatTile, DataTable, WhyThis, Heatmap, LineChart, SimChip, ConfirmDialog, Modal, EngineBadge, type Column,
} from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { useEngine } from '../../data/useEngine';
import { useSession } from '../../auth/session';
import { L, useFormat, useNav, usePick, useT } from '../../i18n';
import { DEPARTMENTS, bandOf, validThresholds, type Heatmap as HeatmapData } from './klra';
import type { KlraRegister, KlraRow } from './backend/rpc';
import { BandPill, FactorDots, MitigationPill, RiskMatrix, Sources, METHOD_SOURCES, ActionPill } from './ui';
import { AssessModal, MitigationModal } from './klraForms';

const TABLES = ['klra_assessments', 'klra_actions', 'klra_settings', 'klra_positions', 'knowledge_assets'] as const;

export default function KlraPage() {
  const t = useT();
  const repo = useRepo();
  const s = useSession();
  const eng = useEngine('skills');
  const [period, setPeriod] = useState<string | null>(null);
  const reg = useQuery([...TABLES], () => repo.rpc.klraRegister(period), [period, s.identity.personId]);
  const heat = useQuery([...TABLES], () => repo.rpc.klraHeatmap(period), [period, s.identity.personId]);
  return (
    <Page title={t('m24.routes.knowledge-klra.title')} intro={t('m24.klra.intro')} wide
      eyebrow={<span className="inline-flex flex-wrap items-center gap-2"><SimChip label={t('m24.klra.simFeed')} /><EngineBadge engine={eng} /></span>}>
      <Async state={reg}>
        {(r) => r.mode === 'none' ? <EmptyState icon="lock" title={t('m24.klra.noAccess')}>{t('m24.klra.noAccessBody')}</EmptyState> : (
          <div className="space-y-5">
            <PeriodBar r={r} setPeriod={setPeriod} />
            {r.mode === 'agg' ? (
              <>
                <Callout title={t('m24.klra.aggTitle')}>{t('m24.klra.aggBody')}</Callout>
                <HeatmapPanel heat={heat.data ?? null} loading={heat.loading} />
                <MethodPanel r={r} />
              </>
            ) : <Full r={r} heat={heat.data ?? null} heatLoading={heat.loading} />}
          </div>
        )}
      </Async>
    </Page>
  );
}

function PeriodBar({ r, setPeriod }: { r: KlraRegister; setPeriod: (p: string | null) => void }) {
  const t = useT();
  const f = useFormat();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="caps">{t('m24.klra.quarter')}</span>
        <select className="input mt-1" value={r.period} onChange={(e) => setPeriod(e.target.value)} data-testid="m24-klra-period">
          {[...r.periods].reverse().map((p) => <option key={p} value={p}>{p}{p === r.current ? ` · ${t('m24.klra.current')}` : ` · ${t('m24.klra.closed')}`}</option>)}
        </select>
      </label>
      <p className="text-[12.5px] text-ink-2">{r.period === r.current ? t('m24.klra.closesOn', { date: f.date(r.quarter_end) }) : t('m24.klra.closedOn', { date: f.date(r.quarter_end) })}</p>
      <p className="text-[12.5px] text-ink-2">{t('m24.klra.thresholdLine', { high: f.num(r.thresholds.high), medium: f.num(r.thresholds.medium) })}</p>
    </div>
  );
}

function Full({ r, heat, heatLoading }: { r: KlraRegister; heat: HeatmapData | null; heatLoading: boolean }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const owner = s.can('knowledge', ['A']);
  const [assess, setAssess] = useState<{ id: string; title: string } | null>(null);
  const [plan, setPlan] = useState<{ id: string; title: string } | null>(null);
  const [reassess, setReassess] = useState(false);
  const rows = r.rows;
  const high = rows.filter((x) => x.band === 'high');
  const attention = rows.filter((x) => x.mitigation === 'needed' || x.mitigation === 'overdue');
  const overdueActions = rows.flatMap((x) => x.actions).filter((a) => a.overdue).length;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="m24-klra-tiles">
        <StatTile label={t('m24.klra.tileAssessed')} value={f.num(rows.length)} sub={r.pending.length ? t('m24.klra.tilePending', { n: f.num(r.pending.length) }) : t('m24.klra.tileAllDone')} />
        <StatTile label={t('m24.band.high')} value={f.num(high.length)} tone="bad" sub={t('m24.klra.tileHighSub', { n: f.num(r.thresholds.high) })} />
        <StatTile label={t('m24.band.medium')} value={f.num(rows.filter((x) => x.band === 'medium').length)} tone="sim" />
        <StatTile label={t('m24.klra.tileAttention')} value={f.num(attention.length)} tone={attention.some((x) => x.mitigation === 'overdue') ? 'bad' : 'info'} sub={t('m24.klra.tileAttentionSub', { n: f.num(attention.filter((x) => x.mitigation === 'overdue').length) })} />
        <StatTile label={t('m24.klra.tileOverdueActions')} value={f.num(overdueActions)} tone={overdueActions ? 'bad' : 'ok'} />
      </div>
      {r.mode === 'scope' && <Callout>{t('m24.klra.scopeNote')}</Callout>}
      <Tabs tabs={[
        { id: 'register', label: t('m24.klra.tabRegister'), badge: attention.length ? <span className="chip border-bad-line bg-bad-bg text-bad">{f.num(attention.length)}</span> : undefined,
          content: <Register r={r} onAssess={setAssess} onPlan={setPlan} onReassess={owner && r.period === r.current && r.pending.length ? () => setReassess(true) : null} /> },
        { id: 'matrix', label: t('m24.klra.tabMatrix'), content: <MatrixPanel r={r} /> },
        { id: 'heatmap', label: t('m24.klra.tabHeatmap'), content: <div className="pt-4"><HeatmapPanel heat={heat} loading={heatLoading} /></div> },
        { id: 'method', label: t('m24.klra.tabMethod'), content: <div className="pt-4"><MethodPanel r={r} /></div> },
      ]} />
      <AssessModal positionId={assess?.id ?? null} title={assess?.title ?? ''} onClose={() => setAssess(null)} />
      <MitigationModal assessment={plan} period={r.period} onClose={() => setPlan(null)} />
      <ConfirmDialog open={reassess} onClose={() => setReassess(false)} title={t('m24.klra.reassessTitle')} consequence={t('m24.klra.reassessBody', { n: f.num(r.pending.length), period: r.period })}
        actingAs={t('m24.klra.actingOwner')} confirmLabel={t('m24.klra.reassess')} onConfirm={async () => { await run(() => repo.rpc.reassessQuarter(r.period)); }} />
    </>
  );
}

function Register({ r, onAssess, onPlan, onReassess }: { r: KlraRegister; onAssess: (x: { id: string; title: string }) => void; onPlan: (x: { id: string; title: string }) => void; onReassess: (() => void) | null }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const nav = useNav();
  const [dept, setDept] = useState('');
  const [band, setBand] = useState('');
  const [mit, setMit] = useState('');
  const open = r.period === r.current;
  const rows = r.rows.filter((x) => (!dept || x.department === dept) && (!band || x.band === band) && (!mit || x.mitigation === mit));
  const cols: Column<KlraRow>[] = [
    { key: 'position', header: t('m24.klra.colPosition'), value: (x) => pick(x.position, 'title'), sortable: true, render: (x) => (
      <div className="min-w-0">
        <L to={`/knowledge/klra/${x.position_id}`} className="link font-semibold">{pick(x.position, 'title')}</L>
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-2">
          <span className="truncate">{pick({ holder_en: x.position.holder_en, holder_ar: x.position.holder_ar }, 'holder')}</span>
          {x.position.kind !== 'staff' && <span className="chip border-sim-line bg-sim-bg text-sim">{t(`m24.posKind.${x.position.kind}`)}</span>}
        </div>
      </div>
    ) },
    { key: 'department', header: t('m24.klra.colDept'), value: (x) => t(`m24.dept.${x.department}`), sortable: true },
    { key: 'attrition', header: t('m24.klra.attrition'), value: (x) => x.attrition_factor, sortable: true, render: (x) => <FactorDots value={x.attrition_factor} label={t('m24.klra.attritionN', { n: x.attrition_factor })} /> },
    { key: 'pos', header: t('m24.klra.position'), value: (x) => x.position_factor, sortable: true, render: (x) => <FactorDots value={x.position_factor} label={t('m24.klra.positionN', { n: x.position_factor })} /> },
    { key: 'total', header: t('m24.klra.colTotal'), value: (x) => x.total, sortable: true, align: 'end', render: (x) => <span className="inline-flex items-center gap-2"><span className="num font-semibold">{f.num(x.total)}</span><BandPill band={x.band} /></span> },
    { key: 'mitigation', header: t('m24.klra.colMitigation'), value: (x) => t(`m24.mitigation.${x.mitigation}`), sortable: true, render: (x) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <MitigationPill state={x.mitigation} />
        {x.actions.filter((a) => a.overdue).length > 0 && <ActionPill status="planned" overdue />}
      </span>
    ) },
    { key: 'why', header: t('m24.klra.colWhy'), csv: false, render: (x) => <WhyThis reasons={x.reasons} testId="m24-klra-why" /> },
    { key: 'act', header: '', csv: false, render: (x) => open && (x.band === 'high' || x.mitigation !== 'not_required') ? <button className="btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); onPlan({ id: x.id, title: pick(x.position, 'title') }); }} data-testid="m24-klra-plan">{t('m24.klra.plan')}</button> : null },
  ];
  return (
    <div className="space-y-4 pt-4">
      {r.pending.length > 0 && (
        <Card title={t('m24.klra.pendingTitle', { n: f.num(r.pending.length) })} actions={onReassess ? <button className="btn-primary btn-sm" onClick={onReassess} data-testid="m24-klra-reassess">{t('m24.klra.reassess')}</button> : undefined}>
          <p className="mb-2 text-[13px] text-ink-2">{t('m24.klra.pendingBody')}</p>
          <ul className="flex flex-wrap gap-2" data-testid="m24-klra-pending">
            {r.pending.map((p) => (
              <li key={p.id}><button className="btn-outline btn-sm" onClick={() => onAssess({ id: p.id, title: pick(p, 'title') })}>{t('m24.klra.assessX', { title: pick(p, 'title') })}</button></li>
            ))}
          </ul>
        </Card>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="block"><span className="caps">{t('m24.klra.colDept')}</span>
          <select className="input mt-1" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">{t('m24.common.all')}</option>{DEPARTMENTS.map((d) => <option key={d} value={d}>{t(`m24.dept.${d}`)}</option>)}</select></label>
        <label className="block"><span className="caps">{t('m24.klra.colBand')}</span>
          <select className="input mt-1" value={band} onChange={(e) => setBand(e.target.value)}><option value="">{t('m24.common.all')}</option>{['high', 'medium', 'low'].map((d) => <option key={d} value={d}>{t(`m24.band.${d}`)}</option>)}</select></label>
        <label className="block"><span className="caps">{t('m24.klra.colMitigation')}</span>
          <select className="input mt-1" value={mit} onChange={(e) => setMit(e.target.value)} data-testid="m24-klra-mitfilter"><option value="">{t('m24.common.all')}</option>{['needed', 'overdue', 'planned', 'done', 'not_required'].map((d) => <option key={d} value={d}>{t(`m24.mitigation.${d}`)}</option>)}</select></label>
      </div>
      <div data-testid="m24-klra-register">
        <DataTable rows={rows} columns={cols} rowKey={(x) => x.id} csvName={`klra-${r.period}.csv`} initialSort={{ key: 'total', dir: 'desc' }} onRowClick={(x) => nav(`/knowledge/klra/${x.position_id}`)} caption={t('m24.klra.registerCaption', { period: r.period })}
          empty={<EmptyState icon="info" title={t('m24.klra.noRows')} />} />
      </div>
      <p className="text-[12px] text-ink-3">{t('m24.klra.bandsOnly')}</p>
    </div>
  );
}

function MatrixPanel({ r }: { r: KlraRegister }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const [sel, setSel] = useState<[number, number] | null>(null);
  const inCell = sel ? r.rows.filter((x) => x.attrition_factor === sel[0] && x.position_factor === sel[1]) : [];
  return (
    <div className="grid grid-cols-1 gap-4 pt-4 lg:grid-cols-[auto_minmax(0,1fr)]">
      <Card title={t('m24.klra.matrixTitle')}>
        <RiskMatrix rows={r.rows} thresholds={r.thresholds} onPick={(a, p) => setSel([a, p])} selected={sel} />
        <p className="mt-2 max-w-md text-[12px] text-ink-3">{t('m24.klra.matrixHelp')}</p>
      </Card>
      <Card title={sel ? t('m24.klra.cellTitle', { a: f.num(sel[0]), p: f.num(sel[1]), n: f.num(inCell.length) }) : t('m24.klra.cellPick')}>
        {sel ? (
          <ul className="space-y-2" data-testid="m24-matrix-cell">
            {inCell.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-0">
                <span className="min-w-0"><L to={`/knowledge/klra/${x.position_id}`} className="link font-semibold">{pick(x.position, 'title')}</L><span className="block text-[12px] text-ink-2">{t(`m24.dept.${x.department}`)}</span></span>
                <span className="flex items-center gap-2"><MitigationPill state={x.mitigation} /><WhyThis reasons={x.reasons} /></span>
              </li>
            ))}
          </ul>
        ) : <EmptyState icon="chart" title={t('m24.klra.cellPickBody')} />}
      </Card>
    </div>
  );
}

function HeatmapPanel({ heat, loading }: { heat: HeatmapData | null; loading: boolean }) {
  const t = useT();
  const f = useFormat();
  if (loading && !heat) return <p className="text-[13px] text-ink-2">{t('m24.common.loading')}</p>;
  if (!heat) return <EmptyState icon="lock" title={t('m24.klra.noHeatmap')} />;
  const cols = ['n', 'high', 'medium', 'low', 'mitigated'] as const;
  const byId = new Map(heat.departments.map((d) => [d.id, d]));
  const tone = { n: undefined, high: 'bad', medium: 'sim', low: 'ok', mitigated: 'info' } as const;
  return (
    <div className="space-y-4" data-testid="m24-klra-heatmap">
      <Card title={t('m24.klra.heatTitle', { period: heat.period })} actions={<SimChip label={t('m24.klra.simFeed')} />}>
        <Heatmap title={t('m24.klra.heatTitle', { period: heat.period })} rows={[...DEPARTMENTS]} cols={[...cols]}
          rowLabel={(d) => t(`m24.dept.${d}`)} colLabel={(c) => t(`m24.heat.${c}`)}
          value={(d, c) => { const x = byId.get(d as never)![c as (typeof cols)[number]]; return { v: x.n, suppressed: x.suppressed, tone: tone[c as (typeof cols)[number]] }; }} />
        <p className="mt-2 text-[12px] text-ink-3">{t('m24.klra.heatTotal', { n: heat.total.n.suppressed ? t('common.suppressedShort') : f.num(heat.total.n.n), high: heat.total.high.suppressed ? t('common.suppressedShort') : f.num(heat.total.high.n) })}</p>
        <p className="text-[12px] text-ink-3">{t('m24.klra.heatSuppressed', { n: f.num(heat.min_group) })} {t('m24.klra.excluded')}</p>
      </Card>
      <Card title={t('m24.klra.trendTitle')}>
        <LineChart title={t('m24.klra.trendTitle')} series={[{ name: t('m24.band.high'), tone: 'bad', points: heat.trend.map((p) => ({ x: p.period, y: p.high.suppressed ? null : p.high.n })) }, { name: t('m24.heat.n'), points: heat.trend.map((p) => ({ x: p.period, y: p.n.suppressed ? null : p.n.n })), dashed: true }]} />
      </Card>
    </div>
  );
}

function MethodPanel({ r }: { r: KlraRegister }) {
  const t = useT();
  const f = useFormat();
  const s = useSession();
  const repo = useRepo();
  const run = useAction();
  const owner = s.can('knowledge', ['A']);
  const [edit, setEdit] = useState(false);
  const [hi, setHi] = useState(String(r.thresholds.high));
  const [md, setMd] = useState(String(r.thresholds.medium));
  const [confirm, setConfirm] = useState(false);
  const valid = validThresholds(Number(hi), Number(md)) && /^\d+$/.test(hi) && /^\d+$/.test(md);
  const scales = useMemo(() => [
    ['attrition', ['retire', 'contract', 'ossa']],
    ['position', ['crit', 'uniq', 'tacit', 'repl']],
  ] as const, []);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Section title={t('m24.method.title')} description={t('m24.method.intro')}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {scales.map(([k, drivers]) => (
            <Card key={k} title={t(`m24.method.${k}`)}>
              <ul className="list-disc space-y-1 ps-4 text-[13px] text-ink-2">{drivers.map((d) => <li key={d}>{t(`m24.method.${d}`)}</li>)}</ul>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-[13px]">{t('m24.method.total')}</p>
        <p className="mt-2 text-[12.5px] text-ink-2">{t('m24.method.loop')}</p>
        <div className="mt-3"><Sources list={METHOD_SOURCES} /></div>
      </Section>
      <Card title={t('m24.method.thresholds')} actions={owner ? <button className="btn-outline btn-sm" onClick={() => { setHi(String(r.thresholds.high)); setMd(String(r.thresholds.medium)); setEdit(true); }} data-testid="m24-thresholds-edit">{t('m24.method.change')}</button> : undefined}>
        <dl className="space-y-2 text-[13px]">
          <div className="flex items-center justify-between"><dt><BandPill band="high" /></dt><dd className="num">≥ {f.num(r.thresholds.high)}</dd></div>
          <div className="flex items-center justify-between"><dt><BandPill band="medium" /></dt><dd className="num">≥ {f.num(r.thresholds.medium)}</dd></div>
          <div className="flex items-center justify-between"><dt><BandPill band="low" /></dt><dd className="num">&lt; {f.num(r.thresholds.medium)}</dd></div>
        </dl>
        <p className="mt-3 text-[12px] text-ink-3">{owner ? t('m24.method.ownerNote') : t('m24.method.readOnly')}</p>
      </Card>
      <Modal open={edit} onClose={() => setEdit(false)} title={t('m24.method.change')} size="sm"
        footer={<><button className="btn-outline" onClick={() => setEdit(false)}>{t('common.cancel')}</button><button className="btn-primary" disabled={!valid} onClick={() => setConfirm(true)} data-testid="m24-thresholds-save">{t('common.save')}</button></>}>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="caps">{t('m24.band.high')}</span><input className="input mt-1" type="number" min={3} max={25} value={hi} onChange={(e) => setHi(e.target.value)} /></label>
          <label className="block"><span className="caps">{t('m24.band.medium')}</span><input className="input mt-1" type="number" min={2} max={24} value={md} onChange={(e) => setMd(e.target.value)} /></label>
        </div>
        {!valid && <p className="mt-2 text-[12px] text-bad">{t('m24.method.invalid')}</p>}
        {valid && <p className="mt-2 text-[12.5px] text-ink-2">{t('m24.method.preview', { n: f.num(r.rows.filter((x) => bandOf(x.total, { high: Number(hi), medium: Number(md) }) === 'high').length) })}</p>}
      </Modal>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m24.method.confirmTitle')} consequence={t('m24.method.confirmBody', { high: hi, medium: md })} actingAs={t('m24.klra.actingOwner')}
        onConfirm={async () => { const x = await run(() => repo.rpc.setKlraThresholds(Number(hi), Number(md))); if (x.ok) setEdit(false); }} />
    </div>
  );
}
