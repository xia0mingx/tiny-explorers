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

/* Mouth/brow pair for the 'expression' Spot-the-Difference mutation — the
   curve bulges UP instead of down, and the brows above it slant inward, so
   a sad face reads as unmistakably different from its happy twin at a
   glance rather than needing a close look. */
const frown = (cy, w = 7, cx = 50) => `
  <path d="M${cx - w} ${cy + w * 0.7} Q${cx} ${cy - w * 0.6} ${cx + w} ${cy + w * 0.7}"
        stroke="${EYE}" stroke-width="3" fill="none" stroke-linecap="round"/>`;

const sadBrows = (cy, spread = 12, cx = 50) => `
  <path d="M${cx - spread - 6} ${cy - 8} L${cx - spread + 6} ${cy - 3}"
        stroke="${EYE}" stroke-width="3" stroke-linecap="round"/>
  <path d="M${cx + spread + 6} ${cy - 8} L${cx + spread - 6} ${cy - 3}"
        stroke="${EYE}" stroke-width="3" stroke-linecap="round"/>`;

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

/* Animals are drawn as whole sitting (or, for the side-on duck, fish,
   turtle and bee, swimming/flying) characters with a dark "sticker" outline
   around the whole silhouette: sticker() draws a dark, wide-stroked copy of
   the silhouette-defining parts underneath the real ones, then the details
   (tummies, faces, markings) go on top without an outline.

   Only the parts passed to sticker() — and anything else outside the body —
   shape the shadow, so keep every detail inside the body outline. The duck,
   fish, turtle and bee must stay asymmetric: Shadows uses mirrored copies of
   the first three as decoys and Spot It flips the bee. */

const NOSE = '#ff7f9c';
const CREAM = '#fff6ea';
const ORANGE = '#ffa62b';

const roundEyes = (cy, spread = 12, r = 5.2, cx = 50) => `
  <circle cx="${cx - spread}" cy="${cy}" r="${r}" fill="${EYE}"/>
  <circle cx="${cx + spread}" cy="${cy}" r="${r}" fill="${EYE}"/>
  <circle cx="${cx - spread + r * 0.38}" cy="${cy - r * 0.38}" r="${r * 0.38}" fill="#fff"/>
  <circle cx="${cx + spread + r * 0.38}" cy="${cy - r * 0.38}" r="${r * 0.38}" fill="#fff"/>
  <circle cx="${cx - spread - r * 0.35}" cy="${cy + r * 0.4}" r="${r * 0.16}" fill="#fff"/>
  <circle cx="${cx + spread - r * 0.35}" cy="${cy + r * 0.4}" r="${r * 0.16}" fill="#fff"/>`;
const cheeks = (cy, spread = 20, r = 4.6) => `
  <ellipse cx="${50 - spread}" cy="${cy}" rx="${r}" ry="${r * 0.7}" fill="${BLUSH}" opacity=".6"/>
  <ellipse cx="${50 + spread}" cy="${cy}" rx="${r}" ry="${r * 0.7}" fill="${BLUSH}" opacity=".6"/>`;
const shine = (cx, cy, rx = 8, ry = 4.5) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".35" transform="rotate(-28 ${cx} ${cy})"/>`;
const catMouth = (y) => `<path d="M50 ${y} q-3 4 -6.5 1.5 M50 ${y} q3 4 6.5 1.5"
  stroke="${EYE}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;

/** Sticker outline: a dark copy of the silhouette parts, stroked wide,
 *  drawn underneath the real parts. */
function sticker(parts, c, w = 5) {
  const o = shade(c, -70);
  const under = parts
    .replace(/stroke-width="([\d.]+)"/g, (_, n) => `stroke-width="${Number(n) + w}"`)
    .replace(/stroke="(?!none")[^"]*"/g, `stroke="${o}"`)
    .replace(/fill="(?!none")[^"]*"/g,
             `fill="${o}" stroke="${o}" stroke-width="${w}" stroke-linejoin="round"`);
  return under + parts;
}

