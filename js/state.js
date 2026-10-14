/* state.js - the game state and saving. Always read FE.state at call time (it is replaced on restart/load). */
(function (FE) {
  FE.freshState = function () {
    return {
      counts: { air: 0, water: 0, earth: 0, fire: 0 },
      balanceShown: false,  // the balance box appears once BALANCE_AT elements exist
      full: false,          // storage has been filled
      chosen: null,         // the one element the player picked first
      clicked: {},          // element -> true after first manual gather
      log: [{ h: 'The dark space stirs with <b>Four Elements</b>', c: 'title' }],   // newest first
      savedAt: 0
    };
  };
  FE.state = FE.freshState();

  FE.totalCount = () => FE.round1(FE.ELEMENTS.reduce((t, { id }) => t + Math.max(0, FE.state.counts[id]), 0));

  FE.save = function () {
    FE.state.savedAt = Date.now();
    try {
      localStorage.setItem(FE.SAVE_KEY, JSON.stringify(FE.state));
      FE.$('save-status').textContent = 'saved.';
    } catch (e) {
      FE.$('save-status').textContent = 'saving is off in this browser.';
    }
  };
  FE.loadStored = function () {
    try { const raw = localStorage.getItem(FE.SAVE_KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  };
  FE.adopt = function (saved) {
    const s = FE.freshState();
    for (const k of Object.keys(s)) {
      if (saved[k] == null) continue;
      s[k] = (typeof s[k] === 'object' && !Array.isArray(s[k])) ? Object.assign(s[k], saved[k]) : saved[k];
    }
    FE.state = s;
  };
})(window.FE);
