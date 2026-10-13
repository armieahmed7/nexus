import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { config } from './config';
import { loadLang, preferredLangPath, splitLang, storedLang } from './i18n';
import { installChunkReload, isChunkLoadError, reloadOnce } from './shell/chunkReload';
import './styles/index.css';

// After a deploy, chunks of the previous build 404: reload once to pick up the new index.html (src/shell/chunkReload.ts).
installChunkReload();

// Audit 2026-10-13 (findings 14, 19): before the router reads the URL, send a returning Arabic visitor who entered through an unprefixed
// link to the /ar twin, then load that language's dictionaries (they are no longer in the entry bundle) and the app in parallel, and
// render once both are in, so no raw keys are ever shown.
const to = preferredLangPath(location.pathname, config.basename, storedLang());
if (to) history.replaceState(history.state, '', to + location.search + location.hash);
const rel = location.pathname.startsWith(config.basename) ? location.pathname.slice(config.basename.replace(/\/$/, '').length) || '/' : '/';
const lang = splitLang(rel).lang;

Promise.all([import('./App'), loadLang(lang).catch((e: unknown) => console.error('[kafaa] could not load the dictionaries', e))]).then(([{ default: App }]) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}, (e: unknown) => {
  // the app chunk of an earlier deploy is gone: reload once for the new index.html
  if (isChunkLoadError(e) && reloadOnce()) return;
  console.error('[kafaa] could not start', e);
  document.getElementById('root')!.textContent = "Kafa'a could not load. Reload the page. · تعذّر تحميل كفاءة. أعد تحميل الصفحة.";
});
