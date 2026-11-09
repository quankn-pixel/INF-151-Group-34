/* surge.js - the "surge" event: a short mini-game that stands in for mindless clicking.
 *
 * Every FE.SURGE.every seconds (while the tab is visible) a surge stirs in your first element. Play it for a lump of that
 * element plus a timed boost to production, or ignore it: nothing is lost except the chance. The games themselves, one per
 * element, are Jerry's (js/minigames.js). How well you did is how many of that game's four thresholds you passed.
 */
FE.module(function (FE) {
  const $ = FE.$, CFG = FE.SURGE;
  const el = () => FE.state.owned[0];

  // ---- the boost, folded into the multiplier that gathering and structures already use ----
  const baseMultiplier = FE.multiplier;
  const buff = () => { const b = FE.state.surge; return b.buffLeft > 0 ? b.buffMult : 1; };
  FE.multiplier = () => FE.round1(baseMultiplier() * buff());

  // ---- timing: offer a surge, count the boost down. Neither runs while the tab is hidden or a game is open. ----
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

  // ---- playing ----
  const cv = $('surge-cv'), cx = cv.getContext('2d'), { W, H, INFO } = FE.MINI;
  let g = null, raf = 0, lastFrame = 0;

  function frame(now) {
    if (!FE.surgeOpen) return;
    const dt = Math.min(.05, (now - lastFrame) / 1000); lastFrame = now;
    if (g && !document.hidden) {
      FE.MINI.tick(dt);
      g.update(dt);
      cx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
      g.draw();
      if (g.over) { finish(g); g = null; }
    }
    raf = requestAnimationFrame(frame);
  }

  function open() {
    const k = el();
    if (!k || FE.surgeOpen) return;
    FE.surgeOpen = true;
    $('surge-overlay').hidden = false;
    const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1;
    cv.width = Math.round(r.width * d); cv.height = Math.round(cv.width * H / W);
    cx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    g = FE.MINI.start(k, cx);
    put($('surge-title'), INFO[k].title);
    put($('surge-blurb'), INFO[k].blurb);
    put($('surge-result'), '');
    put($('surge-skip'), 'skip.');
    const box = $('surge-overlay').firstElementChild; box.tabIndex = -1; box.focus({ preventScroll: true });   // not on a button, so space strikes
    lastFrame = performance.now(); raf = requestAnimationFrame(frame);
    refresh();
  }

  function close() {
    cancelAnimationFrame(raf); g = null;
    FE.surgeOpen = false;
    $('surge-overlay').hidden = true;
    refresh(); FE.save();
  }

  // a played-out game pays; skipping pays nothing. Either way the next surge is SURGE.every away.
  function finish(game) {
    const s = FE.state, k = el(), n = FE.MINI.levels(k, game.score_()), f = n / 4, lump = Math.floor(FE.CAP * CFG.lump * f);
    FE.addAmount(k, lump);
    if (f > 0) { s.surge.buffMult = 1 + CFG.buffMax * f; s.surge.buffLeft = CFG.buffSec; }
    s.surge.wait = CFG.every;
    const line = f > 0
      ? `${game.score_()} ${INFO[k].unit}. +${FE.fmt(lump)} ${k}, and everything runs ×${FE.fmt(1 + CFG.buffMax * f)} for ${CFG.buffSec} seconds.`
      : `${game.score_()} ${INFO[k].unit}. The surge slips past you.`;
    put($('surge-result'), line);
    put($('surge-skip'), 'continue.');
    FE.note(f > 0 ? `The surge settles. +${FE.fmt(lump)} ${k}, and everything runs ×${FE.fmt(1 + CFG.buffMax * f)} for ${CFG.buffSec} seconds.` : 'The surge slips past you.', f > 0 ? 'note' : 'dim');
    FE.sfx(f >= .5 ? 'conjure' : 'ui');
    FE.updateMult(); FE.render(); FE.save();
  }
  function skip() { if (g) FE.state.surge.wait = CFG.every; close(); }

  $('surge-btn').addEventListener('click', open);
  $('surge-skip').addEventListener('click', skip);
  cv.addEventListener('pointerdown', e => {                       // click the game itself
    if (!g) return;
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    g.click((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height);
  });
  document.addEventListener('keydown', e => {
    if (!FE.surgeOpen) return;
    if (e.key === 'Escape') skip();
    else if (g && el() === 'fire' && (e.key === ' ' || e.key === 'Enter') && e.target.id !== 'surge-skip') { e.preventDefault(); g.click(0, 0); }   // the forge only needs timing
  });
  refresh();
});
