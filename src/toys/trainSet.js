/* Train Set — a birds-eye toy railway. A random closed loop of track is laid
   across a little landscape with a river and a hill, and a train chugs
   round it on its own, puffing smoke; the child just watches and plays
   with it. No objective, same as every other Free Play toy.

   Things to poke at: the colour swatches repaint the whole train, Toot!
   (or tapping the train itself) sounds the whistle with a big puff of
   smoke, the turtle/bunny switch eases it between slow and fast, + and −
   add or drop carriages full of passengers, New track lays a fresh random
   world, and Draw lets the child draw their own loop with a finger for the
   train to follow. Wherever the track crosses the river it rides over a
   bridge, and one stretch runs through a tunnel under a hill — the train
   vanishes and pops out again, peekaboo-style.

   The random track is a smooth closed curve: control points go round the
   middle of the map at roughly even angles with a random distance from
   the centre, then a closed Catmull-Rom spline through them gives one
   flowing loop that never crosses itself (every point keeps its own angle
   around the centre). A drawn track goes through the same spline after
   the finger's path is thinned out, which smooths away wobbles. The rails
   are drawn top-down with one SVG path re-stroked in layers — ballast,
   dashed sleepers, then a masked stroke that leaves only the two rail
   edges — so no offset-curve maths is needed. The train rides the same
   path via getPointAtLength(), each carriage a fixed distance behind the
   engine, heading taken from the curve's direction. Bridges and the
   tunnel are found from the track itself (where it passes over the river;
   a river-free stretch for the hill), so they work on drawn tracks too. */

import { el, pick, randInt, leadFinger } from '../util.js';
import { PALETTE, shade, spriteBody } from '../art.js';
import { sfx } from '../audio.js';

const VIEW_H = 460;            // map units along the short side; the long side follows the container
const SPEEDS = { slow: 45, fast: 135 };   // map units per second
const ENGINE_TO_FIRST = 62;    // engine centre to first carriage centre
const CARRIAGE_GAP = 54;       // carriage centre to the next carriage centre
const MIN_CARRIAGES = 1;
const MAX_CARRIAGES = 6;
const PUFF_EVERY = 0.32;       // seconds between smoke puffs
const PUFF_LIFE = 1.4;
const RIVER_W = 54;
const HILL_W = 86;
const SAMPLE_STEP = 5;         // map units between track samples used for layout

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
  return splineD(pts);
}

