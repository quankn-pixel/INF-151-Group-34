/* game.js - what a click does, finding elements, builds, condensing, the timers, and boot. Loaded last. */
FE.module(function (FE) {
  // Add to an element, never past the cap. Announces the moment storage first fills up.
  FE.addAmount = function (k, amount) {
    const s = FE.state;
    const room = FE.round1(FE.CAP - FE.totalCount());
    if (room <= 0 || !(amount > 0)) return;
    s.counts[k] = FE.round1(s.counts[k] + Math.min(amount, room));
    if (!s.full && FE.totalCount() >= FE.CAP) {
      s.full = true;
      const top = FE.majority() || k;
      FE.note(`Your ${FE.wordHTML(top, top, true)} has ${FE.FULL_VERB[top]} the other elements, but there is still not enough space in this <span class="fx-room">room</span>.`, 'note');
      FE.save();
    }
  };

  // While choosing, a click investigates an element and makes it yours (that click gives nothing). After that it gathers.
  FE.act = function (k) {
    const s = FE.state;
    if (s.owned.includes(k)) { if (!FE.locked()) FE.gather(k); }
    else if (s.picking) discover(k);
  };

  function discover(k) {
    const s = FE.state;
    s.owned.push(k);
    s.picking = false;
    FE.note(FE.FIRST_MSG[k], 'note');
    if (s.owned.length === 2) {
      s.leaderIn = FE.LEADER_DELAY;
      FE.note('With two elements you can conjure a spell: everything you hold, folded into one. Its element is whatever you hold most of.', 'note');
    }
    if (s.owned.length === 3) {
      FE.note('Where three elements meet, something like life begins.', 'dim');
      FE.note('The elements can be worked into materials now. New builds wait on the next pages of builds.', 'note');
      FE.showBuildsPage(1);
    }
    FE.renderChoices();
    FE.render();
    FE.save();
  }

  FE.gather = function (k) {
    const power = FE.round1(FE.clickPower(k) * FE.multiplier());  // read BEFORE this click's own icon exists
    FE.addAmount(k, power);
    FE.spawnIcon(k);
    FE.render();
  };

  // ---- builds: paid for with their own element; locked while storage is full until the first planet ----
  function spend(k, cost) {
    const s = FE.state;
    if (!s.owned.includes(k) || FE.buyBlocked() || s.counts[k] < cost) return false;
    s.counts[k] = FE.round1(s.counts[k] - cost);
    return true;
  }
  FE.buyRes = function (k) { if (spend(k, FE.resCost(k))) { FE.state.up[k].res++; FE.render(); FE.save(); } };
  FE.buyStruct = function (k) { if (spend(k, FE.structCost(k))) { FE.state.up[k].struct++; FE.render(); FE.save(); } };

  // Condense: storage is full. Wipes every element, build, material and upgrade, keeps the crystal. The first one also
  // forms a planet, which opens the 2nd element; later ones only add a crystal.
  FE.condense = function () {
    const s = FE.state;
    if (!s.owned.length || !FE.locked()) return;
    FE.ELEMENTS.forEach(({ id }) => { s.counts[id] = 0; s.up[id].res = 0; s.up[id].struct = 0; });
    FE.MATERIALS.forEach(m => { s.mats[m] = 0; });
    FE.CONVERTERS.forEach(c => { s.conv[c.id] = 0; });
    Object.assign(s, { off: {}, fit: {}, lenses: false, gilding: false, flask: false });
    s.crystals++;
    if (!s.planets) {
      s.planets = 1;
      s.picking = true;
      FE.note('The crystal pulls everything in and hardens into a small, dark planet.', 'dim');
      FE.note('Something else stirs. Investigate it.', 'note');
      FE.renderChoices();
    } else {
      FE.note('Another crystal settles into the planet.', 'dim');
    }
    FE.render(); FE.save();
  };

  // ---- every 100ms: structures make their element (scaled by the multiplier, not click power), then converters run.
  // The leader's approach, vagrants and the threat meter only move while the tab is visible, so nothing raids you
  // while you're away. ----
  let lastTick = performance.now(), wasVisible = !document.hidden;
  setInterval(() => {
    const t = performance.now(), dt = Math.min((t - lastTick) / 1000, 3600);
    lastTick = t;
    const s = FE.state, visible = !document.hidden;
    let changed = false;
    s.owned.forEach(k => {
      if (s.up[k].struct > 0 && !FE.locked()) { FE.addAmount(k, FE.rate(k) * dt); changed = true; }
    });
    if (FE.craftTick(dt)) changed = true;
    if (visible && wasVisible) {               // the first tick back counts nothing: dt may span the hidden time
      const step = Math.min(dt, 1);
      s.played += step;
      if (FE.combatTick(step)) changed = true;
    }
    wasVisible = visible;
    if (changed) FE.render();
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
