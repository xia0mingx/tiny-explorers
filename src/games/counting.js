/* Counting & first maths.

   Age progression:
     2  count 1-3, two choices          (subitising — recognised at a glance)
     3  count 1-5, three choices
     4  count 1-10, four choices
     5  addition to 10, four choices    (two groups shown, "how many altogether")

   Every answer card shows the numeral AND that many dots. A 2-year-old cannot
   read "3", so a numeral-only card would test symbol recognition they don't have
   yet; the dots let them answer by matching quantity while the numeral teaches
   itself alongside. Sets are laid out in tidy rows rather than scattered, because
   an ordered arrangement is markedly easier to count without double-counting.
*/

import { el, randInt, range, shuffle, pick } from '../util.js';
import { spriteBody, OBJECTS, ANIMALS, PLURALS, PALETTE, shade } from '../art.js';

const CONFIG = {
  2: { min: 1, max: 3,  choices: 2, addition: false, oneColor: true },
  3: { min: 1, max: 5,  choices: 3, addition: false, oneColor: true },
  4: { min: 2, max: 10, choices: 4, addition: false, oneColor: false },
  5: { min: 2, max: 10, choices: 4, addition: true,  oneColor: false },
};

const COUNTABLE = [...OBJECTS, ...ANIMALS];

/** A tidy grid of `n` sprites, max 5 per row, with a touch of rotation so it
 *  still feels hand-made rather than like a spreadsheet. */
function groupSvg(name, n, colors) {
  const cols = Math.min(n, 5);
  const rows = Math.ceil(n / cols);
  const cells = range(n).map((i) => {
    const x = (i % cols) * 106;
    const y = Math.floor(i / cols) * 106;
    const tilt = (i % 3 - 1) * 5;
    return `<g transform="translate(${x},${y}) rotate(${tilt} 50 50)">
              ${spriteBody(name, colors[i % colors.length])}
            </g>`;
  }).join('');

  // object-fit:contain (not max-height:100%) so the group scales down to
  // fit .sum-group's box while keeping its own aspect ratio — see
  // .sum-group's CSS comment for why max-height:100% doesn't work here.
  return `<svg viewBox="0 0 ${cols * 106} ${rows * 106}"
               style="width:100%;height:100%;object-fit:contain" aria-hidden="true">
            ${cells}
          </svg>`;
}

/** Numeral + matching dot pattern, so the card is answerable without literacy. */
function numberCard(n, onPick) {
  const dots = el('div', { class: 'dots' });
  range(n).forEach(() => dots.append(el('i')));
  return el('button', { class: 'choice num-card', onclick: (e) => onPick(e.currentTarget) },
    el('div', { class: 'num', text: String(n) }),
    dots);
}

export default {
  id: 'counting',
  title: 'Counting',
  subtitle: 'How many?',
  color: '#ffc93c',
  rounds: () => 6,

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="26" cy="30" r="13" fill="#ff8fab"/>
      <circle cx="62" cy="26" r="13" fill="#6cc0ff"/>
      <circle cx="40" cy="62" r="13" fill="#5fd6a4"/>
      <circle cx="76" cy="62" r="13" fill="#b79bff"/>
      <text x="50" y="97" font-size="34" font-weight="900" text-anchor="middle"
            fill="#403d52" font-family="ui-rounded,system-ui,sans-serif">123</text>
    </svg>`,

  round(ctx) {
    const cfg = CONFIG[ctx.age];
    const sprite = pick(COUNTABLE);
    const noun = PLURALS[sprite] || `${sprite}s`;
    const base = pick(PALETTE);
    const colors = cfg.oneColor ? [base] : [base, shade(base, 30), shade(base, -25)];

    const figure = el('div', { class: 'stage-figure' });
    let answer;

    if (cfg.addition) {
      // Keep both addends >= 1 so there is always something to count on each side.
      const a = randInt(1, 5);
      const b = randInt(1, Math.min(5, 10 - a));
      answer = a + b;
      figure.append(el('div', { class: 'sum-row' },
        el('div', { class: 'sum-group', html: groupSvg(sprite, a, colors) }),
        el('div', { class: 'sum-op', text: '+' }),
        el('div', { class: 'sum-group', html: groupSvg(sprite, b, colors) })));
      ctx.prompt(`How many ${noun} altogether?`);
    } else {
      answer = randInt(cfg.min, cfg.max);
      figure.innerHTML = groupSvg(sprite, answer, colors);
      ctx.prompt(`How many ${noun}?`);
    }

    // Distractors are drawn from near neighbours of the answer, so the child has
    // to actually count rather than spot the one obviously-different number.
    const pool = range(cfg.max + 3)
      .map((i) => i + 1)
      .filter((n) => n !== answer && n >= 1 && Math.abs(n - answer) <= 3);
    const options = shuffle([answer, ...shuffle(pool).slice(0, cfg.choices - 1)]);

    const row = el('div', { class: 'row' });
    options.forEach((n) => {
      row.append(numberCard(n, (node) => {
        if (n === answer) ctx.win(node);
        else ctx.nudge(node);
      }));
    });

    ctx.stage.append(figure, row);
  },
};
