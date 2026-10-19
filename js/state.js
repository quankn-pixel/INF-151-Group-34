/* state.js - the game state, saving, and values derived from it. Always read FE.state at call time (it is replaced on restart/load). */
FE.module(function (FE) {
  FE.freshState = function () {
    return {
      counts: { air: 0, water: 0, earth: 0, fire: 0 },
      balanceShown: false,  // the balance box appears once BALANCE_AT elements exist
      full: false,          // storage has been filled
      chosen: null,         // the one element the player picked first
      clicked: {},          // element -> true after first manual gather
      up: { res: 0, struct: 0 },                      // upgrade levels / structures owned (reset by condensing)
      seen: { res: false, struct: false, cond: false }, // which upgrades have faded in (kept when condensing)
      crystals: 0,          // tier 1 crystals of the chosen element
      log: [{ h: 'The dark space stirs with <b>Four Elements</b>', c: 'title' }],   // newest first
      savedAt: 0
    };
  };
  FE.state = FE.freshState();

  FE.totalCount = () => FE.round1(FE.ELEMENTS.reduce((t, { id }) => t + Math.max(0, FE.state.counts[id]), 0));

  // derived values
  FE.locked = () => FE.totalCount() >= FE.CAP;                 // storage full: only condensing is possible
  FE.maxMultiplier = () => FE.BASE_MAX_MULT + FE.CRYSTAL_MAX_MULT * FE.state.crystals;
  FE.clickPower = () => Math.pow(2, FE.state.up.res);
  FE.resCost = () => FE.RES_BASE_COST * Math.pow(FE.RES_COST_GROWTH, FE.state.up.res);
  FE.resMaxed = () => FE.resCost() >= FE.CAP;                  // holding that much means storage is full, which locks buying
  FE.structCost = () => FE.STRUCT_BASE_COST + FE.STRUCT_COST_STEP * FE.state.up.struct;

  // ---- build id: a hash of every file's source (see config.js), so a save only loads into the build that wrote it ----
  function hash(text) {   // FNV-1a, 32-bit, as base36
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(36);
  }
  FE.BUILD = null;        // set by game.js once every file has registered
  FE.computeBuild = () => hash(FE.code.join('\n'));

  FE.save = function () {
    if (!FE.BUILD) return;
    FE.state.savedAt = Date.now();
    try {
      localStorage.setItem(FE.SAVE_KEY, JSON.stringify(Object.assign({ build: FE.BUILD }, FE.state)));
      FE.$('save-status').textContent = 'saved.';
    } catch (e) {
      FE.$('save-status').textContent = 'saving is off in this browser.';
    }
  };
  // Saves from any other build (or from before builds existed, or unreadable ones) are deleted, not loaded.
  FE.loadStored = function () {
    try {
      const raw = localStorage.getItem(FE.SAVE_KEY);
      if (raw == null) return null;
      try {
        const saved = JSON.parse(raw);
        if (saved && saved.build === FE.BUILD) return saved;
      } catch (e) {}
      localStorage.removeItem(FE.SAVE_KEY);
      FE.clearedOldSave = true;
      return null;
    } catch (e) { return null; }
  };
  FE.adopt = function (saved) {
    const s = FE.freshState();
    for (const k of Object.keys(s)) {
      if (saved[k] == null) continue;
      const d = s[k];   // null defaults (chosen) are plain values: typeof null is 'object', but it can't be merged into
      s[k] = (d && typeof d === 'object' && !Array.isArray(d)) ? Object.assign(d, saved[k]) : saved[k];
    }
    FE.state = s;
  };
});
