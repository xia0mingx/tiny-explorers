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

import { el, pick, leadFinger } from '../util.js';
import { PALETTE, shade } from '../art.js';
import { sfx } from '../audio.js';

const EASE = 0.14;
const HISTORY_MAX = 600;
const MIN_STEP = 2.5;       // only record a new trail point once moved at least this far
const STOP_THRESHOLD = 0.5;
const VEHICLE_SCALE = 1.5;  // engine/carriages drawn at this scale so they read clearly on the wide map
// The view always covers at least this much of the town (in map units), whatever
// the screen shape — so zoom is the same on every device and the 4-carriage
// train always fits across the screen.
const VIEW_MIN_W = 700;
const VIEW_MIN_H = 460;
const CARRIAGE_COUNT = 4;
// Arc-length gap behind the engine per carriage — a touch more than a
// carriage's own on-screen width (44 units * VEHICLE_SCALE) so each one is
// fully visible with a small gap, instead of stacked behind the last.
const CARRIAGE_SPACING = 50 * VEHICLE_SCALE;

const SKINS = ['#ffd9b8', '#f2b88a', '#c98d5f', '#8d5a3b'];
const HAIRS = ['#403d52', '#7a4a2a', '#e8b84a', '#c0502b'];
const makePerson = () => ({ skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(PALETTE) });

/** A small passenger sitting inside a window box (wx, wy, ww, wh):
 *  shoulders, head, hair cap and a tiny face, all derived from the box so the
 *  same function fits the engine's cab window and the carriages' side windows. */
function passenger(wx, wy, ww, wh, p) {
  const cx = wx + ww / 2;
  const r = Math.min(ww, wh) * 0.3;
  const hy = wy + wh * 0.4;
  const bottom = wy + wh;
  const shoulderTop = hy + r * 0.8;
  return `
    <path d="M${cx - ww * 0.38} ${bottom} Q${cx} ${2 * shoulderTop - bottom} ${cx + ww * 0.38} ${bottom} Z" fill="${p.shirt}"/>
    <circle cx="${cx}" cy="${hy}" r="${r}" fill="${p.skin}"/>
    <path d="M${cx - r} ${hy} A${r} ${r} 0 0 1 ${cx + r} ${hy} Q${cx} ${hy - r * 0.5} ${cx - r} ${hy} Z" fill="${p.hair}"/>
    <circle cx="${cx - r * 0.4}" cy="${hy + r * 0.15}" r="${r * 0.14}" fill="#403d52"/>
    <circle cx="${cx + r * 0.4}" cy="${hy + r * 0.15}" r="${r * 0.14}" fill="#403d52"/>
    <path d="M${cx - r * 0.35} ${hy + r * 0.5} Q${cx} ${hy + r * 0.85} ${cx + r * 0.35} ${hy + r * 0.5}"
          stroke="#403d52" stroke-width="0.7" fill="none" stroke-linecap="round"/>`;
}

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

function trainEngine(color, driver) {
  return `
    <ellipse cx="0" cy="18" rx="30" ry="6" fill="#00000022"/>
    <path d="M18 12 L30 22 L14 22 Z" fill="${shade(color, -25)}"/>
    <rect x="-26" y="-20" width="52" height="34" rx="10" fill="${color}"/>
    <rect x="4" y="-34" width="18" height="16" rx="4" fill="${color}"/>
    <path d="M8 -34 L11 -49 L19 -49 L22 -34 Z" fill="${shade(color, -25)}"/>
    <ellipse cx="15" cy="-49" rx="6" ry="2.2" fill="${shade(color, -45)}"/>
    <rect x="-20" y="-9" width="17" height="13" rx="3" fill="#cdeeff" opacity=".9"/>
    ${passenger(-20, -9, 17, 13, driver)}
    <circle cx="26" cy="-4" r="3.6" fill="#ffd449"/>
    <rect x="-22" y="11" width="40" height="5" rx="2.5" fill="${shade(color, -45)}"/>
    <circle cx="-15" cy="14" r="8" fill="#403d52"/>
    <circle cx="4" cy="14" r="8" fill="#403d52"/>
    <circle cx="18" cy="14" r="8" fill="#403d52"/>
    <circle cx="-15" cy="14" r="3" fill="#8a869c"/>
    <circle cx="4" cy="14" r="3" fill="#8a869c"/>
    <circle cx="18" cy="14" r="3" fill="#8a869c"/>`;
}

