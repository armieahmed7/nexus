/**
 * Header search sources. Data loads once per backend and persona when the search first opens (not with the shell) and is
 * reused on every later open; it reloads only when one of its tables changes or the persona switches (the backend then emits
 * [] or the table names). Only public catalogue tables are read, and RLS decides what comes back. Benchmarks share the
 * <BenchmarkChip> cache, so a page that already shows chips costs no extra request.
 *
 * Items carry both languages; pages take their titles from the dictionaries (GlobalSearch loads the other language only when a
 * query is typed in it).
 * Every item links to a route, and items whose route the viewer cannot open are dropped (same guard check as navigation).
 */
import type { Repository } from '../../data/types';
import type { RowOf } from '../../data/types.gen';
import { loadBenchmarks } from '../../data/useBenchmarks';
import type { BenchmarkRow } from '../../domain/benchmarks';
import { ROUTES, routeForPath } from '../../routes/registry';
import type { RouteDef } from '../../routes/types';
import { checkGuard } from '../../auth/guards';
import type { Session } from '../../auth/session';
import type { Lang } from '../../i18n';
import type { SearchItem } from './engine';

type HelpModule = typeof import('../../modules/m12/help/search');

export interface SearchSources {
  roles: RowOf<'job_roles'>[];
  programmes: RowOf<'talent_programmes'>[];
  courses: RowOf<'courses'>[];
  partners: RowOf<'organisations'>[];
  glossary: RowOf<'glossary'>[];
  skills: RowOf<'skills'>[];
  frameworks: RowOf<'skill_frameworks'>[];
  faqs: RowOf<'faqs'>[];
  news: RowOf<'content_pages'>[];
  benchmarks: BenchmarkRow[];
  help: HelpModule | null;
}

const TABLES = ['job_roles', 'talent_programmes', 'courses', 'organisations', 'glossary', 'skills', 'skill_frameworks', 'faqs', 'content_pages', 'benchmarks'];
const cache = new WeakMap<Repository, Promise<SearchSources>>();
const watched = new WeakSet<Repository>();

/** One read per table per backend and persona; failures degrade to an empty source (the search still works). */
export function loadSearchSources(repo: Repository): Promise<SearchSources> {
  if (!watched.has(repo)) {
    watched.add(repo);
    repo.subscribe((changed) => {
      if (changed.length === 0 || changed.some((t) => TABLES.includes(t))) cache.delete(repo);
    });
  }
  let p = cache.get(repo);
  if (!p) {
    let failed = false;
    const none = () => {
      failed = true; // served empty this time, read again on the next open
      return [];
    };
    p = Promise.all([
      repo.list('job_roles').catch(none),
      repo.list('talent_programmes').catch(none),
      repo.list('courses', { filter: { audience: ['public', 'staff'] } }).catch(none),
      repo.list('organisations', { filter: { public_listed: true } }).catch(none),
      repo.list('glossary').catch(none),
      repo.list('skills', { order: [['sort', 'asc']] }).catch(none),
      repo.list('skill_frameworks', { order: [['sort', 'asc']] }).catch(none),
      repo.list('faqs', { order: [['sort', 'asc']] }).catch(none),
      repo.list('content_pages', { filter: { kind: 'news', is_published: true }, order: [['published_on', 'desc']] }).catch(none),
      loadBenchmarks(repo).catch(none),
      // Help centre guides and glossary (static, loaded with the search, not with the shell)
      import('../../modules/m12/help/search').catch(() => null),
    ]).then(([roles, programmes, courses, partners, glossary, skills, frameworks, faqs, news, benchmarks, help]) => {
      if (failed && cache.get(repo) === p) cache.delete(repo);
      return { roles, programmes, courses, partners, glossary, skills, frameworks, faqs, news, benchmarks, help };
    });
    cache.set(repo, p);
  }
  return p;
}

type Tr = (lang: Lang, key: string) => string;
const bi = (row: object, base: string): { en: string; ar: string } => {
  const r = row as Record<string, unknown>;
  const en = String(r[`${base}_en`] ?? '');
  const ar = String(r[`${base}_ar`] ?? '');
  return { en, ar: ar.trim() ? ar : en };
};
const mod = (def: RouteDef) => def.module.toLowerCase();

/** Pages the viewer may open (static paths only), titled and described in both languages. */
export function pageItems(s: Pick<Session, 'status' | 'roles'>, tr: Tr): SearchItem[] {
  return ROUTES.filter((r) => !r.path.includes(':') && checkGuard(r.guard, s) === 'ok').map((r) => {
    const k = `${mod(r)}.routes.${r.id}`;
    return {
      key: `route-${r.id}`,
      kind: 'page',
      title: { en: tr('en', `${k}.title`), ar: tr('ar', `${k}.title`) },
      sub: { en: tr('en', `${k}.purpose`), ar: tr('ar', `${k}.purpose`) },
      body: [r.path.replace(/[/-]+/g, ' ')],
      to: r.path,
    };
  });
}

