// M12 · Future-skills programme explainer (/future-skills, public): the twelve themes as a compact map and as cards (what it is,
// who it helps, what you can do on Kafa'a, "Explore" buttons into the real pages, the benchmarks it follows most), then how the
// skills data is kept honest, using only what the app already holds: the benchmark registry (kafaa_benchmarks, with sources and
// as-of dates), the decay classes and review cycles (src/domain/taxonomy.ts), lifecycle states and the synthetic-data notice.
// Content: src/modules/m12/orient/themes.ts. Complements /learn/future-skills (the course pack) rather than repeating it.
import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { L, useFormat, useLang, useT } from '../../i18n';
import { BenchmarkChip, BenchmarkChips, Callout, Icon, Page, Section } from '../../ui';
import { useBenchmarks } from '../../data/useBenchmarks';
import { DECAY_CLASSES, DECAY_HALF_LIFE_MONTHS, LIFECYCLES, REVIEW_CYCLE_MONTHS } from '../../domain/taxonomy';
import { GoToLink } from './help/ui';
import { THEMES, THEME_BANDS, themeBenchmarks, type FsTheme } from './orient/themes';

export const themeAnchor = (id: string) => `theme-${id}`;

export default function FutureSkillsPage() {
  const t = useT();
  const lang = useLang();
  const { hash } = useLocation();
  // Deep links (/future-skills#theme-ai, used by "Find my route"): bring the theme card into view and focus it.
  useEffect(() => {
    const id = hash.replace(/^#/, '');
    if (!id.startsWith('theme-')) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView?.({ block: 'start' });
      el?.focus?.({ preventScroll: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [hash]);
  return (
    <Page
      title={t('m12.routes.future-skills.title')}
      eyebrow={t('m12.fsx.eyebrow')}
      intro={t('m12.fsx.intro')}
      actions={
        <>
          <L to="/start" className="btn-primary btn-sm no-underline" data-testid="m12-fsx-route">
            {t('m12.fsx.findRoute')}
            <Icon name="chevron" size={12} />
          </L>
          <button type="button" className="btn-outline btn-sm no-print" onClick={() => window.print()} data-testid="m12-fsx-print">
            {t('m12.fsx.print')}
          </button>
        </>
      }
    >
      {/* The map: twelve themes in three bands, each a jump link to its card */}
      <section aria-labelledby="fsx-map" className="card p-4 sm:p-5" data-testid="m12-fsx-map">
        <h2 id="fsx-map" className="text-[18px] font-semibold">
          {t('m12.fsx.mapTitle')}
        </h2>
        <p className="mt-0.5 text-ink-2">{t('m12.fsx.mapIntro')}</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {THEME_BANDS.map((band) => (
            <div key={band} className="min-w-0 border-t-2 border-accent pt-3">
              <h3 className="caps">{t(`m12.fsx.band.${band}`)}</h3>
              <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
                {THEMES.filter((x) => x.band === band).map((x) => (
                  <li key={x.id}>
                    <a href={`#${themeAnchor(x.id)}`} className="link-plain flex items-center gap-2 rounded-btn px-2 py-1.5 text-[13.5px] font-semibold hover:bg-sunken" data-testid={`m12-fsx-jump-${x.id}`}>
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-eyebrow" aria-hidden>
                        <Icon name={x.icon} size={14} />
                      </span>
                      <span className="min-w-0">{x.title[lang]}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {THEME_BANDS.map((band) => (
        <Section key={band} title={t(`m12.fsx.band.${band}`)} description={t(`m12.fsx.bandIntro.${band}`)}>
          <div className="grid gap-4 md:grid-cols-2" data-testid={`m12-fsx-band-${band}`}>
            {THEMES.filter((x) => x.band === band).map((x) => (
              <ThemeCard key={x.id} theme={x} />
            ))}
          </div>
        </Section>
      ))}
      <p className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
        <Icon name="lock" size={12} />
        {t('m12.fsx.lockNote')}
      </p>

      <Honest />

      <section className="card relative overflow-hidden p-5 sm:p-6 no-print" aria-labelledby="fsx-next" data-testid="m12-fsx-next">
        <div className="frame-line absolute inset-x-0 bottom-0 h-1" aria-hidden />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <h2 id="fsx-next" className="text-[18px] font-semibold">
              {t('m12.fsx.nextTitle')}
            </h2>
            <p className="mt-1 text-[14px] text-ink-2">{t('m12.fsx.nextBody')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <L to="/start" className="btn-primary no-underline">
              {t('m12.fsx.findRoute')}
            </L>
            <L to="/help" className="btn-outline no-underline">
              {t('m12.routes.help.title')}
            </L>
          </div>
        </div>
      </section>
    </Page>
  );
}

function ThemeCard({ theme: x }: { theme: FsTheme }) {
  const t = useT();
  const lang = useLang();
  return (
    <article id={themeAnchor(x.id)} tabIndex={-1} className="card flex scroll-mt-24 flex-col p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-labelledby={`${themeAnchor(x.id)}-h`} data-testid={`m12-fsx-theme-${x.id}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-btn bg-accent-soft text-eyebrow" aria-hidden>
          <Icon name={x.icon} />
        </span>
        <h3 id={`${themeAnchor(x.id)}-h`} className="text-[16px] font-semibold leading-snug">
          {x.title[lang]}
        </h3>
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{x.what[lang]}</p>
      <h4 className="caps mt-4">{t('m12.fsx.who')}</h4>
      <p className="mt-1 text-[13.5px] text-ink-2">{x.who[lang]}</p>
      <h4 className="caps mt-4">{t('m12.fsx.doHere')}</h4>
      <ul className="mt-1 list-disc space-y-1 ps-5 text-[13.5px] text-ink-2">
        {x.doHere.map((d, i) => (
          <li key={i}>{d[lang]}</li>
        ))}
      </ul>
      <h4 className="caps mt-4">{t('m12.fsx.explore')}</h4>
      <div className="mt-1.5 flex flex-wrap gap-2" data-testid={`m12-fsx-explore-${x.id}`}>
        {x.explore.map((l) => (
          <GoToLink key={l.route} link={l} />
        ))}
      </div>
      <div className="mt-auto pt-4">
        <BenchmarkChips ids={themeBenchmarks(x)} label={t('m12.fsx.follows')} />
      </div>
    </article>
  );
}

/** How the skills data is kept honest: benchmarks with sources, evidence decay, lifecycle and change log, synthetic data. */
function Honest() {
  const t = useT();
  const f = useFormat();
  const q = useBenchmarks();
  const published = useMemo(() => (q.data ?? []).filter((b) => b.status === 'published'), [q.data]);
  const lastRead = useMemo(() => published.reduce<string>((m, b) => (b.as_of && b.as_of > m ? b.as_of : m), ''), [published]);
  return (
    <Section title={t('m12.fsx.honest.title')} description={t('m12.fsx.honest.intro')} id="honest">
      <div className="grid gap-4 lg:grid-cols-3" data-testid="m12-fsx-honest">
        <article className="card flex flex-col p-5">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold">
            <Icon name="book" className="text-eyebrow" />
            {t('m12.fsx.honest.bmTitle')}
          </h3>
          <p className="mt-2 text-[13.5px] text-ink-2">{t('m12.fsx.honest.bmBody')}</p>
          {published.length > 0 && (
            <>
              <p className="mt-2 text-[12.5px] font-semibold" data-testid="m12-fsx-bm-count">
                {t('m12.fsx.honest.bmCount', { n: f.num(published.length), date: f.date(lastRead) })}
              </p>
              <details className="mt-2 text-[13px]" data-testid="m12-fsx-bm-all">
                <summary className="cursor-pointer font-semibold text-accent">{t('m12.fsx.honest.bmShow')}</summary>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {published.map((b) => (
                    <BenchmarkChip key={b.id} id={b.id} row={b} />
                  ))}
                </div>
              </details>
            </>
          )}
        </article>

        <article className="card flex flex-col p-5">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold">
            <Icon name="calendar" className="text-eyebrow" />
            {t('m12.fsx.honest.decayTitle')}
          </h3>
          <p className="mt-2 text-[13.5px] text-ink-2">{t('m12.fsx.honest.decayBody')}</p>
          <table className="mt-3 w-full text-[13px]" data-testid="m12-fsx-decay">
            <caption className="sr-only">{t('m12.fsx.honest.decayCaption')}</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="caps py-1.5 pe-2 text-start">{t('m12.fsx.honest.decayClass')}</th>
                <th scope="col" className="caps py-1.5 pe-2 text-start">{t('m12.fsx.honest.halfLife')}</th>
                <th scope="col" className="caps py-1.5 text-start">{t('m12.fsx.honest.review')}</th>
              </tr>
            </thead>
            <tbody>
              {DECAY_CLASSES.map((c) => (
                <tr key={c} className="border-b border-line/60" data-decay={c}>
                  <th scope="row" className="py-1.5 pe-2 text-start font-semibold">{t(`fs.decayShort.${c}`)}</th>
                  <td className="py-1.5 pe-2">{t('m12.fsx.honest.months', { n: f.num(DECAY_HALF_LIFE_MONTHS[c]) })}</td>
                  <td className="py-1.5">{t('m12.fsx.honest.months', { n: f.num(REVIEW_CYCLE_MONTHS[c]) })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-auto pt-3">
            <GoToLink link={{ route: 'help-guide', params: { guide: 'reading-a-skill' } }} className="btn-ghost btn-sm" label={t('m12.fsx.honest.readMore')} />
          </div>
        </article>

        <article className="card flex flex-col p-5">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold">
            <Icon name="reset" className="text-eyebrow" />
            {t('m12.fsx.honest.lifeTitle')}
          </h3>
          <p className="mt-2 text-[13.5px] text-ink-2">{t('m12.fsx.honest.lifeBody')}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t('m12.fsx.honest.lifeTitle')}>
            {LIFECYCLES.map((l) => (
              <li key={l} className="chip border-line bg-sunken text-ink-2">
                {t(`fs.lifecycle.${l}`)}
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-wrap gap-2 pt-3">
            <GoToLink link={{ route: 'skills-changes' }} className="btn-ghost btn-sm" />
            <GoToLink link={{ route: 'skills-datasheet' }} className="btn-ghost btn-sm" />
          </div>
        </article>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Callout tone="sim" title={t('m12.fsx.honest.simTitle')}>
          {t('m12.fsx.honest.simBody')}{' '}
          <L to="/help/demo-and-data" className="font-semibold">
            {t('m12.fsx.honest.readMore')}
          </L>
        </Callout>
        <Callout tone="info" title={t('m34.ui.notAuthTitle')}>
          {t('m12.fsx.honest.authBody')}
        </Callout>
      </div>
    </Section>
  );
}