function carriage(color, [left, right]) {
  return `
    <ellipse cx="0" cy="15" rx="24" ry="5" fill="#00000022"/>
    <rect x="-22" y="-14" width="44" height="26" rx="8" fill="${color}"/>
    <rect x="-19" y="-10" width="15" height="14" rx="3" fill="#cdeeff" opacity=".9"/>
    <rect x="4" y="-10" width="15" height="14" rx="3" fill="#cdeeff" opacity=".9"/>
    ${passenger(-19, -10, 15, 14, left)}
    ${passenger(4, -10, 15, 14, right)}
    <circle cx="-13" cy="12" r="7" fill="#403d52"/>
    <circle cx="13" cy="12" r="7" fill="#403d52"/>`;
}

/* A birds-eye town: two vertical streets and one horizontal street cut each
   BLOCK_W x BLOCK_H tile into six blocks, given a flat top-down filler (a
   rooftop, a park with round tree canopies, a pond) so the map reads as a
   real place rather than an empty grid. Nothing here is a lane the vehicle
   is held to — it's a backdrop, exactly like the old park scene was.

   The tile repeats in BOTH directions (see viewFor below), so streets stay
   continuous across tile seams and the result reads as one bigger town grid
   rather than a visibly repeated pattern. */
function topTree(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#5fd6a4"/>
          <circle cx="${cx - r * 0.3}" cy="${cy - r * 0.3}" r="${r * 0.4}" fill="#8ee36b" opacity=".7"/>`;
}

const BLOCK_W = 300;
const BLOCK_H = 200;
const LANE = 28; // width of a paved street / a track's ballast bed

/* A road: grey asphalt with a dashed centre line. A track: a ballast bed
   with two steel rails and evenly spaced wooden sleepers/ties running
   across it. Drawn as a straight strip from (x,y) either LANE-wide-by-w-long
   (horizontal) or w-tall-by-LANE-wide (vertical), so the same pair of
   functions builds both the one long cross-town street and the short
   street inside a single tile. */
function hLane(mode, x, y, w) {
  if (mode === 'car') {
    return `<rect x="${x}" y="${y}" width="${w}" height="${LANE}" fill="#8a869c"/>
      <path d="M${x} ${y + LANE / 2} H${x + w}" stroke="#fff" stroke-width="3" stroke-dasharray="10 10"/>`;
  }
  let ties = '';
  for (let sx = x + 10; sx < x + w; sx += 24) {
    ties += `<rect x="${sx}" y="${y + 3}" width="14" height="${LANE - 6}" rx="2" fill="#8a6a4a"/>`;
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${LANE}" fill="#cfc6ae"/>${ties}
    <rect x="${x}" y="${y + 6}" width="${w}" height="4" fill="#5b5770"/>
    <rect x="${x}" y="${y + LANE - 10}" width="${w}" height="4" fill="#5b5770"/>`;
}

function vLane(mode, x, y, h) {
  if (mode === 'car') {
    return `<rect x="${x}" y="${y}" width="${LANE}" height="${h}" fill="#8a869c"/>
      <path d="M${x + LANE / 2} ${y} V${y + h}" stroke="#fff" stroke-width="3" stroke-dasharray="10 10"/>`;
  }
  let ties = '';
  for (let sy = y + 10; sy < y + h; sy += 24) {
    ties += `<rect x="${x + 3}" y="${sy}" width="${LANE - 6}" height="14" rx="2" fill="#8a6a4a"/>`;
  }
  return `<rect x="${x}" y="${y}" width="${LANE}" height="${h}" fill="#cfc6ae"/>${ties}
    <rect x="${x + 6}" y="${y}" width="4" height="${h}" fill="#5b5770"/>
    <rect x="${x + LANE - 10}" y="${y}" width="4" height="${h}" fill="#5b5770"/>`;
}

