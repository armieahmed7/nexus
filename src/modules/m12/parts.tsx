/** Shared pieces for the G5 public pages (M12, M08): sourced fact tiles, source lists, news cards, official links. */
import type { ReactNode } from 'react';
import { useQuery as useQueryForParts, useRepo as useRepoForParts } from '../../data';
import { L, useFormat, usePick, useT } from '../../i18n';
import { Icon, SimChip, SourceLink, StatusPill } from '../../ui';
import type { ContentPagesRow, FactsRow, SourcesRow } from '../../data/types';

export type SourceRef = { id?: string; label: string; url: string };

/** A statistic with its source link and "as of" date (M12 acceptance: every statistic has both). */
export function FactTile({ fact, source }: { fact: FactsRow; source?: SourcesRow | null }) {
  const pick = usePick();
  const f = useFormat();
  const t = useT();
  return (
    <div className="card flex h-full flex-col p-4" data-testid="m12-fact" data-fact={fact.key}>
      <div className="flex items-start justify-between gap-2">
        <div className="caps">{pick(fact, 'label')}</div>
        {fact.sample && <SimChip label={t('common.sample')} />}
      </div>
      <div className="num mt-1 text-[24px] font-semibold leading-tight text-ink">{pick(fact, 'value') || fact.value}</div>
      {pick(fact, 'detail') && <div className="mt-1 text-[12.5px] text-ink-2">{pick(fact, 'detail')}</div>}
      {fact.conflict_note && <div className="mt-1 text-[11.5px] text-sim">{t('m12.common.sourcesDiffer')}: {fact.conflict_note}</div>}
      <div className="mt-auto pt-3 text-[11.5px] text-ink-3">
        {source ? <SourceLink href={source.url}>{source.label}</SourceLink> : <span>{t('m12.common.noSource')}</span>}
        <span className="ms-1">· {t('common.asOf', { date: f.date(fact.as_of) })}</span>
      </div>
    </div>
  );
}

export function SourcesList({ sources, asOf, title }: { sources: SourceRef[] | null | undefined; asOf?: string | null; title?: ReactNode }) {
  const t = useT();
  const f = useFormat();
  if (!sources?.length) return null;
  return (
    <div className="rounded-card border border-line bg-raised p-3 text-[12.5px]" data-testid="sources-list">
      <div className="caps mb-1.5">{title ?? t('m12.common.sources')}</div>
      <ul className="space-y-1">
        {sources.map((s) => (
          <li key={s.url + s.label}>
            <SourceLink href={s.url}>{s.label}</SourceLink>
          </li>
        ))}
      </ul>
      {asOf && <div className="mt-1.5 text-ink-3">{t('common.asOf', { date: f.date(asOf) })}</div>}
    </div>
  );
}

export function NewsCard({ item }: { item: ContentPagesRow }) {
  const pick = usePick();
  const f = useFormat();
  const t = useT();
  const slug = item.slug.replace(/^news\//, '');
  return (
    <article className="card flex h-full flex-col p-4" data-testid="m12-news-card">
      <div className="flex items-center justify-between gap-2 text-[12px] text-ink-3">
        <time dateTime={item.published_on ?? undefined}>{f.date(item.published_on)}</time>
        <StatusPill tone="neutral">{t(`m12.news.topics.${item.topic}`)}</StatusPill>
      </div>
      <h3 className="mt-2 text-[15px] font-semibold leading-snug">
        <L to={`/news/${slug}`} className="link-plain hover:text-eyebrow">
          {pick(item, 'title')}
        </L>
      </h3>
      <p className="mt-1 flex-1 text-[13px] text-ink-2">{pick(item, 'summary')}</p>
      <div className="mt-3 text-[11.5px] text-ink-3">
        {(item.sources as SourceRef[]).slice(0, 1).map((s) => (
          <SourceLink key={s.url} href={s.url}>
            {s.label}
          </SourceLink>
        ))}
      </div>
    </article>
  );
}

/** A link to an official external page (emergency guidance, regulators). */
export function OfficialLink({ href, title, children }: { href: string; title: ReactNode; children?: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="card link-plain flex items-start gap-3 p-4 hover:border-accent" data-testid="official-link">
      <Icon name="external" className="mt-0.5 text-eyebrow" />
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        {children && <span className="mt-0.5 block text-[12.5px] text-ink-2">{children}</span>}
        <span className="ltr mt-1 block truncate text-[11.5px] text-ink-3">{href.replace(/^https?:\/\//, '')}</span>
      </span>
    </a>
  );
}

/** Paragraphs from a bilingual body (blank-line or sentence groups kept as-is). */
export function Prose({ text }: { text: string }) {
  return (
    <div className="max-w-3xl space-y-3 text-[15px] leading-relaxed text-ink">
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

export function useSourceMap(sources: SourcesRow[] | undefined) {
  return new Map((sources ?? []).map((s) => [s.id, s]));
}

/** Load a published content page by slug (RLS: anonymous visitors see published public pages only). */
export function useContentPage(slug: string) {
  const repo = useRepoForParts();
  return useQueryForParts('content_pages', async () => (await repo.list('content_pages', { filter: { slug } }))[0] ?? null, [slug]);
}
