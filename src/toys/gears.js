/* Gear Machine — drag any gear around and the whole meshed chain turns
   with it. Pure cause-and-effect engineering play: no objective, nothing
   to get right, just watch how one gear turning makes its neighbours turn
   the opposite way, faster or slower depending on size — a real
   mechanical relationship, not a simulated one.

   Dragging directly sets rotation in real time (the gear tracks the
   angle from its own centre to the finger every pointermove, and that
   angle *is* its rotation — no easing, no physics, so it can never feel
   like it's ignoring the drag). A quick tap with negligible movement
   instead gives a fixed spin that winds down on its own, like a flicked
   pinwheel — the two gestures are told apart by how far the pointer
   actually moved between down and up, not by time held.

   The physics: gears meshed in a chain always turn opposite directions
   (that's what "meshed" means), and a bigger gear turns slower than a
   smaller one it's driving, in exact proportion to their radii. Both
   applyDelta() (while dragging) and boost() (on a tap) derive every
   OTHER gear's rotation/velocity from the dragged/tapped gear's, scaled
   by the radius ratio and sign-flipped once per step away from it,
   rather than modelling contact forces between neighbours.
*/

import { el, pick, clamp } from '../util.js';
import { PALETTE, shade, glyph } from '../art.js';
import { sfx } from '../audio.js';

const TOOTH_DEPTH = 8;
const TAP_BOOST = 0.09;
const MAX_VELOCITY = 0.22;
const FRICTION = 0.985;
const DRAG_THRESHOLD = 6; // degrees of cumulative movement before it counts as a drag, not a tap

/** A chain of 3 meshed gears: positions are derived from radii so adjacent
 *  gears sit exactly (r1 + r2) apart, i.e. actually touching/meshing. */
const LAYOUT = [
  { r: 52, teeth: 12 },
  { r: 36, teeth: 9 },
  { r: 22, teeth: 6 },
];

function buildGears(colors) {
  let x = 84;
  const cy = 104;
  return LAYOUT.map((spec, i) => {
    if (i > 0) x += LAYOUT[i - 1].r + spec.r;
    return { ...spec, cx: x, cy, color: colors[i], rotation: 0, velocity: 0 };
  });
}

/** Alternating outer/inner radius points around the centre — not a
 *  mechanically precise involute gear profile, just enough of a zigzag
 *  silhouette to read unmistakably as a cog. */