/** A smooth closed cubic path through `pts` (closed Catmull-Rom). */
function splineD(pts) {
  const n = pts.length;
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

/** A wavy river right across the map's long side, through its middle band
 *  so any loop round the centre has to cross it (twice — two bridges).
 *  Returned as a dense polyline; it's drawn as a thick round stroke. */
function makeRiver(w, h) {
  const across = w >= h;
  const long = across ? w : h;
  const short = across ? h : w;
  const steps = 6;
  const ctrl = [];
  let off = short * (0.4 + Math.random() * 0.2);
  for (let i = -1; i <= steps + 1; i += 1) {
    off = Math.min(short * 0.62, Math.max(short * 0.38, off + (Math.random() - 0.5) * short * 0.18));
    ctrl.push({ a: (long * i) / steps, b: off });
  }
  const pts = [];
  for (let i = 1; i < ctrl.length - 2; i += 1) {
    const [p0, p1, p2, p3] = [ctrl[i - 1], ctrl[i], ctrl[i + 1], ctrl[i + 2]];
    for (let t = 0; t < 1; t += 0.05) {
      const t2 = t * t; const t3 = t2 * t;
      const f = (k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t
        + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      const A = f('a'); const B = f('b');
      pts.push(across ? { x: A, y: B } : { x: B, y: A });
    }
  }
  return pts;
}

const polyD = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

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
  flowers: (x, y) => {
    const c = pick(['#ff8fab', '#ffc93c', '#b79bff', '#ff6b8a']);
    return [[-8, -4], [6, -7], [0, 6], [10, 5]].map(([dx, dy]) => `
      <circle cx="${x + dx}" cy="${y + dy}" r="4.5" fill="${c}"/>
      <circle cx="${x + dx}" cy="${y + dy}" r="1.8" fill="#fff6b0"/>`).join('');
  },
};
const PROP_RADIUS = { tree: 24, bush: 22, house: 32, flowers: 16 };

/** Scatter props anywhere not on (or right beside) the track and not on top
 *  of each other, inside and outside the loop alike. */
function sceneryMarkup(w, h, trackPts, riverPts) {
  const placed = [];
  const kinds = ['tree', 'tree', 'tree', 'bush', 'bush', 'house', 'house', 'flowers', 'flowers'];
  const want = Math.round((w * h) / 22000);
  for (let tries = 0; tries < want * 30 && placed.length < want; tries += 1) {
    const kind = pick(kinds);
    const rad = PROP_RADIUS[kind];
    const x = randInt(rad, Math.round(w - rad));
    const y = randInt(rad, Math.round(h - rad));
    if (trackPts.some((p) => Math.hypot(p.x - x, p.y - y) < rad + 30)) continue;
    if (riverPts.some((p) => Math.hypot(p.x - x, p.y - y) < rad + RIVER_W / 2 + 6)) continue;
    if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < rad + q.rad + 6)) continue;
    placed.push({ kind, x, y, rad });
  }
  // Flowers first so trees and houses sit on top of the grass.
  const order = { flowers: 1, bush: 2, house: 3, tree: 4 };
  return placed.sort((a, b) => order[a.kind] - order[b.kind]).map((q) => PROPS[q.kind](q.x, q.y)).join('');
}

/* ── river, bridges, tunnel ────────────────────────────────────────────── */

function riverMarkup(pts) {
  const d = polyD(pts);
  return `
    <path d="${d}" fill="none" stroke="#7cc4e8" stroke-width="${RIVER_W + 8}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#9ad8f5" stroke-width="${RIVER_W}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="14 34" opacity=".55"/>`;
}

/** A plank deck with dark side rails under each stretch of track that
 *  crosses the river, drawn between the river and the track. */
function bridgeMarkup(spans) {
  return spans.map((pts) => {
    const d = polyD(pts);
    return `
      <path d="${d}" fill="none" stroke="#00000022" stroke-width="56" transform="translate(3 5)"/>
      <path d="${d}" fill="none" stroke="#6e4f33" stroke-width="54"/>
      <path d="${d}" fill="none" stroke="#c9975f" stroke-width="44"/>
      <path d="${d}" fill="none" stroke="#a87a48" stroke-width="44" stroke-dasharray="2 10"/>`;
  }).join('');
}

/** A grassy hill laid over a stretch of track, with a stone portal at each
 *  end facing along the track. Drawn ABOVE the train, so the train simply
 *  disappears under it and reappears at the far portal. */
