/* Tracing — drag a finger along the guide.

   Pre-writing practice, so the mechanic enforces the two things that actually
   transfer to handwriting: start at the start, and travel in one direction.

   How it works: the guide <path> is sampled into ~80 waypoints with
   getPointAtLength(). A drag advances through them in order, and the coloured
   ink path is revealed by animating stroke-dashoffset to match. Because progress
   is an index into an ordered list rather than "how much of the shape did you
   touch", scribbling over the whole shape does not complete it.

   Forgiveness built in on purpose, since a 2-year-old's drag is not smooth:
   - a generous hit radius (the guide is drawn as wide as the tolerance, so
     "keep your finger on the grey road" is literally the rule)
   - lookahead, so a fast swipe that skips waypoints still counts
   - lifting a finger never resets progress; the child resumes where they stopped
   - 92% completion wins, so the last few pixels are never the blocker

   Every glyph is ONE continuous stroke. Multi-stroke letters like "A" or "t"
   would need a pen-lift the drag model can't express.
*/

import { el, pick, range } from '../util.js';
import { glyph, PALETTE } from '../art.js';

const SAMPLES = 80;
const TOL = 26;          // hit radius in viewBox units; matches the guide width
const LOOKAHEAD = 10;    // waypoints a single fast move may skip
const WIN_AT = 0.92;

/* viewBox is 0 0 300 200 for every path below. */
const PATHS = {
  2: [
    { label: 'line',   d: 'M40 100 H260' },
    { label: 'line',   d: 'M150 30 V170' },
    { label: 'hill',   d: 'M40 150 Q150 20 260 150' },
    { label: 'slide',  d: 'M40 50 L260 150' },
  ],
  3: [
    { label: 'zigzag', d: 'M40 145 L95 60 L150 145 L205 60 L260 145' },
    { label: 'wave',   d: 'M30 100 Q67 30 105 100 T180 100 T255 100' },
    { label: 'circle', d: 'M80 100 A70 70 0 1 1 220 100 A70 70 0 1 1 80 100' },
    { label: 'ramp',   d: 'M40 160 Q150 160 150 40' },
  ],
  4: [
    { label: 'circle',   d: 'M80 100 A70 70 0 1 1 220 100 A70 70 0 1 1 80 100' },
    { label: 'square',   d: 'M70 40 H230 V160 H70 Z' },
    { label: 'triangle', d: 'M150 32 L245 165 L55 165 Z' },
    { label: 'diamond',  d: 'M150 28 L245 100 L150 172 L55 100 Z' },
  ],
  5: [
    { label: 'number two',   d: 'M100 70 Q100 35 140 35 Q182 35 182 72 Q182 100 100 165 H190' },
    { label: 'number three', d: 'M100 55 Q125 28 152 40 Q182 54 152 96 Q192 102 180 140 Q166 178 102 158' },
    { label: 'letter C',     d: 'M212 60 Q150 14 106 60 Q68 100 106 144 Q150 190 212 144' },
    { label: 'letter S',     d: 'M200 58 Q150 24 116 54 Q86 84 140 104 Q198 124 174 156 Q144 188 100 156' },
    { label: 'letter L',     d: 'M100 35 V165 H215' },
  ],
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export default {
  id: 'tracing',
  title: 'Tracing',
  subtitle: 'Follow the path',
  color: '#ff9770',
  rounds: () => 4,

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M14 74 Q34 18 52 52 Q68 82 88 26" stroke="#e6e0f0" stroke-width="16"
            fill="none" stroke-linecap="round"/>
      <path d="M14 74 Q34 18 52 52" stroke="#ff9770" stroke-width="16"
            fill="none" stroke-linecap="round"/>
      <circle cx="52" cy="52" r="11" fill="#fff" stroke="#ff9770" stroke-width="6"/>
    </svg>`,

  round(ctx) {
    const spec = pick(PATHS[ctx.age]);
    const color = pick(PALETTE);
    ctx.prompt(`Trace the ${spec.label}`);

    const wrap = el('div', { class: 'trace-wrap' });
    wrap.innerHTML = `
      <svg viewBox="0 0 300 200" class="trace-svg" aria-hidden="true">
        <path class="guide" d="${spec.d}" fill="none" stroke="#e8e3f2"
              stroke-width="${TOL * 2}" stroke-linecap="round" stroke-linejoin="round"/>
        <path class="guide-dash" d="${spec.d}" fill="none" stroke="#d3cce4"
              stroke-width="3" stroke-dasharray="2 14" stroke-linecap="round"/>
        <path class="ink" d="${spec.d}" fill="none" stroke="${color}"
              stroke-width="${TOL * 1.55}" stroke-linecap="round" stroke-linejoin="round"/>
        <g class="finish"></g>
        <g class="start"></g>
        <g class="rider"></g>
      </svg>`;

    ctx.stage.append(el('div', { class: 'stage-figure' }, wrap));

    // Sample only after the SVG is in the document — getPointAtLength needs a
    // rendered path in some engines.
    const svg = wrap.querySelector('svg');
    const guide = wrap.querySelector('.guide');
    const ink = wrap.querySelector('.ink');
    const total = guide.getTotalLength();
    const pts = range(SAMPLES + 1).map((i) => guide.getPointAtLength((total * i) / SAMPLES));

    ink.style.strokeDasharray = total;
    ink.style.strokeDashoffset = total;

    const start = pts[0];
    const end = pts[SAMPLES];
    wrap.querySelector('.finish').innerHTML =
      `<g transform="translate(${end.x - 20},${end.y - 20})">
         <svg width="40" height="40" viewBox="0 0 100 100">${glyph.star()}</svg></g>`;
    wrap.querySelector('.start').innerHTML =
      `<circle cx="${start.x}" cy="${start.y}" r="17" fill="${color}" class="pulse"/>
       <circle cx="${start.x}" cy="${start.y}" r="7" fill="#fff"/>`;

    const riderG = wrap.querySelector('.rider');
    const drawRider = (p) => {
      riderG.innerHTML =
        `<circle cx="${p.x}" cy="${p.y}" r="15" fill="#fff" stroke="${color}" stroke-width="6"/>`;
    };

    let reached = 0;
    let dragging = false;
    let done = false;

    const toSvg = (e) => {
      const m = svg.getScreenCTM();
      if (!m) return { x: -999, y: -999 };
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    };

    const paint = () => {
      ink.style.strokeDashoffset = total * (1 - reached / SAMPLES);
      drawRider(pts[reached]);
    };

    const onDown = (e) => {
      if (done) return;
      const p = toSvg(e);
      // Resume from wherever the last drag ended — including the start dot on
      // the first touch, since `reached` is 0 then.
      if (dist(p, pts[reached]) > TOL * 1.6) return;
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
      const p = toSvg(e);
      const limit = Math.min(reached + LOOKAHEAD, SAMPLES);
      let advanced = false;
      for (let i = reached + 1; i <= limit; i += 1) {
        if (dist(p, pts[i]) <= TOL) { reached = i; advanced = true; }
      }
      if (!advanced) return;

      paint();
      // An occasional chime keeps a long trace feeling responsive.
      if (reached % 12 === 0) ctx.ping();

      if (reached / SAMPLES >= WIN_AT) {
        done = true;
        dragging = false;
        reached = SAMPLES;
        paint();
        wrap.querySelector('.start').innerHTML = '';
        ctx.win(wrap);
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
