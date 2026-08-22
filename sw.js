/* Service worker — offline support for a home-screen install.

   Strategy is stale-while-revalidate: serve from cache immediately when there
   is a hit — so the app opens instantly with zero network, which is the whole
   point on an iPad with no signal — and refresh that entry in the background
   for next time. A cache miss falls through to the network and caches a
   successful response for next time. If both cache and network fail on a
   page navigation, fall back to index.html rather than the browser's own
   offline error page.

   Trade-off worth knowing: a deployed update lands on the *second* launch
   after it ships — the first launch still serves the old cached copy while
   quietly refreshing it in the background — rather than immediately. That's
   the right trade for an app whose main job is working with zero network,
   over always being current.

   Registered with { type: 'module' } (see src/offline.js) so the file list
   lives in one place — src/cache-manifest.js — shared with the rest of the
   app instead of a second copy that could drift out of sync.
*/

import { CACHE_NAME, SHELL } from './src/cache-manifest.js';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      // One missing file must not fail the whole install, so warm entries
      // individually rather than with addAll().
      .then((c) => Promise.allSettled(SHELL.map((url) => c.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(request);

    // Always attempt the network so the cache stays fresh, but never let a
    // slow or absent network hold up a cache hit — that would defeat the
    // point of caching on a flaky or offline connection.
    const network = fetch(request).then((res) => {
      if (res.ok && new URL(request.url).origin === self.location.origin) {
        cache.put(request, res.clone());
      }
      return res;
    }).catch(() => null);

    // Keep revalidating even after responding from cache below — respondWith
    // alone only keeps the worker alive until ITS promise resolves, which
    // happens as soon as `hit` is returned; waitUntil extends the event so the
    // background refresh isn't torn down mid-fetch.
    e.waitUntil(network);

    if (hit) return hit;

    const fromNetwork = await network;
    if (fromNetwork) return fromNetwork;

    // Both cache and network failed. For a page navigation, the app shell is
    // a far better fallback than the browser's own offline error page.
    if (request.mode === 'navigate') return cache.match('./index.html');
    return Response.error();
  })());
});