function gearPath(r, teeth) {
  const inner = r - TOOTH_DEPTH;
  const step = Math.PI / teeth;
  const pts = [];
  for (let i = 0; i < teeth * 2; i += 1) {
    const a = i * step;
    const rad = i % 2 === 0 ? r : inner;
    pts.push(`${(Math.cos(a) * rad).toFixed(2)},${(Math.sin(a) * rad).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

const angleTo = (cx, cy, p) => Math.atan2(p.y - cy, p.x - cx) * (180 / Math.PI);

/** Shortest signed difference between two angles in degrees, wrapped to
 *  (-180, 180] so a drag crossing the -180/180 seam doesn't jump. */
function angleDelta(from, to) {
  let d = to - from;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

export default {
  id: 'gears',
  title: 'Gear Machine',
  color: '#ffa9e7',

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <polygon points="${[...Array(16)].map((_, i) => {
        const a = (i * Math.PI) / 8;
        const r = i % 2 === 0 ? 34 : 24;
        return `${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`;
      }).join(' ')}" fill="#ff9770"/>
      <circle cx="50" cy="50" r="12" fill="#e8734a"/>
      <polygon points="${[...Array(12)].map((_, i) => {
        const a = (i * Math.PI) / 6;
        const r = i % 2 === 0 ? 20 : 13;
        return `${(80 + Math.cos(a) * r).toFixed(1)},${(26 + Math.sin(a) * r).toFixed(1)}`;
      }).join(' ')}" fill="#6cc0ff"/>
    </svg>`,

  mount(ctx) {
    let colors = [pick(PALETTE), pick(PALETTE), pick(PALETTE)];
    let gears = buildGears(colors);
    let rafId = null;
    let svg;
    let drag = null; // { idx, lastAngle, moved }

    const wrap = el('div', { class: 'gears-wrap' });
    const shuffle = el('button', {
      class: 'gears-shuffle', 'aria-label': 'New colours', html: glyph.dice(),
      onclick: () => {
        colors = [pick(PALETTE), pick(PALETTE), pick(PALETTE)];
        gears = buildGears(colors);
        sfx('sparkle');
        render();
      },
    });
    ctx.stage.append(el('div', { class: 'gears-shell' },
      el('div', { class: 'gears-toolbar' }, shuffle), wrap));

    function updateTransforms() {
      gears.forEach((g, i) => {
        wrap.querySelector(`.gear[data-i="${i}"]`)?.setAttribute(
          'transform', `translate(${g.cx},${g.cy}) rotate(${g.rotation})`);
      });
    }

    /** Apply a rotation step to gear `idx` and propagate it to every other
     *  gear in the chain, opposite in direction each step away and scaled
     *  by radius ratio — used live while dragging. */
    function applyDelta(idx, deltaDeg) {
      gears.forEach((g, j) => {
        const ratio = gears[idx].r / g.r;
        const sign = Math.abs(j - idx) % 2 === 0 ? 1 : -1;
        g.rotation = (g.rotation + deltaDeg * ratio * sign) % 360;
      });
      updateTransforms();
    }

    /** Same propagation rule, but adding to each gear's velocity instead of
     *  its rotation directly — used for a tap's flick-and-decay spin. */
    function boost(idx) {
      gears.forEach((g, j) => {
        const ratio = gears[idx].r / g.r;
        const sign = Math.abs(j - idx) % 2 === 0 ? 1 : -1;
        g.velocity = clamp(g.velocity + TAP_BOOST * ratio * sign, -MAX_VELOCITY, MAX_VELOCITY);
      });
    }

    function frame() {
      let moving = false;
      gears.forEach((g) => {
        g.rotation = (g.rotation + g.velocity * 60) % 360;
        g.velocity *= FRICTION;
        if (Math.abs(g.velocity) > 0.002) moving = true;
        else g.velocity = 0;
      });
      updateTransforms();
      rafId = moving ? requestAnimationFrame(frame) : null;
    }

    const toSvgPoint = (e) => {
      const m = svg.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    };

    function onDown(e) {
      const gearEl = e.target.closest('.gear');
      if (!gearEl) return;
      const idx = Number(gearEl.dataset.i);
      const g = gears[idx];
      g.velocity = 0; // grabbing a gear stops any ongoing coast immediately
      drag = { idx, lastAngle: angleTo(g.cx, g.cy, toSvgPoint(e)), moved: 0 };
      try { svg.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
      e.preventDefault();
    }

    function onMove(e) {
      if (!drag) return;
      const g = gears[drag.idx];
      const angle = angleTo(g.cx, g.cy, toSvgPoint(e));
      const delta = angleDelta(drag.lastAngle, angle);
      drag.lastAngle = angle;
      drag.moved += Math.abs(delta);
      applyDelta(drag.idx, delta);
      e.preventDefault();
    }

    function onUp() {
      if (!drag) return;
      // A near-stationary tap (finger came down and up without really
      // moving) reads as "spin this", not "I rotated it by ~0 degrees".
      if (drag.moved < DRAG_THRESHOLD) {
        boost(drag.idx);
        sfx('tap');
        if (!rafId) rafId = requestAnimationFrame(frame);
      }
      drag = null;
    }

    function render() {
      wrap.innerHTML = `<svg viewBox="0 0 300 200" class="gears-svg">
          ${gears.map((g, i) => `
            <g class="gear" data-i="${i}" transform="translate(${g.cx},${g.cy}) rotate(${g.rotation})">
              <path d="${gearPath(g.r, g.teeth)}" fill="${g.color}"/>
              <circle r="${g.r * 0.32}" fill="${shade(g.color, -25)}"/>
              <circle r="${g.r * 0.1}" fill="${shade(g.color, -45)}"/>
            </g>`).join('')}
        </svg>`;
      svg = wrap.querySelector('.gears-svg');
      svg.addEventListener('pointerdown', onDown);
      svg.addEventListener('pointermove', onMove);
      svg.addEventListener('pointerup', onUp);
      svg.addEventListener('pointercancel', onUp);
    }

    ctx.onCleanup(() => {
      svg?.removeEventListener('pointerdown', onDown);
      svg?.removeEventListener('pointermove', onMove);
      svg?.removeEventListener('pointerup', onUp);
      svg?.removeEventListener('pointercancel', onUp);
      if (rafId) cancelAnimationFrame(rafId);
    });

    render();
  },
};
