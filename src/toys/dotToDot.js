/* Dot to Dot — connect numbered dots in order to reveal a shape.

   The only free-play toy with an inherent "correct order", but it still
   follows the app's no-fail-state rule: touching a dot out of turn just
   wobbles it (the same .wrong animation the quiz games use), only the right
   next dot ever advances anything, and no progress is ever lost. Completing
   a shape closes the line, fills it with colour, gives it a smiling face and
   names it, then moves on to a new shape after a pause — a free-play loop,
   not a scored round.

   Both tapping dot after dot and dragging a finger through them work: a
   finger held down shows a stretchy line from the last dot, and passing
   over the next dot snaps the line onto it. That's how most toddlers try it
   first, and lifting the finger never loses anything.

   Dots come from art.js's SHAPE_OUTLINE geometry. Every sharp corner of
   the outline gets a dot first — straight or curved, so the star's tips,
   the fish's tail and the heart's point are all exact — then more dots
   split the biggest gaps until the age's dot budget is met. Spacing dots
   evenly by arc length alone used to miss corners, so a star connected
   into a lumpy blob. Smooth loops with no corners (a circle, a wheel) are
   sampled evenly with getPointAtLength(), the trick tracing.js established.

   A shape is one or more separate closed loops ("groups") — the car's body
   and two wheels. Dots are numbered
   continuously across groups, but each group's line is drawn and closed on
   its own, so nothing drags a stray line across the middle of the shape. */

import { el, noRepeatPicker, pick, leadFinger } from '../util.js';
import { SHAPE_OUTLINE, OUTLINE_SHAPES_BY_AGE, PALETTE, shade } from '../art.js';
import { sfx, sayAuto } from '../audio.js';

const DOT_COUNT = { 2: 5, 3: 8, 4: 12, 5: 16 };
const MIN_PER_GROUP = 3;
const DOT_R = 4.4;
const HIT_R = 9;          // generous touch radius in viewBox units, well beyond the drawn dot
const PAD = 8;            // viewBox margin so edge dots aren't clipped
const CORNER_DEG = 20;    // a turn sharper than this at a segment end gets a dot of its own
const FINE = 360;         // samples per loop when tracing it to find corners
const NEXT_ROUND_MS = 2600;

const NAMES = {
  circle: 'circle', square: 'square', triangle: 'triangle', diamond: 'diamond',
  star: 'star', heart: 'heart', moon: 'moon', house: 'house', cat: 'cat',
  fish: 'fish', tree: 'tree', rocket: 'rocket', snowman: 'snowman', car: 'car',
};

/* Where the reveal's face goes. Default: centre of the largest group's
   bounding box, sized to it. Overrides cover shapes whose bounding-box
   centre isn't on the shape (the moon's hollow), is too roomy (the star's
   thin points), or isn't the "head" (the snowman's biggest ball is its
   bottom). */
