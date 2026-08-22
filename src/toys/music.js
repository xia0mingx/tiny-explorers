/* Music Maker — a tiny step sequencer. Rows are a pentatonic scale, so ANY
   combination a child taps sounds pleasant together — there is no wrong
   note, which is the app's no-fail-state philosophy expressed musically
   instead of visually.

   Tapping a cell both toggles it and previews the note immediately, so
   exploring sounds works even with the transport stopped. Play loops through
   the 8 steps at a fixed tempo, lighting whichever cells are on as the
   playhead crosses them.
*/

import { el } from '../util.js';
import { PALETTE } from '../art.js';
import { playTone, PENTATONIC } from '../audio.js';

const STEPS = 8;
const ROW_COLORS = [PALETTE[0], PALETTE[2], PALETTE[3], PALETTE[6], PALETTE[4]];
const STEP_MS = 420;

const PLAY_ICON = `<svg viewBox="0 0 100 100" aria-hidden="true">
    <polygon points="30,20 30,80 80,50" fill="#403d52"/></svg>`;
const PAUSE_ICON = `<svg viewBox="0 0 100 100" aria-hidden="true">
    <rect x="26" y="20" width="18" height="60" rx="6" fill="#403d52"/>
    <rect x="56" y="20" width="18" height="60" rx="6" fill="#403d52"/></svg>`;

export default {
  id: 'music',
  title: 'Music Maker',
  color: '#5ec8d8',

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <rect x="10" y="60" width="16" height="30" rx="6" fill="#ff8fab"/>
      <rect x="32" y="40" width="16" height="50" rx="6" fill="#ffc93c"/>
      <rect x="54" y="52" width="16" height="38" rx="6" fill="#5fd6a4"/>
      <rect x="76" y="30" width="16" height="60" rx="6" fill="#6cc0ff"/>
    </svg>`,

  mount(ctx) {
    const grid = PENTATONIC.map(() => Array(STEPS).fill(false));
    const cellEls = [];
    let playing = false;
    let stepIdx = 0;
    let timer = null;

    const gridEl = el('div', { class: 'music-grid' });
    const transport = el('div', { class: 'music-transport' });
    ctx.stage.append(el('div', { class: 'music-wrap' }, gridEl, transport));

    const playBtn = el('button', {
      class: 'music-play', 'aria-label': 'Play', html: PLAY_ICON,
      onclick: () => (playing ? stop() : play()),
    });
    const clearBtn = el('button', {
      class: 'music-clear', text: 'Clear',
      onclick: () => {
        grid.forEach((row) => row.fill(false));
        cellEls.forEach((row) => row.forEach((c) => c.classList.remove('on')));
      },
    });
    transport.append(playBtn, clearBtn);

    PENTATONIC.forEach((freq, r) => {
      const row = el('div', { class: 'music-row' });
      cellEls[r] = [];
      for (let c = 0; c < STEPS; c++) {
        const cell = el('button', {
          class: 'music-cell',
          style: { '--cell-color': ROW_COLORS[r] },
          onclick: () => {
            grid[r][c] = !grid[r][c];
            cell.classList.toggle('on', grid[r][c]);
            if (grid[r][c]) playTone(freq, 0.3);
          },
        });
        cellEls[r][c] = cell;
        row.append(cell);
      }
      gridEl.append(row);
    });

    function tick() {
      cellEls.forEach((row) => row.forEach((c) => c.classList.remove('playhead')));
      PENTATONIC.forEach((freq, r) => {
        cellEls[r][stepIdx].classList.add('playhead');
        if (grid[r][stepIdx]) playTone(freq, 0.32);
      });
      stepIdx = (stepIdx + 1) % STEPS;
    }

    function play() {
      playing = true;
      stepIdx = 0;
      tick();
      timer = setInterval(tick, STEP_MS);
      playBtn.innerHTML = PAUSE_ICON;
    }

    function stop() {
      playing = false;
      if (timer) { clearInterval(timer); timer = null; }
      cellEls.forEach((row) => row.forEach((c) => c.classList.remove('playhead')));
      playBtn.innerHTML = PLAY_ICON;
    }

    ctx.onCleanup(() => { if (timer) clearInterval(timer); });
  },
};
