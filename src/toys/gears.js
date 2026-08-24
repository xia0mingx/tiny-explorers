/* Gear Machine — tap any gear to spin the whole meshed chain. Pure
   cause-and-effect engineering play: no objective, nothing to get right,
   just watch how one gear turning makes its neighbours turn the opposite
   way, faster or slower depending on size — a real mechanical relationship,
   not a simulated one.

   Deliberately tap-to-spin rather than drag-to-rotate: dragging a gear
   smoothly around its own centre (tracking an angle, not a position) is a
   fine-motor skill well beyond a 2-year-old, where a flick/tap that spins
   something and lets it wind down is a toy they already know from
   pinwheels and tops. Repeated taps add more spin, capped, so it still
   rewards enthusiasm without needing precise control.

   The physics: gears meshed in a chain always turn opposite directions
   (that's what "meshed" means), and a bigger gear turns slower than a
   smaller one it's driving, in exact proportion to their radii — so
   boost() computes every OTHER gear's velocity from the tapped gear's,
   scaled by the radius ratio and sign-flipped once per step away from it,
   rather than modelling contact forces between neighbours.
*/

import { el, pick, clamp } from '../util.js';
import { PALETTE, shade, glyph } from '../art.js';
import { sfx } from '../audio.js';

const TOOTH_DEPTH = 8;
const TAP_BOOST = 0.09;
const MAX_VELOCITY = 0.22;
const FRICTION = 0.985;

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
      svg.addEventListener('click', onTap);
    }

    let svg;

    function boost(tappedIdx) {
      gears.forEach((g, j) => {
        const ratio = gears[tappedIdx].r / g.r;
        const sign = Math.abs(j - tappedIdx) % 2 === 0 ? 1 : -1;
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
      gears.forEach((g, i) => {
        wrap.querySelector(`.gear[data-i="${i}"]`)?.setAttribute(
          'transform', `translate(${g.cx},${g.cy}) rotate(${g.rotation})`);
      });
      rafId = moving ? requestAnimationFrame(frame) : null;
    }

    function onTap(e) {
      const gearEl = e.target.closest('.gear');
      if (!gearEl) return;
      boost(Number(gearEl.dataset.i));
      sfx('tap');
      if (!rafId) rafId = requestAnimationFrame(frame);
    }

    ctx.onCleanup(() => {
      svg?.removeEventListener('click', onTap);
      if (rafId) cancelAnimationFrame(rafId);
    });

    render();
  },
};
