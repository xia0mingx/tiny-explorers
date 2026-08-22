/* Drive — steer a car or a little train around an open scene. No road to stay
   on, no destination, no score: drag anywhere and the vehicle follows,
   easing toward your finger rather than teleporting to it so it actually
   feels driven. The dashed road across the park is pure decoration, not a
   rail — driving across the grass is just as valid as staying on it, same
   "nothing to get wrong" rule every other toy in Free Play follows.

   Steering works by chasing a moving target: onMove only updates `target`,
   and one requestAnimationFrame loop eases the vehicle's position toward it
   every frame and derives heading from the direction of that chase, so the
   car/engine visibly turns into corners instead of snapping to face them.

   The train's carriages don't get their own physics — they sample the
   engine's own recent positions from a rolling history buffer, a fixed
   number of frames back per carriage. That's the standard "follow the
   leader" trick: cheap, and it makes the carriages trace the exact path the
   engine already took rather than cutting corners toward it.
*/

import { el, pick } from '../util.js';
import { spriteBody, PALETTE, shade } from '../art.js';
import { sfx } from '../audio.js';

const EASE = 0.14;
const HISTORY_MAX = 260;
const CARRIAGE_GAP = 16; // history samples between the engine and each carriage
const STOP_THRESHOLD = 0.5;

function carBody(color) {
  return `
    <ellipse cx="0" cy="17" rx="34" ry="6" fill="#00000022"/>
    <rect x="-30" y="-14" width="60" height="24" rx="10" fill="${color}"/>
    <path d="M-13 -14 Q-5 -30 13 -30 Q25 -30 25 -14 Z" fill="${color}"/>
    <rect x="-8" y="-27" width="30" height="14" rx="4" fill="#cdeeff" opacity=".9"/>
    <circle cx="-16" cy="12" r="9" fill="#403d52"/>
    <circle cx="18" cy="12" r="9" fill="#403d52"/>
    <circle cx="-16" cy="12" r="3.4" fill="#8a869c"/>
    <circle cx="18" cy="12" r="3.4" fill="#8a869c"/>`;
}

function trainEngine(color) {
  return `
    <ellipse cx="0" cy="18" rx="30" ry="6" fill="#00000022"/>
    <rect x="-26" y="-20" width="52" height="34" rx="8" fill="${color}"/>
    <rect x="4" y="-34" width="18" height="16" rx="3" fill="${color}"/>
    <rect x="9" y="-48" width="8" height="15" rx="2" fill="#726e8a"/>
    <rect x="-20" y="-9" width="17" height="13" rx="3" fill="#cdeeff" opacity=".9"/>
    <circle cx="-15" cy="14" r="8" fill="#403d52"/>
    <circle cx="4" cy="14" r="8" fill="#403d52"/>
    <circle cx="18" cy="14" r="8" fill="#403d52"/>`;
}

function carriage(color) {
  return `
    <ellipse cx="0" cy="15" rx="24" ry="5" fill="#00000022"/>
    <rect x="-22" y="-14" width="44" height="26" rx="8" fill="${color}"/>
    <rect x="-14" y="-8" width="12" height="10" rx="2" fill="#cdeeff" opacity=".85"/>
    <rect x="2" y="-8" width="12" height="10" rx="2" fill="#cdeeff" opacity=".85"/>
    <circle cx="-13" cy="12" r="7" fill="#403d52"/>
    <circle cx="13" cy="12" r="7" fill="#403d52"/>`;
}

function sceneMarkup() {
  return `
    <rect width="300" height="200" fill="#bfe8ff"/>
    <svg x="238" y="10" width="42" height="42" viewBox="0 0 100 100">${spriteBody('sun', '#ffc93c')}</svg>
    <svg x="26" y="16" width="58" height="32" viewBox="0 0 100 100">${spriteBody('cloud')}</svg>
    <svg x="150" y="8" width="44" height="26" viewBox="0 0 100 100">${spriteBody('cloud')}</svg>
    <rect x="0" y="148" width="300" height="52" fill="#8ee36b"/>
    <path d="M0 172 Q150 138 300 172" stroke="#e8e3f2" stroke-width="20"
          fill="none" stroke-linecap="round"/>
    <path d="M0 172 Q150 138 300 172" stroke="#fff" stroke-width="3"
          stroke-dasharray="10 12" fill="none" stroke-linecap="round"/>
    <svg x="4" y="112" width="48" height="48" viewBox="0 0 100 100">${spriteBody('tree', '#5fd6a4')}</svg>
    <svg x="252" y="116" width="44" height="44" viewBox="0 0 100 100">${spriteBody('tree', '#5fd6a4')}</svg>
    <svg x="116" y="150" width="34" height="22" viewBox="0 0 100 100">${spriteBody('bush', '#5fd6a4')}</svg>`;
}

