/* state.js - the game state, saving, and values derived from it. Always read FE.state at call time (it is replaced on load).
 *
 * Every element has its own progress (state.els[id]): what it holds, its star, its builds. state.cur is the tab you are on.
 * Crystals are shared across elements only as a list of counts (state.crystals[id]). */
FE.module(function (FE) {
  const ids = FE.ELEMENTS.map(e => e.id);
  FE.blankEl = () => ({ count: 0, tier: 0, up: { res: 0, gath: 0, harm: 0, eng: 0 }, seen: {} });
  FE.freshState = function () {
    return {
      cur: null,            // the element tab you are on (set when the game starts)
      els: Object.fromEntries(ids.map(k => [k, FE.blankEl()])),
      crystals: Object.fromEntries(ids.map(k => [k, 0])),
      layer2: false,        // the first crystal opens layer 2
      units: Object.fromEntries(ids.map(k => [k, 0])),   // layer 2: how many of each tier 1 unit you have
      stardust: 0,          // spent on the skill tree; units grant it when they die in combat
      affinity: Object.fromEntries(ids.map(k => [k, false])),   // Elemental Affinity, per element: permanent, never reset
      stabilizer: false,    // Star Stabilizer (reward for Breach the Surface): stars may reach tier 4
      cleared: {},          // maps beaten
      mapProg: {},          // what you have already destroyed on a map you have not cleared yet (see combat.js)
      target: null,         // the map Venture Forth sends you to. null = the first map not cleared yet (the arrows under Venture Forth set it: testing only)
      expedition: null,     // units currently out in combat ({air: n, ...}); a reload while this is set counts as a retreat
      expStarted: false,    // false while the battle is waiting for a click: closing the page then hands the units back instead
      skills: {},           // skill tree nodes bought (permanent)
      played: 0,            // seconds played with the tab visible
      savedAt: 0
    };
  };
  FE.state = FE.freshState();

  const S = () => FE.state;
  FE.el = () => S().cur;
  FE.E = k => S().els[k || S().cur];                 // one element's progress (the current one by default)
  FE.has = id => !!S().skills[id];
  FE.crystalYield = tier => (tier >= FE.STABILIZED_TIER ? FE.TIER4_CRYSTALS : 1) * (FE.has('dbl') ? 2 : 1);   // crystals a collapsing star drops
  FE.maxTier = () => S().stabilizer ? FE.STABILIZED_TIER : FE.MAX_TIER;
  FE.affinityCount = () => ids.filter(k => S().affinity[k]).length;

  // ---- layer 2 ----
  // a unit's health and damage, with the Powerful Units skill applied
  FE.unitStats = id => {
    const u = FE.UNITS.find(x => x.id === id), m = FE.has('power') ? FE.POWER_MULT : 1;
    return { hp: u.hp * m, atk: u.atk * m };
  };
  // the map Venture Forth sends you to: the one the testing arrows picked, otherwise the first map not cleared (or the last, once all are)
  FE.firstOpenMap = () => { const i = FE.MAPS.findIndex(m => !S().cleared[m.id]); return i < 0 ? FE.MAPS.length - 1 : i; };
  FE.targetIdx = () => { const t = S().target; return Number.isInteger(t) && t >= 0 && t < FE.MAPS.length ? t : FE.firstOpenMap(); };

  // ---- production (each takes an element, the current one by default) ----
  FE.starMult = k => { const t = FE.E(k).tier; return t ? Math.pow(FE.STAR_MULT, t) : 1; };
  FE.multiplier = function (k) {
    k = k || S().cur;
    const e = FE.E(k);
    return FE.starMult(k) * Math.pow(1.5, e.up.harm) * Math.pow(FE.AFFINITY.mult, FE.affinityCount()) * (FE.has('prod') ? 2 : 1);
  };
  // per second, before the multiplier
  FE.baseRate = function (k) {
    k = k || S().cur;
    const u = FE.E(k).up;
    return u.gath * FE.GATHER_RATE + u.eng * FE.ENGINE_RATE;
  };
  FE.rate = k => FE.baseRate(k) * FE.multiplier(k);
  FE.clickPower = () => Math.pow(2, FE.E().up.res);
  FE.clickGain = () => FE.clickPower() * FE.multiplier();

  // ---- costs ----
  FE.upCost = k => Math.ceil(FE.UPS[k].base * Math.pow(FE.UPS[k].grow, FE.E().up[k]));
  FE.nextStarCost = () => FE.E().tier >= FE.maxTier() ? null : FE.starCost(FE.E().tier);

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
  const merge = (d, v) => {
    if (!(d && typeof d === 'object' && !Array.isArray(d) && v && typeof v === 'object')) return v;
    for (const k in v) d[k] = merge(d[k], v[k]);
    return d;
  };
  FE.adopt = function (saved) {
    const s = FE.freshState();
    for (const k of Object.keys(s)) if (saved[k] != null) s[k] = merge(s[k], saved[k]);
    FE.state = s;
  };
});
