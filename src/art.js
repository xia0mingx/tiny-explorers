/* art.js — the whole visual vocabulary of the app, drawn in code.

   Every sprite is a function (color) -> SVG markup inside a 0 0 100 100 viewBox,
   so sprites compose, scale to any tablet resolution, and need no image files.

   Two consequences worth knowing before adding one:

   1. Silhouettes are derived, not drawn. renderSprite({silhouette:true}) rewrites
      every fill/stroke to one flat colour, which is why the shadow-matching game
      needs no second set of artwork. Keep new sprites built from opaque overlapping
      shapes so they collapse into a single readable blob.
   2. Because that blob is all the shadow game gives the child, sprites must be
      distinguishable by OUTLINE alone — ears, beaks, tails and trunks are the
      whole point, and two round-headed animals differing only in face markings
      would make an unsolvable round.
*/

const EYE = '#3a3550';
const BLUSH = '#ff9db0';
export const SHADOW = '#4a4a68';

/* ── colour helpers ────────────────────────────────────────────────────── */

export const PALETTE = ['#ff8fab', '#ffc93c', '#5fd6a4', '#6cc0ff',
                        '#b79bff', '#ff9770', '#8ee36b', '#ff6b8a',
                        '#5ec8d8', '#ffa9e7'];

export function shade(hex, amt) {
  const h = hex.replace('#', '');
  const to = (i) => {
    const v = parseInt(h.slice(i, i + 2), 16) + amt;
    return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  };
  return `#${to(0)}${to(2)}${to(4)}`;
}

/* ── face parts ────────────────────────────────────────────────────────── */

const eyes = (cy, spread = 12, r = 5.2, cx = 50) => `
  <circle cx="${cx - spread}" cy="${cy}" r="${r}" fill="${EYE}"/>
  <circle cx="${cx + spread}" cy="${cy}" r="${r}" fill="${EYE}"/>
  <circle cx="${cx - spread + r * 0.4}" cy="${cy - r * 0.4}" r="${r * 0.33}" fill="#fff"/>
  <circle cx="${cx + spread + r * 0.4}" cy="${cy - r * 0.4}" r="${r * 0.33}" fill="#fff"/>`;

const smile = (cy, w = 7, cx = 50) => `
  <path d="M${cx - w} ${cy} Q${cx} ${cy + w * 0.95} ${cx + w} ${cy}"
        stroke="${EYE}" stroke-width="3" fill="none" stroke-linecap="round"/>`;

const blush = (cy, spread = 25, r = 5.4, cx = 50) => `
  <circle cx="${cx - spread}" cy="${cy}" r="${r}" fill="${BLUSH}" opacity=".5"/>
  <circle cx="${cx + spread}" cy="${cy}" r="${r}" fill="${BLUSH}" opacity=".5"/>`;

/* ── geometry helpers ──────────────────────────────────────────────────── */

