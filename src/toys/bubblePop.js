/* Bubble Pop — bubbles drift up from the bottom forever; tap one to pop it
   and it resets at the bottom with a new size, colour and drift. No score,
   no win state, nothing to get wrong — the simplest possible cause-and-
   effect toy in the app, for the youngest end of the age range this whole
   thing is built for.

   A fixed pool of bubble elements is created once and mutated every frame
   (position via transform, pop progress via scale/opacity) rather than
   rebuilt with innerHTML each tick — same reason Gear Machine updates
   transforms in place instead of re-rendering: rebuilding markup mid-pop
   would blow away the animation that's the whole point of the tap.
*/

import { el, pick, randInt } from '../util.js';
import { PALETTE } from '../art.js';
import { sfx } from '../audio.js';

const VB_W = 300;
const VB_H = 200;
const POOL_SIZE = 11;
const POP_FRAMES = 16;  // ~0.27s at 60fps — long enough to read as a pop, snappy enough to feel responsive
const HIT_PAD = 1.35;   // generous tap target beyond the drawn radius, for small fingers

function makeBubble() {
  const r = randInt(16, 34);
  return {
    x: randInt(r, VB_W - r),
    baseX: 0,
    y: 0,
    r,
    color: pick(PALETTE),
    speed: 0.55 + Math.random() * 0.85,
    wobbleAmp: randInt(6, 16),
    phase: Math.random() * Math.PI * 2,
    popped: false,
    popT: 0,
  };
}

/** Reset a bubble to a fresh one at the bottom, reusing the same object so
 *  callers holding a reference (the pool array) keep working unchanged. */
function respawn(b, staggered) {
  const fresh = makeBubble();
  fresh.baseX = fresh.x;
  fresh.y = VB_H + fresh.r + (staggered ? randInt(0, 220) : 0);
  Object.assign(b, fresh, { popped: false, popT: 0 });
}

export default {
  id: 'bubblePop',
  title: 'Bubble Pop',
  color: '#6cc0ff',

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="34" cy="60" r="26" fill="#6cc0ff"/>
      <circle cx="26" cy="50" r="7" fill="#fff" opacity=".7"/>
      <circle cx="72" cy="38" r="18" fill="#ffc93c"/>
      <circle cx="66" cy="32" r="5" fill="#fff" opacity=".7"/>
      <circle cx="70" cy="76" r="14" fill="#ff8fab"/>
      <circle cx="66" cy="72" r="4" fill="#fff" opacity=".7"/>
    </svg>`,

  mount(ctx) {
    const bubbles = Array.from({ length: POOL_SIZE }, () => makeBubble());
    bubbles.forEach((b) => { respawn(b, true); });

    const wrap = el('div', { class: 'bubble-wrap' });
    wrap.innerHTML = `<svg viewBox="0 0 ${VB_W} ${VB_H}" class="bubble-svg">
        ${bubbles.map((b, i) => `
          <g class="bubble" data-i="${i}" transform="translate(${b.x},${b.y})">
            <circle r="${b.r}" fill="${b.color}" opacity=".85"/>
            <circle cx="${-b.r * 0.32}" cy="${-b.r * 0.32}" r="${b.r * 0.28}" fill="#fff" opacity=".55"/>
          </g>`).join('')}
      </svg>`;
    ctx.stage.append(wrap);

    const svg = wrap.querySelector('.bubble-svg');
    let rafId = null;

    function updateOne(b, i) {
      const g = svg.querySelector(`.bubble[data-i="${i}"]`);
      if (!g) return;
      const scale = b.popped ? 1 + (b.popT / POP_FRAMES) * 0.6 : 1;
      const opacity = b.popped ? Math.max(0, 1 - b.popT / POP_FRAMES) : 1;
      g.setAttribute('transform', `translate(${b.x},${b.y}) scale(${scale})`);
      g.style.opacity = opacity;
    }

    function frame() {
      bubbles.forEach((b, i) => {
        if (b.popped) {
          b.popT += 1;
          if (b.popT >= POP_FRAMES) respawn(b, false);
        } else {
          b.y -= b.speed;
          b.phase += 0.025;
          b.x = b.baseX + Math.sin(b.phase) * b.wobbleAmp;
          if (b.y < -b.r) respawn(b, false);
        }
        updateOne(b, i);
      });
      rafId = requestAnimationFrame(frame);
    }

    const toSvgPoint = (e) => {
      const m = svg.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    };

    function onDown(e) {
      const p = toSvgPoint(e);
      // Closest unpopped bubble whose (generous) hit radius contains the
      // tap, rather than whichever element happened to be on top — small
      // moving circles are easy to miss by a pixel or two, especially for
      // a toddler's finger.
      let best = null;
      let bestDist = Infinity;
      bubbles.forEach((b) => {
        if (b.popped) return;
        const d = Math.hypot(p.x - b.x, p.y - b.y);
        if (d <= b.r * HIT_PAD && d < bestDist) { best = b; bestDist = d; }
      });
      if (!best) return;
      best.popped = true;
      best.popT = 0;
      sfx('sparkle');
      e.preventDefault();
    }

    svg.addEventListener('pointerdown', onDown);
    ctx.onCleanup(() => {
      svg.removeEventListener('pointerdown', onDown);
      if (rafId) cancelAnimationFrame(rafId);
    });

    rafId = requestAnimationFrame(frame);
  },
};
