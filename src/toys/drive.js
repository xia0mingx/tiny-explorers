/* Drive — steer a car or a little train around a birds-eye town map. The
   road grid is drawn from directly overhead, but it's still pure decoration,
   not a rail — driving across a block is just as valid as staying on a
   road, same "nothing to get wrong" rule every other toy in Free Play
   follows.

   Steering works by chasing a moving target: onMove only updates `target`,
   and one requestAnimationFrame loop eases the vehicle's position toward it
   every frame and derives heading from the direction of that chase, so the
   car/engine visibly turns into corners instead of snapping to face them.

   The train's carriages don't get their own physics — they sample the
   engine's own recent positions from a rolling history trail, each one a
   fixed ARC-LENGTH distance behind the engine (not a fixed number of
   frames). That distinction matters once the engine stops: easing spends
   many frames crawling the last few pixels into its resting spot, and a
   frame-count lookback would spend that whole tail sampling points that are
   all nearly on top of each other — the carriages visibly bunch into the
   engine right as it stops. Measuring by distance travelled instead means
   the carriages stay the same visual distance behind the engine whether
   it's speeding across the map or gliding to a stop.
*/

import { el, pick } from '../util.js';
import { PALETTE, shade } from '../art.js';
import { sfx } from '../audio.js';

const EASE = 0.14;
const HISTORY_MAX = 400;
const MIN_STEP = 2.5;       // only record a new trail point once moved at least this far
const CARRIAGE_SPACING = 36; // arc-length gap behind the engine per carriage
const STOP_THRESHOLD = 0.5;

function carBody(color) {
  return `
    <ellipse cx="0" cy="17" rx="34" ry="6" fill="#00000022"/>
    <rect x="-30" y="-14" width="60" height="24" rx="10" fill="${color}"/>
    <path d="M-13 -14 Q-5 -30 13 -30 Q25 -30 25 -14 Z" fill="${color}"/>
    <rect x="-8" y="-27" width="30" height="14" rx="4" fill="#cdeeff" opacity=".9"/>
    <circle cx="-16" cy="12" r="9" fill="#403d52"/>
    <circle cx="18" cy="12" r="9" fill="#403d52"/>
    <circle cx="-16" cy="12" r="3.4" fill="#8a869c"/>
    <circle cx="18" cy="12" r="3.4" fill="#8a869c"/>`;
}

function trainEngine(color) {
  return `
    <ellipse cx="0" cy="18" rx="30" ry="6" fill="#00000022"/>
    <rect x="-26" y="-20" width="52" height="34" rx="8" fill="${color}"/>
    <rect x="4" y="-34" width="18" height="16" rx="3" fill="${color}"/>
    <rect x="9" y="-48" width="8" height="15" rx="2" fill="#726e8a"/>
    <rect x="-20" y="-9" width="17" height="13" rx="3" fill="#cdeeff" opacity=".9"/>
    <circle cx="-15" cy="14" r="8" fill="#403d52"/>
    <circle cx="4" cy="14" r="8" fill="#403d52"/>
    <circle cx="18" cy="14" r="8" fill="#403d52"/>`;
}

function carriage(color) {
  return `
    <ellipse cx="0" cy="15" rx="24" ry="5" fill="#00000022"/>
    <rect x="-22" y="-14" width="44" height="26" rx="8" fill="${color}"/>
    <rect x="-14" y="-8" width="12" height="10" rx="2" fill="#cdeeff" opacity=".85"/>
    <rect x="2" y="-8" width="12" height="10" rx="2" fill="#cdeeff" opacity=".85"/>
    <circle cx="-13" cy="12" r="7" fill="#403d52"/>
    <circle cx="13" cy="12" r="7" fill="#403d52"/>`;
}

/* A birds-eye town: two vertical streets and one horizontal street cut the
   canvas into six blocks, each given a flat top-down filler (a rooftop, a
   park with round tree canopies, a pond) so the map reads as a real place
   rather than an empty grid. Nothing here is a lane the vehicle is held to
   — it's a backdrop, exactly like the old park scene was. */
function topTree(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#5fd6a4"/>
          <circle cx="${cx - r * 0.3}" cy="${cy - r * 0.3}" r="${r * 0.4}" fill="#8ee36b" opacity=".7"/>`;
}

function sceneMarkup() {
  const block = (x, y, w, h, color) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${color}"/>`;
  return `
    <rect width="300" height="200" fill="#cdeccb"/>

    ${block(14, 14, 68, 68, '#ffd7a8')}
    ${block(138, 14, 44, 68, '#bfe3c0')}
    ${topTree(150, 30, 13)}${topTree(172, 54, 11)}
    ${block(238, 14, 48, 68, '#ffb3c6')}
    ${block(14, 138, 68, 48, '#a9cdff')}
    ${block(138, 138, 44, 48, '#ffe6a0')}
    ${block(238, 138, 48, 48, '#c9b8f2')}

    <rect x="96" y="0" width="28" height="200" fill="#8a869c"/>
    <rect x="196" y="0" width="28" height="200" fill="#8a869c"/>
    <rect x="0" y="96" width="300" height="28" fill="#8a869c"/>

    <path d="M110 0 V200" stroke="#fff" stroke-width="3" stroke-dasharray="10 10"/>
    <path d="M210 0 V200" stroke="#fff" stroke-width="3" stroke-dasharray="10 10"/>
    <path d="M0 110 H300" stroke="#fff" stroke-width="3" stroke-dasharray="10 10"/>`;
}

