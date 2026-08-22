/* Shapes.

   Presented as a shape-sorter: a grey "hole" at the top, coloured blocks below,
   find the block that fits. That's a toy most 2-year-olds have already handled,
   so the rules need no explanation.

   Two deliberate choices:
   - Every option is a DIFFERENT colour, and the hole is colourless. A child who
     matched colour instead of form would otherwise pass without learning shapes.
   - From age 4 the options are randomly rotated, so a square can't be found by
     "the flat one on top", and from age 5 the distractors are drawn from a
     confusable set (circle/oval, square/diamond, pentagon/hexagon) rather than
     at random.
*/

import { el, pick, shuffle, randInt } from '../util.js';
import { spriteBody, SHAPES, PALETTE } from '../art.js';

const CONFIG = {
  2: { pool: ['circle', 'square', 'triangle'],                          choices: 3, rotate: false, confusable: false },
  3: { pool: ['circle', 'square', 'triangle', 'star', 'heart'],         choices: 3, rotate: false, confusable: false },
  4: { pool: ['circle', 'square', 'triangle', 'star', 'heart',
              'rectangle', 'oval', 'diamond'],                          choices: 4, rotate: true,  confusable: false },
  5: { pool: SHAPES.map((s) => s.id),                                   choices: 4, rotate: true,  confusable: true },
};

/** Shapes a child is genuinely likely to mix up — used to make age 5 hard. */
const SIMILAR = {
  circle: ['oval', 'pentagon', 'hexagon'],
  oval: ['circle', 'rectangle'],
  square: ['rectangle', 'diamond'],
  rectangle: ['square', 'oval'],
  diamond: ['square', 'triangle'],
  triangle: ['diamond', 'moon'],
  pentagon: ['hexagon', 'circle'],
  hexagon: ['pentagon', 'circle'],
  star: ['heart', 'moon'],
  heart: ['star', 'moon'],
  moon: ['heart', 'circle'],
};

const nameOf = (id) => SHAPES.find((s) => s.id === id).name;

const shapeSvg = (id, color, rotate = 0) =>
  `<svg viewBox="0 0 100 100" style="width:100%;height:100%" aria-hidden="true">
     <g transform="rotate(${rotate} 50 50)">${spriteBody(id, color)}</g>
   </svg>`;

export default {
  id: 'shapes',
  title: 'Shapes',
  subtitle: 'Find the match',
  color: '#6cc0ff',
  rounds: () => 6,

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="30" cy="30" r="20" fill="#ff8fab"/>
      <rect x="54" y="10" width="40" height="40" rx="6" fill="#ffc93c"/>
      <polygon points="30,54 52,94 8,94" fill="#5fd6a4"/>
      <polygon points="74,54 94,74 74,94 54,74" fill="#b79bff"/>
    </svg>`,

  round(ctx) {
    const cfg = CONFIG[ctx.age];
    const answer = pick(cfg.pool);

    // Build the distractor set, preferring look-alikes at age 5.
    const others = cfg.pool.filter((s) => s !== answer);
    let distractors;
    if (cfg.confusable) {
      const near = (SIMILAR[answer] || []).filter((s) => others.includes(s));
      distractors = shuffle([...new Set([...near, ...shuffle(others)])]).slice(0, cfg.choices - 1);
      // shuffle() above can drop the look-alikes; force at least one in.
      if (near.length && !distractors.some((d) => near.includes(d))) distractors[0] = pick(near);
    } else {
      distractors = shuffle(others).slice(0, cfg.choices - 1);
    }

    const options = shuffle([answer, ...distractors]);
    const colors = shuffle(PALETTE).slice(0, options.length);

    ctx.prompt(`Find the ${nameOf(answer)}`);

    // The hole: same silhouette, no colour information at all.
    ctx.stage.append(el('div', { class: 'stage-figure' },
      el('div', { class: 'shape-hole float', html: shapeSvg(answer, '#ded8ea') })));

    const row = el('div', { class: 'row' });
    options.forEach((id, i) => {
      const rot = cfg.rotate ? randInt(0, 11) * 30 : 0;
      row.append(el('button', {
        class: 'choice shape-card',
        'aria-label': nameOf(id),
        html: shapeSvg(id, colors[i], rot),
        onclick: (e) => (id === answer ? ctx.win(e.currentTarget) : ctx.nudge(e.currentTarget)),
      }));
    });

    ctx.stage.append(row);
  },
};
