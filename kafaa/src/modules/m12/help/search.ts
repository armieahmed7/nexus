// M12 · Help centre search: client-side, bilingual and Arabic-normalised. A query matches a guide or a glossary term when
// every word of the query appears in its English or Arabic text, whatever the page language. Arabic is folded first:
// diacritics (tashkeel, shadda) and tatweel are removed, أ إ آ ٱ become ا, ة becomes ه and ى becomes ي, so "مشغل" also finds
// "مشغّل" and "امن" finds "أمن". Pure functions, shared by /help, /help/glossary, the header search and tests.
import { normAr } from '../../../domain/text';
import type { Lang } from '../../../i18n';
import { GUIDES } from './content';
import { GLOSSARY } from './glossary';
import type { Bi } from './types';

/** Lower-case, Arabic-normalised text with punctuation folded to single spaces. */
export function foldText(s: string): string {
  return normAr(s.toLowerCase())
    .replace(/[^\p{L}\p{N}*]+/gu, ' ')
    .trim();
}

export interface HelpEntry {
  kind: 'guide' | 'term';
  id: string;
  title: Bi;
  text: Bi;
  /** Path without the /ar prefix (a term links to its glossary anchor). */
  to: string;
  /** Folded haystack: titles, texts and keywords in both languages. */
  hay: string;
  /** Folded titles (and abbreviation): matches here rank first. */
  head: string;
}

export const termAnchor = (id: string) => `term-${id}`;
/** Database glossary rows a sourced static term replaces (shown once, with its source). */
const REPLACED_DB = new Set(GLOSSARY.flatMap((t) => t.replacesDb ?? []));
export const isReplacedDbTerm = (id: string) => REPLACED_DB.has(id);
export const termHref = (id: string) => `/help/glossary#${termAnchor(id)}`;

export function makeEntry(kind: HelpEntry['kind'], id: string, title: Bi, text: Bi, to: string, opts: { abbr?: string; extra?: string[] } = {}): HelpEntry {
  const head = foldText([title.en, title.ar, opts.abbr ?? ''].join(' '));
  return { kind, id, title, text, to, head, hay: foldText([head, text.en, text.ar, ...(opts.extra ?? [])].join(' ')) };
}

/** The static index: every guide and every glossary term (database glossary rows are added by the page that loads them). */
export const HELP_INDEX: HelpEntry[] = [
  ...GUIDES.map((g) =>
    makeEntry('guide', g.id, g.title, g.summary, `/help/${g.id}`, {
      extra: [g.keywords?.en ?? '', g.keywords?.ar ?? '', ...g.steps.flatMap((x) => [x.title.en, x.title.ar, x.body.en, x.body.ar])],
    }),
  ),
  ...GLOSSARY.map((t) => makeEntry('term', t.id, t.term, t.definition, termHref(t.id), { abbr: t.abbr, extra: [t.inKafaa?.en ?? '', t.inKafaa?.ar ?? ''] })),
];

/** Entries matching every word of the query, title matches first, in index order otherwise. Empty query: nothing. */
export function searchHelp(query: string, entries: HelpEntry[] = HELP_INDEX): HelpEntry[] {
  const words = foldText(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  const hits = entries.filter((e) => words.every((w) => e.hay.includes(w)));
  const rank = (e: HelpEntry) => (words.every((w) => e.head.includes(w)) ? 0 : 1);
  return hits.map((e, i) => [rank(e), i, e] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, , e]) => e);
}

/** Minimal hook for the header search: guides and glossary terms in the page language, linking to the guide or the term anchor. */
export function helpSearchItems(lang: Lang): { key: string; kind: HelpEntry['kind']; title: string; sub: string; to: string }[] {
  return HELP_INDEX.map((e) => ({ key: `help-${e.kind}-${e.id}`, kind: e.kind, title: e.title[lang], sub: e.text[lang], to: e.to }));
}
