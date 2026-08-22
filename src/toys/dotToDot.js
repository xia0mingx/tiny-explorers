/* Dot to Dot — connect numbered dots in order to reveal a shape.

   The only free-play toy with an inherent "correct order", but it still
   follows the app's no-fail-state rule: tapping a dot out of turn just
   wobbles it (reusing the same .wrong animation the quiz games use), only
   the right next dot ever advances anything, and no progress is ever lost.
   Unlike the quiz games this never "ends" — completing one shape fades it in
   with colour, celebrates quietly, and starts a new random shape after a
   pause, so it stays a free-play loop rather than a scored round.

   Dots are sampled along the same outline geometry the Shapes quiz game
   draws, using the getPointAtLength() trick tracing.js established — any SVG
   geometry element (path, circle, polygon...) supports it, so
   SHAPE_OUTLINE's raw `d` strings work directly without needing dedicated
   artwork for this toy.
*/

import { el, pick, range } from '../util.js';
import { SHAPE_OUTLINE, OUTLINE_SHAPE_IDS, PALETTE } from '../art.js';
import { sfx } from '../audio.js';

const DOT_COUNT = { 2: 5, 3: 8, 4: 12, 5: 16 };

export default {
  id: 'dot-to-dot',
  title: 'Dot to Dot',
  color: '#8ee36b',

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="12" r="6" fill="#403d52"/>
      <circle cx="88" cy="40" r="6" fill="#403d52"/>
      <circle cx="72" cy="88" r="6" fill="#403d52"/>
      <circle cx="28" cy="88" r="6" fill="#403d52"/>
      <circle cx="12" cy="40" r="6" fill="#403d52"/>
      <path d="M50 12 L88 40 L72 88 L28 88 L12 40 Z" stroke="#c9c2da"
            stroke-width="3" stroke-dasharray="4 6" fill="none"/>
    </svg>`,

  mount(ctx) {
    const n = DOT_COUNT[ctx.age] || 10;
    let svg;
    let dots;
    let nextIdx;
    let color;
    let shapeId;

    function sampleDots(id) {
      // A detached, invisible <svg> is enough to give the path real geometry
      // to measure — same approach tracing.js uses for its guide path.
      const probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      probe.innerHTML = `<path d="${SHAPE_OUTLINE[id]}"/>`;
      document.body.append(probe);
      const guide = probe.querySelector('path');
      const total = guide.getTotalLength();
      const pts = range(n).map((i) => guide.getPointAtLength((total * i) / n));
      probe.remove();
      return pts;
    }

    function trailD() {
      return dots.slice(0, nextIdx + 1)
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
    }

    function render() {
      const dotsMarkup = dots.map((p, i) => `
        <g class="dot ${i === 0 ? 'next pulse' : ''}" data-i="${i}">
          <circle cx="${p.x}" cy="${p.y}" r="7" fill="#fff" stroke="${color}" stroke-width="4"/>
          <text x="${p.x}" y="${p.y + 3.5}" text-anchor="middle" font-size="8"
                font-weight="800" fill="${color}">${i + 1}</text>
        </g>`).join('');

      ctx.stage.replaceChildren(el('div', { class: 'stage-figure' }, el('div', {
        class: 'dot-wrap',
        html: `<svg viewBox="0 0 100 100" class="dot-svg">
                 <path class="dot-fill" d="${SHAPE_OUTLINE[shapeId]}" fill="${color}" opacity="0"/>
                 <path class="dot-trail" d="" fill="none" stroke="${color}" stroke-width="3"
                       stroke-linecap="round" stroke-linejoin="round"/>
                 ${dotsMarkup}
               </svg>`,
      })));

      svg = ctx.stage.querySelector('.dot-svg');
      svg.addEventListener('click', onTap);
    }

    function onTap(e) {
      const g = e.target.closest('.dot');
      if (!g) return;
      const i = Number(g.dataset.i);

      if (i !== nextIdx) {
        sfx('wrong');
        g.classList.remove('wrong');
        void g.offsetWidth;
        g.classList.add('wrong');
        setTimeout(() => g.classList.remove('wrong'), 480);
        return;
      }

      g.classList.add('done');
      g.classList.remove('next', 'pulse');
      nextIdx += 1;
      svg.querySelector('.dot-trail').setAttribute('d', trailD());

      if (nextIdx >= dots.length) {
        sfx('sparkle');
        const fill = svg.querySelector('.dot-fill');
        fill.style.transition = 'opacity .6s ease';
        fill.style.opacity = '.85';
        setTimeout(newRound, 1700);
      } else {
        sfx('tap');
        svg.querySelector(`.dot[data-i="${nextIdx}"]`)?.classList.add('next', 'pulse');
      }
    }

    function newRound() {
      shapeId = pick(OUTLINE_SHAPE_IDS);
      color = pick(PALETTE);
      nextIdx = 0;
      dots = sampleDots(shapeId);
      render();
    }

    ctx.onCleanup(() => svg?.removeEventListener('click', onTap));
    newRound();
  },
};
