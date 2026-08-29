/* main.js — boot, screens and navigation.

   Three screens, no router: age picker -> home -> game. A toddler cannot use a
   back button reliably and will never type a URL, so history and deep links
   would only add ways to get lost. The age choice persists, so the app reopens
   straight onto the right home screen.
*/

import { el } from './util.js';
import { glyph, renderSprite, PALETTE } from './art.js';
import { holdButton, settingsSheet } from './ui.js';
import { unlock, sfx, stopSpeech } from './audio.js';
import { registerServiceWorker } from './offline.js';
import { getAge, setAge, getStars, totalStars, isGameEnabled, isToyEnabled } from './state.js';
import { startGame } from './engine.js';
import { startToy } from './toyShell.js';
import { GAMES } from './games/index.js';
import { TOYS } from './toys/index.js';

const app = document.getElementById('app');
let active = null;   // the running game, so navigating away can tear it down

/* iPadOS still fires pinch-zoom gestures even with user-scalable=no, and a
   two-finger stretch mid-drag would otherwise scale the whole app. */
['gesturestart', 'gesturechange', 'gestureend'].forEach((type) =>
  document.addEventListener(type, (e) => e.preventDefault()));

/* Audio contexts and speech both need a real gesture before they'll make a
   sound; the first touch anywhere unlocks them for the rest of the session. */
const firstTouch = () => {
  unlock();
  window.removeEventListener('pointerdown', firstTouch);
};
window.addEventListener('pointerdown', firstTouch);

function leaveGame() {
  if (active) { active.destroy?.(); active = null; }
  stopSpeech();
}

/* ── screen: pick an age ───────────────────────────────────────────────── */

const AGE_MASCOTS = { 2: 'bunny', 3: 'cat', 4: 'fox', 5: 'owl' };

function renderAgePicker() {
  leaveGame();

  const grid = el('div', { class: 'age-grid' });
  [2, 3, 4, 5].forEach((age, i) => {
    grid.append(el('button', {
      class: 'age-card',
      'aria-label': `Age ${age}`,
      onclick: () => { sfx('tap'); setAge(age); renderHome(); },
    },
    el('div', { html: renderSprite(AGE_MASCOTS[age], { color: PALETTE[i * 2] }) }).firstElementChild,
    el('div', { class: 'age-num', text: String(age) }),
    el('div', { class: 'age-label', text: 'years old' })));
  });

  app.replaceChildren(
    el('div', { class: 'screen' },
      el('div', { class: 'hero' },
        el('h1', { text: 'Tiny Explorers' }),
        el('p', { text: 'How old is your little one?' })),
      grid,
      el('div', { class: 'hint', text: 'A grown-up can change this any time.' })));
}

/* ── screen: home ──────────────────────────────────────────────────────── */

function renderHome() {
  leaveGame();
  const age = getAge();
  if (age == null) return renderAgePicker();

  const agePill = el('button', {
    class: 'icon-btn age-pill',
    'aria-label': `Age ${age}, tap to change`,
    onclick: () => { sfx('tap'); renderAgePicker(); },
  }, el('span', { text: String(age) }));

  const stars = totalStars(age);
  const header = el('div', { class: 'topbar' },
    agePill,
    el('div', { class: 'title-block' },
      el('h1', { text: 'Tiny Explorers' }),
      el('p', { text: stars ? `${stars} stars collected` : 'Pick a game to play' })),
    holdButton(glyph.gear(), () => settingsSheet(renderHome), 'Settings for grown-ups'));

  const activeGames = GAMES.filter((game) => isGameEnabled(game.id));
  const grid = el('div', { class: 'game-grid' });
  if (!activeGames.length) {
    // Every game turned off in the parent settings — rare, but a blank grid
    // with no explanation would look broken rather than deliberate.
    grid.append(el('p', {
      class: 'hint',
      style: { gridColumn: '1 / -1' },
      text: 'No games turned on — hold the gear above to enable some.',
    }));
  }
  activeGames.forEach((game) => {
    const earned = getStars(game.id, age);
    grid.append(el('button', {
      class: 'game-card',
      'aria-label': game.title,
      onclick: () => { sfx('tap'); play(game); },
    },
    el('div', { class: 'thumb', style: { background: `${game.color}2e` }, html: game.icon() }),
    el('h3', { text: game.title }),
    el('div', { class: 'earned', html: earned ? `${glyph.star()}<span>${earned}</span>` : '&nbsp;' })));
  });

  // Same .game-grid / .game-card styling as the quiz games above — a toy card
  // differs only in having no star count, so it needs no modifier class.
  const activeToys = TOYS.filter((toy) => isToyEnabled(toy.id));
  const toyGrid = el('div', { class: 'game-grid' });
  if (!activeToys.length) {
    toyGrid.append(el('p', {
      class: 'hint',
      style: { gridColumn: '1 / -1' },
      text: 'No toys turned on — hold the gear above to enable some.',
    }));
  }
  activeToys.forEach((toy) => {
    toyGrid.append(el('button', {
      class: 'game-card',
      'aria-label': toy.title,
      onclick: () => { sfx('tap'); playToy(toy); },
    },
    el('div', { class: 'thumb', style: { background: `${toy.color}2e` }, html: toy.icon() }),
    el('h3', { text: toy.title })));
  });

  app.replaceChildren(header, el('div', { class: 'screen' },
    el('div', { class: 'section-heading', text: 'Games' }),
    grid,
    el('div', { class: 'section-heading', text: 'Free Play' }),
    toyGrid));
}

/* ── screen: a game ────────────────────────────────────────────────────── */

function play(game) {
  leaveGame();
  active = startGame({
    game,
    age: getAge(),
    mount: app,
    onExit: renderHome,
  });
}

function playToy(toy) {
  leaveGame();
  active = startToy({
    toy,
    age: getAge(),
    mount: app,
    onExit: renderHome,
  });
}

/* ── boot ──────────────────────────────────────────────────────────────── */

if (getAge() == null) renderAgePicker();
else renderHome();

/* Offline support — see src/offline.js for what this actually checks (a
   secure context is required; plain http:// on a LAN IP can never register). */
registerServiceWorker();