export default {
  id: 'drive',
  title: 'Drive',
  color: '#ffc93c',

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="46" width="60" height="26" rx="9" fill="#ff9770"/>
      <path d="M20 46 Q26 30 42 30 Q52 30 52 46 Z" fill="#ff9770"/>
      <rect x="24" y="34" width="22" height="12" rx="3" fill="#cdeeff"/>
      <circle cx="24" cy="74" r="9" fill="#403d52"/>
      <circle cx="56" cy="74" r="9" fill="#403d52"/>
      <rect x="70" y="54" width="20" height="18" rx="5" fill="#6cc0ff"/>
      <circle cx="76" cy="74" r="6" fill="#403d52"/>
      <circle cx="86" cy="74" r="6" fill="#403d52"/>
    </svg>`,

  mount(ctx) {
    let mode = 'car';
    let color = pick(PALETTE);
    const pos = { x: 150, y: 172 };
    const target = { x: 150, y: 172 };
    let angle = 0;
    let dragging = false;
    let rafId = null;
    const history = [];

    const toolbar = el('div', { class: 'drive-toolbar' });
    const wrap = el('div', { class: 'drive-wrap' });
    wrap.innerHTML = `<svg viewBox="0 0 300 200" class="drive-svg">${sceneMarkup()}
      <g class="drive-rig"></g></svg>`;
    ctx.stage.append(el('div', { class: 'drive-shell' }, toolbar, wrap));

    const svg = wrap.querySelector('.drive-svg');
    const rig = wrap.querySelector('.drive-rig');

    function applyTransforms() {
      const engine = rig.querySelector('.drive-engine');
      if (engine) engine.setAttribute('transform', `translate(${pos.x} ${pos.y}) rotate(${angle})`);
      rig.querySelectorAll('.drive-carriage').forEach((carEl, idx) => {
        const back = history[history.length - 1 - CARRIAGE_GAP * (idx + 1)] || history[0] || { ...pos, angle };
        carEl.setAttribute('transform', `translate(${back.x} ${back.y}) rotate(${back.angle})`);
      });
    }

    function rebuildRig() {
      history.length = 0;
      let html = `<g class="drive-engine">${mode === 'car' ? carBody(color) : trainEngine(color)}</g>`;
      if (mode === 'train') {
        html += `<g class="drive-carriage">${carriage(color)}</g>`;
        html += `<g class="drive-carriage">${carriage(shade(color, -18))}</g>`;
      }
      rig.innerHTML = html;
      applyTransforms();
    }

    function frame() {
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      pos.x += dx * EASE;
      pos.y += dy * EASE;
      if (Math.hypot(dx, dy) > STOP_THRESHOLD) angle = Math.atan2(dy, dx) * (180 / Math.PI);

      history.push({ x: pos.x, y: pos.y, angle });
      if (history.length > HISTORY_MAX) history.shift();

      applyTransforms();

      if (dragging || Math.hypot(dx, dy) > STOP_THRESHOLD) {
        rafId = requestAnimationFrame(frame);
      } else {
        rafId = null;
      }
    }

    const toSvgPoint = (e) => {
      const m = svg.getScreenCTM();
      if (!m) return { x: pos.x, y: pos.y };
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    };

    function onDown(e) {
      dragging = true;
      const p = toSvgPoint(e);
      target.x = p.x;
      target.y = p.y;
      try { svg.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
      if (!rafId) rafId = requestAnimationFrame(frame);
      e.preventDefault();
    }

    function onMove(e) {
      if (!dragging) return;
      const p = toSvgPoint(e);
      target.x = p.x;
      target.y = p.y;
      e.preventDefault();
    }

    const onUp = () => { dragging = false; };

    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);
    ctx.onCleanup(() => {
      svg.removeEventListener('pointerdown', onDown);
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerup', onUp);
      svg.removeEventListener('pointercancel', onUp);
      if (rafId) cancelAnimationFrame(rafId);
    });

    function renderToolbar() {
      const modeRow = el('div', { class: 'drive-row' },
        el('button', {
          class: `drive-mode ${mode === 'car' ? 'active' : ''}`, text: 'Car',
          onclick: () => { mode = 'car'; sfx('tap'); renderToolbar(); rebuildRig(); },
        }),
        el('button', {
          class: `drive-mode ${mode === 'train' ? 'active' : ''}`, text: 'Train',
          onclick: () => { mode = 'train'; sfx('tap'); renderToolbar(); rebuildRig(); },
        }),
        el('button', {
          class: 'drive-horn', text: 'Honk!',
          onclick: () => sfx('horn'),
        }));

      const paletteRow = el('div', { class: 'drive-row' });
      PALETTE.forEach((c) => {
        paletteRow.append(el('button', {
          class: `swatch ${c === color ? 'active' : ''}`,
          style: { background: c },
          onclick: () => { color = c; sfx('tap'); renderToolbar(); rebuildRig(); },
        }));
      });

      toolbar.replaceChildren(modeRow, paletteRow);
    }

    renderToolbar();
    rebuildRig();
  },
};
