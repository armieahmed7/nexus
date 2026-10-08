// M12 · About: mandate, strategy themes, Barakah (units, licences, commercial operation) and the people facts, all
// sourced. Entities and roles only; leadership is never named here (link to enec.ae instead).
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, Card, Callout, DataTable, Page, Section, SourceLink, type Column } from '../../ui';
import { FactTile, Prose, SourcesList, useContentPage, useSourceMap, type SourceRef } from './parts';

/** Barakah unit milestones (spec Section 3; WNN unit articles and enec.ae operational safety). Month-only dates stay month-only. */
const UNITS = [
  { unit: 1, licence: '2020-02-17', grid: '2020-08-19', cod: '2021-04-06' },
  { unit: 2, licence: '2021-03-09', grid: '2021-09-14', cod: '2022-03-24' },
  { unit: 3, licence: '2022-06', grid: '2022-10-10', cod: '2023-02-24' },
  { unit: 4, licence: '2023-11', grid: '2024-03-23', cod: '2024-09-05' },
];
const UNIT_SOURCES: SourceRef[] = [
  { label: 'WNN · Fourth Barakah unit receives operating licence', url: 'https://www.world-nuclear-news.org/articles/fourth-barakah-unit-receives-operating-licence' },
  { label: 'ENEC · Operational safety', url: 'https://www.enec.ae/regulation/safety-at-enec/operational-safety/' },
];
const THEMES = ['fleet', 'growth', 'people'] as const;

export default function AboutPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const page = useContentPage('about');
  const facts = useQuery(['facts', 'sources'], async () => {
    const [rows, sources] = await Promise.all([repo.list('facts', { filter: { public: true } }), repo.list('sources')]);
    return { rows, sources };
  });
  const srcMap = useSourceMap(facts.data?.sources);
  const fmt = (d: string) => (d.length === 7 ? new Intl.DateTimeFormat(f.locale, { year: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}-01T00:00:00Z`)) : f.date(d));
  const cols: Column<(typeof UNITS)[number]>[] = [
    { key: 'unit', header: t('m12.about.unit'), value: (r) => r.unit, render: (r) => <span className="font-semibold">{t('m12.about.unitN', { n: f.num(r.unit) })}</span> },
    { key: 'licence', header: t('m12.about.licence'), value: (r) => r.licence, render: (r) => fmt(r.licence) },
    { key: 'grid', header: t('m12.about.grid'), value: (r) => r.grid, render: (r) => fmt(r.grid) },
    { key: 'cod', header: t('m12.about.cod'), value: (r) => r.cod, render: (r) => fmt(r.cod) },
  ];
  return (
    <Page title={t('m12.routes.about.title')} eyebrow={t('m12.about.eyebrow')} intro={t('m12.about.intro')} actions={<L to="/about/structure" className="btn-outline" data-testid="m12-structure-link">{t('m12.about.structureLink')}</L>}>
      <Async state={page} isEmpty={(p) => !p} empty={<Callout tone="sim">{t('m12.common.pageUnavailable')}</Callout>}>
        {(p) => (
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <Prose text={pick(p!, 'body')} />
            <SourcesList sources={p!.sources as SourceRef[]} asOf={p!.as_of} />
          </div>
        )}
      </Async>

      <Section title={t('m12.about.strategyTitle')} description={t('m12.about.strategyIntro')}>
        <div className="grid gap-4 sm:grid-cols-3">
          {THEMES.map((k, i) => (
            <Card key={k} eyebrow={t('m12.about.themeN', { n: f.num(i + 1) })} title={t(`m12.about.themes.${k}.title`)}>
              <p className="text-[13px] text-ink-2">{t(`m12.about.themes.${k}.body`)}</p>
            </Card>
          ))}
        </div>
        <div className="text-[12px]">
          <SourceLink href="https://www.enec.ae/about-us/overview/strategic-roadmap/">ENEC · Strategic roadmap (Enterprise Strategy 2025-2029)</SourceLink>
        </div>
      </Section>

      <Section title={t('m12.about.barakahTitle')} description={t('m12.about.barakahIntro')}>
        <Async state={facts}>
          {(d) => (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" data-testid="m12-about-facts">
              {d.rows.filter((x) => x.topic === 'barakah').map((x) => (
                <FactTile key={x.id} fact={x} source={x.source_id ? srcMap.get(x.source_id) : null} />
              ))}
            </div>
          )}
        </Async>
        <DataTable rows={UNITS} rowKey={(r) => String(r.unit)} columns={cols} searchable={false} caption={t('m12.about.unitsCaption')} />
        <SourcesList sources={UNIT_SOURCES} title={t('m12.about.unitsSources')} />
      </Section>

      <Section title={t('m12.about.peopleTitle')} description={t('m12.about.peopleIntro')}>
        <Async state={facts}>
          {(d) => (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="m12-about-people">
              {d.rows.filter((x) => x.topic === 'workforce').map((x) => (
                <FactTile key={x.id} fact={x} source={x.source_id ? srcMap.get(x.source_id) : null} />
              ))}
            </div>
          )}
        </Async>
        <Callout tone="info" title={t('m12.about.noNamesTitle')}>
          {t('m12.about.noNamesBody')}{' '}
          <a href="https://www.enec.ae/about-us/overview/" target="_blank" rel="noopener noreferrer">enec.ae</a>
        </Callout>
      </Section>

      <Section title={t('m12.about.moreTitle')}>
        <div className="grid gap-3 sm:grid-cols-4">
          {[['/about/structure', 'structure'], ['/careers', 'careers'], ['/safety-culture', 'safety'], ['/esg', 'esg']].map(([to, k]) => (
            <L key={to} to={to} className="card link-plain p-4 font-semibold hover:border-accent">
              {t(`m12.about.more.${k}`)}
            </L>
          ))}
        </div>
      </Section>
    </Page>
  );
}
