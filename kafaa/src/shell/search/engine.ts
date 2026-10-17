/**
 * Header search engine (pure, no React). Every item carries its English AND Arabic text, so a query in either language finds it
 * whatever the page language; the UI shows the page-language side. Query and index are folded the same way (foldText: Arabic
 * diacritics, hamza forms, ة/ه, ى/ي, tatweel, case and Latin accents), then split into words.
 *
 *  - Matching is AND: every query word must match a word of the item (title, alternative labels or body text).
 *  - A word matches exactly, as a prefix (the last word while typing, "reac" -> "reactor"), after the Arabic article
 *    ("امن" -> "الأمن"), as a singular ("operators" -> "operator"), or, from three letters, inside a word.
 *  - Ranking is field-weighted: title 3 > alternative labels 2 > body 1, times the match quality (exact 1, prefix 0.75,
 *    inside 0.4), plus a bonus when a title starts with (or equals) the whole query.
 *  - Results are grouped by kind with a count; each group shows its best few; groups are ordered by their best hit.
 */
import { foldText } from '../../domain/text';
import type { Lang } from '../../i18n';

export type Bi = { en: string; ar: string };
export const SEARCH_KINDS = ['page', 'guide', 'term', 'skill', 'role', 'programme', 'course', 'faq', 'framework', 'partner', 'news', 'benchmark'] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export interface SearchItem {
  key: string;
  kind: SearchKind;
  title: Bi;
  sub?: Bi;
  /** Path without the /ar prefix (may carry a #anchor or ?query). */
  to: string;
  /** Alternative labels, codes and abbreviations (any language). */
  alt?: string[];
  /** Body text (any language): summaries, definitions, answers. */
  body?: string[];
}

interface Indexed {
  item: SearchItem;
  order: number;
  title: string[];
  alt: string[];
  body: string[];
  /** Folded titles, one per language, for the starts-with bonus. */
  heads: string[];
}
export interface SearchIndex {
  items: Indexed[];
}

const AR_ARTICLE = /^(?:وال|بال|فال|كال|لل|ال)/;
/** Words plus their article-less form ("الامن" also indexes "امن"). */
function words(texts: (string | undefined)[]): string[] {
  const out = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const w of foldText(t).split(' ')) {
      if (!w) continue;
      out.add(w);
      const bare = w.replace(AR_ARTICLE, '');
      if (bare !== w && bare.length >= 2) out.add(bare);
    }
  }
  return [...out];
}

export function buildIndex(items: SearchItem[]): SearchIndex {
  return {
    items: items.map((item, order) => ({
      item,
      order,
      title: words([item.title.en, item.title.ar]),
      alt: words(item.alt ?? []),
      body: words([...(item.body ?? []), item.sub?.en, item.sub?.ar]),
      heads: [foldText(item.title.en), foldText(item.title.ar)].filter(Boolean),
    })),
  };
}

/** The query as folded words (empty query: none). */
export const queryWords = (q: string) => foldText(q).split(' ').filter(Boolean);

/** Match quality of one query word against one field's words: 1 exact, 0.75 prefix, 0.4 inside a word, 0 none. */
export function matchWord(q: string, field: string[]): number {
  let best = 0;
  for (const w of field) {
    if (w === q) return 1;
    if (w.startsWith(q)) best = Math.max(best, 0.75);
    else if (best < 0.4 && q.length >= 3 && w.includes(q)) best = 0.4;
  }
  return best;
}

const WEIGHTS = { title: 3, alt: 2, body: 1 } as const;
function wordScore(q: string, it: Indexed): number {
  const variants: [string, number][] = [[q, 1]];
  const bare = q.replace(AR_ARTICLE, '');
  if (bare !== q && bare.length >= 2) variants.push([bare, 0.9]);
  if (/^[a-z]{4,}s$/.test(q)) variants.push([q.slice(0, -1), 0.9]);
  let best = 0;
  for (const [v, k] of variants) {
    best = Math.max(best, k * WEIGHTS.title * matchWord(v, it.title), k * WEIGHTS.alt * matchWord(v, it.alt), k * WEIGHTS.body * matchWord(v, it.body));
  }
  return best;
}

/** Score of an item for the query words (0 = no match: some word matches nothing). */
export function scoreItem(qs: string[], it: Indexed, folded: string): number {
  let s = 0;
  for (const q of qs) {
    const w = wordScore(q, it);
    if (w === 0) return 0;
    s += w;
  }
  if (it.heads.some((h) => h === folded)) s += 3;
  else if (it.heads.some((h) => h.startsWith(folded))) s += 2;
  return s;
}

export interface Ranked {
  item: SearchItem;
  score: number;
}
export interface Group {
  kind: SearchKind;
  /** Every match of this kind. */
  total: number;
  /** The best few, in rank order. */
  hits: Ranked[];
}

/** All matches in rank order (ties: shorter title first, then index order). */
export function rank(index: SearchIndex, query: string, lang: Lang = 'en'): Ranked[] {
  const qs = queryWords(query);
  if (!qs.length) return [];
  const folded = qs.join(' ');
  const out: (Ranked & { order: number; len: number })[] = [];
  for (const it of index.items) {
    const score = scoreItem(qs, it, folded);
    if (score > 0) out.push({ item: it.item, score, order: it.order, len: (it.item.title[lang] || it.item.title.en).length });
  }
  out.sort((a, b) => b.score - a.score || a.len - b.len || a.order - b.order);
  return out.map(({ item, score }) => ({ item, score }));
}

/** Matches grouped by kind, best group first, at most `perGroup` hits shown per group. */
export function searchGrouped(index: SearchIndex, query: string, opts: { lang?: Lang; perGroup?: number } = {}): { groups: Group[]; total: number } {
  const perGroup = opts.perGroup ?? 5;
  const all = rank(index, query, opts.lang);
  const by = new Map<SearchKind, Group>();
  for (const r of all) {
    const g = by.get(r.item.kind) ?? { kind: r.item.kind, total: 0, hits: [] };
    g.total++;
    if (g.hits.length < perGroup) g.hits.push(r);
    by.set(r.item.kind, g);
  }
  // Map keeps first-insertion order and `all` is sorted, so groups are already ordered by their best hit.
  return { groups: [...by.values()], total: all.length };
}