function regularPoly(n, cx, cy, r, rot = -Math.PI / 2) {
  return Array.from({ length: n }, (_, i) => {
    const a = rot + (i * 2 * Math.PI) / n;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

function starPoly(points, cx, cy, R, r, rot = -Math.PI / 2) {
  const out = [];
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i * Math.PI) / points;
    const rad = i % 2 ? r : R;
    out.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return out.join(' ');
}

/* ── animals ───────────────────────────────────────────────────────────── */

const SPRITES = {};

/* Sprite names are ONE FLAT NAMESPACE shared by animals, objects, scene props,
   geometric shapes and dress-up bodies alike. A duplicate name used to just
   overwrite the earlier sprite silently — which is how a hand-drawn star with
   a face sat in this file for months, fully dead, because the geometric
   SHAPE_ART star registered later under the same name and won.

   Throwing here rather than warning is deliberate: a collision is a static
   authoring mistake that can only be introduced by editing this file, never
   by anything a child does, and art.js is imported at boot — so this surfaces
   immediately and unmissably the first time the app is loaded, instead of as
   a subtly wrong picture nobody notices. */
const add = (name, fn) => {
  if (name in SPRITES) {
    throw new Error(`art.js: duplicate sprite name "${name}" — names are one flat namespace, pick another`);
  }
  SPRITES[name] = fn;
};

add('cat', (c) => `
  <path d="M20 46 L15 10 L44 27 Z" fill="${shade(c, -18)}"/>
  <path d="M80 46 L85 10 L56 27 Z" fill="${shade(c, -18)}"/>
  <circle cx="50" cy="58" r="33" fill="${c}"/>
  ${eyes(54, 13)}
  <path d="M46 66 l4 -4 l4 4 z" fill="${BLUSH}"/>
  ${smile(70, 6)}
  <path d="M14 58 h-11 M14 64 h-11 M86 58 h11 M86 64 h11"
        stroke="${shade(c, -40)}" stroke-width="2.4" stroke-linecap="round"/>
  ${blush(70, 26)}`);

add('bunny', (c) => `
  <ellipse cx="36" cy="24" rx="9" ry="23" fill="${c}"/>
  <ellipse cx="64" cy="24" rx="9" ry="23" fill="${c}"/>
  <ellipse cx="36" cy="26" rx="4.5" ry="15" fill="${BLUSH}" opacity=".65"/>
  <ellipse cx="64" cy="26" rx="4.5" ry="15" fill="${BLUSH}" opacity=".65"/>
  <circle cx="50" cy="66" r="28" fill="${c}"/>
  ${eyes(62, 11, 4.8)}
  <path d="M46.5 72 l3.5 -3.5 l3.5 3.5 z" fill="${BLUSH}"/>
  ${smile(77, 5.5)}
  ${blush(76, 21)}`);

add('bear', (c) => `
  <circle cx="24" cy="26" r="14" fill="${c}"/>
  <circle cx="76" cy="26" r="14" fill="${c}"/>
  <circle cx="24" cy="26" r="7" fill="${BLUSH}" opacity=".6"/>
  <circle cx="76" cy="26" r="7" fill="${BLUSH}" opacity=".6"/>
  <circle cx="50" cy="58" r="33" fill="${c}"/>
  <ellipse cx="50" cy="70" rx="17" ry="13" fill="${shade(c, 26)}"/>
  ${eyes(52, 13)}
  <ellipse cx="50" cy="64" rx="6" ry="4.5" fill="${EYE}"/>
  ${smile(74, 6)}
  ${blush(66, 27)}`);

add('dog', (c) => `
  <ellipse cx="17" cy="56" rx="11" ry="24" fill="${shade(c, -26)}"/>
  <ellipse cx="83" cy="56" rx="11" ry="24" fill="${shade(c, -26)}"/>
  <circle cx="50" cy="54" r="31" fill="${c}"/>
  <ellipse cx="50" cy="70" rx="19" ry="14" fill="${shade(c, 28)}"/>
  ${eyes(49, 12)}
  <ellipse cx="50" cy="64" rx="7" ry="5" fill="${EYE}"/>
  <path d="M50 69 v6 M50 75 q-6 5 -10 0 M50 75 q6 5 10 0"
        stroke="${EYE}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  ${blush(60, 28)}`);

add('mouse', (c) => `
  <circle cx="20" cy="30" r="18" fill="${c}"/>
  <circle cx="80" cy="30" r="18" fill="${c}"/>
  <circle cx="20" cy="30" r="10" fill="${BLUSH}" opacity=".6"/>
  <circle cx="80" cy="30" r="10" fill="${BLUSH}" opacity=".6"/>
  <circle cx="50" cy="60" r="27" fill="${c}"/>
  ${eyes(56, 11, 4.6)}
  <circle cx="50" cy="70" r="4.5" fill="${BLUSH}"/>
  <path d="M45 74 h-14 M45 78 h-13 M55 74 h14 M55 78 h13"
        stroke="${shade(c, -40)}" stroke-width="2" stroke-linecap="round"/>
  ${blush(72, 20, 4.6)}`);

add('fox', (c) => `
  <path d="M18 48 L12 8 L44 26 Z" fill="${shade(c, -26)}"/>
  <path d="M82 48 L88 8 L56 26 Z" fill="${shade(c, -26)}"/>
  <path d="M50 88 L18 46 Q50 30 82 46 Z" fill="${c}"/>
  <path d="M50 88 L36 70 Q50 62 64 70 Z" fill="#fff9f2"/>
  ${eyes(54, 13, 4.6)}
  <ellipse cx="50" cy="80" rx="5" ry="4" fill="${EYE}"/>
  ${blush(66, 21, 5)}`);

add('frog', (c) => `
  <circle cx="28" cy="26" r="16" fill="${c}"/>
  <circle cx="72" cy="26" r="16" fill="${c}"/>
  <circle cx="28" cy="26" r="9" fill="#fff"/>
  <circle cx="72" cy="26" r="9" fill="#fff"/>
  <circle cx="28" cy="27" r="5" fill="${EYE}"/>
  <circle cx="72" cy="27" r="5" fill="${EYE}"/>
  <ellipse cx="50" cy="62" rx="34" ry="28" fill="${c}"/>
  <path d="M30 64 Q50 82 70 64" stroke="${EYE}" stroke-width="3.4"
        fill="none" stroke-linecap="round"/>
  ${blush(62, 26)}`);

add('duck', (c) => `
  <ellipse cx="46" cy="62" rx="32" ry="28" fill="${c}"/>
  <circle cx="58" cy="34" r="21" fill="${c}"/>
  <path d="M76 32 q16 3 0 11 q-6 -5 0 -11 z" fill="#ffa62b"/>
  <circle cx="62" cy="30" r="4.6" fill="${EYE}"/>
  <circle cx="63.5" cy="28.5" r="1.6" fill="#fff"/>
  <path d="M16 60 q-12 6 -2 14 q8 3 12 -6 z" fill="${shade(c, -22)}"/>
  ${blush(38, 14, 4.4, 58)}`);

add('owl', (c) => `
  <path d="M26 30 L20 8 L42 20 Z" fill="${shade(c, -20)}"/>
  <path d="M74 30 L80 8 L58 20 Z" fill="${shade(c, -20)}"/>
  <ellipse cx="50" cy="56" rx="32" ry="36" fill="${c}"/>
  <circle cx="36" cy="48" r="14" fill="#fff9f2"/>
  <circle cx="64" cy="48" r="14" fill="#fff9f2"/>
  <circle cx="36" cy="48" r="7" fill="${EYE}"/>
  <circle cx="64" cy="48" r="7" fill="${EYE}"/>
  <circle cx="38" cy="46" r="2.4" fill="#fff"/>
  <circle cx="66" cy="46" r="2.4" fill="#fff"/>
  <path d="M50 60 l-6 8 h12 z" fill="#ffa62b"/>
  <path d="M32 80 q18 10 36 0" stroke="${shade(c, -25)}" stroke-width="3"
        fill="none" stroke-linecap="round"/>`);

add('fish', (c) => `
  <path d="M22 50 L2 28 L6 50 L2 72 Z" fill="${shade(c, -22)}"/>
  <ellipse cx="56" cy="50" rx="36" ry="27" fill="${c}"/>
  <path d="M52 23 q10 -14 18 -2 z" fill="${shade(c, -22)}"/>
  <circle cx="76" cy="44" r="5.4" fill="${EYE}"/>
  <circle cx="77.6" cy="42.4" r="1.9" fill="#fff"/>
  <path d="M74 58 q6 5 12 0" stroke="${EYE}" stroke-width="2.6"
        fill="none" stroke-linecap="round"/>
  <circle cx="46" cy="46" r="5" fill="${shade(c, 30)}" opacity=".7"/>
  <circle cx="40" cy="60" r="4" fill="${shade(c, 30)}" opacity=".7"/>`);

add('pig', (c) => `
  <path d="M22 40 L20 14 L42 26 Z" fill="${shade(c, -16)}"/>
  <path d="M78 40 L80 14 L58 26 Z" fill="${shade(c, -16)}"/>
  <circle cx="50" cy="58" r="32" fill="${c}"/>
  ${eyes(50, 13, 4.8)}
  <ellipse cx="50" cy="68" rx="15" ry="11" fill="${shade(c, -22)}"/>
  <ellipse cx="44.5" cy="68" rx="3" ry="4.2" fill="${shade(c, -55)}"/>
  <ellipse cx="55.5" cy="68" rx="3" ry="4.2" fill="${shade(c, -55)}"/>
  ${blush(60, 27)}`);

add('elephant', (c) => `
  <ellipse cx="16" cy="52" rx="16" ry="24" fill="${shade(c, -18)}"/>
  <ellipse cx="84" cy="52" rx="16" ry="24" fill="${shade(c, -18)}"/>
  <circle cx="50" cy="50" r="30" fill="${c}"/>
  <path d="M42 70 q-2 22 10 24 q10 2 10 -8" stroke="${c}" stroke-width="13"
        fill="none" stroke-linecap="round"/>
  ${eyes(46, 12, 4.6)}
  ${blush(58, 21, 5)}`);

add('penguin', (c) => `
  <ellipse cx="18" cy="58" rx="10" ry="20" fill="${shade(c, -30)}"/>
  <ellipse cx="82" cy="58" rx="10" ry="20" fill="${shade(c, -30)}"/>
  <ellipse cx="50" cy="54" rx="30" ry="36" fill="${c}"/>
  <ellipse cx="50" cy="62" rx="20" ry="26" fill="#fff9f2"/>
  ${eyes(42, 11, 4.8)}
  <path d="M50 50 l-7 6 h14 z" fill="#ffa62b"/>
  <path d="M34 92 q-10 2 -2 6 h14 z" fill="#ffa62b"/>
  <path d="M66 92 q10 2 2 6 h-14 z" fill="#ffa62b"/>`);

add('lion', (c) => `
  <polygon points="${starPoly(11, 50, 54, 42, 33)}" fill="${shade(c, -32)}"/>
  <circle cx="50" cy="54" r="28" fill="${c}"/>
  ${eyes(50, 11, 4.6)}
  <ellipse cx="50" cy="62" rx="5.5" ry="4" fill="${EYE}"/>
  <path d="M50 66 v4 M50 70 q-6 5 -9 0 M50 70 q6 5 9 0"
        stroke="${EYE}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  ${blush(60, 20, 4.6)}`);

add('turtle', (c) => `
  <circle cx="82" cy="62" r="14" fill="${shade(c, 34)}"/>
  <circle cx="86" cy="58" r="3.6" fill="${EYE}"/>
  <ellipse cx="24" cy="80" rx="10" ry="7" fill="${shade(c, 34)}"/>
  <ellipse cx="58" cy="82" rx="10" ry="7" fill="${shade(c, 34)}"/>
  <path d="M8 74 Q46 14 84 74 Z" fill="${c}"/>
  <path d="M46 22 v52 M22 50 h48 M28 38 l10 10 M64 38 l-10 10"
        stroke="${shade(c, -36)}" stroke-width="3" fill="none" stroke-linecap="round"/>`);

add('bee', (c) => `
  <ellipse cx="34" cy="30" rx="17" ry="12" fill="#ffffff" opacity=".78"
           transform="rotate(-24 34 30)"/>
  <ellipse cx="68" cy="30" rx="17" ry="12" fill="#ffffff" opacity=".78"
           transform="rotate(24 68 30)"/>
  <ellipse cx="50" cy="60" rx="30" ry="24" fill="${c}"/>
  <path d="M40 39 v42 M56 37 v46" stroke="${shade(c, -70)}" stroke-width="8"/>
  <circle cx="30" cy="54" r="4.4" fill="${EYE}"/>
  <path d="M26 66 q6 5 12 1" stroke="${EYE}" stroke-width="2.4"
        fill="none" stroke-linecap="round"/>
  <path d="M28 34 q-4 -12 4 -16 M40 30 q0 -14 10 -16"
        stroke="${EYE}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`);

add('butterfly', (c) => `
  <ellipse cx="28" cy="36" rx="22" ry="19" fill="${c}" transform="rotate(-18 28 36)"/>
  <ellipse cx="72" cy="36" rx="22" ry="19" fill="${c}" transform="rotate(18 72 36)"/>
  <ellipse cx="32" cy="68" rx="17" ry="15" fill="${shade(c, 30)}"/>
  <ellipse cx="68" cy="68" rx="17" ry="15" fill="${shade(c, 30)}"/>
  <circle cx="28" cy="34" r="5" fill="#fff" opacity=".65"/>
  <circle cx="72" cy="34" r="5" fill="#fff" opacity=".65"/>
  <ellipse cx="50" cy="52" rx="6" ry="26" fill="${shade(c, -55)}"/>
  <path d="M46 26 q-6 -14 -12 -16 M54 26 q6 -14 12 -16"
        stroke="${shade(c, -55)}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`);

/* ── countable objects ─────────────────────────────────────────────────── */

add('apple', (c) => `
  <path d="M50 26 Q30 16 20 36 Q10 58 26 78 Q38 92 50 82 Q62 92 74 78
           Q90 58 80 36 Q70 16 50 26 Z" fill="${c}"/>
  <path d="M50 28 v-14" stroke="#8a5a2b" stroke-width="5" stroke-linecap="round"/>
  <path d="M52 18 q14 -10 22 0 q-12 8 -22 0 z" fill="#6cc24a"/>
  <ellipse cx="34" cy="44" rx="7" ry="10" fill="#fff" opacity=".38"
           transform="rotate(-24 34 44)"/>`);

/* No 'star' here on purpose — the countable star IS the geometric one from
   SHAPE_ART below, deliberately kept plain so the Shapes game teaches the
   form cleanly. A faced version used to be defined at this spot and was
   silently overwritten by SHAPE_ART's, so it never actually rendered; the
   add() guard above now makes that class of mistake impossible. */

add('balloon', (c) => `
  <ellipse cx="50" cy="40" rx="28" ry="33" fill="${c}"/>
  <path d="M45 72 h10 l-5 8 z" fill="${shade(c, -30)}"/>
  <path d="M50 80 q10 10 0 20" stroke="${shade(c, -50)}" stroke-width="2.6"
        fill="none" stroke-linecap="round"/>
  <ellipse cx="38" cy="28" rx="7" ry="11" fill="#fff" opacity=".42"
           transform="rotate(-22 38 28)"/>`);

add('flower', (c) => `
  <path d="M50 60 v34" stroke="#4fae4a" stroke-width="6" stroke-linecap="round"/>
  <path d="M50 78 q-16 -4 -20 -14 q16 -2 20 14 z" fill="#4fae4a"/>
  ${[0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i * Math.PI) / 3;
    return `<ellipse cx="${50 + 22 * Math.cos(a)}" cy="${44 + 22 * Math.sin(a)}"
             rx="14" ry="11" fill="${c}"
             transform="rotate(${(i * 60)} ${50 + 22 * Math.cos(a)} ${44 + 22 * Math.sin(a)})"/>`;
  }).join('')}
  <circle cx="50" cy="44" r="12" fill="#ffd449"/>
  ${eyes(42, 5, 2.8)}
  ${smile(48, 3.4)}`);

add('cupcake', (c) => `
  <path d="M26 52 h48 l-7 38 q-1 6 -7 6 H40 q-6 0 -7 -6 z" fill="#ffe0b8"/>
  <path d="M40 54 l-3 42 M50 54 v42 M60 54 l3 42"
        stroke="#e8b98a" stroke-width="3"/>
  <path d="M22 52 q4 -30 28 -30 q24 0 28 30 z" fill="${c}"/>
  <circle cx="50" cy="18" r="7" fill="#ff5d73"/>
  <circle cx="36" cy="40" r="3" fill="#fff" opacity=".6"/>
  <circle cx="62" cy="36" r="3" fill="#fff" opacity=".6"/>`);

add('strawberry', (c) => `
  <path d="M50 34 Q22 34 22 56 Q22 84 50 94 Q78 84 78 56 Q78 34 50 34 Z" fill="${c}"/>
  <path d="M30 30 h40 l-8 10 h-24 z" fill="#4fae4a"/>
  <path d="M50 30 v-12" stroke="#4fae4a" stroke-width="5" stroke-linecap="round"/>
  ${[[38, 50], [58, 48], [46, 62], [64, 64], [34, 68], [52, 78]]
    .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="3.6" fill="#fff5cc"/>`).join('')}`);

add('icecream', (c) => `
  <path d="M32 48 h36 l-18 46 z" fill="#f0b276"/>
  <path d="M36 56 l24 20 M44 48 l20 16 M32 66 l14 12"
        stroke="#d3945a" stroke-width="2.6"/>
  <circle cx="38" cy="36" r="16" fill="${c}"/>
  <circle cx="62" cy="36" r="16" fill="${shade(c, 34)}"/>
  <circle cx="50" cy="22" r="15" fill="${shade(c, -22)}"/>
  <circle cx="50" cy="8" r="5" fill="#ff5d73"/>`);

/* ── scene props (spot the difference) ─────────────────────────────────── */

add('tree', (c) => `
  <rect x="43" y="56" width="14" height="40" rx="5" fill="#a76d3f"/>
  <circle cx="50" cy="36" r="26" fill="${c}"/>
  <circle cx="30" cy="48" r="17" fill="${shade(c, 18)}"/>
  <circle cx="70" cy="48" r="17" fill="${shade(c, 18)}"/>`);

add('cloud', () => `
  <circle cx="34" cy="56" r="18" fill="#ffffff"/>
  <circle cx="54" cy="46" r="24" fill="#ffffff"/>
  <circle cx="74" cy="58" r="16" fill="#ffffff"/>
  <rect x="30" y="56" width="48" height="18" rx="9" fill="#ffffff"/>`);

add('sun', (c) => `
  <polygon points="${starPoly(12, 50, 50, 46, 30)}" fill="${shade(c, 24)}"/>
  <circle cx="50" cy="50" r="27" fill="${c}"/>
  ${eyes(46, 10, 4)}
  ${smile(58, 6)}`);

add('house', (c) => `
  <rect x="22" y="46" width="56" height="46" rx="5" fill="${c}"/>
  <path d="M14 48 L50 16 L86 48 Z" fill="${shade(c, -40)}"/>
  <rect x="42" y="64" width="18" height="28" rx="3" fill="#8a5a2b"/>
  <rect x="26" y="54" width="14" height="14" rx="3" fill="#ffeaa7"/>
  <rect x="62" y="54" width="14" height="14" rx="3" fill="#ffeaa7"/>`);

add('mushroom', (c) => `
  <path d="M38 56 h24 v28 q0 8 -12 8 q-12 0 -12 -8 z" fill="#fff2df"/>
  <path d="M10 56 Q14 18 50 18 Q86 18 90 56 Z" fill="${c}"/>
  <circle cx="32" cy="40" r="7" fill="#fff2df"/>
  <circle cx="60" cy="34" r="6" fill="#fff2df"/>
  <circle cx="70" cy="48" r="5" fill="#fff2df"/>`);

add('bush', (c) => `
  <circle cx="28" cy="66" r="20" fill="${shade(c, -14)}"/>
  <circle cx="70" cy="66" r="18" fill="${shade(c, -14)}"/>
  <circle cx="50" cy="56" r="25" fill="${c}"/>
  <rect x="8" y="72" width="84" height="18" rx="9" fill="${shade(c, -14)}"/>`);

add('bird', (c) => `
  <ellipse cx="48" cy="56" rx="26" ry="21" fill="${c}"/>
  <circle cx="70" cy="40" r="15" fill="${c}"/>
  <path d="M84 38 l14 5 l-14 5 z" fill="#ffa62b"/>
  <circle cx="74" cy="37" r="3.8" fill="${EYE}"/>
  <ellipse cx="42" cy="56" rx="14" ry="10" fill="${shade(c, 30)}"
           transform="rotate(-16 42 56)"/>
  <path d="M24 62 l-16 10 l14 2 z" fill="${shade(c, -20)}"/>
  <path d="M44 76 v10 M56 76 v10" stroke="#ffa62b" stroke-width="3.4"
        stroke-linecap="round"/>`);

add('rock', (c) => `
  <path d="M12 84 Q8 58 30 46 Q52 32 72 48 Q94 62 88 84 Z" fill="${c}"/>
  <path d="M30 46 Q44 60 34 84" stroke="${shade(c, -28)}" stroke-width="3" fill="none"/>`);

/* ── geometric shapes ──────────────────────────────────────────────────── */

/* Names are spoken aloud, so "moon" not "crescent" — the shape game teaches the
   form, and the word a 3-year-old already owns is the one worth reinforcing. */
export const SHAPES = [
  { id: 'circle',    name: 'circle' },
  { id: 'square',    name: 'square' },
  { id: 'triangle',  name: 'triangle' },
  { id: 'star',      name: 'star' },
  { id: 'heart',     name: 'heart' },
  { id: 'rectangle', name: 'rectangle' },
  { id: 'oval',      name: 'oval' },
  { id: 'diamond',   name: 'diamond' },
  { id: 'pentagon',  name: 'pentagon' },
  { id: 'hexagon',   name: 'hexagon' },
  { id: 'moon',      name: 'moon' },
];

const SHAPE_ART = {
  circle:    (c) => `<circle cx="50" cy="50" r="40" fill="${c}"/>`,
  square:    (c) => `<rect x="11" y="11" width="78" height="78" rx="9" fill="${c}"/>`,
  rectangle: (c) => `<rect x="4" y="26" width="92" height="48" rx="9" fill="${c}"/>`,
  triangle:  (c) => `<polygon points="50,8 93,88 7,88" fill="${c}" stroke-linejoin="round"
                       stroke="${c}" stroke-width="10"/>`,
  star:      (c) => `<polygon points="${starPoly(5, 50, 52, 45, 19)}" fill="${c}"
                       stroke="${c}" stroke-width="6" stroke-linejoin="round"/>`,
  heart:     (c) => `<path d="M50 90 C10 62 10 26 32 20 C42 17 50 26 50 33
                       C50 26 58 17 68 20 C90 26 90 62 50 90 Z" fill="${c}"/>`,
  oval:      (c) => `<ellipse cx="50" cy="50" rx="44" ry="29" fill="${c}"/>`,
  diamond:   (c) => `<polygon points="50,6 92,50 50,94 8,50" fill="${c}"
                       stroke="${c}" stroke-width="8" stroke-linejoin="round"/>`,
  pentagon:  (c) => `<polygon points="${regularPoly(5, 50, 52, 44)}" fill="${c}"
                       stroke="${c}" stroke-width="8" stroke-linejoin="round"/>`,
  hexagon:   (c) => `<polygon points="${regularPoly(6, 50, 50, 44)}" fill="${c}"
                       stroke="${c}" stroke-width="8" stroke-linejoin="round"/>`,
  moon:      (c) => `<path d="M66 8 A44 44 0 1 0 66 92 A34 34 0 1 1 66 8 Z" fill="${c}"/>`,
};

