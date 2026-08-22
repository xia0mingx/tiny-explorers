/* Mazes — drag the animal home.

   The maze is a standard recursive-backtracker grid (every cell reachable,
   exactly one path between any two cells), drawn as a sandy path through hedges
   rather than as thin wall lines: a 2-year-old reads "walk on the sand" far more
   easily than "don't cross the line".

   The drag model is cell-based, not pixel-based, and is deliberately generous:
   the finger's CELL is what matters, and a move is accepted only into an
   orthogonally adjacent cell with no wall between. Everything else is ignored
   rather than punished — dragging across a hedge simply does nothing, lifting a
   finger keeps all progress, and retreating along your own path erases it so the
   trail always shows a genuine route.

   Age progression is grid size: 3x3 -> 4x4 -> 5x5 -> 6x6, so the corridors stay
   physically wide on a tablet at every level.
*/

import { el, pick, range, shuffle } from '../util.js';
import { spriteBody, ANIMALS, PALETTE } from '../art.js';

const CELL = 100;              // viewBox units per cell
const HALF = CELL / 2;
const ROAD = 62;               // corridor width
const CONFIG = { 2: 3, 3: 4, 4: 5, 5: 6 };

/** Recursive backtracker. Walls start closed; carving opens both sides. */
function generate(cols, rows) {
  const at = (c, r) => r * cols + c;
  const cells = range(cols * rows).map(() => ({ n: true, e: true, s: true, w: true, seen: false }));
  const DIRS = [
    { d: 'n', dc: 0, dr: -1, o: 's' },
    { d: 's', dc: 0, dr: 1,  o: 'n' },
    { d: 'e', dc: 1, dr: 0,  o: 'w' },
    { d: 'w', dc: -1, dr: 0, o: 'e' },
  ];

  const stack = [[0, 0]];
  cells[0].seen = true;

  while (stack.length) {
    const [c, r] = stack[stack.length - 1];
    const options = shuffle(DIRS).filter(({ dc, dr }) => {
      const nc = c + dc; const nr = r + dr;
      return nc >= 0 && nc < cols && nr >= 0 && nr < rows && !cells[at(nc, nr)].seen;
    });

    if (!options.length) { stack.pop(); continue; }

    const { d, dc, dr, o } = options[0];
    const nc = c + dc; const nr = r + dr;
    cells[at(c, r)][d] = false;
    cells[at(nc, nr)][o] = false;
    cells[at(nc, nr)].seen = true;
    stack.push([nc, nr]);
  }
  return { cells, at, cols, rows };
}

/** Corridors as overlapping rounded rects: one per cell plus one per opening. */
function roadMarkup({ cells, at, cols, rows }) {
  const parts = [];
  const rect = (x, y, w, h) =>
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#ffe9c9"/>`);

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cx = c * CELL + HALF;
      const cy = r * CELL + HALF;
      rect(cx - ROAD / 2, cy - ROAD / 2, ROAD, ROAD);
      // Draw each opening once, from the west/north side of the pair.
      if (!cells[at(c, r)].e) rect(cx, cy - ROAD / 2, CELL, ROAD);
      if (!cells[at(c, r)].s) rect(cx - ROAD / 2, cy, ROAD, CELL);
    }
  }
  return parts.join('');
}

export default {
  id: 'maze',
  title: 'Mazes',
  subtitle: 'Find the way',
  color: '#8ee36b',
  rounds: () => 3,

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="4" y="4" width="92" height="92" rx="14" fill="#8ee36b"/>
      <path d="M20 20 H80 V44 H44 V68 H80" stroke="#ffe9c9" stroke-width="16"
            fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="20" cy="20" r="9" fill="#ff8fab"/>
      <circle cx="80" cy="68" r="9" fill="#ffc93c"/>
    </svg>`,

  round(ctx) {
    const size = CONFIG[ctx.age];
    const maze = generate(size, size);
    const { cells, at } = maze;

    const hero = pick(ANIMALS);
    const color = pick(PALETTE);
    const goal = [size - 1, size - 1];

    ctx.prompt('Drag along the path to the star!');

    const wrap = el('div', { class: 'maze-wrap' });
    wrap.innerHTML = `
      <svg viewBox="0 0 ${size * CELL} ${size * CELL}" class="maze-svg" aria-hidden="true">
        <rect width="${size * CELL}" height="${size * CELL}" rx="18" fill="#7cc95e"/>
        ${roadMarkup(maze)}
        <polyline class="trail" fill="none" stroke="${color}" stroke-opacity=".55"
                  stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
        <g class="goal"></g>
        <g class="hero"></g>
      </svg>`;

    ctx.stage.append(el('div', { class: 'stage-figure' }, wrap));

    const svg = wrap.querySelector('svg');
    const trail = wrap.querySelector('.trail');
    const heroG = wrap.querySelector('.hero');

    wrap.querySelector('.goal').innerHTML =
      `<svg x="${goal[0] * CELL + 22}" y="${goal[1] * CELL + 22}" width="56" height="56"
            viewBox="0 0 100 100" class="pulse">${spriteBody('star', '#ffc93c')}</svg>`;

    let path = [[0, 0]];
    let dragging = false;
    let done = false;

    const centre = ([c, r]) => [c * CELL + HALF, r * CELL + HALF];

    const paint = () => {
      trail.setAttribute('points', path.map(centre).map(([x, y]) => `${x},${y}`).join(' '));
      const [hx, hy] = centre(path[path.length - 1]);
      heroG.innerHTML =
        `<svg x="${hx - 34}" y="${hy - 34}" width="68" height="68" viewBox="0 0 100 100">
           ${spriteBody(hero, color)}</svg>`;
    };

    const cellAt = (e) => {
      const m = svg.getScreenCTM();
      if (!m) return null;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      const c = Math.floor(p.x / CELL);
      const r = Math.floor(p.y / CELL);
      if (c < 0 || c >= size || r < 0 || r >= size) return null;
      return [c, r];
    };

    const connected = ([c, r], [nc, nr]) => {
      if (nc === c + 1 && nr === r) return !cells[at(c, r)].e;
      if (nc === c - 1 && nr === r) return !cells[at(c, r)].w;
      if (nc === c && nr === r + 1) return !cells[at(c, r)].s;
      if (nc === c && nr === r - 1) return !cells[at(c, r)].n;
      return false;                         // diagonals and jumps are ignored
    };

    const onDown = (e) => {
      if (done) return;
      const cur = cellAt(e);
      // Must pick the hero up from where it actually is.
      if (!cur || cur[0] !== path[path.length - 1][0] || cur[1] !== path[path.length - 1][1]) return;
      dragging = true;
      // Capture keeps the drag alive when the finger leaves the element. It
      // throws if the pointer is no longer active (a race on fast lifts), which
      // must not abort the drag we just started.
      try { svg.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!dragging || done) return;
      e.preventDefault();
      const next = cellAt(e);
      if (!next) return;

      const head = path[path.length - 1];
      if (next[0] === head[0] && next[1] === head[1]) return;

      const prev = path[path.length - 2];
      if (prev && next[0] === prev[0] && next[1] === prev[1]) {
        path.pop();                          // walking back the way you came
        paint();
        return;
      }

      if (!connected(head, next)) return;    // a hedge: nothing happens
      path.push(next);
      paint();

      if (next[0] === goal[0] && next[1] === goal[1]) {
        done = true;
        dragging = false;
        ctx.win(wrap);
      } else {
        ctx.ping();
      }
    };

    const onUp = () => { dragging = false; };

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

    paint();
  },
};