const ANIMAL_ART = {
  cat: (c) => sticker(`
    <path d="M66 86 Q90 88 88 68 Q87 60 81 62" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/>
    <ellipse cx="50" cy="76" rx="22" ry="17" fill="${c}"/>
    <path d="M27 34 L24 9 L45 21 Z" fill="${c}"/>
    <path d="M73 34 L76 9 L55 21 Z" fill="${c}"/>
    <ellipse cx="50" cy="40" rx="27" ry="24" fill="${c}"/>
    <ellipse cx="40" cy="91" rx="8" ry="5" fill="${c}"/>
    <ellipse cx="60" cy="91" rx="8" ry="5" fill="${c}"/>`, c) + `
    <path d="M30 27 L28.5 15 L40 22 Z" fill="${BLUSH}" opacity=".85"/>
    <path d="M70 27 L71.5 15 L60 22 Z" fill="${BLUSH}" opacity=".85"/>
    <ellipse cx="50" cy="79" rx="12" ry="11" fill="${CREAM}"/>
    <path d="M44 19 l1.6 6.5 M50 17.5 v7.5 M56 19 l-1.6 6.5" stroke="${shade(c, -30)}" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="50" cy="51" rx="11" ry="7.5" fill="${CREAM}"/>
    ${roundEyes(40, 11, 5.4)}
    <path d="M46.5 46.5 h7 l-3.5 4 z" fill="${NOSE}" stroke="${NOSE}" stroke-linejoin="round"/>
    ${catMouth(50.5)}
    <path d="M37 49 h-13 M37 53 l-12 3 M63 49 h13 M63 53 l12 3" stroke="${shade(c, -45)}" stroke-width="1.8" stroke-linecap="round"/>
    ${cheeks(49, 19)}
    <path d="M37 92 v-3 M43 92 v-3 M57 92 v-3 M63 92 v-3" stroke="${shade(c, -30)}" stroke-width="1.6" stroke-linecap="round"/>
    ${shine(37, 27)}`,

  fox: (c) => sticker(`
    <path d="M42 90 Q-2 94 4 54 Q8 30 26 40 Q34 46 26 56 Q20 70 42 76 Z" fill="${c}"/>
    <ellipse cx="50" cy="77" rx="20" ry="16" fill="${c}"/>
    <path d="M27 34 L22 6 L46 21 Z" fill="${c}"/>
    <path d="M73 34 L78 6 L54 21 Z" fill="${c}"/>
    <path d="M20 33 Q50 8 80 33 Q78 52 50 64 Q22 52 20 33 Z" fill="${c}"/>
    <ellipse cx="41" cy="91" rx="7" ry="4.5" fill="${shade(c, -45)}"/>
    <ellipse cx="59" cy="91" rx="7" ry="4.5" fill="${shade(c, -45)}"/>`, c) + `
    <path d="M5 48 Q10 30 26 40 Q30 44 28 50 Q16 44 5 48 Z" fill="${CREAM}"/>
    <path d="M30 28 L27.5 13 L41 22 Z" fill="${EYE}" opacity=".55"/>
    <path d="M70 28 L72.5 13 L59 22 Z" fill="${EYE}" opacity=".55"/>
    <path d="M21 36 Q36 40 50 64 Q27 54 21 36 Z" fill="${CREAM}"/>
    <path d="M79 36 Q64 40 50 64 Q73 54 79 36 Z" fill="${CREAM}"/>
    <ellipse cx="50" cy="81" rx="10" ry="9" fill="${CREAM}"/>
    ${roundEyes(38, 12, 5)}
    <ellipse cx="50" cy="58" rx="4.2" ry="3.2" fill="${EYE}"/>
    ${cheeks(46, 22, 4.2)}
    ${shine(36, 24)}`,

  elephant: (c) => sticker(`
    <ellipse cx="20" cy="42" rx="18" ry="22" fill="${c}"/>
    <ellipse cx="80" cy="42" rx="18" ry="22" fill="${c}"/>
    <ellipse cx="50" cy="77" rx="23" ry="17" fill="${c}"/>
    <circle cx="50" cy="42" r="24" fill="${c}"/>
    <ellipse cx="37" cy="91" rx="9" ry="5.5" fill="${c}"/>
    <ellipse cx="63" cy="91" rx="9" ry="5.5" fill="${c}"/>
    <path d="M50 54 Q50 76 60 76 Q70 76 70 66" fill="none" stroke="${c}" stroke-width="11" stroke-linecap="round"/>`, c) + `
    <ellipse cx="50" cy="82" rx="13" ry="9" fill="${shade(c, 22)}"/>
    <path d="M50 56 Q50 76 60 76 Q70 76 70 66" fill="none" stroke="${shade(c, -70)}" stroke-width="15" stroke-linecap="round"/>
    <path d="M50 54 Q50 76 60 76 Q70 76 70 66" fill="none" stroke="${c}" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="20" cy="43" rx="11" ry="15" fill="${BLUSH}" opacity=".55"/>
    <ellipse cx="80" cy="43" rx="11" ry="15" fill="${BLUSH}" opacity=".55"/>
    <path d="M46.5 61 h7 M46.5 66 h7 M64 71 l3 3" stroke="${shade(c, -30)}" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="32" cy="93" r="2" fill="${CREAM}"/><circle cx="37" cy="94" r="2" fill="${CREAM}"/><circle cx="42" cy="93" r="2" fill="${CREAM}"/>
    <circle cx="58" cy="93" r="2" fill="${CREAM}"/><circle cx="63" cy="94" r="2" fill="${CREAM}"/><circle cx="68" cy="93" r="2" fill="${CREAM}"/>
    ${roundEyes(39, 10, 4.8)}
    ${cheeks(49, 16, 4.2)}
    ${shine(38, 27)}`,

  lion: (c) => {
    const mane = shade(c, -40);
    const puffs = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return `<circle cx="${(50 + 26 * Math.cos(a)).toFixed(1)}" cy="${(41 + 26 * Math.sin(a)).toFixed(1)}" r="10" fill="${mane}"/>`;
    }).join('');
    return sticker(`
      <path d="M66 86 Q92 88 86 64" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>
      <circle cx="86" cy="61" r="6.5" fill="${mane}"/>
      <ellipse cx="50" cy="79" rx="21" ry="15" fill="${c}"/>
      ${puffs}
      <ellipse cx="40" cy="92" rx="8" ry="5" fill="${c}"/>
      <ellipse cx="60" cy="92" rx="8" ry="5" fill="${c}"/>`, c) + `
      <ellipse cx="50" cy="82" rx="11" ry="9" fill="${CREAM}"/>
      <circle cx="34" cy="24" r="6.5" fill="${c}"/><circle cx="66" cy="24" r="6.5" fill="${c}"/>
      <circle cx="34" cy="24" r="3.2" fill="${BLUSH}"/><circle cx="66" cy="24" r="3.2" fill="${BLUSH}"/>
      <circle cx="50" cy="42" r="21" fill="${c}"/>
      <circle cx="44.5" cy="51" r="6.5" fill="${CREAM}"/><circle cx="55.5" cy="51" r="6.5" fill="${CREAM}"/>
      ${roundEyes(39, 9, 4.6)}
      <path d="M46 46 h8 l-4 4.5 z" fill="${EYE}" stroke="${EYE}" stroke-linejoin="round"/>
      ${catMouth(51)}
      ${cheeks(48, 15, 3.8)}
      ${shine(40, 30, 6, 3.5)}`;
  },

  owl: (c) => sticker(`
    <path d="M28 26 L22 5 L43 16 Z" fill="${c}"/>
    <path d="M72 26 L78 5 L57 16 Z" fill="${c}"/>
    <ellipse cx="50" cy="54" rx="31" ry="37" fill="${c}"/>
    <ellipse cx="19" cy="60" rx="8" ry="19" fill="${shade(c, -28)}" transform="rotate(14 19 60)"/>
    <ellipse cx="81" cy="60" rx="8" ry="19" fill="${shade(c, -28)}" transform="rotate(-14 81 60)"/>
    <ellipse cx="42" cy="92" rx="6" ry="4" fill="${ORANGE}"/>
    <ellipse cx="58" cy="92" rx="6" ry="4" fill="${ORANGE}"/>`, c) + `
    <ellipse cx="50" cy="70" rx="19" ry="19" fill="${CREAM}"/>
    <path d="M42 66 q4 4 8 0 q4 4 8 0 M38 74 q4 4 8 0 q4 4 8 0 q4 4 8 0 M42 82 q4 4 8 0 q4 4 8 0"
          stroke="${shade(c, -10)}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <circle cx="37" cy="42" r="13.5" fill="${shade(c, 35)}"/>
    <circle cx="63" cy="42" r="13.5" fill="${shade(c, 35)}"/>
    <circle cx="37" cy="42" r="10" fill="#fff"/>
    <circle cx="63" cy="42" r="10" fill="#fff"/>
    ${roundEyes(43, 13, 6)}
    <path d="M45 50 h10 l-5 8 z" fill="${ORANGE}" stroke="${ORANGE}" stroke-linejoin="round"/>
    ${shine(34, 24, 7, 4)}`,

  bear: (c) => sticker(`
    <circle cx="28" cy="22" r="10" fill="${c}"/>
    <circle cx="72" cy="22" r="10" fill="${c}"/>
    <ellipse cx="50" cy="77" rx="24" ry="18" fill="${c}"/>
    <ellipse cx="50" cy="42" rx="27" ry="24" fill="${c}"/>
    <ellipse cx="38" cy="92" rx="9" ry="5.5" fill="${c}"/>
    <ellipse cx="62" cy="92" rx="9" ry="5.5" fill="${c}"/>`, c) + `
    <circle cx="28" cy="22" r="5" fill="${BLUSH}" opacity=".7"/>
    <circle cx="72" cy="22" r="5" fill="${BLUSH}" opacity=".7"/>
    <ellipse cx="50" cy="80" rx="13" ry="11" fill="${shade(c, 32)}"/>
    <ellipse cx="50" cy="53" rx="12" ry="9" fill="${shade(c, 35)}"/>
    <ellipse cx="50" cy="49" rx="5" ry="3.6" fill="${EYE}"/>
    ${catMouth(52.5)}
    ${roundEyes(38, 11, 5)}
    ${cheeks(48, 19)}
    <ellipse cx="38" cy="93" rx="4" ry="2.4" fill="${shade(c, 35)}"/>
    <ellipse cx="62" cy="93" rx="4" ry="2.4" fill="${shade(c, 35)}"/>
    ${shine(38, 28)}`,

  dog: (c) => sticker(`
    <path d="M68 80 Q86 76 86 58" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>
    <ellipse cx="50" cy="77" rx="21" ry="17" fill="${c}"/>
    <ellipse cx="50" cy="42" rx="25" ry="23" fill="${c}"/>
    <ellipse cx="23" cy="44" rx="9" ry="18" fill="${shade(c, -28)}" transform="rotate(18 23 44)"/>
    <ellipse cx="77" cy="44" rx="9" ry="18" fill="${shade(c, -28)}" transform="rotate(-18 77 44)"/>
    <ellipse cx="40" cy="92" rx="8" ry="5" fill="${c}"/>
    <ellipse cx="60" cy="92" rx="8" ry="5" fill="${c}"/>`, c) + `
    <ellipse cx="50" cy="80" rx="11" ry="10" fill="${CREAM}"/>
    <path d="M34 62 Q50 70 66 62" stroke="#ff6b8a" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <circle cx="50" cy="68.5" r="3.4" fill="#ffc93c"/>
    <ellipse cx="62" cy="37" rx="8.5" ry="7.5" fill="${shade(c, -22)}" opacity=".7"/>
    <ellipse cx="50" cy="53" rx="12" ry="9" fill="${CREAM}"/>
    <path d="M46.5 56 q3.5 8 7 0 z" fill="${NOSE}"/>
    <ellipse cx="50" cy="48.5" rx="5.5" ry="4" fill="${EYE}"/>
    ${catMouth(52.5)}
    ${roundEyes(38, 11, 5)}
    ${cheeks(49, 18)}
    ${shine(38, 25)}`,

  mouse: (c) => sticker(`
    <path d="M66 88 Q90 92 90 76 Q89 64 97 60" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="24" cy="27" r="16" fill="${c}"/>
    <circle cx="76" cy="27" r="16" fill="${c}"/>
    <ellipse cx="50" cy="78" rx="19" ry="15" fill="${c}"/>
    <ellipse cx="50" cy="49" rx="23" ry="20" fill="${c}"/>
    <ellipse cx="41" cy="92" rx="7" ry="4" fill="${c}"/>
    <ellipse cx="59" cy="92" rx="7" ry="4" fill="${c}"/>`, c) + `
    <circle cx="24" cy="27" r="10" fill="${BLUSH}" opacity=".8"/>
    <circle cx="76" cy="27" r="10" fill="${BLUSH}" opacity=".8"/>
    <ellipse cx="50" cy="81" rx="10" ry="9" fill="${CREAM}"/>
    ${roundEyes(46, 10, 5)}
    <circle cx="50" cy="56" r="3.3" fill="${NOSE}"/>
    ${catMouth(58.5)}
    <path d="M41 56 h-14 M41 59.5 l-13 3 M59 56 h14 M59 59.5 l13 3" stroke="${shade(c, -45)}" stroke-width="1.6" stroke-linecap="round"/>
    ${cheeks(55, 16, 4)}
    ${shine(40, 37, 6, 3.5)}`,

  frog: (c) => sticker(`
    <ellipse cx="22" cy="86" rx="14" ry="8" fill="${c}"/>
    <ellipse cx="78" cy="86" rx="14" ry="8" fill="${c}"/>
    <ellipse cx="50" cy="70" rx="30" ry="22" fill="${c}"/>
    <circle cx="32" cy="34" r="13" fill="${c}"/>
    <circle cx="68" cy="34" r="13" fill="${c}"/>
    <ellipse cx="50" cy="50" rx="33" ry="20" fill="${c}"/>
    <ellipse cx="38" cy="91" rx="7" ry="4.5" fill="${c}"/>
    <ellipse cx="62" cy="91" rx="7" ry="4.5" fill="${c}"/>`, c) + `
    <ellipse cx="50" cy="77" rx="18" ry="13" fill="${shade(c, 45)}"/>
    <circle cx="32" cy="34" r="9" fill="#fff"/>
    <circle cx="68" cy="34" r="9" fill="#fff"/>
    ${roundEyes(35, 18, 5.5)}
    <circle cx="44" cy="44" r="2.4" fill="${shade(c, -20)}"/>
    <circle cx="57" cy="42" r="1.9" fill="${shade(c, -20)}"/>
    <circle cx="51" cy="40" r="1.6" fill="${shade(c, -20)}"/>
    <path d="M33 54 Q50 66 67 54" stroke="${EYE}" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${cheeks(56, 25)}
    ${shine(27, 28, 5, 3)}`,

  duck: (c) => sticker(`
    <path d="M16 56 L3 42 L24 50 Z" fill="${c}"/>
    <ellipse cx="44" cy="64" rx="32" ry="22" fill="${c}"/>
    <circle cx="64" cy="32" r="18" fill="${c}"/>
    <path d="M78 29 Q97 31 81 41 Q76 36 78 29 Z" fill="${ORANGE}"/>
    <ellipse cx="38" cy="89" rx="8" ry="4" fill="${ORANGE}"/>
    <ellipse cx="54" cy="89" rx="8" ry="4" fill="${ORANGE}"/>`, c) + `
    <ellipse cx="50" cy="75" rx="20" ry="8" fill="${shade(c, 30)}"/>
    <path d="M24 60 Q40 46 60 60 Q44 78 24 60 Z" fill="${shade(c, -18)}"/>
    <circle cx="68" cy="28" r="4.6" fill="${EYE}"/>
    <circle cx="69.6" cy="26.4" r="1.7" fill="#fff"/>
    <ellipse cx="68" cy="38" rx="4" ry="2.8" fill="${BLUSH}" opacity=".6"/>
    ${shine(56, 22, 5, 3)}`,

  fish: (c) => sticker(`
    <path d="M26 50 L4 29 Q11 50 4 71 Z" fill="${shade(c, -24)}"/>
    <path d="M42 28 Q58 8 72 28 Z" fill="${shade(c, -24)}"/>
    <path d="M48 72 Q56 86 66 72 Z" fill="${shade(c, -24)}"/>
    <ellipse cx="56" cy="50" rx="34" ry="25" fill="${c}"/>`, c) + `
    <ellipse cx="58" cy="61" rx="24" ry="9" fill="${shade(c, 30)}"/>
    <path d="M36 42 q5 5 10 0 q5 5 10 0 M40 52 q5 5 10 0 q5 5 10 0" stroke="${shade(c, -18)}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M58 54 q-12 2 -9 13 q9 -3 9 -13 z" fill="${shade(c, -24)}"/>
    <circle cx="75" cy="43" r="6.2" fill="${EYE}"/>
    <circle cx="77" cy="41" r="2.3" fill="#fff"/>
    <path d="M82 56 q4 3.5 7 -1" stroke="${EYE}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <ellipse cx="72" cy="55" rx="4" ry="2.8" fill="${BLUSH}" opacity=".6"/>
    ${shine(58, 33, 9, 3)}`,

  pig: (c) => sticker(`
    <path d="M71 82 q11 -1 9 -8 q-2 -5 -6 -1 q-3 4 3 6 q6 1 9 -4" fill="none" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>
    <ellipse cx="50" cy="77" rx="25" ry="18" fill="${c}"/>
    <ellipse cx="50" cy="46" rx="27" ry="23" fill="${c}"/>
    <path d="M33 27 Q12 14 10 40 Q22 40 33 27 Z" fill="${c}"/>
    <path d="M67 27 Q88 14 90 40 Q78 40 67 27 Z" fill="${c}"/>
    <ellipse cx="38" cy="92" rx="7" ry="5" fill="${shade(c, -35)}"/>
    <ellipse cx="62" cy="92" rx="7" ry="5" fill="${shade(c, -35)}"/>`, c) + `
    <path d="M30 28 Q17 21 15 36 Q22 35 30 28 Z" fill="${shade(c, -25)}" opacity=".55"/>
    <path d="M70 28 Q83 21 85 36 Q78 35 70 28 Z" fill="${shade(c, -25)}" opacity=".55"/>
    <ellipse cx="50" cy="80" rx="13" ry="10" fill="${shade(c, 25)}"/>
    ${roundEyes(42, 12, 4.8)}
    <ellipse cx="50" cy="55" rx="12" ry="8.5" fill="${shade(c, -15)}"/>
    <ellipse cx="46" cy="55" rx="2.3" ry="3.4" fill="${shade(c, -60)}"/>
    <ellipse cx="54" cy="55" rx="2.3" ry="3.4" fill="${shade(c, -60)}"/>
    <path d="M45 66 q5 4 10 0" stroke="${EYE}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    ${cheeks(55, 21)}
    ${shine(38, 31)}`,

  penguin: (c) => sticker(`
    <ellipse cx="21" cy="58" rx="8" ry="19" fill="${c}" transform="rotate(22 21 58)"/>
    <ellipse cx="79" cy="58" rx="8" ry="19" fill="${c}" transform="rotate(-22 79 58)"/>
    <ellipse cx="50" cy="54" rx="29" ry="38" fill="${c}"/>
    <ellipse cx="40" cy="92" rx="9" ry="4.5" fill="${ORANGE}"/>
    <ellipse cx="60" cy="92" rx="9" ry="4.5" fill="${ORANGE}"/>`, c) + `
    <ellipse cx="50" cy="65" rx="20" ry="25" fill="${CREAM}"/>
    <circle cx="41" cy="39" r="11" fill="${CREAM}"/>
    <circle cx="59" cy="39" r="11" fill="${CREAM}"/>
    ${roundEyes(39, 9, 4.8)}
    <path d="M44 46 h12 l-6 7 z" fill="${ORANGE}" stroke="${ORANGE}" stroke-linejoin="round"/>
    ${cheeks(49, 17, 3.8)}
    ${shine(36, 25, 7, 4)}`,

  turtle: (c) => {
    const skin = shade(c, 40);
    const hex = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
    return sticker(`
      <path d="M12 72 L2 77 L13 79 Z" fill="${skin}"/>
      <ellipse cx="26" cy="81" rx="8" ry="9" fill="${skin}"/>
      <ellipse cx="62" cy="81" rx="8" ry="9" fill="${skin}"/>
      <ellipse cx="76" cy="66" rx="10" ry="7" fill="${skin}"/>
      <circle cx="85" cy="58" r="11" fill="${skin}"/>
      <path d="M8 74 Q12 26 46 26 Q80 26 82 74 Z" fill="${c}"/>
      <path d="M5 70 H85 Q85 79 79 79 H11 Q5 79 5 70 Z" fill="${shade(c, -25)}"/>`, c) + `
      <polygon points="${hex(45, 52, 10)}" fill="${shade(c, 18)}" stroke="${shade(c, -30)}" stroke-width="2.2"/>
      <polygon points="${hex(25, 60, 7)}" fill="${shade(c, 18)}" stroke="${shade(c, -30)}" stroke-width="2.2"/>
      <polygon points="${hex(65, 60, 7)}" fill="${shade(c, 18)}" stroke="${shade(c, -30)}" stroke-width="2.2"/>
      <polygon points="${hex(45, 34, 5.5)}" fill="${shade(c, 18)}" stroke="${shade(c, -30)}" stroke-width="2.2"/>
      <circle cx="88" cy="55" r="3.8" fill="${EYE}"/>
      <circle cx="89.3" cy="53.7" r="1.4" fill="#fff"/>
      <path d="M85 63 q4 3 8 -1" stroke="${EYE}" stroke-width="2" fill="none" stroke-linecap="round"/>
      ${shine(28, 40, 8, 3.5)}`;
  },

  bee: (c) => sticker(`
    <ellipse cx="38" cy="30" rx="12" ry="17" fill="#eef8ff" transform="rotate(-20 38 30)"/>
    <ellipse cx="56" cy="28" rx="11" ry="16" fill="#eef8ff" transform="rotate(15 56 28)"/>
    <path d="M15 60 L3 63 L15 68 Z" fill="${EYE}"/>
    <ellipse cx="45" cy="63" rx="31" ry="22" fill="${c}"/>
    <circle cx="75" cy="57" r="17" fill="${c}"/>
    <path d="M78 41 q2 -12 10 -16 M71 41 q-2 -12 4 -18" fill="none" stroke="${EYE}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="88" cy="25" r="3" fill="${EYE}"/>
    <circle cx="75" cy="23" r="3" fill="${EYE}"/>`, c) + `
    <path d="M33 43.5 V82.5 M49 41.5 V84.5" stroke="${shade(c, -70)}" stroke-width="8"/>
    <path d="M44 34 q-6 -6 -10 -10 M56 32 q4 -6 6 -10" stroke="#cfe6f5" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <circle cx="79" cy="53" r="4.6" fill="${EYE}"/>
    <circle cx="80.6" cy="51.4" r="1.7" fill="#fff"/>
    <path d="M77 63 q5 4 10 0" stroke="${EYE}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <ellipse cx="72" cy="62" rx="4" ry="2.8" fill="${BLUSH}" opacity=".6"/>
    ${shine(40, 50, 7, 3)}`,

  butterfly: (c) => sticker(`
    <ellipse cx="28" cy="38" rx="22" ry="19" fill="${c}" transform="rotate(-18 28 38)"/>
    <ellipse cx="72" cy="38" rx="22" ry="19" fill="${c}" transform="rotate(18 72 38)"/>
    <ellipse cx="32" cy="70" rx="17" ry="15" fill="${shade(c, 30)}"/>
    <ellipse cx="68" cy="70" rx="17" ry="15" fill="${shade(c, 30)}"/>
    <path d="M46 25 q-6 -12 -12 -14 M54 25 q6 -12 12 -14" fill="none" stroke="${shade(c, -55)}" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="34" cy="11" r="3" fill="${shade(c, -55)}"/>
    <circle cx="66" cy="11" r="3" fill="${shade(c, -55)}"/>
    <ellipse cx="50" cy="60" rx="6" ry="24" fill="${shade(c, -55)}"/>
    <circle cx="50" cy="33" r="9.5" fill="${shade(c, -55)}"/>`, c) + `
    <circle cx="26" cy="36" r="8" fill="#fff" opacity=".55"/>
    <circle cx="74" cy="36" r="8" fill="#fff" opacity=".55"/>
    <circle cx="15" cy="46" r="3.2" fill="#fff" opacity=".7"/>
    <circle cx="85" cy="46" r="3.2" fill="#fff" opacity=".7"/>
    <circle cx="32" cy="71" r="6" fill="${shade(c, -10)}"/>
    <circle cx="68" cy="71" r="6" fill="${shade(c, -10)}"/>
    <circle cx="50" cy="33" r="7.5" fill="${shade(c, 45)}"/>
    ${roundEyes(32, 3.6, 2)}
    <path d="M47.5 35.5 q2.5 2.2 5 0" stroke="${EYE}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,

  bunny: (c) => sticker(`
    <ellipse cx="38" cy="22" rx="9" ry="21" fill="${c}" transform="rotate(-8 38 22)"/>
    <ellipse cx="62" cy="22" rx="9" ry="21" fill="${c}" transform="rotate(8 62 22)"/>
    <circle cx="74" cy="85" r="8" fill="${CREAM}"/>
    <ellipse cx="50" cy="77" rx="21" ry="17" fill="${c}"/>
    <ellipse cx="50" cy="47" rx="25" ry="21" fill="${c}"/>
    <ellipse cx="38" cy="92" rx="10" ry="5" fill="${c}"/>
    <ellipse cx="62" cy="92" rx="10" ry="5" fill="${c}"/>`, c) + `
    <ellipse cx="38" cy="22" rx="4.5" ry="15" fill="${BLUSH}" opacity=".8" transform="rotate(-8 38 22)"/>
    <ellipse cx="62" cy="22" rx="4.5" ry="15" fill="${BLUSH}" opacity=".8" transform="rotate(8 62 22)"/>
    <ellipse cx="50" cy="80" rx="12" ry="11" fill="${CREAM}"/>
    ${roundEyes(45, 11, 5.2)}
    <ellipse cx="50" cy="53" rx="3.6" ry="2.7" fill="${NOSE}"/>
    <rect x="47.2" y="57" width="5.6" height="5" rx="1.4" fill="#fff" stroke="${shade(c, -45)}" stroke-width="1.1"/>
    ${catMouth(55.5)}
    ${cheeks(54, 17)}
    ${shine(38, 35, 7, 4)}`,
};

for (const [name, fn] of Object.entries(ANIMAL_ART)) add(name, fn);

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

add('sunSad', (c) => `
  <polygon points="${starPoly(12, 50, 50, 46, 30)}" fill="${shade(c, 24)}"/>
  <circle cx="50" cy="50" r="27" fill="${c}"/>
  ${eyes(46, 10, 4)}
  ${sadBrows(46, 10)}
  ${frown(58, 6)}`);

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

add('bus', (c) => `
  <rect x="14" y="30" width="72" height="46" rx="14" fill="${c}"/>
  <rect x="22" y="14" width="56" height="24" rx="10" fill="${c}"/>
  <rect x="26" y="20" width="20" height="14" rx="4" fill="#cdeeff"/>
  <rect x="54" y="20" width="20" height="14" rx="4" fill="#cdeeff"/>
  ${eyes(52, 15, 5)}
  ${smile(64, 7)}
  <rect x="10" y="60" width="10" height="10" rx="3" fill="${shade(c, -30)}"/>
  <rect x="80" y="60" width="10" height="10" rx="3" fill="${shade(c, -30)}"/>
  <circle cx="30" cy="82" r="10" fill="#403d52"/>
  <circle cx="70" cy="82" r="10" fill="#403d52"/>
  <circle cx="30" cy="82" r="4" fill="#8a869c"/>
  <circle cx="70" cy="82" r="4" fill="#8a869c"/>`);

/* Sad twin used only by the 'expression' mutation kind, never picked as a
   scene's starting sprite — see EXPRESSIVE below. */
add('busSad', (c) => `
  <rect x="14" y="30" width="72" height="46" rx="14" fill="${c}"/>
  <rect x="22" y="14" width="56" height="24" rx="10" fill="${c}"/>
  <rect x="26" y="20" width="20" height="14" rx="4" fill="#cdeeff"/>
  <rect x="54" y="20" width="20" height="14" rx="4" fill="#cdeeff"/>
  ${eyes(52, 15, 5)}
  ${sadBrows(52, 15)}
  ${frown(64, 7)}
  <rect x="10" y="60" width="10" height="10" rx="3" fill="${shade(c, -30)}"/>
  <rect x="80" y="60" width="10" height="10" rx="3" fill="${shade(c, -30)}"/>
  <circle cx="30" cy="82" r="10" fill="#403d52"/>
  <circle cx="70" cy="82" r="10" fill="#403d52"/>
  <circle cx="30" cy="82" r="4" fill="#8a869c"/>
  <circle cx="70" cy="82" r="4" fill="#8a869c"/>`);

/* A boiler + cab + flared funnel + cowcatcher + three wheels on a
   connecting rod — the classic front-facing steam engine silhouette, so it
   reads as "train" at a glance instead of a generic boxy robot. */
add('train', (c) => `
  <path d="M20 90 L36 70 L64 70 L80 90 Z" fill="${shade(c, -22)}"/>
  <rect x="20" y="36" width="60" height="38" rx="16" fill="${c}"/>
  <rect x="32" y="18" width="36" height="22" rx="6" fill="${c}"/>
  <rect x="38" y="24" width="24" height="12" rx="4" fill="#cdeeff"/>
  <path d="M42 18 L46 3 L54 3 L58 18 Z" fill="${shade(c, -25)}"/>
  <ellipse cx="50" cy="3" rx="8" ry="2.6" fill="${shade(c, -45)}"/>
  ${eyes(56, 14, 5)}
  ${smile(68, 7)}
  <rect x="22" y="83" width="56" height="6" rx="3" fill="${shade(c, -45)}"/>
  <circle cx="30" cy="86" r="10" fill="#403d52"/>
  <circle cx="50" cy="86" r="10" fill="#403d52"/>
  <circle cx="70" cy="86" r="10" fill="#403d52"/>
  <circle cx="30" cy="86" r="4" fill="#8a869c"/>
  <circle cx="50" cy="86" r="4" fill="#8a869c"/>
  <circle cx="70" cy="86" r="4" fill="#8a869c"/>`);

add('trainSad', (c) => `
  <path d="M20 90 L36 70 L64 70 L80 90 Z" fill="${shade(c, -22)}"/>
  <rect x="20" y="36" width="60" height="38" rx="16" fill="${c}"/>
  <rect x="32" y="18" width="36" height="22" rx="6" fill="${c}"/>
  <rect x="38" y="24" width="24" height="12" rx="4" fill="#cdeeff"/>
  <path d="M42 18 L46 3 L54 3 L58 18 Z" fill="${shade(c, -25)}"/>
  <ellipse cx="50" cy="3" rx="8" ry="2.6" fill="${shade(c, -45)}"/>
  ${eyes(56, 14, 5)}
  ${sadBrows(56, 14)}
  ${frown(68, 7)}
  <rect x="22" y="83" width="56" height="6" rx="3" fill="${shade(c, -45)}"/>
  <circle cx="30" cy="86" r="10" fill="#403d52"/>
  <circle cx="50" cy="86" r="10" fill="#403d52"/>
  <circle cx="70" cy="86" r="10" fill="#403d52"/>
  <circle cx="30" cy="86" r="4" fill="#8a869c"/>
  <circle cx="50" cy="86" r="4" fill="#8a869c"/>
  <circle cx="70" cy="86" r="4" fill="#8a869c"/>`);

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
   shapes are a single group, but the car is naturally drawn as several
   separate closed loops — a body plus two wheels. Dot-to-Dot samples and
   numbers each group separately and never draws a connecting line between
   them, so a wheel doesn't get a stray line dragged across the body to
   reach it. */

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
     assumed. Three stacked, overlapping balls read as unmistakably generic.
     Drawn as ONE outline around all three (arcs meeting at the "necks")
     rather than three separate circles: separate touching loops crowded
     Dot-to-Dot's dots together wherever two balls met. */
  snowman: ['M41.32 57.98 A20 20 0 1 0 58.68 57.98 A14 14 0 0 0 54.86 33.87 '
          + 'A11 11 0 1 0 45.14 33.87 A14 14 0 0 0 41.32 57.98 Z'],
  car: [pointsToPath('10,74 10,60 26,60 36,38 64,38 74,60 90,60 90,74'),
        circlePath(28, 84, 10), circlePath(72, 84, 10)],
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

/** Props with a happy/sad sprite pair, for Spot the Difference's 'expression'
 *  mutation kind — keyed by the happy name a scene is generated with, valued
 *  by the sad twin to swap in on the mutated copy. Never picked as a starting
 *  sprite themselves, so they don't need a GROUND_PROPS/SKY_PROPS entry. */
export const EXPRESSIVE = { sun: 'sunSad', bus: 'busSad', train: 'trainSad' };

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
