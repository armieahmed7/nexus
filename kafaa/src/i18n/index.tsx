/**
 * i18n (M15): English and Arabic with full RTL. Language lives in the URL: every route also exists under /ar/.
 * Dictionaries are split per module: src/i18n/<ns>.en.json and <ns>.ar.json (ns = shell, common, m01 ... m16).
 *   const t = useT();  t('shell.nav.careers')  t('m01.routes.careers.title')  t('common.count', { n: 3 })
 *   <L to="/careers">  keeps the current language prefix.   const nav = useNav(); nav('/my');
 *   const f = useFormat(); f.date('2026-10-08'); f.num(2979); f.pct(54.7)   (digit preference + optional Hijri)
 *   pick(row, 'title') returns row.title_ar in Arabic (falling back to English) and row.title_en otherwise.
 * scripts/check-i18n.mjs fails the build if any key exists in one language but not the other.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate, type LinkProps, type NavLinkProps } from 'react-router-dom';
import { localizeRef } from './refs';

export type Lang = 'en' | 'ar';
export type Digits = 'latn' | 'arab';
export type Calendar = 'gregorian' | 'hijri';
type Dict = Record<string, unknown>;

// Dictionaries load per language (audit 2026-10-13, finding 19): src/i18n/dict.<lang>.ts is one chunk per language, so the entry bundle
// carries neither. main.tsx waits for the page's language before the first render (no raw keys); the other language loads only when
// something asks for it (the language switch preloads it before navigating; bilingual helpers trigger it and re-render when it lands).
const LOADERS: Record<Lang, () => Promise<{ default: Record<string, Dict> }>> = { en: () => import('./dict.en'), ar: () => import('./dict.ar') };
const DICTS: Record<Lang, Record<string, Dict>> = { en: {}, ar: {} };
const LOADED: Record<Lang, boolean> = { en: false, ar: false };
const loading: Partial<Record<Lang, Promise<void>>> = {};
const listeners = new Set<() => void>();
export const isLangLoaded = (l: Lang) => LOADED[l];
export function loadLang(l: Lang): Promise<void> {
  if (LOADED[l]) return Promise.resolve();
  return (loading[l] ??= LOADERS[l]().then(
    (m) => {
      for (const [path, dict] of Object.entries(m.default)) {
        const x = path.match(/\.\/(.+)\.(en|ar)\.json$/);
        if (x) DICTS[l][x[1]] = dict;
      }
      LOADED[l] = true;
      listeners.forEach((f) => f());
    },
    (e: unknown) => {
      delete loading[l];
      throw e;
    },
  ));
}

function lookup(lang: Lang, key: string): string | undefined {
  const [ns, ...rest] = key.split('.');
  let cur: unknown = DICTS[lang][ns];
  for (const k of rest) {
    if (cur && typeof cur === 'object') cur = (cur as Dict)[k];
    else return undefined;
  }
  return typeof cur === 'string' ? cur : undefined;
}
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  if (!LOADED[lang]) void loadLang(lang).catch(() => undefined); // asked for a language not loaded yet: fetch it (listeners re-render)
  let s = lookup(lang, key) ?? lookup('en', key) ?? (LOADED.en ? undefined : lookup('ar', key));
  if (s === undefined) {
    if (import.meta.env.DEV && LOADED.en) console.warn(`[i18n] missing ${key}`);
    return key;
  }
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
  return s;
}
export const hasKey = (key: string) => (lookup('en', key) ?? lookup('ar', key)) !== undefined;

/** CLDR plural category of a count ('zero' | 'one' | 'two' | 'few' | 'many' | 'other'): Arabic uses all six, English one/other. */
export const pluralCategory = (lang: Lang, n: number): Intl.LDMLPluralRule => new Intl.PluralRules(lang === 'ar' ? 'ar' : 'en-GB').select(n);
/** A counted phrase: `key` is an object of plural forms ({ one, two, few, many, other, zero }); picks the form for `count`
 *  (falling back to `other`) and fills {n} with the already formatted number. */
export function translateCount(lang: Lang, key: string, count: number, vars: Record<string, string | number> = {}): string {
  const form = `${key}.${pluralCategory(lang, count)}`;
  return translate(lang, lookup(lang, form) ?? lookup('en', form) ? form : `${key}.other`, { n: count, ...vars });
}

