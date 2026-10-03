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

/**
 * Call fn when a finger lifts off node — a multi-touch-proof replacement
 * for 'click', which every button in the app goes through (el()'s onclick).
 *
 * iPadOS doesn't synthesise a click for a tap made while any other touch
 * is on the screen: a toddler's palm resting on the edge, or their other
 * hand holding the iPad, silently swallows every tap they make. Pointer
 * events are per-finger, so each finger's own down/up pair is a tap here
 * no matter what else is touching the glass.
 *
 * A tap counts if the finger lifts still over the node (touch pointers are
 * implicitly captured to their pointerdown target, so a finger that slid
 * off still reports here). A scroll in a pan-y container cancels the
 * pointer, so scrolling the home grid doesn't launch a game. The native
 * click is still honoured when it has detail 0 — keyboard / switch /
 * VoiceOver activation, which has no pointer — and ignored otherwise,
 * since the pointer path already handled it (and a late click after the
 * screen re-renders would otherwise land on whatever is now under the
 * finger).
 */
export function onTap(node, fn) {
  const down = new Set();
  node.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return; // right/middle mouse button
    down.add(e.pointerId);
  });
  node.addEventListener('pointerup', (e) => {
    if (!down.delete(e.pointerId)) return;
    const r = node.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    fn(e);
  });
  node.addEventListener('pointercancel', (e) => down.delete(e.pointerId));
  node.addEventListener('click', (e) => { if (e.detail === 0) fn(e); });
}

/**
 * For drags that move ONE thing (the car, the dress-up friend, the dot-to-
 * dot band, a drawn track): decides which of the fingers on the glass that
 * thing should follow, so a resting palm or the hand holding the iPad
 * doesn't freeze or hijack it.
 *
 * The "lead" finger is the one in charge. A new touch takes the lead if
 * there isn't one, or if the current lead hasn't moved since it landed (a
 * resting palm); any other finger takes it by actually moving (> LEAD_SLOP
 * px). Only the lead's own lift ends its lead.
 *
 *   down(e) -> true if this touch just took the lead
 *   move(e) -> true if this move is from the lead (after any takeover)
 *   up(e)   -> true if the lead just lifted
 */
const LEAD_SLOP = 12;
export function leadFinger() {
  const fingers = new Map(); // pointerId -> { x, y, moved }
  let lead = null;
  return {
    get active() { return lead !== null; },
    isLead: (e) => e.pointerId === lead,
    down(e) {
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: false });
      const cur = fingers.get(lead);
      if (lead === null || !cur || !cur.moved) { lead = e.pointerId; return true; }
      return false;
    },
    move(e) {
      const f = fingers.get(e.pointerId);
      if (!f) return false;
      if (Math.hypot(e.clientX - f.x, e.clientY - f.y) > LEAD_SLOP) f.moved = true;
      if (e.pointerId !== lead) {
        if (lead !== null && !f.moved) return false;
        lead = e.pointerId;
      }
      return true;
    },
    up(e) {
      fingers.delete(e.pointerId);
      if (e.pointerId !== lead) return false;
      lead = null;
      return true;
    },
    reset() { fingers.clear(); lead = null; },
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
    else if (k === 'onclick') onTap(node, v);
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/* No svgEl() counterpart to el(): every game builds its SVG as a markup
   string and assigns it via innerHTML / el()'s `html` prop, which is far
   less verbose for the deeply-nested shapes these sprites are. An
   element-at-a-time SVG builder sat here unused for exactly that reason. */

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
