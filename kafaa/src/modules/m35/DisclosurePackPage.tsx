// FS60 /workforce/disclosure/:period/pack (workforce_strategy R/W/A): the print view of one quarter's ISO 30414 skills disclosure pack.
// Built with buildPack (disclosure.ts): only approved lines carry a value, a narrative and a variance explanation; the rest read "not
// published". Every page of the print is labelled SIMULATED and states that Kafa'a is not an auditor. CSV and JSON downloads.
import { useParams } from 'react-router-dom';
import { Page, Async, EmptyState, ErrorState, Callout, SimChip, StatusPill, BenchmarkChips } from '../../ui';
import { L, useFormat, useLang, usePick, useT } from '../../i18n';
import { buildPack, type Pack } from './disclosure';
import { EquityCells, ExportButtons, useHc, usePeople, usePersonName, useValueText } from './fs60ui';
import type { Row } from './ui';

export default function DisclosurePackPage() {
  const t = useT();
  const { period = '' } = useParams();
  const hc = useHc();
  return (
    <Page title={t('m35.hcp.title', { p: period })} intro={t('m35.hcp.intro')} wide
      eyebrow={<div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><BenchmarkChips feature="FS60" /><SimChip /></div>}
      actions={<L to="/workforce/disclosure" className="btn-ghost btn-sm no-underline print:hidden">{t('m35.hcm.back')}</L>}>
      <Async state={hc} isEmpty={(d) => d.metrics.length === 0} empty={<EmptyState title={t('m35.hc.noMetrics')} />}>{(d) => {
        const row = d.disclosures.find((x) => x.period === period);
        return row ? <PackView row={row} metrics={d.metrics} /> : <ErrorState title={t('m35.hcp.notFound')} />;
      }}</Async>
    </Page>
  );
}

function PackView({ row, metrics }: { row: Row; metrics: Row[] }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const pick = usePick();
  const vt = useValueText();
  const people = usePeople();
  const name = usePersonName(people.data);
  const pack: Pack = buildPack(row, metrics);
  return (
    <div className="space-y-5" data-testid="m35-pack" data-period={pack.period} data-status={pack.status}>
      <div className="flex flex-wrap gap-2 print:hidden">
        <ExportButtons row={row} metrics={metrics} />
        <button type="button" className="btn-outline btn-sm" onClick={() => window.print()} data-testid="m35-pack-print">{t('m35.hcp.print')}</button>
      </div>
      <Callout tone="sim" title={t('m35.hcp.simulated')}><span data-testid="m35-pack-statement">{lang === 'ar' ? pack.statement_ar : pack.statement_en}</span></Callout>
      <div className="card space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[16px] font-semibold">{t('m35.hcm.areaName')}</h2>
          <StatusPill tone={pack.status === 'published' ? 'ok' : 'info'}>{t(`m35.hc.status.${pack.status}`)}</StatusPill>
          <span className="num rounded bg-sunken px-1.5 py-0.5 text-[11.5px]">{pack.method}</span>
        </div>
        <p className="text-[12.5px] text-ink-2">{t('m35.hcp.asOf', { date: f.date(pack.as_of), n: pack.headcount == null ? t('common.suppressedShort') : f.num(pack.headcount) })}</p>
        <h3 className="caps pt-2">{t('m35.hc.materiality')}</h3>
        <p className="text-[13px]">{lang === 'ar' ? pack.materiality_ar : pack.materiality_en}</p>
      </div>
      <table className="w-full text-[13px]" data-testid="m35-pack-table">
        <caption className="sr-only">{t('m35.hcp.title', { p: pack.period })}</caption>
        <thead><tr className="text-ink-3"><th scope="col" className="py-1 text-start">{t('m35.hcp.col.metric')}</th><th scope="col" className="py-1 text-end">{t('m35.hcp.col.value')}</th><th scope="col" className="py-1 text-end">{t('m35.hcp.col.change')}</th><th scope="col" className="py-1 text-start ps-3">{t('m35.hcp.col.approval')}</th></tr></thead>
        <tbody>
          {pack.metrics.map((m) => {
            const def = metrics.find((x) => x.id === m.metric_id) ?? {};
            return (
              <tr key={m.metric_id} className="border-t border-line align-top" data-testid="m35-pack-row" data-published={String(m.published)}>
                <th scope="row" className="py-2 text-start font-medium">
                  {pick(def, 'name')}
                  <span className="block text-[11.5px] font-normal text-ink-3">{pick(def, 'formula')}</span>
                  {m.published && <span className="mt-1 block text-[12px] font-normal">{lang === 'ar' ? m.narrative_ar : m.narrative_en}</span>}
                  {m.published && <span className="block text-[11.5px] font-normal text-ink-2">{t('m35.hc.varianceLabel')} {lang === 'ar' ? m.variance_ar : m.variance_en}</span>}
                </th>
                <td className="py-2 text-end"><span className="num" data-testid="m35-pack-value">{m.published ? <bdi dir="ltr">{vt(m.unit, m.value)}</bdi> : t('m35.hcp.notPublished')}</span></td>
                <td className="py-2 text-end"><span className="num">{m.published && m.variance != null ? <bdi dir="ltr">{vt(m.unit, m.variance, true)}</bdi> : '—'}</span></td>
                <td className="py-2 ps-3 text-start text-[12px] text-ink-2">{m.published ? t('m35.hcp.approval', { who: name(m.approved_by), by: name(m.prepared_by), date: f.date(m.approved_at) }) : t('m35.hcp.awaiting')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pack.metrics.filter((m) => m.published && m.cells.length).map((m) => (
        <div key={m.metric_id} className="break-inside-avoid">
          <h3 className="caps mb-1">{pick(metrics.find((x) => x.id === m.metric_id) ?? {}, 'name')}</h3>
          <EquityCells v={{ cells: m.cells } as never} />
        </div>
      ))}
      <p className="text-[11.5px] text-ink-3">{t('m35.hcp.footer')}</p>
    </div>
  );
}
