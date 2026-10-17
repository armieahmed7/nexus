// FS64 /ecosystem/regional-plan/release (workforce_strategy Agg/W/A): share a RELEASED FS51 forecast with providers as regional
// aggregates. The preview is the release rule itself (demandRows = SQL kafaa_rg_rows) on the forecast HR can already read, compared with
// the current release. What leaves ENEC: per area and year the demand and gap bands across the three scenarios and the planning gap,
// cells of 1-9 suppressed, the number of withheld skills. What never leaves: levels, supply, assumptions, people. The HR director
// (workforce_strategy A + ecosystem W) confirms; the note passes the headcount/site check; audit + ledger.
import { useMemo, useState } from 'react';
import { useAction, useQuery, useRepo } from '../../data';
import type { Table } from '../../data/types';
import { useSession } from '../../auth/session';
import { Page, Section, Async, Card, EmptyState, Callout, ConfirmDialog, TextArea, BenchmarkChips, StatusPill, ScrollRegion } from '../../ui';
import { L, useFormat, useT } from '../../i18n';
import { publicTextIsClean } from '../../domain/future';
import { COVERAGE_YEAR, demandRows, type DemandRow } from './regional';
import { Band, DemoLabels, Sup, type Row } from './ui';

export default function DemandReleasePage() {
  const t = useT();
  const repo = useRepo();
  const forecasts = useQuery('skill_forecasts' as Table, () => (repo.list('skill_forecasts' as never, { order: [['created_at', 'desc']] } as never) as unknown as Promise<Row[]>).catch(() => [] as Row[]));
  const demand = useQuery('regional_demand' as Table, () => repo.list('regional_demand' as never) as unknown as Promise<Row[]>);
  const skills = useQuery('skills', () => repo.list('skills') as Promise<Row[]>);
  return (
    <Page title={t('m36.routes.ecosystem-demand-release.title')} intro={t('m36.rel.intro')} wide eyebrow={<BenchmarkChips feature="FS64" />}
      actions={<L to="/ecosystem/regional-plan" className="btn-outline btn-sm no-underline">{t('m36.cm.toPlan')}</L>}>
      <Async state={forecasts}>{(fs) => (
        <Async state={demand}>{(rd) => (
          <Async state={skills}>{(sk) => {
            const released = fs.filter((x) => x.status === 'released');
            if (!released.length) return <EmptyState title={t('m36.rel.none')} />;
            return <Release released={released} demand={rd} skillArea={Object.fromEntries(sk.map((x) => [x.id, x.area]))} />;
          }}</Async>
        )}</Async>
      )}</Async>
    </Page>
  );
}

