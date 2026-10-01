/* Train Set — a birds-eye toy railway. A random closed loop of track is laid
   across a little landscape and a train chugs round it on its own, puffing
   smoke; the child just watches and plays with it. No objective, same as
   every other Free Play toy.

   Things to poke at: the colour swatches repaint the whole train, Toot!
   (or tapping the train itself) sounds the whistle with a big puff of
   smoke, + and − add or drop carriages full of passengers, and New track
   lays a fresh random loop with new scenery.

   The track is a smooth closed curve: control points go round the middle
   of the map at roughly even angles with a random distance from the
   centre, then a closed Catmull-Rom spline through them gives one flowing
   loop that never crosses itself (every point keeps its own angle around
   the centre). The rails are drawn top-down with one SVG path re-stroked
   in layers — ballast, dashed sleepers, then a masked stroke that leaves
   only the two rail edges — so no offset-curve maths is needed. The train
   rides the same path via getPointAtLength(), each carriage a fixed
   distance behind the engine, heading taken from the curve's direction. */

import { el, pick, randInt } from '../util.js';
import { PALETTE, shade } from '../art.js';
import { sfx } from '../audio.js';

const VIEW_H = 460;            // map units tall; width follows the container's shape
const SPEED = 95;              // map units per second
const ENGINE_TO_FIRST = 62;    // engine centre to first carriage centre
const CARRIAGE_GAP = 54;       // carriage centre to the next carriage centre
const MIN_CARRIAGES = 1;
const MAX_CARRIAGES = 6;
const PUFF_EVERY = 0.32;       // seconds between smoke puffs
const PUFF_LIFE = 1.4;

const SKINS = ['#ffd9b8', '#f2b88a', '#c98d5f', '#8d5a3b'];
const HAIRS = ['#403d52', '#7a4a2a', '#e8b84a', '#c0502b'];
const makePerson = () => ({ skin: pick(SKINS), hair: pick(HAIRS), shirt: pick(PALETTE) });

/* ── track ─────────────────────────────────────────────────────────────── */

/** A closed, non-self-crossing loop through randomly pushed-out control
 *  points, as a smooth cubic path `d`. Neighbouring points' distance from
 *  the centre is kept close so the curve has no hairpin bends a train
 *  couldn't believably take. */
