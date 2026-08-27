/* ui.js — chrome shared by every screen: the top bar, the star track, the
   end-of-round celebration, and the grown-ups-only settings sheet. */

import { el, range, pick } from './util.js';
import { glyph, renderSprite, ANIMALS, PALETTE } from './art.js';
import { sfx, stopSpeech } from './audio.js';
import { getSettings, setSetting, resetProgress } from './state.js';
import { offlineStatus } from './offline.js';
import { APP_VERSION } from './cache-manifest.js';

/** Round icon button. `label` is for screen readers only — nothing here shows text. */
export function iconButton(svg, onClick, label) {
  return el('button', {
    class: 'icon-btn',
    'aria-label': label,
    html: svg,
    onclick: (e) => { sfx('tap'); onClick(e); },
  });
}

/**
 * Top bar: back button, title block, and an optional star track.
 * @returns {{node: HTMLElement, fillStar: (i:number)=>void}}
 */
export function topbar({ title, subtitle, onBack, starCount = 0 }) {
  const stars = el('div', { class: 'stars' });
  const slots = range(starCount).map(() => {
    const s = el('div', { class: 'star-slot', html: glyph.starEmpty() });
    stars.append(s);
    return s;
  });

  const node = el('div', { class: 'topbar' },
    onBack ? iconButton(glyph.back(), onBack, 'Back') : null,
    el('div', { class: 'title-block' },
      el('h1', { text: title }),
      subtitle ? el('p', { text: subtitle }) : null),
    starCount ? stars : null);

  /** Fill slot `i` with a gold star and pop it. */
  function fillStar(i) {
    const slot = slots[i];
    if (!slot) return;
    slot.innerHTML = glyph.star();
    slot.classList.add('pop');
    setTimeout(() => slot.classList.remove('pop'), 380);
  }

  return { node, fillStar };
}

/* ── confetti ──────────────────────────────────────────────────────────── */

/** Fire-and-forget confetti burst; cleans itself up. */
export function confetti(count = 70) {
  const layer = el('div', { class: 'confetti' });
  for (let i = 0; i < count; i++) {
    layer.append(el('i', {
      style: {
        left: `${Math.random() * 100}vw`,
        background: pick(PALETTE),
        animationDuration: `${2 + Math.random() * 1.8}s`,
        animationDelay: `${Math.random() * 0.9}s`,
        transform: `rotate(${Math.random() * 360}deg)`,
      },
    }));
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 5000);
}

/* ── celebration ───────────────────────────────────────────────────────── */

const PRAISE = ['Great job!', 'You did it!', 'Amazing!', 'Well done!',
                'Super star!', 'Fantastic!', 'Hooray!'];

/**
 * Full-screen "you finished" overlay.
 * Both buttons are big and far apart so a celebratory flailing hand doesn't
 * pick one at random.
 */
export function celebrate({ starsWon, onAgain, onHome }) {
  const praise = pick(PRAISE);
  sfx('celebrate');
  confetti();

  const wonStars = el('div', { class: 'won-stars' });
  range(starsWon).forEach((i) => {
    // The drop animation is defined on the <svg> itself, so stagger it there
    // rather than on a wrapper the CSS doesn't target.
    const svg = el('div', { html: glyph.star() }).firstElementChild;
    svg.style.animationDelay = `${0.15 + i * 0.12}s`;
    wonStars.append(svg);
  });

  const overlay = el('div', { class: 'overlay' },
    el('div', {
      class: 'hero-char float',
      html: renderSprite(pick(ANIMALS), { color: pick(PALETTE) }),
    }),
    el('h2', { text: praise }),
    wonStars,
    el('div', { class: 'row', style: { marginTop: '10px' } },
      el('button', { class: 'big-btn', text: 'Play again', onclick: () => { sfx('tap'); overlay.remove(); onAgain(); } }),
      el('button', { class: 'big-btn ghost', text: 'More games', onclick: () => { sfx('tap'); overlay.remove(); onHome(); } })));

  document.body.append(overlay);
  return overlay;
}

