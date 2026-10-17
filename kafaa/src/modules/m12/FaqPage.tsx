// M12 · FAQ: searchable, filterable by topic, deep-linkable (#faq-n), with the reviewed EN/AR glossary.
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useRepo } from '../../data';
import { L, usePick, useT } from '../../i18n';
import { Async, EmptyState, FilterBar, Icon, Page, Section, StatusPill, useFilters } from '../../ui';
import { tokenize } from '../m13/dalil/text';

export default function FaqPage() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const loc = useLocation();
  const [flt, setFlt] = useFilters({ q: '', topic: '' }, true);
  const faqs = useQuery('faqs', () => repo.list('faqs', { order: [['sort', 'asc']] }));
  const glossary = useQuery('glossary', () => repo.list('glossary', { order: [['term_en', 'asc']] }));
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const id = loc.hash.replace('#', '');
    if (id.startsWith('faq-')) setOpen(id);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 50);
  }, [loc.hash, faqs.data]);
  const topics = useMemo(() => [...new Set((faqs.data ?? []).map((f) => f.topic))], [faqs.data]);
  const filtered = useMemo(() => {
    const q = new Set(tokenize(flt.q));
    return (faqs.data ?? []).filter((f) => (!flt.topic || f.topic === flt.topic) && (!q.size || tokenize(`${f.q_en} ${f.q_ar} ${f.a_en} ${f.a_ar}`).some((x) => q.has(x))));
  }, [faqs.data, flt]);
  return (
    <Page title={t('m12.routes.faq.title')} intro={t('m12.faq.intro')} actions={<L to="/ask" className="btn-outline"><Icon name="sparkle" />{t('m12.faq.askDalil')}</L>}>
      <FilterBar value={flt} onChange={setFlt} search="q" fields={[{ key: 'topic', label: t('m12.faq.topic'), options: topics.map((x) => ({ value: x, label: t(`m12.faq.topics.${x}`) })) }]} />
      <Async state={faqs}>
        {() =>
          filtered.length === 0 ? (
            <EmptyState title={t('m12.faq.none')}>
              <L to="/ask">{t('m12.faq.askDalil')}</L>
            </EmptyState>
          ) : (
            <ul className="card divide-y divide-line" data-testid="m12-faq-list">
              {filtered.map((f) => {
                const isOpen = open === f.id;
                return (
                  <li key={f.id} id={f.id} className="scroll-mt-24">
                    <button className="flex w-full items-start justify-between gap-3 p-4 text-start font-semibold hover:bg-sunken" aria-expanded={isOpen} aria-controls={`${f.id}-a`} onClick={() => setOpen(isOpen ? null : f.id)}>
                      <span>{pick(f, 'q')}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <StatusPill tone="neutral">{t(`m12.faq.topics.${f.topic}`)}</StatusPill>
                        <Icon name="chevronDown" className={isOpen ? 'rotate-180' : ''} />
                      </span>
                    </button>
                    {isOpen && (
                      <div id={`${f.id}-a`} className="px-4 pb-4 text-[14px] text-ink-2">
                        {pick(f, 'a')}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        }
      </Async>
      <Section id="glossary" title={t('m12.faq.glossaryTitle')} description={t('m12.faq.glossaryIntro')}>
        <Async state={glossary}>
          {(rows) => (
            <dl className="grid gap-3 sm:grid-cols-2" data-testid="m12-glossary">
              {rows.map((g) => (
                <div key={g.id} className="card p-3">
                  <dt className="font-semibold">
                    <span lang="en" dir="ltr">{g.term_en}</span> <span className="text-ink-3">·</span> <span lang="ar" dir="rtl">{g.term_ar}</span>
                  </dt>
                  <dd className="mt-1 text-[13px] text-ink-2">{pick(g, 'definition')}</dd>
                </div>
              ))}
            </dl>
          )}
        </Async>
      </Section>
    </Page>
  );
}
