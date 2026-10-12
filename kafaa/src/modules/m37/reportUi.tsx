// FS62 report table (shared by the tag page and the report builder): one row per linked item with its kind, table, how it is linked
// (curated or derived from data), live status, the measure computed from the data (Agg/W/A; suppressed under 10) and <WhyThis> with the
// reasons; exports CSV and JSON of exactly what is shown, headed by the "computed from the data, not an official return" statement.
import { DataTable, StatusPill, WhyThis, downloadText, type Column } from '../../ui';
import { useLang, usePick, useT } from '../../i18n';
import { reportCsv, type NationalReport, type ReportItem } from './national';
import { BASIS_TONE, ItemLink, MeasureCell, STATUS_TONE, type NaRef } from './ui';

export function ReportTable({ r, d, showTag = true, fileBase }: { r: NationalReport; d: NaRef; showTag?: boolean; fileBase: string }) {
  const t = useT();
  const pick = usePick();
  const lang = useLang();
  const tagName = (id: string) => { const x = d.tags.find((y) => y.id === id); return x ? pick(x, 'name') : id; };
  const cols: Column<ReportItem>[] = [
    ...(showTag ? [{ key: 'tag', header: t('m37.col.tag'), value: (i: ReportItem) => tagName(i.tag_id), render: (i: ReportItem) => <span className="text-[12.5px]">{tagName(i.tag_id)}</span>, sortable: true }] : []),
    { key: 'kind', header: t('m37.col.kind'), value: (i) => t(`m37.kind.${i.kind}`), render: (i) => <span className="caps text-[10.5px] text-ink-3">{t(`m37.kind.${i.kind}`)}</span>, sortable: true },
    { key: 'item', header: t('m37.col.item'), value: (i) => pick(i as never, 'title'), sortable: true, render: (i) => (
      <span className="flex flex-col gap-0.5">
        <span className="font-semibold"><ItemLink item={i} /></span>
        <span className="text-[11.5px] text-ink-3">{t(`m37.table.${i.target_table}`)}</span>
        {(i.note_en || i.note_ar) && <span className="text-[12px] text-ink-2">{pick(i as never, 'note')}</span>}
      </span>) },
    { key: 'basis', header: t('m37.col.basis'), value: (i) => i.basis, render: (i) => <StatusPill tone={BASIS_TONE[i.basis]}>{t(`m37.basis.${i.basis}`)}</StatusPill> },
    { key: 'status', header: t('m37.col.status'), value: (i) => i.status, render: (i) => <StatusPill tone={STATUS_TONE[i.status]}>{t(`m37.itemStatus.${i.status}`)}</StatusPill> },
    ...(r.measures ? [{ key: 'measure', header: t('m37.col.measure'), align: 'end' as const, value: (i: ReportItem) => i.measure?.n ?? -1, render: (i: ReportItem) => <MeasureCell m={i.measure} testId="m37-measure" /> }] : []),
    { key: 'why', header: t('m37.col.why'), csv: false, render: (i) => <WhyThis reasons={i.reasons} testId="m37-why" /> },
  ];
  const head = t('m37.export.header');
  const csv = () => downloadText(`${fileBase}.csv`, `# ${head}\n${reportCsv(r, lang === 'ar' ? 'ar' : 'en', tagName)}\n`);
  const json = () => downloadText(`${fileBase}.json`, JSON.stringify({ note: head, ...r }, null, 2), 'application/json');
  return (
    <div className="space-y-2" data-testid="m37-report" data-items={r.items.length} data-measures={r.measures ? 'true' : 'false'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-ink-3" data-testid="m37-report-computed">{t('m37.report.computed', { n: String(r.items.length) })}</p>
        <div className="flex gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={csv} data-testid="m37-export-csv">{t('m37.export.csv')}</button>
          <button type="button" className="btn-ghost btn-sm" onClick={json} data-testid="m37-export-json">{t('m37.export.json')}</button>
        </div>
      </div>
      <div className="overflow-x-auto" data-testid="m37-report-table">
        <DataTable rows={r.items} columns={cols} rowKey={(i) => `${i.tag_id}|${i.target_table}|${i.target_id}`} pageSize={25} caption={t('m37.report.caption')} dense />
      </div>
    </div>
  );
}
