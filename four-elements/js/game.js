/* game.js - what a click does, switching element tabs, buying, condensing a star, collapsing it into a crystal, the timer,
 * and boot. Loaded last. */
FE.module(function (FE) {
  // The home page's opening sequence opens the game as game.html?new=1&el=fire (a new game that starts on that element)
  // and "continue." as game.html?el=fire. See start().

  // switch tabs: no animation, everything just shows that element's own progress
  FE.switchTo = function (k) {
    const s = FE.state;
    if (FE.collapsing || k === s.cur || !FE.ELEMENTS.some(e => e.id === k)) return;
    s.cur = k;
    FE.collapseArmed = 0;
    FE.core.sync();
    FE.render(); FE.save();
  };

  // a click on the button or star (x, y in the 560-unit box the star is drawn in)
  FE.gather = function (x, y) {
    const s = FE.state;
    if (!s.cur || FE.collapsing) return;
    const g = FE.clickGain();
    FE.E().count += g;
    FE.core.click(x, y, FE.fmt(g));
    FE.render();
  };

  FE.buy = function (k) {
    const e = FE.E(), c = FE.upCost(k);
    if (FE.collapsing || !FE.UPS[k] || e.count < c) return;
    e.count -= c; e.up[k]++;
    FE.render(); FE.save();
  };

  // Elemental Affinity: once per element, for good. It lives in state.affinity, not in the element's progress, so collapsing never resets it.
  FE.buyAffinity = function () {
    const s = FE.state, el = FE.el(), e = FE.E();
    if (FE.collapsing || s.affinity[el] || e.count < FE.AFFINITY.cost) return;
    e.count -= FE.AFFINITY.cost; s.affinity[el] = true;
    FE.render(); FE.save();
    FE.toast(`${el} affinity unlocked for good: all production ×${FE.AFFINITY.mult}. It never resets.`, 4200);
  };

  // condense: 10^tier x 10,000 of the element becomes a star of the next tier (up to tier 3, or 4 with the Star Stabilizer)
  FE.condense = function () {
    const e = FE.E(), cost = FE.nextStarCost();
    if (FE.collapsing || cost == null || e.count < cost) return;
    e.count -= cost; e.tier++;
    FE.core.condense(e.tier);
    FE.render(); FE.save();
  };

  // collapse: a tier 3 star is destroyed, that element starts over, and one crystal of it remains. Needs two clicks.
  FE.collapseArmed = 0; FE.collapsing = false;
  FE.collapse = function () {
    const s = FE.state;
    if (FE.collapsing || FE.E().tier < FE.COLLAPSE_TIER) return;
    if (!(FE.collapseArmed && Date.now() < FE.collapseArmed)) { FE.collapseArmed = Date.now() + 4000; FE.render(); setTimeout(FE.render, 4100); return; }
    FE.collapseArmed = 0; FE.collapsing = true;
    const el = FE.el(), tier = FE.E().tier;
    let first = false, n = 1;
    FE.render();
    FE.supernova(el, () => {                                                   // under the white flash
      first = !s.layer2;
      n = FE.crystalYield(tier); s.crystals[el] += n; s.layer2 = true;
      s.els[el] = FE.blankEl();
      FE.core.sync();
      if (first) FE.goto(2, true);                                             // the first crystal opens layer 2
      FE.save(); FE.render();
    }, () => {
      FE.collapsing = false;
      const what = `${n === 1 ? 'A' : n} ${el} crystal${n === 1 ? '' : 's'}`;
      FE.toast(first ? `${what} condensed. Layer 2 is above layer 1: scroll or click to move between them.` : `${what} condensed (${s.crystals[el]} in all).`, 5200);
      FE.render();
    });
  };

  // ---- every 100ms: what is built makes its element, on every tab, not only the one you are looking at ----
  let lastTick = performance.now();
  setInterval(() => {
    const t = performance.now(), dt = Math.min((t - lastTick) / 1000, 3600);
    lastTick = t;
    const s = FE.state;
    if (!s.cur) return;
    FE.ELEMENTS.forEach(({ id }) => {
      if (FE.collapsing && id === s.cur) return;
      s.els[id].count += FE.rate(id) * dt;
    });
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
    // A game with no current tab starts on the element from the home page, or on a random one.
    if (!FE.state.cur) {
      FE.state.cur = FE.ELEMENTS.some(e => e.id === chosen) ? chosen : FE.ELEMENTS[Math.floor(Math.random() * FE.ELEMENTS.length)].id;
    }
    FE.buildStatic();
    FE.recoverExpedition();         // units that were out in combat when the page closed count as retreated
    FE.core.sync();
    if (FE.clearedOldSave) FE.toast('The game was updated, so your old save was cleared.', 5000);
    FE.render(); FE.save();
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
