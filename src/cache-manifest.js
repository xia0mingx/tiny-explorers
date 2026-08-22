/* cache-manifest.js — the list of files that make the app work offline, and
   the cache name they live under.

   Shared between sw.js (which uses SHELL to prime the cache on install) and
   src/offline.js (which uses it to report "N of N files saved" in the
   settings sheet), so the two can never silently drift out of sync — the
   whole point of the offline-ready indicator is that it tells the truth.
*/

export const CACHE_NAME = 'tiny-explorers-v2';

export const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/main.css',
  './src/main.js',
  './src/util.js',
  './src/art.js',
  './src/audio.js',
  './src/state.js',
  './src/ui.js',
  './src/engine.js',
  './src/offline.js',
  './src/cache-manifest.js',
  './src/games/index.js',
  './src/games/counting.js',
  './src/games/shapes.js',
  './src/games/patterns.js',
  './src/games/shadows.js',
  './src/games/tracing.js',
  './src/games/differences.js',
  './src/games/maze.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];
