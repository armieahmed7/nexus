// M07 /workforce/definitions: one definitions panel for every metric tile (definition, calculation, GRI disclosure, source
// table and public source), plus the reconciliation notes where public figures differ. Tiles link here by #metric anchor.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Page, Card, Async, Callout, SourceLink, StatusPill, SimChip } from '../../ui';
import { L, usePick, useT } from '../../i18n';
import { MIN_GROUP_SIZE } from '../../auth/policy';
import { METRICS } from './metrics';
import { SR2024, kpiLatest, useKpis } from './shared';

export default function WorkforceDefinitionsPage() {
  const t = useT();
  const pick = usePick();
  const kpis = useKpis();
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash || !kpis.data) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      el.scrollIntoView({ block: 'start' });
      el.focus({ preventScroll: true });
    }
  }, [hash, kpis.data]);
  return (
    <Page title={t('m07.routes.workforce-definitions.title')} intro={t('m07.defs.intro', { n: MIN_GROUP_SIZE })}>
      <Callout tone="sim" title={t('m07.reconcile.title')}>
        {t('m07.reconcile.body')} <SourceLink href={SR2024}>SR2024 p.90</SourceLink>
      </Callout>
      <Callout tone="info" title={t('m07.defs.uncertainTitle')}>{t('m07.defs.uncertainBody')}</Callout>
      <Async state={kpis}>
        {(rows) => (
          <div className="space-y-3" data-testid="m07-definitions">
            {METRICS.map((m) => {
              const k = m.kpi ? kpiLatest(rows, m.kpi) : null;
              return (
                <section key={m.key} id={m.key} tabIndex={-1} className="scroll-mt-24 outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <Card title={t(`m07.metric.${m.key}`)} eyebrow={m.gri ?? t('m07.defs.internal')} actions={k?.sample || m.sim || m.table === 'kafaa_workforce_snapshots' || m.table === 'kafaa_critical_roles' || m.table === 'kafaa_scholar_cohorts' ? <SimChip label={t('common.sample')} /> : undefined}>
                    <p className="text-[14px]">{t(`m07.def.${m.key}`)}</p>
                    <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-[minmax(140px,max-content)_1fr]">
                      <dt className="caps pt-0.5">{t('m07.defs.unit')}</dt>
                      <dd>{t(`m07.unitName.${m.unit}`)}</dd>
                      <dt className="caps pt-0.5">{t('m07.defs.table')}</dt>
                      <dd><code className="ltr rounded bg-sunken px-1.5 py-0.5 text-[12px]">{m.table}{m.kpi ? ` · metric = '${m.kpi}'` : ''}</code></dd>
                      <dt className="caps pt-0.5">{t('m07.defs.suppression')}</dt>
                      <dd>{m.table === 'kafaa_kpi_series' ? t('m07.defs.orgLevel') : t('m07.defs.suppressed', { n: MIN_GROUP_SIZE })}</dd>
                      {k && (
                        <>
                          <dt className="caps pt-0.5">{t('m07.defs.latest')}</dt>
                          <dd>
                            <span className="num">{k.value}{k.unit === '%' ? '%' : k.unit === 'count' ? '' : ['people', 'days', 'h'].includes(k.unit) ? ` ${t(`m07.unitShort.${k.unit}`)}` : ` ${k.unit}`}</span> · {k.period} · {k.source_url ? <SourceLink href={k.source_url}>{k.source}</SourceLink> : k.source}
                            {k.label_en.includes('uncertain') || k.source.includes('uncertain') ? <span className="ms-2"><StatusPill tone="sim">{t('m07.defs.uncertain')}</StatusPill></span> : null}
                          </dd>
                        </>
                      )}
                    </dl>
                  </Card>
                </section>
              );
            })}
          </div>
        )}
      </Async>
      <L to="/workforce" className="text-[13px]">{t('m07.defs.back')}</L>
    </Page>
  );
}
