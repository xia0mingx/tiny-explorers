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

   A shape is one or more separate closed loops ("groups") — most are a
   single loop, but Mickey's head+ears and the car's body+wheels are each
   three. Dots are numbered continuously across every group, but the trail
   is drawn PER GROUP: nothing ever draws a connecting line from the last dot
   of one loop to the first dot of the next, since that would drag a stray
   line straight across the middle of the shape. See art.js's SHAPE_OUTLINE
   comment for why groups exist at all. */

import { el, pick, noRepeatPicker } from '../util.js';
import { SHAPE_OUTLINE, OUTLINE_SHAPES_BY_AGE, PALETTE } from '../art.js';
import { sfx } from '../audio.js';

const DOT_COUNT = { 2: 5, 3: 8, 4: 12, 5: 16 };
const MIN_PER_GROUP = 3;

// One no-repeat deck per age's shape pool, so the toy cycles through every
// shape available at that age before any of them come back around.
const pickers = Object.fromEntries(
  Object.entries(OUTLINE_SHAPES_BY_AGE).map(([age, ids]) => [age, noRepeatPicker(ids)]),
);

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
    const nextShape = pickers[ctx.age] || pickers[4];
    let svg;
    let dots;         // flat array of {x,y}, numbered 1..dots.length in order
    let groupStart;   // groupStart[gi] = index of that group's first dot
    let groupSize;    // groupSize[gi] = how many dots belong to that group
    let nextIdx;
    let color;
    let shapeId;

    function sampleShape(id) {
      const groupDs = SHAPE_OUTLINE[id];
      // A detached, invisible <svg> is enough to give each subpath real
      // geometry to measure — same approach tracing.js uses for its guide path.
      const probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      probe.innerHTML = groupDs.map((d) => `<path d="${d}"/>`).join('');
      document.body.append(probe);
      const guides = [...probe.querySelectorAll('path')];
      const lengths = guides.map((g) => g.getTotalLength());
      const total = lengths.reduce((a, b) => a + b, 0) || 1;

      // Split n dots across groups proportional to arc length, with a floor
      // so a small loop (an ear, a wheel) still reads as a shape rather than
      // a single stray dot.
      const counts = lengths.map((len) => Math.max(MIN_PER_GROUP, Math.round((n * len) / total)));

      const allDots = [];
      const gStart = [];
      const gSize = [];
      guides.forEach((guide, gi) => {
        gStart[gi] = allDots.length;
        const count = counts[gi];
        for (let i = 0; i < count; i += 1) {
          allDots.push(guide.getPointAtLength((lengths[gi] * i) / count));
        }
        gSize[gi] = count;
      });
      probe.remove();
      return { dots: allDots, groupStart: gStart, groupSize: gSize };
    }

    function groupIndexOf(idx) {
      for (let gi = 0; gi < groupStart.length; gi += 1) {
        if (idx >= groupStart[gi] && idx < groupStart[gi] + groupSize[gi]) return gi;
      }
      return groupStart.length - 1;
    }

    function trailD(gi) {
      const start = groupStart[gi];
      const size = groupSize[gi];
      const completed = Math.min(Math.max(nextIdx - start, 0), size);
      if (completed < 2) return '';
      return dots.slice(start, start + completed)
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
    }

    function render() {
      const dotsMarkup = dots.map((p, i) => `
        <g class="dot ${i === 0 ? 'next pulse' : ''}" data-i="${i}">
          <circle cx="${p.x}" cy="${p.y}" r="7" fill="#fff" stroke="${color}" stroke-width="4"/>
          <text x="${p.x}" y="${p.y + 3.5}" text-anchor="middle" font-size="8"
                font-weight="800" fill="${color}">${i + 1}</text>
        </g>`).join('');

      const trailsMarkup = groupStart.map((_, gi) => `
        <path class="dot-trail" data-g="${gi}" d="" fill="none" stroke="${color}"
              stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`).join('');

      ctx.stage.replaceChildren(el('div', { class: 'stage-figure' }, el('div', {
        class: 'dot-wrap',
        html: `<svg viewBox="0 0 100 100" class="dot-svg">
                 <path class="dot-fill" d="${SHAPE_OUTLINE[shapeId].join(' ')}"
                       fill="${color}" opacity="0"/>
                 ${trailsMarkup}
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
      const gi = groupIndexOf(i);
      nextIdx += 1;
      svg.querySelector(`.dot-trail[data-g="${gi}"]`)?.setAttribute('d', trailD(gi));

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
      shapeId = nextShape();
      color = pick(PALETTE);
      nextIdx = 0;
      ({ dots, groupStart, groupSize } = sampleShape(shapeId));
      render();
    }

    ctx.onCleanup(() => svg?.removeEventListener('click', onTap));
    newRound();
  },
};
