// /training/needs (F26): training needs and demand forecast per course per quarter, built from six sources (qualification expiries,
// role curriculum, KLRA cross-training actions, career roadmaps, accepted coach recommendations, future interest) and compared with
// capacity (scheduled sessions × seats, draft proposals, free simulator slots). Every demand number drills down to its sources and
// groups (sums match). Cells under 10 are suppressed in exports, and on screen for aggregate-only viewers, but always counted in
// totals. The training manager recomputes a quarter and proposes draft sessions (never published; the scheduler creates sessions
// in /training/schedule). The intake scenario (DNT, GPO cohorts) is SIMULATED and never stored.
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { Async, BarChart, Callout, Card, ConfirmDialog, DataTable, Drawer, EmptyState, Grid, Icon, Page, Section, SimChip, StatTile, StatusPill, WhyThis, downloadText, toCsv } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import { applyIntake, exportRows, SOURCES, type NeedsRow, type Source } from './needs';
import { SOURCE_ROUTES, Sup, useM25Labels, useM25Refs } from './ui';

const INTAKE_CHOICES = [0, 10, 20, 30, 40, 60];

export default function NeedsPage() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const refs = useM25Refs();
  const lab = useM25Labels(refs.data);
  const [period, setPeriod] = useState('');
  const [dnt, setDnt] = useState(0);
  const [gpo, setGpo] = useState(0);
  const [drill, setDrill] = useState<{ row: NeedsRow; source: Source } | null>(null);
  const [propose, setPropose] = useState<NeedsRow | null>(null);
  const [compute, setCompute] = useState(false);
  const q = useQuery(['demand_snapshots', 'session_proposals', 'sessions'], async () => {
    const r = await repo.rpc.demandReport(period || null);
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data;
  }, [period]);
  const proposals = useQuery(['session_proposals'], () => repo.list('session_proposals', { order: [['created_at', 'desc']] }).catch(() => []));
  const canPropose = s.can('learning_analytics', ['A']);
  const rep = useMemo(() => (q.data ? applyIntake(q.data, { dnt, gpo }, refs.data?.courses ?? []) : null), [q.data, dnt, gpo, refs.data]);

  const exportCsv = () => {
    if (!rep) return;
    const rows = exportRows(rep, (id) => lab.course(id));
    const cols = ['code', 'course', 'period', ...SOURCES, 'total', 'seats', 'draft_seats', 'shortfall'];
    downloadText(`training-needs-${rep.period}.csv`, `${t('m25.needs.csvNote', { n: MIN_GROUP_SIZE })}\r\n` + toCsv(rows, cols.map((k) => ({ key: k, header: k === 'code' || k === 'course' || k === 'period' ? t(`m25.needs.col.${k}`) : SOURCES.includes(k as Source) ? t(`m25.source.${k}.name`) : t(`m25.needs.col.${k}`), value: (r: Record<string, string>) => r[k] }))));
  };

  return (
    <Page
      title={t('m25.routes.training-needs.title')}
      intro={t('m25.needs.intro')}
      wide
      actions={
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={exportCsv} disabled={!rep} data-testid="m25-needs-export"><Icon name="download" />{t('m25.needs.export')}</button>
          {q.data?.can_compute && <button type="button" className="btn-primary btn-sm" onClick={() => setCompute(true)} data-testid="m25-needs-compute"><Icon name="reset" />{t('m25.needs.compute')}</button>}
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2" data-testid="m25-needs-labels">
        <span>{t('m25.needs.labels', { n: MIN_GROUP_SIZE })}</span>
      </div>
      <Async state={q}>
        {(d) => rep && (
          <>
            <Card>
              <div className="flex flex-wrap items-end gap-4" data-testid="m25-needs-controls">
                <label className="flex flex-col gap-1">
                  <span className="caps">{t('m25.needs.quarter')}</span>
                  <select className="input min-w-[140px]" value={d.period} onChange={(e) => setPeriod(e.target.value)} data-testid="m25-needs-period">
                    {d.periods.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <fieldset className="flex flex-wrap items-end gap-3 rounded-card border border-dashed border-sim-line p-2">
                  <legend className="flex items-center gap-1 px-1 text-[12px]"><SimChip label={t('common.simulated')} />{t('m25.needs.scenario')}</legend>
                  <label className="flex flex-col gap-1">
                    <span className="caps">{t('m25.needs.dnt')}</span>
                    <select className="input" value={dnt} onChange={(e) => setDnt(Number(e.target.value))} data-testid="m25-needs-dnt">{INTAKE_CHOICES.map((n) => <option key={n} value={n}>{f.num(n)}</option>)}</select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="caps">{t('m25.needs.gpo')}</span>
                    <select className="input" value={gpo} onChange={(e) => setGpo(Number(e.target.value))} data-testid="m25-needs-gpo">{INTAKE_CHOICES.map((n) => <option key={n} value={n}>{f.num(n)}</option>)}</select>
                  </label>
                  {rep.simulated && <button type="button" className="btn-ghost btn-sm" onClick={() => { setDnt(0); setGpo(0); }}>{t('m25.needs.reset')}</button>}
                </fieldset>
                <span className="ms-auto text-[12.5px] text-ink-3">{d.computed_at ? t('m25.needs.computedAt', { date: f.dateTime(d.computed_at) }) : t('m25.needs.notComputed')}</span>
              </div>
            </Card>
            {rep.simulated && <Callout tone="sim" title={t('m25.needs.simTitle')}>{t('m25.needs.simBody')}</Callout>}
            {!d.exact && <Callout tone="info" title={t('m25.needs.aggTitle')}>{t('m25.needs.aggBody', { n: MIN_GROUP_SIZE })}</Callout>}

            <Grid cols={4}>
              <StatTile label={t('m25.needs.tile.demand')} value={f.num(rep.total)} sub={t('m25.needs.tile.demandSub', { q: d.period })} sim={rep.simulated} />
              <StatTile label={t('m25.needs.tile.seats')} value={f.num(rep.seats)} sub={t('m25.needs.tile.seatsSub')} />
              <StatTile label={t('m25.needs.tile.shortfall')} value={f.num(rep.shortfall)} sub={t('m25.needs.tile.shortfallSub', { n: rep.short_courses })} tone={rep.shortfall > 0 ? 'bad' : 'ok'} sim={rep.simulated} />
              <StatTile label={t('m25.needs.tile.instructors')} value={f.num(d.instructors)} sub={t('m25.needs.tile.instructorsSub')} />
            </Grid>

            {rep.rows.length === 0 ? (
              <EmptyState title={t('m25.needs.empty')}>{d.can_compute ? t('m25.needs.emptyCompute') : null}</EmptyState>
            ) : (
              <>
                <Card title={t('m25.needs.chart')}>
                  <BarChart title={t('m25.needs.chart')} data={[...rep.rows].sort((a, b) => b.total - a.total).slice(0, 10).map((r) => ({ label: lab.course(r.course_id).code, value: r.total, tone: r.shortfall > 0 ? 'bad' : 'leaf' }))} />
                </Card>
                <Section title={t('m25.needs.table')} description={t('m25.needs.tableHint')}>
                  <DataTable<NeedsRow>
                    rows={rep.rows}
                    rowKey={(r) => r.course_id}
                    csvName={undefined}
                    initialSort={{ key: 'shortfall', dir: 'desc' }}
                    columns={[
                      { key: 'course', header: t('m25.common.course'), value: (r) => lab.course(r.course_id).title, sortable: true,
                        render: (r) => <div data-testid={`m25-needs-row-${r.course_id}`}><div className="font-semibold">{lab.course(r.course_id).title}</div><div className="ltr text-[12px] text-ink-3">{lab.course(r.course_id).code} · {t(`m25.modality.${r.modality}`)}</div></div> },
                      ...SOURCES.map((src) => ({
                        key: src, header: t(`m25.source.${src}.short`), value: (r: NeedsRow) => r.sources[src], sortable: true, align: 'end' as const,
                        render: (r: NeedsRow) => (r.detail[src].length ? (
                          <button type="button" className="btn-ghost btn-sm" onClick={() => setDrill({ row: r, source: src })} data-testid={`m25-drill-${r.course_id}-${src}`} aria-label={t('m25.needs.drillAria', { source: t(`m25.source.${src}.name`) })}><Sup v={r.sources[src]} /></button>
                        ) : <span className="text-ink-3">·</span>),
                      })),
                      ...(rep.simulated ? [{ key: 'intake', header: t('m25.needs.intake'), value: (r: NeedsRow) => rep.intake[r.course_id] ?? 0, align: 'end' as const, render: (r: NeedsRow) => (rep.intake[r.course_id] ? <span className="num text-sim">+{f.num(rep.intake[r.course_id])}</span> : <span className="text-ink-3">·</span>) }] : []),
                      { key: 'total', header: t('m25.needs.col.total'), value: (r) => r.total, sortable: true, align: 'end', render: (r) => <span className="num font-semibold">{f.num(r.total)}</span> },
                      { key: 'seats', header: t('m25.needs.col.seats'), value: (r) => r.seats, sortable: true, align: 'end', render: (r) => <span className="num">{f.num(r.seats)}{r.draft_seats ? <span className="block text-[11.5px] text-ink-3">{t('m25.needs.plusDraft', { n: r.draft_seats })}</span> : null}</span> },
                      { key: 'shortfall', header: t('m25.needs.col.shortfall'), value: (r) => r.shortfall, sortable: true, align: 'end',
                        render: (r) => (r.shortfall > 0 ? <StatusPill tone="bad">{f.num(r.shortfall)}</StatusPill> : <StatusPill tone="ok">{t('m25.needs.covered')}</StatusPill>) },
                      { key: 'why', header: '', csv: false, render: (r) => <WhyThis reasons={r.reasons} testId={`why-needs-${r.course_id}`} /> },
                      ...(canPropose ? [{ key: 'act', header: '', csv: false, render: (r: NeedsRow) => (r.shortfall > r.draft_seats && !rep.simulated ? <button type="button" className="btn-outline btn-sm" onClick={() => setPropose(r)} data-testid={`m25-propose-${r.course_id}`}>{t('m25.needs.propose')}</button> : null) }] : []),
                    ]}
                  />
                </Section>
              </>
            )}
          </>
        )}
      </Async>

      <Section title={t('m25.needs.drafts')} description={t('m25.needs.draftsHint')} actions={<L to="/training/schedule" className="link text-[13px]">{t('m25.needs.toSchedule')}</L>}>
        <Async state={proposals} isEmpty={(x) => x.length === 0} empty={<EmptyState title={t('m25.needs.noDrafts')} />}>
          {(ps) => (
            <ul className="space-y-2" data-testid="m25-drafts">
              {ps.map((p) => (
                <li key={p.id} className="card flex flex-wrap items-center gap-3 p-3">
                  <StatusPill tone={p.status === 'draft' ? 'neutral' : p.status === 'scheduled' ? 'ok' : 'bad'}>{t(`m25.proposal.${p.status}`)}</StatusPill>
                  <span className="font-semibold">{lab.course(p.course_id).title}</span>
                  <span className="text-[12.5px] text-ink-2">{t('m25.proposal.size', { n: p.sessions, seats: p.seats_each, q: p.period })}</span>
                  <span className="text-[12px] text-ink-3">{(p.dates ?? []).map((x) => f.date(x)).join(' · ')}</span>
                  {canPropose && p.status === 'draft' && <button type="button" className="btn-ghost btn-sm ms-auto" onClick={() => run(() => repo.rpc.withdrawProposal(p.id))} data-testid={`m25-withdraw-${p.id}`}>{t('m25.proposal.withdraw')}</button>}
                </li>
              ))}
            </ul>
          )}
        </Async>
      </Section>

      <Section title={t('m25.needs.sources')}>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="m25-sources">
          {SOURCES.map((src, i) => (
            <li key={src} className="rounded-card border border-line bg-panel p-3">
              <div className="flex items-center gap-2"><span className="num text-[12px] text-ink-3">{f.num(i + 1)}</span><span className="font-semibold">{t(`m25.source.${src}.name`)}</span></div>
              <p className="mt-1 text-[12.5px] text-ink-2">{t(`m25.source.${src}.rule`)}</p>
              <L to={SOURCE_ROUTES[src]} className="link text-[12.5px]">{t(`m25.source.${src}.link`)}</L>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-ink-3">{t('m25.needs.dedupe')}</p>
      </Section>

      {drill && (
        <Drawer open onClose={() => setDrill(null)} title={`${lab.course(drill.row.course_id).title} · ${t(`m25.source.${drill.source}.name`)}`}>
          <div className="space-y-3" data-testid="m25-drill">
            <p className="text-[13px] text-ink-2">{t(`m25.source.${drill.source}.rule`)}</p>
            <table className="w-full text-[13px]">
              <thead><tr><th className="border-b border-line p-1 text-start">{drill.source === 'klra' ? t('m25.needs.dept') : t('m25.needs.role')}</th><th className="border-b border-line p-1 text-end">{t('m25.needs.people')}</th></tr></thead>
              <tbody>
                {drill.row.detail[drill.source].map((x) => <tr key={x.key}><td className="border-b border-line p-1">{lab.group(x.key, drill.source)}</td><td className="border-b border-line p-1 text-end"><Sup v={x.count} /></td></tr>)}
                <tr><td className="p-1 font-semibold">{t('m25.needs.sum')}</td><td className="p-1 text-end font-semibold"><Sup v={drill.row.sources[drill.source]} /></td></tr>
              </tbody>
            </table>
            {q.data?.exact && <p className="text-[12px] text-ok" data-testid="m25-drill-sum">{t('m25.needs.sumsMatch')}</p>}
          </div>
        </Drawer>
      )}
      <ConfirmDialog
        open={!!propose}
        onClose={() => setPropose(null)}
        title={t('m25.needs.propose')}
        consequence={propose ? t('m25.needs.proposeConsequence', { course: lab.course(propose.course_id).title, n: propose.shortfall - propose.draft_seats, q: q.data?.period ?? '' }) : ''}
        confirmLabel={t('m25.needs.propose')}
        onConfirm={async () => { if (propose && q.data) await run(() => repo.rpc.proposeSessions(q.data!.period, propose.course_id, '')); setPropose(null); }}
      />
      <ConfirmDialog
        open={compute}
        onClose={() => setCompute(false)}
        title={t('m25.needs.compute')}
        consequence={t('m25.needs.computeConsequence', { q: q.data?.period ?? '' })}
        confirmLabel={t('m25.needs.compute')}
        onConfirm={async () => { if (q.data) await run(() => repo.rpc.computeDemand(q.data!.period)); setCompute(false); }}
      />
    </Page>
  );
}
