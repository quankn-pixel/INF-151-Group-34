/* game.js - what a click does, buying, condensing a star, collapsing it, the timer, and boot. Loaded last. */
FE.module(function (FE) {
  // The home page's opening sequence opens the game as game.html?new=1&el=fire (a new game that starts with that element)
  // and "continue." as game.html?el=fire. See start().
  FE.discover = function (k) {
    const s = FE.state;
    if (s.owned.length || !FE.ELEMENTS.some(e => e.id === k)) return;
    s.owned.push(k); s.picking = false;
    FE.core.sync();
    FE.render(); FE.save();
  };

  // a click on the button or star (x, y in the 560-unit box the star is drawn in)
  FE.busy = () => FE.collapsing || FE.auxOpen;                    // the supernova or the auxiliary choice is on screen
  FE.gather = function (x, y) {
    const s = FE.state;
    if (!s.owned.length || FE.busy()) return;
    const g = FE.clickGain();
    s.count += g;
    FE.core.click(x, y, FE.fmt(g));
    FE.render();
  };

  FE.buy = function (k) {
    const s = FE.state, c = FE.upCost(k);
    if (FE.busy() || s.count < c || !FE.UPS[k]) return;
    s.count -= c; s.up[k]++;
    FE.render(); FE.save();
  };

  // condense: 10^tier x 10,000 of the element becomes a star of the next tier
  FE.condense = function () {
    const s = FE.state, cost = FE.nextStarCost();
    if (FE.busy() || cost == null || s.count < cost) return;
    s.count -= cost; s.tier++;
    FE.core.condense(s.tier);
    FE.render(); FE.save();
  };

  // collapse: a star of tier 2 or more is destroyed, everything on layer 1 starts over, and stardust remains. Needs two clicks.
  FE.collapseArmed = 0; FE.collapsing = false;
  FE.collapse = function () {
    const s = FE.state;
    if (FE.busy() || s.tier < FE.COLLAPSE_TIER || FE.dustPreview() < 1) return;
    if (!(FE.collapseArmed && Date.now() < FE.collapseArmed)) { FE.collapseArmed = Date.now() + 4000; FE.render(); setTimeout(FE.render, 4100); return; }
    FE.collapseArmed = 0; FE.collapsing = true;
    const dust = FE.dustPreview(), el = FE.el();
    FE.render();
    FE.supernova(el, () => {                                                   // under the white flash
      s.stardust += dust; s.totalDust += dust; s.collapses++; s.layer2 = true;
      s.count = FE.has('seed') ? 250 : 0; s.tier = 0;
      s.up = { res: 0, gath: 0, harm: 0, eng: 0, excl: 0 };
      FE.core.sync();
      FE.goto(2, true);                                                        // (does nothing until layer 2 has its page)
      FE.save(); FE.render();
    }, () => {
      FE.collapsing = false;
      if (!s.aux) { FE.render(); FE.chooseAux(false); return; }         // the first collapse: the screen goes dark and a second element is chosen
      FE.toast(document.getElementById('page2') ? `${dust} stardust condensed. Layer 2 is above layer 1: scroll or click to move between them.` : `${dust} stardust condensed.`, 5200);
      FE.render();
    });
  };

  // special upgrades cost both elements; they make the fused resource
  FE.buyFz = function (k) {
    const s = FE.state;
    if (FE.busy() || !s.aux || !FE.FZ[k] || (k === 'catalyst' && !s.fz.crucible)) return;
    const c = FE.fzCost(k);
    if (s.count < c.main || s.auxCount < c.aux) return;
    s.count -= c.main; s.auxCount -= c.aux; s.fz[k]++;
    FE.render(); FE.save();
  };

  // ---- every 100ms: what is built makes the element ----
  let lastTick = performance.now();
  setInterval(() => {
    const t = performance.now(), dt = Math.min((t - lastTick) / 1000, 3600);
    lastTick = t;
    const s = FE.state;
    if (!s.owned.length) return;
    if (!FE.busy()) {
      s.count += FE.rate() * dt;
      if (s.aux) s.auxCount += FE.auxRate() * dt;
      // the crucibles burn some of each element into the fused resource, while they have both
      const c = s.fz.crucible, m = FE.FZ.crucible.use[0] * c * dt, a = FE.FZ.crucible.use[1] * c * dt;
      FE.fusing = !!(s.aux && c && s.fzOn && s.count >= m && s.auxCount >= a);
      if (FE.fusing) { s.count -= m; s.auxCount -= a; s.fusion += c * FE.catalystMult() * dt; }
    }
    if (!document.hidden) s.played += Math.min(dt, 1);
    FE.render();
  }, 100);

  function start() {
    FE.BUILD = FE.computeBuild();   // game.js loads last, so every file has registered by now

    // The address is cleaned right away, so a refresh never repeats it. The element is also left in sessionStorage;
    // either one will do, because a browser may not share storage between the two files.
    let chosen = null, fresh = false;
    try {
      const q = new URLSearchParams(location.search);
      chosen = q.get('el'); fresh = !!q.get('new');
      if (q.has('el') || q.has('new')) history.replaceState(null, '', location.pathname);
    } catch (e) {}
    try {
      const c = sessionStorage.getItem('fe-chosen');
      sessionStorage.removeItem('fe-chosen');
      if (!chosen) chosen = c;
    } catch (e) {}
    if (fresh) { try { localStorage.removeItem(FE.SAVE_KEY); } catch (e) {} }

    const saved = FE.loadStored();
    if (saved) {
      FE.adopt(saved);
      FE.$('save-status').textContent = 'saved.';
    }
    FE.buildStatic();
    FE.core.sync();
    // A game with no element yet starts with the one from the home page. (A save that exists but has none counts as nothing chosen.)
    if (chosen && !FE.state.owned.length) FE.discover(chosen);
    if (FE.clearedOldSave) FE.toast('The game was updated, so your old save was cleared.', 5000);
    FE.render();
    if (FE.state.owned.length && FE.state.collapses > 0 && !FE.state.aux) { FE.goto(2, true); FE.chooseAux(true); }     // reloaded before choosing: ask again
  }

  // ---- timers ----
  setInterval(() => { if (!document.hidden) FE.save(); }, 5000);
  window.addEventListener('pagehide', FE.save);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) FE.save();
    else { lastTick = performance.now(); FE.render(); FE.save(); }
  });

  start();
});
