/* state.js - the game state, saving, and values derived from it. Always read FE.state at call time (it is replaced on restart/load). */
FE.module(function (FE) {
  const perElement = make => Object.fromEntries(FE.ELEMENTS.map(({ id }) => [id, make()]));

  FE.freshState = function () {
    return {
      counts: perElement(() => 0),
      owned: [],            // elements found so far, in the order they were picked
      picking: true,        // the investigate options show: at the start, after the first planet, after the leader falls
      balanceShown: false,  // the balance box appears once BALANCE_AT elements exist
      full: false,          // storage has been filled
      up: perElement(() => ({ res: 0, struct: 0 })),   // per element: resonance level, structures owned (reset by condensing)
      seen: {},             // 'res-air', 'struct-air', 'cond' -> true once that build has faded in (kept when condensing)
      crystals: 0,          // tier 1 crystals; each raises the max multiplier
      planets: 0,           // the first crystal also forms a planet, which opens the 2nd element
      spells: [],           // { el, power }, oldest first
      enemy: null,          // the vagrant here now: { el, hp, max, left, time (seconds), leader }
      threat: 0,            // 0-100; a vagrant arrives when it fills
      threatOn: false,      // the meter runs once the first vagrant has arrived
      leaderIn: null,       // seconds until the scripted leader arrives, while it is on its way
      leaderBeaten: false,  // beating the leader opens the 3rd element
      kills: 0,
      raids: 0,
      conjured: 0,
      mats: Object.fromEntries(FE.MATERIALS.map(m => [m, 0])),          // materials: outside storage and the balance bar
      conv: Object.fromEntries(FE.CONVERTERS.map(c => [c.id, 0])),      // converters owned
      off: {},              // works switched off in the works box: 'struct-air', 'hearth', ... -> true
      fit: {},              // element -> true once its structures have fittings
      lenses: false,
      gilding: false,
      flask: false,         // the Brewing Flask is built
      ended: false,         // the end-of-prototype message has been shown
      played: 0,            // seconds played with the tab visible
      log: [{ h: 'The dark space stirs with <b>Four Elements</b>', c: 'title' }],   // newest first
      savedAt: 0
    };
  };
  FE.state = FE.freshState();

  FE.totalCount = () => FE.round1(FE.ELEMENTS.reduce((t, { id }) => t + Math.max(0, FE.state.counts[id]), 0));

  // derived values (k is an element id)
  FE.locked = () => FE.totalCount() >= FE.CAP;                 // storage full: no gathering
  // Before the first planet a full storage also blocks buying, so condensing is the only way on. After it, spending
  // is how you make room, so buying stays open.
  FE.buyBlocked = () => FE.locked() && !FE.state.planets;
  FE.maxMultiplier = () => FE.BASE_MAX_MULT + FE.CRYSTAL_MAX_MULT * FE.state.crystals;
  FE.clickPower = k => Math.pow(2, FE.state.up[k].res);
  FE.resCost = k => FE.RES_BASE_COST * Math.pow(FE.RES_COST_GROWTH, FE.state.up[k].res);
  FE.resMaxed = k => FE.resCost(k) >= FE.CAP;                  // the next level would cost all of storage: this is the top
  FE.structCost = k => FE.STRUCT_BASE_COST + FE.STRUCT_COST_STEP * FE.state.up[k].struct;
  // what an element's structures make per second right now (nothing while switched off in works)
  FE.rate = function (k) {
    const s = FE.state;
    if (s.off['struct-' + k]) return 0;
    return s.up[k].struct * FE.STRUCT_RATE * FE.multiplier() * (s.fit[k] ? FE.FITTINGS_BOOST : 1);
  };
  FE.structures = () => FE.state.owned.reduce((t, k) => t + FE.state.up[k].struct, 0);
  // elements in play: the ones you found, then any other you hold (a converter can make the sealed 4th)
  FE.present = function () {
    const s = FE.state;
    return s.owned.concat(FE.ELEMENTS.map(e => e.id).filter(k => !s.owned.includes(k) && s.counts[k] > 0));
  };
  FE.share = k => { const total = FE.totalCount(); return total > 0 ? Math.max(0, FE.state.counts[k]) / total : 0; };
  // the element you hold most of decides the next spell (ties go to the one found first)
  FE.majority = function () {
    const s = FE.state, ks = FE.present();
    return ks.reduce((a, b) => s.counts[b] > s.counts[a] ? b : a, ks[0]);
  };
  // 0 when your elements are even, 1 when everything you hold is one element. Ramps in over the first BALANCE_AT held.
  FE.imbalance = function () {
    const s = FE.state, ks = FE.present(), n = ks.length, total = FE.totalCount();
    if (n < 2 || total <= 0) return 0;
    const top = Math.max(...ks.map(k => Math.max(0, s.counts[k]))) / total;
    return Math.min(1, total / FE.BALANCE_AT) * (top - 1 / n) / (1 - 1 / n);
  };

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
      const d = s[k];   // null defaults (enemy, leaderIn) are plain values: typeof null is 'object', but it can't be merged into
      s[k] = (d && typeof d === 'object' && !Array.isArray(d)) ? Object.assign(d, saved[k]) : saved[k];
    }
    FE.state = s;
  };
});
