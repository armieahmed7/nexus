/**
 * Kafa'a shell: header (brand, search, language, notices, backend, account), lens switcher,
 * role-aware navigation, breadcrumbs, footer with the concept disclaimer, Rehearsal chip and the Dalil launcher.
 */
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useSession, roleLabel } from '../auth/session';
import { L, NL, useI18n, useNav, useT } from '../i18n';
import { Icon } from '../ui/Icon';
import { Skeleton } from '../ui/Page';
import { routeForPath, ROUTE_BY_ID } from '../routes/registry';
import type { Lens, RouteDef } from '../routes/types';
import { sections, useAccessibleNav, zoneLens } from './access';
import { CrumbProvider, useCrumbState } from './crumbs';
import { GlobalSearch } from './GlobalSearch';
import { Notifications } from './Notifications';
import { DalilLauncher } from './DalilLauncher';
import { routeTitle, isRehearsal } from './util';
import { useToast } from '../ui/Toast';

function useCurrentRoute(): RouteDef | null {
  const { path } = useI18n();
  return routeForPath(path)?.def ?? null;
}

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('kafaa.theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('kafaa.theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  return [theme, setTheme] as const;
}

export function Layout() {
  const current = useCurrentRoute();
  const lens: Lens = current ? zoneLens(current.zone) : 'public';
  const { byLens } = useAccessibleNav();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const sidebar = lens !== 'public' && byLens[lens].length > 0;
  return (
    <CrumbProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-[80] focus:rounded focus:bg-panel focus:p-2">
        <SkipLabel />
      </a>
      <div className="flex min-h-screen flex-col bg-bg text-ink">
        <Header lens={lens} onMenu={() => setMenuOpen((v) => !v)} />
        <RehearsalBanner />
        {lens === 'public' && <PublicNav />}
        <div className={`flex-1 ${sidebar ? 'mx-auto grid w-full max-w-[1400px] lg:grid-cols-[240px_1fr]' : ''}`}>
          {sidebar && <SideNav lens={lens} open={menuOpen} />}
          <main id="main" tabIndex={-1} className="min-w-0 focus:outline-none">
            {current && current.id !== 'home' && <Breadcrumbs route={current} />}
            <Suspense fallback={<div className="mx-auto max-w-6xl p-6"><Skeleton lines={6} /></div>}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        <Footer />
        <DalilLauncher route={current} />
      </div>
    </CrumbProvider>
  );
}
function SkipLabel() {
  return <>{useT()('shell.skipToContent')}</>;
}

function Brand() {
  const t = useT();
  return (
    <L to="/" className="link-plain flex items-center gap-2" aria-label={t('shell.brandHome')}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="rgb(var(--eyebrow))" />
        <path d="M9 23V9m0 7 9-7m-6 5 8 9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="23" cy="10" r="2.4" fill="rgb(var(--leaf))" />
      </svg>
      <span className="leading-tight">
        <span className="block text-[15px] font-bold">{t('shell.brand')}</span>
        <span className="caps hidden !text-[9.5px] min-[420px]:block">{t('shell.brandSub')}</span>
      </span>
    </L>
  );
}

