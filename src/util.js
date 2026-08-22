/** Tiny helpers shared by every game. */

export const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const range = (n) => Array.from({ length: n }, (_, i) => i);

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** `count` distinct members of `arr`, in random order. */
export const sample = (arr, count) => shuffle(arr).slice(0, count);

/** Like sample(), but guarantees `must` is included (used to place the right
 *  answer among distractors without ever duplicating it). */
export function sampleWith(arr, count, must) {
  const rest = sample(arr.filter((x) => x !== must), count - 1);
  return shuffle([must, ...rest]);
}

/** Returns a `next()` function that dispenses items from `items` in shuffled
 *  order with no repeats, reshuffling once the deck runs out. Swaps the new
 *  deck's first card away from whatever was just drawn, so a reshuffle can
 *  never hand back the same item twice in a row. Used anywhere a pick() would
 *  otherwise let the same round/shape come up several times in a short
 *  session, which reads as "broken" to a child even though it's just chance. */
export function noRepeatPicker(items) {
  let deck = [];
  let last = null;
  return function next() {
    if (deck.length === 0) {
      deck = shuffle(items);
      if (deck.length > 1 && deck[0] === last) [deck[0], deck[1]] = [deck[1], deck[0]];
    }
    last = deck.pop();
    return last;
  };
}

/** Build a DOM element in one call: el('div', {class:'x', onclick:fn}, child...) */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Same as el(), for SVG's namespace. */
export function svgEl(tag, props = {}, ...children) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) node.append(c);
  return node;
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
