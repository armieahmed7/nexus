// M12 · Climate and ESG: Barakah's climate contribution with sources and dates; sustainability reports linked, not copied.
import { useQuery, useRepo } from '../../data';
import { L, usePick, useT } from '../../i18n';
import { Async, BarChart, Card, Page, Section, SourceLink } from '../../ui';
import { FactTile, OfficialLink, Prose, SourcesList, useContentPage, useSourceMap, type SourceRef } from './parts';

const REPORTS = [
  { k: 'sr2024', url: 'https://www.enec.ae/doc/sustainability-program-2024-23102025-low-69009902e1673.pdf' },
  { k: 'sustainability', url: 'https://www.enec.ae/about-us/overview/sustainability/' },
  { k: 'climate', url: 'https://www.enec.ae/about-us/overview/climate-change/' },
];

export default function EsgPage() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const page = useContentPage('esg');
  const data = useQuery(['facts', 'sources', 'kpi_series'], async () => {
    const [facts, sources, kpis] = await Promise.all([repo.list('facts', { filter: { public: true } }), repo.list('sources'), repo.list('kpi_series', { filter: { public: true } }).catch(() => [])]);
    return { facts, sources, kpis };
  });
  const srcMap = useSourceMap(data.data?.sources);
  const climate = (data.data?.facts ?? []).filter((x) => ['co2', 'generation', 'share', 'corals'].includes(x.key));
  const training = (data.data?.kpis ?? []).filter((k) => k.metric === 'training_hours').sort((a, b) => a.period.localeCompare(b.period));
  return (
    <Page title={t('m12.routes.esg.title')} eyebrow={t('m12.esg.eyebrow')} intro={t('m12.esg.intro')}>
      <Section title={t('m12.esg.climateTitle')}>
        <Async state={data} isEmpty={() => climate.length === 0}>
          {() => (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="m12-esg-facts">
              {climate.map((x) => (
                <FactTile key={x.id} fact={x} source={x.source_id ? srcMap.get(x.source_id) : null} />
              ))}
            </div>
          )}
        </Async>
      </Section>

      <Async state={page} isEmpty={(p) => !p}>
        {(p) => (
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <Prose text={pick(p!, 'body')} />
            <SourcesList sources={p!.sources as SourceRef[]} asOf={p!.as_of} />
          </div>
        )}
      </Async>

      {training.length > 0 && (
        <Section title={t('m12.esg.socialTitle')} description={t('m12.esg.socialIntro')}>
          <Card>
            <BarChart title={t('m12.esg.trainingChart')} data={training.map((k) => ({ label: k.period, value: k.value }))} />
            <div className="mt-2 text-[11.5px]">
              {training[0].source_url && <SourceLink href={training[0].source_url}>{training[0].source}</SourceLink>}
            </div>
          </Card>
        </Section>
      )}

      <Section title={t('m12.esg.reportsTitle')} description={t('m12.esg.reportsIntro')}>
        <div className="grid gap-3 sm:grid-cols-3" data-testid="m12-esg-reports">
          {REPORTS.map((r) => (
            <OfficialLink key={r.k} href={r.url} title={t(`m12.esg.reports.${r.k}.title`)}>
              {t(`m12.esg.reports.${r.k}.body`)}
            </OfficialLink>
          ))}
        </div>
        <p className="text-[12.5px] text-ink-2">
          {t('m12.esg.communityPrompt')} <L to="/community">{t('m12.routes.community.title')}</L>
        </p>
      </Section>
    </Page>
  );
}
