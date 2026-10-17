// M12 · FAQ: searchable, filterable by topic, deep-linkable (#faq-n). The glossary lives in the Help centre (/help/glossary):
// the old #glossary anchor sends visitors there, and a card points to it so the FAQ never shows a second copy of the terms.
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useRepo } from '../../data';
import { L, useNav, usePick, useT } from '../../i18n';
import { Async, EmptyState, FilterBar, Icon, Page, Section, StatusPill, useFilters } from '../../ui';
import { tokenize } from '../m13/dalil/text';

export default function FaqPage() {
  const t = useT();
  const pick = usePick();
  const repo = useRepo();
  const loc = useLocation();
  const nav = useNav();
  const [flt, setFlt] = useFilters({ q: '', topic: '' }, true);
  const faqs = useQuery('faqs', () => repo.list('faqs', { order: [['sort', 'asc']] }));
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const id = loc.hash.replace('#', '');
    if (id === 'glossary') {
      nav('/help/glossary', { replace: true }); // links made before the glossary moved to the Help centre
      return;
    }
    if (id.startsWith('faq-')) setOpen(id);
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 50);
  }, [loc.hash, faqs.data, nav]);
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
      <Section id="glossary" title={t('m12.faq.glossaryTitle')}>
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4" data-testid="m12-faq-glossary">
          <p className="max-w-2xl text-ink-2">{t('m12.faq.glossaryMoved')}</p>
          <L to="/help/glossary" className="btn-outline btn-sm no-underline">
            <Icon name="book" size={14} />
            {t('m12.faq.glossaryOpen')}
          </L>
        </div>
      </Section>
    </Page>
  );
}
