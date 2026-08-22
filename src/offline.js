/* offline.js — service worker registration, and a way to ask "are we actually
   ready to go offline right now?"

   Split out from main.js so ui.js (the settings sheet) can query status
   without importing the app's router, and so the registration outcome is
   recorded instead of silently discarded — the old inline catch-and-ignore
   in main.js meant a failed registration looked identical to a successful one
   from the outside.

   Service workers only register in a secure context — https:, or
   localhost/127.0.0.1 for local development. This is a browser security rule,
   not a bug: loading the app over plain http:// on a LAN IP (e.g. a laptop's
   dev server reached from an iPad) can never install for offline use, no
   matter how correct sw.js is. Deploy to any static HTTPS host instead (see
   README) and the same code works.
*/

import { CACHE_NAME, SHELL } from './cache-manifest.js';

/** 'unsupported' | 'insecure' | 'registering' | 'registered' | 'failed' */
let state = 'unsupported';

/** Call once at boot. Safe to call even where service workers don't exist —
 *  the two guard checks are synchronous, so `state` reflects them immediately
 *  and the settings sheet never has to guess whether registration was even
 *  attempted. */
export function registerServiceWorker() {
  // Check isSecureContext FIRST: most browsers hide `serviceWorker` from
  // `navigator` entirely outside a secure context, rather than exposing it and
  // letting registration fail. Checking the other order misreports "open this
  // over https://" as "your browser can't do this at all", which sent whoever
  // is troubleshooting looking in the wrong place.
  if (!window.isSecureContext) { state = 'insecure'; return; }
  if (!('serviceWorker' in navigator)) { state = 'unsupported'; return; }

  state = 'registering';
  // Deferred to 'load' so registration never competes with first paint.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { type: 'module' })
      .then(() => { state = 'registered'; })
      .catch(() => { state = 'failed'; });
  });
}

/**
 * Ground truth for "can this iPad play with no network right now?" — used by
 * the settings sheet so a grown-up can check before leaving the house.
 *
 * Reports the actual cache contents rather than just whether registration
 * succeeded: an install can partially fail (one flaky fetch on a bad
 * connection), and that must show as "still caching", not "ready".
 */
export async function offlineStatus() {
  if (state === 'unsupported') return { state: 'unsupported', cached: 0, total: SHELL.length };
  if (state === 'insecure')    return { state: 'insecure',    cached: 0, total: SHELL.length };
  if (state === 'failed')      return { state: 'failed',      cached: 0, total: SHELL.length };

  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    const cached = keys.length;
    return { state: cached >= SHELL.length ? 'ready' : 'caching', cached, total: SHELL.length };
  } catch {
    return { state: 'unsupported', cached: 0, total: SHELL.length };
  }
}
