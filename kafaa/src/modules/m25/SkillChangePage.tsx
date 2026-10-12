// /training/skill-change (FS56): which learning actually moves skills. For every course and FS17 pathway with completions: the F01 level on
// each skill it teaches the day before the learning started and 90 days after completion (the completion record itself never counts), and a
// matched comparison where at least 10 colleagues with the same starting level form the pool. Items with fewer than 10 completers show only
// "suppressed"; items still inside their window say when the tenth window closes. Linked to the Kirkpatrick L3 results (F25). The training
// manager recomputes the table (rpc.computeSkillChange); everyone else reads the stored aggregates (rpc.skillChangeReport).
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import { useSession } from '../../auth/session';
import { Async, BarChart, BenchmarkChips, Callout, Card, ConfirmDialog, DataTable, Drawer, EmptyState, Grid, Icon, Page, Section, SimChip, StatTile, WhyThis } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import type { SkillChangeView } from './skillChange';
import { LevelShift, MethodChip, MethodTimeline, ScVerdict, useFs56Labels, useLv, useSigned } from './fs56ui';
import { Sup } from './ui';

const VERDICTS = ['moves', 'some', 'flat', 'window_open', 'suppressed'] as const;

export default function SkillChangePage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const labels = useFs56Labels();
  const lv = useLv();
  const signed = useSigned();
  const [kind, setKind] = useState<'all' | 'course' | 'pathway'>('all');
  const [verdict, setVerdict] = useState<string>('');
  const [open, setOpen] = useState<SkillChangeView | null>(null);
  const [confirm, setConfirm] = useState(false);
  const isTm = s.can('learning_analytics', ['A']);
  const q = useQuery(['skill_change_measures'], async () => {
    const r = await repo.rpc.skillChangeReport();
    if (!r.ok || !r.data) throw new Error(r.message);
    return r.data;
  });
  // Kirkpatrick L3 (F25) for the courses that have an evaluation design: same audience, read only to link the two views.
  const l3 = useQuery(['l3_observations', 'eval_surveys'], async () => {
    const r = await repo.rpc.effectivenessReport(null).catch(() => null);
    return new Map((r && r.ok && r.data ? r.data.cards : []).map((c) => [c.course_id, c]));
  });
  const rows = useMemo(() => (q.data?.rows ?? []).filter((r) => (kind === 'all' || r.kind === kind) && (!verdict || r.verdict === verdict)), [q.data, kind, verdict]);
  const effect = (r: SkillChangeView) => (r.net_x100 ?? r.change_x100);

  return (
    <Page
      title={t('m25.routes.training-skill-change.title')}
      intro={t('m25.sc.intro')}
      wide
      actions={
        <div className="flex flex-wrap gap-2">
          <L to="/training/effectiveness" className="btn-outline btn-sm" data-testid="m25-sc-to-eff"><Icon name="chart" />{t('m25.sc.toEff')}</L>
          <L to="/training/coverage" className="btn-outline btn-sm" data-testid="m25-sc-to-cov"><Icon name="filter" />{t('m25.sc.toCov')}</L>
          {isTm && <button type="button" className="btn-primary btn-sm" onClick={() => setConfirm(true)} data-testid="m25-sc-compute"><Icon name="reset" />{t('m25.sc.compute')}</button>}
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-2" data-testid="m25-sc-labels">
        <SimChip label={t('common.sample')} />
        <span>{t('m25.sc.labels', { n: 10, days: 90 })}</span>
      </div>
      <BenchmarkChips feature="FS56" />

      <Section title={t('m25.sc.methodTitle')} description={t('m25.sc.methodHint')}>
        <MethodTimeline />
      </Section>

      <Async state={q}>
        {(d) => {
          const all = d.rows;
          const measured = all.filter((r) => r.change_x100 !== null);
          const chart = measured.filter((r) => kind === 'all' || r.kind === kind).sort((a, b) => (effect(b) ?? 0) - (effect(a) ?? 0));
          return (
            <>
              <Grid cols={4}>
                <StatTile label={t('m25.sc.tile.measured')} value={`${f.num(measured.length)} / ${f.num(all.length)}`} sub={t('m25.sc.tile.measuredSub')} />
                <StatTile label={t('m25.sc.tile.moves')} value={f.num(all.filter((r) => r.verdict === 'moves').length)} sub={t('m25.sc.tile.movesSub')} tone="ok" />
                <StatTile label={t('m25.sc.tile.matched')} value={f.num(all.filter((r) => r.method === 'matched').length)} sub={t('m25.sc.tile.matchedSub')} />
                <StatTile label={t('m25.sc.tile.waiting')} value={`${f.num(all.filter((r) => r.verdict === 'window_open').length)} · ${f.num(all.filter((r) => r.verdict === 'suppressed').length)}`} sub={t('m25.sc.tile.waitingSub')} />
              </Grid>

              <Card>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="caps">{t('m25.sc.kind')}</span>
                    <div className="flex flex-wrap gap-1" role="group" aria-label={t('m25.sc.kind')}>
                      {(['all', 'course', 'pathway'] as const).map((k) => (
                        <button key={k} type="button" className={kind === k ? 'btn-primary btn-sm' : 'btn-outline btn-sm'} aria-pressed={kind === k} onClick={() => setKind(k)} data-testid={`m25-sc-kind-${k}`}>{t(`m25.sc.kinds.${k}`)}</button>
                      ))}
                    </div>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="caps">{t('m25.sc.verdictFilter')}</span>
                    <select className="input min-w-[180px]" value={verdict} onChange={(e) => setVerdict(e.target.value)} data-testid="m25-sc-verdict-filter">
                      <option value="">{t('m25.sc.allVerdicts')}</option>
                      {VERDICTS.map((v) => <option key={v} value={v}>{t(`m25.sc.verdict.${v}`)}</option>)}
                    </select>
                  </label>
                  <span className="ms-auto text-[12.5px] text-ink-3" data-testid="m25-sc-asof">{d.as_of ? t('m25.sc.asOf', { date: f.date(d.as_of), days: d.window_days }) : t('m25.sc.never')}</span>
                </div>
              </Card>

              <Section title={t('m25.sc.tableTitle')} description={t('m25.sc.tableHint')}>
                <div data-testid="m25-sc-table">
                  <DataTable<SkillChangeView>
                    rows={rows}
                    rowKey={(r) => r.id}
                    csvName="skill-change"
                    onRowClick={(r) => setOpen(r)}
                    empty={<EmptyState title={t('m25.sc.none')} />}
                    initialSort={{ key: 'effect', dir: 'desc' }}
                    columns={[
                      { key: 'item', header: t('m25.sc.col.item'), value: (r) => `${r.code ?? ''} ${pick(r, 'title')}`, sortable: true,
                        render: (r) => (
                          <div className="min-w-0" data-testid={`m25-sc-row-${r.item_id}`}>
                            <div className="font-semibold">{pick(r, 'title')}</div>
                            <div className="flex flex-wrap items-center gap-1 text-[12px] text-ink-3"><span className="rounded-full border border-line px-1.5">{t(`m25.sc.kinds.${r.kind}`)}</span>{r.code && <span className="ltr">{r.code}</span>}</div>
                          </div>
                        ) },
                      { key: 'completers', header: t('m25.sc.col.completers'), value: (r) => r.completers, render: (r) => <Sup v={r.completers} />, sortable: true },
                      { key: 'shift', header: t('m25.sc.col.shift'), value: (r) => r.change_x100, render: (r) => (r.suppressed ? <Sup v={null} /> : <LevelShift row={r} />) },
                      { key: 'moved', header: t('m25.sc.col.moved'), value: (r) => r.moved_pct, render: (r) => (r.moved_pct === null ? <span className="text-ink-3">—</span> : <span className="num">{f.num(r.moved_pct)}%</span>), sortable: true },
                      { key: 'comparison', header: t('m25.sc.col.comparison'), value: (r) => r.comparison_change_x100, render: (r) => (r.comparison_change_x100 === null ? <span className="text-[12px] text-ink-3">{r.change_x100 === null ? '—' : t('m25.sc.noGroup')}</span> : <span className="num">{signed(r.comparison_change_x100)}</span>) },
                      { key: 'effect', header: t('m25.sc.col.net'), value: (r) => effect(r), sortable: true,
                        render: (r) => (effect(r) === null ? <span className="text-ink-3">—</span> : <span className={`num font-semibold ${(effect(r) ?? 0) >= 25 ? 'text-ok' : ''}`} data-testid="m25-sc-net">{signed(effect(r))}</span>) },
                      { key: 'method', header: t('m25.sc.col.method'), value: (r) => r.method ?? '', render: (r) => <div className="flex flex-col gap-0.5"><MethodChip m={r.method} /><span className="text-[11.5px] text-ink-3" data-testid="m25-sc-window">{t('m25.sc.windowDays', { n: r.window_days })}</span></div> },
                      { key: 'l3', header: t('m25.sc.col.l3'), value: (r) => l3.data?.get(r.item_id)?.l3.applied ?? null,
                        render: (r) => {
                          const c = r.kind === 'course' ? l3.data?.get(r.item_id) : undefined;
                          if (!c) return <span className="text-ink-3">—</span>;
                          return <L to={`/training/effectiveness/${r.item_id}`} className="link text-[12.5px]" onClick={(e) => e.stopPropagation()} data-testid="m25-sc-l3">{c.l3.qualifying ? (c.l3.applied === null ? t('m25.common.suppressed') : `${f.num(c.l3.applied)}%`) : t('m25.sc.l3None')}</L>;
                        } },
                      { key: 'verdict', header: t('m25.sc.col.verdict'), value: (r) => r.verdict, render: (r) => <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}><ScVerdict v={r.verdict} /><WhyThis reasons={r.reasons} testId={`why-sc-${r.item_id}`} /></div> },
                    ]}
                  />
                </div>
              </Section>

              {chart.length > 0 && (
                <Grid cols={2}>
                  <Card title={t('m25.sc.chartEffect')}>
                    <BarChart title={t('m25.sc.chartEffect')} data={chart.map((r) => ({ label: pick(r, 'title'), value: Math.max(0, (effect(r) ?? 0) / 100), tone: r.verdict === 'moves' ? 'leaf' : r.verdict === 'some' ? 'accent' : 'sky' }))} max={2} target={0.25} />
                    <p className="mt-2 text-[12px] text-ink-3">{t('m25.sc.chartEffectNote')}</p>
                  </Card>
                  <Card title={t('m25.sc.readingTitle')}>
                    <ul className="list-disc space-y-1.5 ps-5 text-[13px] text-ink-2" data-testid="m25-sc-reading">
                      <li>{t('m25.sc.reading.own')}</li>
                      <li>{t('m25.sc.reading.matched')}</li>
                      <li>{t('m25.sc.reading.history')}</li>
                      <li>{t('m25.sc.reading.window')}</li>
                      <li>{t('m25.sc.reading.l3')}</li>
                    </ul>
                  </Card>
                </Grid>
              )}
            </>
          );
        }}
      </Async>

      <Callout tone="info" title={t('m25.sc.caveatTitle')}>{t('m25.sc.caveat')}</Callout>

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? pick(open, 'title') : ''}>
        {open && (
          <div className="space-y-4" data-testid="m25-sc-drawer">
            <div className="flex flex-wrap items-center gap-2"><ScVerdict v={open.verdict} /><MethodChip m={open.method} /><span className="text-[12.5px] text-ink-3">{t('m25.sc.windowDays', { n: open.window_days })}</span></div>
            <p className="text-[13px] text-ink-2" data-testid="m25-sc-drawer-method">{open.method ? t(`m25.sc.methodText.${open.method}`, { days: open.window_days }) : open.verdict === 'window_open' ? (open.next_on ? t('m25.sc.windowText', { date: f.date(open.next_on), days: open.window_days }) : t('m25.sc.windowTextNoDate', { days: open.window_days })) : t('m25.sc.suppressedText', { n: 10 })}</p>
            <dl className="grid grid-cols-2 gap-2 text-[13px]">
              <div><dt className="caps">{t('m25.sc.col.completers')}</dt><dd><Sup v={open.completers} /></dd></div>
              <div><dt className="caps">{t('m25.sc.measured')}</dt><dd><Sup v={open.measured} /></dd></div>
              <div><dt className="caps">{t('m25.sc.col.comparison')}</dt><dd>{open.comparison_people === null ? <span className="text-ink-3">{t('m25.sc.noGroup')}</span> : t('m25.sc.compPeople', { n: f.num(open.comparison_people), change: signed(open.comparison_change_x100) })}</dd></div>
              <div><dt className="caps">{t('m25.sc.col.net')}</dt><dd className="num font-semibold">{signed(effect(open))}</dd></div>
            </dl>
            <div>
              <div className="caps mb-1">{t('m25.sc.perSkill')}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]" data-testid="m25-sc-skills">
                  <thead><tr className="text-start text-ink-3"><th className="p-1 text-start">{t('m25.sc.skill')}</th><th className="p-1 text-start">{t('m25.sc.teaches')}</th><th className="p-1 text-start">{t('m25.sc.before')}</th><th className="p-1 text-start">{t('m25.sc.after')}</th><th className="p-1 text-start">{t('m25.sc.col.moved')}</th></tr></thead>
                  <tbody>
                    {open.skills.map((k) => (
                      <tr key={k.skill_id} className="border-t border-line">
                        <td className="p-1"><L to={`/skills/${k.skill_id}`} className="link">{labels.skill(k.skill_id)}</L></td>
                        <td className="p-1 num">{t('m25.sc.levelN', { n: k.level })}</td>
                        <td className="p-1 num">{k.pairs === null ? <Sup v={null} /> : lv(k.before_x100)}</td>
                        <td className="p-1 num">{k.pairs === null ? <Sup v={null} /> : lv(k.after_x100)}</td>
                        <td className="p-1 num">{k.moved_pct === null ? '—' : `${f.num(k.moved_pct)}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {open.kind === 'course'
                ? <><L to={`/learn/course/${open.item_id}`} className="btn-outline btn-sm">{t('m25.sc.openCourse')}</L>{l3.data?.get(open.item_id) && <L to={`/training/effectiveness/${open.item_id}`} className="btn-outline btn-sm" data-testid="m25-sc-drawer-l3">{t('m25.sc.openL3')}</L>}</>
                : <L to={`/learn/pathways/${open.item_id}`} className="btn-outline btn-sm">{t('m25.sc.openPathway')}</L>}
            </div>
            <WhyThis reasons={open.reasons} testId="why-sc-drawer" />
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('m25.sc.compute')}
        consequence={t('m25.sc.computeConsequence')}
        confirmLabel={t('m25.sc.compute')}
        onConfirm={async () => { await run(() => repo.rpc.computeSkillChange()); setConfirm(false); }}
      />
    </Page>
  );
}
