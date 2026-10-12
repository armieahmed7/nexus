// FS62 /national/report (national_alignment R/Agg/W/A): "every report is a filter, not a writing exercise". Choose a strategy, a tag and
// an item kind; the national report RPC filters the live data (nationalReport = kafaa_na_report_core) and the page shows the tags in scope
// with their counts, a chart, and the items with their status, link basis, measures (HR and admins; suppressed under 10) and reasons.
// Exports CSV, JSON and a print view of exactly what is shown. Nothing on this page is typed or stored: change the data and the report follows.
import { useMemo } from 'react';
import { Page, Section, Async, BarChart, BenchmarkChips, EmptyState, FilterBar, useFilters, StatTile, DataTable, type Column } from '../../ui';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { ITEM_KINDS, STRATEGIES, type TagSummary } from './national';
import { ReportTable } from './reportUi';
import { NotGovernmentCallout, SourceStanding, useNaRef } from './ui';

export default function NationalReportPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const ref = useNaRef();
  const [flt, setFlt] = useFilters({ strategy: '', tag: '', kind: '' }, true);
  const filter = useMemo(() => ({ strategy: flt.strategy || null, tag_id: flt.tag || null, kind: flt.kind || null }), [flt.strategy, flt.tag, flt.kind]);
  const rep = useQuery(['national_tags', 'tag_links', 'skills', 'person_skills'], () => repo.rpc.nationalReport(filter), [JSON.stringify(filter)]);
  return (
    <Page title={t('m37.routes.national-report.title')} intro={t('m37.report.intro')} wide eyebrow={<BenchmarkChips feature="FS62" />}
      actions={<button type="button" className="btn-ghost btn-sm" onClick={() => window.print()} data-testid="m37-report-print">{t('m37.export.print')}</button>}>
      <Async state={ref}>{(d) => {
        const tagOpts = d.tags.filter((x) => x.status === 'active' && (!flt.strategy || x.strategy === flt.strategy)).map((x) => ({ value: x.id, label: `${x.parent_id ? '· ' : ''}${pick(x, 'name')}` }));
        const name = (id: string) => { const x = d.tags.find((y) => y.id === id); return x ? pick(x, 'name') : id; };
        const sumCols: Column<TagSummary>[] = [
          { key: 'tag', header: t('m37.col.tag'), value: (s) => name(s.tag_id), render: (s) => <L to={`/national/alignment/${s.tag_id}`} className={s.parent_id ? 'ps-4' : 'font-semibold'}>{name(s.tag_id)}</L> },
          { key: 'source', header: t('m37.col.source'), csv: false, render: (s) => { const x = d.tags.find((y) => y.id === s.tag_id); return x ? <SourceStanding tag={x} compact /> : null; } },
          { key: 'skills', header: t('m37.count.skills'), align: 'end', value: (s) => s.skills, render: (s) => <span className="num">{f.num(s.skills)}</span> },
          { key: 'programmes', header: t('m37.count.programmes'), align: 'end', value: (s) => s.programmes, render: (s) => <span className="num">{f.num(s.programmes)}</span> },
          { key: 'targets', header: t('m37.count.targets'), align: 'end', value: (s) => s.targets, render: (s) => <span className="num">{f.num(s.targets)}</span> },
          { key: 'reach', header: t('m37.hub.reach'), align: 'end', value: (s) => s.reach ?? -1, render: (s) => <span className="num" data-suppressed={s.reach == null ? 'true' : 'false'}>{s.reach == null ? (rep.data?.measures ? t('common.suppressedShort') : '—') : f.num(s.reach)}</span> },
        ];
        return (
          <div className="space-y-6" data-testid="m37-report-page">
            <FilterBar value={flt} onChange={(v) => setFlt(v.strategy !== undefined && v.strategy !== flt.strategy ? { ...v, tag: '' } : v)} fields={[
              { key: 'strategy', label: t('m37.filter.strategy'), options: STRATEGIES.map((s) => ({ value: s, label: t(`m37.strategy.${s}`) })) },
              { key: 'tag', label: t('m37.filter.tag'), options: tagOpts },
              { key: 'kind', label: t('m37.filter.kind'), options: ITEM_KINDS.map((k) => ({ value: k, label: t(`m37.kind.${k}`) })) },
            ]} />
            <Async state={rep} isEmpty={(x) => !x} empty={<EmptyState title={t('m37.none')} />}>{(r) => {
              if (!r) return null;
              const uniq = (k: string) => new Set(r.items.filter((i) => i.kind === k).map((i) => `${i.target_table}|${i.target_id}`)).size;
              const chartRows = r.tags.filter((s) => (r.filter.tag_id || r.filter.strategy ? true : s.kind === 'strategy'));
              return (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="m37-report-tiles">
                    <StatTile label={t('m37.report.tile.tags')} value={f.num(r.tags.length)} />
                    <StatTile label={t('m37.count.skills')} value={f.num(uniq('skill'))} tone="info" />
                    <StatTile label={t('m37.count.programmes')} value={f.num(uniq('programme'))} />
                    <StatTile label={t('m37.count.targets')} value={f.num(uniq('target'))} tone="ok" />
                  </div>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <Section title={t('m37.report.scopeTitle')}>
                      <div className="overflow-x-auto" data-testid="m37-report-scope"><DataTable rows={r.tags} columns={sumCols} rowKey={(s) => s.tag_id} searchable={false} pageSize={25} caption={t('m37.report.scopeTitle')} dense /></div>
                    </Section>
                    <Section title={t('m37.report.chartTitle')}>
                      <div data-testid="m37-report-chart"><BarChart title={t('m37.report.chartTitle')} data={chartRows.map((s) => ({ label: name(s.tag_id), value: s.skills + s.programmes + s.targets }))} /></div>
                    </Section>
                  </div>
                  <Section title={t('m37.report.itemsTitle')} description={t('m37.report.itemsIntro')}>
                    {r.items.length ? <ReportTable r={r} d={d} fileBase={`kafaa-national-report${r.filter.strategy ? `-${r.filter.strategy}` : ''}`} /> : <EmptyState title={t('m37.tag.noItems')} />}
                    {!r.measures && <p className="mt-2 text-[12.5px] text-ink-3">{t('m37.report.noMeasures')}</p>}
                  </Section>
                </div>
              );
            }}</Async>
            <NotGovernmentCallout />
          </div>
        );
      }}</Async>
    </Page>
  );
}
