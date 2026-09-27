/* Sort It — drag each thing into the basket where it belongs: animals in
   one, everyday objects in the other. A different skill than every other
   game in the roster: they all ask "which looks the same" (shape/colour/
   silhouette matching); this one asks "which kind is it".

   Each basket carries a small pale hint icon — one example already
   "sorted", colourless like Shapes' hole — instead of a text label, so
   which side is which never depends on reading. Left/right assignment is
   randomised every round so a child can't just learn "animals go left".

   A wrong drop bounces the item back to its spot in the tray rather than
   penalising anything — same "no fail state" rule as every other game.
*/

import { el, pick, shuffle, range } from '../util.js';
import { spriteBody, toSilhouette, ANIMALS, OBJECTS, PALETTE } from '../art.js';

/** Items per round — the only difficulty knob, same idea as Balance's
 *  MAX_ITEMS: how much can be held in mind at once, not a harder rule. */
const CONFIG = { 2: 3, 3: 4, 4: 5, 5: 6 };

const VB_W = 300;
const VB_H = 190;
const ITEM = 46;              // tray sprite size, in viewBox units
const BIN_Y = 118;
const BIN_H = 58;
const BIN_W = 132;
const SLOT_SIZE = 30;
const SLOT_GAP = 26;
const HINT_TONE = '#ded8ea';  // same colourless hint tone Shapes' hole uses

function binHint(sprite) {
  return `<svg x="10" y="8" width="26" height="26" viewBox="0 0 100 100" opacity=".6">
            ${toSilhouette(spriteBody(sprite), HINT_TONE)}
          </svg>`;
}

function binMarkup(bin) {
  return `
    <g transform="translate(${bin.x},${BIN_Y})">
      <rect width="${BIN_W}" height="${BIN_H}" rx="18" fill="#f4f1fa" stroke="#ded8ea" stroke-width="3"/>
      ${binHint(bin.hint)}
      <g class="bin-slots" data-side="${bin.side}"></g>
    </g>`;
}

/** Where the nth item sorted into a bin sits, so items line up in a small
 *  row instead of stacking on top of each other. */
function slotPos(n) {
  return { x: 22 + n * SLOT_GAP, y: BIN_H / 2 + 3 };
}

export default {
  id: 'sortIt',
  title: 'Sort It',
  subtitle: 'Animal or thing?',
  color: '#8ee36b',
  rounds: () => 5,

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="4" y="52" width="42" height="34" rx="10" fill="#8ee36b"/>
      <rect x="54" y="52" width="42" height="34" rx="10" fill="#ffc93c"/>
      <circle cx="24" cy="34" r="15" fill="#ff8fab"/>
      <circle cx="19" cy="30" r="2.8" fill="#403d52"/>
      <circle cx="29" cy="30" r="2.8" fill="#403d52"/>
      <path d="M60 24 Q74 6 86 22 Q90 34 75 40 Q60 34 60 24 Z" fill="#b79bff"/>
    </svg>`,

  round(ctx) {
    const count = CONFIG[ctx.age];

    // Guarantee at least one of each category, then fill the rest randomly.
    const cats = shuffle([
      'animal', 'object',
      ...range(count - 2).map(() => pick(['animal', 'object'])),
    ]);
    const items = cats.map((category) => ({
      category,
      sprite: pick(category === 'animal' ? ANIMALS : OBJECTS),
      color: pick(PALETTE),
      pos: { x: 0, y: 0 },
      home: { x: 0, y: 0 },
      sorted: null, // null while in the tray, else 'left' | 'right'
    }));

    items.forEach((it, i) => {
      const home = { x: ((i + 1) * VB_W) / (items.length + 1), y: 42 };
      it.home = home;
      it.pos = { ...home };
    });

    const catOrder = shuffle(['animal', 'object']);
    const bins = {
      left:  { side: 'left',  x: 14,                    category: catOrder[0] },
      right: { side: 'right', x: VB_W - BIN_W - 14,      category: catOrder[1] },
    };
    bins.left.hint = pick(bins.left.category === 'animal' ? ANIMALS : OBJECTS);
    bins.right.hint = pick(bins.right.category === 'animal' ? ANIMALS : OBJECTS);

    ctx.prompt('Sort them into the right basket!');

    const wrap = el('div', { class: 'stage-figure' });
    wrap.innerHTML = `
      <svg viewBox="0 0 ${VB_W} ${VB_H}" class="sort-svg">
        ${binMarkup(bins.left)}
        ${binMarkup(bins.right)}
        <g class="tray"></g>
      </svg>`;
    ctx.stage.append(wrap);

    const svg = wrap.querySelector('svg');
    const tray = wrap.querySelector('.tray');
    const leftSlots = wrap.querySelector('[data-side="left"]');
    const rightSlots = wrap.querySelector('[data-side="right"]');

    const itemMarkup = (it, idx) => `
      <g data-idx="${idx}" transform="translate(${it.pos.x},${it.pos.y})" style="cursor:pointer">
        <svg x="${-ITEM / 2}" y="${-ITEM / 2}" width="${ITEM}" height="${ITEM}" viewBox="0 0 100 100">
          ${spriteBody(it.sprite, it.color)}
        </svg>
      </g>`;

    const paintTray = () => {
      tray.innerHTML = items.map((it, i) => (it.sorted ? '' : itemMarkup(it, i))).join('');
    };

    const paintSlots = () => {
      const fill = (host, side) => {
        const sorted = items.filter((it) => it.sorted === side);
        host.innerHTML = sorted.map((it, n) => {
          const p = slotPos(n);
          return `<svg x="${p.x - SLOT_SIZE / 2}" y="${p.y - SLOT_SIZE / 2}"
                       width="${SLOT_SIZE}" height="${SLOT_SIZE}" viewBox="0 0 100 100">
                    ${spriteBody(it.sprite, it.color)}
                  </svg>`;
        }).join('');
      };
      fill(leftSlots, 'left');
      fill(rightSlots, 'right');
    };

    paintTray();
    paintSlots();

    let grabbed = null; // index of the item currently being dragged

    const toSvgPoint = (e) => {
      const m = svg.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    };

    const binAt = (p) => {
      if (p.y < BIN_Y || p.y > BIN_Y + BIN_H) return null;
      if (p.x >= bins.left.x && p.x <= bins.left.x + BIN_W) return 'left';
      if (p.x >= bins.right.x && p.x <= bins.right.x + BIN_W) return 'right';
      return null;
    };

    const onDown = (e) => {
      const g = e.target.closest('[data-idx]');
      if (!g) return;
      grabbed = Number(g.dataset.idx);
      try { svg.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
      e.preventDefault();
    };

    const onMove = (e) => {
      if (grabbed === null) return;
      items[grabbed].pos = toSvgPoint(e);
      paintTray();
      e.preventDefault();
    };

    const onUp = () => {
      if (grabbed === null) return;
      const it = items[grabbed];
      grabbed = null;
      const drop = binAt(it.pos);

      if (!drop) { it.pos = { ...it.home }; paintTray(); return; }

      if (bins[drop].category === it.category) {
        it.sorted = drop;
        paintTray();
        paintSlots();
        if (items.every((x) => x.sorted)) ctx.win(wrap);
        else ctx.ping();
      } else {
        ctx.nudge(wrap);
        it.pos = { ...it.home };
        paintTray();
      }
    };

    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    ctx.onCleanup(() => {
      svg.removeEventListener('pointerdown', onDown);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerup', onUp);
      svg.removeEventListener('pointercancel', onUp);
    });
  },
};
