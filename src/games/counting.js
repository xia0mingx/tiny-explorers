/* Counting & first maths.

   Age progression:
     2  count 1-4, three choices           (subitising — recognised at a glance)
     3  count 2-6, three choices
     4  count 3-12, scattered, mixed sets  (count only the ducks, not everything)
     5  add / subtract / count to 12, four choices, scattered and mixed

   Every answer card shows the numeral AND that many dots. A 2-year-old cannot
   read "3", so a numeral-only card would test symbol recognition they don't have
   yet; the dots let them answer by matching quantity while the numeral teaches
   itself alongside.

   Three separate difficulty levers, rather than just bigger numbers:

   1. SCATTER (age 4+). Younger ages get tidy rows, because an ordered
      arrangement is markedly easier to count without double-counting. From age
      4 the sprites are jittered inside their cells, which removes the "read it
      off as two rows of five" shortcut and forces actual one-by-one counting.
   2. MIXED SETS (age 4+). The scene contains a second kind of animal/object,
      and the question names only one of them. Counting everything is the
      classic error, so the total is deliberately offered as one of the wrong
      answers — the round tests classify-then-count, not just count.
   3. SUBTRACTION (age 5). "How many are left?" over a set where some items are
      faded and crossed out. Age 5 previously only ever saw addition.

   All of it stays inside the app's no-fail-state rule: a wrong tap still just
   wobbles, nothing is timed, and every distractor is a plausible near-miss
   rather than a trick.
*/

import { el, randInt, range, shuffle, pick } from '../util.js';
import { spriteBody, OBJECTS, ANIMALS, PLURALS, PALETTE, shade } from '../art.js';

const CONFIG = {
  2: { min: 1, max: 4,  choices: 3, modes: ['count'],                     oneColor: true,  scatter: false, spread: 3, mixed: false },
  3: { min: 2, max: 6,  choices: 3, modes: ['count'],                     oneColor: true,  scatter: false, spread: 2, mixed: false },
  4: { min: 3, max: 12, choices: 4, modes: ['count'],                     oneColor: false, scatter: true,  spread: 2, mixed: true  },
  5: { min: 3, max: 12, choices: 4, modes: ['add', 'subtract', 'count'],  oneColor: false, scatter: true,  spread: 2, mixed: true  },
};

const COUNTABLE = [...OBJECTS, ...ANIMALS];

const CELL = 118;          // a sprite is 100 wide, so 18px of slack per cell
const SLACK = CELL - 100;  // how far an item may be nudged and still sit inside

const nounFor = (sprite) => PLURALS[sprite] || `${sprite}s`;

/**
 * A grid of sprites, max 5 per row.
 * @param {Array<{name: string, gone?: boolean}>} items  one entry per sprite drawn
 * @param {boolean} scatter  jitter each item inside its cell instead of centring it
 *
 * Jitter is bounded by SLACK rather than being free-form, so every sprite still
 * lands fully inside its own cell — the group's viewBox stays exact, which is
 * what lets object-fit:contain scale it without clipping.
 */