for (const [id, fn] of Object.entries(SHAPE_ART)) add(id, fn);

/* ── dress-up bodies ───────────────────────────────────────────────────────
   Deliberately new, simple silhouettes rather than reusing the animal
   sprites: animals' ears/features sit at wildly different heights (bunny's
   ears rise almost off-canvas, a fish has no head at all), which would need
   per-animal anchor tuning for accessories to sit right. These share one
   consistent head-top and a face roughly centred at (50, 50-64) so a
   bow/glasses/crown and the OUTFIT overlays below all land in a sane spot
   on any of them, even the two that aren't circle-ish (cloud, star). */

add('blob', (c) => `
  <circle cx="50" cy="58" r="38" fill="${c}"/>
  ${eyes(50, 13)}
  ${smile(64, 6)}
  ${blush(60, 24)}`);

add('egg', (c) => `
  <ellipse cx="50" cy="55" rx="30" ry="42" fill="${c}"/>
  ${eyes(46, 12)}
  ${smile(58, 5.5)}
  ${blush(54, 22)}`);

add('boxy', (c) => `
  <rect x="14" y="20" width="72" height="72" rx="22" fill="${c}"/>
  ${eyes(48, 13)}
  ${smile(62, 6)}
  ${blush(58, 24)}`);

/* Named "puff"/"sparkle" rather than "cloud"/"star" — those names are
   already taken by the scene-prop cloud and the geometric star shape, and
   add() overwrites by name. A collision here would silently put a face on
   every background cloud in Spot the Difference and on the Shapes game's
   star option. */
