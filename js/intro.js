/* intro.js - the opening sequence for index.html.
 *
 * Phases: home (fae + magic circle) -> pulse -> zoom into hole 1 -> four dialog bubbles (the circle turns a quarter
 * each time) -> circle settles in the middle -> air, fire, water, earth appear -> choose one -> it engulfs the screen
 * -> game.html.
 *
 * One "camera" object C drives the circle: centre (cx, cy), scale s, spin rot, plus the angles of the hole ring and
 * the two decoration rings. The holes sit at hole angle = rot + ring + i*90 (clockwise from north). Hole i is
 * air, water, earth, fire for i = 0..3, so when rot + ring is a multiple of 360 they are north, east, south, west.
 * This page is standalone: it does not load the game's FE modules, so it never touches the game's save hash.
 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const ids = ['air', 'water', 'earth', 'fire'];            // hole order, clockwise from north
const OUT = 96, HOLE_R = 47, HOLE_RAD = 15;                // circle units: outer radius, hole orbit radius, hole radius
const LINES = ['...Huh?', 'What... happened...?', 'Where am I?', 'What... is this...?'];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
let aborted = false;
const wait = ms => new Promise(r => setTimeout(() => { if (!aborted) r(); }, ms));

// ---- easing ----
function bez(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t, dX = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) { const d = X(t) - x; if (Math.abs(d) < 1e-5) break; const s = dX(t); if (Math.abs(s) < 1e-6) break; t -= d / s; }
    if (t < 0 || t > 1) { let lo = 0, hi = 1; t = x; for (let i = 0; i < 24; i++) { if (X(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
    return Y(t);
  };
}
const easeIO = bez(.65, 0, .35, 1);
const easeOut = p => 1 - Math.pow(1 - p, 3);
const easeIn = p => p * p;

function tween(ms, fn) {
  return new Promise(res => {
    const t0 = performance.now();
    const step = now => {
      if (aborted) return;                                  // never resolves: the sequence just stops
      const p = Math.min(1, (now - t0) / ms);
      fn(p);
      if (p < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}

// ---- colours (read from the game's CSS, so light and dark mode match) ----
const mq = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => { const t = document.documentElement.dataset.theme; return t === 'dark' || (t !== 'light' && mq.matches); };
const PAL = {};
function readPal() {
  const cs = getComputedStyle(document.documentElement);
  ids.forEach(id => { PAL[id] = cs.getPropertyValue('--' + id).trim(); PAL[id + 'I'] = cs.getPropertyValue('--' + id + '-ink').trim() || PAL[id]; });
}
const pc = id => isDark() ? PAL[id] : PAL[id + 'I'];
const rgbOf = c => {
  c = String(c).trim();
  if (c[0] === '#') { if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  const m = c.match(/\d+(\.\d+)?/g); return m ? m.slice(0, 3).map(Number) : [255, 255, 255];
};
const rgba = (c, a) => { const [r, g, b] = rgbOf(c); return `rgba(${r},${g},${b},${a})`; };
const mix = (c, f) => { const t = f > 0 ? 255 : 0, k = Math.abs(f); return '#' + rgbOf(c).map(v => Math.round(lerp(v, t, k)).toString(16).padStart(2, '0')).join(''); };
const hs = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };   // stable pseudo-random

// ---- screen, canvases ----
let W = innerWidth, H = innerHeight, dpr = 1;
const faeC = $('fae'), fxC = $('fx'), flC = $('flood');
const fa = faeC.getContext('2d'), fc = fxC.getContext('2d'), fl = flC.getContext('2d');

// ---- the camera ----
const C = { cx: 0, cy: 0, s: 1, rot: 0, ring: 0, d1: 0, d2: 0, hover: 0, breath: 1, boost: 0 };
const homeR = () => clamp(Math.min(W, H) * 0.2, 100, 150);
const poseHome = () => ({ cx: W / 2, cy: H * 0.6, s: homeR() / OUT });
const poseZoom = () => ({ cx: 0, cy: 0, s: Math.hypot(W / 2, H / 2) / HOLE_R });
const poseCenter = () => { const R = Math.min(W * 0.42, H * 0.36); return { cx: W / 2, cy: H / 2, s: R / OUT }; };
const poseChoose = () => { const p = poseCenter(); p.cy += H * 0.06; return p; };
const zoomAngle = () => Math.atan2(W / 2, -H / 2) * 180 / Math.PI;     // direction from the top-left corner to the screen centre
const zoomRot = i => { const base = zoomAngle() - C.ring - i * 90; return base + 360 * Math.round((C.rot - base) / 360); };
let curHole = 0, rest = null, phase = 'home';
const setRest = fn => { rest = fn; Object.assign(C, fn()); };
const holePos = (i, c = C) => { const a = (c.rot + c.ring + i * 90) * Math.PI / 180; return { x: c.cx + c.s * HOLE_R * Math.sin(a), y: c.cy - c.s * HOLE_R * Math.cos(a) }; };

async function move({ to, rot, ms, ease, rotEase }) {
  rest = null;
  const f = { cx: C.cx, cy: C.cy, s: C.s, rot: C.rot };
  await tween(ms, p => {
    const t = to(), e = ease(p);
    C.cx = lerp(f.cx, t.cx, e); C.cy = lerp(f.cy, t.cy, e); C.s = f.s * Math.pow(t.s / f.s, e);
    if (rot != null) C.rot = lerp(f.rot, rot, (rotEase || ease)(p));
  });
  Object.assign(C, to());
  if (rot != null) C.rot = rot;
}

// ---- the magic circle (SVG, drawn in circle units under one camera group so lines stay crisp at any zoom) ----
const svg = $('sigil'), NS = 'http://www.w3.org/2000/svg';
const S = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const pol = (a, r) => [Math.sin(a) * r, -Math.cos(a) * r];
const f2 = n => n.toFixed(2);
const defs = S('defs', {}, svg);
const sg = S('linearGradient', { id: 'sg', gradientUnits: 'userSpaceOnUse', x1: -OUT, y1: -OUT, x2: OUT, y2: OUT }, defs);
ids.forEach((id, k) => S('stop', { offset: k / 3, style: `stop-color:var(--${id}-ink)` }, sg));
const au = S('radialGradient', { id: 'aura' }, defs);
[[.6, 0], [.74, .3], [1, 0]].forEach(([o, a]) => S('stop', { offset: o, style: 'stop-color:var(--water-ink)', 'stop-opacity': a }, au));
ids.forEach(id => {
  const g = S('radialGradient', { id: 'hg-' + id }, defs);
  S('stop', { offset: .45, style: `stop-color:var(--${id}-ink)`, 'stop-opacity': 0 }, g);
  S('stop', { offset: 1, style: `stop-color:var(--${id}-ink)`, 'stop-opacity': .45 }, g);
});
const cam = S('g', {}, svg);
const aura = S('circle', { r: 130, fill: 'url(#aura)' }, cam);
S('circle', { r: OUT + 1, class: 'disc' }, cam);
const glows = [];
function layer() { const g = S('g', {}, cam), gg = S('g', {}, g), cg = S('g', {}, g); glows.push(gg); return { g, gg, cg }; }
function add(L, tag, attrs, w) {
  S(tag, Object.assign({ class: 'gl', 'stroke-width': w * 4.5 }, attrs), L.gg);   // wide faint copy = the glow
  S(tag, Object.assign({ class: 'ln', 'stroke-width': w }, attrs), L.cg);
}
const circ = (L, r, w, x) => add(L, 'circle', Object.assign({ r }, x || {}), w);
const pth = (L, d, w, x) => add(L, 'path', Object.assign({ d }, x || {}), w);

// outer rings (still)
const L0 = layer(); circ(L0, 96, .9); circ(L0, 93, .3);
// tick band and rune band (turns slowly with the circle)
const L1 = layer();
{
  let fine = '', bold = '';
  for (let k = 0; k < 72; k++) {
    const a = k * 5 * Math.PI / 180, long = k % 6 === 0, len = long ? 7 : (k % 2 ? 2.5 : 4);
    const [x1, y1] = pol(a, 91), [x2, y2] = pol(a, 91 - len), seg = `M${f2(x1)} ${f2(y1)}L${f2(x2)} ${f2(y2)}`;
    if (long) bold += seg; else fine += seg;
  }
  pth(L1, fine, .3); pth(L1, bold, .7); circ(L1, 86, .5); circ(L1, 70, .5);
  let seed = 7; const rng = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const GP = [[-2.2, -4], [2.2, -4], [-2.2, 0], [2.2, 0], [-2.2, 4], [2.2, 4], [0, -4.8], [0, 4.8]];
  let runes = '';
  for (let k = 0; k < 24; k++) {
    const a = k * 15 * Math.PI / 180, pt = ([u, v]) => { const [x, y] = pol(a, 77 + v); return [x + Math.cos(a) * u, y + Math.sin(a) * u]; };
    for (let j = 0, n = 3 + Math.floor(rng() * 2); j < n; j++) {
      const p = GP[Math.floor(rng() * 8)], q = GP[Math.floor(rng() * 8)];
      if (p === q) continue;
      const A = pt(p), B = pt(q);
      runes += `M${f2(A[0])} ${f2(A[1])}L${f2(B[0])} ${f2(B[1])}`;
    }
  }
  pth(L1, runes, .5);
}
// two squares (an eight-pointed star), the orbit track and the core (turns the other way)
const L2 = layer();
{
  const sqA = [45, 135, 225, 315], sqB = [0, 90, 180, 270];
  [sqA, sqB].forEach(arr => {
    let d = '';
    arr.forEach((deg, j) => { const [x, y] = pol(deg * Math.PI / 180, 66); d += (j ? 'L' : 'M') + f2(x) + ' ' + f2(y); });
    pth(L2, d + 'Z', .6);
  });
  [...sqA, ...sqB].forEach(deg => { const [x, y] = pol(deg * Math.PI / 180, 66); circ(L2, 2.4, .4, { cx: f2(x), cy: f2(y) }); });
  circ(L2, HOLE_R, .3, { 'stroke-dasharray': '1.2 2.4' });
  circ(L2, 26, .6); circ(L2, 23.5, .25); circ(L2, 2.4, .5);
}
// the four holes, orbiting the centre
const L3 = S('g', {}, cam);
ids.forEach((id, i) => {
  const h = S('g', { transform: `rotate(${i * 90}) translate(0 ${-HOLE_R})` }, L3);
  S('circle', { r: HOLE_RAD, class: 'holefill' }, h);
  S('circle', { r: HOLE_RAD, fill: `url(#hg-${id})` }, h);
  const gg = S('g', {}, h), cg = S('g', {}, h), col = `stroke:var(--${id}-ink)`;
  glows.push(gg);
  S('circle', { r: HOLE_RAD, class: 'gl', 'stroke-width': 4, style: col }, gg);
  S('circle', { r: HOLE_RAD, class: 'ln', 'stroke-width': .9, style: col }, cg);
  S('circle', { r: HOLE_RAD + 2.6, class: 'ln', 'stroke-width': .3, style: col }, cg);
});

let T = 0;
function renderSigil() {
  const sc = C.s * (1 + C.breath * (0.012 * Math.sin(T * 1.7) + 0.04 * C.hover));
  cam.setAttribute('transform', `translate(${C.cx} ${C.cy}) rotate(${C.rot}) scale(${sc})`);
  L1.g.setAttribute('transform', `rotate(${C.d1})`);
  L2.g.setAttribute('transform', `rotate(${C.d2})`);
  L3.setAttribute('transform', `rotate(${C.ring})`);
  const g = clamp(.22 + .07 * Math.sin(T * 2.1) + .3 * C.hover * C.breath + .5 * C.boost, 0, 1);
  glows.forEach(n => n.setAttribute('opacity', g));
  aura.setAttribute('opacity', clamp(.75 + C.boost + .4 * C.hover, 0, 1));
}

// ---- glow sprites (cheap soft light for fae, sparks and effects) ----
const spr = {};
function sprite(c) {
  if (spr[c]) return spr[c];
  const k = document.createElement('canvas'); k.width = k.height = 64;
  const g = k.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(.25, rgba(c, .55)); gr.addColorStop(.6, rgba(c, .12)); gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (spr[c] = k);
}
function glow(ctx, x, y, r, c, a) { if (a <= 0) return; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(sprite(c), x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }

// ---- fae: two layers of little elemental sprites. The front layer is larger and brighter. ----
let faeOn = true, faeCleared = false;
const fae = [], sparks = [];
const WING = { air: [3.4, .8], water: [2.3, 1.2], earth: [1.9, 1.3], fire: [2.7, .9] };   // wing length, width (in body radii)
function mkFae(front, i) {
  return { el: ids[i % 4], front, x: rand(W), y: rand(H), vx: 0, vy: 0, tx: rand(W), ty: rand(H), tt: rand(2),
    r: front ? rand(5, 7.5) : rand(2.8, 4.2), ph: rand(TAU), fl: rand(10, 15), k: front ? 1 : .6 };
}
function spawnFae() {
  fae.length = 0;
  const nb = clamp(Math.round(W * H / 55000), 12, 28), nf = clamp(Math.round(W * H / 120000), 6, 14);
  for (let i = 0; i < nb; i++) fae.push(mkFae(false, i));      // back layer first, so the front layer draws over it
  for (let i = 0; i < nf; i++) fae.push(mkFae(true, i));
}
function updateFae(dt) {
  for (const f of fae) {
    f.tt -= dt;
    if (f.tt <= 0) { f.tt = rand(1.6, 4); f.tx = clamp(f.x + rand(-1, 1) * W * .25, -20, W + 20); f.ty = clamp(f.y + rand(-1, 1) * H * .25, -20, H + 20); }
    const k = .9 * f.k;
    f.vx += ((f.tx - f.x) * k - f.vx * 1.6) * dt;
    f.vy += ((f.ty - f.y) * k - f.vy * 1.6) * dt;
    f.x += f.vx * dt; f.y += f.vy * dt + Math.sin(T * 2.3 + f.ph) * 10 * dt;
    if (Math.random() < dt * (f.front ? 9 : 4)) {
      const o = { x: f.x + rand(-1, 1) * f.r, y: f.y + rand(-1, 1) * f.r, el: f.el, age: 0, life: rand(.8, 1.4), r: f.front ? rand(1.5, 2.6) : rand(1, 1.8), a: f.front ? 1 : .55, vx: 0, vy: 0 };
      if (f.el === 'air') { o.vx = rand(-12, 12); o.vy = rand(-12, 12); }
      else if (f.el === 'water') { o.vx = rand(-6, 6); o.vy = rand(14, 44); }
      else if (f.el === 'earth') { o.vx = rand(-6, 6); o.vy = rand(6, 26); }
      else { o.vx = rand(-10, 10); o.vy = -rand(24, 60); }
      sparks.push(o);
    }
  }
  for (let i = sparks.length - 1; i >= 0; i--) { const p = sparks[i]; p.age += dt; if (p.age >= p.life) { sparks.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; }
}
function drawFae() {
  const dark = isDark();
  fa.clearRect(0, 0, W, H);
  fa.globalCompositeOperation = dark ? 'lighter' : 'source-over';
  for (const p of sparks) glow(fa, p.x, p.y, p.r * 3.2, pc(p.el), (1 - p.age / p.life) * p.a * (dark ? .9 : .7));
  for (const f of fae) {
    const c = pc(f.el), a = f.front ? 1 : .5, [wl, ww] = WING[f.el];
    glow(fa, f.x, f.y, f.r * (f.front ? 8 : 6.5), c, (dark ? .6 : .4) * a);
    const flap = Math.sin(T * f.fl + f.ph), face = f.vx < 0 ? -1 : 1;
    fa.save(); fa.translate(f.x, f.y); fa.scale(face, 1);
    fa.fillStyle = rgba(dark ? '#ffffff' : c, (dark ? .22 : .18) * a); fa.strokeStyle = rgba(c, .6 * a); fa.lineWidth = .8;
    for (const s of [-1, 1]) {
      fa.save(); fa.rotate(s * (.45 + .4 * flap));
      fa.beginPath(); fa.ellipse(-f.r * wl * .5 - f.r * .4, 0, f.r * wl, f.r * ww, 0, 0, TAU); fa.fill(); fa.stroke();
      fa.restore();
    }
    fa.restore();
    glow(fa, f.x, f.y, f.r * 2.4, dark ? '#ffffff' : c, dark ? .95 * a : .9 * a);
  }
  fa.globalCompositeOperation = 'source-over';
}

// ---- effects canvas: pulses, element reveals, drifting particles ----
const fx = [], parts = [], idle = {};
function emit(o) { parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 1, age: 0, r: 3, c: '#fff', a: 1, kind: 'dot' }, o)); }
function updParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    if (p.age >= p.life) { parts.splice(i, 1); continue; }
    p.vy += p.g * dt;
    if (p.hole != null) {                                         // idle particles follow their hole as the circle moves
      if (p.orb) { p.oa += p.ow * dt; p.rx = Math.cos(p.oa) * p.or; p.ry = Math.sin(p.oa) * p.or; }
      else { p.rx += p.vx * dt; p.ry += p.vy * dt; }
      const h = holePos(p.hole); p.x = h.x + p.rx; p.y = h.y + p.ry;
    } else { p.x += p.vx * dt; p.y += p.vy * dt; }
    const k = 1 - p.age / p.life;
    if (p.kind === 'drop') { fc.fillStyle = rgba(p.c, .95 * k); fc.beginPath(); fc.arc(p.x, p.y, p.r, 0, TAU); fc.fill(); }
    else if (p.kind === 'bubble') { fc.strokeStyle = rgba(p.c, .8 * k); fc.lineWidth = 1; fc.beginPath(); fc.arc(p.x, p.y, p.r, 0, TAU); fc.stroke(); }
    else glow(fc, p.x, p.y, p.r * 3, p.c, p.a * k);
  }
}
function idleEmit(dt) {
  for (const id in idle) {
    const o = idle[id];
    if (!o.on || Math.random() > dt * o.rate) continue;
    const i = ids.indexOf(id), hr = HOLE_RAD * C.s, sc = clamp(hr / 50, .5, 1.6), c = pc(id);
    if (id === 'air') emit({ hole: i, orb: true, oa: rand(TAU), ow: rand(1.5, 3) * (Math.random() < .5 ? -1 : 1), or: hr * rand(.55, 1), life: rand(1.2, 2.2), r: rand(1.2, 2.2) * sc, c, rx: 0, ry: 0 });
    else if (id === 'fire') emit({ hole: i, rx: rand(-.5, .5) * hr, ry: hr * rand(.2, .6), vx: rand(-8, 8) * sc, vy: -rand(30, 70) * sc, life: rand(.9, 1.6), r: rand(1.5, 2.8) * sc, c: Math.random() < .5 ? c : '#ffb347' });
    else if (id === 'water') emit({ hole: i, kind: 'bubble', rx: rand(-.6, .6) * hr, ry: hr * .7, vx: rand(-4, 4) * sc, vy: -rand(14, 30) * sc, life: rand(1.4, 2.4), r: rand(2, 4) * sc, c });
    else emit({ hole: i, rx: rand(-.7, .7) * hr, ry: -hr * rand(.1, .6), vx: rand(-3, 3) * sc, vy: rand(6, 18) * sc, life: rand(1.4, 2.4), r: rand(1.2, 2.4) * sc, c, a: .8 });
  }
}
function ring(x, y, r0, r1, dur, c, delay = 0, w = 3, sq = 1) {
  let t = -delay;
  fx.push(dt => {
    t += dt; if (t < 0) return true;
    const p = t / dur; if (p >= 1) return false;
    const r = lerp(r0, r1, easeOut(p)), a = Math.pow(1 - p, 1.5);
    fc.beginPath(); fc.ellipse(x, y, r, r * sq, 0, 0, TAU);
    fc.strokeStyle = rgba(c, .28 * a); fc.lineWidth = w * 5 * (1 - p * .5); fc.stroke();
    fc.strokeStyle = rgba(c, a); fc.lineWidth = w * (1 - p * .5); fc.stroke();
    return true;
  });
}

// air: currents gather into a swirl
function airSwirl(x, y, hr) {
  const c = pc('air'), ps = [], dur = 1.5; let t = 0;
  for (let i = 0; i < 50; i++) ps.push({ a: rand(TAU), r: hr * rand(1.4, 3.4), w: rand(3, 6), len: rand(.5, 1.3), d: rand(0, .55), lw: rand(1, 2.6) });
  fx.push(dt => {
    t += dt;
    fc.lineCap = 'round';
    for (const p of ps) {
      const tt = t - p.d; if (tt < 0) continue;
      const k = Math.min(1, tt / (dur - .5)), r = lerp(p.r, hr * .1, k * k), a = p.a + p.w * tt * (1 + 2 * k);
      fc.strokeStyle = rgba(c, Math.sin(k * Math.PI) * .9); fc.lineWidth = p.lw;
      fc.beginPath(); fc.arc(x, y, r, a - p.len, a); fc.stroke();
    }
    glow(fc, x, y, hr * 1.6 * easeIn(Math.min(1, t / dur)), c, .55 * Math.min(1, t / dur) * (t > dur ? Math.max(0, 1 - (t - dur) / .4) : 1));
    return t < dur + .4;
  });
}
// fire: a flicker of tongues, with embers
function fireFlicker(x, y, hr) {
  const c = pc('fire'), dur = 1.7, sc = clamp(hr / 50, .5, 1.8); let t = 0, nt = 0, f = 1, jit = [1, 1, 1];
  fx.push(dt => {
    t += dt; nt -= dt;
    if (nt <= 0) { f = .45 + Math.random() * .55; nt = .05 + Math.random() * .07; jit = jit.map(() => .65 + Math.random() * .6); }
    const env = Math.min(1, t / .35) * (t > dur - .5 ? Math.max(0, (dur - t) / .5) : 1);
    glow(fc, x, y, hr * (1.5 + .7 * f), c, .75 * env * f);
    const base = y + hr * .55;
    [[c, 1, .55], ['#ffb347', .72, .8], ['#ffe08a', .45, .9]].forEach(([col, k, al]) => {
      fc.fillStyle = rgba(col, al * env);
      [[-.38, 0], [0, 1], [.38, 2]].forEach(([ox, j]) => {
        const h = hr * (j === 1 ? 1.35 : .95) * jit[j] * k * (.7 + .5 * f), w = hr * .3 * k, bx = x + ox * hr;
        fc.beginPath(); fc.moveTo(bx - w, base); fc.quadraticCurveTo(bx - w * .6, base - h * .4, bx + (jit[j] - 1) * hr * .2, base - h); fc.quadraticCurveTo(bx + w * .6, base - h * .4, bx + w, base); fc.closePath(); fc.fill();
      });
    });
    if (t < .9 && Math.random() < dt * 50) emit({ x: x + rand(-.5, .5) * hr, y: y + hr * .3, vx: rand(-30, 30) * sc, vy: -rand(60, 160) * sc, life: rand(.6, 1.2), r: rand(1.5, 3) * sc, c: '#ffb347' });
    return t < dur;
  });
}
// water: a splash, with ripples
function waterSplash(x, y, hr) {
  const c = pc('water'), sc = clamp(hr / 50, .5, 1.8); let t = 0;
  [0, .12, .26].forEach(d => ring(x, y + hr * .45, hr * .2, hr * 1.5, 1100, c, d, 2.5, .38));
  for (let i = 0; i < 30; i++) {
    const a = -Math.PI / 2 + rand(-1, 1) * .95, sp = rand(140, 340) * sc;
    emit({ kind: 'drop', x: x + rand(-.15, .15) * hr, y: y + hr * .35, vx: Math.cos(a) * sp * .7, vy: Math.sin(a) * sp, g: 700 * sc, life: rand(.8, 1.3), r: rand(1.5, 3.4) * sc, c: isDark() ? '#9ccdf9' : c });
  }
  fx.push(dt => { t += dt; glow(fc, x, y + hr * .3, hr * 1.8, c, .6 * Math.max(0, 1 - t / .45)); return t < .45; });
}
// earth: a crack opens and rocks rise out of it
function earthRocks(x, y, hr) {
  const c = pc('earth'), yb = y + hr * .5, dur = 2.2, rocks = [], pts = []; let t = 0;
  for (let i = 0; i <= 9; i++) pts.push([x + (i / 9 - .5) * hr * 1.9, yb + (i % 2 ? 1 : -1) * rand(.02, .12) * hr]);
  for (let i = 0; i < 7; i++) rocks.push({ x: x + ((i + .5) / 7 - .5) * hr * 1.5 + rand(-.06, .06) * hr, rr: hr * rand(.16, .27), rise: hr * rand(.55, 1.15), st: .25 + rand(.6), du: rand(.7, 1), a0: rand(TAU), rv: rand(-1.5, 1.5),
    v: Array.from({ length: 6 }, () => rand(.7, 1.1)), shade: rand(-.15, .15), fired: false });
  fx.push(dt => {
    t += dt;
    const fade = t > dur - .5 ? Math.max(0, (dur - t) / .5) : 1;
    fc.save(); fc.globalCompositeOperation = 'source-over'; fc.globalAlpha = fade; fc.lineCap = 'round'; fc.lineJoin = 'round';
    const n = Math.floor(Math.min(1, t / .45) * (pts.length - 1)) + 1;
    [[c, 4], ['#3a2614', 1.8]].forEach(([col, w]) => { fc.strokeStyle = col; fc.lineWidth = w; fc.beginPath(); pts.slice(0, n).forEach(([px, py], i) => i ? fc.lineTo(px, py) : fc.moveTo(px, py)); fc.stroke(); });
    fc.save(); fc.beginPath(); fc.rect(x - hr * 2.2, y - hr * 3, hr * 4.4, yb + 1 - (y - hr * 3)); fc.clip();
    for (const r of rocks) {
      const tt = t - r.st; if (tt < 0) continue;
      if (!r.fired) { r.fired = true; for (let k = 0; k < 6; k++) emit({ x: r.x + rand(-1, 1) * r.rr, y: yb, vx: rand(-30, 30), vy: -rand(10, 50), life: rand(.6, 1.1), r: rand(3, 6), c, a: .5 }); }
      const e = easeOut(Math.min(1, tt / r.du)), cy = lerp(yb + r.rr * 1.3, yb - r.rise, e);
      fc.fillStyle = mix(c, r.shade); fc.strokeStyle = mix(c, -.45); fc.lineWidth = 1.2;
      fc.beginPath();
      r.v.forEach((k, i) => { const a = r.a0 + r.rv * tt + i / 6 * TAU, px = r.x + Math.cos(a) * r.rr * k, py = cy + Math.sin(a) * r.rr * k; i ? fc.lineTo(px, py) : fc.moveTo(px, py); });
      fc.closePath(); fc.fill(); fc.stroke();
    }
    fc.restore(); fc.restore();
    return t < dur;
  });
}

// ---- element buttons, one per hole ----
const ICON = {
  air:   '<path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  water: '<path d="M12 3C9 7.5 5.5 11 5.5 15a6.5 6.5 0 0 0 13 0C18.5 11 15 7.5 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 15.5a3 3 0 0 0 2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  earth: '<path d="M2.5 19.5 9 7.5l4 7 2.5-3.5 6 8.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 7.5l1.6 2.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  fire:  '<path d="M12 2.5c.6 3-1.8 4.6-3.4 7C7 12 6 13.5 6 15.5a6 6 0 0 0 12 0c0-2.6-1.3-4.2-2.6-5.7-.3 1.5-1 2.4-2 2.9.5-3.8-.3-7-1.4-10.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
};
const els = {}, caption = $('caption');
let live = false, chosen = null;
ids.forEach((id, i) => {
  const b = document.createElement('button');
  b.className = 'elbtn ' + id; b.type = 'button'; b.setAttribute('aria-label', id);
  b.style.setProperty('--c', `var(--${id}-ink)`);
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[id]}</svg>`;
  $('stage').appendChild(b);
  els[id] = { b, i, show: false };
  b.addEventListener('click', () => pick(id));
  const hint = on => { if (!live || chosen) return; caption.textContent = on ? id : ''; caption.style.color = `var(--${id}-ink)`; };
  b.addEventListener('pointerenter', () => hint(true)); b.addEventListener('pointerleave', () => hint(false));
  b.addEventListener('focus', () => hint(true)); b.addEventListener('blur', () => hint(false));
});
function placeEls() {
  const d = Math.max(44, HOLE_RAD * C.s * 2);
  for (const id of ids) {
    const e = els[id]; if (!e.show) continue;
    const p = holePos(e.i);
    e.b.style.left = p.x + 'px'; e.b.style.top = p.y + 'px'; e.b.style.width = e.b.style.height = d + 'px';
  }
}
function placeChoose() { const p = poseChoose(); $('choose').style.top = Math.max(40, p.cy - OUT * p.s - 14) + 'px'; }

const REVEAL = { air: [airSwirl, 900], fire: [fireFlicker, 650], water: [waterSplash, 500], earth: [earthRocks, 1100] };
function reveal(id) {
  const e = els[id], p = holePos(e.i), hr = HOLE_RAD * C.s, [fn, delay] = REVEAL[id];
  fn(p.x, p.y, hr);
  setTimeout(() => { if (aborted) return; e.show = true; placeEls(); e.b.classList.add('on'); idle[id] = { on: true, rate: id === 'fire' ? 10 : 7 }; }, delay);
}

// ---- engulfing the screen (drawn on the flood canvas, with the chosen element's own character) ----
const FLOOD = {
  air(x, y, R, e, t) {                                            // pale wind, spiralling outward
    const amp = .035 * (1 - e);
    fl.beginPath();
    for (let i = 0; i <= 120; i++) { const a = i / 120 * TAU, r = R * (1 + amp * Math.sin(6 * a + t * 5)); i ? fl.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : fl.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    const g = fl.createRadialGradient(x, y, 0, x, y, Math.max(1, R)); g.addColorStop(0, '#e9f6fc'); g.addColorStop(1, PAL.air);
    fl.fillStyle = g; fl.fill(); fl.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const r = R * (.15 + .8 * hs(i, 1)), a0 = hs(i, 2) * TAU + t * (1.4 + hs(i, 3) * 2.2) * (i % 2 ? 1 : -.7);
      fl.strokeStyle = `rgba(255,255,255,${.25 + .35 * hs(i, 5)})`; fl.lineWidth = 1.5 + 3.5 * hs(i, 6);
      fl.beginPath(); fl.arc(x, y, r, a0, a0 + .5 + hs(i, 4) * 1.2); fl.stroke();
    }
  },
  fire(x, y, R, e, t) {                                           // layered flames, the core burning out to orange
    const amp = .16 * (1 - e * .9);
    [['#c93a12', 0, 1], [PAL.fire, .1, 1], ['#ffd36b', .24, 1 - e * e * e]].forEach(([col, inset, al], k) => {
      const Rk = R * (1 - inset * (1 - e));
      fl.globalAlpha = Math.max(0, al); fl.fillStyle = col; fl.beginPath();
      for (let i = 0; i <= 160; i++) {
        const a = i / 160 * TAU, n = Math.sin(7 * a + t * 9 + k * 2) * .5 + Math.sin(13 * a - t * 12 + k) * .35 + Math.abs(Math.sin(21 * a + t * 15)) * .5, r = Rk * (1 + amp * (n - .2));
        i ? fl.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : fl.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      fl.fill();
    });
    fl.globalAlpha = 1;
  },
  water(x, y, R, e, t) {                                          // a tide rising from below, with a wavy surface
    const A = 22;
    [['#a9d4fa', 0], ['#6fb0f0', 26], [PAL.water, 52]].forEach(([col, off], j) => {
      const top = lerp(H + A + off, -A - 70, e);
      fl.fillStyle = col; fl.beginPath(); fl.moveTo(0, H + 10);
      for (let px = 0; px <= W + 12; px += 12) fl.lineTo(px, top + A * Math.sin(px * .012 + t * 3 + j * 1.7) + A * .5 * Math.sin(px * .027 - t * 2.2 + j * 2.3));
      fl.lineTo(W + 12, H + 10); fl.closePath(); fl.fill();
    });
  },
  earth(x, y, R, e, t) {                                          // a crumbling mass with a rocky edge, cracks running through it
    const K = 26, amp = .18 * (1 - e), poly = Rk => { fl.beginPath(); for (let i = 0; i < K; i++) { const a = i / K * TAU, r = Rk * (1 + amp * (hs(i, 7) * 2 - 1)); i ? fl.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : fl.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } fl.closePath(); };
    fl.fillStyle = '#5b3d22'; poly(R); fl.fill();
    fl.fillStyle = PAL.earth; poly(R * (.94 + .06 * e)); fl.fill();
    fl.strokeStyle = `rgba(58,38,20,${.55 * (1 - e)})`; fl.lineWidth = 3; fl.lineJoin = 'round';
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU + hs(i, 8) * .4; fl.beginPath(); fl.moveTo(x, y);
      for (let j = 1; j <= 14; j++) { const aa = a + (hs(i * 31 + j, 9) - .5) * .18, r = R * .92 * (j / 14) * Math.min(1, e * 1.6); fl.lineTo(x + Math.cos(aa) * r, y + Math.sin(aa) * r); }
      fl.stroke();
    }
    if (e < .97) for (let i = 0; i < 36; i++) {
      const a = hs(i, 10) * TAU, r = R * (.96 + .06 * hs(i, 11)), sz = 10 + 22 * hs(i, 12), px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      fl.fillStyle = mix(PAL.earth, -.25 + .3 * hs(i, 13)); fl.beginPath();
      for (let v = 0; v < 5; v++) { const aa = t * (hs(i, 14) - .5) * 3 + v / 5 * TAU; v ? fl.lineTo(px + Math.cos(aa) * sz * (.7 + .4 * hs(i + v, 15)), py + Math.sin(aa) * sz * (.7 + .4 * hs(i + v, 15))) : fl.moveTo(px + Math.cos(aa) * sz, py + Math.sin(aa) * sz); }
      fl.fill();
    }
  }
};
function flood(id, x, y) {
  const maxR = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) * 1.15, ms = 2600;
  return tween(ms, p => { const e = easeIO(p); fl.clearRect(0, 0, W, H); FLOOD[id](x, y, maxR * e, e, p * ms / 1000); }).then(() => { fl.fillStyle = PAL[id]; fl.fillRect(0, 0, W, H); });
}

// ---- leaving ----
let leaving = false;
function leave(ms) {
  if (leaving) return; leaving = true; aborted = true;
  $('bubble').classList.remove('show', 'burst');
  $('veil').classList.add('on');
  setTimeout(() => { location.href = 'game.html'; }, ms);
}

// ---- the sequence ----
const btn = $('play'), skip = $('skip'), bubble = $('bubble');
let started = false, orbitOn = true, hoverT = 0;

function showBubble(text, i) {
  return new Promise(res => {
    bubble.textContent = text; bubble.style.setProperty('--c', `var(--${ids[i]}-ink)`);
    bubble.classList.remove('burst'); bubble.classList.add('show'); bubble.focus({ preventScroll: true });
    const on = () => {
      bubble.removeEventListener('click', on);
      bubble.classList.add('burst');
      setTimeout(() => bubble.classList.remove('show', 'burst'), 700);
      res();
    };
    bubble.addEventListener('click', on);
  });
}

async function play() {
  if (started) return; started = true;
  btn.disabled = true; hoverT = 0; skip.classList.add('on');
  phase = 'pulse';
  const p = poseHome(), R = homeR();
  C.boost = 1; orbitOn = false;
  ids.forEach((id, k) => ring(p.cx, p.cy, R * .9, R * 3.8, 1500, pc(id), k * .22, 3));        // the pulse: one ring per element
  const r0 = C.ring, a0 = C.d1, b0 = C.d2, rT = Math.ceil((r0 + 40) / 90) * 90, aT = Math.ceil((a0 + 20) / 90) * 90, bT = Math.floor((b0 - 30) / 90) * 90;
  tween(1700, t => { const e = easeOut(t); C.ring = lerp(r0, rT, e); C.d1 = lerp(a0, aT, e); C.d2 = lerp(b0, bT, e); C.breath = 1 - e; });   // everything settles to a symmetric pose
  await wait(2250);                                                                          // after the pulse has fully faded...
  document.body.classList.add('fading');                                                     // ...everything but the circle goes
  await wait(700);
  faeOn = false; btn.hidden = true;

  // spin up and magnify until the centre is in the top-left corner and hole 1 is in the middle of the screen
  phase = 'zoom';
  const base = zoomAngle() - C.ring, k = Math.ceil((base - (C.rot - 1080)) / 360), rotEnd = base - 360 * k;
  await move({ to: poseZoom, rot: rotEnd, ms: 5600, ease: bez(.45, 0, .12, 1), rotEase: bez(.6, 0, .1, 1) });
  const holeRest = () => Object.assign(poseZoom(), { rot: zoomRot(curHole) });
  curHole = 0; setRest(holeRest);

  // four bubbles, one per hole; each click turns the circle a quarter to the next hole
  phase = 'dialog';
  for (let i = 0; i < 4; i++) {
    await wait(i ? 450 : 1000);
    await showBubble(LINES[i], i);
    ring(W / 2, H / 2, 30, Math.min(W, H) * .5, 1000, pc(ids[i]), 0, 2.5);
    if (i < 3) {
      rest = null;
      const r1 = C.rot;
      await tween(1500, t => { C.rot = r1 - 90 * easeIO(t); });
      C.rot = r1 - 90; curHole = i + 1; setRest(holeRest);
    }
  }

  // settle in the middle, with the holes at the four compass points
  phase = 'settle';
  await wait(500);
  rest = null;
  const b2 = -C.ring, k2 = Math.floor((C.rot - 540 - b2) / 360), rotF = b2 + 360 * k2;
  await move({ to: poseCenter, rot: rotF, ms: 3400, ease: bez(.6, 0, .25, 1), rotEase: bez(.55, 0, .3, 1) });
  setRest(poseCenter);

  // air (north), fire (west), water (east), earth (south)
  phase = 'reveal';
  for (const id of ['air', 'fire', 'water', 'earth']) { reveal(id); await wait(1500); }
  await wait(600);

  // shift down, then ask
  await move({ to: poseChoose, ms: 1100, ease: bez(.5, 0, .2, 1) });
  setRest(poseChoose);
  phase = 'choose';
  placeChoose();
  $('choose').classList.add('on');
  live = true;
  ids.forEach(id => els[id].b.classList.add('live'));
}

async function pick(id) {
  if (!live || chosen) return;
  chosen = id; live = false; phase = 'leave';
  try { sessionStorage.setItem('fe-chosen', id); } catch (e) {}
  const p = holePos(els[id].i);
  ids.forEach(o => { els[o].b.classList.remove('live'); if (o !== id) { els[o].b.classList.add('off'); if (idle[o]) idle[o].on = false; } });
  els[id].b.classList.add('chosen');
  caption.textContent = '';
  $('choose').classList.remove('on');
  $('sigil').classList.add('out');
  ring(p.x, p.y, 20, Math.min(W, H) * .35, 1200, pc(id), 0, 3);
  await wait(1200);
  await flood(id, p.x, p.y);
  await wait(150);
  leave(1050);
}

// ---- input ----
btn.addEventListener('click', play);
btn.addEventListener('pointerenter', () => { hoverT = 1; });
btn.addEventListener('pointerleave', () => { hoverT = 0; });
btn.addEventListener('focus', () => { hoverT = 1; });
btn.addEventListener('blur', () => { hoverT = 0; });
skip.addEventListener('click', () => leave(650));
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || !live) return;
  const id = ids.find(x => x[0] === e.key.toLowerCase());
  if (id) { e.preventDefault(); pick(id); }
});
addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
if (matchMedia('(prefers-reduced-motion: reduce)').matches) skip.classList.add('on');

// ---- layout and the frame loop ----
function layoutHome() {
  const p = poseHome(), d = homeR() * 2;
  Object.assign(btn.style, { left: p.cx + 'px', top: p.cy + 'px', width: d + 'px', height: d + 'px' });
}
function resize() {
  W = innerWidth; H = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
  [faeC, fxC, flC].forEach(c => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); });
  [fa, fc, fl].forEach(c => c.setTransform(dpr, 0, 0, dpr, 0, 0));
  if (rest) Object.assign(C, rest());
  layoutHome();
  if (phase === 'choose') placeChoose();
  if (!fae.length) spawnFae();
}
addEventListener('resize', resize);
mq.addEventListener('change', readPal);

let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
  if (orbitOn) { C.ring += 24 * dt; C.d1 += 5 * dt; C.d2 -= 8 * dt; }
  C.hover += (hoverT - C.hover) * Math.min(1, dt * 6);
  C.boost *= Math.exp(-dt * 1.3);
  renderSigil();
  if (faeOn) { updateFae(dt); drawFae(); }
  else if (!faeCleared) { fa.clearRect(0, 0, W, H); faeCleared = true; }
  fc.clearRect(0, 0, W, H);
  fc.globalCompositeOperation = isDark() ? 'lighter' : 'source-over';
  for (let i = fx.length - 1; i >= 0; i--) if (!fx[i](dt)) fx.splice(i, 1);
  idleEmit(dt);
  updParts(dt);
  fc.globalCompositeOperation = 'source-over';
  placeEls();
  requestAnimationFrame(frame);
}

readPal();
resize();
Object.assign(C, poseHome());
rest = poseHome;
requestAnimationFrame(frame);
})();
