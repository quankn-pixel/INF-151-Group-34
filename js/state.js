/* state.js - the game state, saving, and values derived from it. Always read FE.state at call time (it is replaced on restart/load). */
FE.module(function (FE) {
  FE.freshState = function () {
    return {
      owned: [],            // [the player's element]; the home page reads owned[0] to colour its magic circle
      picking: true,        // no element yet (only when the game is opened without going through the home page)
      count: 0,             // elements held (no limit)
      tier: 0,              // 0 = just the round button, 1-5 = a star of that tier
      up: { res: 0, gath: 0, harm: 0, eng: 0, excl: 0 },   // layer 1 builds, reset by collapsing
      seen: {},             // builds that have faded in
      stardust: 0,          // layer 2: condensed stardust held
      totalDust: 0,         // ...and ever received
      collapses: 0,
      layer2: false,        // the first collapse opens layer 2
      skills: {},           // skill tree nodes bought (permanent)
      mg: { readyAt: 0, plays: 0, best: 0 },   // mini-game: next play time (ms), times played, best result
      buffs: {},            // buff id -> time it ends (ms)
      played: 0,            // seconds played with the tab visible
      savedAt: 0
    };
  };
  FE.state = FE.freshState();

  const S = () => FE.state;
  FE.el = () => S().owned[0] || null;
  FE.has = id => !!S().skills[id];
  FE.buffOn = id => (S().buffs[id] || 0) > Date.now();

  // ---- production ----
  FE.starMult = () => S().tier ? Math.pow(FE.has('radiance') ? 2.2 : 1.8, S().tier) : 1;
  FE.multiplier = function () {
    const s = S();
    let m = FE.starMult() * Math.pow(1.5, s.up.harm);
    if (FE.has('memory')) m *= 1.5;
    if (FE.el() === 'air') m *= 1 + 0.1 * s.up.excl;
    if (FE.buffOn('tailwind')) m *= 2;
    return m;
  };
  // per second, before the multiplier
  FE.baseRate = function () {
    const s = S();
    const gath = s.up.gath * FE.GATHER_RATE * (FE.has('autonomy') ? 2 : 1) * (FE.buffOn('tidal') ? 3 : 1);
    const eng = s.up.eng * FE.ENGINE_RATE * (FE.has('gravity') ? 2 : 1);
    return gath + eng + (FE.el() === 'water' ? 40 * s.up.excl : 0);
  };
  FE.rate = () => FE.baseRate() * FE.multiplier();
  FE.clickPower = () => Math.pow(2, S().up.res) * (FE.has('core') ? 2 : 1) * (FE.buffOn('inferno') ? 4 : 1);
  FE.clickGain = function () {
    let g = FE.clickPower() * FE.multiplier();
    if (FE.el() === 'fire') g += FE.rate() * 0.05 * S().up.excl;
    return g;
  };

  // ---- costs ----
  FE.costMult = () => (FE.has('accretion') ? 0.85 : 1) * (FE.buffOn('bedrock') ? 0.7 : 1) * (FE.el() === 'earth' ? Math.pow(0.97, S().up.excl) : 1);
  FE.upCost = k => Math.ceil(FE.UPS[k].base * Math.pow(FE.UPS[k].grow, S().up[k]) * FE.costMult());
  FE.nextStarCost = () => S().tier >= FE.MAX_TIER ? null : FE.starCost(S().tier);
  // stardust for collapsing now: log42(elements held) x star tier (x1.25 with the Dust Sieve)
  FE.dustPreview = function () {
    const s = S();
    if (s.tier < FE.COLLAPSE_TIER || s.count < 2) return 0;
    return Math.max(0, Math.floor(Math.log(s.count) / Math.log(FE.DUST_BASE) * s.tier * (FE.has('sieve') ? 1.25 : 1)));
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
      const d = s[k];
      s[k] = (d && typeof d === 'object' && !Array.isArray(d)) ? Object.assign(d, saved[k]) : saved[k];
    }
    FE.state = s;
  };
});
