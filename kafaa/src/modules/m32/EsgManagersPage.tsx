// FS43 /learn/energy-transition/esg-managers (staff): ESG and GHG literacy for managers. A short FS17 pathway (M19 rows) on GHG accounting
// basics and sustainability and human capital reporting concepts: completable in under 10 hours at a stated weekly cost, every step with
// an item that fits its planned hours (quick route), all content sourced, and a credential route showing how its check counts toward
// the MC-CLEAN-ENERGY criteria. Start the pathway here (ConfirmDialog -> M19 startPathway); progress is derived from my records.
import { Page, Section, Card, Async, Callout, EmptyState, BenchmarkChips, Icon, StatusPill } from '../../ui';
import { L, useFormat, usePick, useT } from '../../i18n';
import { FS43_HOUR_CAP, trackHours } from './transition';
import { PathwayPanel, SourceList, useEtRef, type EtRef, type Row } from './ui';

export default function EsgManagersPage() {
  const t = useT();
  const ref = useEtRef();
  return (
    <Page title={t('m32.routes.learn-esg-managers.title')} intro={t('m32.esg.intro')} wide eyebrow={<BenchmarkChips feature="FS43" />}
      actions={<L to="/learn/energy-transition" className="btn-outline btn-sm no-underline"><Icon name="back" size={14} className="rtl:-scale-x-100" /> {t('m32.chain.back')}</L>}>
      <Async state={ref}>{(d) => {
        const tr = d.transition_tracks.find((x: Row) => x.feature === 'FS43');
        return tr ? <Esg tr={tr} d={d} /> : <EmptyState title={t('m32.track.notFound')} />;
      }}</Async>
    </Page>
  );
}

function Esg({ tr, d }: { tr: Row; d: EtRef }) {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const p = d.pathways.find((x: Row) => x.id === tr.pathway_id);
  const h = p ? trackHours({ ...p, weekly_hours: Number(p.weekly_hours) }, d.pathway_steps.map((s: Row) => ({ ...s, hours: Number(s.hours) })), FS43_HOUR_CAP) : null;
  const sources = [...(tr.sources ?? []), ...d.external_resources.filter((x: Row) => x.id.startsWith('xr-et-') && ['xr-et-iso30414', 'xr-et-greencomp'].includes(x.id)).flatMap((x: Row) => x.sources)]
    .filter((s: Row, i: number, a: Row[]) => a.findIndex((y) => y.url === s.url) === i);
  return (
    <div className="space-y-6" data-testid="m32-esg">
      <Card eyebrow={<span className="flex flex-wrap items-center gap-2"><StatusPill tone="accent">FS43</StatusPill>{pick(tr, 'audience')}</span>} title={p ? pick(p, 'title') : tr.pathway_id}>
        <p className="text-[14px] text-ink-2">{pick(tr, 'summary')}</p>
        {p && <p className="mt-2 text-[13.5px]"><span className="font-semibold">{t('m32.esg.outcome')}</span> {pick(p, 'outcome')}</p>}
        {h && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-[13px]" data-testid="m32-esg-cost" data-total={h.total_hours} data-weekly={h.weekly_hours}>
            <StatusPill tone={h.under_cap ? 'ok' : 'bad'}>{t('m32.hub.underCap', { n: f.num(FS43_HOUR_CAP) })}</StatusPill>
            <span>{t('m32.esg.cost', { total: f.num(h.total_hours), weekly: f.num(h.weekly_hours), months: f.num(Number(p.envelope_months)) })}</span>
          </p>
        )}
      </Card>
      <Section title={t('m32.esg.route')} description={t('m32.esg.routeIntro')}>
        <PathwayPanel track={tr} d={d} showQuick />
      </Section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Callout tone="info" title={t('m32.esg.whyTitle')}>{t('m32.esg.whyBody')}</Callout>
        <Card title={t('m32.esg.cecTitle')}>
          <ul className="space-y-1 text-[13px]" data-testid="m32-esg-cec">{['cec-2-2', 'cec-2-3', 'cec-4-3'].map((id) => {
            const k = d.cec_competences.find((x: Row) => x.id === id);
            return k ? <li key={id}><L to={`/skills/clean-energy/${id}`}><span className="num me-1.5 text-[11.5px] text-ink-3">{k.code}</span>{pick(k, 'name')}</L></li> : null;
          })}</ul>
        </Card>
      </div>
      <Card title={t('m32.fw.sources')}><SourceList sources={sources} testId="m32-esg-sources" /></Card>
    </div>
  );
}
