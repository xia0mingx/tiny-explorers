/* Balance Scale — tap the heavier side and watch it tip.

   The weight cue is deliberately just "how many" rather than per-object
   weight (an elephant isn't secretly heavier than an apple here): reusing
   quantity keeps this readable at age 2 without a lookup table, and the
   physical intuition — more stuff on a side makes it sink — is exactly
   what a balance scale teaches regardless of what's actually on it.

   Left and right counts are always different (re-rolled on a tie), so
   there's always a single correct pan to tap and no "equal" state to
   design feedback for — a possible follow-up, not a v1 requirement.

   The beam genuinely rotates around a fixed fulcrum — an earlier version
   kept the beam flat and only moved the pans' hanging height, which read
   as "two floating baskets" rather than an actual tipping scale. Each
   pan's rope still hangs straight down (plumb) from its own end of the
   rotated beam, which is physically correct: gravity keeps a hanging pan
   vertical regardless of the beam's angle, only its attachment point
   moves with the beam.
*/

import { el, randInt, range, pick } from '../util.js';
import { spriteBody, OBJECTS, ANIMALS, PALETTE, shade } from '../art.js';

const COUNTABLE = [...OBJECTS, ...ANIMALS];

/** Max items per side, by age — the difficulty knob is purely "how much
 *  can a child subitise/count at a glance", same as Counting's own scale. */
const MAX_ITEMS = { 2: 3, 3: 4, 4: 6, 5: 8 };

const FULCRUM = { x: 150, y: 64 };
const BEAM_HALF = 86;
const ROPE_LEN = 46;
const ANGLE_PER_ITEM = 0.055; // radians
const MAX_ANGLE = 0.32;       // ~18 degrees
const PAN_W = 74;
const PAN_H = 50;

/** A small grid of sprites inside a pan's own local coordinate space
 *  (centred on 0,0), wrapping to a second row once 5+ items don't fit
 *  comfortably in one — mirrors the cols/rows logic Counting's groupSvg()
 *  uses, just against a fixed pan size instead of a viewBox that grows
 *  with the count. */
function panContents(sprite, n, colors) {
  const cols = Math.min(n, 4);
  const rows = Math.ceil(n / cols);
  const cellW = PAN_W / cols;
  const cellH = PAN_H / rows;
  const size = Math.min(cellW, cellH) * 0.92;
  const cells = range(n).map((i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * cellW + cellW / 2 - size / 2 - PAN_W / 2;
    const y = row * cellH + cellH / 2 - size / 2 - PAN_H / 2 + 2;
    return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 100 100">
              ${spriteBody(sprite, colors[i % colors.length])}
            </svg>`;
  }).join('');
  return cells;
}

function panMarkup(cx, cy, sprite, n, colors, side) {
  return `
    <g class="pan" data-side="${side}" transform="translate(${cx},${cy})">
      <path d="M-38 -8 L38 -8 L30 24 Q0 32 -30 24 Z" fill="#fff9f2"
            stroke="#c9c2da" stroke-width="3" stroke-linejoin="round"/>
      ${panContents(sprite, n, colors)}
    </g>`;
}

export default {
  id: 'balance',
  title: 'Balance Scale',
  subtitle: 'Heavier or lighter?',
  color: '#5ec8d8',
  rounds: () => 6,

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="46" y="8" width="8" height="66" rx="4" fill="#8a869c"/>
      <rect x="18" y="18" width="64" height="8" rx="4" fill="#c9c2da"/>
      <path d="M12 28 L26 28 L19 52 L5 52 Z" fill="#5ec8d8"/>
      <path d="M74 28 L88 28 L94 46 L68 46 Z" fill="#ff8fab"/>
      <path d="M28 82 L72 82 L60 94 L40 94 Z" fill="#8a869c"/>
    </svg>`,

  round(ctx) {
    const max = MAX_ITEMS[ctx.age];
    const sprite = pick(COUNTABLE);
    const base = pick(PALETTE);
    const colors = [base, shade(base, 30), shade(base, -25)];

    let left = randInt(1, max);
    let right = randInt(1, max);
    while (right === left) right = randInt(1, max);
    const answer = left > right ? 'left' : 'right';

    ctx.prompt('Which side is heavier?');

    // Positive angle here rotates the LEFT end down: the beam is drawn from
    // (cos, sin) offsets around the fulcrum, and a heavier left side should
    // sink, so the sign is tied to (left - right), not (right - left).
    const angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, (left - right) * ANGLE_PER_ITEM));
    const leftEnd = {
      x: FULCRUM.x - BEAM_HALF * Math.cos(angle),
      y: FULCRUM.y + BEAM_HALF * Math.sin(angle),
    };
    const rightEnd = {
      x: FULCRUM.x + BEAM_HALF * Math.cos(angle),
      y: FULCRUM.y - BEAM_HALF * Math.sin(angle),
    };
    const leftPan = { x: leftEnd.x, y: leftEnd.y + ROPE_LEN };
    const rightPan = { x: rightEnd.x, y: rightEnd.y + ROPE_LEN };

    const wrap = el('div', { class: 'stage-figure' });
    wrap.innerHTML = `
      <svg viewBox="0 0 300 200" style="width:100%;height:100%" class="balance-svg">
        <path d="M150 190 L128 190 L150 ${FULCRUM.y} L172 190 Z" fill="#e8e3f2"/>
        <circle cx="${FULCRUM.x}" cy="${FULCRUM.y}" r="6" fill="#8a869c"/>
        <line x1="${leftEnd.x}" y1="${leftEnd.y}" x2="${rightEnd.x}" y2="${rightEnd.y}"
              stroke="#c9c2da" stroke-width="10" stroke-linecap="round"/>
        <line x1="${leftEnd.x}" y1="${leftEnd.y}" x2="${leftPan.x}" y2="${leftPan.y}"
              stroke="#8a869c" stroke-width="3"/>
        <line x1="${rightEnd.x}" y1="${rightEnd.y}" x2="${rightPan.x}" y2="${rightPan.y}"
              stroke="#8a869c" stroke-width="3"/>
        ${panMarkup(leftPan.x, leftPan.y, sprite, left, colors, 'left')}
        ${panMarkup(rightPan.x, rightPan.y, sprite, right, colors, 'right')}
      </svg>`;
    ctx.stage.append(wrap);

    const svg = wrap.querySelector('svg');
    const onTap = (e) => {
      const pan = e.target.closest('.pan');
      if (!pan) return;
      if (pan.dataset.side === answer) ctx.win(pan);
      else ctx.nudge(pan);
    };
    svg.addEventListener('click', onTap);
    ctx.onCleanup(() => svg.removeEventListener('click', onTap));
  },
};
