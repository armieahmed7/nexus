// M12 · Help centre (/help): search-as-you-type over the guides and the glossary (both languages, Arabic-normalised),
// "Start here" by audience, guides by task, and the future-skills glossary A to Z. Content: src/modules/m12/help/*.
import { useMemo } from 'react';
import { L, useLang, useT } from '../../i18n';
import { Callout, Icon, Page, Section, useFilters } from '../../ui';
import { GUIDES, GUIDE_BY_ID, HELP_CATEGORIES, START_HERE } from './help/content';
import { HELP_INDEX, searchHelp, termHref } from './help/search';
import { dbTermEntries, groupByLetter, letterAnchor, useMergedGlossary } from './help/ui';

export default function HelpPage() {
  const t = useT();
  const lang = useLang();
  const [flt, setFlt] = useFilters({ q: '' }, true);
  const { items } = useMergedGlossary();
  const index = useMemo(() => [...HELP_INDEX, ...dbTermEntries(items)], [items]);
  const query = flt.q.trim();
  const hits = useMemo(() => searchHelp(query, index), [query, index]);
  const letters = useMemo(() => groupByLetter(items, lang), [items, lang]);

  return (
    <Page title={t('m12.routes.help.title')} intro={t('m12.help.intro')} actions={<L to="/ask" className="btn-outline"><Icon name="sparkle" />{t('m12.help.askDalil')}</L>}>
      <div role="search" className="card p-4" data-testid="m12-help-search">
        <label htmlFor="help-q" className="caps mb-1.5 block">
          {t('m12.help.searchLabel')}
        </label>
        <div className="relative">
          <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input id="help-q" type="search" className="input h-11 ps-9 text-[15px]" value={flt.q} onChange={(e) => setFlt({ q: e.target.value })} placeholder={t('m12.help.searchPh')} autoComplete="off" aria-describedby="help-q-count" data-testid="m12-help-q" />
        </div>
        <p id="help-q-count" className="mt-2 text-[12.5px] text-ink-3" aria-live="polite">
          {query ? t('m12.help.results', { n: hits.length }) : t('m12.help.searchHint')}
        </p>
      </div>

      {query ? (
        hits.length === 0 ? (
          <div className="card p-6 text-center" data-testid="m12-help-none">
            <div className="font-semibold">{t('m12.help.noResults')}</div>
            <p className="mt-1 text-ink-2">
              {t('m12.help.noResultsBody')} <L to="/ask">{t('m12.help.askDalil')}</L>
            </p>
          </div>
        ) : (
          <ul className="card divide-y divide-line" data-testid="m12-help-results">
            {hits.map((h) => (
              <li key={`${h.kind}-${h.id}`} data-kind={h.kind}>
                <L to={h.to} className="link-plain block p-4 hover:bg-sunken">
                  <span className="caps">{t(`m12.help.kind.${h.kind}`)}</span>
                  <span className="mt-0.5 block font-semibold text-accent">{h.title[lang]}</span>
                  <span className="mt-0.5 block text-[13px] text-ink-2">{h.text[lang]}</span>
                </L>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <Section id="start" title={t('m12.help.startTitle')} description={t('m12.help.startIntro')}>
            <L to="/help/how-kafaa-works" className="link-plain card flex flex-wrap items-center justify-between gap-3 p-4 hover:border-accent" data-testid="m12-help-featured">
              <span>
                <span className="block font-semibold text-accent">{GUIDE_BY_ID['how-kafaa-works'].title[lang]}</span>
                <span className="mt-0.5 block text-[13px] text-ink-2">{GUIDE_BY_ID['how-kafaa-works'].summary[lang]}</span>
              </span>
              <Icon name="chevron" className="text-accent" />
            </L>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="m12-help-start">
              {START_HERE.map((x) => {
                const g = GUIDE_BY_ID[x.guide];
                return (
                  <li key={x.audience}>
                    <L to={`/help/${g.id}`} className="link-plain card flex h-full flex-col p-4 hover:border-accent" data-audience={x.audience}>
                      <span className="caps">{t(`m12.help.aud.${x.audience}`)}</span>
                      <span className="mt-1 font-semibold text-accent">{g.title[lang]}</span>
                      <span className="mt-1 flex-1 text-[13px] text-ink-2">{g.summary[lang]}</span>
                    </L>
                  </li>
                );
              })}
            </ul>
          </Section>

          {HELP_CATEGORIES.filter((c) => c !== 'start').map((c) => (
            <Section key={c} id={`cat-${c}`} title={t(`m12.help.cat.${c}`)}>
              <ul className="grid gap-3 sm:grid-cols-2" data-testid={`m12-help-cat-${c}`}>
                {GUIDES.filter((g) => g.category === c).map((g) => (
                  <li key={g.id}>
                    <L to={`/help/${g.id}`} className="link-plain card flex h-full flex-col p-4 hover:border-accent">
                      <span className="font-semibold text-accent">{g.title[lang]}</span>
                      <span className="mt-1 text-[13px] text-ink-2">{g.summary[lang]}</span>
                    </L>
                  </li>
                ))}
              </ul>
            </Section>
          ))}

          <Section id="glossary" title={t('m12.help.glossaryTitle')} description={t('m12.help.glossaryIntro', { n: items.length })} actions={<L to="/help/glossary" className="btn-outline btn-sm">{t('m12.help.glossaryOpen')}</L>}>
            <div className="card p-4" data-testid="m12-help-az">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {letters.map((g) => (
                  <div key={g.letter}>
                    <dt className="num text-[13px] font-semibold text-eyebrow">
                      <L to={`/help/glossary#${letterAnchor(g.letter)}`} className="link-plain">{g.letter}</L>
                    </dt>
                    <dd>
                      <ul className="mt-1 space-y-0.5 text-[13px]">
                        {g.items.map((it) => (
                          <li key={it.id}>
                            <L to={termHref(it.id)}>{it.term[lang]}</L>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Section>
        </>
      )}

      <Callout tone="info">{t('m12.help.concept')}</Callout>
    </Page>
  );
}
