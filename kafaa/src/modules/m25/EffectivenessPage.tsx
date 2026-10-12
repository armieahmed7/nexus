// /training/effectiveness (F25): Kirkpatrick scorecard for every course with an evaluation design. L1 reaction, L2 learning gain
// (released attempts only), L3 behaviour on the job (supervisor observations 90 days after qualifying courses) and L4 SAMPLE KPIs
// (association, not causation). Every value from a group under 10 is "suppressed" (rpc.effectivenessReport). Training managers
// schedule L3 observations and flag courses for redesign (the flag feeds the F27 SAT workbench). Committee pack: CSV or print.
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { Async, BarChart, Callout, Card, ConfirmDialog, DataTable, EmptyState, Grid, Icon, Modal, Page, Section, SimChip, StatTile, StatusPill, WhyThis, downloadText, toCsv } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import { COMMITTEES, packRows, type CourseCard, type PackRow } from './eff';
import { KirkpatrickLegend, LevelDots, ScoreBar, Sup, TrendChip, VerdictPill, useM25Labels, useM25Refs } from './ui';

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

export default function EffectivenessPage() {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const refs = useM25Refs();
  const lab = useM25Labels(refs.data);
  const [committee, setCommittee] = useState('');
  const [withData, setWithData] = useState(true);
  const [pack, setPack] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const isTm = s.can('learning_analytics', ['A']);
  const q = useQuery(['eval_responses', 'l3_observations', 'redesign_flags', 'attempts', 'course_kpi_links'], async () => {
    const r = await repo.rpc.effectivenessReport(null);
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data;
  });
  const flags = useQuery(['redesign_flags'], () => repo.list('redesign_flags', { order: [['raised_at', 'desc']] }));

  const rows = useMemo(() => (q.data?.cards ?? []).filter((c) => (!committee || c.committee === committee) && (!withData || c.levels > 0)), [q.data, committee, withData]);
  const shown = (q.data?.cards ?? []).filter((c) => !committee || c.committee === committee);
  const rel = shown.map((c) => c.l1.items.relevance).filter((v): v is number => v !== null);
  const gain = shown.map((c) => c.l2.norm_gain).filter((v): v is number => v !== null);
  const applied = shown.map((c) => c.l3.applied).filter((v): v is number => v !== null);

  return (
    <Page
      title={t('m25.routes.training-effectiveness.title')}
      intro={t('m25.eff.intro')}
      wide
      actions={
        <div className="flex flex-wrap gap-2">
          <L to="/training/observations" className="btn-outline btn-sm" data-testid="m25-to-l3"><Icon name="check" />{t('m25.eff.toL3')}</L>
          <L to="/training/skill-change" className="btn-outline btn-sm" data-testid="m25-to-skill-change"><Icon name="chart" />{t('m25.sc.card.link')}</L>
          <button type="button" className="btn-outline btn-sm" onClick={() => setPack(true)} disabled={!q.data} data-testid="m25-pack-open"><Icon name="download" />{t('m25.pack.open')}</button>
          {isTm && <button type="button" className="btn-primary btn-sm" onClick={() => setConfirm(true)} data-testid="m25-schedule-l3"><Icon name="calendar" />{t('m25.eff.scheduleL3')}</button>}
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2" data-testid="m25-eff-labels">
        <SimChip label={t('common.sample')} />
        <span>{t('m25.eff.labels', { n: MIN_GROUP_SIZE })}</span>
      </div>
      <KirkpatrickLegend />

      <Async state={q}>
        {(d) => (
          <>
            <Grid cols={4}>
              <StatTile label={t('m25.eff.tile.courses')} value={`${f.num(shown.filter((c) => c.levels > 0).length)} / ${f.num(shown.length)}`} sub={t('m25.eff.tile.coursesSub')} />
              <StatTile label={t('m25.eff.tile.relevance')} value={avg(rel) === null ? t('m25.common.suppressed') : f.num(avg(rel)! / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sub={t('m25.eff.tile.relevanceSub')} />
              <StatTile label={t('m25.eff.tile.gain')} value={avg(gain) === null ? t('m25.common.suppressed') : `${f.num(avg(gain)!)}%`} sub={t('m25.eff.tile.gainSub')} />
              <StatTile label={t('m25.eff.tile.applied')} value={avg(applied) === null ? t('m25.common.suppressed') : `${f.num(avg(applied)!)}%`} sub={t('m25.eff.tile.appliedSub')} tone={avg(applied) !== null && avg(applied)! < 70 ? 'bad' : undefined} />
            </Grid>

            <Card>
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex flex-col gap-1">
                  <span className="caps">{t('m25.eff.committee')}</span>
                  <select className="input min-w-[200px]" value={committee} onChange={(e) => setCommittee(e.target.value)} data-testid="m25-committee">
                    <option value="">{t('m25.eff.allCommittees')}</option>
                    {COMMITTEES.map((c) => <option key={c} value={c}>{lab.committee(c)}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={withData} onChange={(e) => setWithData(e.target.checked)} data-testid="m25-with-data" />
                  {t('m25.eff.withData')}
                </label>
                <span className="ms-auto text-[12.5px] text-ink-3">{t('m25.eff.asOf', { date: f.date(d.as_of) })}</span>
              </div>
            </Card>

            <Section title={t('m25.eff.scorecard')} description={t('m25.eff.scorecardHint')}>
              <DataTable<CourseCard>
                rows={rows}
                rowKey={(r) => r.course_id}
                csvName="training-effectiveness"
                empty={<EmptyState title={t('m25.eff.none')} />}
                columns={[
                  { key: 'course', header: t('m25.common.course'), value: (r) => `${lab.course(r.course_id).code} ${lab.course(r.course_id).title}`, sortable: true,
                    render: (r) => <L to={`/training/effectiveness/${r.course_id}`} className="link" data-testid={`m25-course-${r.course_id}`}><div className="font-semibold">{lab.course(r.course_id).title}</div><div className="ltr text-[12px] text-ink-3">{lab.course(r.course_id).code}</div></L> },
                  { key: 'committee', header: t('m25.eff.committee'), value: (r) => lab.committee(r.committee), sortable: true },
                  { key: 'levels', header: t('m25.eff.levels'), value: (r) => r.levels, render: (r) => <LevelDots card={r} />, sortable: true },
                  { key: 'l1', header: t('m25.eff.l1'), value: (r) => r.l1.items.relevance, render: (r) => <ScoreBar v10={r.l1.items.relevance} />, sortable: true },
                  { key: 'rec', header: t('m25.eff.recommend'), value: (r) => r.l1.recommend, render: (r) => <Sup v={r.l1.recommend} pct />, sortable: true },
                  { key: 'l2', header: t('m25.eff.l2'), value: (r) => r.l2.norm_gain, render: (r) => (r.l2.forms ? <Sup v={r.l2.norm_gain} pct /> : <span className="text-ink-3">—</span>), sortable: true },
                  { key: 'l3', header: t('m25.eff.l3'), value: (r) => r.l3.applied, render: (r) => (r.l3.qualifying ? <Sup v={r.l3.applied} pct /> : <span className="text-ink-3">—</span>), sortable: true },
                  { key: 'l4', header: t('m25.eff.l4'), value: (r) => r.l4.kpis.map((k) => k.trend).join(' '), render: (r) => (r.l4.kpis.length ? <div className="flex flex-wrap gap-1">{r.l4.kpis.map((k) => <TrendChip key={k.id} k={k} />)}</div> : <span className="text-ink-3">—</span>) },
                  { key: 'verdict', header: t('m25.eff.verdict'), value: (r) => (r.redesign ? 'redesign' : 'ok'), render: (r) => <div className="flex items-center gap-1"><VerdictPill card={r} /><WhyThis reasons={r.reasons} testId={`why-${r.course_id}`} /></div> },
                ]}
              />
            </Section>

            {(() => {
              const top = shown.filter((c) => c.l1.items.relevance !== null).sort((a, b) => (b.l1.items.relevance ?? 0) - (a.l1.items.relevance ?? 0));
              return top.length ? (
                <Grid cols={2}>
                  <Card title={t('m25.eff.chartRelevance')}>
                    <BarChart title={t('m25.eff.chartRelevance')} data={top.map((c) => ({ label: lab.course(c.course_id).code, value: (c.l1.items.relevance ?? 0) / 10, tone: c.redesign ? 'bad' : 'accent' }))} max={5} target={3.5} />
                  </Card>
                  <Card title={t('m25.eff.chartGain')}>
                    <BarChart title={t('m25.eff.chartGain')} data={shown.filter((c) => c.l2.forms).map((c) => ({ label: lab.course(c.course_id).code, value: c.l2.norm_gain, suppressed: c.l2.norm_gain === null, tone: (c.l2.norm_gain ?? 100) < 30 ? 'bad' : 'leaf' }))} unit="%" max={100} target={30} />
                  </Card>
                </Grid>
              ) : null;
            })()}
          </>
        )}
      </Async>

      <Section title={t('m25.flags.title')} description={t('m25.flags.hint')}>
        <Async state={flags} isEmpty={(x) => x.length === 0} empty={<EmptyState title={t('m25.flags.none')} />}>
          {(fl) => (
            <ul className="space-y-2" data-testid="m25-flags">
              {fl.map((x) => (
                <li key={x.id} className="card flex flex-wrap items-start gap-3 p-3">
                  <StatusPill tone={x.status === 'open' ? 'sim' : 'neutral'}>{t(`m25.flags.status.${x.status}`)}</StatusPill>
                  <div className="min-w-0 flex-1">
                    <L to={`/training/effectiveness/${x.course_id}`} className="link font-semibold">{lab.course(x.course_id).title}</L>
                    <p className="text-[13px] text-ink-2">{x.note}</p>
                    <p className="text-[12px] text-ink-3">{t('m25.flags.by', { name: x.raised_by_name || '—', date: f.date(x.raised_at) })}</p>
                  </div>
                  <WhyThis reasons={(x.reasons as never) ?? []} testId={`why-flag-${x.id}`} />
                </li>
              ))}
            </ul>
          )}
        </Async>
      </Section>

      <Callout tone="info" title={t('m25.eff.notAuthorityTitle')}>{t('m25.eff.notAuthority')}</Callout>

      <CommitteePack open={pack} onClose={() => setPack(false)} cards={q.data?.cards ?? []} initial={committee} lab={lab} />
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('m25.eff.scheduleL3')}
        consequence={t('m25.eff.scheduleL3Consequence')}
        confirmLabel={t('m25.eff.scheduleL3')}
        onConfirm={async () => { await run(() => repo.rpc.scheduleL3(null)); setConfirm(false); }}
      />
    </Page>
  );
}

/** Committee pack: one discipline's scorecard as CSV or a printable page. Cells under 10 print "<10". */
function CommitteePack({ open, onClose, cards, initial, lab }: { open: boolean; onClose: () => void; cards: CourseCard[]; initial: string; lab: ReturnType<typeof useM25Labels> }) {
  const t = useT();
  const f = useFormat();
  const [c, setC] = useState(initial || 'operations');
  const list = cards.filter((x) => x.committee === c);
  const rows = packRows(list, (id) => lab.course(id), (k) => `${k.label_en}: ${k.trend}`, t('m25.common.yes'), t('m25.common.no'));
  const cols: { key: keyof PackRow; header: string }[] = (['code', 'course', 'completions', 'l1_n', 'relevance', 'recommend', 'l2_pairs', 'gain', 'l3_done', 'applied', 'kpis', 'redesign'] as const).map((k) => ({ key: k, header: t(`m25.pack.col.${k}`) }));
  const csv = () => downloadText(`committee-pack-${c}.csv`, `${t('m25.pack.csvNote', { n: MIN_GROUP_SIZE })}\r\n` + toCsv(rows, cols.map((x) => ({ key: x.key, header: x.header, value: (r: PackRow) => r[x.key] }))));
  return (
    <Modal open={open} onClose={onClose} title={t('m25.pack.title')} size="lg"
      footer={<div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-outline" onClick={() => window.print()} data-testid="m25-pack-print"><Icon name="book" />{t('m25.pack.print')}</button>
        <button type="button" className="btn-primary" onClick={csv} disabled={!rows.length} data-testid="m25-pack-csv"><Icon name="download" />{t('m25.pack.csv')}</button>
      </div>}>
      <div className="space-y-3" data-testid="m25-pack">
        <label className="flex flex-col gap-1">
          <span className="caps">{t('m25.eff.committee')}</span>
          <select className="input" value={c} onChange={(e) => setC(e.target.value)} data-testid="m25-pack-committee">
            {COMMITTEES.map((k) => <option key={k} value={k}>{lab.committee(k)}</option>)}
          </select>
        </label>
        <p className="text-[12.5px] text-ink-2">{t('m25.pack.intro', { n: MIN_GROUP_SIZE, date: f.date(new Date()) })}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead><tr>{cols.map((x) => <th key={x.key} className="border-b border-line p-1 text-start">{x.header}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => <tr key={i}>{cols.map((x) => <td key={x.key} className="border-b border-line p-1 align-top">{r[x.key]}</td>)}</tr>)}
              {!rows.length && <tr><td colSpan={cols.length} className="p-2 text-ink-3">{t('m25.pack.empty')}</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-ink-3">{t('m25.pack.caveat')}</p>
      </div>
    </Modal>
  );
}