function makeTrackD(w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 80;
  const ry = h / 2 - 80;
  const n = randInt(8, 11);
  const pts = [];
  let r = 0.8;
  for (let i = 0; i < n; i += 1) {
    const a = ((i + (Math.random() - 0.5) * 0.5) / n) * Math.PI * 2;
    r = Math.min(1, Math.max(0.55, r + (Math.random() - 0.5) * 0.4));
    pts.push({ x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * r });
  }
  const P = (i) => pts[(i + n) % n];
  let d = `M${P(0).x.toFixed(1)} ${P(0).y.toFixed(1)}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = P(i - 1); const p1 = P(i); const p2 = P(i + 1); const p3 = P(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return `${d} Z`;
}

function trackMarkup(d) {
  return `
    <defs>
      <mask id="trainset-rails" maskUnits="userSpaceOnUse">
        <path d="${d}" fill="none" stroke="#fff" stroke-width="18"/>
        <path d="${d}" fill="none" stroke="#000" stroke-width="12"/>
      </mask>
    </defs>
    <path d="${d}" fill="none" stroke="#d8cdb2" stroke-width="34" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#8a6a4a" stroke-width="28" stroke-dasharray="6 9"/>
    <path d="${d}" fill="none" stroke="#5b5770" stroke-width="18" mask="url(#trainset-rails)"/>`;
}

/* ── scenery ───────────────────────────────────────────────────────────── */

const PROPS = {
  tree: (x, y) => `
    <circle cx="${x + 3}" cy="${y + 4}" r="20" fill="#00000018"/>
    <circle cx="${x}" cy="${y}" r="20" fill="#5fd6a4"/>
    <circle cx="${x - 6}" cy="${y - 6}" r="9" fill="#8ee36b" opacity=".75"/>`,
  bush: (x, y) => `
    <circle cx="${x - 9}" cy="${y + 2}" r="10" fill="#4fc28e"/>
    <circle cx="${x + 8}" cy="${y + 3}" r="9" fill="#4fc28e"/>
    <circle cx="${x}" cy="${y - 4}" r="11" fill="#5fd6a4"/>`,
  house: (x, y) => {
    const c = pick(['#ffb3c6', '#ffd7a8', '#a9cdff', '#c9b8f2', '#ffe6a0']);
    return `
      <rect x="${x - 22}" y="${y - 18}" width="48" height="40" rx="6" fill="#00000018"/>
      <rect x="${x - 24}" y="${y - 20}" width="48" height="40" rx="6" fill="${c}"/>
      <rect x="${x - 24}" y="${y - 20}" width="24" height="40" rx="6" fill="${shade(c, -22)}"/>
      <rect x="${x - 5}" y="${y - 20}" width="10" height="40" fill="${shade(c, -10)}"/>`;
  },
  pond: (x, y) => `
    <ellipse cx="${x}" cy="${y}" rx="34" ry="22" fill="#8fd3f4"/>
    <ellipse cx="${x - 8}" cy="${y - 6}" rx="12" ry="5" fill="#fff" opacity=".45"/>`,
  flowers: (x, y) => {
    const c = pick(['#ff8fab', '#ffc93c', '#b79bff', '#ff6b8a']);
    return [[-8, -4], [6, -7], [0, 6], [10, 5]].map(([dx, dy]) => `
      <circle cx="${x + dx}" cy="${y + dy}" r="4.5" fill="${c}"/>
      <circle cx="${x + dx}" cy="${y + dy}" r="1.8" fill="#fff6b0"/>`).join('');
  },
};
const PROP_RADIUS = { tree: 24, bush: 22, house: 32, pond: 38, flowers: 16 };

/** Scatter props anywhere not on (or right beside) the track and not on top
 *  of each other, inside and outside the loop alike. */
function sceneryMarkup(w, h, trackPts) {
  const placed = [];
  const kinds = ['tree', 'tree', 'tree', 'bush', 'bush', 'house', 'house', 'pond', 'flowers', 'flowers'];
  const want = Math.round((w * h) / 22000);
  for (let tries = 0; tries < want * 30 && placed.length < want; tries += 1) {
    const kind = pick(kinds);
    const rad = PROP_RADIUS[kind];
    const x = randInt(rad, Math.round(w - rad));
    const y = randInt(rad, Math.round(h - rad));
    if (trackPts.some((p) => Math.hypot(p.x - x, p.y - y) < rad + 30)) continue;
    if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < rad + q.rad + 6)) continue;
    if (kind === 'pond' && placed.some((q) => q.kind === 'pond')) continue;
    placed.push({ kind, x, y, rad });
  }
  // Ponds and flowers first so trees and houses sit on top of the grass.
  const order = { pond: 0, flowers: 1, bush: 2, house: 3, tree: 4 };
  return placed.sort((a, b) => order[a.kind] - order[b.kind]).map((q) => PROPS[q.kind](q.x, q.y)).join('');
}

/* ── train (drawn facing +x, centred on 0,0) ───────────────────────────── */

function head(x, y, p, r = 6.5) {
  // Seen from above: shoulders, then the head with hair covering all but a
  // sliver of face at the front, so everyone visibly faces the way they ride.
  return `
    <ellipse cx="${x - 2}" cy="${y}" rx="5" ry="${r + 2}" fill="${p.shirt}"/>
    <circle cx="${x}" cy="${y}" r="${r}" fill="${p.skin}"/>
    <circle cx="${x - 1.8}" cy="${y}" r="${r - 0.4}" fill="${p.hair}"/>`;
}

function engineMarkup(color, driver) {
  return `
    <rect x="-29" y="-12" width="64" height="30" rx="12" fill="#00000022"/>
    <path d="M32 -12 L41 0 L32 12 Z" fill="${shade(color, -45)}"/>
    <rect x="-32" y="-15" width="64" height="30" rx="12" fill="${color}"/>
    <rect x="-6" y="-11" width="36" height="22" rx="11" fill="${shade(color, 22)}"/>
    <rect x="-32" y="-15" width="26" height="30" rx="8" fill="${shade(color, -28)}"/>
    ${head(-19, 0, driver, 6)}
    <circle cx="5" cy="0" r="4.5" fill="#ffd449"/>
    <circle cx="19" cy="0" r="6.5" fill="#403d52"/>
    <circle cx="19" cy="0" r="3.2" fill="#22202e"/>
    <circle cx="31" cy="0" r="3.4" fill="#fff6b0"/>`;
}

function carriageMarkup(color, people) {
  return `
    <rect x="-21" y="-11" width="48" height="28" rx="8" fill="#00000022"/>
    <rect x="-28" y="-2" width="6" height="4" fill="#403d52"/>
    <rect x="-24" y="-14" width="48" height="28" rx="8" fill="${color}"/>
    <rect x="-20" y="-10" width="40" height="20" rx="5" fill="${shade(color, 34)}"/>
    ${head(-8, 0, people[0])}
    ${head(10, 0, people[1])}`;
}

export default {
  id: 'train-set',
  title: 'Train Set',
  color: '#ff9770',

  icon: () => `<svg viewBox="0 0 100 100" aria-hidden="true">
      <ellipse cx="50" cy="50" rx="40" ry="30" fill="none" stroke="#d8cdb2" stroke-width="14"/>
      <ellipse cx="50" cy="50" rx="40" ry="30" fill="none" stroke="#8a6a4a" stroke-width="12" stroke-dasharray="3 5"/>
      <ellipse cx="50" cy="50" rx="43" ry="33" fill="none" stroke="#5b5770" stroke-width="2"/>
      <ellipse cx="50" cy="50" rx="37" ry="27" fill="none" stroke="#5b5770" stroke-width="2"/>
      <rect x="34" y="12" width="30" height="16" rx="6" fill="#ff9770"/>
      <circle cx="55" cy="20" r="4" fill="#403d52"/>
      <rect x="14" y="16" width="18" height="14" rx="4" fill="#6cc0ff" transform="rotate(-25 23 23)"/>
    </svg>`,

  mount(ctx) {
    let color = pick(PALETTE);
    let carriages = 3;
    const crew = {
      driver: makePerson(),
      riders: Array.from({ length: MAX_CARRIAGES }, () => [makePerson(), makePerson()]),
    };
    let w = VIEW_H * 1.6;
    let h = VIEW_H;
    let trackEl = null;
    let trackLen = 1;
    let s = 0;               // engine's distance along the track
    let puffs = [];
    let puffClock = 0;
    let rafId = null;
    let lastT = null;
    let lastAspect = 0;

    const toolbar = el('div', { class: 'drive-toolbar' });
    const wrap = el('div', { class: 'trainset-wrap' });
    wrap.innerHTML = `<svg class="trainset-svg" viewBox="0 0 ${w} ${h}">
        <rect class="trainset-grass" width="${w}" height="${h}" fill="#bfe8b0"/>
        <g class="trainset-scenery"></g>
        <g class="trainset-track"></g>
        <g class="trainset-train"></g>
        <g class="trainset-smoke"></g>
      </svg>`;
    ctx.toolbar.append(toolbar);
    ctx.stage.append(wrap);

    const svg = wrap.querySelector('svg');
    const grass = svg.querySelector('.trainset-grass');
    const sceneryG = svg.querySelector('.trainset-scenery');
    const trackG = svg.querySelector('.trainset-track');
    const trainG = svg.querySelector('.trainset-train');
    const smokeG = svg.querySelector('.trainset-smoke');

    const at = (dist) => trackEl.getPointAtLength(((dist % trackLen) + trackLen) % trackLen);
    function pose(dist) {
      const p = at(dist);
      const ahead = at(dist + 3);
      const behind = at(dist - 3);
      return { x: p.x, y: p.y, angle: (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI };
    }

    function layTrack() {
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      grass.setAttribute('width', w);
      grass.setAttribute('height', h);
      const d = makeTrackD(w, h);
      trackG.innerHTML = trackMarkup(d);
      trackEl = trackG.querySelector('path[stroke-dasharray]');
      trackLen = trackEl.getTotalLength();
      const samples = Array.from({ length: 160 }, (_, i) => at((trackLen * i) / 160));
      sceneryG.innerHTML = sceneryMarkup(w, h, samples);
      s = 0;
      puffs = [];
    }

    function buildTrain() {
      let html = '';
      // Last carriage first so the engine draws on top of the whole train.
      for (let i = carriages - 1; i >= 0; i -= 1) {
        html += `<g class="trainset-car" data-i="${i}">${carriageMarkup(i % 2 ? shade(color, -16) : color, crew.riders[i])}</g>`;
      }
      html += `<g class="trainset-engine">${engineMarkup(color, crew.driver)}</g>`;
      trainG.innerHTML = html;
      placeTrain();
    }

    function placeTrain() {
      const e = pose(s);
      trainG.querySelector('.trainset-engine')
        ?.setAttribute('transform', `translate(${e.x} ${e.y}) rotate(${e.angle})`);
      trainG.querySelectorAll('.trainset-car').forEach((g) => {
        const i = Number(g.dataset.i);
        const c = pose(s - ENGINE_TO_FIRST - CARRIAGE_GAP * i);
        g.setAttribute('transform', `translate(${c.x} ${c.y}) rotate(${c.angle})`);
      });
    }

    /** Where the chimney is right now, in map units (it sits 19 units ahead
     *  of the engine's centre, along its heading). */
    function chimney() {
      const e = pose(s);
      const rad = (e.angle * Math.PI) / 180;
      return { x: e.x + Math.cos(rad) * 19, y: e.y + Math.sin(rad) * 19 };
    }

    function puff(big = false) {
      const c = chimney();
      puffs.push({ x: c.x, y: c.y, t: 0, big, dx: (Math.random() - 0.5) * 10, dy: (Math.random() - 0.5) * 10 });
    }

    function drawSmoke() {
      smokeG.innerHTML = puffs.map((p) => {
        const k = p.t / PUFF_LIFE;
        const r = (p.big ? 9 : 5) + k * (p.big ? 26 : 15);
        return `<circle cx="${p.x + p.dx * k}" cy="${p.y + p.dy * k}" r="${r}" fill="#fff" opacity="${(0.75 * (1 - k)).toFixed(3)}"/>`;
      }).join('');
    }

    function frame(t) {
      const dt = lastT === null ? 0 : Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      s += SPEED * dt;
      puffClock += dt;
      if (puffClock >= PUFF_EVERY) { puffClock = 0; puff(); }
      puffs = puffs.filter((p) => (p.t += dt) < PUFF_LIFE);
      placeTrain();
      drawSmoke();
      rafId = requestAnimationFrame(frame);
    }

    function toot() {
      sfx('horn');
      for (let i = 0; i < 4; i += 1) puff(true);
    }

    // Tapping anywhere on the train (not just the engine) toots — a toddler
    // will aim for whichever bit is closest, often a carriage.
    function onDown(e) {
      const m = svg.getScreenCTM();
      if (!m) return;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      const parts = [pose(s), ...Array.from({ length: carriages }, (_, i) => pose(s - ENGINE_TO_FIRST - CARRIAGE_GAP * i))];
      if (parts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 44)) toot();
    }
    svg.addEventListener('pointerdown', onDown);

    // A new map whenever the container's shape changes noticeably (first
    // layout, a rotation) so the loop always fills the screen — small
    // wobbles in size don't re-roll the track under the child.
    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const aspect = Math.min(2.6, Math.max(0.45, rect.width / rect.height));
      if (lastAspect && Math.abs(aspect / lastAspect - 1) < 0.12) return;
      lastAspect = aspect;
      h = VIEW_H;
      w = Math.round(VIEW_H * aspect);
      layTrack();
      buildTrain();
    });
    ro.observe(wrap);

    function renderToolbar() {
      const btn = (cls, text, label, onclick) => el('button', { class: cls, text, 'aria-label': label, onclick });
      const row = el('div', { class: 'drive-row' },
        btn('drive-horn', 'Toot!', 'Toot the whistle', toot),
        btn('drive-mode', 'New track', 'Lay a new track', () => { sfx('sparkle'); layTrack(); buildTrain(); }),
        btn('drive-mode trainset-count', '−', 'One less carriage', () => {
          if (carriages <= MIN_CARRIAGES) return;
          carriages -= 1; sfx('tap'); buildTrain();
        }),
        btn('drive-mode trainset-count', '+', 'One more carriage', () => {
          if (carriages >= MAX_CARRIAGES) return;
          carriages += 1; sfx('tap'); buildTrain();
        }));

      PALETTE.forEach((c) => {
        row.append(el('button', {
          class: `swatch ${c === color ? 'active' : ''}`,
          style: { background: c },
          'aria-label': 'Train colour',
          onclick: () => { color = c; sfx('tap'); renderToolbar(); buildTrain(); },
        }));
      });
      toolbar.replaceChildren(row);
    }

    ctx.onCleanup(() => {
      svg.removeEventListener('pointerdown', onDown);
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
    });

    renderToolbar();
    layTrack();
    buildTrain();
    rafId = requestAnimationFrame(frame);
  },
};
