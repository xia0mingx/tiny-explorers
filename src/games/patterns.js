/* Patterns — "what comes next?"

   Age progression:
     2  AB,          blank at the end,    2 choices
     3  AB / AAB,    blank at the end,    3 choices
     4  ABC / ABB,   blank at the end,    3 choices
     5  ABC / AABB,  blank in the MIDDLE, 4 choices

   Moving the gap into the middle at age 5 is the real jump in difficulty: a gap
   at the end can be solved by remembering the last item, while a gap in the
   middle forces the child to read the rule in both directions.

   Each pattern element differs in BOTH shape and colour. Varying only one is
   harder to see at a glance, and at this age the skill being taught is noticing
   that a sequence repeats at all — not fine discrimination.
*/

import { el, pick, shuffle, randInt, range } from '../util.js';
import { spriteBody, PALETTE } from '../art.js';

const CONFIG = {
  2: { units: [['A', 'B']],                                     len: 4, choices: 2, middle: false },
  3: { units: [['A', 'B'], ['A', 'A', 'B']],                    len: 6, choices: 3, middle: false },
  4: { units: [['A', 'B', 'C'], ['A', 'B', 'B'], ['A', 'A', 'B']], len: 6, choices: 3, middle: false },
  5: { units: [['A', 'B', 'C'], ['A', 'A', 'B', 'B'], ['A', 'B', 'B']], len: 8, choices: 4, middle: true },
};

const SHAPE_POOL = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond', 'hexagon', 'moon'];

const tileSvg = (item) =>
  `<svg viewBox="0 0 100 100" style="width:100%;height:100%" aria-hidden="true">
     ${spriteBody(item.shape, item.color)}
   </svg>`;

export default {
  id: 'patterns',
  title: 'Patterns',
  subtitle: 'What comes next?',
  color: '#b79bff',
  rounds: () => 6,

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="16" cy="34" r="13" fill="#ff8fab"/>
      <rect x="36" y="21" width="26" height="26" rx="5" fill="#ffc93c"/>
      <circle cx="84" cy="34" r="13" fill="#ff8fab"/>
      <rect x="6" y="60" width="26" height="26" rx="5" fill="#ffc93c"/>
      <circle cx="52" cy="73" r="13" fill="#ff8fab"/>
      <rect x="70" y="60" width="26" height="26" rx="6" fill="none"
            stroke="#c9c2da" stroke-width="5" stroke-dasharray="7 6"/>
    </svg>`,

  round(ctx) {
    const cfg = CONFIG[ctx.age];
    const unit = pick(cfg.units);
    const letters = [...new Set(unit)];

    // One distinct shape+colour per letter, plus two spares. Two, not one: an
    // AABB pattern only has two letters but still needs four answer cards at age 5.
    const shapes = shuffle(SHAPE_POOL).slice(0, letters.length + 2);
    const colors = shuffle(PALETTE).slice(0, letters.length + 2);
    const items = {};
    letters.forEach((L, i) => { items[L] = { shape: shapes[i], color: colors[i] }; });
    const spares = [0, 1].map((k) => ({
      letter: null,
      shape: shapes[letters.length + k],
      color: colors[letters.length + k],
    }));

    // Repeat the unit out to the target length.
    const seq = range(cfg.len).map((i) => unit[i % unit.length]);

    // A middle gap must still leave one complete unit visible before it, or the
    // rule isn't recoverable from what's on screen.
    const blankAt = cfg.middle
      ? randInt(unit.length, cfg.len - 2)
      : cfg.len - 1;
    const answer = seq[blankAt];

    ctx.prompt(cfg.middle ? 'Which one is missing?' : 'What comes next?');

    const strip = el('div', { class: 'pattern-strip' });
    seq.forEach((L, i) => {
      strip.append(i === blankAt
        ? el('div', { class: 'pattern-slot blank', text: '?' })
        : el('div', { class: 'pattern-slot', html: tileSvg(items[L]) }));
    });

    // Always offer every letter in the pattern, then top up with spares.
    const choiceItems = [
      ...letters.map((L) => ({ letter: L, ...items[L] })),
      ...spares,
    ].slice(0, cfg.choices);

    // Guarantee the right answer survived the slice.
    if (!choiceItems.some((c) => c.letter === answer)) {
      choiceItems[randInt(0, choiceItems.length - 1)] = { letter: answer, ...items[answer] };
    }

    const row = el('div', { class: 'row' });
    shuffle(choiceItems).forEach((item) => {
      row.append(el('button', {
        class: 'choice pattern-choice',
        html: tileSvg(item),
        onclick: (e) => {
          if (item.letter !== answer) return ctx.nudge(e.currentTarget);
          // Drop the answer into the gap before advancing, so the child sees the
          // completed pattern rather than the screen just changing.
          const slot = strip.children[blankAt];
          slot.classList.remove('blank');
          slot.textContent = '';
          slot.innerHTML = tileSvg(items[answer]);
          slot.classList.add('correct');
          ctx.win(e.currentTarget);
        },
      }));
    });

    ctx.stage.append(el('div', { class: 'stage-figure' }, strip), row);
  },
};