export default {
  id: 'drive',
  title: 'Drive',
  color: '#ffc93c',

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="46" width="60" height="26" rx="9" fill="#ff9770"/>
      <path d="M20 46 Q26 30 42 30 Q52 30 52 46 Z" fill="#ff9770"/>
      <rect x="24" y="34" width="22" height="12" rx="3" fill="#cdeeff"/>
      <circle cx="24" cy="74" r="9" fill="#403d52"/>
      <circle cx="56" cy="74" r="9" fill="#403d52"/>
      <rect x="70" y="54" width="20" height="18" rx="5" fill="#6cc0ff"/>
      <circle cx="76" cy="74" r="6" fill="#403d52"/>
      <circle cx="86" cy="74" r="6" fill="#403d52"/>
    </svg>`,

  mount(ctx) {
    let mode = 'car';
    let color = pick(PALETTE);
    const pos = { x: 150, y: 110 };
    const target = { x: 150, y: 110 };
    let angle = 0;
    let dragging = false;
    let rafId = null;
    const history = [];

    const toolbar = el('div', { class: 'drive-toolbar' });
    const wrap = el('div', { class: 'drive-wrap' });
    wrap.innerHTML = `<svg viewBox="0 0 300 200" class="drive-svg">${sceneMarkup()}
      <g class="drive-rig"></g></svg>`;
    ctx.stage.append(el('div', { class: 'drive-shell' }, toolbar, wrap));

    const svg = wrap.querySelector('.drive-svg');
    const rig = wrap.querySelector('.drive-rig');

    // Walks backward through the trail accumulating real distance travelled,
    // so "36 units behind the engine" means the same visual gap whether the
    // engine got there by racing across the map or by easing to a stop.
    function pointBehind(distanceBack) {
      if (history.length === 0) return { ...pos, angle };
      let acc = 0;
      for (let i = history.length - 1; i > 0; i -= 1) {
        acc += Math.hypot(history[i].x - history[i - 1].x, history[i].y - history[i - 1].y);
        if (acc >= distanceBack) return history[i - 1];
      }
      return history[0];
    }

    function applyTransforms() {
      const engine = rig.querySelector('.drive-engine');
      if (engine) engine.setAttribute('transform', `translate(${pos.x} ${pos.y}) rotate(${angle})`);
      rig.querySelectorAll('.drive-carriage').forEach((carEl, idx) => {
        const back = pointBehind(CARRIAGE_SPACING * (idx + 1));
        carEl.setAttribute('transform', `translate(${back.x} ${back.y}) rotate(${back.angle})`);
      });
    }

    function rebuildRig() {
      history.length = 0;
      let html = `<g class="drive-engine">${mode === 'car' ? carBody(color) : trainEngine(color)}</g>`;
      if (mode === 'train') {
        html += `<g class="drive-carriage">${carriage(color)}</g>`;
        html += `<g class="drive-carriage">${carriage(shade(color, -18))}</g>`;
      }
      rig.innerHTML = html;
      applyTransforms();
    }

    function frame() {
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      pos.x += dx * EASE;
      pos.y += dy * EASE;
      if (Math.hypot(dx, dy) > STOP_THRESHOLD) angle = Math.atan2(dy, dx) * (180 / Math.PI);

      const last = history[history.length - 1];
      if (!last || Math.hypot(pos.x - last.x, pos.y - last.y) >= MIN_STEP) {
        history.push({ x: pos.x, y: pos.y, angle });
        if (history.length > HISTORY_MAX) history.shift();
      }

      applyTransforms();

      if (dragging || Math.hypot(dx, dy) > STOP_THRESHOLD) {
        rafId = requestAnimationFrame(frame);
      } else {
        rafId = null;
      }
    }

    const toSvgPoint = (e) => {
      const m = svg.getScreenCTM();
      if (!m) return { x: pos.x, y: pos.y };
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    };

    function onDown(e) {
      dragging = true;
      const p = toSvgPoint(e);
      target.x = p.x;
      target.y = p.y;
      try { svg.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
      if (!rafId) rafId = requestAnimationFrame(frame);
      e.preventDefault();
    }

    function onMove(e) {
      if (!dragging) return;
      const p = toSvgPoint(e);
      target.x = p.x;
      target.y = p.y;
      e.preventDefault();
    }

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
      if (rafId) cancelAnimationFrame(rafId);
    });

    // One wrapping row rather than mode buttons + swatches on separate lines
    // — on a tablet-width screen this packs onto a single line, so the
    // toolbar takes about half the vertical space and the map gets the rest.
    // Narrow screens still wrap it to two lines exactly as before; nothing
    // gets cut off, it just costs more height there than on a tablet.
    function renderToolbar() {
      const row = el('div', { class: 'drive-row' },
        el('button', {
          class: `drive-mode ${mode === 'car' ? 'active' : ''}`, text: 'Car',
          onclick: () => { mode = 'car'; sfx('tap'); renderToolbar(); rebuildRig(); },
        }),
        el('button', {
          class: `drive-mode ${mode === 'train' ? 'active' : ''}`, text: 'Train',
          onclick: () => { mode = 'train'; sfx('tap'); renderToolbar(); rebuildRig(); },
        }),
        el('button', {
          class: 'drive-horn', text: 'Honk!',
          onclick: () => sfx('horn'),
        }));

      PALETTE.forEach((c) => {
        row.append(el('button', {
          class: `swatch ${c === color ? 'active' : ''}`,
          style: { background: c },
          onclick: () => { color = c; sfx('tap'); renderToolbar(); rebuildRig(); },
        }));
      });

      toolbar.replaceChildren(row);
    }

    renderToolbar();
    rebuildRig();
  },
};