function tileMarkup(mode, ox, oy) {
  const block = (x, y, w, h, color) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${color}"/>`;
  return `
    ${block(14 + ox, 14 + oy, 68, 68, '#ffd7a8')}
    ${block(138 + ox, 14 + oy, 44, 68, '#bfe3c0')}
    ${topTree(150 + ox, 30 + oy, 13)}${topTree(172 + ox, 54 + oy, 11)}
    ${block(238 + ox, 14 + oy, 48, 68, '#ffb3c6')}
    ${block(14 + ox, 138 + oy, 68, 48, '#a9cdff')}
    ${block(138 + ox, 138 + oy, 44, 48, '#ffe6a0')}
    ${block(238 + ox, 138 + oy, 48, 48, '#c9b8f2')}
    ${vLane(mode, 96 + ox, oy, BLOCK_H)}
    ${vLane(mode, 196 + ox, oy, BLOCK_H)}
    ${hLane(mode, ox, 96 + oy, BLOCK_W)}`;
}

function sceneMarkup(mode, cols, rows) {
  let tiles = '';
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) tiles += tileMarkup(mode, c * BLOCK_W, r * BLOCK_H);
  }
  return `<rect width="${cols * BLOCK_W}" height="${rows * BLOCK_H}" fill="#cdeccb"/>${tiles}`;
}

/* Works out what part of the town to show for a container of the given pixel
   size: the smallest view at least VIEW_MIN_W x VIEW_MIN_H map units that has
   the container's exact aspect ratio, so one screen pixel is the same fraction
   of the map on every device and the map never letterboxes. The town is then
   tiled with enough BLOCK_W x BLOCK_H tiles to cover that view (plus a tile of
   slack), and the view is centred on the middle of the tiled scene. Sizing by
   screen rather than by tile count matters: choosing "the grid whose aspect
   best matches" made the zoom jump wildly (one huge tile vs. three small
   ones) as the container's height changed by a few dozen pixels. */
