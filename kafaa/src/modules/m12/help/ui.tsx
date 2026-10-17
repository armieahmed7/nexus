// M12 · Help centre: shared pieces for /help, /help/:guide and /help/glossary (merged glossary, letter groups, "Go to" links).
import { useMemo } from 'react';
import { useQuery, useRepo } from '../../../data';
import { L, useLang, useT, type Lang } from '../../../i18n';
import { useSession } from '../../../auth/session';
import { canOpen } from '../../../shell/GuardedLink';
import { ROUTE_BY_ID, href } from '../../../routes/registry';
import { routeTitle } from '../../../shell/util';
import { Icon, SourceLink } from '../../../ui';
import { GLOSSARY } from './glossary';
import { foldText } from '../../../domain/text';
import { isReplacedDbTerm, makeEntry, termHref, type HelpEntry } from './search';
import type { Bi, HelpLink, HelpSource } from './types';

/** One glossary entry on the page: a sourced static term, or a reviewed plant/licensing term from the database glossary. */
export interface GlossaryItem {
  id: string;
  term: Bi;
  abbr?: string;
  definition: Bi;
  inKafaa?: Bi;
  where: HelpLink[];
  sources: HelpSource[];
  fromDb: boolean;
}


/** Static terms plus the database glossary (12 plant and licensing terms), minus rows a static term replaces. */
export function useMergedGlossary(): { items: GlossaryItem[]; loading: boolean } {
  const repo = useRepo();
  const db = useQuery('glossary', () => repo.list('glossary', { order: [['term_en', 'asc']] }).catch(() => []));
  const items = useMemo<GlossaryItem[]>(
    () => [
      ...GLOSSARY.map((g) => ({ id: g.id, term: g.term, abbr: g.abbr, definition: g.definition, inKafaa: g.inKafaa, where: g.where, sources: g.sources, fromDb: false })),
      ...(db.data ?? [])
        .filter((r) => !isReplacedDbTerm(r.id))
        .map((r) => ({ id: r.id, term: { en: r.term_en, ar: r.term_ar || r.term_en }, definition: { en: r.definition_en, ar: r.definition_ar || r.definition_en }, where: [], sources: [], fromDb: true })),
    ],
    [db.data],
  );
  return { items, loading: db.data === undefined && !db.error };
}

/** Search entries for database glossary rows (the static index already holds guides and static terms). */
export function dbTermEntries(items: GlossaryItem[]): HelpEntry[] {
  return items.filter((i) => i.fromDb).map((i) => makeEntry('term', i.id, i.term, i.definition, termHref(i.id)));
}

/** The term as it sorts in a language: leading "ال" is ignored in Arabic. */
function sortKey(item: GlossaryItem, lang: Lang): string {
  const f = foldText(item.term[lang]);
  return lang === 'ar' ? f.replace(/^ال(?=\S{2,})/, '') : f;
}
/** Groups items by first letter in the page language, letters in alphabetical order (Arabic before Latin on /ar). */
export function groupByLetter(items: GlossaryItem[], lang: Lang): { letter: string; items: GlossaryItem[] }[] {
  const coll = new Intl.Collator(lang === 'ar' ? 'ar' : 'en', { sensitivity: 'base', numeric: true });
  const sorted = [...items].sort((a, b) => coll.compare(sortKey(a, lang), sortKey(b, lang)));
  const out: { letter: string; items: GlossaryItem[] }[] = [];
  for (const it of sorted) {
    const letter = (sortKey(it, lang)[0] ?? '#').toUpperCase();
    let g = out.find((x) => x.letter === letter);
    if (!g) out.push((g = { letter, items: [] }));
    g.items.push(it);
  }
  const isLatin = (l: string) => /[A-Z0-9]/.test(l);
  return lang === 'ar' ? [...out.filter((g) => !isLatin(g.letter)), ...out.filter((g) => isLatin(g.letter))] : out;
}
export const letterAnchor = (letter: string) => `letter-${letter}`;

/** A link into the app as a button: opens directly when the viewer may; sign-in first for staff pages; otherwise shown as unavailable.
 *  Labelled with the route's title unless a label is given. */
export function GoToLink({ link, className = 'btn-outline btn-sm', label: given }: { link: HelpLink; className?: string; label?: string }) {
  const t = useT();
  const s = useSession();
  const def = ROUTE_BY_ID[link.route];
  if (!def) return null;
  const path = href(link.route, link.params ?? {}) + (link.hash ? `#${link.hash}` : '');
  const label = given ?? routeTitle(t, def);
  if (canOpen(path, s)) {
    return (
      <L to={path} className={`${className} no-underline`} data-testid={`help-go-${link.route}`}>
        {label}
        <Icon name="chevron" size={12} />
      </L>
    );
  }
  if (s.status !== 'signed_in') {
    return (
      <L to={`/sign-in?next=${encodeURIComponent(path)}`} className={`${className} no-underline`} data-testid={`help-go-${link.route}`}>
        <Icon name="lock" size={12} className="text-ink-3" />
        {label}
        <span className="sr-only"> ({t('m12.help.signInFirst')})</span>
      </L>
    );
  }
  return (
    <span className={`${className} cursor-not-allowed opacity-60`} aria-disabled="true" data-testid={`help-go-${link.route}`}>
      <Icon name="lock" size={12} className="text-ink-3" />
      {label}
      <span className="sr-only"> ({t('m12.help.notForRole')})</span>
    </span>
  );
}

/** Cited sources: the title is English, so it is marked as such inside Arabic pages. */
export function HelpSources({ sources, testid }: { sources: HelpSource[]; testid?: string }) {
  const lang = useLang();
  if (!sources.length) return null;
  return (
    <ul className="space-y-1" data-testid={testid}>
      {sources.map((x) => (
        <li key={x.url}>
          <SourceLink href={x.url} date={x.as_of}>
            <span lang="en" dir={lang === 'ar' ? 'ltr' : undefined}>{x.title}</span>
          </SourceLink>
        </li>
      ))}
    </ul>
  );
}
