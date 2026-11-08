/* effects.js - the middle of layer 1: the round button, the five tiers of star for each element, the bits of element that
 * stick to it, the condensing animation, and the supernova. All drawn on canvas, in a 560 x 560 box scaled to the screen. */
FE.module(function (FE) {
  const $ = FE.$, TAU = Math.PI * 2, BOX = 560, C0 = BOX / 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const easeIO = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const backOut = p => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  const hs = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };   // stable pseudo-random
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
  const mix = (h, f) => { const t = f > 0 ? 255 : 0, k = Math.abs(f); return '#' + rgb(h).map(v => Math.round(lerp(v, t, k)).toString(16).padStart(2, '0')).join(''); };
  const dark = () => { const t = document.documentElement.dataset.theme; return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches); };

  const PAL = {
    air:   { core: '#ffffff', mid: '#bfe3f2', edge: '#6db4d0', glow: '#8fd3ee', acc: '#ffffff', dk: '#4a9bb8' },
    water: { core: '#d9f1ff', mid: '#4a97e8', edge: '#1c5aae', glow: '#3fa0ff', acc: '#a8ecff', dk: '#1a4f99' },
    earth: { core: '#ffe9b0', mid: '#b9884f', edge: '#5a3b20', glow: '#e0a74f', acc: '#ffd36b', dk: '#3a2614' },
    fire:  { core: '#fff6c0', mid: '#f2683a', edge: '#b32a0e', glow: '#ff8a3d', acc: '#ffd36b', dk: '#8e1f08' }
  };
  FE.PAL = PAL;
  const RADIUS = [84, 96, 114, 134, 156, 180];            // button, then tiers 1-5

  // the element's glyph, as Path2D objects (the same icons the rest of the game uses)
  const glyphs = {};
  const glyph = el => glyphs[el] || (glyphs[el] = [...FE.ICONS[el].matchAll(/<path d="([^"]+)"[^>]*?stroke-width="([\d.]+)"/g)].map(m => [new Path2D(m[1]), +m[2]]));

  const core = FE.core = {
    cv: null, ctx: null, k: 1, T: 0, vis: 0, pending: null, animT: 0, popT: 9, press: 0, hover: 0, shake: 0, charge: 0, btnR: 0,
    stuck: [], fly: [], rips: [], floats: [], puffs: []
  };
  const N_STUCK = 150;

  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function glowAt(ctx, x, y, r, c, a) {
    if (a <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, a)); g.addColorStop(.35, rgba(c, a * .45)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ---- a bit of the element, drawn where it has stuck to the edge ----
  function bit(ctx, el, x, y, r, rot, seed, al) {
    const p = PAL[el];
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha = al;
    if (el === 'water') {
      ctx.fillStyle = mix(p.mid, .15 * (hs(seed, 1) - .3)); circle(ctx, 0, 0, r); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; circle(ctx, -r * .3, -r * .35, r * .3); ctx.fill();
    } else if (el === 'earth') {
      ctx.fillStyle = mix(p.mid, hs(seed, 2) * .35 - .25); ctx.strokeStyle = p.dk; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, k = .7 + .5 * hs(seed + i, 3); i ? ctx.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k) : ctx.moveTo(Math.cos(a) * r * k, Math.sin(a) * r * k); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (el === 'fire') {
      glowAt(ctx, 0, 0, r * 2.6, p.glow, .55);
      ctx.fillStyle = hs(seed, 4) < .5 ? p.acc : p.core; circle(ctx, 0, 0, r * .55); ctx.fill();
    } else {
      ctx.strokeStyle = p.dk; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.2, r * .32);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.5, -1.1, 1.1); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(.8, r * .2); ctx.beginPath(); ctx.arc(0, 0, r * 1.5, -1.1, 1.1); ctx.stroke();
    }
    ctx.restore();
  }

  // ---- the round button (no star yet) ----
  function drawButton(ctx, el, R, hover, press, prog) {
    const p = PAL[el], T = core.T;
    glowAt(ctx, C0, C0, R * (1.9 + .2 * hover), p.glow, (.16 + .3 * prog + .1 * hover) * (.92 + .08 * Math.sin(T * 2)));
    const r = R * (1 + .03 * hover - .05 * press);
    const g = ctx.createRadialGradient(C0 - r * .3, C0 - r * .35, r * .1, C0, C0, r);
    g.addColorStop(0, mix(p.mid, .55)); g.addColorStop(.55, p.mid); g.addColorStop(1, p.edge);
    ctx.fillStyle = g; circle(ctx, C0, C0, r); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = rgba(p.core, .75); circle(ctx, C0, C0, r - 1.5); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = rgba(p.dk, .5); circle(ctx, C0, C0, r * .8); ctx.stroke();
    const k = r / 14;                                        // the element's symbol in the middle
    ctx.save(); ctx.translate(C0 - 12 * k, C0 - 12 * k); ctx.scale(k, k); ctx.strokeStyle = rgba(p.core, .9); ctx.lineCap = ctx.lineJoin = 'round';
    for (const [path, lw] of glyph(el)) { ctx.lineWidth = lw; ctx.stroke(path); }
    ctx.restore();
  }

  // ---- the inside of a star, clipped to its disc ----
  function surface(ctx, el, R, tier, T) {
    const p = PAL[el];
    if (el === 'fire') {
      for (let i = 0; i < 30; i++) {
        const a = hs(i, 1) * TAU + T * .1 * (.4 + hs(i, 2)), d = Math.sqrt(hs(i, 3)) * R * .95, r = R * (.1 + .2 * hs(i, 4)), x = Math.cos(a) * d, y = Math.sin(a) * d;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r), hot = i % 3 === 0;
        g.addColorStop(0, rgba(hot ? p.acc : p.dk, hot ? .5 : .4)); g.addColorStop(1, rgba(hot ? p.acc : p.dk, 0));
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    } else if (el === 'water') {
      ctx.lineCap = 'round';
      for (let b = 0; b < 8; b++) {
        const y0 = -R + (b + .5) * 2 * R / 8;
        ctx.strokeStyle = rgba(p.acc, .22 + .12 * (b % 2)); ctx.lineWidth = R * .06; ctx.beginPath();
        for (let x = -R; x <= R; x += 8) { const y = y0 + Math.sin(x * .03 + T * (.7 + b * .12) + b) * R * .07; x === -R ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
      }
      for (let i = 0; i < 7; i++) { const t = (T * .12 * (.5 + hs(i, 1)) + hs(i, 2)) % 1, x = (hs(i, 3) - .5) * R * 1.4, y = R * .8 - t * R * 1.6; ctx.strokeStyle = rgba('#ffffff', .5 * Math.sin(t * Math.PI)); ctx.lineWidth = 1.2; circle(ctx, x, y, R * (.03 + .04 * hs(i, 4))); ctx.stroke(); }
    } else if (el === 'earth') {
      for (let i = 0; i < 16; i++) {
        const cx = (hs(i, 1) - .5) * R * 1.8, cy = (hs(i, 2) - .5) * R * 1.8, s = R * (.18 + .25 * hs(i, 3));
        ctx.fillStyle = hs(i, 4) < .5 ? rgba(p.dk, .22) : rgba(p.core, .16); ctx.beginPath();
        for (let v = 0; v < 4; v++) { const a = v / 4 * TAU + hs(i, 5) * 2, k = .6 + .6 * hs(i + v, 6); v ? ctx.lineTo(cx + Math.cos(a) * s * k, cy + Math.sin(a) * s * k) : ctx.moveTo(cx + Math.cos(a) * s * k, cy + Math.sin(a) * s * k); }
        ctx.closePath(); ctx.fill();
      }
      ctx.lineCap = ctx.lineJoin = 'round';
      for (let i = 0; i < 7; i++) {
        const a0 = hs(i, 7) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a0) * R * .08, Math.sin(a0) * R * .08);
        for (let j = 1; j <= 7; j++) { const a = a0 + (hs(i * 13 + j, 8) - .5) * .7, r = R * j / 6.5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        const pulse = .55 + .35 * Math.sin(T * 1.6 + i);
        ctx.strokeStyle = rgba(p.dk, .8); ctx.lineWidth = 4.5; ctx.stroke();
        ctx.strokeStyle = rgba(p.acc, pulse); ctx.lineWidth = 2; ctx.stroke();
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const a = hs(i, 1) * TAU + T * .12, d = Math.sqrt(hs(i, 2)) * R * .8, r = R * (.2 + .25 * hs(i, 3)), x = Math.cos(a) * d, y = Math.sin(a) * d;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.lineCap = 'round';
      for (let arm = 0; arm < 3; arm++) {
        ctx.beginPath();
        for (let t = 0; t <= 1; t += .04) { const r = t * R * .95, a = arm * TAU / 3 + t * 4.2 + T * .45; t ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(0, 0); }
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = R * .035; ctx.stroke();
        ctx.strokeStyle = rgba(p.dk, .25); ctx.lineWidth = R * .012; ctx.stroke();
      }
    }
    // light on the left, the edge darker
    const sh = ctx.createRadialGradient(-R * .25, -R * .3, R * .2, 0, 0, R);
    sh.addColorStop(0, 'rgba(255,255,255,.18)'); sh.addColorStop(.6, 'rgba(0,0,0,0)'); sh.addColorStop(1, rgba(p.edge, el === 'air' ? .4 : .65));
    ctx.fillStyle = sh; ctx.fillRect(-R, -R, R * 2, R * 2);
  }

  // ---- what a higher tier adds around the body ----
  function decor(ctx, el, R, tier, T, boost) {
    const p = PAL[el];
    if (el === 'fire' && tier >= 2) {
      const n = 3 + tier * 2;
      ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const a = hs(i, 1) * TAU + T * .06 * (hs(i, 2) - .3), span = .22 + .22 * hs(i, 3), lift = R * (.14 + .1 * tier * hs(i, 4)) * (.75 + .25 * Math.sin(T * 2.2 + i * 2));
        const x0 = Math.cos(a) * R * .99, y0 = Math.sin(a) * R * .99, x1 = Math.cos(a + span) * R * .99, y1 = Math.sin(a + span) * R * .99, m = a + span / 2, mx = Math.cos(m) * (R + lift * 1.9), my = Math.sin(m) * (R + lift * 1.9);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1);
        ctx.strokeStyle = rgba(p.glow, .55); ctx.lineWidth = R * .08; ctx.stroke();
        ctx.strokeStyle = rgba(p.acc, .85); ctx.lineWidth = R * .025; ctx.stroke();
      }
    } else if (el === 'water' && tier >= 2) {
      for (let i = 0; i < tier; i++) {
        const t = (T * .22 + i / tier) % 1;
        ctx.strokeStyle = rgba(p.acc, .6 * (1 - t)); ctx.lineWidth = 2 + 2 * (1 - t); circle(ctx, 0, 0, R * (1.04 + .55 * t)); ctx.stroke();
      }
      if (tier >= 4) {
        ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) { const a = T * .3 + i * TAU / 5; ctx.strokeStyle = rgba(p.glow, .5); ctx.lineWidth = R * .05; ctx.beginPath(); ctx.arc(0, 0, R * (1.22 + .05 * Math.sin(T + i)), a, a + .5); ctx.stroke(); }
      }
    } else if (el === 'earth' && tier >= 2) {
      const n = 8 + tier * 3;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + hs(i, 1) * .1, len = R * (.1 + .2 * hs(i, 2) + .02 * tier) * (.85 + .15 * Math.sin(T * 1.4 + i)), w = R * (.05 + .03 * hs(i, 3));
        ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(R * .95, -w); ctx.lineTo(R + len, 0); ctx.lineTo(R * .95, w); ctx.closePath();
        ctx.fillStyle = i % 2 ? p.acc : p.core; ctx.strokeStyle = p.dk; ctx.lineWidth = 1.2; ctx.fill(); ctx.stroke(); ctx.restore();
      }
    } else if (el === 'air' && tier >= 2) {
      ctx.lineCap = 'round';
      for (let i = 0; i < 3 + tier * 2; i++) {
        const a = T * (.25 + .1 * hs(i, 1)) * (i % 2 ? 1 : -1) + hs(i, 2) * TAU, r = R * (1.1 + .4 * hs(i, 3)), len = .5 + .8 * hs(i, 4);
        ctx.strokeStyle = rgba(i % 2 ? p.glow : '#ffffff', .6); ctx.lineWidth = 1.5 + 2 * hs(i, 5); ctx.beginPath(); ctx.arc(0, 0, r, a, a + len); ctx.stroke();
      }
    }
    // bodies in orbit, one more for each tier from the third
    for (let i = 0; i < Math.max(0, tier - 2); i++) {
      const orbit = R * (1.28 + .13 * i), a = T * (.5 - .12 * i) + i * 2.1, tilt = .38 + .1 * i;
      if (tier >= 4) { ctx.strokeStyle = rgba(p.glow, .16); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, orbit, orbit * tilt, 0, 0, TAU); ctx.stroke(); }
      const x = Math.cos(a) * orbit, y = Math.sin(a) * orbit * tilt;
      glowAt(ctx, x, y, R * .3, p.glow, .6);
      ctx.fillStyle = el === 'earth' ? p.mid : el === 'fire' ? p.acc : p.core; circle(ctx, x, y, R * (.06 + .015 * i)); ctx.fill();
    }
  }

  function drawStar(ctx, el, tier, R, boost) {
    const p = PAL[el], T = core.T, dk = dark();
    const gr = R * (1.6 + .3 * tier) * (1 + .12 * boost), pulse = .9 + .1 * Math.sin(T * 1.6);
    ctx.save(); ctx.globalCompositeOperation = dk ? 'lighter' : 'source-over';
    glowAt(ctx, C0, C0, Math.min(C0, gr), p.glow, (.5 + .08 * tier + .3 * boost) * pulse);
    if (tier >= 4) glowAt(ctx, C0, C0, C0, p.glow, .28 * pulse);
    ctx.restore();
    ctx.save(); ctx.translate(C0, C0);
    decor(ctx, el, R, tier, T, boost);
    ctx.save(); circle(ctx, 0, 0, R); ctx.clip();
    const g = ctx.createRadialGradient(-R * .2, -R * .25, 0, 0, 0, R);
    g.addColorStop(0, p.core); g.addColorStop(.5, mix(p.mid, .2)); g.addColorStop(1, p.mid);
    ctx.fillStyle = g; ctx.fillRect(-R, -R, R * 2, R * 2);
    surface(ctx, el, R, tier, T);
    ctx.restore();
    ctx.strokeStyle = rgba(p.core, .55); ctx.lineWidth = 2; circle(ctx, 0, 0, R - 1); ctx.stroke();
    ctx.restore();
  }

  // ---- bits of element that fly in and stick to the edge: the more you hold toward the next star, the thicker the rim ----
  const rimR = () => RADIUS[core.vis] + (core.vis ? 4 : 2);
  function spawnFly(x, y, ghost) {
    core.fly.push({ sx: x, sy: y, a: rand(TAU), off: rand(-1, 3.5), t: 0, dur: rand(.45, .85), r: rand(3, 6.5), seed: Math.random() * 1000, ghost: !!ghost, bend: rand(-1, 1) });
  }
  function farPoint() { const a = rand(TAU), d = rand(250, 300); return [C0 + Math.cos(a) * d, C0 + Math.sin(a) * d]; }
  function stuckPos(b, spin) { const a = b.a + spin, r = rimR() + b.off + b.r * .4; return [C0 + Math.cos(a) * r, C0 + Math.sin(a) * r, a]; }
  function puff(x, y, el) { core.puffs.push({ x, y, t: 0 }); }

  // a click on the button or star: a ripple, a floating number, and a few bits flying in
  core.click = function (lx, ly, text) {
    core.rips.push({ t: 0 });
    core.floats.push({ x: lx + rand(-10, 10), y: ly - 10, t: 0, text });
    for (let i = 0; i < 3; i++) spawnFly(lx + rand(-8, 8), ly + rand(-8, 8), true);
    core.press = 1;
  };
  // the button becomes a star (tier is the new tier): everything is drawn in, there is a flash, and the star pops out
  core.condense = function (tier) { core.pending = tier; core.animT = 0; core.fly.length = 0; };
  // set the look straight from the state (loading, restart, after a collapse)
  core.radius = () => RADIUS[core.vis];
  core.sync = function () { core.vis = FE.state.tier; core.pending = null; core.stuck.length = 0; core.fly.length = 0; core.popT = 9; };

  function resize() {
    const cv = core.cv, w = cv.clientWidth || BOX, dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = cv.height = Math.round(w * dpr); core.k = cv.width / BOX;
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (FE.view !== 1 || document.hidden || !FE.state.owned.length) return;
    core.T += dt;
    const ctx = core.ctx, el = FE.el(), s = FE.state, T = core.T, p = PAL[el];
    if (!core.pending && core.vis !== s.tier) core.vis = s.tier;       // anything else that changed the tier
    const cost = FE.nextStarCost(), prog = cost ? clamp(s.count / cost, 0, 1) : 0, target = Math.floor(prog * N_STUCK);
    core.press += (0 - core.press) * Math.min(1, dt * 9);
    core.hover += ((core.hoverOn ? 1 : 0) - core.hover) * Math.min(1, dt * 8);
    ctx.setTransform(core.k, 0, 0, core.k, 0, 0);
    ctx.clearRect(0, 0, BOX, BOX);
    let shx = 0, shy = 0;
    if (core.shake) { shx = rand(-1, 1) * core.shake; shy = rand(-1, 1) * core.shake; ctx.translate(shx, shy); }

    // bits: too few on the rim -> more fly in; too many (after buying something) -> the extras drop away
    if (!core.pending) {
      let need = target - core.stuck.length - core.fly.filter(f => !f.ghost).length;
      for (let n = 0; need > 0 && n < 3; n++, need--) { const [x, y] = farPoint(); spawnFly(x, y, false); }
      for (let n = 0; core.stuck.length > target && n < 4; n++) { const b = core.stuck.splice(Math.floor(Math.random() * core.stuck.length), 1)[0], [x, y] = stuckPos(b, T * .12 * (core.vis ? 1 : 0)); puff(x, y, el); }
    }
    const spin = core.vis ? T * .12 : 0;
    for (let i = core.fly.length - 1; i >= 0; i--) {
      const f = core.fly[i]; f.t += dt;
      const e = easeOut(Math.min(1, f.t / f.dur)), [tx, ty] = stuckPos(f, spin);
      f.x = lerp(f.sx, tx, e) + Math.sin(e * Math.PI) * 26 * f.bend; f.y = lerp(f.sy, ty, e) + Math.sin(e * Math.PI) * 18 * f.bend;
      if (f.t >= f.dur) {
        core.fly.splice(i, 1);
        if (!core.pending && core.stuck.length < target) core.stuck.push({ a: f.a - spin, off: f.off, r: f.r, seed: f.seed }); else puff(tx, ty, el);
      }
    }

    // the body
    let boost = core.charge;
    if (core.pending) {                                               // condensing
      core.animT += dt;
      const t = core.animT, pull = easeIO(clamp(t / .9, 0, 1));
      for (const b of core.stuck) { const a = b.a + spin; b.cx = C0 + Math.cos(a) * lerp(rimR() + b.off, 6, pull); b.cy = C0 + Math.sin(a) * lerp(rimR() + b.off, 6, pull); }
      const R0 = RADIUS[core.vis] * (1 - .35 * pull);
      if (t < .9) {
        if (core.vis) drawStar(ctx, el, core.vis, R0, pull); else drawButton(ctx, el, R0, 0, 0, 1);
        glowAt(ctx, C0, C0, 40 + 120 * pull, p.glow, .9 * pull);
        for (const b of core.stuck) bit(ctx, el, b.cx, b.cy, b.r * (1 - .5 * pull), 0, b.seed, 1);
      } else {
        if (core.vis !== core.pending) { core.vis = core.pending; core.stuck.length = 0; core.popT = 0; core.rips.push({ t: 0, big: true }); }
        core.popT += dt;
        if (core.popT > .9) core.pending = null;
      }
    }
    if (!core.pending || core.animT >= .9) {
      const R = RADIUS[core.vis];
      if (core.popT < .9) {                                           // the new star pops out of the flash
        const e = backOut(clamp(core.popT / .8, 0, 1)), flash = 1 - clamp(core.popT / .5, 0, 1);
        ctx.save(); ctx.translate(C0, C0); ctx.scale(Math.max(.01, e), Math.max(.01, e)); ctx.translate(-C0, -C0);
        if (core.vis) drawStar(ctx, el, core.vis, R, flash); else drawButton(ctx, el, R, 0, 0, 0);
        ctx.restore();
        if (flash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowAt(ctx, C0, C0, 260, '#ffffff', .8 * flash); ctx.restore(); }
        core.popT += core.pending ? 0 : dt;
      } else if (core.vis) { drawStar(ctx, el, core.vis, R * (1 + .02 * core.hover - .03 * core.press), boost); }
      else drawButton(ctx, el, R, core.hover, core.press, prog);
      if (!core.pending) {
        for (const b of core.stuck) { const [x, y, a] = stuckPos(b, spin); bit(ctx, el, x, y, b.r, a, b.seed, 1); }
      }
    }
    for (const f of core.fly) bit(ctx, el, f.x, f.y, f.r, f.t * 6, f.seed, clamp(f.t / .12, 0, 1) * (f.ghost ? .85 : 1));

    // ripples, puffs, floating numbers
    for (let i = core.rips.length - 1; i >= 0; i--) {
      const r = core.rips[i]; r.t += dt; const d = r.big ? 1.1 : .7;
      if (r.t >= d) { core.rips.splice(i, 1); continue; }
      const q = r.t / d, rr = RADIUS[core.vis] * (1 + (r.big ? 1.8 : .5) * easeOut(q));
      ctx.strokeStyle = rgba(p.glow, (r.big ? .9 : .5) * (1 - q)); ctx.lineWidth = (r.big ? 5 : 2.5) * (1 - q * .6); circle(ctx, C0, C0, rr); ctx.stroke();
    }
    for (let i = core.puffs.length - 1; i >= 0; i--) {
      const q = core.puffs[i]; q.t += dt; if (q.t > .4) { core.puffs.splice(i, 1); continue; }
      ctx.strokeStyle = rgba(p.glow, .6 * (1 - q.t / .4)); ctx.lineWidth = 1.5; circle(ctx, q.x, q.y, 3 + 14 * q.t / .4); ctx.stroke();
    }
    ctx.font = '600 22px "Times New Roman", serif'; ctx.textAlign = 'center';
    for (let i = core.floats.length - 1; i >= 0; i--) {
      const f = core.floats[i]; f.t += dt; if (f.t > 1) { core.floats.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - f.t * f.t; ctx.fillStyle = dark() ? '#ffffff' : mix(p.edge, -.1); ctx.fillText('+' + f.text, f.x, f.y - 46 * easeOut(f.t)); ctx.globalAlpha = 1;
    }

    // the clickable disc follows the body
    const br = Math.round((core.pending ? RADIUS[core.vis] : RADIUS[core.vis]) * (core.cv.clientWidth / BOX) * 2 + 8);
    if (br !== core.btnR) { core.btnR = br; const b = $('core-btn'); b.style.width = b.style.height = br + 'px'; }
  }

  core.init = function () {
    core.cv = $('core'); core.ctx = core.cv.getContext('2d');
    resize(); new ResizeObserver(resize).observe(core.cv);
    requestAnimationFrame(frame);
  };

  // ---- the supernova: the star shakes and draws light in, a white flash (the game resets under it), a shockwave and debris ----
  FE.supernova = function (el, onFlash, onDone) {
    const nc = $('nova'), c = nc.getContext('2d'), p = PAL[el];
    const W = nc.width = innerWidth, H = nc.height = innerHeight;
    const rect = core.cv.getBoundingClientRect(), sx = rect.left + rect.width / 2, sy = rect.top + rect.height / 2;
    nc.style.display = 'block';
    const parts = Array.from({ length: 170 }, (_, i) => ({ a: rand(TAU), v: rand(160, 1100), r: rand(1.5, 5), life: rand(1.4, 3), c: i % 3 ? p.glow : p.acc, w: rand(-1, 1) }));
    const streaks = Array.from({ length: 70 }, () => ({ a: rand(TAU), d: rand(.4, 1), w: rand(1, 3) }));
    const t0 = performance.now(); let flashed = false;
    const FLASH = 1.7, END = 4.8;
    function step(now) {
      const t = (now - t0) / 1000;
      c.clearRect(0, 0, W, H);
      if (t < FLASH) {                                                // charging
        const q = t / FLASH, e = q * q;
        core.charge = e; core.shake = 1 + 7 * e;
        c.globalCompositeOperation = 'lighter';
        const g = c.createRadialGradient(sx, sy, 0, sx, sy, 80 + 700 * e); g.addColorStop(0, rgba(p.core, .9 * e)); g.addColorStop(.3, rgba(p.glow, .5 * e)); g.addColorStop(1, rgba(p.glow, 0));
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.lineCap = 'round';
        for (const s of streaks) {                                    // light streaming inward
          const d = (1 - ((q * 1.6 + s.d) % 1)) * Math.hypot(W, H) * .5, r0 = d, r1 = d * .86;
          c.strokeStyle = rgba(p.acc, .55 * q); c.lineWidth = s.w;
          c.beginPath(); c.moveTo(sx + Math.cos(s.a) * r0, sy + Math.sin(s.a) * r0); c.lineTo(sx + Math.cos(s.a) * r1, sy + Math.sin(s.a) * r1); c.stroke();
        }
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = `rgba(255,255,255,${clamp((q - .75) * 4, 0, 1) * .9})`; c.fillRect(0, 0, W, H);
      } else {
        if (!flashed) { flashed = true; core.charge = 0; core.shake = 0; onFlash(); }
        const u = t - FLASH, ox = W / 2, oy = H / 2;
        c.fillStyle = `rgba(255,255,255,${clamp(1 - u / 1.5, 0, 1)})`; c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {                                 // shockwaves
          const uu = u - k * .22; if (uu < 0) continue;
          const r = uu * 950, a = clamp(1 - uu / 2.2, 0, 1);
          c.strokeStyle = rgba(k ? p.glow : p.core, .8 * a); c.lineWidth = 14 * a + 2; c.beginPath(); c.arc(ox, oy, r, 0, TAU); c.stroke();
        }
        const gg = c.createRadialGradient(ox, oy, 0, ox, oy, 120 + u * 500); gg.addColorStop(0, rgba(p.core, .7 * clamp(1 - u / 1.2, 0, 1))); gg.addColorStop(1, rgba(p.glow, 0));
        c.fillStyle = gg; c.fillRect(0, 0, W, H);
        for (const q of parts) {                                      // debris
          if (u > q.life) continue;
          const d = q.v * (1 - Math.pow(1 - u / q.life, 2)) * .9, a = q.a + q.w * u * .4, k = 1 - u / q.life;
          c.fillStyle = rgba(q.c, k); c.beginPath(); c.arc(ox + Math.cos(a) * d, oy + Math.sin(a) * d, q.r * (.5 + k), 0, TAU); c.fill();
        }
        c.globalCompositeOperation = 'source-over';
      }
      if (t < END) requestAnimationFrame(step);
      else { nc.style.display = 'none'; c.clearRect(0, 0, W, H); onDone(); }
    }
    requestAnimationFrame(step);
  };
});
