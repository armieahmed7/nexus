/*
 * Kafa'a OJT practice logbook service worker (F38, W5 · E1).
 * Registered only by the logbook page, with scope /kafaa/my/ojt (English) or /kafaa/ar/my/ojt (Arabic): it controls the logbook
 * and nothing else. It keeps a copy of the logbook page and of the static assets that page loads, so the logbook opens without a
 * connection. It never caches or serves any other page, never intercepts API calls or non-GET requests, and sends nothing anywhere
 * (no analytics, no telemetry, no beacons). Practice entries are queued by the page itself (idempotent client keys) and synced when
 * the device is back online; a Background Sync event only asks the open logbook page to sync.
 */
const CACHE = 'kafaa-ojt-v1';
const SYNC_TAG = 'kafaa-ojt-sync';

const scopePath = () => new URL(self.registration.scope).pathname.replace(/\/$/, '');
const inScope = (url) => {
  const s = scopePath();
  return url.pathname === s || url.pathname === `${s}/`;
};
const isAsset = (url) => /\/assets\/[^/]+\.(js|css|woff2?)$/.test(url.pathname);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('kafaa-ojt-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    if (!inScope(url)) return;
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(scopePath(), copy));
          }
          return res;
        })
        .catch(() => caches.open(CACHE).then((c) => c.match(scopePath())).then((hit) => hit || Response.error())),
    );
    return;
  }
  if (isAsset(url)) {
    event.respondWith(
      caches.open(CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) c.put(req, res.clone());
        return res;
      }))),
    );
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag !== SYNC_TAG) return;
  event.waitUntil(self.clients.matchAll({ type: 'window' }).then((clients) => clients.forEach((c) => c.postMessage({ type: SYNC_TAG }))));
});
