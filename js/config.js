/* config.js - constants, text and tiny helpers. Every module hangs off the global FE object.
 *
 * Every file in js/ must wrap its code in FE.module(function (FE) { ... }). The wrapper records each file's
 * source text, and that text is hashed into the build id (FE.BUILD, state.js). A save only loads into the
 * build that wrote it, so any edit inside a wrapper clears old saves without bumping a version by hand.
 * Code outside the wrapper is not part of the hash.
 */
window.FE = { code: [] };
FE.module = function (fn) { FE.code.push(String(fn)); fn(FE); };
FE.module(function (FE) {
  FE.$ = id => document.getElementById(id);

  FE.ELEMENTS = [
    { id: 'air',   key: 'a' },
    { id: 'water', key: 'w' },
    { id: 'earth', key: 'e' },
    { id: 'fire',  key: 'f' }
  ];
  FE.SAVE_KEY = 'four-elements-save-v1';
  FE.SIZE_KEY = 'four-elements-size-v1';
  FE.OPTIONS = { air: 'Breeze', water: 'Puddle', earth: 'Patch of Dirt', fire: 'Embers' };

  // ---- stars ----
  // A star is condensed out of the player's element. Going from tier t to t+1 costs 10^t x 10,000 of it (so the first star
  // costs 10,000). Collapsing a star of tier 2 or more pays out stardust: log42(elements held) x tier.
  FE.MAX_TIER = 5;
  FE.COLLAPSE_TIER = 2;
  FE.DUST_BASE = 42;
  FE.starCost = tier => Math.pow(10, tier) * 10000;
  FE.STAR_NAMES = ['', 'ember', 'spark', 'beacon', 'giant', 'colossus'];

  // ---- layer 1 builds: [base cost, growth per level, reveal when you hold this many]. All are paid for in the player's element. ----
  FE.UPS = {
    res:  { base: 15,   grow: 2.5,  show: 0 },       // click power x2
    gath: { base: 50,   grow: 1.28, show: 25 },      // +1 per second each
    harm: { base: 600,  grow: 3.2,  show: 300 },     // all production x1.5
    eng:  { base: 3000, grow: 1.35, show: 1500 },    // +30 per second each
    excl: { base: 8000, grow: 1.6,  show: 0 }        // exclusive to the element: opens once its mini-game has been played
  };
  FE.GATHER_RATE = 1;
  FE.ENGINE_RATE = 30;
  FE.NAMES = {
    air:   { gath: 'windmill', eng: 'cyclone tower', excl: 'jet stream',    exclNote: 'all production +10% each' },
    water: { gath: 'stream',   eng: 'waterfall',     excl: 'deep spring',   exclNote: '+40 water per second each' },
    earth: { gath: 'boulder',  eng: 'quarry',        excl: 'bedrock vault', exclNote: 'every build 3% cheaper each' },
    fire:  { gath: 'bonfire',  eng: 'furnace',       excl: 'forgeheart',    exclNote: 'a click also adds 5% of your rate each' }
  };

  // ---- layer 2 ----
  FE.BUFF_SECONDS = 90;
  FE.MG_COOLDOWN = 75;       // seconds between mini-games
  FE.BUFFS = {
    tailwind: { name: 'tailwind', note: 'production x2' },
    inferno:  { name: 'inferno',  note: 'click power x4' },
    tidal:    { name: 'tidal flow', note: 'windmill-type builds x3' },
    bedrock:  { name: 'bedrock',  note: 'builds 30% cheaper' }
  };

  FE.ICONS = {
    air:   '<path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    water: '<path d="M12 3C9 7.5 5.5 11 5.5 15a6.5 6.5 0 0 0 13 0C18.5 11 15 7.5 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 15.5a3 3 0 0 0 2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    earth: '<path d="M2.5 19.5 9 7.5l4 7 2.5-3.5 6 8.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 7.5l1.6 2.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    fire:  '<path d="M12 2.5c.6 3-1.8 4.6-3.4 7C7 12 6 13.5 6 15.5a6 6 0 0 0 12 0c0-2.6-1.3-4.2-2.6-5.7-.3 1.5-1 2.4-2 2.9.5-3.8-.3-7-1.4-10.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
  };

  // numbers: 12,345 up to a million, then 1.23M, 4.5B ...
  FE.round1 = n => Math.round(n * 10) / 10;
  FE.fmt = n => {
    if (!isFinite(n)) return '0';
    if (n < 1000) return FE.round1(n).toLocaleString('en-US', { maximumFractionDigits: 1 });
    if (n < 1e6) return Math.floor(n).toLocaleString('en-US');
    const u = ['M', 'B', 'T', 'Qa', 'Qi', 'Sx'];
    let i = 0; n /= 1e6;
    while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + u[i];
  };
  FE.clock = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
});
