/* Drawing — a free-play canvas: no objective, no correct answer, just colour.

   Two modes share one canvas: Brush (freehand finger-paint) and Stamp (tap to
   place a cute coloured sprite, reusing the same art.js sprites the quiz
   games use so the visual language stays consistent). Nothing here calls
   ctx.win()/nudge() — there IS no win state. The only feedback is the
   drawing itself and a soft chime on Clear.

   Stamps are rasterised once per (sprite, colour) pair and cached, since
   canvas can't drawImage() raw SVG markup directly — it needs a real Image
   element, which loads asynchronously. Caching means only the very first tap
   after switching sprite or colour pays that one-frame delay.
*/

import { el, pick } from '../util.js';
import { spriteBody, PALETTE } from '../art.js';
import { sfx } from '../audio.js';

const STAMP_SPRITES = ['star', 'apple', 'balloon', 'flower', 'cupcake', 'butterfly'];
const BRUSH_SIZES = [8, 16, 28];

function svgToImage(svgMarkup, size) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">${svgMarkup}</svg>`);
  });
}

export default {
  id: 'drawing',
  title: 'Drawing',
  color: '#ff9770',

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M20 80 L70 30 L82 42 L32 92 Z" fill="#ffe0b8"/>
      <path d="M70 30 L82 18 L94 30 L82 42 Z" fill="#6cc0ff"/>
      <circle cx="24" cy="86" r="8" fill="#403d52"/>
    </svg>`,

  mount(ctx) {
    let mode = 'brush';
    let color = pick(PALETTE);
    let brushSize = BRUSH_SIZES[1];
    let stamp = STAMP_SPRITES[0];
    const stampImgCache = new Map();

    const canvas = el('canvas', { class: 'draw-canvas' });
    const toolbar = el('div', { class: 'draw-toolbar' });
    ctx.stage.append(el('div', { class: 'draw-wrap' }, toolbar, canvas));

    const g = canvas.getContext('2d');

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const prev = canvas.width ? canvas.toDataURL() : null;
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = w;
      canvas.height = h;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      if (prev) {
        const img = new Image();
        img.onload = () => g.drawImage(img, 0, 0, w, h);
        img.src = prev;
      }
    }
    // ResizeObserver (not a window 'resize' listener + one requestAnimationFrame
    // guess) because it fires whenever the CANVAS'S OWN box actually settles —
    // right after it's first laid out, and again if the toolbar's own height
    // changes between Brush/Stamp modes and shrinks/grows the space below it.
    // A single rAF right after mount can fire before layout has caught up,
    // leaving the canvas stuck at the browser's 300x150 replaced-element
    // default with the CSS box sized correctly around it.
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    ctx.onCleanup(() => ro.disconnect());

    async function stampAt(x, y) {
      const key = `${stamp}:${color}`;
      let img = stampImgCache.get(key);
      if (!img) {
        img = await svgToImage(spriteBody(stamp, color), 100);
        stampImgCache.set(key, img);
      }
      const dpr = window.devicePixelRatio || 1;
      const size = 46 * dpr;
      g.drawImage(img, x * dpr - size / 2, y * dpr - size / 2, size, size);
    }

    function dot(p) {
      const dpr = window.devicePixelRatio || 1;
      g.beginPath();
      g.fillStyle = color;
      g.arc(p.x * dpr, p.y * dpr, (brushSize / 2) * dpr, 0, Math.PI * 2);
      g.fill();
    }

    function line(a, b) {
      const dpr = window.devicePixelRatio || 1;
      g.strokeStyle = color;
      g.lineWidth = brushSize * dpr;
      g.beginPath();
      g.moveTo(a.x * dpr, a.y * dpr);
      g.lineTo(b.x * dpr, b.y * dpr);
      g.stroke();
    }

    const localPoint = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    let drawing = false;
    let last = null;

    function onDown(e) {
      drawing = true;
      const p = localPoint(e);
      last = p;
      if (mode === 'stamp') stampAt(p.x, p.y);
      else dot(p);
      e.preventDefault();
    }

    function onMove(e) {
      if (!drawing) return;
      const p = localPoint(e);
      if (mode === 'stamp') {
        // Throttle by distance so a drag stamps a trail rather than a blob.
        if (Math.hypot(p.x - last.x, p.y - last.y) > 34) { stampAt(p.x, p.y); last = p; }
      } else {
        line(last, p);
        last = p;
      }
      e.preventDefault();
    }

    const onUp = () => { drawing = false; };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    ctx.onCleanup(() => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    });

    // ── toolbar ──────────────────────────────────────────────────────────
    function renderToolbar() {
      const modeRow = el('div', { class: 'draw-row' },
        el('button', {
          class: `draw-mode ${mode === 'brush' ? 'active' : ''}`, text: 'Brush',
          onclick: () => { mode = 'brush'; sfx('tap'); renderToolbar(); },
        }),
        el('button', {
          class: `draw-mode ${mode === 'stamp' ? 'active' : ''}`, text: 'Stamp',
          onclick: () => { mode = 'stamp'; sfx('tap'); renderToolbar(); },
        }),
        el('button', {
          class: 'draw-clear', text: 'Clear',
          // Instant, no confirm: unlike the parent-gated "reset stars", this
          // only clears the child's own current doodle, nothing persisted.
          onclick: () => { g.clearRect(0, 0, canvas.width, canvas.height); sfx('sparkle'); },
        }));

      const optionsRow = el('div', { class: 'draw-row' });
      if (mode === 'brush') {
        BRUSH_SIZES.forEach((s) => {
          optionsRow.append(el('button', {
            class: `brush-size ${s === brushSize ? 'active' : ''}`,
            onclick: () => { brushSize = s; sfx('tap'); renderToolbar(); },
          }, el('span', { style: { width: `${s}px`, height: `${s}px` } })));
        });
      } else {
        STAMP_SPRITES.forEach((sId) => {
          optionsRow.append(el('button', {
            class: `stamp-choice ${sId === stamp ? 'active' : ''}`,
            html: `<svg viewBox="0 0 100 100">${spriteBody(sId, color)}</svg>`,
            onclick: () => { stamp = sId; sfx('tap'); renderToolbar(); },
          }));
        });
      }

      const paletteRow = el('div', { class: 'draw-row' });
      PALETTE.forEach((c) => {
        paletteRow.append(el('button', {
          class: `swatch ${c === color ? 'active' : ''}`,
          style: { background: c },
          onclick: () => { color = c; sfx('tap'); renderToolbar(); },
        }));
      });

      toolbar.replaceChildren(modeRow, optionsRow, paletteRow);
    }

    renderToolbar();
  },
};
