/* Prints, as JSON, every sentence the app can speak — the input list for
   tools/make_voice.py, which records each one as a clip.

   Built from the same data the games use (art.js's lists, the tracing and
   dot-to-dot label tables, every quoted literal passed to ctx.prompt), so a
   new animal, shape or prompt shows up here without anyone remembering to
   add it. Anything this misses still speaks — audio.js falls back to the
   device's own voice for a sentence with no clip — just not in the
   recorded voice.

   Run: node tools/voice_lines.mjs
*/
import { readFileSync, readdirSync } from 'node:fs';
import { OBJECTS, ANIMALS, PLURALS, SHAPES } from '../src/art.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const lines = new Set();

// Every plain quoted string handed to ctx.prompt(...), including both sides
// of a ternary like prompt(cond ? 'A' : 'B').
for (const dir of ['src/games', 'src/toys']) {
  for (const f of readdirSync(new URL(`../${dir}`, import.meta.url))) {
    for (const m of src(`${dir}/${f}`).matchAll(/prompt\(([^;]*)\);/g)) {
      for (const lit of m[1].matchAll(/'([^']+)'/g)) lines.add(lit[1]);
    }
  }
}

// Counting: three question templates over everything countable.
for (const s of [...OBJECTS, ...ANIMALS]) {
  const noun = PLURALS[s] || `${s}s`;
  lines.add(`How many ${noun}?`);
  lines.add(`How many ${noun} altogether?`);
  lines.add(`How many ${noun} are left?`);
}

// Shapes: "Find the <shape>".
for (const s of SHAPES) lines.add(`Find the ${s.name}`);

// Tracing: "Trace the <label>".
for (const m of src('src/games/tracing.js').matchAll(/label:\s*'([^']+)'/g)) lines.add(`Trace the ${m[1]}`);

// Spot It: "Find N differences!" / "N more to find!" for every age's count.
for (const m of src('src/games/differences.js').matchAll(/diffs:\s*(\d+)/g)) {
  const n = Number(m[1]);
  if (n > 1) lines.add(`Find ${n} differences!`);
  for (let k = 2; k < n; k += 1) lines.add(`${k} more to find!`);
}

// Dot to Dot: "A <name>!" / "An <name>!" when a picture is finished.
const names = src('src/toys/dotToDot.js').match(/const NAMES = \{([^}]*)\}/)[1];
for (const m of names.matchAll(/:\s*'([^']+)'/g)) {
  lines.add(`${/^[aeiou]/.test(m[1]) ? 'An' : 'A'} ${m[1]}!`);
}
lines.add('A shape!'); // NAMES fallback

console.log(JSON.stringify([...lines].sort(), null, 1));
