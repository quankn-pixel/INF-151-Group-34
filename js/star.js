/* star.js - the star that your crystals feed. Each crystal adds STAR_RATE growth a second; growth passes STAR_TIERS to raise
 * the star's tier, and the drawing gets bigger and hotter with each one.
 *
 * The drawing is Quan's "Ember & Star" prototype (branch Layer-1-2-Planet-System-Showcase), kept as he wrote it. It is
 * lit with additive blending on its own dark panel, so it looks the same in light and dark mode. For now the tier has no
 * effect on the game (FE.starTier() is there for a later mechanic); this is the placeholder for "a star that grows in tiers".
 */
FE.module(function (FE) {
  const $ = FE.$;
  const CUM = FE.STAR_TIERS, MAXT = CUM.length;
  const tierOf = g => { let t = 0; while (t < MAXT && g >= CUM[t]) t++; return t; };
  FE.starTier = () => tierOf(FE.state.growth);
  const gps = () => FE.state.crystals * FE.STAR_RATE;

  // ---- growth: only while the tab is visible, like the rest of the game's clock ----
  let lastTick = performance.now();
  setInterval(() => {
    const t = performance.now(), dt = Math.min((t - lastTick) / 1000, 1);
    lastTick = t;
    if (document.hidden) return;
    const s = FE.state;
    if (s.crystals > 0) s.growth += gps() * dt;
    updateText();
  }, 100);

  // ---- the box ----
  const mmss = sec => String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  const put = (el, v) => { if (el.textContent !== v) el.textContent = v; };
  function updateText() {
    const s = FE.state, box = $('star-box');
    box.hidden = !s.crystals;
    if (box.hidden) return;
    const t = tierOf(s.growth);
    put($('star-tier'), t >= MAXT ? `tier ${t} (top)` : `tier ${t}`);
    put($('star-rate'), `${FE.fmt(gps())} growth a second`);
    if (t >= MAXT) { $('star-fill').style.width = '100%'; put($('star-eta'), ''); return; }
    const from = t ? CUM[t - 1] : 0, p = (s.growth - from) / (CUM[t] - from);
    $('star-fill').style.width = Math.min(100, p * 100) + '%';
    put($('star-eta'), `tier ${t + 1} in ${mmss(Math.ceil((CUM[t] - s.growth) / gps()))}`);
  }

  // ---- drawing ----
  const cv = $('star-cv'), cx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function size() {
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    dpr = window.devicePixelRatio || 1; W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', size);

  const R = [0, 10, 18, 32, 54, 84];          // star radius per tier
  const dust = Array.from({ length: 70 }, () => ({ a: Math.random() * 6.28, d: 20 + Math.random() * 70, s: .05 + Math.random() * .12, z: .6 + Math.random() * 1.4, o: .2 + Math.random() * .4 }));
  const sparks = Array.from({ length: 60 }, () => ({ a: Math.random() * 6.28, d: Math.random(), v: .15 + Math.random() * .3 }));
  const rays = Array.from({ length: 40 }, () => ({ ph: Math.random() * 6.28, sp: .6 + Math.random() * 1.4, len: .6 + Math.random() * .8, w: .05 + Math.random() * .07 }));
  let dustSpin = 0, lastT = 0, flashAt = -9, prevTier = -1;

  function drawStar(time) {
    const G = FE.state.growth;
    dustSpin += Math.min(.1, Math.max(0, time - lastT)) * (1 + 8 * Math.min(1, G / 10)); lastT = time;
    cx.fillStyle = '#050303'; cx.fillRect(0, 0, W, H);
    const t = tierOf(G), X = W / 2, Y = H / 2, ext = t ? R[Math.min(t, 5)] * (1.5 + .28 * t) + 14 : 100, half = Math.min(W, H) / 2;
    const sc = Math.min(1, half * .94 / ext), ig = Math.min(1, G / 10);
    if (prevTier >= 0 && t > prevTier) flashAt = time;
    prevTier = t;
    cx.save(); cx.translate(X, Y); cx.scale(sc, sc);
    cx.globalCompositeOperation = 'lighter';
    if (t === 0) { // slow cloud of dust, pulling in as growth builds
      for (const p of dust) {
        const a = p.a + dustSpin * p.s * .3, rr = p.d * (1 + .06 * Math.sin(time * .5 + p.a * 3)) * (1 - .9 * Math.pow(ig, 1.5));
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr * (.7 + .3 * ig);
        cx.fillStyle = `rgba(${190 + 65 * ig | 0},${90 + 80 * ig | 0},${70 + 10 * ig | 0},${Math.min(1, p.o * (.7 + .3 * Math.sin(time + p.a * 5)) * (1 + 1.5 * ig))})`;
        cx.beginPath(); cx.arc(x, y, p.z * (1 + .6 * ig), 0, 6.28); cx.fill();
      }
      const gR = 60 - 35 * ig, g = cx.createRadialGradient(0, 0, 0, 0, 0, gR);
      g.addColorStop(0, `rgba(${120 + 135 * ig | 0},${30 + 60 * ig | 0},${20 + 10 * ig | 0},${.18 + .7 * ig * ig})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(0, 0, gR, 0, 6.28); cx.fill();
      if (ig > .5) {
        const k = (ig - .5) * 2, cr = R[1] * k * k * k + .01, c = cx.createRadialGradient(0, 0, 0, 0, 0, cr);
        c.addColorStop(0, `rgba(255,150,80,${k})`); c.addColorStop(1, 'rgba(255,50,20,0)');
        cx.fillStyle = c; cx.beginPath(); cx.arc(0, 0, cr, 0, 6.28); cx.fill();
      }
    } else {
      const r = R[t], pulse = 1 + .04 * Math.sin(time * 2.2);
      // escalating outer glow
      const gr = Math.min(r * (2 + t * .8) * pulse, half / sc), ga = .22 + t * .08;
      let g = cx.createRadialGradient(0, 0, r * .6, 0, 0, gr);
      g.addColorStop(0, `rgba(255,59,31,${ga + .2})`); g.addColorStop(.35, `rgba(200,25,10,${ga * .5})`); g.addColorStop(1, 'rgba(80,0,0,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(0, 0, gr, 0, 6.28); cx.fill();
      // corona rays: more and longer with tier
      const n = 8 + t * 7, spin = time * (.12 + .03 * t);
      for (let i = 0; i < n; i++) {
        const q = rays[i % rays.length], a = spin + i / n * 6.28 + q.ph * .05;
        const L = r * (.5 + t * .28) * q.len * (.65 + .35 * Math.sin(time * q.sp + q.ph)), w = q.w * (1 + t * .08);
        cx.save(); cx.rotate(a);
        const lg = cx.createLinearGradient(r * .8, 0, r + L, 0); lg.addColorStop(0, `rgba(255,${90 + t * 18},40,${.5 + .05 * t})`); lg.addColorStop(1, 'rgba(255,40,20,0)');
        cx.fillStyle = lg; cx.beginPath(); cx.moveTo(r * .8, -r * w * 2.2); cx.lineTo(r + L, 0); cx.lineTo(r * .8, r * w * 2.2); cx.closePath(); cx.fill(); cx.restore();
      }
      // counter-rotating thin corona ring (tier 3+)
      if (t >= 3) {
        cx.strokeStyle = `rgba(255,80,40,${.12 + .03 * t})`; cx.lineWidth = 1.5;
        for (let k = 0; k < t - 1; k++) { cx.beginPath(); cx.ellipse(0, 0, r * (1.5 + k * .45), r * (1.5 + k * .45) * (.55 + .1 * k), -time * .15 * (k % 2 ? -1 : 1) + k, 0, 6.28); cx.stroke(); }
      }
      // prominences / arcs (tier 4+)
      if (t >= 4) {
        cx.strokeStyle = 'rgba(255,120,50,.55)'; cx.lineWidth = 2 + t * .4;
        for (let k = 0; k < 3 + t; k++) {
          const a = time * .1 + k * 6.28 / (3 + t), h = r * (.35 + .25 * Math.abs(Math.sin(time * .7 + k * 2)));
          cx.beginPath(); cx.arc(Math.cos(a) * r, Math.sin(a) * r, h, a - 1.5, a + 1.5); cx.stroke();
        }
      }
      // ejected sparks (tier 3+)
      if (t >= 3) for (const s of sparks) {
        s.d += s.v * .004 * (1 + t * .3); if (s.d > 1) { s.d = 0; s.a = Math.random() * 6.28; }
        const d = r * (1 + s.d * (2 + t * .6)); cx.fillStyle = `rgba(255,${150 + t * 15},80,${(1 - s.d) * .8})`; cx.fillRect(Math.cos(s.a) * d, Math.sin(s.a) * d, 2, 2);
      }
      // star body: hot core, red limb
      g = cx.createRadialGradient(0, 0, 0, 0, 0, r * pulse);
      const hot = Math.min(255, 150 + t * 35);
      g.addColorStop(0, `rgb(255,${hot},${t >= 4 ? 200 : 90})`); g.addColorStop(.55, 'rgb(255,70,30)'); g.addColorStop(1, 'rgb(200,20,10)');
      cx.globalCompositeOperation = 'source-over';
      cx.shadowColor = '#ff2a10'; cx.shadowBlur = 8 + t * 10;
      cx.fillStyle = g; cx.beginPath(); cx.arc(0, 0, r * pulse, 0, 6.28); cx.fill(); cx.shadowBlur = 0;
      // surface granulation
      if (t >= 2) {
        cx.globalCompositeOperation = 'lighter'; cx.fillStyle = 'rgba(255,200,120,.12)';
        for (let k = 0; k < 4 + t * 3; k++) { const a = k * 2.4 + time * .2 * (k % 2 ? 1 : -1), d = r * .55 * Math.abs(Math.sin(k * 1.7 + time * .3)); cx.beginPath(); cx.arc(Math.cos(a) * d, Math.sin(a) * d, r * .18, 0, 6.28); cx.fill(); }
      }
      // flash and shockwave when a tier is reached
      const f = (time - flashAt) / 1.8;
      if (f >= 0 && f < 1) {
        cx.globalCompositeOperation = 'lighter';
        const fr = r * (3 + f * 14), fg = cx.createRadialGradient(0, 0, 0, 0, 0, fr);
        fg.addColorStop(0, `rgba(255,210,150,${.9 * (1 - f)})`); fg.addColorStop(.4, `rgba(255,80,30,${.4 * (1 - f)})`); fg.addColorStop(1, 'rgba(255,40,10,0)');
        cx.fillStyle = fg; cx.beginPath(); cx.arc(0, 0, fr, 0, 6.28); cx.fill();
        cx.strokeStyle = `rgba(255,160,90,${.7 * (1 - f)})`; cx.lineWidth = 3; cx.beginPath(); cx.arc(0, 0, r * (1 + f * 10), 0, 6.28); cx.stroke();
      }
    }
    cx.restore();
  }

  // drawn only while the box is on screen and the tab is visible
  function frame(now) {
    if (!$('star-box').hidden && !document.hidden) {
      if (!W) size();
      if (W) drawStar(now / 1000);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  updateText();
});
