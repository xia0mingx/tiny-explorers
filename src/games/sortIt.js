/* Sort It — drag each thing into the basket where it belongs: animals in
   one, everyday objects in the other. A different skill than every other
   game in the roster: they all ask "which looks the same" (shape/colour/
   silhouette matching); this one asks "which kind is it".

   Which basket is which has to be obvious without reading, so each one is
   a different colour (green for animals, yellow for things) and wears a
   header band showing two full-colour examples of what goes inside. The
   examples are picked from sprites *not* in this round's tray where
   possible, so the child sorts by kind rather than matching an identical
   picture. Left/right assignment is randomised every round so a child
   can't just learn "animals go left".

   While dragging, the basket under the finger thickens its outline so it's
   clear where the item will land. A wrong drop bounces the item back to
   its spot in the tray and briefly pulses the basket it *does* belong in —
   a nudge in the right direction, never a penalty, same "no fail state"
   rule as every other game.
*/

import { el, pick, shuffle, range } from '../util.js';
import { spriteBody, ANIMALS, OBJECTS, PALETTE } from '../art.js';

/** Items per round — the only difficulty knob, same idea as Balance's
 *  MAX_ITEMS: how much can be held in mind at once, not a harder rule. */
const CONFIG = { 2: 3, 3: 4, 4: 5, 5: 6 };

const VB_W = 300;
const VB_H = 206;
const ITEM = 46;              // tray sprite size, in viewBox units
const TRAY_Y = 34;
const BIN_Y = 76;
const BIN_H = 122;
const BIN_W = 138;
const BIN_MARGIN = 8;
const BAND_H = 44;            // coloured header band holding the examples
const EXAMPLE = 36;
const SLOT_SIZE = 30;
const SLOTS_PER_ROW = 3;      // 2 rows x 3 fits the most one bin can get (5)

/** Each category's look — colour is the at-a-glance cue, the examples in
 *  the band say what the colour means. */
const STYLE = {
  animal: { band: '#8ee36b', body: '#effbe9', line: '#5fbf3a' },
  object: { band: '#ffd45c', body: '#fff7dc', line: '#e8a900' },
};

function binMarkup(bin) {
  const st = STYLE[bin.category];
  const examples = bin.examples.map((ex, i) => {
    const x = BIN_W / 2 + (i === 0 ? -EXAMPLE - 4 : 4);
    return `<svg x="${x}" y="${(BAND_H - EXAMPLE) / 2}" width="${EXAMPLE}" height="${EXAMPLE}"
                 viewBox="0 0 100 100">${spriteBody(ex.sprite, ex.color)}</svg>`;
  }).join('');
  return `
    <g transform="translate(${bin.x},${BIN_Y})">
      <g class="sort-bin" data-bin="${bin.side}">
        <rect width="${BIN_W}" height="${BIN_H}" rx="18" fill="${st.body}"/>
        <rect width="${BIN_W}" height="${BAND_H}" rx="18" fill="${st.band}"/>
        <rect y="${BAND_H - 18}" width="${BIN_W}" height="18" fill="${st.band}"/>
        ${examples}
        <rect class="bin-outline" width="${BIN_W}" height="${BIN_H}" rx="18"
              fill="none" stroke="${st.line}" stroke-width="3"/>
        <g class="bin-slots" data-side="${bin.side}"></g>
      </g>
    </g>`;
}

/** Where the nth item sorted into a bin sits — a 3-wide grid under the
 *  band, so items line up instead of stacking or spilling past the edge. */
function slotPos(n) {
  const col = n % SLOTS_PER_ROW;
  const row = Math.floor(n / SLOTS_PER_ROW);
  const gap = BIN_W / SLOTS_PER_ROW;
  return { x: gap / 2 + col * gap, y: BAND_H + 21 + row * 36 };
}

/** Two examples of a category for a bin's band, preferring sprites that
 *  aren't in the tray this round. */
function pickExamples(category, items) {
  const pool = category === 'animal' ? ANIMALS : OBJECTS;
  const used = new Set(items.map((it) => it.sprite));
  const fresh = pool.filter((s) => !used.has(s));
  const source = fresh.length >= 2 ? fresh : pool;
  const colors = shuffle(PALETTE);
  return shuffle(source).slice(0, 2).map((sprite, i) => ({ sprite, color: colors[i] }));
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
      const home = { x: ((i + 1) * VB_W) / (items.length + 1), y: TRAY_Y };
      it.home = home;
      it.pos = { ...home };
    });

    const catOrder = shuffle(['animal', 'object']);
    const bins = {
      left:  { side: 'left',  x: BIN_MARGIN,                category: catOrder[0] },
      right: { side: 'right', x: VB_W - BIN_W - BIN_MARGIN, category: catOrder[1] },
    };
    for (const bin of Object.values(bins)) bin.examples = pickExamples(bin.category, items);

    ctx.prompt('Animals in one basket, things in the other!');

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
    const binEls = {
      left: wrap.querySelector('[data-bin="left"]'),
      right: wrap.querySelector('[data-bin="right"]'),
    };

    /** Thicken the outline of whichever basket the dragged item is over. */
    const setHot = (side) => {
      for (const [k, node] of Object.entries(binEls)) node.classList.toggle('is-hot', k === side);
    };

    let hintTimer = 0;
    /** Pulse the basket an item really belongs in after a wrong drop. */
    const showHint = (side) => {
      const node = binEls[side];
      node.classList.remove('is-hint');
      void node.getBBox(); // restart the animation if it's mid-pulse
      node.classList.add('is-hint');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => node.classList.remove('is-hint'), 1000);
    };

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

    // pointerId -> index of the item that finger is carrying. One entry per
    // finger, so a palm resting elsewhere (or a second hand) neither moves
    // nor drops the item the child is actually dragging.
    const grabbed = new Map();

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
      const idx = Number(g.dataset.idx);
      if ([...grabbed.values()].includes(idx)) return; // already in another finger
      grabbed.set(e.pointerId, idx);
      try { svg.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
      e.preventDefault();
    };

    const onMove = (e) => {
      const idx = grabbed.get(e.pointerId);
      if (idx === undefined) return;
      items[idx].pos = toSvgPoint(e);
      setHot(binAt(items[idx].pos));
      paintTray();
      e.preventDefault();
    };

    const onUp = (e) => {
      const idx = grabbed.get(e.pointerId);
      if (idx === undefined) return;
      const it = items[idx];
      grabbed.delete(e.pointerId);
      setHot(null);
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
        showHint(drop === 'left' ? 'right' : 'left');
        it.pos = { ...it.home };
        paintTray();
      }
    };

    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    ctx.onCleanup(() => {
      clearTimeout(hintTimer);
      svg.removeEventListener('pointerdown', onDown);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerup', onUp);
      svg.removeEventListener('pointercancel', onUp);
    });
  },
};