/* ── parent gate + settings ────────────────────────────────────────────── */

/**
 * Wraps a button so it only fires after a sustained press.
 *
 * This is the whole "parent gate": a 1.2s hold is trivially easy for an adult
 * who has been told about it and reliably beyond a toddler who taps everything
 * on screen — enough to keep sound settings and the progress reset out of reach
 * without putting a maths puzzle in front of a 2-year-old's parent.
 */
export function holdButton(svg, onHold, label, ms = 1200) {
  const btn = el('button', { class: 'icon-btn', 'aria-label': label, html: svg });
  let timer = null;

  const start = (e) => {
    e.preventDefault();
    btn.classList.add('holding');
    timer = setTimeout(() => { sfx('sparkle'); onHold(); cancel(); }, ms);
  };
  const cancel = () => {
    btn.classList.remove('holding');
    if (timer) { clearTimeout(timer); timer = null; }
  };

  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointerleave', cancel);
  btn.addEventListener('pointercancel', cancel);
  return btn;
}

/** Human-readable line for each offlineStatus() outcome. This is the piece
 *  that makes "offline" trustworthy rather than a hope: it answers "is it
 *  actually safe to leave the house right now?" instead of just "did
 *  registration not throw". */
const OFFLINE_MESSAGE = {
  ready: ({ cached, total }) => `Ready to play offline — ${cached} of ${total} files saved`,
  caching: ({ cached, total }) => `Caching… ${cached} of ${total} files saved`,
  insecure: () => 'Not saved for offline — open over https:// and add to the Home Screen',
  unsupported: () => 'Offline not supported on this browser',
  failed: () => "Couldn't save for offline — try closing and reopening the app",
};

export function settingsSheet() {
  const overlay = el('div', { class: 'overlay' });
  const close = () => overlay.remove();

  const offlineRow = el('p', { class: 'offline-status', text: 'Checking offline status…' });
  offlineStatus().then((s) => { offlineRow.textContent = OFFLINE_MESSAGE[s.state](s); });

  const toggle = (label, key) => {
    const sw = el('div', { class: `switch ${getSettings()[key] ? 'on' : ''}` });
    return el('button', {
      class: 'toggle',
      onclick: () => {
        const next = !getSettings()[key];
        setSetting(key, next);
        sw.classList.toggle('on', next);
        if (key === 'autoSpeak' && !next) stopSpeech();
        sfx('tap');
      },
    }, el('span', { text: label }), sw);
  };

  let armed = false;
  const resetBtn = el('button', {
    class: 'big-btn ghost',
    text: 'Reset all stars',
    onclick: () => {
      if (!armed) {
        armed = true;
        resetBtn.textContent = 'Tap again to erase';
        resetBtn.style.background = '#ff8fab';
        resetBtn.style.color = '#fff';
        return;
      }
      resetProgress();
      resetBtn.textContent = 'Stars cleared';
      resetBtn.style.background = '';
      resetBtn.style.color = '';
      armed = false;
    },
  });

  overlay.append(el('div', { class: 'sheet' },
    el('h2', { text: 'Grown-ups' }),
    el('p', { text: 'Everything is stored on this device. There are no ads, no purchases, and nothing is sent anywhere.' }),
    offlineRow,
    toggle('Sound effects', 'sound'),
    toggle('Read instructions aloud', 'autoSpeak'),
    resetBtn,
    el('button', { class: 'big-btn', text: 'Done', onclick: () => { sfx('tap'); close(); } }),
    el('p', { class: 'hint', text: `Version ${APP_VERSION}` }),
    el('a', {
      class: 'hint credit-link',
      href: 'https://github.com/xia0mingx/tiny-explorers',
      target: '_blank',
      rel: 'noopener noreferrer',
      text: 'View on GitHub',
    })));

  document.body.append(overlay);
  return overlay;
}

