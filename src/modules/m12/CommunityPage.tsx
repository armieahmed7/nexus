// M12 · Al Dhafra community: forums, the career fair, sponsorships, the Ma'an centre, STEM materials and people
// programmes, every statistic sourced and dated. Links to ENEC pages rather than copying them.
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, Card, Page, Section, SourceLink, StatusPill } from '../../ui';
import { FactTile, OfficialLink, Prose, SourcesList, useContentPage, useSourceMap, type SourceRef } from './parts';

const STEM = [
  { k: 'booklets', url: 'https://www.enec.ae/community/students-materials/' },
  { k: 'vr', url: 'https://www.enec.ae/community/students-materials/' },
  { k: 'festivals', url: 'https://www.enec.ae/community/students-materials/' },
];
const PEOPLE = [
  { k: 'win', url: 'https://www.enec.ae/our-subsidiaries/enec-operations/women-in-nuclear/', label: 'ENEC Operations · Women in Nuclear' },
  { k: 'youth', url: 'https://www.enec.ae/careers-and-scholarships/talent-pipeline-programs/', label: 'ENEC · Talent pipeline programs' },
];

export default function CommunityPage() {
  const t = useT();
  const pick = usePick();
  const f = useFormat();
  const repo = useRepo();
  const page = useContentPage('community');
  const data = useQuery(['facts', 'sources', 'events'], async () => {
    const [facts, sources, events] = await Promise.all([repo.list('facts', { filter: { topic: 'community' } }), repo.list('sources'), repo.list('events', { order: [['starts_on', 'desc']] }).catch(() => [])]);
    return { facts, sources, events };
  });
  const srcMap = useSourceMap(data.data?.sources);
  return (
    <Page title={t('m12.routes.community.title')} eyebrow={t('m12.community.eyebrow')} intro={t('m12.community.intro')} actions={<L to="/esg" className="btn-outline">{t('m12.community.esgLink')}</L>}>
      <Section title={t('m12.community.numbersTitle')}>
        <Async state={data} isEmpty={(d) => d.facts.length === 0}>
          {(d) => (
            <div className="grid gap-4 sm:grid-cols-3" data-testid="m12-community-facts">
              {d.facts.map((x) => (
                <FactTile key={x.id} fact={x} source={x.source_id ? srcMap.get(x.source_id) : null} />
              ))}
            </div>
          )}
        </Async>
      </Section>

      <Async state={page} isEmpty={(p) => !p}>
        {(p) => (
          <Section title={t('m12.community.dhafraTitle')}>
            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
              <Prose text={pick(p!, 'body')} />
              <SourcesList sources={p!.sources as SourceRef[]} asOf={p!.as_of} />
            </div>
          </Section>
        )}
      </Async>

      <Section title={t('m12.community.eventsTitle')} description={t('m12.community.eventsIntro')}>
        <Async state={data} isEmpty={(d) => d.events.length === 0}>
          {(d) => (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="m12-events">
              {d.events.slice(0, 6).map((e) => (
                <li key={e.id} className="card p-4">
                  <div className="flex items-center justify-between gap-2 text-[12px] text-ink-3">
                    <time dateTime={e.starts_on}>{f.date(e.starts_on)}</time>
                    {e.sample ? <StatusPill tone="sim">{t('common.sample')}</StatusPill> : <StatusPill tone="neutral">{t(`m12.community.eventKinds.${e.kind}`)}</StatusPill>}
                  </div>
                  <div className="mt-1 font-semibold">{pick(e, 'title')}</div>
                  <div className="text-[12.5px] text-ink-2">{pick(e, 'location')}</div>
                  {Array.isArray(e.sources) && e.sources[0] && (
                    <div className="mt-2 text-[11.5px]">
                      <SourceLink href={(e.sources[0] as SourceRef).url}>{(e.sources[0] as SourceRef).label}</SourceLink>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Async>
      </Section>

      <Section title={t('m12.community.stemTitle')} description={t('m12.community.stemIntro')}>
        <div className="grid gap-3 sm:grid-cols-3">
          {STEM.map((s) => (
            <OfficialLink key={s.k} href={s.url} title={t(`m12.community.stem.${s.k}.title`)}>
              {t(`m12.community.stem.${s.k}.body`)}
            </OfficialLink>
          ))}
        </div>
      </Section>

      <Section title={t('m12.community.peopleTitle')}>
        <div className="grid gap-4 sm:grid-cols-2">
          {PEOPLE.map((p) => (
            <Card key={p.k} title={t(`m12.community.people.${p.k}.title`)}>
              <p className="text-[13px] text-ink-2">{t(`m12.community.people.${p.k}.body`)}</p>
              <div className="mt-2 text-[11.5px]">
                <SourceLink href={p.url}>{p.label}</SourceLink>
              </div>
            </Card>
          ))}
        </div>
      </Section>
    </Page>
  );
}
