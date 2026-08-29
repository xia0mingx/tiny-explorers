/* state.js — the small amount of state worth surviving a reload.

   Deliberately localStorage and nothing else: no accounts, no network, no
   analytics. A toddler app should work on a plane, and the only data here is
   "which age level is selected" plus a star count per game.
*/

const KEY = 'tiny-explorers/v1';

const DEFAULTS = {
  age: null,                 // 2 | 3 | 4 | 5, null until a grown-up picks one
  stars: {},                 // "<gameId>:<age>" -> total stars earned
  settings: { sound: true, autoSpeak: false },
  disabledGames: {},         // "<gameId>" -> true; absent/false means enabled
};

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULTS),
      ...parsed,
      settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
      stars: parsed.stars || {},
      disabledGames: parsed.disabledGames || {},
    };
  } catch {
    // Corrupt or unavailable storage (private mode) must not brick the app.
    return structuredClone(DEFAULTS);
  }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

export const getAge = () => data.age;

export function setAge(age) {
  data.age = age;
  save();
}

export const getSettings = () => data.settings;

export function setSetting(key, value) {
  data.settings[key] = value;
  save();
}

const starKey = (gameId, age) => `${gameId}:${age}`;

export const getStars = (gameId, age) => data.stars[starKey(gameId, age)] || 0;

export function addStars(gameId, age, n) {
  const k = starKey(gameId, age);
  data.stars[k] = (data.stars[k] || 0) + n;
  save();
}

export const totalStars = (age) =>
  Object.entries(data.stars)
    .filter(([k]) => k.endsWith(`:${age}`))
    .reduce((sum, [, v]) => sum + v, 0);

/** Used by the parent settings sheet. */
export function resetProgress() {
  data.stars = {};
  save();
}

/** A game not in the map (the common case — nothing's been turned off, or
 *  this game didn't exist yet when disabledGames was last saved) is enabled
 *  by default, so adding a new game to GAMES never silently hides it. */
export const isGameEnabled = (gameId) => !data.disabledGames[gameId];

export function setGameEnabled(gameId, enabled) {
  if (enabled) delete data.disabledGames[gameId];
  else data.disabledGames[gameId] = true;
  save();
}