const FACE = {
  star: { scale: 0.32 },
  moon: { x: 24, y: 50, s: 26 },
  snowman: { x: 50, y: 24, s: 19 },
  rocket: { y: 44, scale: 0.45 },
  tree: { y: 40, scale: 0.45 },
  house: { y: 66, scale: 0.42 },
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const pickers = Object.fromEntries(
  Object.entries(OUTLINE_SHAPES_BY_AGE).map(([age, ids]) => [age, noRepeatPicker(ids)]),
);

/** The end point of every drawing command in a path's `d` string — the only
 *  places a sharp corner can be (between commands, never inside one). */
function segmentEnds(d) {
  const ARGS = { M: 2, L: 2, Q: 4, C: 6, A: 7 };
  const ends = [];
  for (const [, cmd, rest] of d.matchAll(/([MLQCAZ])([^MLQCAZ]*)/gi)) {
    const per = ARGS[cmd.toUpperCase()];
    if (!per) continue;
    const nums = (rest.match(/-?\d*\.?\d+/g) || []).map(Number);
    for (let i = 0; i + per <= nums.length; i += per) {
      ends.push({ x: nums[i + per - 2], y: nums[i + per - 1] });
    }
  }
  return ends;
}

function faceMarkup({ x, y, s }) {
  const eye = s * 0.065;
  return `
    <circle cx="${x - s * 0.18}" cy="${y - s * 0.06}" r="${eye}" fill="#403d52"/>
    <circle cx="${x + s * 0.18}" cy="${y - s * 0.06}" r="${eye}" fill="#403d52"/>
    <circle cx="${x - s * 0.18 + eye * 0.35}" cy="${y - s * 0.06 - eye * 0.35}" r="${eye * 0.35}" fill="#fff"/>
    <circle cx="${x + s * 0.18 + eye * 0.35}" cy="${y - s * 0.06 - eye * 0.35}" r="${eye * 0.35}" fill="#fff"/>
    <path d="M${x - s * 0.13} ${y + s * 0.1} Q${x} ${y + s * 0.26} ${x + s * 0.13} ${y + s * 0.1}"
          stroke="#403d52" stroke-width="${s * 0.045}" fill="none" stroke-linecap="round"/>
    <circle cx="${x - s * 0.3}" cy="${y + s * 0.1}" r="${s * 0.07}" fill="#ff9db0" opacity=".6"/>
    <circle cx="${x + s * 0.3}" cy="${y + s * 0.1}" r="${s * 0.07}" fill="#ff9db0" opacity=".6"/>`;
}

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
    let band;
    let caption;
    let dots;         // flat array of {x,y}, numbered 1..dots.length in order
    let groupStart;   // groupStart[gi] = index of that group's first dot
    let groupSize;    // groupSize[gi] = how many dots belong to that group
    let face;         // {x, y, s} for the reveal face
    let nextIdx;
    let color;
    let shapeId;
    let finished;
    // Which touch connects dots and drags the band — a resting palm
    // neither blocks the real finger nor joins dots itself (see util.js).
    const finger = leadFinger();
    let roundTimer = null;

    function sampleShape(id) {
      const groupDs = SHAPE_OUTLINE[id];
      // A detached, invisible <svg> gives each subpath real geometry to
      // measure — same approach tracing.js uses for its guide path.
      const probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      probe.innerHTML = groupDs.map((d) => `<path d="${d}"/>`).join('');
      document.body.append(probe);
      const guides = [...probe.querySelectorAll('path')];
      const lengths = guides.map((g) => g.getTotalLength());
      const boxes = guides.map((g) => g.getBBox());
      const total = lengths.reduce((a, b) => a + b, 0) || 1;
      const budgets = lengths.map((len) => Math.max(MIN_PER_GROUP, Math.round((n * len) / total)));

      // Every loop traced finely: to find its corners, and so a dot can be
      // kept clear of the OTHER loops' lines, not just their dots — where
      // loops touch (the car's wheels on its body) dots otherwise pile up.
      const fine = guides.map((g, gi) => Array.from({ length: FINE }, (_, k) => {
        const p = g.getPointAtLength((lengths[gi] * k) / FINE);
        return { x: p.x, y: p.y };
      }));
      const allDots = [];
      const clearanceFrom = (gi) => (p) => {
        let best = Infinity;
        fine.forEach((line, gj) => {
          if (gj === gi) return;
          for (let k = 0; k < line.length; k += 4) best = Math.min(best, dist(p, line[k]));
        });
        for (const d of allDots) best = Math.min(best, dist(p, d));
        return best;
      };

      /** Arc-length positions (0..len) of a loop's sharp corners: segment
       *  ends where the outline turns by more than CORNER_DEG. */
      function cornersOf(gi) {
        const line = fine[gi];
        const at = [];
        for (const e of segmentEnds(groupDs[gi])) {
          let k = 0;
          line.forEach((q, i) => { if (dist(q, e) < dist(line[k], e)) k = i; });
          const a = line[(k - 3 + FINE) % FINE];
          const b = line[(k + 3) % FINE];
          const v1 = { x: line[k].x - a.x, y: line[k].y - a.y };
          const v2 = { x: b.x - line[k].x, y: b.y - line[k].y };
          const cos = (v1.x * v2.x + v1.y * v2.y) / ((Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y)) || 1);
          const turn = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
          const len = (lengths[gi] * k) / FINE;
          if (turn > CORNER_DEG && !at.some((l) => Math.abs(l - len) < lengths[gi] / FINE * 4)) at.push(len);
        }
        return at.sort((x, y) => x - y);
      }

      const gStart = [];
      const gSize = [];
      guides.forEach((guide, gi) => {
        gStart[gi] = allDots.length;
        const clearance = clearanceFrom(gi);
        const total = lengths[gi];
        const pointAt = (len) => { const p = guide.getPointAtLength(((len % total) + total) % total); return { x: p.x, y: p.y }; };
        const marks = cornersOf(gi);
        let pts = [];

        if (marks.length) {
          // Every corner gets a dot (so a star connects into a star, not a
          // lumpy blob), then extra dots split the biggest gaps between
          // them, until the age's dot budget is met.
          // A curved stretch between two corners always gets at least one
          // dot of its own, or the line would cut straight across it — the
          // moon's inner curve would join tip to tip and draw a "D".
          for (const [a, b] of marks.map((l, i) => [l, i + 1 < marks.length ? marks[i + 1] : marks[0] + total])) {
            const chord = dist(pointAt(a), pointAt(b));
            if (b - a > 12 && b - a > chord * 1.15) marks.push(((a + b) / 2) % total);
          }
          marks.sort((x, y) => x - y);
          while (marks.length < budgets[gi]) {
            const gaps = marks.map((l, i) => {
              const next = i + 1 < marks.length ? marks[i + 1] : marks[0] + total;
              return { i, mid: l + (next - l) / 2 };
            });
            // Fill the gap whose midpoint has the most room around it —
            // furthest from every dot already placed and from the shape's
            // other loops — so a long but cramped edge (the fish's tail,
            // right beside its body) loses to a shorter open stretch.
            const room = (g) => {
              const m = pointAt(g.mid);
              return Math.min(clearance(m), ...marks.map((l) => dist(pointAt(l), m)));
            };
            const pick = gaps.reduce((best, g) => (room(g) > room(best) ? g : best));
            marks.splice(pick.i + 1, 0, pick.mid % total);
            marks.sort((x, y) => x - y);
          }
          pts = marks.map(pointAt);
        } else {
          // A smooth loop (a circle, a wheel): evenly spaced dots. Try
          // several starting offsets — and one dot more or fewer than its
          // share — and keep whichever layout's closest dot sits furthest
          // from everything else.
          let bestScore = -1;
          for (const count of [budgets[gi], budgets[gi] + 1, budgets[gi] - 1]) {
            if (count < MIN_PER_GROUP) continue;
            const step = total / count;
            for (let phase = 0; phase < 1; phase += 0.0625) {
              const cand = Array.from({ length: count }, (_, i) => pointAt(step * (i + phase)));
              // A small bonus keeps the intended count unless changing it
              // genuinely buys clearance.
              const score = Math.min(...cand.map(clearance)) + (count === budgets[gi] ? 0.5 : 0);
              if (score > bestScore) { bestScore = score; pts = cand; }
            }
          }
        }
        allDots.push(...pts);
        gSize[gi] = pts.length;
      });
      probe.remove();

      const o = FACE[id] || {};
      const gi = o.group ?? boxes.reduce((best, b, i) => (b.width * b.height > boxes[best].width * boxes[best].height ? i : best), 0);
      const b = boxes[gi];
      const faceAt = {
        x: o.x ?? b.x + b.width / 2,
        y: o.y ?? b.y + b.height / 2,
        s: o.s ?? Math.min(b.width, b.height) * (o.scale ?? 0.55),
      };
      return { dots: allDots, groupStart: gStart, groupSize: gSize, face: faceAt };
    }

    const groupIndexOf = (idx) => {
      for (let gi = 0; gi < groupStart.length; gi += 1) {
        if (idx >= groupStart[gi] && idx < groupStart[gi] + groupSize[gi]) return gi;
      }
      return groupStart.length - 1;
    };

    function trailD(gi) {
      const start = groupStart[gi];
      const size = groupSize[gi];
      const completed = Math.min(Math.max(nextIdx - start, 0), size);
      if (completed < 2) return '';
      const d = dots.slice(start, start + completed)
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
      return completed === size ? `${d} Z` : d;
    }

    function render() {
      const dotsMarkup = dots.map((p, i) => `
        <g class="dot ${i === 0 ? 'next pulse' : ''}" data-i="${i}">
          <circle cx="${p.x}" cy="${p.y}" r="${DOT_R}" fill="#fff" stroke="${color}" stroke-width="2.2"/>
          <text x="${p.x}" y="${p.y + 1.7}" text-anchor="middle" font-size="${i >= 9 ? 4 : 4.8}"
                font-weight="800" fill="${shade(color, -60)}">${i + 1}</text>
        </g>`).join('');

      const trailsMarkup = groupStart.map((_, gi) => `
        <path class="dot-trail" data-g="${gi}" d="" fill="none" stroke="${color}"
              stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`).join('');

      caption = el('div', { class: 'dot-caption' });
      ctx.stage.replaceChildren(el('div', { class: 'stage-figure' }, el('div', {
        class: 'dot-wrap',
        html: `<svg viewBox="${-PAD} ${-PAD} ${100 + PAD * 2} ${100 + PAD * 2}" class="dot-svg">
                 <path class="dot-fill" d="${SHAPE_OUTLINE[shapeId].join(' ')}" fill="${color}"
                       stroke="${shade(color, -30)}" stroke-width="2" stroke-linejoin="round" opacity="0"/>
                 <g class="dot-face">${faceMarkup(face)}</g>
                 ${trailsMarkup}
                 <line class="dot-band" stroke="${color}" stroke-width="2" stroke-linecap="round"
                       stroke-dasharray="1 3.5" opacity="0"/>
                 ${dotsMarkup}
               </svg>`,
      }, caption)));

      svg = ctx.stage.querySelector('.dot-svg');
      band = svg.querySelector('.dot-band');
      svg.addEventListener('pointerdown', onDown);
      svg.addEventListener('pointermove', onMove);
      svg.addEventListener('pointerup', onUp);
      svg.addEventListener('pointercancel', onUp);
    }

    function detach() {
      if (!svg) return;
      svg.removeEventListener('pointerdown', onDown);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerup', onUp);
      svg.removeEventListener('pointercancel', onUp);
    }

    const toSvgPoint = (e) => {
      const m = svg.getScreenCTM();
      if (!m) return { x: -999, y: -999 };
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    };

    /** The previous dot the stretchy line hangs from — only while the next
     *  dot is in the same loop, so it never stretches across the shape
     *  between two separate groups. */
    function bandAnchor() {
      if (nextIdx === 0 || finished) return null;
      return groupIndexOf(nextIdx - 1) === groupIndexOf(nextIdx) ? dots[nextIdx - 1] : null;
    }

    function updateBand(p) {
      const a = finger.active ? bandAnchor() : null;
      if (!a || !p) { band.setAttribute('opacity', '0'); return; }
      band.setAttribute('x1', a.x);
      band.setAttribute('y1', a.y);
      band.setAttribute('x2', p.x);
      band.setAttribute('y2', p.y);
      band.setAttribute('opacity', '.7');
    }

    function wobble(i) {
      const g = svg.querySelector(`.dot[data-i="${i}"]`);
      if (!g || g.classList.contains('done')) return;
      sfx('wrong');
      g.classList.remove('wrong');
      void g.offsetWidth;
      g.classList.add('wrong');
      setTimeout(() => g.classList.remove('wrong'), 480);
    }

    function connectNext() {
      const i = nextIdx;
      const g = svg.querySelector(`.dot[data-i="${i}"]`);
      g?.classList.add('done');
      g?.classList.remove('next', 'pulse');
      const gi = groupIndexOf(i);
      nextIdx += 1;
      svg.querySelector(`.dot-trail[data-g="${gi}"]`)?.setAttribute('d', trailD(gi));

      if (nextIdx >= dots.length) {
        finish();
      } else {
        sfx('tap');
        svg.querySelector(`.dot[data-i="${nextIdx}"]`)?.classList.add('next', 'pulse');
      }
    }

    function finish() {
      finished = true;
      finger.reset();
      updateBand(null);
      sfx('sparkle');
      svg.classList.add('finished');
      const name = NAMES[shapeId] || 'shape';
      const article = /^[aeiou]/.test(name) ? 'An' : 'A';
      caption.textContent = `${article} ${name}!`;
      caption.classList.add('show');
      sayAuto(`${article} ${name}!`);
      roundTimer = setTimeout(newRound, NEXT_ROUND_MS);
    }

    function onDown(e) {
      if (finished) return;
      const p = toSvgPoint(e);
      try { svg.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
      e.preventDefault();
      if (!finger.down(e)) return;

      if (dist(p, dots[nextIdx]) <= HIT_R) {
        connectNext();
      } else {
        // Wobble only the dot actually touched, and only on a fresh touch —
        // a drag sweeping across other dots on its way shouldn't buzz at
        // every one it passes.
        let near = -1;
        let nearD = DOT_R * 1.8;
        dots.forEach((d, i) => {
          const dd = dist(p, d);
          if (dd < nearD) { near = i; nearD = dd; }
        });
        if (near >= 0 && near !== nextIdx) wobble(near);
      }
      updateBand(p);
    }

    function onMove(e) {
      if (finished || !finger.move(e)) return;
      const p = toSvgPoint(e);
      if (dist(p, dots[nextIdx]) <= HIT_R * 0.75) connectNext();
      if (!finished) updateBand(p);
      e.preventDefault();
    }

    function onUp(e) {
      if (finger.up(e) && band) updateBand(null);
    }

    function newRound() {
      detach();
      shapeId = nextShape();
      color = pick(PALETTE);
      nextIdx = 0;
      finished = false;
      finger.reset();
      ({ dots, groupStart, groupSize, face } = sampleShape(shapeId));
      render();
    }

    ctx.onCleanup(() => {
      detach();
      clearTimeout(roundTimer);
    });
    newRound();
  },
};
