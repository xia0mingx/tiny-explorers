/* Dress-Up — pick a friend, a colour, a costume and a hat; purely
   exploratory, no objective. A shuffle button randomises all four at once,
   for a child too young to browse four rows deliberately — similar in
   spirit to Pok Pok's Pawn Maker.

   Reuses the app's existing sprite-compositing pattern (a body from art.js
   plus small overlays) rather than inventing a new character system, so the
   look stays consistent with the rest of the app. See art.js for why the
   bodies are simple new shapes rather than the animal sprites: animal
   ears/features sit at wildly different heights, which would need
   per-animal tuning for an accessory to land in the right place on all of
   them. OUTFIT is the same idea one layer down — a costume overlay on the
   lower half of the body, composited the same way ACCESSORY sits on top.

   Once a child is happy with their character, "Place in a scene" swaps to a
   second view: pick a backdrop (house, park, space, beach) and drag the
   finished character around it. Nothing here is locked in — the character
   is exactly what was configured on the first screen, and "Back to
   dress-up" returns to keep changing it. Dragging reuses the same
   getScreenCTM() coordinate conversion the Drive toy uses, but with no
   easing: a placed sticker should follow the finger directly, not chase it.
*/

import { el, pick } from '../util.js';
import { spriteBody, glyph, BUDDIES, ACCESSORY, ACCESSORY_IDS, OUTFIT, OUTFIT_IDS, PALETTE } from '../art.js';
import { sfx } from '../audio.js';

const BUDDY_NAMES = { blob: 'Blob', egg: 'Egg', boxy: 'Boxy', puff: 'Puff', sparkle: 'Sparkle' };
const OUTFIT_NAMES = { none: 'Plain', shirt: 'Shirt', dress: 'Dress', overalls: 'Overalls',
                       cape: 'Cape', astronaut: 'Space suit' };
const HAT_NAMES = { none: 'None', bow: 'Bow', glasses: 'Glasses', crown: 'Crown',
                    cap: 'Cap', flower: 'Flower', partyHat: 'Party hat' };

/* Static star field for the space backdrop — generated once at module load
   rather than with Math.random() inside the render function, so the stars
   don't jump to new positions every time the backdrop markup is rebuilt. */
const STARS = Array.from({ length: 22 }, (_, i) => ({
  x: (i * 53 + 17) % 300,
  y: (i * 37 + 11) % 150,
  r: 1 + ((i * 7) % 3) * 0.5,
}));

const BACKDROPS = {
  house: () => `
    <rect width="300" height="200" fill="#fff2df"/>
    <rect y="150" width="300" height="50" fill="#e8b98a"/>
    <rect x="36" y="28" width="72" height="56" rx="8" fill="#bfe3f0" stroke="#8a869c" stroke-width="4"/>
    <path d="M72 28 V84 M36 56 H108" stroke="#8a869c" stroke-width="4"/>
    <rect x="222" y="38" width="50" height="62" rx="6" fill="#ffd7e0" stroke="#c9c2da" stroke-width="4"/>
    <ellipse cx="150" cy="180" rx="86" ry="16" fill="#ffb37a" opacity=".55"/>`,
  park: () => `
    <rect width="300" height="200" fill="#bfe8ff"/>
    <circle cx="252" cy="34" r="22" fill="#ffc93c"/>
    <ellipse cx="66" cy="36" rx="26" ry="15" fill="#fff"/>
    <ellipse cx="94" cy="30" rx="18" ry="11" fill="#fff"/>
    <rect y="150" width="300" height="50" fill="#8ee36b"/>
    <rect x="34" y="118" width="12" height="40" rx="4" fill="#a76d3f"/>
    <circle cx="40" cy="104" r="30" fill="#5fd6a4"/>`,
  space: () => `
    <rect width="300" height="200" fill="#2a2650"/>
    ${STARS.map((s) => `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="#fff" opacity=".85"/>`).join('')}
    <circle cx="232" cy="42" r="26" fill="#ffe9a8"/>
    <circle cx="244" cy="34" r="24" fill="#2a2650"/>
    <rect y="176" width="300" height="24" fill="#171433"/>`,
  beach: () => `
    <rect width="300" height="200" fill="#bfe8ff"/>
    <circle cx="248" cy="36" r="24" fill="#ffc93c"/>
    <rect y="118" width="300" height="34" fill="#5ec8d8"/>
    <path d="M0 148 Q150 130 300 148 V200 H0 Z" fill="#ffe6a0"/>`,
};
const BACKDROP_IDS = ['house', 'park', 'space', 'beach'];
const BACKDROP_NAMES = { house: 'House', park: 'Park', space: 'Space', beach: 'Beach' };

