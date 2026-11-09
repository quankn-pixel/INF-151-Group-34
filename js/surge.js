/* surge.js - the "surge" event: a short timing mini-game that stands in for mindless clicking.
 *
 * Every SURGE.every seconds (while the tab is visible) a surge stirs in your first element. Play it for a lump of that
 * element plus a timed boost to production, or ignore it: nothing is lost except the chance. A marker sweeps a bar; stop it
 * inside the glowing band. The band narrows each round and dead centre is worth double.
 *
 * PROTOTYPE: one timing game for every element, only the wording and colour change. The timing bar is adapted from Jerry's
 * fire game in js/minigames.js on branch Jerry's-Build. Per-element games (catch the currents, ripple echoes, dig) can
 * replace it later by adding to GAMES below.
 */
FE.module(function (FE) {
  const $ = FE.$, CFG = FE.SURGE, W = 480, H = 200;
  const TITLES = { air: 'ride the wind', water: 'catch the tide', earth: 'strike the vein', fire: 'stoke the forge' };
  const rand = (a, b) => a + Math.random() * (b - a);
  const el = () => FE.state.owned[0];

  // ---- the buff, folded into the multiplier that gathering and structures already use ----
  const baseMultiplier = FE.multiplier;
  const buff = () => { const b = FE.state.surge; return b.buffLeft > 0 ? b.buffMult : 1; };
  FE.multiplier = () => FE.round1(baseMultiplier() * buff());

  // ---- timing: offer a surge, count the buff down. Neither runs while the tab is hidden or the game is open. ----
  let last = performance.now();
  setInterval(() => {
    const t = performance.now(), dt = Math.min((t - last) / 1000, 1);
    last = t;
    if (document.hidden || FE.surgeOpen) return;
    const s = FE.state, b = s.surge;
    if (!s.owned.length) return;
    if (s.counts[el()] >= CFG.minOwn && b.wait > 0) b.wait -= dt;
    if (b.buffLeft > 0) { b.buffLeft = Math.max(0, b.buffLeft - dt); FE.updateMult(); }
    refresh();
  }, 100);

  let shownFor = null;
  const put = (e, v) => { if (e.textContent !== v) e.textContent = v; };
  function refresh() {
    const s = FE.state, b = s.surge, k = el();
    const ready = !!k && b.wait <= 0 && !s.picking;
    $('surge-btn').hidden = !ready || FE.surgeOpen;
    if (k && k !== shownFor) {                    // same look as the gather button: element icon and animated word
      shownFor = k;
      $('surge-btn').className = `el pick solo surge-btn pick-${k}`;
      $('surge-btn').innerHTML = `<span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true">${FE.ICONS[k]}</svg></span>${FE.wordHTML(k, 'surge')}`;
      $('surge-btn').title = `a surge stirs in the ${k}`;
    }
    $('surge-buff').hidden = b.buffLeft <= 0;
    if (b.buffLeft > 0) put($('surge-buff'), `surge: ×${FE.fmt(b.buffMult)} production for ${Math.ceil(b.buffLeft)}s`);
  }

  // ---- the game: timing bar ----
  const cv = $('surge-cv'), cx = cv.getContext('2d');
  let g = null, raf = 0, lastFrame = 0;
  const ZONES = [.22, .18, .15, .12, .10, .08];   // width of the glowing band each round, as a share of the bar
  const PERFECT = .012;                            // how far from dead centre still counts as perfect (was .02)

  function newGame() {
    const o = { round: 0, score: 0, pos: 0, dir: 1, zc: .5, zw: ZONES[0], mode: 'run', t: 0, msg: '' };
    o.next = () => { o.pos = Math.random() < .5 ? 0 : 1; o.dir = o.pos ? -1 : 1; o.zw = ZONES[o.round]; o.zc = rand(.25, .75); o.mode = 'run'; };
    o.next();
    return o;
  }
  const best = () => CFG.rounds * 2;

  function step(dt) {
    if (g.mode === 'run') {
      g.pos += g.dir * (.7 + .14 * g.round) * dt;
      if (g.pos >= 1) { g.pos = 1; g.dir = -1; }
      if (g.pos <= 0) { g.pos = 0; g.dir = 1; }
    } else if ((g.t += dt) > .7) {
      g.t = 0; g.round++;
      if (g.round >= CFG.rounds) return finish(true);
      g.next();
    }
  }
  function hit() {
    if (!g || g.mode !== 'run') return;
    const d = Math.abs(g.pos - g.zc);
    if (d < PERFECT) { g.score += 2; g.msg = 'perfect'; FE.sfx('cast'); }
    else if (d < g.zw / 2) { g.score += 1; g.msg = 'good'; FE.sfx('gather'); }
    else g.msg = 'missed';
    g.mode = 'show'; g.t = 0;
  }

  function draw() {
    const k = el(), ink = getComputedStyle(document.documentElement).getPropertyValue(`--${k}`).trim() || '#f2683a';
    cx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    cx.fillStyle = '#0b0b12'; cx.fillRect(0, 0, W, H);
    const bx = 30, bw = W - 60, by = 92, bh = 30, heat = g.score / best();
    const glow = cx.createRadialGradient(W / 2, by + bh / 2, 0, W / 2, by + bh / 2, 40 + heat * 140);
    glow.addColorStop(0, ink + Math.round(40 + heat * 110).toString(16).padStart(2, '0')); glow.addColorStop(1, ink + '00');
    cx.fillStyle = glow; cx.fillRect(0, 0, W, H);
    cx.fillStyle = '#20202c'; cx.fillRect(bx, by, bw, bh);
    cx.globalAlpha = .6; cx.fillStyle = ink; cx.fillRect(bx + (g.zc - g.zw / 2) * bw, by, g.zw * bw, bh); cx.globalAlpha = 1;
    cx.fillStyle = '#fff6c0'; cx.fillRect(bx + (g.zc - PERFECT) * bw, by, 2 * PERFECT * bw, bh);   // drawn as wide as the perfect window
    const mx = bx + g.pos * bw;
    cx.fillStyle = '#fff'; cx.beginPath(); cx.moveTo(mx, by - 4); cx.lineTo(mx - 8, by - 18); cx.lineTo(mx + 8, by - 18); cx.fill();
    cx.fillRect(mx - 1.5, by, 3, bh);
    cx.font = '16px "Times New Roman", serif'; cx.fillStyle = '#dfe6ff';
    cx.textAlign = 'left'; cx.fillText(`round ${Math.min(CFG.rounds, g.round + 1)} / ${CFG.rounds}`, 14, 24);
    cx.textAlign = 'right'; cx.fillText(`${g.score} / ${best()}`, W - 14, 24);
    if (g.mode === 'show') { cx.textAlign = 'center'; cx.font = '22px "Times New Roman", serif'; cx.fillStyle = g.msg === 'missed' ? '#8aa0d8' : '#ffd36b'; cx.fillText(g.msg, W / 2, 165); }
  }

  function frame(now) {
    if (!g) return;
    const dt = Math.min(.05, (now - lastFrame) / 1000); lastFrame = now;
    if (!document.hidden) step(dt);
    if (g) { draw(); raf = requestAnimationFrame(frame); }
  }

  function open() {
    const k = el();
    if (!k || FE.surgeOpen) return;
    FE.surgeOpen = true;
    g = newGame();
    put($('surge-title'), TITLES[k] || 'surge');
    $('surge-overlay').hidden = false;
    const r = cv.getBoundingClientRect(); cv.width = Math.round(r.width * (devicePixelRatio || 1)); cv.height = Math.round(cv.width * H / W);
    $('surge-hit').focus();
    lastFrame = performance.now(); raf = requestAnimationFrame(frame);
    refresh();
  }

  function close() {
    cancelAnimationFrame(raf); g = null;
    FE.surgeOpen = false;
    $('surge-overlay').hidden = true;
    FE.state.surge.wait = CFG.every;
    refresh(); FE.save();
  }

  // played out (done = true) pays; skipping with Escape or "skip." pays nothing
  function finish(done) {
    if (done) {
      const s = FE.state, k = el(), f = g.score / best(), lump = Math.floor(FE.CAP * CFG.lump * f);
      FE.addAmount(k, lump);
      if (f > 0) { s.surge.buffMult = 1 + CFG.buffMax * f; s.surge.buffLeft = CFG.buffSec; }
      FE.note(f > 0
        ? `The surge settles. +${FE.fmt(lump)} ${k}, and everything runs ×${FE.fmt(1 + CFG.buffMax * f)} for ${CFG.buffSec} seconds.`
        : 'The surge slips past you.', f > 0 ? 'note' : 'dim');
      FE.sfx(f > .5 ? 'conjure' : 'ui');
      FE.updateMult(); FE.render();
    }
    close();
  }

  $('surge-btn').addEventListener('click', open);
  $('surge-hit').addEventListener('click', hit);
  cv.addEventListener('pointerdown', e => { e.preventDefault(); hit(); $('surge-hit').focus(); });   // click the game itself
  $('surge-skip').addEventListener('click', () => close());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && FE.surgeOpen) close(); });
  refresh();
});
