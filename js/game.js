/* game.js - what a click does, switching element tabs, buying, condensing a star, collapsing it into a crystal (or letting it
 * become a strange star), the timer, and boot. Loaded last. */
FE.module(function (FE) {
  // The home page's opening sequence opens the game as game.html?new=1&el=fire (a new game that starts on that element)
  // and "continue." as game.html?el=fire. See start().

  // switch tabs: no animation, everything just shows that element's own progress
  FE.locked = () => FE.collapsing || FE.condensing;            // the supernova or the hands are busy: nothing may be spent or switched
  FE.switchTo = function (k) {
    const s = FE.state;
    if (FE.locked() || k === s.cur || !FE.ELEMENTS.some(e => e.id === k)) return;
    s.cur = k;
    FE.collapseArmed = 0;
    FE.core.sync();
    FE.render(); FE.save();
  };

  // a click on the button or star (x, y measured from the middle of the star, in the star's own units; the keyboard passes nothing).
  // A neutron star or black hole makes antimatter instead of the element, whatever your builds say.
  FE.gather = function (x, y) {
    const s = FE.state;
    if (!s.cur || FE.collapsing || FE.modalOpen) return;
    const e = FE.E();
    FE.ev.click();
    if (FE.space) FE.space.click();                       // elemental particles gather faster while you click
    if (e.exo) {
      const g = FE.exoClick(e);
      s.antimatter += g;
      if (FE.space) FE.space.pulse(x || 0, y || 0, FE.fmt(g));
      FE.render();
      return;
    }
    const g = FE.clickGain();
    FE.credit(FE.el(), g);
    FE.core.click(x || 0, y || 0, FE.fmt(g));
    FE.render();
  };

  FE.buy = function (k) {
    const e = FE.E(), c = FE.upCost(k);
    if (FE.locked() || !FE.UPS[k] || e.count < c) return;
    e.count -= c; e.up[k]++; FE.state.buys++;
    FE.ev.buy();
    FE.render(); FE.save();
  };

  // Elemental Affinity: once per element, for good. It lives in state.affinity, not in the element's progress, so collapsing never resets it.
  FE.buyAffinity = function () {
    const s = FE.state, el = FE.el(), e = FE.E();
    if (FE.locked() || s.affinity[el] || e.count < FE.AFFINITY.cost) return;
    e.count -= FE.AFFINITY.cost; s.affinity[el] = true; s.buys++;
    FE.ev.buy();
    FE.render(); FE.save();
    FE.toast(`${el} affinity unlocked for good: all production ×${FE.AFFINITY.mult}. It never resets.`, 4200);
  };

  // condense: 100^tier x 10,000 of the element becomes a star of the next tier (up to tier 3, or 4 with the Star Stabilizer)
  FE.condense = function () {
    const e = FE.E(), cost = FE.nextStarCost();
    if (FE.collapsing || e.exo || e.strange || cost == null || e.count < cost) return;
    e.count -= cost; e.tier++;
    FE.ev.buy(); FE.ev.star();
    FE.core.condense(e.tier);
    FE.render(); FE.save();
  };

  // ---- the end of a star ----
  // how: 'manual' (you collapsed it), 'exo' (a neutron star / black hole ran out of time), 'strange' (a strange star ran out of
  // time), 'curse' (a quest punishment: no crystal). Manual and exo collapses are logged: collapse stars FE.STRANGE.need times
  // within FE.STRANGE.window seconds and the last one becomes a strange star instead of dying.
  function applyCollapse(el, how) {
    const s = FE.state, e = s.els[el], ST = FE.STRANGE, now = Date.now(), tier = e.tier;
    let n = 0, crystals = 0, strange = false, first = false;
    if (how === 'strange') {
      const m = s.strangeMatter;
      crystals = m > 0 ? Math.max(1, Math.floor(Math.sqrt(m) / ST.perCrystal)) : 0;
      s.strangeCrystals += crystals; s.strangeMatter = 0;
    } else if (how !== 'curse') {
      first = !s.layer2;
      n = FE.crystalYield(tier); s.crystals[el] += n; s.layer2 = true;
      s.collapseLog = s.collapseLog.filter(t => now - t < ST.window * 1000); s.collapseLog.push(now);
      strange = s.collapseLog.length >= ST.need && !FE.ELEMENTS.some(x => s.els[x.id].strange);
      if (strange) s.collapseLog = [];
      FE.ev.collapse();
    }
    if (strange) { e.exo = null; e.strange = { start: now, end: now + ST.dur * 1000 }; }
    else s.els[el] = FE.blankEl();
    return { n, crystals, strange, first };
  }
  function message(el, how, r) {
    const s = FE.state, what = `${r.n === 1 ? 'A' : r.n} ${el} crystal${r.n === 1 ? '' : 's'}`;
    if (how === 'strange') return r.crystals ? `The strange star burns out: ${r.crystals} strange crystal${r.crystals === 1 ? '' : 's'} left behind.` : 'The strange star burns out. It had drained almost nothing.';
    if (how === 'curse') return `Your ${el} star was torn apart. No crystal this time.`;
    if (r.strange) return `${what} condensed, and your ${el} star did not die: it has become a strange star. Everything you hold drains into strange matter.`;
    return r.first ? `${what} condensed. Layer 2 is above layer 1: scroll or click to move between them.` : `${what} condensed (${s.crystals[el]} in all).`;
  }
  function runCollapse(el, how) {
    FE.collapsing = true;
    let r = null;
    FE.render();
    FE.supernova(el, () => {                                                   // under the white flash
      r = applyCollapse(el, how);
      FE.core.sync();
      if (r.first) FE.goto(2, true);                                           // the first crystal opens layer 2
      FE.save(); FE.render();
    }, () => {
      FE.collapsing = false;
      FE.toast(message(el, how, r), 5600);
      FE.render();
    });
  }
  // a star ends. With the star on screen it is the supernova; anywhere else it just happens.
  FE.finishStar = function (el, how) {
    if (el === FE.el() && FE.view === 1 && !FE.collapsing && !FE.modalOpen) { runCollapse(el, how); return; }
    if (FE.collapsing && el === FE.el()) return;                               // try again on the next tick
    const r = applyCollapse(el, how);
    if (el === FE.el()) FE.core.sync();
    if (r.first) FE.goto(2, true);
    FE.save(); FE.render();
    FE.toast(message(el, how, r), 5600);
  };

  // collapse: a tier 3 star is destroyed, that element starts over, and one crystal of it remains. Needs two clicks.
  FE.collapseArmed = 0; FE.collapsing = false;
  FE.collapse = function () {
    const e = FE.E();
    if (FE.locked() || e.strange || e.tier < FE.COLLAPSE_TIER) return;
    if (!(FE.collapseArmed && Date.now() < FE.collapseArmed)) { FE.collapseArmed = Date.now() + 4000; FE.render(); setTimeout(FE.render, 4100); return; }
    FE.collapseArmed = 0;
    runCollapse(FE.el(), e.exo ? 'exo' : 'manual');
  };
  // the quest punishment: your current star is torn apart (false when there is no star to tear)
  FE.forceCollapse = function () {
    const e = FE.E();
    if (FE.collapsing || e.tier < 1 || e.strange || !FE.state.cur) return false;
    e.exo = null;
    FE.finishStar(FE.el(), 'curse');
    return true;
  };

  // ---- TESTING ONLY (the button in the bottom right corner; delete this and #testing-btn before release) ----
  // Opens layer 2 with no star and no animation, and gives 100 of every crystal. It can be pressed over and over for more.
  FE.testingUnlock = function () {
    const s = FE.state;
    if (!s.cur || FE.collapsing || FE.combat.active) return;
    const first = !s.layer2;
    s.layer2 = true;
    FE.ELEMENTS.forEach(({ id }) => { s.crystals[id] += 100; });
    if (first) FE.goto(2, true);                      // like the real unlock, the first time only
    FE.save(); FE.render();
    FE.toast('TESTING ONLY: +100 of every crystal.', 2600);
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
      FE.credit(id, FE.rate(id) * dt);
    });
    FE.tickSpecial(dt);
    FE.tickQuests(dt);
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
