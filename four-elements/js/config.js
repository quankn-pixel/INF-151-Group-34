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

  // key: pressing the current element's letter gathers; pressing another element's letter switches to its tab
  FE.ELEMENTS = [
    { id: 'air',   key: 'a' },
    { id: 'water', key: 'w' },
    { id: 'earth', key: 'e' },
    { id: 'fire',  key: 'f' }
  ];
  FE.SAVE_KEY = 'four-elements-save-v1';
  FE.SIZE_KEY = 'four-elements-size-v1';

  // ---- stars ----
  // Each element has its own star. Going from tier t to t+1 costs 10^t x 10,000 of that element (so the first star costs
  // 10,000). Tier 3 is the last: there is nothing to condense after it. Collapsing a tier 3 star gives one crystal of its element.
  FE.MAX_TIER = 3;                    // tier 4 is unlocked by the Star Stabilizer (see FE.maxTier in state.js)
  FE.STABILIZED_TIER = 4;
  FE.COLLAPSE_TIER = 3;               // a star can be collapsed from this tier up; tier 4 drops 3 crystals instead of 1
  FE.TIER4_CRYSTALS = 3;
  FE.STAR_MULT = 1.8;                 // production multiplier per star tier
  FE.starCost = tier => Math.pow(10, tier) * 10000;
  FE.STAR_NAMES = ['', 'ember', 'spark', 'beacon', 'nova'];

  // ---- layer 1 builds (per element): [base cost, growth per level, reveal when you hold this many]. All are paid for in that element. ----
  FE.UPS = {
    res:  { base: 15,   grow: 2.5,  show: 0 },       // click power x2
    gath: { base: 50,   grow: 1.28, show: 25 },      // +1 per second each
    harm: { base: 600,  grow: 3.2,  show: 300 },     // all production x1.5
    eng:  { base: 3000, grow: 1.35, show: 1500 }     // +30 per second each
  };
  // Elemental Affinity: one per element, bought once with 1 million of that element, kept for good (it is not part of an
  // element's progress, so a collapse does not reset it). Each one doubles all production of all elements.
  FE.AFFINITY = { cost: 1000000, show: 100000, mult: 2 };
  FE.GATHER_RATE = 1;
  FE.ENGINE_RATE = 30;
  FE.HOLD_MS = 100;                   // holding the mouse on the star, or the space bar, clicks every 100 ms (10 per second)
  FE.NAMES = {
    air:   { gath: 'windmill', eng: 'cyclone tower' },
    water: { gath: 'stream',   eng: 'waterfall' },
    earth: { gath: 'boulder',  eng: 'quarry' },
    fire:  { gath: 'bonfire',  eng: 'furnace' }
  };

  // ---- layer 2: tier 1 units (Army tab) and stardust skills (Stardust tab) ----
  // per: units one crystal of that element makes. hp / atk: health and damage. Every unit attacks UNIT_APS times a second.
  // dust: stardust a unit grants when it dies (or is abandoned with a retreat). blurb: the short line under the unit's stats.
  // Water does not attack while an ally nearby is hurt: it heals that ally instead (see FE.COMBAT.heal*).
  FE.UNIT_APS = 1;
  FE.UNITS = [
    { id: 'air',   name: 'Speck of Air',   per: 3, hp: 1, atk: 1, dust: 1, blurb: 'Swarm your enemies.' },
    { id: 'water', name: 'Speck of Water', per: 1, hp: 3, atk: 1, dust: 1, blurb: 'Heals hurt allies nearby instead of attacking.' },
    { id: 'earth', name: 'Speck of Earth', per: 1, hp: 5, atk: 1, dust: 1, blurb: 'Slow to fall. Soaks up the hits.' },
    { id: 'fire',  name: 'Speck of Fire',  per: 1, hp: 1, atk: 4, dust: 1, blurb: 'Hits hard, burns out fast.' }
  ];
  FE.POWER_MULT = 2;                  // the Powerful Units skill multiplies every unit's health and damage by this
  const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  // "Swarm your enemies. One crystal makes three specks of air, instead of one." (only said of a unit that makes more than one)
  FE.unitBlurb = u => u.per > 1 ? `${u.blurb} One crystal makes ${NUM[u.per] || u.per} specks of ${u.id}, instead of one.` : u.blurb;

  // ---- combat ----
  // Everything on a battlefield is measured in map units, and one unit is the same size on every map, so a bigger map
  // (width) simply feels bigger: units take longer to cross it. The screen scale is worked out from the map width.
  FE.COMBAT = {
    timeScale: .5,        // all combat runs at this fraction of real time (the speed button multiplies it)
    unitSpeed: 10,        // map units per second (at full combat speed)
    settleSpeed: 2,       // a unit already in range creeps toward its spot at about this speed (plus a bit more the farther off it is), so it only drifts around the enemy a little
    unitSize: .84,        // side of a unit's square, in map units
    sepDist: 1.0,         // units are pushed apart when closer than this
    range: 2.4,           // how close to an enemy a unit must be to hit it (a bit past the crowd, so units can hit over each other)
    approach: 1.44,       // how close a unit walks up to a wall before it stops and swings
    spawnX: 1.5,          // where units appear
    colGap: .4,           // seconds between one column of units appearing and the next
    colSpacing: 1.05,     // map units between the units of a column
    healRange: 9,         // a water speck can heal a hurt ally this close
    healAmount: 2,        // hit points a water orb restores (it never heals past full health, and Powerful Units does not change it)
    orbSpeed: 26,         // map units per second
    speeds: [1, 2, 4]     // the speed button cycles through these
  };

  // Enemy kinds. r: body radius in map units. hp. atk and every (seconds between hits). reach: how far past its own body a melee
  // enemy can hit; range: how far a ranged one can hit. aggro: how far away it notices your units while nobody is hurting it
  // (low on purpose, so one group never comes to help another); once something has hit it, it chases whatever hit it from much
  // farther. speed: map units per second (0 = it never moves). A sleeper never moves or fights. Walls are a map thing: see below.
  FE.ENEMIES = {
    sleeper: { r: 1.4, hp: 4,  sleeps: true },
    brute:   { r: 2.3, hp: 10, atk: 1, every: 1, reach: 1.2, aggro: 9,  speed: 5, weapon: 'club' },
    stick:   { r: 1.4, hp: 4,  atk: 1, every: 1, reach: .9,  aggro: 9,  speed: 7, weapon: 'stick' },
    mage:    { r: 1.5, hp: 4,  atk: 2, every: 3, range: 20,  aggro: 20, speed: 0, ranged: true },
    giant:   { r: 4.4, hp: 100, atk: 4, every: 2, reach: 2,  aggro: 12, speed: 3, weapon: 'club' }
  };

  // A map is a list of enemies. Everything is placed from the middle of the map's height. For walls, at = where the wall stands
  // as a fraction of the map width (the wall is a thin curve that bends back toward your units by bow map units at its ends).
  // Everything else: x = a fraction of the width, dx / dy = a nudge in map units (dy is measured from the middle of the height).
  // title = the heading of the victory panel. reward = a key of FE.REWARDS; placeholder = shows <Unlocked: Not Implemented Yet>.
  // What you destroy stays destroyed until the whole map is cleared (see state.mapProg): walls keep their damage, anything
  // that died stays dead, and enemies that are still alive come back at full health.
  FE.MAPS = [
    { id: 'breach', name: 'Breach the Surface', title: 'Surface Breached', width: 50, height: 28, bow: 2.6,
      enemies: [{ type: 'wall', at: 1 / 3, hp: 5 }, { type: 'wall', at: 2 / 3, hp: 10 }],
      reward: 'stabilizer' },
    { id: 'reclaim1', name: 'Reclaim the Surface 1/3', title: 'Ground Reclaimed', width: 60, height: 33.6, bow: 3.1,
      enemies: [
        { type: 'wall', at: .2, hp: 10 },
        { type: 'sleeper', x: .42, dy: -5 }, { type: 'sleeper', x: .42, dy: 5 },      // a colon  :
        { type: 'brute', x: .7, dy: 0 }
      ], placeholder: true },
    { id: 'reclaim2', name: 'Reclaim the Surface 2/3', title: 'Ground Reclaimed', width: 60, height: 33.6, bow: 3.1,
      enemies: [
        { type: 'wall', at: .16, hp: 40 },
        { type: 'mage', x: .25, dy: 0 },
        // a clump of five stick fighters
        { type: 'stick', x: .6, dx: 0, dy: 0 }, { type: 'stick', x: .6, dx: -3, dy: -2 }, { type: 'stick', x: .6, dx: -3, dy: 2 },
        { type: 'stick', x: .6, dx: 3, dy: -2 }, { type: 'stick', x: .6, dx: 3, dy: 2 }
      ], placeholder: true },
    { id: 'reclaim3', name: 'Reclaim the Surface 3/3', title: 'Ground Reclaimed', width: 60, height: 33.6, bow: 3.1,
      enemies: [{ type: 'giant', x: .5, dy: 0 }], placeholder: true }
  ];
  FE.REWARDS = {
    stabilizer: { name: 'Star Stabilizer', desc: 'You may now condense stars to Tier 4, for 3 crystals on supernova.' }
  };
  // x, y in a 100 x 100 box; req = the skill that must be bought first
  FE.SKILLS = [
    { id: 'prod', name: '2x All Production',         cost: 1,  req: null,    x: 50, y: 86, desc: 'all production x2' },
    { id: 'dbl',  name: 'Double Crystal Generation', cost: 3,  req: 'prod',  x: 26, y: 50, desc: 'every star drops double crystals' },
    { id: 'power', name: 'Powerful Units',          cost: 5,  req: 'prod',  x: 74, y: 50, desc: 'doubles unit health and damage' },
    { id: 'asc',  name: 'Unit Ascension',            cost: 10, req: 'power', x: 74, y: 14, desc: 'does nothing yet' }
  ];

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
});