function Header({ lens, onMenu }: { lens: Lens; onMenu: () => void }) {
  const t = useT();
  const { lang, setLang } = useI18n();
  const s = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement))) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-panel/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-3 sm:px-4">
        {lens !== 'public' && (
          <button className="btn-ghost btn-sm lg:hidden" onClick={onMenu} aria-label={t('shell.menu')}>
            <Icon name="menu" />
          </button>
        )}
        {/* No "Back to NEXUS" link: Kafa'a stands on its own as the upskilling platform (homepage refresh, 2026-10-13). */}
        <Brand />
        <div className="ms-auto flex min-w-0 items-center gap-0.5 sm:gap-1">
          <button className="btn-ghost btn-sm" onClick={() => setSearchOpen(true)} aria-label={t('shell.search.open')} data-testid="open-search">
            <Icon name="search" />
            <span className="hidden md:inline">{t('shell.search.open')}</span>
            <kbd className="ms-1 hidden rounded border border-line px-1 text-[10px] text-ink-3 md:inline">/</kbd>
          </button>
          <button className="btn-ghost btn-sm" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} lang={lang === 'ar' ? 'en' : 'ar'} aria-label={lang === 'ar' ? 'English' : 'العربية'} data-testid="lang-toggle">
            <Icon name="globe" />
            {/* Icon only on phones: the full header would otherwise scroll sideways at 390 px (E2E QA). */}
            <span className="hidden sm:inline">{lang === 'ar' ? 'English' : 'العربية'}</span>
          </button>
          {s.status === 'signed_in' && <Notifications />}
          <BackendChip />
          <AccountMenu />
        </div>
      </div>
      <div className="frame-line h-[2px]" />
      <LensSwitcher lens={lens} />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}

function LensSwitcher({ lens }: { lens: Lens }) {
  const t = useT();
  const { lenses, home } = useAccessibleNav();
  if (lenses.length <= 1) return null;
  return (
    <nav aria-label={t('shell.lens.label')} className="border-b border-line bg-raised">
      <div className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-3 sm:px-4">
        {lenses.map((l) => (
          <L key={l} to={home(l)} className={`link-plain whitespace-nowrap border-b-2 px-3 py-2 text-[12.5px] font-semibold ${l === lens ? 'border-accent text-ink' : 'border-transparent text-ink-2 hover:text-ink'}`} aria-current={l === lens ? 'page' : undefined} data-testid={`lens-${l}`}>
            {t(`shell.lens.${l}`)}
          </L>
        ))}
      </div>
    </nav>
  );
}

