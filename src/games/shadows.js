/* Shadow matching — find the silhouette that belongs to the animal.

   The shadows aren't separate artwork: art.js flattens the same sprite to one
   colour (see toSilhouette), so a shadow is guaranteed to match its animal
   exactly. That's why sprites are built from opaque overlapping parts.

   Age progression:
     2  2 shadows, animals with obviously different outlines
     3  3 shadows, still clearly different
     4  4 shadows, at least one look-alike (pointy ears vs pointy ears)
     5  4 shadows, look-alikes plus — for animals that actually face a direction —
        a mirrored copy of the right answer, which forces attention to orientation

   Mirroring is only applied to duck/fish/turtle. Flipping a front-facing cat
   produces an identical silhouette, which would make the round unsolvable.
*/

import { el, pick, shuffle } from '../util.js';
import { renderSprite, ANIMALS, PALETTE } from '../art.js';

const CONFIG = {
  2: { choices: 2, lookalikes: false, mirror: false },
  3: { choices: 3, lookalikes: false, mirror: false },
  4: { choices: 4, lookalikes: true,  mirror: false },
  5: { choices: 4, lookalikes: true,  mirror: true },
};

/** Animals whose silhouettes are easy to confuse — used to raise difficulty. */
const LOOKALIKE = {
  cat: ['fox', 'mouse'],
  fox: ['cat', 'mouse'],
  mouse: ['bear', 'cat'],
  bear: ['mouse', 'pig'],
  pig: ['bear', 'cat'],
  bunny: ['mouse', 'owl'],
  owl: ['penguin', 'bunny'],
  penguin: ['owl', 'duck'],
  duck: ['penguin', 'fish'],
  fish: ['duck', 'turtle'],
  turtle: ['fish', 'frog'],
  frog: ['turtle', 'bear'],
  dog: ['fox', 'bear'],
  elephant: ['bear', 'dog'],
  lion: ['bear', 'frog'],
  bee: ['butterfly', 'fish'],
  butterfly: ['bee', 'owl'],
};

/** Only these read differently when mirrored — the rest face the viewer. */
const DIRECTIONAL = ['duck', 'fish', 'turtle'];

export default {
  id: 'shadows',
  title: 'Shadows',
  subtitle: 'Whose shadow?',
  color: '#5fd6a4',
  rounds: () => 6,

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <g transform="translate(4,2) scale(0.52)">${
        renderSprite('bunny', { color: '#ff8fab' }).replace(/^<svg[^>]*>|<\/svg>$/g, '')
      }</g>
      <g transform="translate(44,44) scale(0.52)">${
        renderSprite('bunny', { silhouette: true }).replace(/^<svg[^>]*>|<\/svg>$/g, '')
      }</g>
    </svg>`,

  round(ctx) {
    const cfg = CONFIG[ctx.age];
    const answer = pick(ANIMALS);
    const mirrored = cfg.mirror && DIRECTIONAL.includes(answer);

    // Distractors: look-alikes first when the age calls for them, topped up at random.
    const others = ANIMALS.filter((a) => a !== answer);
    const near = cfg.lookalikes ? (LOOKALIKE[answer] || []).filter((a) => others.includes(a)) : [];
    const wanted = cfg.choices - 1 - (mirrored ? 1 : 0);
    const distractors = [...new Set([...near, ...shuffle(others)])].slice(0, wanted);

    const options = shuffle([
      { name: answer, flip: false, correct: true },
      ...distractors.map((name) => ({ name, flip: false, correct: false })),
      ...(mirrored ? [{ name: answer, flip: true, correct: false }] : []),
    ]);

    ctx.prompt('Which shadow matches?');

    ctx.stage.append(el('div', { class: 'stage-figure' },
      el('div', {
        class: 'shadow-target float',
        html: renderSprite(answer, { color: pick(PALETTE) }),
      })));

    const row = el('div', { class: 'row' });
    options.forEach((opt) => {
      row.append(el('button', {
        class: 'choice shadow-card',
        'aria-label': 'shadow',
        html: renderSprite(opt.name, { silhouette: true, flip: opt.flip }),
        onclick: (e) => (opt.correct ? ctx.win(e.currentTarget) : ctx.nudge(e.currentTarget)),
      }));
    });

    ctx.stage.append(row);
  },
};