function groupSvg(items, colors, scatter) {
  const n = items.length;
  const cols = Math.min(n, 5);
  const rows = Math.ceil(n / cols);

  const cells = items.map((item, i) => {
    const nudgeX = scatter ? randInt(0, SLACK) : SLACK / 2;
    const nudgeY = scatter ? randInt(0, SLACK) : SLACK / 2;
    const x = (i % cols) * CELL + nudgeX;
    const y = Math.floor(i / cols) * CELL + nudgeY;
    const tilt = scatter ? randInt(-14, 14) : (i % 3 - 1) * 5;
    // A "gone" item (subtraction) is faded and struck through rather than
    // removed, so the child can still see what was taken away and count the
    // remainder against it — that IS the sum being asked about.
    const cross = item.gone
      ? `<path d="M26 26 L74 74 M74 26 L26 74" stroke="#8a869c" stroke-width="9"
               stroke-linecap="round" opacity=".8"/>`
      : '';
    return `<g transform="translate(${x},${y}) rotate(${tilt} 50 50)"${item.gone ? ' opacity=".3"' : ''}>
              ${spriteBody(item.name, colors[i % colors.length])}${cross}
            </g>`;
  }).join('');

  // object-fit:contain (not max-height:100%) so the group scales down to
  // fit .sum-group's box while keeping its own aspect ratio — see
  // .sum-group's CSS comment for why max-height:100% doesn't work here.
  return `<svg viewBox="0 0 ${cols * CELL} ${rows * CELL}"
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

/**
 * `count` wrong answers near `answer`. Widens its search radius until it has
 * enough — with a tight spread and an answer near 1, the obvious ±spread band
 * simply doesn't contain enough candidates, and silently returning fewer would
 * render a round with missing choice cards.
 */
function distractors(answer, count, spread, forced = []) {
  const out = forced.filter((v) => v !== answer && v >= 1).slice(0, count);
  let radius = spread;
  while (out.length < count && radius < spread + count + 6) {
    const pool = shuffle(range(answer + radius + 1)
      .map((i) => i + 1)
      .filter((v) => v !== answer && Math.abs(v - answer) <= radius && !out.includes(v)));
    out.push(...pool.slice(0, count - out.length));
    radius += 1;
  }
  return out.slice(0, count);
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
    const mode = pick(cfg.modes);
    const sprite = pick(COUNTABLE);
    const noun = nounFor(sprite);
    const base = pick(PALETTE);
    const colors = cfg.oneColor ? [base] : [base, shade(base, 30), shade(base, -25)];

    const figure = el('div', { class: 'stage-figure' });
    let answer;
    let forced = [];   // distractors this mode specifically wants offered

    if (mode === 'add') {
      // Both addends >= 1 so there is always something to count on each side.
      // The Math.max floor keeps this safe if a future config lowers `max`
      // below the addend cap — randInt(1, 0) would otherwise go negative.
      const a = randInt(1, Math.min(6, cfg.max - 1));
      const b = randInt(1, Math.max(1, Math.min(6, cfg.max - a)));
      answer = a + b;
      figure.append(el('div', { class: 'sum-row' },
        el('div', { class: 'sum-group', html: groupSvg(Array(a).fill({ name: sprite }), colors, cfg.scatter) }),
        el('div', { class: 'sum-op', text: '+' }),
        el('div', { class: 'sum-group', html: groupSvg(Array(b).fill({ name: sprite }), colors, cfg.scatter) })));
      ctx.prompt(`How many ${noun} altogether?`);

    } else if (mode === 'subtract') {
      const total = randInt(Math.min(4, cfg.max), cfg.max);
      const gone = randInt(1, Math.max(1, total - 1));
      answer = total - gone;
      const items = shuffle([
        ...Array(gone).fill({ name: sprite, gone: true }),
        ...Array(answer).fill({ name: sprite }),
      ]);
      figure.innerHTML = groupSvg(items, colors, cfg.scatter);
      // The whole set and the crossed-out count are both tempting wrong
      // answers here, so offer them rather than leaving them to chance.
      forced = [total, gone];
      ctx.prompt(`How many ${noun} are left?`);

    } else {
      answer = randInt(cfg.min, cfg.max);
      let items = Array(answer).fill({ name: sprite });

      if (cfg.mixed) {
        // A second kind of thing shares the scene; the question names only one.
        const other = pick(COUNTABLE.filter((s) => s !== sprite));
        const extras = randInt(1, 3);
        items = shuffle([...items, ...Array(extras).fill({ name: other })]);
        // Counting everything is THE classic mistake, so make it available.
        forced = [answer + extras];
      }

      figure.innerHTML = groupSvg(items, colors, cfg.scatter);
      ctx.prompt(`How many ${noun}?`);
    }

    // Distractors are near neighbours of the answer, so the child has to
    // actually count rather than spot the one obviously-different number.
    const options = shuffle([answer, ...distractors(answer, cfg.choices - 1, cfg.spread, forced)]);

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