function PublicNav() {
  const t = useT();
  const { byLens } = useAccessibleNav();
  const groups = sections(byLens.public);
  const [open, setOpen] = useState<string | null>(null);
  const location = useLocation();
  useEffect(() => setOpen(null), [location.pathname]);
  return (
    <nav aria-label={t('shell.nav.primary')} className="border-b border-line bg-panel">
      <ul className="mx-auto flex max-w-[1400px] flex-wrap gap-x-1 px-3 sm:px-4">
        {groups.map((g) =>
          g.items.length === 1 ? (
            <li key={g.section}>
              <NL to={g.items[0].path} end className={({ isActive }) => `link-plain block px-2.5 py-2.5 text-[13px] font-semibold ${isActive ? 'text-accent' : 'text-ink-2 hover:text-ink'}`}>
                {t(`shell.sections.${g.section}`)}
              </NL>
            </li>
          ) : (
            <li key={g.section} className="relative" onMouseLeave={() => setOpen(null)}>
              <button className="flex items-center gap-1 px-2.5 py-2.5 text-[13px] font-semibold text-ink-2 hover:text-ink" aria-expanded={open === g.section} onClick={() => setOpen(open === g.section ? null : g.section)} onMouseEnter={() => setOpen(g.section)}>
                {t(`shell.sections.${g.section}`)}
                <Icon name="chevronDown" size={12} />
              </button>
              {open === g.section && (
                <ul className="card absolute start-0 top-full z-30 min-w-[220px] p-1.5">
                  {g.items.map((r) => (
                    <li key={r.id}>
                      <NL to={r.path} end className={({ isActive }) => `link-plain block rounded-btn px-2.5 py-1.5 text-[13px] ${isActive ? 'bg-navactive font-semibold' : 'hover:bg-sunken'}`}>
                        {routeTitle(t, r)}
                      </NL>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

function SideNav({ lens, open }: { lens: Lens; open: boolean }) {
  const t = useT();
  const { byLens } = useAccessibleNav();
  return (
    <nav aria-label={t('shell.nav.section')} className={`${open ? 'block' : 'hidden'} border-b border-line bg-panel p-3 lg:block lg:border-b-0 lg:border-e lg:bg-transparent`} data-testid="side-nav">
      {sections(byLens[lens]).map((g) => (
        <div key={g.section} className="mb-4">
          <div className="caps mb-1 px-2">{t(`shell.sections.${g.section}`)}</div>
          <ul>
            {g.items.map((r) => (
              <li key={r.id}>
                <NL to={r.path} end className={({ isActive }) => `link-plain block rounded-btn px-2 py-1.5 text-[13px] ${isActive ? 'bg-navactive font-semibold text-ink' : 'text-ink-2 hover:bg-sunken hover:text-ink'}`}>
                  {routeTitle(t, r)}
                </NL>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Breadcrumbs({ route }: { route: RouteDef }) {
  const t = useT();
  const last = useCrumbState();
  const chain: RouteDef[] = [];
  let cur: RouteDef | undefined = route;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.parent ? ROUTE_BY_ID[cur.parent] : undefined;
  }
  if (chain[0]?.id !== 'home') chain.unshift(ROUTE_BY_ID.home);
  return (
    <nav aria-label={t('shell.breadcrumbs')} className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
      <ol className="flex flex-wrap items-center gap-1 text-[12.5px] text-ink-3">
        {chain.map((r, i) => {
          const isLast = i === chain.length - 1;
          const label = isLast && last ? last : routeTitle(t, r);
          return (
            <li key={r.id} className="flex items-center gap-1">
              {isLast || r.path.includes(':') ? (
                <span aria-current={isLast ? 'page' : undefined} className={isLast ? 'text-ink-2' : ''}>
                  {label}
                </span>
              ) : (
                <L to={r.path} className="text-ink-3 hover:text-ink">
                  {label}
                </L>
              )}
              {!isLast && <Icon name="chevron" size={12} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function BackendChip() {
  const t = useT();
  const s = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className={`chip ${s.backend === 'local' ? 'border-sim-line bg-sim-bg text-sim' : 'border-ok-line bg-ok-bg text-ok'}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={t(`shell.backend.${s.backend}`)} title={t(`shell.backend.${s.backend}`)} data-testid="backend-chip" data-backend={s.backend}>
        <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-current sm:hidden" />
        <span className="hidden sm:inline">{t(`shell.backend.${s.backend}`)}</span>
      </button>
      {open && (
        <div className="card absolute end-0 top-full z-50 mt-1 w-72 p-3 text-[13px]" onMouseLeave={() => setOpen(false)}>
          <p className="text-ink-2">{t(`shell.backend.${s.backend}Help`)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {s.backend === 'local' && (
              <button
                className="btn-outline btn-sm"
                data-testid="reset-demo"
                onClick={async () => {
                  await s.repo.reset?.();
                  toast.push({ tone: 'ok', title: t('shell.backend.resetDone') });
                  setOpen(false);
                }}
              >
                <Icon name="reset" size={14} />
                {t('shell.backend.reset')}
              </button>
            )}
            <button className="btn-ghost btn-sm" onClick={() => s.switchBackend(s.backend === 'local' ? 'supabase' : 'local')} data-testid="switch-backend">
              {t(s.backend === 'local' ? 'shell.backend.useLive' : 'shell.backend.useLocal')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const t = useT();
  const s = useSession();
  const { lang, prefs } = useI18n();
  const nav = useNav();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  if (s.status !== 'signed_in') {
    return (
      <L to="/sign-in" className="btn-primary btn-sm" data-testid="sign-in-link">
        {t('shell.signIn')}
      </L>
    );
  }
  const name = s.person ? (lang === 'ar' ? s.person.display_name_ar || s.person.display_name : s.person.display_name) : (s.identity.personaId ?? '');
  return (
    <div className="relative">
      <button className="btn-ghost btn-sm" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-testid="account-menu">
        <Icon name="user" />
        <span className="hidden max-w-[160px] truncate md:inline">{s.persona ? (lang === 'ar' ? s.persona.title_ar : s.persona.title_en) : name}</span>
      </button>
      {open && (
        <div className="card absolute end-0 top-full z-50 mt-1 w-72 p-3 text-[13px]" onMouseLeave={() => setOpen(false)}>
          <div className="font-semibold">{name}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {s.roles.filter((r) => r !== 'public').map((r) => (
              <span key={r} className="chip border-line bg-sunken text-ink-2">
                {roleLabel(r, lang)}
              </span>
            ))}
          </div>
          <div className="mt-3 grid gap-1">
            <L to="/my/profile" className="link-plain rounded-btn px-2 py-1.5 hover:bg-sunken">{t('shell.account.profile')}</L>
            <L to="/my/settings" className="link-plain rounded-btn px-2 py-1.5 hover:bg-sunken">{t('shell.account.settings')}</L>
            <button className="rounded-btn px-2 py-1.5 text-start hover:bg-sunken" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {t(theme === 'dark' ? 'shell.account.light' : 'shell.account.dark')}
            </button>
            <L to="/sign-in" className="link-plain rounded-btn px-2 py-1.5 hover:bg-sunken">{t('shell.account.switch')}</L>
            <button
              className="rounded-btn px-2 py-1.5 text-start text-bad hover:bg-bad-bg"
              data-testid="sign-out"
              onClick={() => {
                s.signOut();
                setOpen(false);
                nav('/');
              }}
            >
              {t('shell.signOut')}
            </button>
          </div>
          <div className="caps mt-2 px-2">{t('shell.account.digits', { d: prefs.digits === 'arab' ? '٠١٢' : '012' })}</div>
        </div>
      )}
    </div>
  );
}

function RehearsalBanner() {
  const t = useT();
  const s = useSession();
  if (!isRehearsal()) return null;
  return (
    <div className="border-b border-sim-line bg-sim-bg px-4 py-1.5 text-center text-[12.5px] text-sim" role="status" data-testid="rehearsal-banner">
      <span className="font-semibold">{t('shell.rehearsal.title')}</span> {t(s.backend === 'supabase' ? 'shell.rehearsal.supabase' : 'shell.rehearsal.local')}
      {s.backend === 'supabase' && (
        <button className="ms-2 underline" onClick={() => s.switchBackend('local')}>
          {t('shell.backend.useLocal')}
        </button>
      )}
    </div>
  );
}

function Footer() {
  const t = useT();
  return (
    <footer className="mt-10 border-t border-line bg-panel">
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Brand />
          <p className="mt-3 text-[12.5px] text-ink-2">{t('shell.footer.tagline')}</p>
        </div>
        <FooterCol title={t('shell.footer.explore')} links={[['/careers', 'm01.routes.careers.title'], ['/pathways', 'm06.routes.pathways.title'], ['/learn', 'm04.routes.learn.title'], ['/partners', 'm09.routes.partners.title']]} />
        <FooterCol title={t('shell.footer.help')} links={[['/faq', 'm12.routes.faq.title'], ['/contact', 'm12.routes.contact.title'], ['/verify', 'm02.routes.verify.title'], ['/speak-up', 'm08.routes.speak-up.title'], ['/emergency', 'm12.routes.emergency.title']]} />
        <FooterCol title={t('shell.footer.legal')} links={[['/legal/terms', 'shell.footer.terms'], ['/legal/privacy', 'shell.footer.privacy'], ['/legal/accessibility', 'shell.footer.accessibility']]} />
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-[12px] text-ink-3">
          <span data-testid="concept-disclaimer">{t('shell.footer.disclaimer')}</span>
          <span>{t('shell.footer.partOf')}</span>
        </div>
      </div>
    </footer>
  );
}
function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  const t = useT();
  return (
    <div>
      <div className="caps mb-2">{title}</div>
      <ul className="space-y-1 text-[13px]">
        {links.map(([to, key]) => (
          <li key={to}>
            <L to={to} className="text-ink-2 hover:text-ink">
              {t(key)}
            </L>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ShellFrame({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
