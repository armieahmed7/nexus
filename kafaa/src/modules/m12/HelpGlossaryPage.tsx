// M12 · Future-skills glossary (/help/glossary): A to Z in the page language, each term in English and Arabic with its
// definition, how Kafa'a uses it, where you meet it and a public source with the date it was read. Per-term anchors
// (#term-<id>) are deep-linked from the header search and the help centre; the plant and licensing terms come from the
// reviewed database glossary (also on the FAQ).
import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { L, useLang, useT } from '../../i18n';
import { Callout, Icon, Page, Skeleton, useFilters } from '../../ui';
import { foldText, termAnchor } from './help/search';
import { GoToLink, HelpSources, groupByLetter, letterAnchor, useMergedGlossary } from './help/ui';

export default function HelpGlossaryPage() {
  const t = useT();
  const lang = useLang();
  const other = lang === 'ar' ? 'en' : 'ar';
  const loc = useLocation();
  const [flt, setFlt] = useFilters({ q: '' }, true);
  const { items, loading } = useMergedGlossary();
  const target = safeDecode(loc.hash.replace(/^#/, ''));

  const shown = useMemo(() => {
    const words = foldText(flt.q).split(' ').filter(Boolean);
    if (!words.length) return items;
    return items.filter((i) => {
      const hay = foldText([i.term.en, i.term.ar, i.abbr ?? '', i.definition.en, i.definition.ar].join(' '));
      return words.every((w) => hay.includes(w));
    });
  }, [items, flt.q]);
  const groups = useMemo(() => groupByLetter(shown, lang), [shown, lang]);

  // Deep links: scroll the term (or letter) into view once the list is there, and move focus to it for keyboard users.
  useEffect(() => {
    if (!target || loading) return;
    const id = setTimeout(() => {
      const el = document.getElementById(target);
      if (!el) return;
      el.scrollIntoView?.({ block: 'start' });
      if (target.startsWith('term-')) el.focus?.({ preventScroll: true });
    }, 50);
    return () => clearTimeout(id);
  }, [target, loading]);

  return (
    <Page title={t('m12.routes.help-glossary.title')} intro={t('m12.help.gl.intro')} actions={<L to="/help" className="btn-outline btn-sm">{t('m12.help.back')}</L>}>
      <div role="search" className="card space-y-3 p-4">
        <label htmlFor="gl-q" className="caps block">
          {t('m12.help.gl.filterLabel')}
        </label>
        <div className="relative">
          <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input id="gl-q" type="search" className="input h-10 ps-9" value={flt.q} onChange={(e) => setFlt({ q: e.target.value })} placeholder={t('m12.help.searchPh')} autoComplete="off" aria-describedby="gl-count" data-testid="m12-gl-q" />
        </div>
        <p id="gl-count" className="text-[12.5px] text-ink-3" aria-live="polite">
          {t('m12.help.gl.count', { n: shown.length })}
        </p>
        {groups.length > 0 && (
          <nav aria-label={t('m12.help.gl.letters')} className="no-print">
            <ul className="flex flex-wrap gap-1">
              {groups.map((g) => (
                <li key={g.letter}>
                  <a href={`#${letterAnchor(g.letter)}`} className="link-plain num grid h-8 min-w-8 place-items-center rounded-btn border border-line px-2 text-[13px] font-semibold hover:bg-sunken">
                    {g.letter}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      {loading && <Skeleton lines={6} />}
      {!loading && shown.length === 0 && (
        <div className="card p-6 text-center" data-testid="m12-gl-none">
          <div className="font-semibold">{t('m12.help.gl.none')}</div>
          <p className="mt-1 text-ink-2">
            {t('m12.help.noResultsBody')} <L to="/ask">{t('m12.help.askDalil')}</L>
          </p>
        </div>
      )}

      <div className="space-y-6" data-testid="m12-glossary-list">
        {groups.map((g) => (
          <section key={g.letter} id={letterAnchor(g.letter)} aria-labelledby={`${letterAnchor(g.letter)}-h`} className="scroll-mt-24">
            <h2 id={`${letterAnchor(g.letter)}-h`} className="num mb-2 border-b border-line pb-1 text-[18px] font-semibold text-eyebrow">
              {g.letter}
            </h2>
            <dl className="space-y-3">
              {g.items.map((it) => {
                const anchor = termAnchor(it.id);
                return (
                  <div key={it.id} id={anchor} tabIndex={-1} className={`card scroll-mt-24 p-4 focus:outline-none ${target === anchor ? 'ring-2 ring-accent' : ''}`} data-term={it.id}>
                    <dt>
                      <span className="text-[16px] font-semibold">{it.term[lang]}</span>
                      {it.abbr && (
                        <span className="chip ms-2 border-line bg-sunken text-ink-2" lang="en" dir="ltr">
                          {it.abbr}
                        </span>
                      )}
                      {it.term[other] !== it.term[lang] && (
                        <span className="mt-0.5 block text-[13px] text-ink-3" lang={other} dir={other === 'ar' ? 'rtl' : 'ltr'}>
                          {it.term[other]}
                        </span>
                      )}
                    </dt>
                    <dd className="mt-2 space-y-2 text-[14px] text-ink-2">
                      <p>{it.definition[lang]}</p>
                      {it.inKafaa && (
                        <p>
                          <span className="font-semibold text-ink">{t('m12.help.gl.inKafaa')}: </span>
                          {it.inKafaa[lang]}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="caps">{t('m12.help.gl.where')}</span>
                        {it.where.map((w) => (
                          <GoToLink key={`${w.route}${w.hash ?? ''}`} link={w} className="btn-ghost btn-sm" />
                        ))}
                      </div>
                      {it.fromDb ? (
                        <p className="text-[12.5px] text-ink-3">{t('m12.help.gl.fromDb')}</p>
                      ) : (
                        <div className="text-[12.5px]">
                          <span className="caps me-2">{t('m12.help.sources')}</span>
                          <HelpSources sources={it.sources} />
                        </div>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>

      <Callout tone="info">{t('m12.help.gl.note')}</Callout>
    </Page>
  );
}

/** A malformed fragment (e.g. "#%") must not crash the page. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