function tunnelMarkup(pts, ends) {
  const d = polyD(pts);
  const portal = ({ x, y, angle }) => `
    <g transform="translate(${x} ${y}) rotate(${angle})">
      <rect x="-7" y="-27" width="14" height="54" rx="6" fill="#a7a3b8"/>
      <rect x="-4" y="-19" width="8" height="38" rx="3" fill="#2b2838"/>
    </g>`;
  const mid = pts[Math.floor(pts.length / 2)];
  return `
    <path d="${d}" fill="none" stroke="#00000020" stroke-width="${HILL_W + 4}" transform="translate(4 6)"/>
    <path d="${d}" fill="none" stroke="#6dbb52" stroke-width="${HILL_W}"/>
    <path d="${d}" fill="none" stroke="#86d066" stroke-width="${HILL_W - 26}"/>
    <path d="${d}" fill="none" stroke="#9be07a" stroke-width="${HILL_W - 56}"/>
    ${PROPS.tree(mid.x, mid.y)}
    ${portal(ends[0])}${portal(ends[1])}`;
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
    let river = [];
    let trackEl = null;
    let trackLen = 1;
    let tunnel = null;       // { a, len } along the track, or null
    let s = 0;               // engine's distance along the track
    let speedMode = 'fast';
    let speed = 0;           // eases toward SPEEDS[speedMode], so changes are visible
    let puffs = [];
    let puffClock = 0;
    let rafId = null;
    let lastT = null;
    let lastAspect = 0;
    let drawing = false;     // Draw mode: the next finger stroke becomes the track
    let stroke = null;       // points of the stroke in progress
    const finger = leadFinger(); // which touch is drawing (see util.js)

    const toolbar = el('div', { class: 'drive-toolbar' });
    const wrap = el('div', { class: 'trainset-wrap' });
    wrap.innerHTML = `<svg class="trainset-svg" viewBox="0 0 ${w} ${h}">
        <rect class="trainset-grass" width="${w}" height="${h}" fill="#bfe8b0"/>
        <g class="trainset-river"></g>
        <g class="trainset-scenery"></g>
        <g class="trainset-bridges"></g>
        <g class="trainset-track"></g>
        <g class="trainset-train"></g>
        <g class="trainset-tunnel"></g>
        <g class="trainset-smoke"></g>
        <g class="trainset-draw"></g>
      </svg>`;
    ctx.toolbar.append(toolbar);
    ctx.stage.append(wrap);

    const svg = wrap.querySelector('svg');
    const $ = (sel) => svg.querySelector(sel);
    const grass = $('.trainset-grass');
    const riverG = $('.trainset-river');
    const sceneryG = $('.trainset-scenery');
    const bridgesG = $('.trainset-bridges');
    const trackG = $('.trainset-track');
    const trainG = $('.trainset-train');
    const tunnelG = $('.trainset-tunnel');
    const smokeG = $('.trainset-smoke');
    const drawG = $('.trainset-draw');

    const wrapLen = (dist) => ((dist % trackLen) + trackLen) % trackLen;
    const at = (dist) => trackEl.getPointAtLength(wrapLen(dist));
    function pose(dist) {
      const p = at(dist);
      const ahead = at(dist + 3);
      const behind = at(dist - 3);
      return { x: p.x, y: p.y, angle: (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI };
    }
    const inTunnel = (dist) => tunnel && wrapLen(dist - tunnel.a) < tunnel.len;
    const nearRiver = (p, gap) => river.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < RIVER_W / 2 + gap);

    /** Lay `d` as the track, and rebuild everything that depends on where
     *  it runs: bridges over the river, the tunnel hill, and the scenery. */
    function setTrack(d) {
      trackG.innerHTML = trackMarkup(d);
      trackEl = trackG.querySelector('path[stroke-dasharray]');
      trackLen = trackEl.getTotalLength();
      const n = Math.max(40, Math.round(trackLen / SAMPLE_STEP));
      const samples = Array.from({ length: n }, (_, i) => {
        const p = at((trackLen * i) / n);
        return { x: p.x, y: p.y, wet: nearRiver(p, 4) };
      });

      // Bridges: each unbroken run of samples over the river, padded a
      // little either side so the deck reaches onto dry land.
      const spans = [];
      let run = null;
      samples.forEach((p, i) => {
        if (p.wet) (run ||= []).push(i);
        else if (run) { spans.push(run); run = null; }
      });
      if (run) {
        if (spans.length && spans[0][0] === 0) spans[0] = [...run, ...spans[0]];
        else spans.push(run);
      }
      bridgesG.innerHTML = bridgeMarkup(spans.map((idx) => {
        const pad = 4;
        return Array.from({ length: idx.length + pad * 2 }, (_, k) => samples[(idx[0] - pad + k + n) % n]);
      }));

      // Tunnel: a random stretch about a fifth of the loop long that stays
      // well clear of the river (a hill can't sit on water).
      tunnel = null;
      tunnelG.innerHTML = '';
      const len = Math.min(220, Math.max(110, trackLen * 0.18));
      for (let tries = 0; tries < 40 && !tunnel; tries += 1) {
        const a = Math.random() * trackLen;
        const pts = [];
        for (let dd = 0; dd <= len; dd += SAMPLE_STEP) pts.push(at(a + dd));
        if (pts.some((p) => nearRiver(p, HILL_W / 2 + 6))) continue;
        tunnel = { a, len };
        tunnelG.innerHTML = tunnelMarkup(pts, [pose(a), pose(a + len)]);
      }

      sceneryG.innerHTML = sceneryMarkup(w, h, samples, river);
      s = 0;
      puffs = [];
    }

    function newWorld() {
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      grass.setAttribute('width', w);
      grass.setAttribute('height', h);
      river = makeRiver(w, h);
      riverG.innerHTML = riverMarkup(river);
      setTrack(makeTrackD(w, h));
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
      if (inTunnel(s + 19)) return; // no smoke leaking up through the hill
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
      const target = drawing ? 0 : SPEEDS[speedMode];
      speed += (target - speed) * Math.min(1, dt * 1.6);
      s += speed * dt;
      puffClock += dt * (0.4 + speed / SPEEDS.fast);
      if (puffClock >= PUFF_EVERY && !drawing) { puffClock = 0; puff(); }
      puffs = puffs.filter((p) => (p.t += dt) < PUFF_LIFE);
      placeTrain();
      drawSmoke();
      rafId = requestAnimationFrame(frame);
    }

    function toot() {
      sfx('horn');
      for (let i = 0; i < 4; i += 1) puff(true);
    }

    const toMap = (e) => {
      const m = svg.getScreenCTM();
      if (!m) return null;
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return { x: Math.min(w - 30, Math.max(30, p.x)), y: Math.min(h - 30, Math.max(30, p.y)) };
    };

    /* ── draw your own track ─────────────────────────────────────────── */

    function setDrawing(on) {
      drawing = on;
      stroke = null;
      finger.reset();
      svg.classList.toggle('drawing', on);
      drawG.innerHTML = on
        ? `<rect width="${w}" height="${h}" fill="#fff" opacity=".35"/>
           <text x="${w / 2}" y="${h / 2}" text-anchor="middle" dominant-baseline="middle"
                 font-size="34" font-weight="800" fill="#403d52" opacity=".55">Draw a big loop!</text>
           <path class="trainset-stroke" d="" fill="none" stroke="#8a6a4a" stroke-width="12"
                 stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 16"/>`
        : '';
      renderToolbar();
    }

    /** Thin the finger's path to points ~34 units apart — enough to keep
     *  the shape, few enough that the spline irons out the wobbles. */
    function thin(pts) {
      const out = [pts[0]];
      for (const p of pts) {
        if (Math.hypot(p.x - out[out.length - 1].x, p.y - out[out.length - 1].y) >= 34) out.push(p);
      }
      return out;
    }

    function finishStroke() {
      const pts = thin(stroke);
      stroke = null;
      let len = 0;
      for (let i = 1; i < pts.length; i += 1) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      // Too short to be a loop (a tap, a tiny scribble): stay in Draw mode
      // and let them try again rather than laying a silly little track.
      if (pts.length < 6 || len < 300) {
        drawG.querySelector('.trainset-stroke')?.setAttribute('d', '');
        sfx('wrong');
        return;
      }
      setTrack(splineD(pts));
      buildTrain();
      setDrawing(false);
      sfx('sparkle');
    }

    function onDown(e) {
      const p = toMap(e);
      if (!p) return;
      if (drawing) {
        e.preventDefault();
        try { svg.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
        // A touch that takes the lead (e.g. the finger after a resting
        // palm) starts the stroke afresh from where it landed.
        if (finger.down(e)) stroke = [p];
        return;
      }
      // Tapping anywhere on the train (not just the engine) toots — a
      // toddler will aim for whichever bit is closest, often a carriage.
      const parts = [pose(s), ...Array.from({ length: carriages }, (_, i) => pose(s - ENGINE_TO_FIRST - CARRIAGE_GAP * i))];
      if (parts.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 44)) toot();
    }

    function onMove(e) {
      if (!drawing || !stroke) return;
      const wasLead = finger.isLead(e);
      if (!finger.move(e)) return;
      const p = toMap(e);
      // Another finger just took over by moving: its stroke starts here.
      if (!wasLead && p) stroke = [p];
      const last = stroke[stroke.length - 1];
      if (p && Math.hypot(p.x - last.x, p.y - last.y) >= 6) {
        stroke.push(p);
        drawG.querySelector('.trainset-stroke')?.setAttribute('d', polyD(stroke));
      }
      e.preventDefault();
    }

    function onUp(e) {
      if (finger.up(e) && drawing && stroke) finishStroke();
    }

    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onUp);

    // A new map whenever the container's shape changes noticeably (first
    // layout, a rotation) so the loop always fills the screen — small
    // wobbles in size don't re-roll the track under the child.
    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const aspect = Math.min(2.6, Math.max(0.45, rect.width / rect.height));
      if (lastAspect && Math.abs(aspect / lastAspect - 1) < 0.12) return;
      lastAspect = aspect;
      // VIEW_H is the map's SHORT side, so portrait gets as roomy a loop
      // as landscape rather than a tiny, cramped one.
      if (aspect >= 1) { h = VIEW_H; w = Math.round(VIEW_H * aspect); }
      else { w = VIEW_H; h = Math.round(VIEW_H / aspect); }
      if (drawing) setDrawing(false);
      newWorld();
      buildTrain();
    });
    ro.observe(wrap);

    const icon = (sprite, c) => `<svg viewBox="0 0 100 100" aria-hidden="true">${spriteBody(sprite, c)}</svg>`;

    function renderToolbar() {
      const btn = (cls, label, onclick, content) => el('button', {
        class: cls, 'aria-label': label, onclick,
        ...(content.startsWith('<') ? { html: content } : { text: content }),
      });
      const row = el('div', { class: 'drive-row' },
        btn('drive-horn', 'Toot the whistle', toot, 'Toot!'),
        btn('drive-mode', 'Lay a new track', () => { sfx('sparkle'); if (drawing) setDrawing(false); newWorld(); buildTrain(); }, 'New track'),
        btn(`drive-mode ${drawing ? 'active' : ''}`, 'Draw your own track', () => { sfx('tap'); setDrawing(!drawing); }, 'Draw'),
        btn(`drive-mode trainset-speed ${speedMode === 'slow' ? 'active' : ''}`, 'Go slow',
          () => { speedMode = 'slow'; sfx('tap'); renderToolbar(); }, icon('turtle', '#5fd6a4')),
        btn(`drive-mode trainset-speed ${speedMode === 'fast' ? 'active' : ''}`, 'Go fast',
          () => { speedMode = 'fast'; sfx('tap'); renderToolbar(); }, icon('bunny', '#ffd7a8')),
        btn('drive-mode trainset-count', 'One less carriage', () => {
          if (carriages <= MIN_CARRIAGES) return;
          carriages -= 1; sfx('tap'); buildTrain();
        }, '−'),
        btn('drive-mode trainset-count', 'One more carriage', () => {
          if (carriages >= MAX_CARRIAGES) return;
          carriages += 1; sfx('tap'); buildTrain();
        }, '+'));

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
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerup', onUp);
      svg.removeEventListener('pointercancel', onUp);
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
    });

    renderToolbar();
    newWorld();
    buildTrain();
    rafId = requestAnimationFrame(frame);
  },
};