function Release({ released, demand, skillArea }: { released: Row[]; demand: Row[]; skillArea: Record<string, string> }) {
  const t = useT();
  const f = useFormat();
  const repo = useRepo();
  const run = useAction();
  const s = useSession();
  const cur = demand.filter((d) => d.status === 'current');
  const curForecast = cur[0]?.forecast_id ?? null;
  const pending = released.find((x) => x.id !== curForecast) ?? null;
  const [fid, setFid] = useState<string>(pending?.id ?? released[0].id);
  const fc = released.find((x) => x.id === fid) ?? released[0];
  const rows: DemandRow[] = useMemo(() => demandRows(fc.results, fc.scenario, skillArea), [fc, skillArea]);
  const [en, setEn] = useState('');
  const [ar, setAr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const canRelease = s.can('workforce_strategy', ['A']) && s.can('ecosystem', ['W', 'A']);
  const isCurrent = fc.id === curForecast;
  const noteOk = en.trim().length >= 10 && en.trim().length <= 400 && ar.trim().length >= 10 && ar.trim().length <= 400;
  const clean = publicTextIsClean([en, ar]);
  const mid = rows.filter((r) => r.year === COVERAGE_YEAR);
  const prevOf = (area: string) => cur.find((d) => d.area === area && Number(d.year) === COVERAGE_YEAR);
  return (
    <div className="space-y-6" data-testid="m36-rel">
      <DemoLabels />
      {pending && <Callout tone="sim" title={t('m36.rel.pendingTitle')}><span data-testid="m36-rel-pending">{t('m36.rel.pendingBody', { name: pending.name, date: f.date(pending.released_at) })}</span></Callout>}
      <Card title={t('m36.rel.choose')}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('m36.rel.choose')}>
          {released.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={fid === x.id} className={`btn-sm h-auto min-h-8 max-w-full whitespace-normal py-1 text-start ${fid === x.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFid(x.id)} data-testid={`m36-rel-pick-${x.id}`}>
              {x.name}{x.id === curForecast ? ` · ${t('m36.rel.current')}` : ''}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] text-ink-2">{t('m36.rel.forecastInfo', { s: t(`m36.scenario.${fc.scenario}`), date: f.date(fc.released_at), n: f.num(new Set(rows.map((r) => r.area)).size) })}</p>
      </Card>
      <Section title={t('m36.rel.preview', { y: f.num(COVERAGE_YEAR, { useGrouping: false }) })} description={t('m36.rel.previewIntro')}>
        <ScrollRegion className="overflow-x-auto" data-testid="m36-rel-preview">
          <table className="w-full text-[13px]">
            <caption className="sr-only">{t('m36.rel.preview', { y: String(COVERAGE_YEAR) })}</caption>
            <thead><tr className="text-ink-3">
              <th scope="col" className="py-1 text-start font-semibold">{t('m36.rp.col.area')}</th>
              <th scope="col" className="py-1 text-end font-semibold">{t('m36.rp.col.demand')}</th>
              <th scope="col" className="py-1 text-end font-semibold">{t('m36.rp.col.gap')}</th>
              <th scope="col" className="py-1 text-end font-semibold">{t('m36.rel.planGap')}</th>
              <th scope="col" className="py-1 text-end font-semibold">{t('m36.rel.change')}</th>
              <th scope="col" className="py-1 text-end font-semibold">{t('m36.rp.col.withheld')}</th>
            </tr></thead>
            <tbody>{mid.map((r) => {
              const p = prevOf(r.area);
              const delta = p && p.gap_plan != null && r.gap_plan != null ? r.gap_plan - Number(p.gap_plan) : null;
              return (
                <tr key={r.area} className="border-t border-line" data-testid="m36-rel-row" data-area={r.area} data-suppressed={r.suppressed}>
                  <th scope="row" className="py-1.5 text-start font-medium">{t(`m36.area.${r.area}`)}</th>
                  <td className="py-1.5 text-end"><Band lo={r.demand_low} hi={r.demand_high} /></td>
                  <td className="py-1.5 text-end"><Band lo={r.gap_low} hi={r.gap_high} /></td>
                  <td className="py-1.5 text-end"><Sup v={r.gap_plan} /></td>
                  <td className="py-1.5 text-end num">{!p ? <StatusPill tone="info">{t('m36.rel.newArea')}</StatusPill> : delta == null ? '—' : delta === 0 ? '0' : `${delta > 0 ? '+' : '−'}${f.num(Math.abs(delta))}`}</td>
                  <td className="py-1.5 text-end num">{f.num(r.withheld_n)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </ScrollRegion>
      </Section>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Callout tone="ok" title={t('m36.rel.shared.title')}>{t('m36.rel.shared.body')}</Callout>
        <Callout tone="bad" title={t('m36.rel.never.title')}>{t('m36.rel.never.body')}</Callout>
      </div>
      <Section title={t('m36.rel.note')}>
        {canRelease ? (
          <div className="space-y-3" data-testid="m36-rel-form">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextArea name="note_en" label={t('m36.rel.noteEn')} value={en} onChange={setEn} rows={3} />
              <TextArea name="note_ar" label={t('m36.rel.noteAr')} value={ar} onChange={setAr} rows={3} />
            </div>
            {!clean && <p className="text-[12.5px] text-bad" data-testid="m36-rel-not-clean">{t('m36.rel.notClean')}</p>}
            {isCurrent && <p className="text-[12.5px] text-ink-3" data-testid="m36-rel-is-current">{t('m36.rel.isCurrent')}</p>}
            <button type="button" className="btn-primary" disabled={!noteOk || !clean || isCurrent} onClick={() => setConfirm(true)} data-testid="m36-rel-submit">{t('m36.rel.release')}</button>
          </div>
        ) : <p className="text-[13px] text-ink-3" data-testid="m36-rel-readonly">{t('m36.rel.readOnly')}</p>}
      </Section>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t('m36.rel.confirm')} consequence={t('m36.rel.consequence', { n: f.num(rows.length) })} actingAs={t('m36.rel.actingAs')}
        confirmLabel={t('m36.rel.release')} onConfirm={async () => { const r = await run(() => repo.rpc.releaseRegionalDemand({ forecast_id: fc.id, note_en: en, note_ar: ar })); if (r.ok) { setEn(''); setAr(''); } setConfirm(false); }} />
    </div>
  );
}
