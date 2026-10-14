/* game.js - what a click does, the timers, and boot. Loaded last. */
(function (FE) {
  // first click picks your element; after that only that element can be gathered
  FE.act = function (k) {
    const s = FE.state;
    if (FE.totalCount() >= FE.CAP) return;
    if (!s.chosen) {
      s.chosen = k;
      FE.note(FE.FIRST_MSG[k], 'note');
      FE.renderChoices();
      FE.gather(k);
      FE.save();
    } else if (k === s.chosen) {
      FE.gather(k);
    }
  };

  FE.gather = function (k) {
    const s = FE.state;
    const power = FE.multiplier();                              // read BEFORE this click's own icon exists
    const room = FE.round1(FE.CAP - FE.totalCount());
    s.counts[k] = FE.round1(s.counts[k] + Math.min(power, room));
    s.clicked[k] = true;
    FE.spawnIcon(k);

    if (!s.full && FE.totalCount() >= FE.CAP) {
      s.full = true;
      const top = FE.ELEMENTS.reduce((a, b) => s.counts[b.id] > s.counts[a] ? b.id : a, s.chosen || k);
      FE.note(`Your ${FE.wordHTML(top, top, true)} has ${FE.FULL_VERB[top]} the other elements, but there is still not enough space in this <span class="fx-room">room</span>.`, 'note');
      FE.save();
    }
    FE.render();
  };

  function start(hot) {
    FE.buildStatic();
    const saved = (hot && hot.state) || FE.loadStored();
    if (saved) {
      FE.adopt(saved);
      const s = FE.state, total = FE.totalCount();
      if (!s.chosen) s.chosen = FE.ELEMENTS.map(e => e.id).find(id => s.clicked[id]) || null;   // older saves
      if (total < FE.BALANCE_AT) s.balanceShown = false;        // thresholds changed since older saves
      if (total < FE.CAP) s.full = false;
      FE.$('save-status').textContent = 'saved.';
    }
    FE.drawLog(); FE.renderChoices(); FE.scheduleIntro(0);
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

  window.claude?.hot?.snapshot?.(() => ({ state: FE.state }));
  window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})(window.FE);
