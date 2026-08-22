/* Dress-Up — pick a friend, a colour, and an accessory; purely exploratory,
   no objective. A shuffle button randomises all three at once, for a child
   too young to browse three rows deliberately — similar in spirit to Pok
   Pok's Pawn Maker.

   Reuses the app's existing sprite-compositing pattern (a body from art.js
   plus a small accessory overlay) rather than inventing a new character
   system, so the look stays consistent with the rest of the app. See art.js
   for why the bodies are new simple shapes (blob/egg/boxy) rather than the
   animal sprites: animal ears/features sit at wildly different heights,
   which would need per-animal tuning for an accessory to land in the right
   place on all of them.
*/

import { el, pick } from '../util.js';
import { spriteBody, glyph, BUDDIES, ACCESSORY, ACCESSORY_IDS, PALETTE } from '../art.js';
import { sfx } from '../audio.js';

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
    let accessory = 'none';

    const stageArea = el('div', { class: 'dressup-stage' });
    const controls = el('div', { class: 'dressup-controls' });
    ctx.stage.append(el('div', { class: 'dressup-wrap' }, stageArea, controls));

    function swatchRow(label, items, current, renderItem, onPick) {
      const strip = el('div', { class: 'dressup-strip' });
      items.forEach((item) => {
        strip.append(el('button', {
          class: `dressup-swatch ${item === current ? 'active' : ''}`,
          html: renderItem(item),
          onclick: () => { onPick(item); sfx('tap'); renderAll(); },
        }));
      });
      return el('div', { class: 'dressup-row' },
        el('span', { class: 'dressup-label', text: label }), strip);
    }

    function renderAll() {
      stageArea.innerHTML = `<svg viewBox="0 0 100 100" class="dressup-figure">
          ${spriteBody(body, color)}${ACCESSORY[accessory]()}
        </svg>`;

      controls.replaceChildren(
        swatchRow('Friend', BUDDIES, body,
          (b) => `<svg viewBox="0 0 100 100">${spriteBody(b, '#ded8ea')}</svg>`,
          (b) => { body = b; }),
        swatchRow('Colour', PALETTE, color,
          (c) => `<div class="dressup-color" style="background:${c}"></div>`,
          (c) => { color = c; }),
        swatchRow('Accessory', ACCESSORY_IDS, accessory,
          (a) => `<svg viewBox="0 0 100 100">${a === 'none'
            ? '<circle cx="50" cy="50" r="6" fill="#d8d4e4"/>' : ACCESSORY[a]()}</svg>`,
          (a) => { accessory = a; }),
        el('button', {
          class: 'dressup-shuffle', 'aria-label': 'Surprise me', html: glyph.dice(),
          onclick: () => {
            body = pick(BUDDIES); color = pick(PALETTE); accessory = pick(ACCESSORY_IDS);
            sfx('sparkle'); renderAll();
          },
        }));
    }

    renderAll();
  },
};
