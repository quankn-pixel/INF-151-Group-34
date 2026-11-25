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

  // Developer mode: open game.html?dev to show the map arrows under Venture Forth from the start. The TESTING ONLY button in
  // the settings menu does the same (and more: see FE.testingUnlock in game.js). It lasts until the tab is closed, so a reload
  // or the title page does not switch it off.
  FE.DEV = false;
  try {
    if (/[?&]dev\b/.test(location.search)) sessionStorage.setItem('fe-dev', '1');
    FE.DEV = sessionStorage.getItem('fe-dev') === '1';
  } catch (e) {}

  // ---- stars ----
  // Each element has its own star. Going from tier t to t+1 costs 100^t x 10,000 of that element (so the first star costs
  // 10,000, the second 1 million, the third 100 million). Tier 3 is the last: there is nothing to condense after it.
  // Collapsing a tier 3 star gives one crystal of its element.
  FE.MAX_TIER = 3;                    // tier 4 is unlocked by the Star Stabilizer (see FE.maxTier in state.js)
  FE.STABILIZED_TIER = 4;
  FE.COLLAPSE_TIER = 3;               // a star can be collapsed from this tier up; tier 4 drops 3 crystals instead of 1
  FE.TIER4_CRYSTALS = 3;
  FE.STAR_MULT = 1.8;                 // production multiplier per star tier
  FE.STAR_COST_STEP = 100;            // each tier costs this many times the one before it (it was 10)
  FE.starCost = tier => Math.pow(FE.STAR_COST_STEP, tier) * 10000;
  FE.STAR_NAMES = ['', 'ember', 'spark', 'beacon', 'nova'];

  // ---- layer 1 builds (per element): [base cost, growth per level, reveal when you hold this many]. All are paid for in that element. ----
  FE.UPS = {
    res:  { base: 15,   grow: 2.5,  show: 0 },       // click power x1.2 (it was x2)
    gath: { base: 50,   grow: 1.28, show: 25 },      // +1 per second each
    harm: { base: 600,  grow: 3.2,  show: 300 },     // all production x1.5
    eng:  { base: 3000, grow: 1.35, show: 1500 },    // +30 per second each
    conduit: { base: 20000, grow: 1.6, show: 8000 },                 // each click also adds 2% of a second of production
    siphon: { base: 2000000, grow: 3, show: 1000000, needAM: true }  // +0.05 antimatter per second each; offered once you have made antimatter
  };
  FE.CONDUIT_PCT = .02;
  FE.SIPHON_RATE = .05;
  FE.CLICK_GROWTH = 1.2;              // click power per level of resonance
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

  // ---- neutron stars and black holes ----
  // A star of tier EXO_TIER or more can be compressed (by the player) into a neutron star; a tier 4 star becomes a black hole.
  // While it lasts, that element makes nothing normally. It makes antimatter instead: passive per second, plus click per click.
  // Builds and multipliers never touch antimatter. When time runs out the star collapses as usual (its crystals are paid).
  // Antimatter buys a head start: FE.REIGNITE[t] is the cost of lighting a new star of tier t at once (see FE.reignite).
  FE.EXO_TIER = 3;
  FE.EXO = {
    neutron: { name: 'neutron star', dur: 90,  passive: 1, click: .5 },
    hole:    { name: 'black hole',   dur: 150, passive: 4, click: 2 }
  };
  FE.EXO_EXTEND = 60;                 // seconds one strange crystal adds to a black hole
  FE.EXO_AMPLIFY = 1.5;               // what one strange crystal multiplies a black hole's antimatter by
  FE.REIGNITE = [0, 30, 300, 3000];

  // ---- strange stars ----
  // Collapse stars `need` times within `window` seconds and the last one does not die: it becomes a strange star for `dur` seconds.
  // Meanwhile `rate` of what every element holds is drained each second into strange matter (1 per `perMatter`). When it ends the
  // matter is used up: one strange crystal per `perCrystal` of sqrt(matter) (at least one), and the star collapses for good.
  FE.STRANGE = { need: 3, window: 900, dur: 45, rate: .35, perMatter: 1000, perCrystal: 50 };

  // ---- quests (taken from the quest panel): risky tasks with big rewards ----
  // unlock: upgrades bought before the first quests are offered. cooldown: seconds after one ends before new offers.
  // Failing costs you one punishment, shown before you accept: scrambled production, shuffled builds, or a forced collapse.
  FE.QUEST = { unlock: 10, cooldown: 60, offers: 3, scrambleSec: 180, shuffleSec: 240 };

  // ---- mini-games (the mini-game panel): small games with lasting perks ----
  FE.MINI = { unlock: 5, cooldown: 120 };   // upgrades bought before they open; seconds before the same game can be played again
  FE.MINI_BOOST_MAX = 1;                    // meteors: the permanent production bonus stops at +100%
  FE.ROGUE = { base: 1 / 1800, luckMax: 6 }; // per second chance of a rogue star colliding with yours (free tier); each point of luck adds a share
  // bodies caught in orbit: they last `min` minutes, multiply all production, and pay echoes (per minute, and once when caught)
  FE.ORBITERS = {
    moon:   { name: 'moon',   min: 8,  mult: 1.25, dustMin: 1, dustNow: 0, r: 7 },
    planet: { name: 'planet', min: 12, mult: 1.5,  dustMin: 2, dustNow: 0, r: 13 },
    comet:  { name: 'comet',  min: 3,  mult: 2,    dustMin: 0, dustNow: 3, r: 5 }
  };
  FE.MAX_ORBITERS = 6;

  // ---- layer 2: tier 1 units (Army tab) and echo skills (Echoes tab) ----
  // per: units one crystal of that element makes. hp / atk: health and damage. Every unit attacks UNIT_APS times a second.
  // dust: echoes a unit grants when it dies (or is abandoned with a retreat). blurb: the short line under the unit's stats.
  // Water does not attack while an ally nearby is hurt: it heals that ally instead (see FE.COMBAT.heal*).
  FE.UNIT_APS = 1;
  FE.UNITS = [
    // blurb: *words between stars* are the keywords that shimmer on the unit page
    { id: 'air',   name: 'Speck of Air',   per: 3, hp: 1, atk: 1, dust: 1, blurb: 'Swarm your enemies.' },
    { id: 'water', name: 'Speck of Water', per: 1, hp: 3, atk: 2, dust: 1, blurb: 'A well-rounded unit. Can *heal* allies by throwing water at them.' },
    { id: 'earth', name: 'Speck of Earth', per: 1, hp: 5, atk: 1, dust: 1, blurb: '*Tanky* and reliable. Enemies target them first, since they\u2019re the biggest.' },
    { id: 'fire',  name: 'Speck of Fire',  per: 1, hp: 1, atk: 5, dust: 1, blurb: '*Powerful* but fragile, and works best behind other units.' }
  ];
  FE.POWER_MULT = 2;                  // the Powerful Units skill multiplies every unit's health and damage by this
  const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  // "Swarm your enemies. One crystal makes *three* specks of air, instead of one." (only said of a unit that makes more than one)
  FE.unitBlurb = u => u.per > 1 ? `${u.blurb} One crystal makes *${NUM[u.per] || u.per}* specks of ${u.id}, instead of one.` : u.blurb;
  FE.NUM_WORD = n => NUM[n] || String(n);
  // Echoes (what units leave behind when they die, spent on the skill tree). The icon is a square within a square within a square.
  FE.echoIcon = '<svg class="echo-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="2.5" class="e1"/><rect x="5.6" y="5.6" width="12.8" height="12.8" class="e2"/><rect x="9.6" y="9.6" width="4.8" height="4.8" class="e3"/></svg>';
  FE.echoWord = n => n === 1 ? 'echo' : 'echoes';
  FE.gemHtml = id => `<i class="g1" data-el="${id}"></i>`;       // the smooth gem that follows every crystal count

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
    giant:   { r: 4.4, hp: 100, atk: 4, every: 2, reach: 2,  aggro: 12, speed: 3, weapon: 'club' },
    // The cannon never moves. It only charges while it has a target (the unit with the most health that is in range, like every
    // other enemy): its mouth glows brighter for `every` seconds, then a laser hits that unit for `atk`. The mouth then dims
    // before it charges again.
    // The archer never moves. Every `every` seconds it looses an arrow (a small white line) at the unit it has picked (most health
    // first), aimed at where that unit is right then, with a little spread. The arrow flies dead straight at arrowSpeed, over
    // walls, and hits the first unit it touches, so it can miss (or hit someone else).
    archer:  { r: 1.2, hp: 1, atk: 1, every: 2, range: 30, aggro: 30, speed: 0, ranged: true, archer: true, arrowSpeed: 30, spread: .05 },
    cannon:  { r: 2.2, hp: 10, atk: 10, every: 5, range: 34, aggro: 34, speed: 0, ranged: true, cannon: true, turn: 2.2 }   // turn: radians per second it can swing round to a new target
  };

  // A map is a list of enemies. Everything is placed from the middle of the map's height. For walls, at = where the wall stands
  // as a fraction of the map width (the wall is a thin curve that bends back toward your units by bow map units at its ends).
  // Everything else: x = a fraction of the width, dx / dy = a nudge in map units (dy is measured from the middle of the height).
  // title = the heading of the victory panel. A wall may also have: thick (how many times thicker than a normal wall it is drawn), curve: 'right' (its ends bend away from your units instead of toward them), flag (a small flag by its top end) and labelGap (map units the hit point number is moved toward your units, so a thick wall does not cover it; 0 = centred on the wall). reward = a key of FE.REWARDS; placeholder = shows <Unlocked: Not Implemented Yet>.
  // What you destroy stays destroyed until the whole map is cleared (see state.mapProg): walls keep their damage, anything
  // that died stays dead, and enemies that are still alive come back at full health.
  FE.MAPS = [
    { id: 'breach', name: 'Breach the Surface', title: 'Surface Breached', width: 50, height: 28, bow: 2.6,
      enemies: [{ type: 'wall', at: 1 / 3, hp: 5 }, { type: 'wall', at: 2 / 3, hp: 10 }],
      reward: 'stabilizer' },
    { id: 'reclaim1', name: 'The Surface 1/3', title: 'Ground Reclaimed', width: 60, height: 33.6, bow: 3.1,
      enemies: [
        { type: 'wall', at: .2, hp: 10 },
        { type: 'sleeper', x: .42, dy: -5 }, { type: 'sleeper', x: .42, dy: 5 },      // a colon  :
        { type: 'brute', x: .7, dy: 0 }
      ], placeholder: true },
    { id: 'reclaim2', name: 'The Surface 2/3', title: 'Ground Reclaimed', width: 60, height: 33.6, bow: 3.1,
      enemies: [
        { type: 'wall', at: .16, hp: 40 },
        { type: 'mage', x: .25, dy: 0 },
        // a clump of five stick fighters
        { type: 'stick', x: .6, dx: 0, dy: 0 }, { type: 'stick', x: .6, dx: -3, dy: -2 }, { type: 'stick', x: .6, dx: -3, dy: 2 },
        { type: 'stick', x: .6, dx: 3, dy: -2 }, { type: 'stick', x: .6, dx: 3, dy: 2 }
      ], placeholder: true },
    { id: 'reclaim3', name: 'The Surface 3/3', title: 'Ground Reclaimed', width: 60, height: 33.6, bow: 3.1,
      enemies: [{ type: 'giant', x: .5, dy: 0 }], placeholder: true },
    // The first three quarters are empty. There stands a wall about two and a half times as thick as the others (thick) with 250
    // health, and behind it two cannons, one above the other.
    { id: 'outpost', name: 'Outpost', title: 'Outpost Taken', width: 60, height: 33.6, bow: 3.1,
      enemies: [
        { type: 'wall', at: .75, hp: 250, thick: 2.5, curve: 'right', flag: true, labelGap: 1.4 },
        { type: 'cannon', x: .92, dy: -7 }, { type: 'cannon', x: .92, dy: 7 }
      ], placeholder: true },
    // 20% bigger than the others. Same layout as Outpost, but the wall is a bit further forward, thicker again and has 1000 health.
    // Behind it: five archers in a column and two cannons further back.
    { id: 'settlement', name: 'Settlement', title: 'Settlement Taken', width: 72, height: 40.32, bow: 3.72,
      enemies: [
        { type: 'wall', at: .78, hp: 1000, thick: 3.5, curve: 'right', flag: true, labelGap: 1.9 },
        { type: 'archer', x: .865, dy: -13 }, { type: 'archer', x: .865, dy: -6.5 }, { type: 'archer', x: .865, dy: 0 },
        { type: 'archer', x: .865, dy: 6.5 }, { type: 'archer', x: .865, dy: 13 },
        { type: 'cannon', x: .955, dy: -7 }, { type: 'cannon', x: .955, dy: 7 }
      ], placeholder: true }
  ];
  FE.REWARDS = {
    stabilizer: { name: 'Star Stabilizer', desc: 'You may now condense stars to Tier 4, for 3 crystals on supernova.' }
  };
  // x, y in a 100 x 100 box; req = the skill that must be bought first
  FE.SKILLS = [
    { id: 'prod', name: '2x All Production',         cost: 1,  req: null,    x: 50, y: 86, desc: 'all production x2' },
    { id: 'dbl',  name: 'Double Crystal Generation', cost: 3,  req: 'prod',  x: 26, y: 50, desc: 'every star drops double crystals' },
    { id: 'power', name: 'Powerful Units',          cost: 5,  req: 'prod',  x: 74, y: 50, desc: 'doubles unit health and damage' },
    { id: 'asc',  name: 'Unit Ascension',            cost: 10, req: 'power', x: 74, y: 14, desc: 'not in the beta yet', soon: true }   // soon: shown, but it cannot be bought
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
  // true when the wheel or a swipe at this element should scroll a list (one that really overflows) and not change layers
  FE.inScroller = t => {
    for (let n = t; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) {
      const o = getComputedStyle(n).overflowY;
      if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 1) return true;
    }
    return false;
  };
  FE.minutes = sec => sec >= 90 ? `${Math.round(sec / 60)} min` : `${Math.round(sec)} s`;
  FE.clock = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
});
