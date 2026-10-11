// M12 · News: sourced, news-style updates about people, programmes, partners and the community. Every item links
// its public source; nothing is copied beyond a short summary.
import { useMemo } from 'react';
import { useQuery, useRepo } from '../../data';
import { usePick, useT } from '../../i18n';
import { Async, Callout, EmptyState, FilterBar, Page, useFilters } from '../../ui';
import { useFlags } from '../m16/flags';
import { NewsCard } from './parts';

export default function NewsPage() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const { isOn, loading } = useFlags();
  const [flt, setFlt] = useFilters({ q: '', topic: '', year: '' }, true);
  const news = useQuery('content_pages', () => repo.list('content_pages', { filter: { kind: 'news', is_published: true }, order: [['published_on', 'desc']] }));
  const topics = useMemo(() => [...new Set((news.data ?? []).map((n) => n.topic))], [news.data]);
  const years = useMemo(() => [...new Set((news.data ?? []).map((n) => (n.published_on ?? '').slice(0, 4)).filter(Boolean))], [news.data]);
  const rows = (news.data ?? []).filter(
    (n) => (!flt.topic || n.topic === flt.topic) && (!flt.year || (n.published_on ?? '').startsWith(flt.year)) && (!flt.q || `${pick(n, 'title')} ${pick(n, 'summary')}`.toLowerCase().includes(flt.q.toLowerCase())),
  );
  if (!loading && !isOn('news'))
    return (
      <Page title={t('m12.routes.news.title')}>
        <Callout tone="sim">{t('m12.news.off')}</Callout>
      </Page>
    );
  return (
    <Page title={t('m12.routes.news.title')} intro={t('m12.news.intro')}>
      <FilterBar
        value={flt}
        onChange={setFlt}
        search="q"
        fields={[
          { key: 'topic', label: t('m12.news.topic'), options: topics.map((x) => ({ value: x, label: t(`m12.news.topics.${x}`) })) },
          { key: 'year', label: t('m12.news.year'), options: years.map((y) => ({ value: y, label: y })) },
        ]}
      />
      <Async state={news}>
        {() =>
          rows.length === 0 ? (
            <EmptyState title={t('m12.news.none')} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="m12-news-list">
              {rows.map((n) => (
                <NewsCard key={n.id} item={n} />
              ))}
            </div>
          )
        }
      </Async>
    </Page>
  );
}