add('puff', (c) => `
  <circle cx="32" cy="60" r="20" fill="${c}"/>
  <circle cx="58" cy="50" r="26" fill="${c}"/>
  <circle cx="78" cy="62" r="18" fill="${c}"/>
  <rect x="28" y="58" width="52" height="24" rx="12" fill="${c}"/>
  ${eyes(52, 13)}
  ${smile(66, 6)}
  ${blush(62, 24)}`);

add('sparkle', (c) => `
  <polygon points="${starPoly(5, 50, 54, 44, 19)}" fill="${c}"/>
  ${eyes(48, 12)}
  ${smile(60, 5.5)}
  ${blush(56, 22)}`);

export const BUDDIES = ['blob', 'egg', 'boxy', 'puff', 'sparkle'];

/** Overlays composited on top of a buddy body by the Dress-Up toy. Each
 *  carries its own default colours (ignoring any argument) so a picker
 *  preview and the live figure always show the same result. */
export const ACCESSORY = {
  none: () => '',
  bow: () => `
    <path d="M50 16 L38 8 L38 22 Z" fill="#ff5d73"/>
    <path d="M50 16 L62 8 L62 22 Z" fill="#ff5d73"/>
    <circle cx="50" cy="16" r="5" fill="${shade('#ff5d73', -20)}"/>`,
  glasses: () => `
    <circle cx="38" cy="48" r="11" fill="none" stroke="#403d52" stroke-width="4"/>
    <circle cx="62" cy="48" r="11" fill="none" stroke="#403d52" stroke-width="4"/>
    <path d="M49 48 h2" stroke="#403d52" stroke-width="4"/>
    <path d="M27 46 q-8 -4 -10 4" stroke="#403d52" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M73 46 q8 -4 10 4" stroke="#403d52" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  crown: () => `
    <path d="M30 22 L36 6 L50 18 L64 6 L70 22 Z" fill="#ffc93c"
          stroke="${shade('#ffc93c', -30)}" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="36" cy="6" r="3" fill="#ff6b8a"/>
    <circle cx="50" cy="18" r="3" fill="#5fd6a4"/>
    <circle cx="64" cy="6" r="3" fill="#6cc0ff"/>`,
  cap: () => `
    <path d="M22 30 Q50 4 78 30 L78 32 Q50 19 22 32 Z" fill="#5ec8d8"/>
    <ellipse cx="19" cy="31" rx="13" ry="5" fill="${shade('#5ec8d8', -30)}"/>`,
  flower: () => `
    <g transform="translate(70,24)">
      <circle cx="0" cy="-8" r="5.4" fill="#ff8fab"/>
      <circle cx="7" cy="-3" r="5.4" fill="#ff8fab"/>
      <circle cx="6" cy="6" r="5.4" fill="#ff8fab"/>
      <circle cx="-3" cy="8" r="5.4" fill="#ff8fab"/>
      <circle cx="-7" cy="0" r="5.4" fill="#ff8fab"/>
      <circle cx="0" cy="0" r="4" fill="#ffd449"/>
    </g>`,
  partyHat: () => `
    <path d="M50 2 L67 34 L33 34 Z" fill="#b79bff"/>
    <circle cx="50" cy="2" r="4.4" fill="#ffd449"/>
    <circle cx="41" cy="20" r="2.8" fill="#ffd449"/>
    <circle cx="59" cy="26" r="2.8" fill="#fff"/>
    <circle cx="46" cy="28" r="2.8" fill="#fff"/>`,
};
export const ACCESSORY_IDS = ['none', 'bow', 'glasses', 'crown', 'cap', 'flower', 'partyHat'];

/** "Costume" overlays for the Dress-Up toy — clothing rather than headwear,
 *  composited on the lower half of a buddy body. Each has its own fixed
 *  colours for the same reason ACCESSORY does. Most only need a `front`
 *  layer (drawn over the body), but `cape` also needs a `behind` layer
 *  (drawn under the body, so it appears to flow out from the shoulders
 *  rather than sitting flat on top of the body shape). */
export const OUTFIT = {
  none: { behind: () => '', front: () => '' },
  shirt: {
    behind: () => '',
    front: () => `
      <path d="M28 64 L38 58 Q50 66 62 58 L72 64 L68 75 L64 70 L64 94
               Q50 98 36 94 L36 70 L32 75 Z" fill="#ffc93c"/>
      <circle cx="50" cy="80" r="3.2" fill="${shade('#ffc93c', -35)}"/>`,
  },
  dress: {
    behind: () => '',
    front: () => `
      <path d="M36 58 Q50 66 64 58 L70 66 Q80 92 68 97 Q50 101 32 97
               Q20 92 30 66 Z" fill="#ff6b8a"/>
      <path d="M42 59 Q50 65 58 59" stroke="${shade('#ff6b8a', -35)}"
            stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
  },
  overalls: {
    behind: () => '',
    front: () => `
      <path d="M34 70 L34 96 Q50 100 66 96 L66 70 L58 70 L58 80 L42 80
               L42 70 Z" fill="#6cc0ff"/>
      <rect x="36" y="52" width="6" height="18" rx="2" fill="#6cc0ff"/>
      <rect x="58" y="52" width="6" height="18" rx="2" fill="#6cc0ff"/>
      <circle cx="38" cy="73" r="2.6" fill="${shade('#6cc0ff', -40)}"/>
      <circle cx="62" cy="73" r="2.6" fill="${shade('#6cc0ff', -40)}"/>`,
  },
  cape: {
    behind: () => `
      <path d="M22 40 Q10 90 30 99 L50 86 L70 99 Q90 90 78 40
               Q64 55 50 47 Q36 55 22 40 Z" fill="#ff5d73"/>`,
    front: () => `<path d="M44 66 L50 58 L56 66 L50 79 Z" fill="#ffd449"/>`,
  },
  astronaut: {
    behind: () => '',
    front: () => `
      <path d="M30 60 Q50 70 70 60 L74 91 Q50 99 26 91 Z" fill="#f4f6fb"/>
      <path d="M30 60 Q50 68 70 60" stroke="#c9c2da" stroke-width="2.6" fill="none"/>
      <circle cx="50" cy="77" r="9" fill="#6cc0ff" opacity=".85"/>
      <circle cx="50" cy="77" r="9" fill="none" stroke="#c9c2da" stroke-width="2.4"/>`,
  },
};
export const OUTFIT_IDS = ['none', 'shirt', 'dress', 'overalls', 'cape', 'astronaut'];

