// M12 · Home: the front door of the upskilling platform. A clear promise, the four-step skills journey (discover, learn,
// prove, grow), the open future-skills frameworks, entry points by audience, and why the records can be trusted.
// No plant statistics here (those live on /about). Every link is a registered route: public ones open directly, staff ones
// go through /sign-in?next=… for signed-out visitors (see HOME_LINKS, checked by tests/unit/home-refresh.test.tsx).
import { useEffect } from 'react';
import { useSession } from '../../auth/session';
import { L, useT } from '../../i18n';
import { Icon, Section } from '../../ui';

/** A homepage link: a route path, its label key under m12.home, and whether it needs sign-in. */
export interface HomeLink {
  to: string;
  key: string;
  staff?: boolean;
}

export const JOURNEY: { id: 'discover' | 'learn' | 'prove' | 'grow'; icon: string; links: HomeLink[] }[] = [
  {
    id: 'discover',
    icon: 'search',
    links: [
      { to: '/skills', key: 'skills' },
      { to: '/careers/horizons', key: 'horizons' },
      { to: '/careers/translate', key: 'translate' },
    ],
  },
  {
    id: 'learn',
    icon: 'book',
    links: [
      { to: '/learn', key: 'catalogue' },
      { to: '/learn/academies', key: 'academies' },
      { to: '/learn/practice', key: 'practice' },
    ],
  },
  {
    id: 'prove',
    icon: 'check',
    links: [
      { to: '/recognition', key: 'recognition' },
      { to: '/verify', key: 'verify' },
      { to: '/verify/badge', key: 'badge' },
    ],
  },
  {
    id: 'grow',
    icon: 'chart',
    links: [
      { to: '/careers/plan', key: 'plan' },
      { to: '/careers/paths', key: 'paths' },
      { to: '/careers/next-gen', key: 'nextGen' },
    ],
  },
];

export const FOCUS: { id: 'ai' | 'core' | 'clean' | 'courses'; to: string; icon: string }[] = [
  { id: 'ai', to: '/learn/ai-fluency', icon: 'sparkle' },
  { id: 'core', to: '/learn/core-skills', icon: 'users' },
  { id: 'clean', to: '/skills/clean-energy', icon: 'globe' },
  { id: 'courses', to: '/learn/future-skills', icon: 'book' },
];

export const AUDIENCES: { id: 'staff' | 'talent' | 'managers' | 'partners'; icon: string; links: HomeLink[] }[] = [
  {
    id: 'staff',
    icon: 'user',
    links: [
      { to: '/my/skills', key: 'passport', staff: true },
      { to: '/my/coach', key: 'coach', staff: true },
      { to: '/my/mentoring', key: 'mentoring', staff: true },
    ],
  },
  {
    id: 'talent',
    icon: 'grad',
    links: [
      { to: '/pathways/journey', key: 'journey' },
      { to: '/pathways', key: 'programmes' },
      { to: '/ecosystem/consortium', key: 'consortium' },
    ],
  },
  {
    id: 'managers',
    icon: 'chart',
    links: [
      { to: '/team/skills', key: 'heatmap', staff: true },
      { to: '/workforce/critical-skills', key: 'critical', staff: true },
      { to: '/training/needs', key: 'needs', staff: true },
    ],
  },
  {
    id: 'partners',
    icon: 'briefcase',
    links: [
      { to: '/suppliers', key: 'suppliers' },
      { to: '/partners', key: 'directory' },
      { to: '/universities', key: 'universities' },
    ],
  },
];

export const TRUST: { id: 'verify' | 'nuclear' | 'bilingual' | 'ai'; icon: string; to: string }[] = [
  { id: 'verify', icon: 'shield', to: '/verify' },
  { id: 'nuclear', icon: 'link', to: '/skills/frameworks' },
  { id: 'bilingual', icon: 'globe', to: '/legal/accessibility' },
  { id: 'ai', icon: 'sparkle', to: '/ask' },
];

/** Where a homepage link goes: staff routes send signed-out visitors to sign in first, then on to the page. */
export function homeHref(link: HomeLink, signedIn: boolean): string {
  return link.staff && !signedIn ? `/sign-in?next=${encodeURIComponent(link.to)}` : link.to;
}

/** The four Kafa'a levels, shown as a rising scale in the hero (labels from the m02 scale). */
const LEVELS = ['l1', 'l2', 'l3', 'l4'] as const;

