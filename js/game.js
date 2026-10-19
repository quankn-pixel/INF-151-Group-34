/* game.js - what a click does, upgrades, structures, the timers, and boot. Loaded last. */
FE.module(function (FE) {
  // Add to the chosen element, never past the cap. Announces the moment storage fills up.
  FE.addAmount = function (k, amount) {
    const s = FE.state;
    const room = FE.round1(FE.CAP - FE.totalCount());
    if (room <= 0 || !(amount > 0)) return;
    s.counts[k] = FE.round1(s.counts[k] + Math.min(amount, room));
    if (!s.full && FE.totalCount() >= FE.CAP) {
      s.full = true;
      const top = FE.ELEMENTS.reduce((a, b) => s.counts[b.id] > s.counts[a] ? b.id : a, s.chosen || k);
      FE.note(`Your ${FE.wordHTML(top, top, true)} has ${FE.FULL_VERB[top]} the other elements, but there is still not enough space in this <span class="fx-room">room</span>.`, 'note');
      FE.save();
    }
  };

  // the first click only picks your path (it gives nothing); after that only that element can be gathered
  FE.act = function (k) {
    const s = FE.state;
    if (!s.chosen) {
      s.chosen = k;
      FE.note(FE.FIRST_MSG[k], 'note');
      FE.renderChoices();
      FE.render();
      FE.save();
    } else if (k === s.chosen && !FE.locked()) {
      FE.gather(k);
    }
  };

  FE.gather = function (k) {
    const s = FE.state;
    const power = FE.round1(FE.clickPower() * FE.multiplier());  // read BEFORE this click's own icon exists
    FE.addAmount(k, power);
    s.clicked[k] = true;
    FE.spawnIcon(k);
    FE.render();
  };

  // ---- upgrades: paid for with your element; all locked while storage is full (only condensing works) ----
  function spend(cost) {
    const s = FE.state;
    if (!s.chosen || FE.locked() || s.counts[s.chosen] < cost) return false;
    s.counts[s.chosen] = FE.round1(s.counts[s.chosen] - cost);
    return true;
  }
  FE.buyRes = function () { if (spend(FE.resCost())) { FE.state.up.res++; FE.render(); FE.save(); } };
  FE.buyStruct = function () { if (spend(FE.structCost())) { FE.state.up.struct++; FE.render(); FE.save(); } };

  // Condense: wipes progress and upgrades, keeps the crystal. Nothing is cleared on screen (bar, upgrades, icons stay).
  FE.condense = function () {
    const s = FE.state;
    if (!s.chosen || !FE.locked()) return;
    FE.ELEMENTS.forEach(({ id }) => { s.counts[id] = 0; });
    s.up.res = 0; s.up.struct = 0;
    s.crystals++;
    FE.render(); FE.save();
  };

  // ---- structures: each makes STRUCT_RATE per second, scaled by the multiplier (not by click power) ----
  let lastTick = performance.now();
  setInterval(() => {
    const t = performance.now(), dt = Math.min((t - lastTick) / 1000, 3600);
    lastTick = t;
    const s = FE.state;
    if (!s.chosen || s.up.struct <= 0 || FE.locked()) return;
    FE.addAmount(s.chosen, s.up.struct * FE.STRUCT_RATE * FE.multiplier() * dt);
    FE.render();
  }, 100);

  function start() {
    FE.buildStatic();
    FE.BUILD = FE.computeBuild();   // game.js loads last, so every file has registered by now
    const saved = FE.loadStored();
    if (saved) {
      FE.adopt(saved);
      // balanceShown stays as saved: once the box is shown it never hides, same as in a running session
      FE.$('save-status').textContent = 'saved.';
    }
    FE.drawLog(); FE.renderChoices(); FE.scheduleIntro(0);
    if (FE.clearedOldSave) FE.note('The game was updated, so your old save was cleared.', 'dim');
    FE.render();
  }

  // ---- timers ----
  setInterval(() => { if (!document.hidden) FE.updateMult(); }, 100);     // the multiplier changes as icons leave
  setInterval(() => { if (!document.hidden) FE.save(); }, 5000);
  window.addEventListener('pagehide', FE.save);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) FE.save();
    else { FE.render(); FE.save(); }
  });

  start();
});
