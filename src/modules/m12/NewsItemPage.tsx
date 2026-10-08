// M12 · News item: summary, short body, sources and related links.
import { useParams } from 'react-router-dom';
import { useQuery, useRepo } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Async, EmptyState, Page, StatusPill } from '../../ui';
import { NewsCard, Prose, SourcesList, useContentPage, type SourceRef } from './parts';

export default function NewsItemPage() {
  const t = useT();
  const f = useFormat();
  const pick = usePick();
  const repo = useRepo();
  const { slug = '' } = useParams();
  const item = useContentPage(`news/${slug}`);
  const more = useQuery('content_pages', () => repo.list('content_pages', { filter: { kind: 'news', is_published: true }, order: [['published_on', 'desc']], limit: 4 }));
  return (
    <Async state={item} isEmpty={(d) => !d} empty={<Page title={t('m12.news.notFound')}><EmptyState title={t('m12.news.notFound')} action={<L to="/news" className="btn-outline btn-sm">{t('m12.routes.news.title')}</L>} /></Page>}>
      {(d) => (
        <Page title={pick(d!, 'title')} eyebrow={<span className="inline-flex items-center gap-2"><time dateTime={d!.published_on ?? undefined}>{f.date(d!.published_on, 'long')}</time><StatusPill tone="neutral">{t(`m12.news.topics.${d!.topic}`)}</StatusPill></span>} intro={pick(d!, 'summary')}>
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]" data-testid="m12-news-item">
            <Prose text={pick(d!, 'body')} />
            <SourcesList sources={d!.sources as SourceRef[]} asOf={d!.as_of} />
          </div>
          <Async state={more}>
            {(rows) => (
              <section className="space-y-3">
                <h2 className="text-[18px] font-semibold">{t('m12.news.more')}</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {rows.filter((r) => r.id !== d!.id).slice(0, 3).map((r) => (
                    <NewsCard key={r.id} item={r} />
                  ))}
                </div>
              </section>
            )}
          </Async>
        </Page>
      )}
    </Async>
  );
}
