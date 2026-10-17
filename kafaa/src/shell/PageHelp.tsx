/**
 * "Help with this page": up to three Help centre guides that talk about the current page, shown next to the breadcrumbs on
 * every public and signed-in route a guide links to. The route → guides index (src/modules/m12/help/pageHelp.ts) is derived
 * from the guides themselves and loaded lazily with the help content, so the main bundle carries none of it.
 */
import { useEffect, useId, useState } from 'react';
import { L, useI18n, useLang, useT } from '../i18n';
import { Icon } from '../ui/Icon';
import { routeForPath } from '../routes/registry';
import type { RouteDef } from '../routes/types';

type PageHelpModule = typeof import('../modules/m12/help/pageHelp');
let loaded: PageHelpModule | null = null;
let loading: Promise<PageHelpModule | null> | null = null;
function loadPageHelp(): Promise<PageHelpModule | null> {
  loading ??= import('../modules/m12/help/pageHelp')
    .then((m) => (loaded = m))
    .catch(() => {
      loading = null; // a failed chunk load (offline, new deploy) is retried on the next page
      return null;
    });
  return loading;
}

export function PageHelp({ route }: { route: RouteDef }) {
  const t = useT();
  const lang = useLang();
  const { path } = useI18n();
  const id = useId();
  const [mod, setMod] = useState<PageHelpModule | null>(loaded);
  useEffect(() => {
    if (mod) return;
    let live = true;
    void loadPageHelp().then((m) => live && m && setMod(m));
    return () => {
      live = false;
    };
  }, [mod]);
  if (!mod || mod.PAGE_HELP_SKIP.has(route.id)) return null;
  const guides = mod.guidesForPage(route.id, routeForPath(path)?.params ?? {});
  if (!guides.length) return null;
  return (
    <nav aria-labelledby={id} className="no-print flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]" data-testid="page-help">
      <span id={id} className="inline-flex items-center gap-1 text-ink-3">
        <Icon name="book" size={14} />
        {t('shell.pageHelp')}
      </span>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {guides.map((g, i) => (
          <li key={g.id} className={i >= 2 ? 'hidden sm:block' : undefined /* phones: two guides, so the row stays short */}>
            <L to={`/help/${g.id}`} data-testid={`page-help-${g.id}`}>
              {g.title[lang]}
            </L>
          </li>
        ))}
      </ul>
    </nav>
  );
}