/** Strip / add the /ar language prefix (router paths are relative to the /kafaa basename). */
export function splitLang(pathname: string): { lang: Lang; path: string } {
  if (pathname === '/ar' || pathname.startsWith('/ar/')) return { lang: 'ar', path: pathname.slice(3) || '/' };
  return { lang: 'en', path: pathname || '/' };
}
export function localPath(path: string, lang: Lang): string {
  if (/^(https?:|mailto:|tel:|#)/.test(path)) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  return lang === 'ar' ? (p === '/' ? '/ar' : `/ar${p}`) : p;
}

interface Prefs {
  digits: Digits;
  calendar: Calendar;
}
interface I18nValue {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  path: string; // current path without the language prefix
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLang: (l: Lang) => void;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
}
const I18nContext = createContext<I18nValue | null>(null);
const PREFS_KEY = 'kafaa.prefs.v1';

/** The language the visitor chose last (kafaa.prefs.v1 lang), or null. */
export function storedLang(): Lang | null {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') as { lang?: unknown };
    return p.lang === 'ar' || p.lang === 'en' ? p.lang : null;
  } catch {
    return null;
  }
}
function storeLang(l: Lang) {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...p, lang: l }));
  } catch {
    /* ignore */
  }
}
/**
 * Audit 2026-10-13 (finding 14): the stored language was written but never read. A visitor who last chose Arabic and enters through an
 * unprefixed link (a bookmark, a shared link, NEXUS) is sent to the /ar twin of that page; the redirect only ever adds /ar, so it cannot
 * loop. The stored value changes only through the language switch, so an explicit choice of English sticks and merely opening an /ar
 * link does not turn later English entries into Arabic. Returns the new pathname or null.
 */
export function preferredLangPath(pathname: string, basename: string, stored: Lang | null): string | null {
  if (stored !== 'ar') return null;
  const base = basename.replace(/\/$/, '');
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return null;
  const rest = pathname.slice(base.length) || '/';
  if (splitLang(rest).lang === 'ar') return null;
  return base + localPath(rest, 'ar');
}

function readPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') as Partial<Prefs> & { lang?: Lang };
    return { digits: p.digits === 'arab' ? 'arab' : 'latn', calendar: p.calendar === 'hijri' ? 'hijri' : 'gregorian' };
  } catch {
    return { digits: 'latn', calendar: 'gregorian' };
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang, path } = splitLang(location.pathname);
  const [prefs, setPrefsState] = useState<Prefs>(readPrefs);
  const [version, setVersion] = useState(0);

  // a dictionary that lands later (the other language, asked for by a bilingual helper) re-renders the tree
  useEffect(() => {
    const f = () => setVersion((n) => n + 1);
    listeners.add(f);
    if (!LOADED[lang]) void loadLang(lang).catch(() => undefined);
    return () => {
      listeners.delete(f);
    };
  }, [lang]);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    // the stored language changes only through the language switch (setLang): following an /ar or an unprefixed link is not a choice
  }, [lang]);

  const setLang = useCallback(
    (l: Lang) => {
      if (l === lang) return;
      storeLang(l);
      const to = localPath(path, l) + location.search + location.hash;
      // load the other language first, so the switch never shows English text in an RTL page (or keys)
      if (LOADED[l]) navigate(to);
      else void loadLang(l).catch(() => undefined).finally(() => navigate(to));
    },
    [lang, path, navigate, location.search, location.hash],
  );
  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState((cur) => {
      const next = { ...cur, ...p };
      try {
        const stored = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
        localStorage.setItem(PREFS_KEY, JSON.stringify({ ...stored, ...next }));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', path, t: (k, v) => translate(lang, k, v), setLang, prefs, setPrefs }),
    // version: a dictionary loaded after the first render changes t, so every consumer re-renders
    [lang, path, setLang, prefs, setPrefs, version],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}
export const useT = () => useI18n().t;
export const useLang = () => useI18n().lang;

/** Regulation/source reference in the current language: ref('FANR-REG-17 Art. 4') -> 'FANR-REG-17 المادة 4' on /ar. */
export { localizeRef } from './refs';
export function useRefText() {
  const lang = useLang();
  return useCallback((ref: string | null | undefined) => localizeRef(ref, lang), [lang]);
}

/** Bilingual field picker: pick(row, 'title') -> row.title_ar | row.title_en */
export function usePick() {
  const lang = useLang();
  return useCallback(
    (rowIn: object | null | undefined, field: string): string => {
      if (!rowIn) return '';
      const row = rowIn as Record<string, unknown>;
      const ar = row[`${field}_ar`];
      const en = row[`${field}_en`];
      return String((lang === 'ar' && ar ? ar : en) ?? row[field] ?? '');
    },
    [lang],
  );
}

/** Counted phrases with the right plural form and digits: const c = useCount(); c('common.nDays', 1) -> '1 day' / 'يوم واحد'. */
export function useCount() {
  const lang = useLang();
  const f = useFormat();
  return useCallback((key: string, count: number, vars: Record<string, string | number> = {}) => translateCount(lang, key, count, { n: f.num(count), ...vars }), [lang, f]);
}

export function useFormat() {
  const { lang, prefs } = useI18n();
  return useMemo(() => {
    const locale = `${lang === 'ar' ? 'ar-AE' : 'en-GB'}-u-nu-${prefs.digits}${prefs.calendar === 'hijri' ? '-ca-islamic-umalqura' : ''}`;
    const nf = new Intl.NumberFormat(locale);
    const toD = (d: string | Date) => (typeof d === 'string' ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d) : d);
    return {
      locale,
      num: (n: number | null | undefined, opts?: Intl.NumberFormatOptions) => (n == null ? '—' : opts ? new Intl.NumberFormat(locale, opts).format(n) : nf.format(n)),
      pct: (n: number | null | undefined, digits = 1) => (n == null ? '—' : new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n) + '%'),
      date: (d: string | Date | null | undefined, style: 'medium' | 'long' | 'short' = 'medium') => (d ? new Intl.DateTimeFormat(locale, { dateStyle: style, timeZone: 'UTC' }).format(toD(d)) : '—'),
      dateTime: (d: string | Date | null | undefined) => (d ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dubai' }).format(toD(d)) : '—'),
      relDays: (days: number) => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(days, 'day'),
    };
  }, [lang, prefs.digits, prefs.calendar]);
}

/** Language-preserving links. Use these instead of react-router's Link/NavLink inside Kafa'a. */
export function L({ to, ...rest }: Omit<LinkProps, 'to'> & { to: string }) {
  const lang = useLang();
  return <Link to={localPath(to, lang)} {...rest} />;
}
export function NL({ to, ...rest }: Omit<NavLinkProps, 'to'> & { to: string }) {
  const lang = useLang();
  return <NavLink to={localPath(to, lang)} {...rest} />;
}
export function useNav() {
  const navigate = useNavigate();
  const lang = useLang();
  return useCallback((to: string, opts?: { replace?: boolean }) => navigate(localPath(to, lang), opts), [navigate, lang]);
}

/** Country, framework-version and reactor-design values stored in English only (closed vocabularies), in the reader's language. */
export { countryKey, countryName, countryOptions, frameworkVersion, techDesigns } from './dataLabels';

/** Mirrored source-system names are stored in English; show the known ones in the reader's language. */
const SYSTEM_KEYS: Record<string, string> = {
  'Training records system': 'trs',
  'Licensee certification records (OCTS mirror)': 'octs',
  'Occupational health system (flag only)': 'ohs',
  'Shift roster feed (counts only)': 'roster',
};
export function systemName(t: (key: string) => string, name: string | null | undefined): string {
  const k = name ? SYSTEM_KEYS[name] : undefined;
  return k ? t(`common.systems.${k}`) : (name ?? '');
}

/** ENEC group entities. Their organisation rows are not public, so staff screens name them from here. */
export const ENEC_ENTITIES = ['enec', 'enec-ops', 'enec-com', 'enec-con'] as const;
export function entityName(t: (key: string) => string, id: string | null | undefined): string {
  return id && (ENEC_ENTITIES as readonly string[]).includes(id) ? t(`common.entities.${id}`) : (id ?? '');
}
