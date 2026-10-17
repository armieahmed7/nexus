// M12 · "Help with this page": which guides talk about a page, derived from the guides' own "Go to" links (HelpGuide.links),
// so a guide that names a route is offered back on that route with no second list to maintain. Loaded lazily by the shell
// (src/shell/PageHelp.tsx) with the rest of the help content, never in the main bundle. Tested in tests/unit/m12-page-help.test.tsx.
import { GUIDES } from './content';
import type { HelpGuide, HelpLink } from './types';

/** Pages that are the help centre itself: they never get a "help with this page" row. */
export const PAGE_HELP_SKIP = new Set(['help', 'help-guide', 'help-glossary']);
/** At most this many guides per page, so the row stays one short line. */
export const PAGE_HELP_MAX = 3;

interface Mention {
  guide: HelpGuide;
  link: HelpLink;
  /** Position of the link among the guide's links: a page named first is what the guide is mainly about. */
  pos: number;
}

/** Route id → the guides that link to it, in guide order. */
export const GUIDES_BY_ROUTE: ReadonlyMap<string, readonly Mention[]> = (() => {
  const m = new Map<string, Mention[]>();
  for (const guide of GUIDES) {
    guide.links.forEach((link, pos) => {
      if (PAGE_HELP_SKIP.has(link.route)) return;
      const list = m.get(link.route) ?? [];
      list.push({ guide, link, pos });
      m.set(link.route, list);
    });
  }
  return m;
})();

/** Guides for the page at a route with these params (a link with params, e.g. /legal/privacy, only matches that page). */
export function guidesForPage(routeId: string, params: Record<string, string | undefined> = {}, max = PAGE_HELP_MAX): HelpGuide[] {
  const out: HelpGuide[] = [];
  const hits = (GUIDES_BY_ROUTE.get(routeId) ?? [])
    .filter((x) => Object.entries(x.link.params ?? {}).every(([k, v]) => params[k] === v))
    .map((x, i) => ({ ...x, i }))
    .sort((a, b) => a.pos - b.pos || a.i - b.i);
  for (const h of hits) {
    if (out.length >= max) break;
    if (!out.includes(h.guide)) out.push(h.guide);
  }
  return out;
}