function viewFor(pxW, pxH) {
  const unitsPerPx = Math.max(VIEW_MIN_W / pxW, VIEW_MIN_H / pxH);
  const w = pxW * unitsPerPx;
  const h = pxH * unitsPerPx;
  const cols = Math.ceil(w / BLOCK_W) + 1;
  const rows = Math.ceil(h / BLOCK_H) + 1;
  const x = (cols * BLOCK_W - w) / 2;
  const y = (rows * BLOCK_H - h) / 2;
  return { cols, rows, viewBox: `${x} ${y} ${w} ${h}` };
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
    let cols = 2;
    let rows = 1;
    const pos = { x: (cols * BLOCK_W) / 2, y: (rows * BLOCK_H) / 2 };
    const target = { ...pos };
    let angle = 0;
    const finger = leadFinger(); // which touch the car follows (see util.js)
    let rafId = null;
    const history = [];
    // Passengers are rolled once per visit, not per rebuildRig(), so picking a
    // new colour doesn't also swap everyone aboard for different people.
    const crew = {
      driver: makePerson(),
      carriages: Array.from({ length: CARRIAGE_COUNT }, () => [makePerson(), makePerson()]),
    };

    const toolbar = el('div', { class: 'drive-toolbar' });
    const wrap = el('div', { class: 'drive-wrap' });
    wrap.innerHTML = `<svg viewBox="0 0 ${cols * BLOCK_W} ${rows * BLOCK_H}" class="drive-svg">
      <g class="drive-scene"></g>
      <g class="drive-rig"></g></svg>`;
    ctx.toolbar.append(toolbar);
    ctx.stage.append(el('div', { class: 'drive-shell' }, wrap));

    const svg = wrap.querySelector('.drive-svg');
    const scene = wrap.querySelector('.drive-scene');
    const rig = wrap.querySelector('.drive-rig');

    // Walks backward through the trail accumulating real distance travelled,
    // so "one carriage-length behind the engine" means the same visual gap whether the
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
      if (engine) engine.setAttribute('transform', `translate(${pos.x} ${pos.y}) rotate(${angle}) scale(${VEHICLE_SCALE})`);
      rig.querySelectorAll('.drive-carriage').forEach((carEl) => {
        const back = pointBehind(CARRIAGE_SPACING * (Number(carEl.dataset.i) + 1));
        carEl.setAttribute('transform', `translate(${back.x} ${back.y}) rotate(${back.angle}) scale(${VEHICLE_SCALE})`);
      });
    }

    // Pre-fills the trail with a straight run behind the engine along its
    // current heading, so the carriages start lined up behind it instead of
    // all stacked on top of the engine until the first drag lays real trail.
    function seedTrail() {
      history.length = 0;
      if (mode !== 'train') return;
      const rad = (angle * Math.PI) / 180;
      const reach = CARRIAGE_SPACING * CARRIAGE_COUNT + MIN_STEP * 2;
      for (let d = reach; d >= 0; d -= MIN_STEP) {
        history.push({ x: pos.x - Math.cos(rad) * d, y: pos.y - Math.sin(rad) * d, angle });
      }
    }

    function rebuildRig() {
      let html = '';
      if (mode === 'train') {
        for (let i = CARRIAGE_COUNT - 1; i >= 0; i -= 1) {
          html += `<g class="drive-carriage" data-i="${i}">${carriage(i % 2 ? shade(color, -18) : color, crew.carriages[i])}</g>`;
        }
      }
      html += `<g class="drive-engine">${mode === 'car' ? carBody(color) : trainEngine(color, crew.driver)}</g>`;
      rig.innerHTML = html;
      seedTrail();
      applyTransforms();
    }

    // Puts the vehicle back at rest in the middle of the view. The train is
    // shifted right by half its own length so the whole thing (engine plus
    // trailing carriages) starts on screen instead of running off the left.
    function recenter() {
      const shift = mode === 'train' ? (CARRIAGE_SPACING * CARRIAGE_COUNT) / 2 - 20 : 0;
      pos.x = target.x = (cols * BLOCK_W) / 2 + shift;
      pos.y = target.y = (rows * BLOCK_H) / 2;
      angle = 0;
    }

    function renderScene() {
      scene.innerHTML = sceneMarkup(mode, cols, rows);
    }

    // Re-measures the wrap's actual box (not the viewport — the toolbar and
    // stage padding both eat into it) and re-solves the view for it. Fires
    // once on mount via ResizeObserver's guaranteed initial callback (same
    // reasoning as drawing.js's canvas resize — a manual call right after
    // mount can run before layout settles) and again on any rotation/resize.
    // Bails out when the view hasn't actually changed so a slow window drag
    // doesn't re-parse the scene markup on every intermediate frame.
    let lastViewBox = '';
    function layoutMap() {
      const rect = wrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const view = viewFor(rect.width, rect.height);
      if (view.viewBox === lastViewBox) return;
      lastViewBox = view.viewBox;
      cols = view.cols;
      rows = view.rows;
      svg.setAttribute('viewBox', view.viewBox);
      renderScene();
      // The view just changed size/shape (e.g. a device rotation) — recentre
      // the vehicle and re-seed the carriage trail rather than leaving it
      // pointing at coordinates from the old view, which would otherwise
      // render the train's carriages disconnected from the engine.
      recenter();
      seedTrail();
      applyTransforms();
    }

    const ro = new ResizeObserver(layoutMap);
    ro.observe(wrap);

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

      if (finger.active || Math.hypot(dx, dy) > STOP_THRESHOLD) {
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
      e.preventDefault();
      if (!finger.down(e)) return;
      const p = toSvgPoint(e);
      target.x = p.x;
      target.y = p.y;
      try { svg.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
      if (!rafId) rafId = requestAnimationFrame(frame);
    }

    function onMove(e) {
      if (!finger.move(e)) return;
      const p = toSvgPoint(e);
      target.x = p.x;
      target.y = p.y;
      // The animation may have parked if a finger took the lead from one
      // that had stopped.
      if (!rafId) rafId = requestAnimationFrame(frame);
      e.preventDefault();
    }

    const onUp = (e) => { finger.up(e); };

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
      ro.disconnect();
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
          onclick: () => { mode = 'car'; sfx('tap'); renderToolbar(); renderScene(); recenter(); rebuildRig(); },
        }),
        el('button', {
          class: `drive-mode ${mode === 'train' ? 'active' : ''}`, text: 'Train',
          onclick: () => { mode = 'train'; sfx('tap'); renderToolbar(); renderScene(); recenter(); rebuildRig(); },
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
    renderScene();
    rebuildRig();
  },
};
