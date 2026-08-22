/* Spot the difference.

   Both pictures are generated from one list of placed sprites; the right-hand
   copy then has k items mutated. Nothing is hand-drawn twice, so the two scenes
   can never disagree by accident and the differences are known exactly rather
   than being something the child might "find" that isn't there.

   Age progression — the mutation KIND is the difficulty, not just the count:
     2  1 difference,  something is missing        (easiest to see)
     3  2 differences, missing or recoloured
     4  3 differences, + resized
     5  4 differences, + mirrored                  (hardest: shape and colour
                                                    both match, only facing differs)

   A missing item can only be tapped in the picture that still has it, which is
   why taps are accepted on either panel.
*/

import { el, pick, shuffle, sample, range } from '../util.js';
import { spriteBody, PALETTE } from '../art.js';

const CONFIG = {
  2: { items: 5, diffs: 1, kinds: ['remove'] },
  3: { items: 6, diffs: 2, kinds: ['remove', 'recolor'] },
  4: { items: 8, diffs: 3, kinds: ['remove', 'recolor', 'resize'] },
  5: { items: 9, diffs: 4, kinds: ['remove', 'recolor', 'resize', 'flip'] },
};

/* Scene is a 200x150 viewBox. Sky slots sit above the horizon at y=100. */
const SLOTS = [
  { x: 8,   y: 62, s: 52, sky: false },
  { x: 62,  y: 74, s: 38, sky: false },
  { x: 104, y: 58, s: 56, sky: false },
  { x: 158, y: 72, s: 42, sky: false },
  { x: 40,  y: 108, s: 30, sky: false },
  { x: 6,   y: 12, s: 34, sky: true },
  { x: 58,  y: 6,  s: 30, sky: true },
  { x: 112, y: 14, s: 28, sky: true },
  { x: 158, y: 4,  s: 36, sky: true },
];

const GROUND_PROPS = ['tree', 'house', 'mushroom', 'bush', 'rock', 'flower'];
const SKY_PROPS = ['cloud', 'sun', 'bird', 'balloon', 'butterfly', 'bee'];

/** Props whose silhouette actually changes when mirrored. Flipping a symmetric
 *  house would produce two identical pictures and an unwinnable round. */
const FLIPPABLE = ['bird', 'bee', 'rock', 'cloud', 'mushroom'];

const BACKDROP = `
  <rect width="200" height="150" fill="#c7e9ff"/>
  <path d="M0 96 Q50 84 100 96 T200 94 V150 H0 Z" fill="#a5e06b"/>
  <path d="M0 118 Q60 110 120 120 T200 116 V150 H0 Z" fill="#93d45c"/>`;

function itemMarkup(item, idx) {
  if (!item) return '';
  const { slot, sprite, color, scale, flip } = item;
  const s = slot.s * scale;
  // Centre the (possibly resized) sprite on the slot so a resize reads as
  // "bigger", not "moved".
  const x = slot.x + (slot.s - s) / 2;
  const y = slot.y + (slot.s - s) / 2;
  const inner = flip
    ? `<g transform="translate(100,0) scale(-1,1)">${spriteBody(sprite, color)}</g>`
    : spriteBody(sprite, color);

  return `<g data-idx="${idx}" style="cursor:pointer">
            <rect x="${slot.x - 2}" y="${slot.y - 2}" width="${slot.s + 4}"
                  height="${slot.s + 4}" fill="transparent" pointer-events="all"/>
            <svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 100 100">
              ${inner}
            </svg>
          </g>`;
}

export default {
  id: 'differences',
  title: 'Spot It',
  subtitle: 'Find what changed',
  color: '#ff8fab',
  rounds: () => 3,

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="4" y="20" width="42" height="58" rx="8" fill="#c7e9ff"/>
      <rect x="54" y="20" width="42" height="58" rx="8" fill="#c7e9ff"/>
      <circle cx="18" cy="40" r="8" fill="#ffc93c"/>
      <circle cx="68" cy="40" r="8" fill="#ffc93c"/>
      <circle cx="34" cy="60" r="9" fill="#5fd6a4"/>
      <circle cx="84" cy="60" r="9" fill="#ff8fab"/>
      <circle cx="84" cy="60" r="15" fill="none" stroke="#3fbf7f" stroke-width="5"/>
    </svg>`,

  round(ctx) {
    const cfg = CONFIG[ctx.age];

    // ── build the base scene ──────────────────────────────────────────────
    const slots = sample(SLOTS, cfg.items);
    const items = slots.map((slot) => ({
      slot,
      sprite: pick(slot.sky ? SKY_PROPS : GROUND_PROPS),
      color: pick(PALETTE),
      scale: 1,
      flip: false,
    }));

    // ── mutate a copy of it ───────────────────────────────────────────────
    const right = items.map((it) => ({ ...it }));
    const targets = shuffle(range(items.length));
    const changed = [];

    for (const idx of targets) {
      if (changed.length >= cfg.diffs) break;
      const item = right[idx];

      // Only offer kinds that actually produce a visible change for this sprite.
      const usable = cfg.kinds.filter((k) => k !== 'flip' || FLIPPABLE.includes(item.sprite));
      const kind = pick(usable);

      if (kind === 'remove') right[idx] = null;
      else if (kind === 'recolor') {
        // Force a clearly different hue, not an adjacent shade.
        item.color = pick(PALETTE.filter((c) => c !== items[idx].color));
      } else if (kind === 'resize') item.scale = pick([0.6, 1.5]);
      else if (kind === 'flip') item.flip = true;

      changed.push(idx);
    }

    const found = new Set();
    const remaining = () => cfg.diffs - found.size;

    const say = () => {
      const n = remaining();
      if (n === cfg.diffs) {
        ctx.prompt(cfg.diffs === 1 ? 'Find what is different!' : `Find ${cfg.diffs} differences!`);
      } else {
        ctx.prompt(n === 1 ? 'One more to find!' : `${n} more to find!`);
      }
    };

    // ── render ────────────────────────────────────────────────────────────
    const panel = (list) => {
      const svg = `<svg viewBox="0 0 200 150" class="diff-svg">
                     ${BACKDROP}
                     ${list.map((it, i) => itemMarkup(it, i)).join('')}
                     <g class="rings"></g>
                   </svg>`;
      return el('div', { class: 'diff-panel', html: svg });
    };

    const left = panel(items);
    const rightPanel = panel(right);

    const ringAt = (idx) => {
      const slot = items[idx].slot;
      return `<circle cx="${slot.x + slot.s / 2}" cy="${slot.y + slot.s / 2}"
                      r="${slot.s * 0.66}" fill="none" stroke="#2fae74"
                      stroke-width="4" class="ring"/>`;
    };

    const onTap = (e) => {
      const g = e.target.closest('[data-idx]');
      if (!g) return;
      const idx = Number(g.dataset.idx);

      if (!changed.includes(idx)) return ctx.nudge(g.closest('.diff-panel'));
      if (found.has(idx)) return;

      found.add(idx);
      // Ring it in both pictures — including the panel where it's missing, so
      // the child can see what changed.
      for (const p of [left, rightPanel]) {
        p.querySelector('.rings').insertAdjacentHTML('beforeend', ringAt(idx));
      }

      if (found.size >= cfg.diffs) ctx.win();
      else { ctx.ping(); say(); }
    };

    left.addEventListener('click', onTap);
    rightPanel.addEventListener('click', onTap);

    say();
    ctx.stage.append(el('div', { class: 'diff-panels' }, left, rightPanel));
  },
};
