/* Balance Scale — drag things onto the scale until both sides weigh the same.

   Each round starts with the scale tipped: one pan holds more than the
   other. A tray underneath holds spare items; the child drags them onto a
   pan (or drags ones they added back off again) and the beam swings live
   with every change, until both pans hold the same number and it settles
   level. The weight cue is deliberately just "how many" rather than
   per-object weight (an elephant isn't secretly heavier than an apple
   here): quantity keeps this readable at age 2 without a lookup table, and
   the physical intuition — more stuff on a side makes it sink — is exactly
   what a balance scale teaches regardless of what's on it.

   No fail state, as everywhere else: piling onto the heavy side just tips
   it further, and anything the child added can be dragged back to the tray
   or across to the other pan. Only what the round started with is fixed —
   otherwise emptying both pans would "balance" it at zero. The tray always
   holds a few more items than needed, so the answer isn't simply "use all
   of them".

   The beam genuinely rotates around a fixed fulcrum, eased toward its new
   angle every frame so a drop visibly tips it. Each pan's rope hangs
   straight down (plumb) from its own end of the rotated beam, which is
   physically correct: gravity keeps a hanging pan vertical regardless of
   the beam's angle, only its attachment point moves with the beam. */

import { el, randInt, range, pick } from '../util.js';
import { spriteBody, OBJECTS, ANIMALS, PALETTE, shade } from '../art.js';

const COUNTABLE = [...OBJECTS, ...ANIMALS];

/** Most items a pan starts with, and how many spare items the tray holds
 *  beyond what balancing actually needs, by age. */
const CONFIG = {
  2: { max: 3, extra: 1 },
  3: { max: 4, extra: 2 },
  4: { max: 6, extra: 2 },
  5: { max: 8, extra: 3 },
};

const VB_W = 300;
const VB_H = 262;
const FULCRUM = { x: 150, y: 56 };
const BEAM_HALF = 92;
const ROPE_LEN = 46;
const ANGLE_PER_ITEM = 0.055; // radians
const MAX_ANGLE = 0.32;       // ~18 degrees
const PAN_W = 80;
const DROP_R = 58;            // generous drop radius around a pan's centre
const TRAY = { x: 14, y: 204, w: 272, h: 50 };
const TRAY_ITEM = 38;

/** Items piled in a pan, in the pan's own local coordinates (centred on
 *  0,0): rows of up to PILE_COLS from the pan's floor upward, every item
 *  the same size. Same size matters — shrinking items to fit would make one
 *  big lion look heavier than three small ones, the opposite of the lesson.
 *  Items the child added carry data attributes so they can be dragged off. */
const ITEM = 20;
const PILE_COLS = 4;
function panContents(items, side) {
  return items.map((it, i) => {
    const row = Math.floor(i / PILE_COLS);
    const inRow = Math.min(PILE_COLS, items.length - row * PILE_COLS);
    const col = i % PILE_COLS;
    const x = (col - (inRow - 1) / 2) * ITEM * 1.02 - ITEM / 2;
    const y = 13 - row * ITEM * 0.9 - ITEM / 2;
    const drag = it.added ? `data-src="${side}" data-id="${it.id}" style="cursor:grab"` : '';
    return `<svg x="${x}" y="${y}" width="${ITEM}" height="${ITEM}" viewBox="0 0 100 100" ${drag}>
              ${it.added ? '<rect width="100" height="100" fill="transparent"/>' : ''}
              ${spriteBody(it.sprite, it.color)}
            </svg>`;
  }).join('');
}

function panMarkup(cx, cy, items, side, glow) {
  return `
    <g transform="translate(${cx},${cy})">
      ${glow ? `<ellipse cx="0" cy="4" rx="${PAN_W / 2 + 10}" ry="34" fill="#ffe08a" opacity=".55"/>` : ''}
      <path d="M-42 -6 L42 -6 L33 26 Q0 34 -33 26 Z" fill="#fff9f2"
            stroke="#c9c2da" stroke-width="3" stroke-linejoin="round"/>
      ${panContents(items, side)}
    </g>`;
}

