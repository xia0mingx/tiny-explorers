/* cache-manifest.js — the list of files that make the app work offline, and
   the cache name they live under.

   Shared between sw.js (which uses SHELL to prime the cache on install) and
   src/offline.js (which uses it to report "N of N files saved" in the
   settings sheet), so the two can never silently drift out of sync — the
   whole point of the offline-ready indicator is that it tells the truth.

   APP_VERSION lives here too rather than in a package.json (there isn't
   one — no build step) so there's exactly one place to remember to touch on
   a shipped change, not two that can drift apart. Bump both together.
*/

export const CACHE_NAME = 'tiny-explorers-v6';
export const APP_VERSION = '1.5.0';

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
  './src/toyShell.js',
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
  './src/toys/index.js',
  './src/toys/drawing.js',
  './src/toys/dressup.js',
  './src/toys/music.js',
  './src/toys/dotToDot.js',
  './src/toys/drive.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];
