// /talent/review/insights (M23 · F18): HR aggregates of placements (talent_review Agg/R/A). Every cell under the minimum group
// size is suppressed, including the women and Emirati splits; the CSV export carries the same suppressed values, never names.
import { useState } from 'react';
import { Page, Section, Card, Async, Callout, Grid, StatTile, SelectField, DataTable, Icon, downloadText, type Column, ScrollRegion } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { ConfidentialNote, unwrap } from './ui';
import type { CycleSummary, TalentAggregates } from './backend/rpc';

export default function TalentInsightsPage() {
  const t = useT();
  const repo = useRepo();
  const pick = usePick();
  const [cycle, setCycle] = useState('');
  const cycles = useQuery(['review_cycles'], () => repo.rpc.talentCycles().then((r) => (r.ok ? r.data ?? [] : [])), []);
  const q = useQuery(['review_placements', 'review_cycles'], () => unwrap<TalentAggregates>(repo.rpc.talentAggregates(cycle || null)), [cycle]);
  return (
    <Page title={t('m23.routes.talent-review-insights.title')} intro={t('m23.ins.intro')} eyebrow={<L to="/talent/review">{t('m23.common.back')}</L>} wide>
      <ConfidentialNote>{t('m23.ins.note')}</ConfidentialNote>
      <div className="max-w-sm">
        <SelectField label={t('m23.ins.cycle')} name="cycle" value={cycle} onChange={setCycle}
          options={[{ value: '', label: t('m23.ins.allCycles') }, ...((cycles.data ?? []) as CycleSummary[]).map((c) => ({ value: c.id, label: `${pick(c, 'title')} (${c.period})` }))]} />
      </div>
      <Async state={q}>{(a) => <Body a={a} cycles={(cycles.data ?? []) as CycleSummary[]} />}</Async>
    </Page>
  );
}

function Body({ a, cycles }: { a: TalentAggregates; cycles: CycleSummary[] }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const S = t('m23.ins.suppressed');
  const v = (n: number | null) => (n == null ? S : f.num(n));
  const exportCsv = () => {
    const rows = [['box', 'label', 'people', 'women', 'emirati'], ...a.cells.map((c) => [c.box, t(`m23.box.${c.box}`), c.n ?? 'suppressed', c.women ?? 'suppressed', c.emirati ?? 'suppressed'])];
    downloadText(`talent-review-aggregates-${a.cycle_id ?? 'all'}.csv`, rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n'));
  };
  type ByCycle = TalentAggregates['by_cycle'][number];
  const cols: Column<ByCycle>[] = [
    { key: 'cycle', header: t('m23.ins.cycle'), value: (r) => { const c = cycles.find((x) => x.id === r.cycle_id); return c ? pick(c, 'title') : r.cycle_id; } },
    { key: 'n', header: t('m23.ins.placed'), value: (r) => r.placed ?? -1, align: 'end', render: (r) => <span className="num">{v(r.placed)}</span> },
    { key: 'cal', header: t('m23.ins.calibrated'), value: (r) => r.calibrated ?? -1, align: 'end', render: (r) => <span className="num">{v(r.calibrated)}</span> },
  ];
  return (
    <>
      {a.suppressed && <Callout tone="sim" title={t('m23.ins.allSuppressed')}>{t('m23.ins.allSuppressedBody', { n: f.num(a.min_group) })}</Callout>}
      <Grid cols={4}>
        <StatTile label={t('m23.ins.placed')} value={v(a.n)} />
        <StatTile label={t('m23.ins.hipo')} value={v(a.hipo)} tone="ok" />
        <StatTile label={t('m23.ins.women')} value={v(a.women)} sub={t('m23.ins.minGroup', { n: f.num(a.min_group) })} />
        <StatTile label={t('m23.ins.emirati')} value={v(a.emirati)} sub={t('m23.ins.minGroup', { n: f.num(a.min_group) })} />
      </Grid>
      <Card title={t('m23.ins.grid')} actions={<button className="btn-outline btn-sm" onClick={exportCsv} data-testid="m23-ins-export"><Icon name="download" size={14} />{t('m23.ins.export')}</button>}>
        <ScrollRegion label={t('m23.ins.grid')} className="overflow-x-auto">
          <table className="w-full min-w-[520px] table-fixed border-separate border-spacing-1.5" data-testid="m23-ins-grid">
            <caption className="sr-only">{t('m23.ins.grid')}</caption>
            <thead><tr><th className="w-20" />{[1, 2, 3].map((p) => <th key={p} scope="col" className="caps text-center">{t(`m23.perf.${p}`)}</th>)}</tr></thead>
            <tbody>
              {[3, 2, 1].map((pot) => (
                <tr key={pot}>
                  <th scope="row" className="caps text-start align-top">{t(`m23.pot.${pot}`)}</th>
                  {[1, 2, 3].map((perf) => {
                    const c = a.cells.find((x) => x.box === (pot - 1) * 3 + perf)!;
                    return (
                      <td key={perf} className={`rounded-card border p-2 align-top ${c.n == null ? 'border-line bg-sunken' : 'border-line bg-panel'}`} data-testid="m23-ins-cell" data-suppressed={c.n == null}>
                        <div className="text-[11.5px] font-semibold text-ink-2">{t(`m23.box.${c.box}`)}</div>
                        <div className="num text-[20px] font-semibold">{c.n == null ? <span className="text-[12px] text-ink-3">{S}</span> : f.num(c.n)}</div>
                        <div className="text-[11.5px] text-ink-3">{t('m23.ins.cellSplit', { women: v(c.women), emirati: v(c.emirati) })}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
        <p className="mt-2 text-[12px] text-ink-3">{t('m23.ins.gridNote', { n: f.num(a.min_group) })}</p>
      </Card>
      <Section title={t('m23.ins.byCycle')}>
        <DataTable rows={a.by_cycle} columns={cols} rowKey={(r) => r.cycle_id} searchable={false} caption={t('m23.ins.byCycle')} />
      </Section>
    </>
  );
}
