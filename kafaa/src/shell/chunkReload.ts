/**
 * Deploy cutover: after a new deploy the hashed chunks an open tab still points at are gone. Netlify answers them with 404
 * (public/_redirects: /kafaa/assets/* 404 above the SPA fallback), the dynamic import rejects, and the page would stay broken
 * because React.lazy and loadSeed keep the rejected promise. Recovery is a full reload, which fetches the new index.html and
 * chunk names. It happens at most once per RELOAD_WINDOW_MS (guarded in sessionStorage) so a chunk that is really missing
 * shows the crash screen instead of reloading forever.
 */
export const RELOAD_KEY = 'kafaa.chunkReload.at';
export const RELOAD_WINDOW_MS = 60_000;

const CHUNK_PATTERNS = [
  /failed to fetch dynamically imported module/i, // Chromium
  /error loading dynamically imported module/i, // Firefox
  /importing a module script failed/i, // Safari
  /unable to preload css/i, // Vite CSS preload
  /is not a valid javascript mime type/i, // an HTML fallback served for a .js chunk
  /expected a javascript(?:-or-wasm)? module script/i,
  /loading (?:css )?chunk \S+ failed/i,
];

/** True when the error is a failed load of a code-split chunk (not a bug in the page itself). */
export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { name?: unknown; message?: unknown };
  if (e.name === 'ChunkLoadError') return true;
  const msg = typeof err === 'string' ? err : typeof e.message === 'string' ? e.message : '';
  return CHUNK_PATTERNS.some((p) => p.test(msg));
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
const session = (): StorageLike | null => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
};
const browserReload = () => {
  if (typeof window !== 'undefined') window.location.reload();
};

/**
 * Reload the page once to pick up a new deploy. Returns true when a reload was started, false when one already ran inside the
 * window (or sessionStorage is unavailable, so a loop cannot be ruled out); the caller then shows the error instead.
 */
export function reloadOnce(opts: { storage?: StorageLike | null; reload?: () => void; now?: number } = {}): boolean {
  const storage = opts.storage === undefined ? session() : opts.storage;
  const now = opts.now ?? Date.now();
  if (!storage) return false;
  try {
    const last = Number(storage.getItem(RELOAD_KEY) ?? 0);
    if (Number.isFinite(last) && last > 0 && now - last < RELOAD_WINDOW_MS) return false;
    storage.setItem(RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  (opts.reload ?? browserReload)();
  return true;
}

/** Full reload chosen by the person (the crash screen's "Try again" after a chunk failure): not loop-guarded. */
export function hardReload(reload: () => void = browserReload) {
  reload();
}

/** Listen for Vite's preload failures (page chunks, CSS and the local-demo seed chunk) and reload once. */
export function installChunkReload(target: Pick<Window, 'addEventListener' | 'removeEventListener'> | null = typeof window !== 'undefined' ? window : null, reload?: () => void) {
  if (!target) return () => undefined;
  // Vite fires this event only for failed dynamic imports and preloads. The error is not cancelled: if the guard blocks a second
  // reload it still reaches the route's error boundary (crash screen) or the session (error state).
  const onPreloadError = () => {
    reloadOnce({ reload });
  };
  target.addEventListener('vite:preloadError', onPreloadError);
  return () => target.removeEventListener('vite:preloadError', onPreloadError);
}

/** Memoise an async load, but forget a failure so the next call tries again (React.lazy-style caching keeps a rejected import
 *  forever, which is what left the local demo "signed out" after a deploy). */
export function retryableOnce<T>(load: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () =>
    (p ??= load().catch((err: unknown) => {
      p = null;
      throw err;
    }));
}
