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

export type Lang = 'en' | 'ar';
export type Digits = 'latn' | 'arab';
export type Calendar = 'gregorian' | 'hijri';
type Dict = Record<string, unknown>;

const files = import.meta.glob('./*.json', { eager: true, import: 'default' }) as Record<string, Dict>;
const DICTS: Record<Lang, Record<string, Dict>> = { en: {}, ar: {} };
for (const [path, dict] of Object.entries(files)) {
  const m = path.match(/\.\/(.+)\.(en|ar)\.json$/);
  if (m) DICTS[m[2] as Lang][m[1]] = dict;
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
  let s = lookup(lang, key) ?? lookup('en', key);
  if (s === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing ${key}`);
    return key;
  }
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
  return s;
}
export const hasKey = (key: string) => lookup('en', key) !== undefined;

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

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      localStorage.setItem(PREFS_KEY, JSON.stringify({ ...p, lang }));
    } catch {
      /* ignore */
    }
  }, [lang]);

  const setLang = useCallback(
    (l: Lang) => {
      if (l === lang) return;
      navigate(localPath(path, l) + location.search + location.hash);
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
    [lang, path, setLang, prefs, setPrefs],
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