export default {
  id: 'dressup',
  title: 'Dress-Up',
  color: '#b79bff',

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="58" r="34" fill="#ffc93c"/>
      <path d="M30 24 L42 8 L50 20 L58 8 L70 24 Z" fill="#ff8fab"/>
      <circle cx="40" cy="54" r="5" fill="#403d52"/>
      <circle cx="60" cy="54" r="5" fill="#403d52"/>
    </svg>`,

  mount(ctx) {
    let body = pick(BUDDIES);
    let color = pick(PALETTE);
    let outfit = 'none';
    let hat = 'none';
    let screen = 'dress'; // 'dress' | 'scene'
    let backdrop = 'house';
    let charPos = { x: 150, y: 100 };

    // The scene view attaches its own drag listeners each time it renders;
    // this indirection lets one ctx.onCleanup registration always tear down
    // whichever set is currently live, without re-registering on every
    // render (toyShell.js runs every onCleanup it's given, so registering
    // fresh each time would pile up stale closures).
    let activeCleanup = () => {};
    ctx.onCleanup(() => activeCleanup());

    function figureMarkup(c = color) {
      return `${OUTFIT[outfit].behind()}${spriteBody(body, c)}${OUTFIT[outfit].front()}${ACCESSORY[hat]()}`;
    }

    function swatchRow(label, items, current, renderItem, onPick, nameOf = (x) => x) {
      const strip = el('div', { class: 'dressup-strip' });
      items.forEach((item) => {
        strip.append(el('button', {
          class: `dressup-swatch ${item === current ? 'active' : ''}`,
          'aria-label': nameOf(item),
          html: renderItem(item),
          onclick: () => { onPick(item); sfx('tap'); render(); },
        }));
      });
      return el('div', { class: 'dressup-row' },
        el('span', { class: 'dressup-label', text: label }), strip);
    }

    function renderDressScreen() {
      activeCleanup();
      activeCleanup = () => {};

      const stageArea = el('div', {
        class: 'dressup-stage',
        html: `<svg viewBox="0 0 100 100" class="dressup-figure">${figureMarkup()}</svg>`,
      });

      const controls = el('div', { class: 'dressup-controls' },
        swatchRow('Friend', BUDDIES, body,
          (b) => `<svg viewBox="0 0 100 100">${spriteBody(b, '#ded8ea')}</svg>`,
          (b) => { body = b; }, (b) => BUDDY_NAMES[b]),
        swatchRow('Colour', PALETTE, color,
          (c) => `<div class="dressup-color" style="background:${c}"></div>`,
          (c) => { color = c; }),
        swatchRow('Outfit', OUTFIT_IDS, outfit,
          (o) => `<svg viewBox="0 0 100 100">${o === 'none'
            ? '<circle cx="50" cy="50" r="6" fill="#d8d4e4"/>' : OUTFIT[o].behind() + OUTFIT[o].front()}</svg>`,
          (o) => { outfit = o; }, (o) => OUTFIT_NAMES[o]),
        swatchRow('Hat', ACCESSORY_IDS, hat,
          (a) => `<svg viewBox="0 0 100 100">${a === 'none'
            ? '<circle cx="50" cy="50" r="6" fill="#d8d4e4"/>' : ACCESSORY[a]()}</svg>`,
          (a) => { hat = a; }, (a) => HAT_NAMES[a]),
        el('div', { class: 'dressup-row dressup-actions' },
          el('button', {
            class: 'dressup-shuffle', 'aria-label': 'Surprise me', html: glyph.dice(),
            onclick: () => {
              body = pick(BUDDIES); color = pick(PALETTE);
              outfit = pick(OUTFIT_IDS); hat = pick(ACCESSORY_IDS);
              sfx('sparkle'); render();
            },
          }),
          el('button', {
            class: 'big-btn dressup-scene-btn', text: 'Place in a scene',
            onclick: () => { sfx('sparkle'); screen = 'scene'; render(); },
          })));

      ctx.stage.replaceChildren(el('div', { class: 'dressup-wrap' }, stageArea, controls));
    }

    function renderSceneScreen() {
      const backdropRow = el('div', { class: 'dressup-backdrop-row' });
      BACKDROP_IDS.forEach((id) => {
        backdropRow.append(el('button', {
          class: `dressup-backdrop-btn ${id === backdrop ? 'active' : ''}`,
          text: BACKDROP_NAMES[id],
          onclick: () => { backdrop = id; sfx('tap'); renderSceneScreen(); },
        }));
      });

      const sceneWrap = el('div', { class: 'dressup-scene' });
      sceneWrap.innerHTML = `<svg viewBox="0 0 300 200" class="dressup-scene-svg">
          ${BACKDROPS[backdrop]()}
          <g class="dressup-character" transform="translate(${charPos.x} ${charPos.y})">
            <svg x="-45" y="-45" width="90" height="90" viewBox="0 0 100 100">${figureMarkup()}</svg>
          </g>
        </svg>`;

      const backBtn = el('button', {
        class: 'big-btn ghost', text: 'Back to dress-up',
        onclick: () => { sfx('tap'); screen = 'dress'; render(); },
      });

      ctx.stage.replaceChildren(el('div', { class: 'dressup-scene-wrap' }, backdropRow, sceneWrap, backBtn));

      const svg = sceneWrap.querySelector('.dressup-scene-svg');
      const charEl = sceneWrap.querySelector('.dressup-character');
      let dragging = false;

      const toSvgPoint = (e) => {
        const m = svg.getScreenCTM();
        if (!m) return charPos;
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
        return { x: p.x, y: p.y };
      };

      function moveTo(p) {
        charPos = p;
        charEl.setAttribute('transform', `translate(${charPos.x} ${charPos.y})`);
      }

      function onDown(e) {
        dragging = true;
        moveTo(toSvgPoint(e));
        try { svg.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
        e.preventDefault();
      }
      function onMove(e) {
        if (!dragging) return;
        moveTo(toSvgPoint(e));
        e.preventDefault();
      }
      const onUp = () => { dragging = false; };

      svg.addEventListener('pointerdown', onDown);
      svg.addEventListener('pointermove', onMove);
      svg.addEventListener('pointerup', onUp);
      svg.addEventListener('pointercancel', onUp);
      activeCleanup = () => {
        svg.removeEventListener('pointerdown', onDown);
        svg.removeEventListener('pointermove', onMove);
        svg.removeEventListener('pointerup', onUp);
        svg.removeEventListener('pointercancel', onUp);
      };
    }

    function render() {
      if (screen === 'dress') renderDressScreen();
      else renderSceneScreen();
    }

    render();
  },
};