/* ── dot-to-dot outlines ───────────────────────────────────────────────────
   Raw path `d` strings (not full renderSprite() output) so the Dot-to-Dot
   toy can sample points along them with getPointAtLength() — the same
   technique tracing.js uses to walk a guide path. Any SVG geometry element
   supports this, but keeping these as plain `d` strings means one code path
   regardless of whether the shape was originally a <path> or a <polygon>.

   Each entry is an ARRAY of one or more closed subpaths ("groups"). Most
   shapes are a single group, but a few (the snowman, the car) are naturally drawn
   as several separate closed loops — a head plus two ears, a body plus two
   wheels. Dot-to-Dot samples and numbers each group separately and never
   draws a connecting line between them, so a two-circle "ear" doesn't get a
   stray line dragged across the middle of the head to reach it. */

const pointsToPath = (points) => {
  const pts = points.trim().split(/\s+/);
  return `M${pts[0]} ${pts.slice(1).map((p) => `L${p}`).join(' ')} Z`;
};

const circlePath = (cx, cy, r) =>
  `M${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;

export const SHAPE_OUTLINE = {
  circle: [circlePath(50, 50, 40)],
  square: [pointsToPath('11,11 89,11 89,89 11,89')],
  triangle: [pointsToPath('50,8 93,88 7,88')],
  diamond: [pointsToPath('50,6 92,50 50,94 8,50')],
  star: [pointsToPath(starPoly(5, 50, 52, 45, 19))],
  heart: ['M50 90 C10 62 10 26 32 20 C42 17 50 26 50 33 '
        + 'C50 26 58 17 68 20 C90 26 90 62 50 90 Z'],
  moon: ['M66 8 A44 44 0 1 0 66 92 A34 34 0 1 1 66 8 Z'],
  house: [pointsToPath('15,90 15,45 50,15 85,45 85,90')],
  cat: [pointsToPath('24,10 34,34 50,26 66,34 76,10 90,46 88,70 66,92 34,92 12,70 10,46')],
  fish: ['M10 50 Q10 20 40 15 Q65 12 75 30 L92 15 L80 50 L92 85 L75 70 '
       + 'Q65 88 40 85 Q10 80 10 50 Z'],
  tree: [pointsToPath('50,8 72,38 58,38 84,66 60,66 60,94 40,94 40,66 16,66 42,38 28,38')],
  rocket: [pointsToPath('50,6 66,34 66,66 86,92 62,74 62,94 38,94 38,74 14,92 34,66 34,34')],
  /* A snowman, NOT a round head with two round ears — that silhouette (a
     plain circle with two oversized circles high and apart on it) is the
     Mickey Mouse trademark, which Disney holds perpetually and enforces
     hard, and a children's app is exactly the market where confusion is
     assumed. Three stacked circles read as unmistakably generic while
     still being a genuine multi-group outline, which is what this entry is
     here to provide. */
  snowman: [circlePath(50, 74, 20), circlePath(50, 46, 15), circlePath(50, 24, 11)],
  car: [pointsToPath('10,74 10,60 26,60 36,38 64,38 74,60 90,60 90,74'),
        circlePath(28, 80, 10), circlePath(72, 80, 10)],
};

/** Dot-to-Dot shape pools by age: fewer, simpler single-loop shapes for
 *  younger children, saving the multi-group shapes (which need more dots to
 *  read clearly) for the ages that already get the biggest dot counts. */
export const OUTLINE_SHAPES_BY_AGE = {
  2: ['circle', 'square', 'triangle', 'diamond'],
  3: ['circle', 'square', 'triangle', 'diamond', 'star', 'heart', 'moon'],
  4: ['square', 'triangle', 'diamond', 'star', 'heart', 'moon', 'house', 'cat', 'fish', 'tree'],
  5: ['star', 'heart', 'house', 'cat', 'fish', 'tree', 'rocket', 'snowman', 'car'],
};

/* ── public API ────────────────────────────────────────────────────────── */

export const ANIMALS = ['cat', 'bunny', 'bear', 'dog', 'mouse', 'fox', 'frog', 'duck',
                        'owl', 'fish', 'pig', 'elephant', 'penguin', 'lion', 'turtle',
                        'bee', 'butterfly'];

export const OBJECTS = ['apple', 'star', 'balloon', 'flower', 'cupcake',
                        'strawberry', 'icecream'];

/* No PROPS list here: Spot the Difference owns its own GROUND_PROPS /
   SKY_PROPS split (a prop has to know which half of the scene it belongs in,
   which a single flat list can't express). A general PROPS export used to sit
   here unused, which was a trap — adding a sprite to it looked like it would
   show up in the game, and never did. */

/** Nouns spoken by the counting game ("How many ducks?"). */
export const PLURALS = {
  apple: 'apples', star: 'stars', balloon: 'balloons', flower: 'flowers',
  cupcake: 'cupcakes', strawberry: 'strawberries', icecream: 'ice creams',
  cat: 'cats', bunny: 'bunnies', bear: 'bears', dog: 'dogs', mouse: 'mice',
  fox: 'foxes', frog: 'frogs', duck: 'ducks', owl: 'owls', fish: 'fish',
  pig: 'pigs', elephant: 'elephants', penguin: 'penguins', lion: 'lions',
  turtle: 'turtles', bee: 'bees', butterfly: 'butterflies',
};

/** Raw markup for one sprite, without an <svg> wrapper — for composing scenes. */
export function spriteBody(name, color = PALETTE[0]) {
  const fn = SPRITES[name];
  if (!fn) throw new Error(`unknown sprite: ${name}`);
  return fn(color);
}

/** Collapse a sprite to a flat silhouette by rewriting every paint attribute.
 *  fill="none" is preserved so outline-only strokes don't fill in and bulge the
 *  shape; every other paint becomes one colour, so overlapping parts merge into
 *  a single solid blob. */
export function toSilhouette(markup, color = SHADOW) {
  return markup
    .replace(/fill="(?!none")[^"]*"/g, `fill="${color}"`)
    .replace(/stroke="(?!none")[^"]*"/g, `stroke="${color}"`)
    .replace(/opacity="[^"]*"/g, 'opacity="1"');
}

/**
 * A complete <svg> for one sprite.
 * @param {object} o  color, size (px or CSS length), silhouette, flip, rotate, cls
 */
export function renderSprite(name, o = {}) {
  const { color = PALETTE[0], size = '100%', silhouette = false,
          flip = false, rotate = 0, cls = '' } = o;
  let body = spriteBody(name, color);
  if (silhouette) body = toSilhouette(body, o.shadowColor || SHADOW);

  const tf = [];
  if (flip) tf.push('translate(100,0) scale(-1,1)');
  if (rotate) tf.push(`rotate(${rotate} 50 50)`);
  const inner = tf.length ? `<g transform="${tf.join(' ')}">${body}</g>` : body;

  const dim = typeof size === 'number' ? `${size}px` : size;
  return `<svg viewBox="0 0 100 100" width="${dim}" height="${dim}"
               class="${cls}" aria-hidden="true">${inner}</svg>`;
}

/* ── small UI glyphs ───────────────────────────────────────────────────── */

export const glyph = {
  star: (fill = '#ffc93c', stroke = '#e8b21f') =>
    `<svg viewBox="0 0 100 100" aria-hidden="true"><polygon
       points="${starPoly(5, 50, 52, 44, 18)}" fill="${fill}"
       stroke="${stroke}" stroke-width="6" stroke-linejoin="round"/></svg>`,

  starEmpty: () =>
    `<svg viewBox="0 0 100 100" aria-hidden="true"><polygon
       points="${starPoly(5, 50, 52, 44, 18)}" fill="none"
       stroke="#d9d3e6" stroke-width="8" stroke-linejoin="round"/></svg>`,

  back: () =>
    `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M62 20 L30 50 L62 80"
       stroke="#403d52" stroke-width="13" fill="none"
       stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  speaker: () =>
    `<svg viewBox="0 0 100 100" aria-hidden="true">
       <path d="M18 38 h16 L54 20 v60 L34 62 H18 Z" fill="#403d52"/>
       <path d="M66 34 q14 16 0 32 M78 24 q22 26 0 52" stroke="#403d52"
             stroke-width="7" fill="none" stroke-linecap="round"/></svg>`,

  gear: () =>
    `<svg viewBox="0 0 100 100" aria-hidden="true">
       <polygon points="${starPoly(8, 50, 50, 40, 30)}" fill="#403d52"/>
       <circle cx="50" cy="50" r="14" fill="#fff"/></svg>`,

  check: () =>
    `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M22 52 L42 72 L78 30"
       stroke="#3fbf7f" stroke-width="14" fill="none"
       stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  dice: () =>
    `<svg viewBox="0 0 100 100" aria-hidden="true">
       <rect x="14" y="14" width="72" height="72" rx="18" fill="#ffffff"
             stroke="#403d52" stroke-width="6"/>
       <circle cx="34" cy="34" r="7" fill="#403d52"/>
       <circle cx="66" cy="34" r="7" fill="#403d52"/>
       <circle cx="50" cy="50" r="7" fill="#403d52"/>
       <circle cx="34" cy="66" r="7" fill="#403d52"/>
       <circle cx="66" cy="66" r="7" fill="#403d52"/></svg>`,
};