export default {
  id: 'balance',
  title: 'Balance Scale',
  subtitle: 'Make it balance',
  color: '#5ec8d8',
  rounds: () => 5,

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="46" y="8" width="8" height="66" rx="4" fill="#8a869c"/>
      <rect x="18" y="18" width="64" height="8" rx="4" fill="#c9c2da"/>
      <path d="M12 28 L26 28 L19 52 L5 52 Z" fill="#5ec8d8"/>
      <path d="M74 28 L88 28 L94 46 L68 46 Z" fill="#ff8fab"/>
      <path d="M28 82 L72 82 L60 94 L40 94 Z" fill="#8a869c"/>
    </svg>`,

  round(ctx) {
    const cfg = CONFIG[ctx.age];
    const sprite = pick(COUNTABLE);
    const base = pick(PALETTE);
    const colors = [base, shade(base, 30), shade(base, -25)];
    let nextId = 0;
    const make = (added) => ({ id: nextId++, sprite, color: colors[nextId % colors.length], added });

    let leftStart = randInt(1, cfg.max);
    let rightStart = randInt(1, cfg.max);
    while (rightStart === leftStart) rightStart = randInt(1, cfg.max);

    const pans = {
      left: range(leftStart).map(() => make(false)),
      right: range(rightStart).map(() => make(false)),
    };
    let tray = range(Math.abs(leftStart - rightStart) + cfg.extra).map(() => make(true));

    ctx.prompt('Make it balance!');

    const wrap = el('div', { class: 'stage-figure' });
    wrap.innerHTML = `<svg viewBox="0 0 ${VB_W} ${VB_H}" style="width:100%;height:100%" class="balance-svg">
        <g class="balance-scene"></g>
        <g class="balance-drag"></g>
      </svg>`;
    ctx.stage.append(wrap);
    const svg = wrap.querySelector('svg');
    const scene = svg.querySelector('.balance-scene');
    const dragLayer = svg.querySelector('.balance-drag');

    const targetAngle = () => {
      const diff = pans.left.length - pans.right.length;
      // Positive angle rotates the LEFT end down: a heavier left sinks.
      return Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, diff * ANGLE_PER_ITEM));
    };
    let angle = targetAngle();
    let solved = false;
    let drag = null;       // { item, from, x, y }
    let hoverSide = null;
    let rafId = null;

    function geometry() {
      const leftEnd = { x: FULCRUM.x - BEAM_HALF * Math.cos(angle), y: FULCRUM.y + BEAM_HALF * Math.sin(angle) };
      const rightEnd = { x: FULCRUM.x + BEAM_HALF * Math.cos(angle), y: FULCRUM.y - BEAM_HALF * Math.sin(angle) };
      return {
        leftEnd, rightEnd,
        left: { x: leftEnd.x, y: leftEnd.y + ROPE_LEN },
        right: { x: rightEnd.x, y: rightEnd.y + ROPE_LEN },
      };
    }

    function trayMarkup() {
      const n = tray.length;
      const gap = n ? Math.min(TRAY_ITEM + 6, (TRAY.w - 16) / n) : 0;
      const start = TRAY.x + TRAY.w / 2 - (gap * n) / 2 + gap / 2;
      return `
        <rect x="${TRAY.x}" y="${TRAY.y}" width="${TRAY.w}" height="${TRAY.h}" rx="16"
              fill="${hoverSide === 'tray' ? '#ffe08a' : '#f1edf8'}" stroke="#ded8ea" stroke-width="3"/>
        ${tray.map((it, i) => `
          <svg x="${start + gap * i - TRAY_ITEM / 2}" y="${TRAY.y + (TRAY.h - TRAY_ITEM) / 2}"
               width="${TRAY_ITEM}" height="${TRAY_ITEM}" viewBox="0 0 100 100"
               data-src="tray" data-id="${it.id}" style="cursor:grab">
            <rect width="100" height="100" fill="transparent"/>
            ${spriteBody(it.sprite, it.color)}
          </svg>`).join('')}`;
    }

    function paint() {
      const g = geometry();
      const level = Math.abs(angle) < 0.004 && solved;
      scene.innerHTML = `
        <path d="M150 196 L126 196 L150 ${FULCRUM.y} L174 196 Z" fill="#e8e3f2"/>
        <line x1="${g.leftEnd.x}" y1="${g.leftEnd.y}" x2="${g.rightEnd.x}" y2="${g.rightEnd.y}"
              stroke="${level ? '#3fbf7f' : '#c9c2da'}" stroke-width="10" stroke-linecap="round"/>
        <circle cx="${FULCRUM.x}" cy="${FULCRUM.y}" r="7" fill="#8a869c"/>
        <line x1="${g.leftEnd.x}" y1="${g.leftEnd.y}" x2="${g.left.x}" y2="${g.left.y}" stroke="#8a869c" stroke-width="3"/>
        <line x1="${g.rightEnd.x}" y1="${g.rightEnd.y}" x2="${g.right.x}" y2="${g.right.y}" stroke="#8a869c" stroke-width="3"/>
        ${panMarkup(g.left.x, g.left.y, pans.left, 'left', hoverSide === 'left')}
        ${panMarkup(g.right.x, g.right.y, pans.right, 'right', hoverSide === 'right')}
        ${trayMarkup()}`;
      dragLayer.innerHTML = drag
        ? `<svg x="${drag.x - 24}" y="${drag.y - 24}" width="48" height="48" viewBox="0 0 100 100"
                style="pointer-events:none">${spriteBody(drag.item.sprite, drag.item.color)}</svg>`
        : '';
    }

    // Eases the beam toward the angle the current counts call for, so a
    // drop visibly tips (or levels) the scale instead of snapping.
    function animate() {
      const target = solved ? 0 : targetAngle();
      angle += (target - angle) * 0.18;
      if (Math.abs(target - angle) < 0.002) angle = target;
      paint();
      rafId = angle === target ? null : requestAnimationFrame(animate);
    }
    const kick = () => { if (!rafId) rafId = requestAnimationFrame(animate); };

    const toSvgPoint = (e) => {
      const m = svg.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    };

    function dropTarget(p) {
      const g = geometry();
      const dl = Math.hypot(p.x - g.left.x, p.y - g.left.y);
      const dr = Math.hypot(p.x - g.right.x, p.y - g.right.y);
      if (Math.min(dl, dr) <= DROP_R) return dl <= dr ? 'left' : 'right';
      if (p.y >= TRAY.y - 20) return 'tray';
      return null;
    }

    function onDown(e) {
      if (solved) return;
      const src = e.target.closest('[data-src]');
      if (!src) return;
      const from = src.dataset.src;
      const id = Number(src.dataset.id);
      const list = from === 'tray' ? tray : pans[from];
      const item = list.find((it) => it.id === id);
      if (!item) return;
      // Lift it out of where it was; it goes back there if dropped nowhere.
      if (from === 'tray') tray = tray.filter((it) => it !== item);
      else pans[from] = pans[from].filter((it) => it !== item);
      const p = toSvgPoint(e);
      drag = { item, from, x: p.x, y: p.y };
      try { svg.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
      ctx.sfx('tap');
      kick();
      paint();
      e.preventDefault();
    }

    function onMove(e) {
      if (!drag) return;
      const p = toSvgPoint(e);
      drag.x = p.x;
      drag.y = p.y;
      hoverSide = dropTarget(p);
      paint();
      e.preventDefault();
    }

    function onUp(e) {
      if (!drag) return;
      const where = dropTarget(toSvgPoint(e)) || drag.from;
      if (where === 'tray') tray.push(drag.item);
      else pans[where].push(drag.item);
      drag = null;
      hoverSide = null;

      const added = pans.left.some((it) => it.added) || pans.right.some((it) => it.added);
      if (added && pans.left.length === pans.right.length) {
        solved = true;
        ctx.win(wrap);
      } else if (where !== 'tray') {
        ctx.sfx('tap');
      }
      kick();
      paint();
    }

    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    ctx.onCleanup(() => {
      svg.removeEventListener('pointerdown', onDown);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerup', onUp);
      svg.removeEventListener('pointercancel', onUp);
      if (rafId) cancelAnimationFrame(rafId);
    });

    paint();
  },
};
