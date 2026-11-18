/* space.js - everything layer 1 looks like around the star: the dark space background (it fills in with more stars, nebulas,
 * galaxies and planets as the star's tier rises), the ring that fills as the next tier gets closer, bodies in orbit, the neutron
 * star and the black hole (warped starlight, accretion disk, jets), the strange star's glow, rogue stars, and antimatter pulses.
 * Two canvases: #space behind the star (the background and the far half of anything that orbits) and #fx in front of it.
 * Both are drawn around the middle of the star, in the star's own units (FE.core.s pixels each), like effects.js does. */
FE.module(function (FE) {
  document.documentElement.dataset.theme = 'dark';     // layer 1 is always dark now (effects.js reads this too)

  const $ = FE.$, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const hs = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
  const mix = (h, f) => { const t = f > 0 ? 255 : 0, k = Math.abs(f); return '#' + rgb(h).map(v => Math.round(lerp(v, t, k)).toString(16).padStart(2, '0')).join(''); };
  const easeOut = p => 1 - Math.pow(1 - p, 3);

  const sp = FE.space = { T: 0, flair: 0, prog: 0, hole: 0, neutron: 0, strange: 0, rogues: [], pulses: [], shoot: null };
  let bg, fx, cb, cf, dpr = 1, PW = 0, PH = 0, FW = 0, FH = 0, cx = 0, cy = 0;
  const layers = {};

  // ---- things drawn once into small canvases ----
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  function nebula(c, x, y, r, col, a, seed) {
    for (let i = 0; i < 7; i++) {
      const ox = (hs(seed, i) - .5) * r * .9, oy = (hs(seed, i + 9) - .5) * r * .6, rr = r * (.35 + .5 * hs(seed, i + 3));
      const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr);
      g.addColorStop(0, rgba(col, a * (.5 + .5 * hs(seed, i + 5)))); g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g; c.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2);
    }
  }
  function galaxy(c, x, y, r, tilt, rot, col, seed) {
    c.save(); c.translate(x, y); c.rotate(rot); c.scale(1, tilt);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r * .45); g.addColorStop(0, 'rgba(255,244,220,.95)'); g.addColorStop(.35, rgba(col, .45)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(-r, -r, r * 2, r * 2);
    for (let arm = 0; arm < 2; arm++) for (let k = 0; k < 170; k++) {
      const t = k / 170, ang = arm * Math.PI + t * 5.4 + (hs(seed + k, 1) - .5) * .5, rr = (.08 + t * .92) * r + (hs(seed + k, 2) - .5) * r * .08;
      c.fillStyle = `rgba(${hs(seed + k, 3) < .3 ? '255,220,190' : '200,220,255'},${(1 - t) * .55 * (.4 + .6 * hs(seed + k, 4))})`;
      c.beginPath(); c.arc(Math.cos(ang) * rr, Math.sin(ang) * rr, .7 + 1.4 * hs(seed + k, 5) * (1 - t * .5), 0, TAU); c.fill();
    }
    c.restore();
  }
  // a lit sphere (also used for the planets that orbit): light from the upper left. kind: 'planet' (bands, maybe a ring) or 'moon' (craters)
  function ball(c, x, y, r, base, kind, seed, ring) {
    c.save(); c.translate(x, y);
    if (ring) { c.strokeStyle = rgba(mix(base, .35), .55); c.lineWidth = r * .22; c.beginPath(); c.ellipse(0, 0, r * 1.9, r * .55, -.35, Math.PI, TAU); c.stroke(); }
    c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
    const g = c.createRadialGradient(-r * .4, -r * .4, r * .1, 0, 0, r * 1.1); g.addColorStop(0, mix(base, .5)); g.addColorStop(.5, base); g.addColorStop(1, mix(base, -.7));
    c.fillStyle = g; c.fillRect(-r, -r, r * 2, r * 2);
    if (kind === 'moon') for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.arc((hs(seed, i) - .5) * r * 1.2, (hs(seed, i + 7) - .5) * r * 1.2, r * (.1 + .14 * hs(seed, i + 3)), 0, TAU); c.fill(); }
    else for (let i = 0; i < 5; i++) { c.fillStyle = `rgba(255,255,255,${.06 + .08 * hs(seed, i)})`; c.fillRect(-r, -r + (i + hs(seed, i + 2) * .6) * r * .38, r * 2, r * .1 + r * .12 * hs(seed, i + 4)); }
    const sh = c.createRadialGradient(r * .45, r * .45, r * .2, r * .45, r * .45, r * 1.5); sh.addColorStop(0, 'rgba(0,0,12,.55)'); sh.addColorStop(1, 'rgba(0,0,12,0)'); c.fillStyle = sh; c.fillRect(-r, -r, r * 2, r * 2);
    c.restore();
    if (ring) { c.strokeStyle = rgba(mix(base, .35), .7); c.lineWidth = r * .22; c.beginPath(); c.ellipse(0, 0, r * 1.9, r * .55, -.35, 0, Math.PI); c.stroke(); }
    c.restore();
  }
  // tier i of the background adds this (i = 0 is always there). Nebulas take the colour of the element; the rest does not.
  function nebLayer(el, i) {
    const key = `n${el}${i}${PW}x${PH}`;
    if (layers[key]) return layers[key];
    const S = .33, c = (layers[key] = mk(PW * S, PH * S)).getContext('2d'), w = c.canvas.width, h = c.canvas.height, p = FE.PAL[el], oth = FE.PAL[FE.ELEMENTS[(FE.ELEMENTS.findIndex(e => e.id === el) + 1 + i % 3) % 4].id];
    const N = [[0, 2, p.glow, .09], [1, 1, oth.mid, .10], [2, 2, '#7a5cff', .10], [3, 0, '#ff6fb0', .08], [4, 2, p.acc, .11], [5, 2, '#5ad1ff', .10]][i];
    for (let n = 0; n < N[1]; n++) nebula(c, w * (.12 + .76 * hs(i * 7 + n, 1)), h * (.12 + .76 * hs(i * 7 + n, 2)), Math.max(w, h) * (.28 + .2 * hs(i * 7 + n, 3)), n % 2 ? N[2] : p.glow, N[3] * 1.6, i * 10 + n);
    return layers[key];
  }
  function deepLayer(i) {
    const key = `d${i}${PW}x${PH}`;
    if (layers[key]) return layers[key];
    const S = .5, c = (layers[key] = mk(PW * S, PH * S)).getContext('2d'), w = c.canvas.width, h = c.canvas.height, m = Math.min(w, h);
    const at = n => [w * (.08 + .84 * hs(i * 5 + n, 11)), h * (.1 + .8 * hs(i * 5 + n, 12))];
    if (i === 2) { const [x, y] = at(0); galaxy(c, x, y, m * .11, .42, hs(i, 1) * 2, '#9fb4ff', 40); }
    if (i === 3) { let [x, y] = at(1); galaxy(c, x, y, m * .17, .5, -.5, '#ffc89f', 80); [x, y] = at(2); ball(c, x, y, m * .045, '#8a6a4f', 'planet', 5, true); [x, y] = at(3); ball(c, x, y, m * .03, '#4f7a9a', 'planet', 9, false); }
    if (i === 4) { let [x, y] = at(4); galaxy(c, x, y, m * .24, .38, .6, '#c9a4ff', 120); [x, y] = at(5); ball(c, x, y, m * .07, '#a0603a', 'planet', 14, false); ball(c, x + m * .12, y - m * .06, m * .016, '#b9b9b9', 'moon', 3, false); }
    if (i === 5) for (let n = 0; n < 40; n++) { const a = hs(n, 1) * TAU, d = Math.sqrt(hs(n, 2)) * m * .16, [x, y] = at(6); c.fillStyle = `rgba(255,255,255,${.3 + .6 * hs(n, 3)})`; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, .6 + 1.4 * hs(n, 4), 0, TAU); c.fill(); }
    return layers[key];
  }

  // ---- sizes ----
  function resize() {
    const p1 = $('page1'), st = $('stage');
    if (!p1 || !st) return;
    dpr = Math.min(1.5, devicePixelRatio || 1);
    const pw = p1.clientWidth, ph = p1.clientHeight, fw = st.clientWidth, fh = st.clientHeight;
    if (pw !== PW || ph !== PH) { PW = pw; PH = ph; for (const k in layers) delete layers[k]; bg.width = Math.round(PW * dpr); bg.height = Math.round(PH * dpr); }
    if (fw !== FW || fh !== FH) { FW = fw; FH = fh; fx.width = Math.round(FW * dpr); fx.height = Math.round(FH * dpr); }
  }

  // ---- bodies in orbit: where each one is ----
  function orbitPose(o, i, R) {
    const kind = o.kind, comet = kind === 'comet';
    const a = comet ? R * 3.3 : R * (2.0 + .45 * i + .2 * hs(o.seed, 1)), b = a * (comet ? .5 : .3 + .12 * hs(o.seed, 2)), rot = comet ? (hs(o.seed, 3) - .5) * 1.4 : (hs(o.seed, 3) - .5) * .8;
    const w = (comet ? .7 : .55 / (1 + .3 * i)), th = sp.T * w + hs(o.seed, 5) * TAU, ox = comet ? -a * .45 : 0;   // a comet's orbit is off-centre: the star sits near one end
    const px = Math.cos(th) * a + ox, py = Math.sin(th) * b, X = px * Math.cos(rot) - py * Math.sin(rot), Y = px * Math.sin(rot) + py * Math.cos(rot);
    return { a, b, rot, ox, th, X, Y, front: Math.sin(th) > 0, k: 1 + .22 * Math.sin(th) * (b / a) * 2 };
  }
  function drawOrbiter(c, o, ps) {
    const d = FE.ORBITERS[o.kind], p = FE.PAL[o.el], r = d.r * ps.k;
    if (o.kind === 'comet') {
      const L = Math.hypot(ps.X, ps.Y) || 1, dx = ps.X / L, dy = ps.Y / L, len = 70 + 40 * Math.min(1, 150 / L * 1.5);
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const [off, col, w] of [[0, '#9fe4ff', 5], [.5, '#ffffff', 2.4]]) {
        const g = c.createLinearGradient(ps.X, ps.Y, ps.X + dx * len, ps.Y + dy * len); g.addColorStop(0, rgba(col, .65)); g.addColorStop(1, rgba(col, 0));
        c.strokeStyle = g; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(ps.X, ps.Y); c.quadraticCurveTo(ps.X + dx * len * .5 - dy * 8 * (1 + off), ps.Y + dy * len * .5 + dx * 8 * (1 + off), ps.X + dx * len, ps.Y + dy * len); c.stroke();
      }
      const g = c.createRadialGradient(ps.X, ps.Y, 0, ps.X, ps.Y, r * 4); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.3, rgba(p.glow, .5)); g.addColorStop(1, rgba(p.glow, 0)); c.fillStyle = g; c.fillRect(ps.X - r * 4, ps.Y - r * 4, r * 8, r * 8);
      c.restore(); c.fillStyle = '#fff'; c.beginPath(); c.arc(ps.X, ps.Y, r * .8, 0, TAU); c.fill();
    } else ball(c, ps.X, ps.Y, r, o.kind === 'moon' ? '#a9a9b4' : p.mid, o.kind, o.seed, o.kind === 'planet' && hs(o.seed, 7) > .5);
  }

  // ---- a black hole: the far half (behind it) and the near half (in front of it), jets behind ----
  const RH = 40, DISK_IN = 1.5, DISK_OUT = 4.4, TILT = .24, DROT = -.14;
  function diskArcs(c, near, a) {
    c.save(); c.rotate(DROT); c.globalAlpha *= a;
    const n = 14;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), r = lerp(RH * DISK_IN, RH * DISK_OUT, t), col = t < .22 ? [255, 244, 214] : t < .55 ? [255, 176, 82] : [170, 60, 34], al = .9 * (1 - t) + .1;
      const g = c.createLinearGradient(-r, 0, r, 0); g.addColorStop(0, `rgba(${col},${al * .3})`); g.addColorStop(.5, `rgba(${col},${al * .7})`); g.addColorStop(1, `rgba(${col},${al})`);
      c.strokeStyle = g; c.lineWidth = (RH * (DISK_OUT - DISK_IN) / n) * 1.5;
      c.beginPath(); c.ellipse(0, 0, r, r * TILT, 0, near ? 0 : Math.PI, near ? Math.PI : TAU); c.stroke();
    }
    c.restore();
  }
  function holeBack(c, a) {
    if (a <= 0.01) return;
    const T = sp.T;
    c.save(); c.globalAlpha = a;
    c.globalCompositeOperation = 'lighter';                                  // gamma-ray jets
    for (const dir of [-1, 1]) {
      const len = Math.max(FW, FH) / FE.core.s * .55;
      const g = c.createLinearGradient(0, dir * RH * .6, 0, dir * len); g.addColorStop(0, 'rgba(190,230,255,.75)'); g.addColorStop(.4, 'rgba(120,170,255,.28)'); g.addColorStop(1, 'rgba(120,170,255,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(-5, dir * RH * .6); c.lineTo(-30 - 20 * Math.sin(T * 7 + dir) * .15, dir * len); c.lineTo(30, dir * len); c.lineTo(5, dir * RH * .6); c.closePath(); c.globalAlpha = a * (.75 + .25 * Math.sin(T * 9 + dir * 2)); c.fill(); c.globalAlpha = a;
      for (let j = 0; j < 16; j++) { const t = (T * .7 + j / 16) % 1, y = dir * (RH * .8 + (len - RH) * t), wob = Math.sin(j * 7.3 + T * 3) * (4 + 26 * t); c.fillStyle = `rgba(210,235,255,${(1 - t) * .9})`; c.beginPath(); c.arc(wob, y, 1.6 * (1 - t * .6) + .4, 0, TAU); c.fill(); }
    }
    c.globalCompositeOperation = 'source-over';
    c.save(); c.rotate(T * .02); c.globalAlpha = a; diskArcs(c, false, 1); c.restore();   // the far half of the disk
    c.globalCompositeOperation = 'lighter';                                  // its light bent over the top and under the bottom of the hole
    for (let i = 0; i < 4; i++) { const r = RH * (1.18 + .3 * i), al = .55 - .11 * i; c.lineWidth = 3.2 - .5 * i; c.strokeStyle = `rgba(255,${190 - 20 * i},${110 - 18 * i},${al})`; c.beginPath(); c.arc(0, 0, r, Math.PI * 1.04, Math.PI * 1.96); c.stroke(); c.strokeStyle = `rgba(255,${170 - 20 * i},${100 - 18 * i},${al * .45})`; c.beginPath(); c.arc(0, 0, r, Math.PI * .06, Math.PI * .94); c.stroke(); }
    c.restore();
  }
  function holeFront(c, a) {
    if (a <= 0.01) return;
    c.save(); c.globalAlpha = a;
    c.fillStyle = '#000'; c.beginPath(); c.arc(0, 0, RH * 1.02, 0, TAU); c.fill();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(255,225,180,.3)'; c.lineWidth = 9; c.beginPath(); c.arc(0, 0, RH * 1.06, 0, TAU); c.stroke();
    c.strokeStyle = 'rgba(255,240,215,.95)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, RH * 1.03, 0, TAU); c.stroke();
    c.globalCompositeOperation = 'source-over';
    diskArcs(c, true, 1);
    c.restore();
  }
  // neutron star: a small, hot, blue-white body with two beams sweeping round like a lighthouse
  function neutronBack(c, a) {
    if (a <= .01) return;
    const T = sp.T; c.save(); c.globalAlpha = a; c.globalCompositeOperation = 'lighter'; c.rotate(T * 3.4 + .5);
    for (const s of [1, -1]) { const g = c.createLinearGradient(0, 0, s * 360, 0); g.addColorStop(0, 'rgba(170,215,255,.7)'); g.addColorStop(1, 'rgba(120,160,255,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(0, -4); c.lineTo(s * 360, -34); c.lineTo(s * 360, 34); c.lineTo(0, 4); c.closePath(); c.fill(); }
    c.restore();
    c.save(); c.globalAlpha = a; c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) { const q = (T * .8 + k / 3) % 1; c.strokeStyle = `rgba(150,200,255,${.5 * (1 - q)})`; c.lineWidth = 3 * (1 - q) + .5; c.beginPath(); c.arc(0, 0, 24 + 150 * q, 0, TAU); c.stroke(); }
    c.restore();
  }
  function neutronFront(c, a) {
    if (a <= .01) return;
    c.save(); c.globalAlpha = a; c.globalCompositeOperation = 'lighter';
    let g = c.createRadialGradient(0, 0, 0, 0, 0, 110); g.addColorStop(0, 'rgba(190,225,255,.8)'); g.addColorStop(.3, 'rgba(110,160,255,.3)'); g.addColorStop(1, 'rgba(110,160,255,0)'); c.fillStyle = g; c.fillRect(-110, -110, 220, 220);
    c.globalCompositeOperation = 'source-over';
    g = c.createRadialGradient(-6, -6, 1, 0, 0, 22); g.addColorStop(0, '#ffffff'); g.addColorStop(.6, '#bfe0ff'); g.addColorStop(1, '#5d86e6'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 22, 0, TAU); c.fill();
    c.restore();
  }
  // strange star: a shifting glow and shards of crystal circling the star
  function strangeFront(c, a, R) {
    if (a <= .01) return;
    const T = sp.T; c.save(); c.globalAlpha = a; c.globalCompositeOperation = 'lighter';
    const hue = (T * 45) % 360, g = c.createRadialGradient(0, 0, R * .6, 0, 0, R * 2.1); g.addColorStop(0, `hsla(${hue},90%,62%,.5)`); g.addColorStop(.5, `hsla(${(hue + 80) % 360},90%,55%,.2)`); g.addColorStop(1, 'rgba(120,60,255,0)');
    c.fillStyle = g; c.fillRect(-R * 2.2, -R * 2.2, R * 4.4, R * 4.4);
    c.lineWidth = 3; c.setLineDash([14, 10]); c.strokeStyle = `hsla(${(hue + 160) % 360},95%,70%,.7)`; c.lineDashOffset = -T * 40; c.beginPath(); c.arc(0, 0, R + 6, 0, TAU); c.stroke(); c.setLineDash([]);
    for (let i = 0; i < 14; i++) {
      const ang = T * (.6 + .3 * hs(i, 1)) * (i % 2 ? 1 : -1) + hs(i, 2) * TAU, rr = R * (1.18 + .35 * hs(i, 3)) + Math.sin(T * 2 + i) * 6, x = Math.cos(ang) * rr, y = Math.sin(ang) * rr * .9, s = 6 + 8 * hs(i, 4);
      c.save(); c.translate(x, y); c.rotate(ang * 2 + T); c.fillStyle = `hsla(${(hue + i * 40) % 360},95%,68%,.85)`; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * .55, s * .7); c.lineTo(-s * .55, s * .7); c.closePath(); c.fill(); c.restore();
    }
    c.restore();
  }

  // ---- the ring that fills toward the next tier ----
  function ringMeter(c, el, e, R, dt) {
    const p = FE.PAL[el], T = sp.T, cost = FE.nextStarCost(), rr = R + 24;
    let target, col = p.glow, ready = false, label = false;
    if (e.exo) { target = FE.exoLeft(e) / FE.EXO[e.exo.kind].dur; col = e.exo.kind === 'hole' ? '#ffb15a' : '#8fc2ff'; }
    else if (e.strange) { target = clamp((e.strange.end - Date.now()) / (FE.STRANGE.dur * 1000), 0, 1); col = '#d28bff'; }
    else if (cost == null) { target = 1; label = true; }
    else { target = clamp(e.count / cost, 0, 1); ready = target >= 1; }
    sp.prog += (target - sp.prog) * Math.min(1, dt * 6);
    if (Math.abs(target - sp.prog) < .0005) sp.prog = target;
    const a0 = -Math.PI / 2, a1 = a0 + TAU * sp.prog, pulse = .5 + .5 * Math.sin(T * 3.2);
    c.save(); c.lineCap = 'round';
    c.strokeStyle = 'rgba(190,205,255,.13)'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, rr, 0, TAU); c.stroke();
    c.lineWidth = 1.2; c.strokeStyle = 'rgba(190,205,255,.18)';
    for (let i = 0; i < 20; i++) { const a = a0 + i / 20 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * (rr + 6), Math.sin(a) * (rr + 6)); c.lineTo(Math.cos(a) * (rr + (i % 5 ? 9 : 13)), Math.sin(a) * (rr + (i % 5 ? 9 : 13))); c.stroke(); }
    if (sp.prog > .001) {
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = rgba(col, .18 + (ready ? .3 * pulse : 0)); c.lineWidth = ready ? 16 + 6 * pulse : 11; c.beginPath(); c.arc(0, 0, rr, a0, a1); c.stroke();
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = ready ? mix(col, .45) : col; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, rr, a0, a1); c.stroke();
      if (!ready && sp.prog < .999) { const hx = Math.cos(a1) * rr, hy = Math.sin(a1) * rr; c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(hx, hy, 0, hx, hy, 16); g.addColorStop(0, rgba('#ffffff', .9)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(hx - 16, hy - 16, 32, 32); c.globalCompositeOperation = 'source-over'; }
    }
    if (ready && !e.exo) {                                                   // it glows, and glints run round it
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(0, 0, rr - 6, 0, 0, rr + 46); g.addColorStop(0, rgba(col, .0)); g.addColorStop(.25, rgba(col, .30 + .25 * pulse)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(-rr - 50, -rr - 50, rr * 2 + 100, rr * 2 + 100);
      for (let i = 0; i < 6; i++) { const a = T * .9 + i * TAU / 6, x = Math.cos(a) * rr, y = Math.sin(a) * rr, s = 5 + 4 * Math.sin(T * 5 + i * 2); c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(x - s / 2, y - .6, s, 1.2); c.fillRect(x - .6, y - s / 2, 1.2, s); }
    }
    if (label) { c.strokeStyle = rgba(col, .35); c.lineWidth = 2; c.beginPath(); c.arc(0, 0, rr, 0, TAU); c.stroke(); }
    c.restore();
  }

  // ---- rogue stars and pulses ----
  sp.rogue = done => sp.rogues.push({ t: 0, dur: 2.4, a: rnd(0, TAU), done, hit: false });
  sp.pulse = (x, y, text) => sp.pulses.push({ x, y, t: 0, text });


  // ---- elemental particles from space drifting in toward the star ----
  // Slow when you have passive generators (they have already done the gathering), quick while you are clicking.
  sp.parts = []; sp.cr = 0; sp.cprog = 0; sp.ready = 0; sp.readyT = 0; sp.hA = 0; sp.cond = null; sp.acc = 0;
  sp.click = () => { sp.cr += 1; };                                              // game.js calls this on every click
  function particles(c, el, e, R, dt) {
    const s = FE.core.s, cps = sp.cr * 1.2, passive = FE.rate();
    sp.cr *= Math.exp(-dt * 1.2);
    const rate = Math.max(.35, (2.2 + 1.2 * cps) / (1 + .45 * Math.log10(1 + passive)));
    sp.acc += rate * dt;
    const far = Math.max(FW, FH) / s * .6;
    while (sp.acc >= 1 && sp.parts.length < 220) { sp.acc -= 1; sp.parts.push({ a: rnd(0, TAU), d: far + rnd(0, 120), t: 0, dur: rnd(3.4, 5.4), spin: rnd(-1, 1) * .9, z: rnd(.7, 1.6), seed: Math.random() * 1000 }); }
    if (sp.acc > 3) sp.acc = 0;
    const end = e.exo ? (e.exo.kind === 'hole' ? RH * 1.3 : 30) : R * .96, p = FE.PAL[el];
    for (let i = sp.parts.length - 1; i >= 0; i--) {
      const q = sp.parts[i]; q.t += dt * (1 + cps * .08);
      const u = q.t / q.dur; if (u >= 1) { sp.parts.splice(i, 1); continue; }
      const k = Math.pow(u, 1.7), r = lerp(q.d, end, k), a = q.a + q.spin * k * 2.2, x = Math.cos(a) * r, y = Math.sin(a) * r;
      const k2 = Math.pow(Math.max(0, u - .035), 1.7), r2 = lerp(q.d, end, k2), a2 = q.a + q.spin * k2 * 2.2, px = Math.cos(a2) * r2, py = Math.sin(a2) * r2;
      const al = Math.min(1, u * 8) * (u > .9 ? (1 - u) * 10 : 1) * .9, z = q.z * (1.1 - .5 * u);
      c.globalAlpha = al; c.lineCap = 'round';
      if (el === 'fire') { c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(x, y, 0, x, y, 9 * z); g.addColorStop(0, rgba(p.acc, .9)); g.addColorStop(1, rgba(p.glow, 0)); c.fillStyle = g; c.fillRect(x - 9 * z, y - 9 * z, 18 * z, 18 * z); c.globalCompositeOperation = 'source-over'; }
      else if (el === 'water') { c.strokeStyle = rgba(p.acc, .35); c.lineWidth = 1.5 * z; c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke(); c.fillStyle = p.mid; c.beginPath(); c.arc(x, y, 3.2 * z, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(x - z, y - z, 1.1 * z, 0, TAU); c.fill(); }
      else if (el === 'earth') { c.save(); c.translate(x, y); c.rotate(q.t * 2 + q.seed); c.fillStyle = mix(p.mid, hs(q.seed, 2) * .4 - .2); c.beginPath(); for (let v = 0; v < 5; v++) { const aa = v / 5 * TAU, kk = .7 + .5 * hs(q.seed + v, 3); v ? c.lineTo(Math.cos(aa) * 4 * z * kk, Math.sin(aa) * 4 * z * kk) : c.moveTo(Math.cos(aa) * 4 * z * kk, Math.sin(aa) * 4 * z * kk); } c.closePath(); c.fill(); c.restore(); }
      else { c.strokeStyle = 'rgba(235,248,255,.8)'; c.lineWidth = 1.6 * z; c.beginPath(); c.arc(x, y, 6 * z, a + 1.6, a + 3.4); c.stroke(); c.strokeStyle = rgba(p.glow, .3); c.beginPath(); c.moveTo(px, py); c.lineTo(x, y); c.stroke(); }
    }
    c.globalAlpha = 1;
  }

  // ---- glowing runes round the star once it can be condensed ----
  let runeSet = null;
  function runePaths() {
    if (runeSet) return runeSet;
    const GP = [[-2.2, -4], [2.2, -4], [-2.2, 0], [2.2, 0], [-2.2, 4], [2.2, 4], [0, -4.8], [0, 4.8]];
    runeSet = [];
    for (let k = 0; k < 28; k++) {
      const p = new Path2D();
      for (let j = 0, n = 3 + Math.floor(hs(k, 1) * 3); j < n; j++) { const a = GP[Math.floor(hs(k, 2 + j) * 8)], b = GP[Math.floor(hs(k, 9 + j) * 8)]; if (a !== b) { p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]); } }
      runeSet.push(p);
    }
    return runeSet;
  }
  function runes(f, el, R, a) {
    if (a <= .01) return;
    const p = FE.PAL[el], rr = R + 66, T = sp.T, rp = runePaths();
    f.save(); f.globalAlpha = a; f.rotate(T * .05); f.lineCap = f.lineJoin = 'round';
    f.strokeStyle = rgba(p.glow, .3); f.lineWidth = 1.2; f.beginPath(); f.arc(0, 0, rr - 17, 0, TAU); f.stroke(); f.beginPath(); f.arc(0, 0, rr + 17, 0, TAU); f.stroke();
    for (let i = 0; i < 28; i++) {
      const pulse = .35 + .65 * (.5 + .5 * Math.sin(T * 2.4 - i * .5));
      f.save(); f.rotate(i / 28 * TAU); f.translate(0, -rr); f.scale(4, 4);
      f.globalCompositeOperation = 'lighter'; f.strokeStyle = rgba(p.glow, .4 * pulse); f.lineWidth = 2.4; f.stroke(rp[i]);
      f.globalCompositeOperation = 'source-over'; f.strokeStyle = rgba(mix(p.glow, .6), .55 + .45 * pulse); f.lineWidth = .5; f.stroke(rp[i]);
      f.restore();
    }
    f.restore();
  }

  // ---- the condense circle: blank, then filling with chaotic energy, then brimming; two hands behold it; "Condense" appears ----
  function altarGeom() {
    const b = $('cbtn'); if (!b || b.hidden) return null;
    const cr = b.getBoundingClientRect(), fr = fx.getBoundingClientRect(), s = FE.core.s;
    return { x: (cr.left + cr.width / 2 - (fr.left + fr.width / 2)) / s, y: (cr.top + cr.height / 2 - (fr.top + fr.height / 2)) / s, r: cr.width / 2 / s, hover: b.matches(':hover') && !b.disabled };
  }
  function altar(f, el, g, prog, ready, drain) {
    const p = FE.PAL[el], T = sp.T, Rc = g.r, pulse = .5 + .5 * Math.sin(T * 3.3), q = ready ? 1 : prog;
    f.save(); f.translate(g.x, g.y);
    if (q > .02) {                                                              // light spilling out, more as it fills
      f.globalCompositeOperation = 'lighter';
      const o = f.createRadialGradient(0, 0, Rc * .8, 0, 0, Rc * (1.5 + .6 * q)); o.addColorStop(0, rgba(p.glow, (.1 + .3 * q) * (ready ? .7 + .3 * pulse : 1))); o.addColorStop(1, rgba(p.glow, 0)); f.fillStyle = o; f.fillRect(-Rc * 2.4, -Rc * 2.4, Rc * 4.8, Rc * 4.8);
      f.globalCompositeOperation = 'source-over';
    }
    f.fillStyle = 'rgba(4,6,18,.86)'; f.beginPath(); f.arc(0, 0, Rc, 0, TAU); f.fill();
    f.save(); f.beginPath(); f.arc(0, 0, Rc - 1, 0, TAU); f.clip();
    if (q > .004) {
      const lvl = ready ? -Rc - 8 : Rc - 2 * Rc * q;                            // the energy rises from the bottom of the circle
      f.beginPath(); f.moveTo(-Rc - 4, Rc + 4);
      for (let x = -Rc - 4; x <= Rc + 4; x += 4) f.lineTo(x, lvl + Math.sin(x * .11 + T * 3.2) * 3.2 + Math.sin(x * .27 - T * 5) * 1.6);
      f.lineTo(Rc + 4, Rc + 4); f.closePath(); f.clip();
      const bg2 = f.createLinearGradient(0, Rc, 0, -Rc); bg2.addColorStop(0, rgba(p.acc, .6)); bg2.addColorStop(.6, rgba(p.glow, .42)); bg2.addColorStop(1, rgba(p.dk, .45)); f.fillStyle = bg2; f.fillRect(-Rc, -Rc, Rc * 2, Rc * 2);
      f.globalCompositeOperation = 'lighter';
      const arms = 3 + Math.floor(9 * q);
      for (let k = 0; k < arms; k++) {                                          // swirling tendrils
        const dir = k % 2 ? 1 : -1, a0 = k * TAU / arms + T * (.5 + hs(k, 1)) * dir, tw = 1.6 + 3 * hs(k, 2);
        f.beginPath();
        for (let t = 0; t <= 1; t += .05) { const r = t * Rc * 1.05, a = a0 + t * tw * dir + Math.sin(T * 4 + k + t * 9) * .18; t ? f.lineTo(Math.cos(a) * r, Math.sin(a) * r) : f.moveTo(0, 0); }
        f.strokeStyle = k % 3 === 0 ? 'rgba(255,255,255,.7)' : rgba(k % 3 === 1 ? p.acc : p.glow, .55); f.lineWidth = (.8 + 2.2 * q) * (.6 + .4 * hs(k, 3)); f.stroke();
      }
      for (let i = 0, m = Math.floor(14 + 120 * q); i < m; i++) {               // sparks in a restless crowd
        const a = hs(i, 1) * TAU + T * (.6 + 2 * hs(i, 2)) * (i % 2 ? 1 : -1), rr = Rc * Math.sqrt(hs(i, 3)) * (.7 + .3 * Math.sin(T * 2.5 + i)), jx = Math.sin(T * 11 + i * 3) * 2.2, jy = Math.cos(T * 9 + i * 5) * 2.2;
        f.fillStyle = rgba(hs(i, 4) < .3 ? '#ffffff' : p.acc, .35 + .6 * hs(i, 5)); f.beginPath(); f.arc(Math.cos(a) * rr + jx, Math.sin(a) * rr + jy, .8 + 1.9 * hs(i, 6), 0, TAU); f.fill();
      }
      const nb = 1 + Math.floor(5 * q), sd = Math.floor(T * 9);
      f.lineJoin = 'round';
      for (let b = 0; b < nb; b++) {                                            // little bolts, redrawn many times a second
        const a1 = hs(sd + b, 1) * TAU, a2 = a1 + Math.PI + (hs(sd + b, 2) - .5) * 1.6;
        f.beginPath(); f.moveTo(Math.cos(a1) * Rc, Math.sin(a1) * Rc);
        for (let j = 1; j < 6; j++) { const t = j / 6, mx = lerp(Math.cos(a1), Math.cos(a2), t) * Rc * (1 - .15 * Math.sin(t * Math.PI)), my = lerp(Math.sin(a1), Math.sin(a2), t) * Rc * (1 - .15 * Math.sin(t * Math.PI)); f.lineTo(mx + (hs(sd + b, 3 + j) - .5) * 14, my + (hs(sd + b, 9 + j) - .5) * 14); }
        f.lineTo(Math.cos(a2) * Rc, Math.sin(a2) * Rc); f.strokeStyle = 'rgba(255,255,255,.75)'; f.lineWidth = 1.2; f.stroke();
      }
      const cg = f.createRadialGradient(0, 0, 0, 0, 0, Rc * .8); cg.addColorStop(0, `rgba(255,255,255,${.25 + .35 * q * (ready ? .6 + .4 * pulse : 1)})`); cg.addColorStop(1, rgba(p.glow, 0)); f.fillStyle = cg; f.fillRect(-Rc, -Rc, Rc * 2, Rc * 2);
      f.globalCompositeOperation = 'source-over';
    }
    f.restore();
    f.lineWidth = 2.6; f.strokeStyle = rgba(ready ? mix(p.glow, .4) : p.glow, .3 + .6 * q + (g.hover ? .15 : 0)); f.beginPath(); f.arc(0, 0, Rc, 0, TAU); f.stroke();
    f.lineWidth = 1; f.strokeStyle = rgba(p.glow, .2); f.beginPath(); f.arc(0, 0, Rc + 6, 0, TAU); f.stroke();
    if (ready) {                                                                // brimming: it crawls over the rim and sparks fly off
      f.globalCompositeOperation = 'lighter'; f.lineCap = 'round';
      for (let k = 0; k < 7; k++) { const a = T * (1 + .3 * k) + k * 1.1, sp2 = .25 + .2 * hs(k, 2); f.strokeStyle = rgba(mix(p.glow, .5), .6 + .3 * Math.sin(T * 7 + k)); f.lineWidth = 2.2; f.beginPath(); f.arc(0, 0, Rc + 2 + 3 * Math.sin(T * 6 + k), a, a + sp2); f.stroke(); }
      for (let i = 0; i < 14; i++) { const u = (T * .8 + hs(i, 1)) % 1, a = hs(i, 2) * TAU, rr = Rc * (1 + .7 * u); f.fillStyle = rgba(p.acc, .9 * (1 - u)); f.beginPath(); f.arc(Math.cos(a) * rr, Math.sin(a) * rr - 10 * u, 1.8 * (1 - u) + .4, 0, TAU); f.fill(); }
      f.globalCompositeOperation = 'source-over';
    }
    f.restore();
  }
  function altarText(f, g, a, t) {                                              // "Condense", letter by letter, out of the middle of the circle
    if (a <= .01) return;
    const word = 'Condense', size = g.r * .34;
    f.save(); f.translate(g.x, g.y); f.font = `500 ${size}px "Times New Roman", serif`; f.textBaseline = 'middle'; f.textAlign = 'left';
    const ws = [...word].map(ch => f.measureText(ch).width + size * .1), tot = ws.reduce((x, y) => x + y, 0);
    let x = -tot / 2;
    [...word].forEach((ch, i) => {
      const u = clamp((t - i * .11) / .7, 0, 1), sh = .75 + .25 * Math.sin(sp.T * 3 - i * .7);
      if (u > 0) {
        f.globalAlpha = a * u * sh; f.shadowColor = 'rgba(255,255,255,.95)'; f.shadowBlur = 14 * FE.core.s * dpr;
        f.fillStyle = '#ffffff'; f.fillText(ch, x + (1 - u) * (hs(i, 4) - .5) * 20, (1 - u) * -9);
      }
      x += ws[i];
    });
    f.restore();
  }

  // ---- the hands ----
  let handImg = null;
  function hand() {
    if (handImg) return handImg;
    const c = (handImg = mk(170, 210)).getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 210); g.addColorStop(0, '#f6f9ff'); g.addColorStop(1, '#a9bdf2');
    c.fillStyle = g; c.strokeStyle = g; c.lineCap = c.lineJoin = 'round';
    c.lineWidth = 14; c.beginPath(); c.moveTo(66, 203); c.lineTo(104, 203); c.lineTo(112, 130); c.lineTo(58, 130); c.closePath(); c.fill(); c.stroke();
    [[64, -7, 62], [80, -2, 76], [96, 3, 70], [111, 8, 52]].forEach(([x, dx, L]) => { c.lineWidth = 17; c.beginPath(); c.moveTo(x, 134); c.lineTo(x + dx, 134 - L); c.stroke(); });
    c.lineWidth = 18; c.beginPath(); c.moveTo(60, 172); c.lineTo(36, 140); c.lineTo(28, 114); c.stroke();
    c.strokeStyle = 'rgba(80,110,200,.5)'; c.lineWidth = 1.6;
    [72, 88, 103].forEach((x, i) => { c.beginPath(); c.moveTo(x, 132); c.lineTo(x + [-2, 0, 2][i], 98 - i * 4); c.stroke(); });
    c.beginPath(); c.moveTo(70, 160); c.quadraticCurveTo(86, 172, 104, 158); c.stroke();
    return handImg;
  }
  function drawHand(f, x, y, lean, sc, side, a) {
    if (a <= .01) return;
    f.save(); f.translate(x, y); f.scale(side, 1); f.rotate(-lean); f.scale(sc, sc);
    f.globalAlpha = a; f.shadowColor = 'rgba(175,205,255,.95)'; f.shadowBlur = 16 * FE.core.s * dpr;
    f.drawImage(hand(), -85, -205);
    f.restore();
  }
  const ease = u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  // what the hands do when "Condense" is clicked (t in seconds): rise to cup the star, clasp, rays, flash, let go
  const SEQ = { rise: 1.2, clasp: 2.0, rays: 2.5, end: 3.5, call: 1.6 };
  FE.space.startCondense = function () {
    const e = FE.E(), cost = FE.nextStarCost();
    if (sp.cond || FE.collapsing || FE.modalOpen || cost == null || e.exo || e.strange || e.count < cost) return;
    sp.cond = { t: 0, called: false };
    FE.condensing = true;
  };
  function endCond() { if (sp.cond && !sp.cond.called) FE.condense(); sp.cond = null; FE.condensing = false; }
  function sequence(f, el, g, R, dt) {
    const c = sp.cond, p = FE.PAL[el]; c.t += dt;
    const t = c.t, idle = { x: g.x, y: g.y, r: g.r };
    if (!c.called && t >= SEQ.call) { c.called = true; FE.condense(); }
    const hp = side => {                                                         // where one hand is, at time t
      const sc0 = g.r * .0072, sc1 = Math.max(.6, R * .0095);
      const A = { x: g.x + side * g.r * 1.75, y: g.y + g.r * .35 + Math.sin(sp.T * 1.5 + side) * 2, lean: .6, sc: sc0, a: .5 };
      const B = { x: side * R * 1.12, y: R * 1.0, lean: .32, sc: sc1, a: .7 };
      const C = { x: side * R * .1, y: R * .72, lean: .02, sc: sc1, a: .8 };
      const D = { x: side * R * 1.7, y: R * .95, lean: .5, sc: sc1, a: 0 };
      const mixp = (u, v, k) => ({ x: lerp(u.x, v.x, k), y: lerp(u.y, v.y, k) - Math.sin(k * Math.PI) * 14 * (u === A ? 1 : 0), lean: lerp(u.lean, v.lean, k), sc: lerp(u.sc, v.sc, k), a: lerp(u.a, v.a, k) });
      if (t < SEQ.rise) return mixp(A, B, ease(t / SEQ.rise));
      if (t < SEQ.clasp) return mixp(B, C, ease((t - SEQ.rise) / (SEQ.clasp - SEQ.rise)));
      if (t < SEQ.rays) return C;
      return mixp(C, D, ease(clamp((t - SEQ.rays) / (SEQ.end - SEQ.rays), 0, 1)));
    };
    // the circle's energy flows up to the star while the hands rise
    if (t > .5 && t < SEQ.clasp) {
      f.save(); f.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) {
        const u = ((t - .5) * .9 + i / 26) % 1, k = ease(u), bx = lerp(g.x, 0, k) + Math.sin(i * 7 + t * 3) * 26 * Math.sin(k * Math.PI), by = lerp(g.y, 0, k);
        f.fillStyle = rgba(i % 3 ? p.acc : '#ffffff', .85 * Math.sin(u * Math.PI)); f.beginPath(); f.arc(bx, by, 2.4 + 2 * (1 - u), 0, TAU); f.fill();
      }
      f.restore();
    }
    for (const side of [-1, 1]) { const h = hp(side); drawHand(f, h.x, h.y, h.lean, h.sc, side, h.a); }
    if (t > SEQ.clasp - .3 && t < SEQ.end) {                                     // rays pour out from the clasped hands
      const u = clamp((t - (SEQ.clasp - .3)) / (SEQ.rays - SEQ.clasp + .3), 0, 1), fade = t > SEQ.rays ? clamp(1 - (t - SEQ.rays) / .6, 0, 1) : 1, L = Math.max(FW, FH) / FE.core.s * .8;
      f.save(); f.globalCompositeOperation = 'lighter'; f.translate(0, -R * .1);
      const gl = f.createRadialGradient(0, 0, 0, 0, 0, R * 1.4 * (.4 + u)); gl.addColorStop(0, `rgba(255,250,225,${.7 * u * fade})`); gl.addColorStop(1, rgba(p.glow, 0)); f.fillStyle = gl; f.fillRect(-R * 2, -R * 2, R * 4, R * 4);
      for (let i = 0; i < 18; i++) {
        const a = i / 18 * TAU + sp.T * .5, w = .05 + .04 * hs(i, 1), len = L * u * (.5 + .5 * hs(i, 2));
        const g2 = f.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len); g2.addColorStop(0, `rgba(255,248,220,${.55 * fade})`); g2.addColorStop(1, 'rgba(255,248,220,0)');
        f.fillStyle = g2; f.beginPath(); f.moveTo(0, 0); f.lineTo(Math.cos(a - w) * len, Math.sin(a - w) * len); f.lineTo(Math.cos(a + w) * len, Math.sin(a + w) * len); f.closePath(); f.fill();
      }
      f.restore();
    }
    if (t > SEQ.rays && t < SEQ.rays + .7) {                                      // the flash into the new star
      const u = (t - SEQ.rays) / .7;
      f.save(); f.globalCompositeOperation = 'lighter'; const fl = f.createRadialGradient(0, 0, 0, 0, 0, 460); fl.addColorStop(0, `rgba(255,255,255,${1 - u})`); fl.addColorStop(.5, rgba(p.glow, .6 * (1 - u))); fl.addColorStop(1, rgba(p.glow, 0)); f.fillStyle = fl; f.fillRect(-460, -460, 920, 920);
      f.strokeStyle = `rgba(255,255,255,${.8 * (1 - u)})`; f.lineWidth = 7 * (1 - u) + 1; f.beginPath(); f.arc(0, 0, R * (1 + 3.2 * easeOut(u)), 0, TAU); f.stroke(); f.restore();
    }
    if (t >= SEQ.end) endCond();
  }

  // ---- one frame ----
  let last = performance.now(), fpsSkip = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (FE.view !== 1 || document.hidden || !FE.state.cur || !FE.core.cv) return;
    resize();
    if (!PW || !FW) return;
    sp.T += dt;
    const T = sp.T, el = FE.el(), e = FE.E(), p = FE.PAL[el], s = FE.core.s, R = FE.core.radius();
    const tgt = e.exo ? (e.exo.kind === 'hole' ? 5 : 4) : e.tier;
    sp.flair += (tgt - sp.flair) * Math.min(1, dt * .9);
    sp.hole += ((e.exo && e.exo.kind === 'hole' ? 1 : 0) - sp.hole) * Math.min(1, dt * 1.6);
    sp.neutron += ((e.exo && e.exo.kind === 'neutron' ? 1 : 0) - sp.neutron) * Math.min(1, dt * 1.6);
    sp.strange += ((e.strange ? 1 : 0) - sp.strange) * Math.min(1, dt * 1.6);
    const xo = sp.hole > .5 ? 'hole' : sp.neutron > .5 ? 'neutron' : '';
    if (xo) document.body.dataset.exo = xo; else delete document.body.dataset.exo;   // (an empty data-exo would still match body[data-exo] and hide the star)
    const rect = FE.core.cv.getBoundingClientRect(), pr = bg.getBoundingClientRect();
    cx = rect.left + rect.width / 2 - pr.left; cy = rect.top + rect.height / 2 - pr.top;
    const live = FE.state.orbit.filter(o => o.end > Date.now());

    // ===== behind the star =====
    const c = cb;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#03040b'; c.fillRect(0, 0, PW, PH);
    let vg = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(PW, PH) * .75); vg.addColorStop(0, rgba(p.glow, .09 + .02 * sp.flair)); vg.addColorStop(.5, rgba(p.dk, .05)); vg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = vg; c.fillRect(0, 0, PW, PH);
    c.drawImage(nebLayer(el, 0), 0, 0, PW, PH);
    for (let i = 1; i <= 5; i++) { const al = clamp(sp.flair - (i - 1), 0, 1); if (al <= .01) continue; c.globalAlpha = al; c.drawImage(nebLayer(el, i), 0, 0, PW, PH); if (i >= 2) c.drawImage(deepLayer(i), 0, 0, PW, PH); c.globalAlpha = 1; }
    // stars: more of them the higher the tier. Near a black hole their light is bent outward round it.
    const N = Math.floor(70 + 62 * sp.flair), Rs = RH * s * 1.15 * sp.hole;
    for (let j = 0; j < N + 8; j++) {
      const fade = j < N ? 1 : (N + 8 - j) / 9 * (sp.flair % 1), depth = .2 + .8 * hs(j, 4);
      let x = (hs(j, 1) * PW + T * (1.5 + 5 * depth)) % PW, y = hs(j, 2) * PH;
      if (Rs > 1) { const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy) || 1, r2 = .5 * (r + Math.sqrt(r * r + 4 * Rs * Rs)); x = cx + dx / r * r2; y = cy + dy / r * r2; }
      const a = (.3 + .7 * hs(j, 5)) * (.65 + .35 * Math.sin(T * (.6 + 2.2 * hs(j, 6)) + j)) * fade, z = .6 + 1.7 * Math.pow(hs(j, 3), 3) * (.6 + .4 * depth);
      c.fillStyle = hs(j, 7) < .2 ? `rgba(255,214,170,${a})` : hs(j, 7) < .4 ? `rgba(170,200,255,${a})` : `rgba(255,255,255,${a})`;
      c.fillRect(x, y, z, z);
    }
    if (sp.flair > 1.5 && !sp.shoot && Math.random() < dt * .18) sp.shoot = { t: 0, x: rnd(PW * .2, PW), y: rnd(0, PH * .5), v: rnd(500, 800) };
    if (sp.shoot) { const q = sp.shoot; q.t += dt; const x = q.x - q.v * q.t * .8, y = q.y + q.v * q.t * .35, g = c.createLinearGradient(x, y, x + 90, y - 38); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = g; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 90, y - 38); c.stroke(); if (q.t > 1.1) sp.shoot = null; }
    // everything below is placed from the middle of the star, in star units
    c.setTransform(s * dpr, 0, 0, s * dpr, cx * dpr, cy * dpr);
    particles(c, el, e, R, dt);
    live.forEach((o, i) => { const ps = orbitPose(o, i, R); c.save(); c.rotate(ps.rot); c.strokeStyle = 'rgba(170,190,255,.11)'; c.lineWidth = 1 / s * 1.2; c.setLineDash([5, 7]); c.beginPath(); c.ellipse(ps.ox, 0, ps.a, ps.b, 0, 0, TAU); c.stroke(); c.restore(); });
    live.forEach((o, i) => { const ps = orbitPose(o, i, R); if (!ps.front) drawOrbiter(c, o, ps); });
    neutronBack(c, sp.neutron); holeBack(c, sp.hole);

    // ===== in front of the star =====
    const f = cf;
    f.setTransform(1, 0, 0, 1, 0, 0); f.clearRect(0, 0, fx.width, fx.height);
    f.setTransform(s * dpr, 0, 0, s * dpr, fx.width / 2, fx.height / 2);
    live.forEach((o, i) => { const ps = orbitPose(o, i, R); if (ps.front) drawOrbiter(f, o, ps); });
    holeFront(f, sp.hole); neutronFront(f, sp.neutron);
    if (sp.hole < .5 && sp.neutron < .5) strangeFront(f, sp.strange, R);
    if (!FE.core.pending && !FE.collapsing) ringMeter(f, el, e, R, dt);
    // ready to condense? the runes, the circle, the hands
    const cost = FE.nextStarCost(), canCond = cost != null && !e.exo && !e.strange, condP = canCond ? clamp(e.count / cost, 0, 1) : 0, ready = canCond && condP >= 1 && !FE.collapsing;
    sp.cprog += (condP - sp.cprog) * Math.min(1, dt * 5); if (Math.abs(condP - sp.cprog) < .001) sp.cprog = condP;
    sp.ready += ((ready ? 1 : 0) - sp.ready) * Math.min(1, dt * 1.8);
    sp.readyT = ready ? sp.readyT + dt : 0;
    sp.hA += ((ready && sp.readyT > .9 ? 1 : 0) - sp.hA) * Math.min(1, dt * (ready ? 1.4 : 5));
    if (!FE.core.pending) runes(f, el, R, sp.ready);
    const ag = canCond ? altarGeom() : null;
    if (ag) {
      altar(f, el, ag, sp.cond ? Math.max(0, 1 - sp.cond.t / 1.4) * condP : sp.cprog, ready && !sp.cond, 0);
      if (sp.cond) sequence(f, el, ag, R, dt);
      else {
        const hh = sp.hA * .5, bob = Math.sin(sp.T * 1.5) * 2;                    // two hands hold the circle like a relic
        drawHand(f, ag.x - ag.r * 1.75, ag.y + ag.r * .35 + bob, .6, ag.r * .0072, -1, hh * (ready ? 1 : sp.hA));
        drawHand(f, ag.x + ag.r * 1.75, ag.y + ag.r * .35 + bob, .6, ag.r * .0072, 1, hh * (ready ? 1 : sp.hA));
        altarText(f, ag, ready ? sp.hA : 0, sp.readyT - 2);
      }
    } else if (sp.cond) endCond();

    for (let i = sp.rogues.length - 1; i >= 0; i--) {                         // a rogue star falls into yours
      const q = sp.rogues[i]; q.t += dt;
      const D = Math.max(FW, FH) / s * .62, u = clamp(q.t / q.dur, 0, 1), d = D * (1 - u * u), x = Math.cos(q.a) * d, y = Math.sin(q.a) * d;
      if (u < 1) {
        f.save(); f.globalCompositeOperation = 'lighter';
        const tx = Math.cos(q.a) * (d + 190), ty = Math.sin(q.a) * (d + 190), g = f.createLinearGradient(x, y, tx, ty); g.addColorStop(0, 'rgba(190,225,255,.85)'); g.addColorStop(1, 'rgba(190,225,255,0)');
        f.strokeStyle = g; f.lineWidth = 8; f.lineCap = 'round'; f.beginPath(); f.moveTo(x, y); f.lineTo(tx, ty); f.stroke();
        const g2 = f.createRadialGradient(x, y, 0, x, y, 34); g2.addColorStop(0, 'rgba(255,255,255,1)'); g2.addColorStop(.3, 'rgba(160,210,255,.6)'); g2.addColorStop(1, 'rgba(160,210,255,0)'); f.fillStyle = g2; f.fillRect(x - 34, y - 34, 68, 68);
        f.restore();
      } else {
        if (!q.hit) { q.hit = true; q.done(); }
        const w = (q.t - q.dur) / .7;
        if (w < 1) { f.save(); f.globalCompositeOperation = 'lighter'; const g = f.createRadialGradient(0, 0, 0, 0, 0, 280); g.addColorStop(0, `rgba(255,255,255,${.9 * (1 - w)})`); g.addColorStop(1, 'rgba(160,210,255,0)'); f.fillStyle = g; f.fillRect(-280, -280, 560, 560); f.strokeStyle = `rgba(190,225,255,${1 - w})`; f.lineWidth = 6 * (1 - w); f.beginPath(); f.arc(0, 0, R * (1 + 2.2 * easeOut(w)), 0, TAU); f.stroke(); f.restore(); }
        else sp.rogues.splice(i, 1);
      }
    }
    f.font = '600 22px "Times New Roman", serif'; f.textAlign = 'center';
    for (let i = sp.pulses.length - 1; i >= 0; i--) {                          // antimatter from a click
      const q = sp.pulses[i]; q.t += dt; if (q.t > 1) { sp.pulses.splice(i, 1); continue; }
      f.globalAlpha = 1 - q.t * q.t; f.strokeStyle = 'rgba(170,230,255,.8)'; f.lineWidth = 2.5 * (1 - q.t); f.beginPath(); f.arc(0, 0, 30 + 90 * easeOut(q.t), 0, TAU); f.stroke();
      f.fillStyle = '#bff0ff'; f.fillText('+' + q.text, q.x, q.y - 40 - 46 * easeOut(q.t)); f.globalAlpha = 1;
    }
  }

  FE.buildSpace = function () {
    bg = $('space'); fx = $('fx'); cb = bg.getContext('2d'); cf = fx.getContext('2d');
    new ResizeObserver(resize).observe($('page1'));
    addEventListener('resize', resize);
    resize();
    requestAnimationFrame(frame);
  };
});