export default function HomePage() {
  const t = useT();
  const s = useSession();
  const signedIn = s.status === 'signed_in';
  useEffect(() => {
    document.title = `${t('shell.brand')} · ${t('m12.home.titleTag')}`;
  }, [t]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-12 px-4 py-6 sm:px-6 sm:py-8" data-testid="m12-home">
      {/* Hero */}
      <section className="card relative overflow-hidden" aria-labelledby="home-title" data-testid="m12-hero">
        <div className="frame-line absolute inset-x-0 top-0 h-1" aria-hidden />
        <div className="grid gap-8 p-5 sm:p-10 lg:grid-cols-[1.35fr_1fr] lg:items-center">
          <div>
            <div className="eyebrow">{t('m12.home.eyebrow')}</div>
            <h1 id="home-title" className="mt-3 max-w-2xl text-[30px] font-semibold leading-[1.15] sm:text-[42px]">
              {t('m12.home.title')}
            </h1>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-2">{t('m12.home.intro')}</p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <L to="/learn" className="btn-primary h-10 px-4 text-[14px]" data-testid="m12-cta-learn">
                {t('m12.home.ctaLearn')}
                <Icon name="chevron" size={14} />
              </L>
              {signedIn ? (
                <L to="/my" className="btn-outline h-10 px-4 text-[14px]" data-testid="m12-cta-my">
                  {t('m12.home.ctaMy')}
                </L>
              ) : (
                <L to="/sign-in" className="btn-outline h-10 px-4 text-[14px]" data-testid="m12-cta-signin">
                  {t('m12.home.ctaSignIn')}
                </L>
              )}
              <L to="/ask" className="btn-ghost h-10 px-3 text-[14px]" data-testid="m12-cta-ask">
                <Icon name="sparkle" className="text-accent" />
                {t('m12.home.ctaAsk')}
              </L>
            </div>
            <p className="mt-6 text-[12px] text-ink-3">{t('m12.home.concept')}</p>
          </div>

          {/* The skill scale: one picture of what upskilling means here */}
          <figure className="rounded-card border border-line bg-raised p-5" data-testid="m12-levels">
            <figcaption>
              <div className="caps">{t('m12.home.scale.eyebrow')}</div>
              <div className="mt-1 text-[15px] font-semibold">{t('m12.home.scale.title')}</div>
            </figcaption>
            <ol className="mt-4 grid h-32 grid-cols-4 gap-2 sm:h-44" aria-label={t('m12.home.scale.title')}>
              {LEVELS.map((l, i) => (
                <li key={l} className="flex h-full min-w-0 flex-col">
                  <div className="flex flex-1 items-end border-b border-line-strong" aria-hidden>
                    <div className={`w-full rounded-t-btn ${i === LEVELS.length - 1 ? 'bg-accent' : 'bg-accent/30'}`} style={{ height: `${25 + i * 25}%` }} />
                  </div>
                  <div className="mt-2 min-h-[2.6em] text-[11.5px] font-semibold leading-tight text-ink-2">{t(`m02.sc.band.${l}`)}</div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[12.5px] text-ink-2">{t('m12.home.scale.body')}</p>
            <L to="/competencies/levels" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold" data-testid="m12-levels-link">
              {t('m12.home.scale.link')}
              <Icon name="chevron" size={12} />
            </L>
          </figure>
        </div>
      </section>

      {/* How it works: the skills journey */}
      <Section title={t('m12.home.journeyTitle')} description={t('m12.home.journeyIntro')} id="journey">
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="m12-journey">
          {JOURNEY.map((step, i) => (
            <li key={step.id} className="card relative flex flex-col p-5" data-step={step.id}>
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-btn bg-accent-soft text-eyebrow">
                  <Icon name={step.icon} />
                </span>
                <span className="num text-[12px] font-semibold text-ink-3" aria-hidden>
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-3 text-[16px] font-semibold">
                <span className="sr-only">{t('m12.home.stepN', { n: i + 1 })} </span>
                {t(`m12.home.journey.${step.id}.title`)}
              </h3>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-ink-2">{t(`m12.home.journey.${step.id}.body`)}</p>
              <LinkList links={step.links} base={`m12.home.journey.${step.id}.links`} signedIn={signedIn} testid={`m12-journey-${step.id}`} />
            </li>
          ))}
        </ol>
      </Section>

      {/* Future skills in focus: the open frameworks */}
      <Section title={t('m12.home.focusTitle')} description={t('m12.home.focusIntro')} id="focus">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="m12-focus">
          {FOCUS.map((f) => (
            <li key={f.id}>
              <L to={f.to} className="link-plain card group flex h-full flex-col p-5 transition-colors hover:border-accent" data-testid={`m12-focus-${f.id}`}>
                <Icon name={f.icon} className="text-eyebrow" size={20} />
                <h3 className="mt-3 text-[15px] font-semibold group-hover:text-accent">{t(`m12.home.focus.${f.id}.title`)}</h3>
                <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-ink-2">{t(`m12.home.focus.${f.id}.body`)}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent">
                  {t('m12.home.focusOpen')}
                  <Icon name="chevron" size={12} />
                </span>
              </L>
            </li>
          ))}
        </ul>
      </Section>

      {/* Audiences */}
      <Section title={t('m12.home.audiencesTitle')} description={t('m12.home.audiencesIntro')} id="audiences">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="m12-audiences">
          {AUDIENCES.map((a) => (
            <article key={a.id} className="flex flex-col border-t-2 border-accent pt-4" data-audience={a.id}>
              <div className="flex items-center gap-2">
                <Icon name={a.icon} className="text-eyebrow" />
                <h3 className="text-[15px] font-semibold">{t(`m12.home.aud.${a.id}.title`)}</h3>
              </div>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-ink-2">{t(`m12.home.aud.${a.id}.body`)}</p>
              <LinkList links={a.links} base={`m12.home.aud.${a.id}.links`} signedIn={signedIn} testid={`m12-aud-${a.id}`} />
            </article>
          ))}
        </div>
      </Section>

      {/* Trust strip */}
      <section aria-labelledby="home-trust" className="rounded-card border border-line bg-raised p-6 sm:p-8" data-testid="m12-trust">
        <h2 id="home-trust" className="text-[18px] font-semibold">
          {t('m12.home.trustTitle')}
        </h2>
        <ul className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((x) => (
            <li key={x.id} className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-eyebrow">
                <Icon name={x.icon} size={15} />
              </span>
              <div>
                <h3 className="text-[14px] font-semibold">{t(`m12.home.trust.${x.id}.title`)}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{t(`m12.home.trust.${x.id}.body`)}</p>
                <L to={x.to} className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold" data-testid={`m12-trust-${x.id}`}>
                  {t(`m12.home.trust.${x.id}.link`)}
                  <Icon name="chevron" size={12} />
                </L>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Closing call to action */}
      <section className="card relative overflow-hidden p-6 sm:p-8" aria-labelledby="home-next" data-testid="m12-next">
        <div className="frame-line absolute inset-x-0 bottom-0 h-1" aria-hidden />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <h2 id="home-next" className="text-[20px] font-semibold">
              {t('m12.home.nextTitle')}
            </h2>
            <p className="mt-1.5 text-[14px] text-ink-2">{t('m12.home.nextBody')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <L to="/careers/plan" className="btn-primary" data-testid="m12-cta-plan">
              {t('m12.home.ctaPlan')}
            </L>
            <L to="/careers" className="btn-outline" data-testid="m12-cta-careers">
              {t('m12.home.ctaCareers')}
            </L>
          </div>
        </div>
      </section>
    </div>
  );
}

function LinkList({ links, base, signedIn, testid }: { links: HomeLink[]; base: string; signedIn: boolean; testid: string }) {
  const t = useT();
  return (
    <ul className="mt-4 space-y-2 border-t border-line pt-3 text-[13px]">
      {links.map((link) => {
        const locked = !!link.staff && !signedIn;
        return (
          <li key={link.to}>
            <L to={homeHref(link, signedIn)} className="inline-flex items-center gap-1.5 font-semibold" data-testid={`${testid}-${link.key}`}>
              {locked && <Icon name="lock" size={12} className="text-ink-3" />}
              {t(`${base}.${link.key}`)}
              {locked && <span className="sr-only"> ({t('m12.home.signInFirst')})</span>}
              {!locked && <Icon name="chevron" size={12} />}
            </L>
          </li>
        );
      })}
    </ul>
  );
}