/** The first static page each future-skills feature (FSnn) lives on, from the route specs ("FS25 /learn/core-skills · ..."). */
function featurePages(s: Pick<Session, 'status' | 'roles'>): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of ROUTES) {
    const m = r.spec?.match(/\bFS(\d{2})\b/);
    if (!m || r.path.includes(':') || checkGuard(r.guard, s) !== 'ok') continue;
    const id = `FS${m[1]}`;
    if (!out.has(id) || (r.zone === 'public' && routeForPath(out.get(id)!)?.def.zone !== 'public')) out.set(id, r.path);
  }
  return out;
}

/** Catalogue, help and reference items from the loaded sources. */
export function dataItems(src: SearchSources, s: Pick<Session, 'status' | 'roles'>): SearchItem[] {
  const help = src.help;
  const fsPage = featurePages(s);
  const items: SearchItem[] = [
    ...(help?.HELP_INDEX ?? []).map<SearchItem>((e) => ({ key: `help-${e.kind}-${e.id}`, kind: e.kind, title: e.title, sub: e.text, body: [e.hay], to: e.to })),
    ...src.skills.map<SearchItem>((r) => ({
      key: `s-${r.id}`,
      kind: 'skill',
      title: bi(r, 'name'),
      sub: bi(r, 'description'),
      alt: [r.code, ...(r.alt_labels_en ?? []), ...(r.alt_labels_ar ?? [])],
      body: [r.level_essence_en, r.level_essence_ar],
      to: `/skills/${encodeURIComponent(r.id)}`,
    })),
    ...src.roles.map<SearchItem>((r) => ({ key: `r-${r.id}`, kind: 'role', title: bi(r, 'title'), sub: bi(r, 'function'), body: [r.summary_en, r.summary_ar], to: `/careers/roles/${encodeURIComponent(r.id)}` })),
    ...src.programmes.map<SearchItem>((r) => ({ key: `p-${r.id}`, kind: 'programme', title: bi(r, 'name'), sub: bi(r, 'duration'), body: [r.facts_en, r.facts_ar, r.outcome_en, r.outcome_ar], to: `/pathways/${encodeURIComponent(r.id)}` })),
    ...src.courses.map<SearchItem>((r) => ({ key: `c-${r.id}`, kind: 'course', title: bi(r, 'title'), sub: { en: r.code, ar: r.code }, alt: [r.code], body: [r.summary_en, r.summary_ar], to: `/learn/course/${encodeURIComponent(r.id)}` })),
    ...src.faqs.map<SearchItem>((r) => ({ key: `f-${r.id}`, kind: 'faq', title: bi(r, 'q'), sub: bi(r, 'a'), to: `/faq#${encodeURIComponent(r.id)}` })),
    ...src.glossary
      .filter((r) => !help?.isReplacedDbTerm(r.id))
      .map<SearchItem>((r) => ({ key: `g-${r.id}`, kind: 'term', title: bi(r, 'term'), sub: bi(r, 'definition'), to: help ? help.termHref(r.id) : '/help/glossary' })),
    ...src.frameworks.map<SearchItem>((r) => ({ key: `fw-${r.id}`, kind: 'framework', title: bi(r, 'name'), sub: bi(r, 'owner'), alt: [r.short], body: [r.scope_en, r.scope_ar], to: '/skills/frameworks' })),
    ...src.partners.map<SearchItem>((r) => ({ key: `o-${r.id}`, kind: 'partner', title: bi(r, 'name'), sub: bi(r, 'relationship'), alt: r.short ? [r.short] : [], to: `/partners/${encodeURIComponent(r.id)}` })),
    ...src.news.map<SearchItem>((r) => ({ key: `n-${r.id}`, kind: 'news', title: bi(r, 'title'), sub: bi(r, 'summary'), to: `/${r.slug}` })),
    ...src.benchmarks.flatMap<SearchItem>((r) => {
      const page = (r.feature_ids ?? []).map((f) => fsPage.get(f)).find(Boolean);
      return page ? [{ key: `b-${r.id}`, kind: 'benchmark', title: bi(r, 'name'), sub: bi(r, 'owner'), alt: [r.id], body: [r.fact_en, r.fact_ar], to: page }] : [];
    }),
  ];
  return items.filter((it) => canOpen(it.to, s));
}

/** The guard check navigation uses, on the item's path (query and anchor ignored). */
export function canOpen(to: string, s: Pick<Session, 'status' | 'roles'>): boolean {
  const hit = routeForPath(to.split(/[?#]/)[0]);
  return !!hit && checkGuard(hit.def.guard, s) === 'ok';
}
