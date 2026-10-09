// /training/simulator/scenarios (M04 · F28, W4 · E3): the simulator training-scenario library (metadata only; never exam content),
// the COCT/LOCT cycle planner with its coverage matrix, crew debriefs and team-competency insights.
import { useMemo, useState } from 'react';
import { Async, Callout, Card, ConfirmDialog, DataTable, FilterBar, Grid, Heatmap, LineChart, Page, SourceLink, StatTile, Tabs, useFilters } from '../../ui';
import { useAction, useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { useSession } from '../../auth/session';
import type { SimScenariosRow } from '../../data/types';
import { DIMENSIONS, SIM_CATEGORIES, SIM_PROGRAMMES, SCENARIO_STATUSES, crewInsights, cycleCoverage, meanScore } from './scenarios';
import { CatChip, DebriefDrawer, DebriefForm, ScenarioEditor, ScnStatus, SourceChip, asCycle, asDebriefLite, cycleOn, debriefableSlots, useSimDebriefs, useSimLabels, useSimLibrary, type SimLibrary } from './simUi';
import { CyclePlanner } from './simPlanner';
import type { SimDebriefView } from './backend/simulator.rpc';
import { usePeople } from './ui';

const TECDOC = 'https://www-pub.iaea.org/MTCD/Publications/PDF/TE-1963web.pdf';

export default function TrainingScenariosPage() {
  const t = useT();
  const f = useFormat();
  const lib = useSimLibrary();
  const deb = useSimDebriefs();
  const [tab, setTab] = useState('library');
  return (
    <Page title={t('m04.routes.training-sim-scenarios.title')} intro={t('m04.scn.intro')} wide>
      <Callout tone="info" title={t('m04.scn.rule.title')}>
        {t('m04.scn.rule.body')} <SourceLink href={TECDOC}>IAEA-TECDOC-1963</SourceLink>
      </Callout>
      <Async state={lib}>
        {(L0) => {
          const debriefs = deb.data ?? [];
          const today = new Date().toISOString().slice(0, 10);
          const cur = cycleOn(L0.cycles, 'coct', today);
          const cov = cur ? cycleCoverage(asCycle(cur), L0.items, L0.scMap, debriefs.map(asDebriefLite)) : null;
          return (
            <div className="space-y-4">
              <Grid cols={4}>
                <StatTile label={t('m04.scn.tiles.approved')} value={f.num(L0.scenarios.filter((s) => s.status === 'approved').length)} sub={t('m04.scn.tiles.approvedSub', { n: L0.scenarios.length })} />
                <StatTile label={t('m04.scn.tiles.review')} value={f.num(L0.scenarios.filter((s) => s.status === 'in_review').length)} tone="sim" sub={t('m04.scn.tiles.reviewSub')} />
                <StatTile label={t('m04.scn.tiles.coverage')} value={cov ? f.pct(cov.pct, 0) : '—'} tone={cov && cov.missing + cov.under > 0 ? 'bad' : 'ok'} sub={cov && cur ? t('m04.scn.tiles.coverageSub', { gaps: cov.missing + cov.under, cycle: cur.programme.toUpperCase() }) : ''} />
                <StatTile label={t('m04.scn.tiles.debriefs')} value={f.num(debriefs.length)} sub={t('m04.scn.tiles.debriefsSub', { n: debriefs.filter((d) => d.source === 'kafaa').length })} />
              </Grid>
              <Tabs value={tab} onChange={setTab} tabs={[
                { id: 'library', label: t('m04.scn.tab.library'), content: <Library lib={L0} /> },
                { id: 'planner', label: t('m04.scn.tab.planner'), content: <CyclePlanner lib={L0} debriefs={debriefs.map(asDebriefLite)} /> },
                { id: 'debriefs', label: t('m04.scn.tab.debriefs'), content: <Debriefs lib={L0} debriefs={debriefs} loading={deb.loading} /> },
                { id: 'insights', label: t('m04.scn.tab.insights'), content: <Insights debriefs={debriefs} /> },
              ]} />
            </div>
          );
        }}
      </Async>
    </Page>
  );
}

function Library({ lib }: { lib: SimLibrary }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const l = useSimLabels();
  const s = useSession();
  const repo = useRepo();
  const run = useAction();
  const people = usePeople();
  const [flt, setFlt] = useFilters({ q: '', category: '', status: '', programme: '' });
  const [edit, setEdit] = useState<SimScenariosRow | null | 'new'>(null);
  const [review, setReview] = useState<{ row: SimScenariosRow; decision: 'approve' | 'return' } | null>(null);
  const canWrite = s.can('sat', ['W', 'A']);
  const canApprove = s.can('sat', ['A']);
  const rows = lib.scenarios.filter((x) => (!flt.category || x.category === flt.category) && (!flt.status || x.status === flt.status) && (!flt.programme || x.programmes.includes(flt.programme))
    && (!flt.q || `${x.code} ${x.title_en} ${x.title_ar}`.toLowerCase().includes(flt.q.toLowerCase())));
  const queue = lib.scenarios.filter((x) => x.status === 'in_review');
  return (
    <div className="space-y-4">
      {canApprove && queue.length > 0 && (
        <Card title={t('m04.scn.lib.queue', { n: queue.length })}>
          <ul className="divide-y divide-line" data-testid="m04-scn-queue">
            {queue.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0"><L to={`/training/simulator/scenarios/${x.id}`} className="font-medium"><span className="ltr me-1 text-ink-3">{x.code}</span>{pick(x, 'title')}</L>
                  <span className="block text-[12px] text-ink-3">{t('m04.scn.lib.byRev', { who: people.name(x.last_edited_by), n: x.revision })}</span></span>
                <span className="flex gap-2">
                  <button className="btn-outline btn-sm" onClick={() => setReview({ row: x, decision: 'return' })} data-testid={`m04-scn-return-${x.id}`}>{t('m04.scn.lib.return')}</button>
                  <button className="btn-primary btn-sm" disabled={x.last_edited_by === s.identity.personId} title={x.last_edited_by === s.identity.personId ? t('m04.scn.lib.ownRevision') : undefined} onClick={() => setReview({ row: x, decision: 'approve' })} data-testid={`m04-scn-approve-${x.id}`}>{t('m04.scn.lib.approve')}</button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <FilterBar value={flt} onChange={setFlt} search="q" fields={[
        { key: 'category', label: t('m04.scn.f.category'), options: SIM_CATEGORIES.map((c) => ({ value: c, label: l.cat(c) })) },
        { key: 'status', label: t('m04.common.status'), options: SCENARIO_STATUSES.map((c) => ({ value: c, label: l.status(c) })) },
        { key: 'programme', label: t('m04.scn.f.programmes'), options: SIM_PROGRAMMES.map((c) => ({ value: c, label: l.prog(c) })) },
      ]} extra={canWrite ? <button className="btn-primary btn-sm" onClick={() => setEdit('new')} data-testid="m04-scn-new">{t('m04.scn.lib.new')}</button> : undefined} />
      <div data-testid="m04-scn-library">
        <DataTable rows={rows} rowKey={(r) => r.id} csvName="simulator-scenarios" searchable={false} initialSort={{ key: 'code', dir: 'asc' }} columns={[
          { key: 'code', header: t('m04.scn.f.code'), value: (r) => r.code, sortable: true, render: (r) => <span className="ltr">{r.code}</span> },
          { key: 'title', header: t('m04.scn.f.title'), value: (r) => pick(r, 'title'), sortable: true, render: (r) => <L to={`/training/simulator/scenarios/${r.id}`} className="font-medium">{pick(r, 'title')}</L> },
          { key: 'category', header: t('m04.scn.f.category'), value: (r) => l.cat(r.category), sortable: true, render: (r) => <CatChip c={r.category} /> },
          { key: 'objectives', header: t('m04.scn.f.objectives'), value: (r) => r.objective_ids.length, align: 'end', sortable: true },
          { key: 'positions', header: t('m04.scn.f.positions'), value: (r) => r.positions.map(l.pos).join(', ') },
          { key: 'duration', header: t('m04.scn.f.duration'), value: (r) => r.duration_min, align: 'end', sortable: true, render: (r) => t('m04.scn.minutes', { n: f.num(r.duration_min) }) },
          { key: 'programmes', header: t('m04.scn.f.programmes'), value: (r) => r.programmes.map(l.prog).join(', ') },
          { key: 'status', header: t('m04.common.status'), value: (r) => l.status(r.status), render: (r) => <span className="flex items-center gap-1"><ScnStatus s={r.status} /><span className="text-[11.5px] text-ink-3">{t('m04.scn.revShort', { n: r.revision })}</span></span> },
          { key: 'last', header: t('m04.scn.f.lastRun'), value: (r) => r.last_run_on ?? '', sortable: true, render: (r) => (r.last_run_on ? f.date(r.last_run_on) : '—') },
        ]} />
      </div>
      {edit && <ScenarioEditor open onClose={() => setEdit(null)} lib={lib} initial={edit === 'new' ? null : edit} />}
      <ConfirmDialog open={!!review} onClose={() => setReview(null)} title={review?.decision === 'approve' ? t('m04.scn.lib.approveTitle', { code: review?.row.code ?? '' }) : t('m04.scn.lib.returnTitle', { code: review?.row.code ?? '' })}
        consequence={review?.decision === 'approve' ? t('m04.scn.lib.approveBody') : t('m04.scn.lib.returnBody')} requireReason={review?.decision === 'return'} reasonLabel={t('m04.scn.lib.reason')}
        confirmLabel={review?.decision === 'approve' ? t('m04.scn.lib.approve') : t('m04.scn.lib.return')}
        onConfirm={async (reason) => { const r = review!; setReview(null); await run(() => repo.rpc.reviewSimScenario(r.row.id, r.decision, reason || undefined)); }} />
    </div>
  );
}

function Debriefs({ lib, debriefs, loading }: { lib: SimLibrary; debriefs: SimDebriefView[]; loading: boolean }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const s = useSession();
  const repo = useRepo();
  const people = usePeople();
  const slots = useQuery('simulator_slots', () => repo.list('simulator_slots', { order: [['starts_at', 'desc']] }), []);
  const [open, setOpen] = useState<SimDebriefView | null>(null);
  const [form, setForm] = useState(false);
  const done = new Set(debriefs.map((d) => d.slot_id));
  const pending = debriefableSlots(slots.data ?? []).filter((x) => !done.has(x.id));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-3xl text-[13px] text-ink-2">{t('m04.scn.deb.intro')}</p>
        {s.can('sat', ['W', 'A']) && <button className="btn-primary btn-sm" onClick={() => setForm(true)} data-testid="m04-scn-deb-new">{t('m04.scn.deb.new')}</button>}
      </div>
      {pending.length > 0 && <Callout tone="sim" title={t('m04.scn.deb.pendingTitle', { n: pending.length })}>{t('m04.scn.deb.pendingBody')}</Callout>}
      <div data-testid="m04-scn-debriefs">
        <DataTable rows={debriefs} rowKey={(r) => r.id} csvName="crew-debriefs" onRowClick={setOpen} initialSort={{ key: 'when', dir: 'desc' }} empty={loading ? t('common.working') : t('m04.scn.deb.empty')} columns={[
          { key: 'when', header: t('m04.common.when'), value: (r) => r.held_on, sortable: true, render: (r) => f.date(r.held_on) },
          { key: 'crew', header: t('m04.common.crew'), value: (r) => r.crew, sortable: true },
          { key: 'scenario', header: t('m04.scn.deb.scenario'), value: (r) => `${r.scenario.code} ${pick(r.scenario, 'title')}`, render: (r) => <span><span className="ltr me-1 text-ink-3">{r.scenario.code}</span>{pick(r.scenario, 'title')}</span> },
          { key: 'instructor', header: t('m04.scn.deb.instructor'), value: (r) => people.name(r.instructor_person_id) },
          { key: 'present', header: t('m04.scn.deb.present'), value: (r) => r.members.filter((m) => m.present).length, align: 'end', render: (r) => `${f.num(r.members.filter((m) => m.present).length)} / ${f.num(r.members.length)}` },
          { key: 'mean', header: t('m04.scn.deb.mean'), value: (r) => meanScore(r.ratings), align: 'end', sortable: true, render: (r) => f.num(meanScore(r.ratings), { maximumFractionDigits: 2 }) },
          { key: 'source', header: t('m04.scn.deb.source'), value: (r) => r.source, render: (r) => <SourceChip source={r.source} evidence={r.members.reduce((n, m) => n + m.evidence, 0)} /> },
        ]} />
      </div>
      <DebriefDrawer d={open} onClose={() => setOpen(null)} />
      {form && <DebriefForm open onClose={() => setForm(false)} lib={lib} slots={slots.data ?? []} initialSlot={pending[0]?.id ?? null} />}
    </div>
  );
}

function Insights({ debriefs }: { debriefs: SimDebriefView[] }) {
  const t = useT();
  const f = useFormat();
  const l = useSimLabels();
  const ins = useMemo(() => crewInsights(debriefs.map(asDebriefLite)), [debriefs]);
  const quarters = useMemo(() => [...new Set(debriefs.map((d) => `${d.held_on.slice(0, 4)}-Q${Math.floor(Number(d.held_on.slice(5, 7)) / 3.01) + 1}`))].sort(), [debriefs]);
  if (!debriefs.length) return <p className="text-[13px] text-ink-2">{t('m04.scn.deb.empty')}</p>;
  return (
    <div className="space-y-4" data-testid="m04-scn-insights">
      <Callout tone="info" title={t('m04.scn.ins.title')}>{t('m04.scn.ins.body')}</Callout>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title={t('m04.scn.ins.heat')}>
          <Heatmap title={t('m04.scn.ins.heat')} rows={ins.map((x) => x.crew)} cols={[...DIMENSIONS]} rowLabel={(c) => `${t('m04.common.crew')} ${c}`} colLabel={(d) => l.dim(d)}
            value={(c, d) => { const v = ins.find((x) => x.crew === c)?.dims.find((x) => x.dimension === d)?.instructor ?? null; return { v, tone: v == null ? 'neutral' : v >= 4 ? 'ok' : v < 3 ? 'bad' : 'info', label: v == null ? '—' : f.num(v, { maximumFractionDigits: 1 }) }; }} />
        </Card>
        <Card title={t('m04.scn.ins.gap')}>
          <Heatmap title={t('m04.scn.ins.gap')} rows={ins.map((x) => x.crew)} cols={[...DIMENSIONS]} rowLabel={(c) => `${t('m04.common.crew')} ${c}`} colLabel={(d) => l.dim(d)}
            value={(c, d) => { const v = ins.find((x) => x.crew === c)?.dims.find((x) => x.dimension === d)?.gap ?? null; return { v: v == null ? null : Math.abs(v), tone: v == null ? 'neutral' : v > 0.4 ? 'sim' : v < -0.4 ? 'info' : 'ok', label: v == null ? '—' : `${v > 0 ? '+' : ''}${f.num(v, { maximumFractionDigits: 1 })}` }; }} />
          <p className="mt-2 text-[12px] text-ink-3">{t('m04.scn.ins.gapHint')}</p>
        </Card>
      </div>
      <Card title={t('m04.scn.ins.trend')}>
        <LineChart title={t('m04.scn.ins.trend')} yMin={1} yMax={5} series={DIMENSIONS.map((d) => ({
          name: l.dim(d),
          points: quarters.map((q) => {
            const ds = debriefs.filter((x) => `${x.held_on.slice(0, 4)}-Q${Math.floor(Number(x.held_on.slice(5, 7)) / 3.01) + 1}` === q);
            return { x: q, y: ds.length ? Math.round((ds.reduce((n, x) => n + (x.ratings[d] ?? 0), 0) / ds.length) * 10) / 10 : null };
          }),
        }))} />
      </Card>
    </div>
  );
}
