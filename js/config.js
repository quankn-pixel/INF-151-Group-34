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

  FE.CAP = 10000;         // total storage across all elements
  FE.BALANCE_AT = 100;    // the balance box appears once this many elements exist

  // multiplier: +0.1 per icon on screen (no limit on icons), never above the max multiplier
  FE.MULT_PER_ICON = 0.1;
  FE.BASE_MAX_MULT = 2;
  FE.CRYSTAL_MAX_MULT = 2;      // each crystal raises the max multiplier by this much

  // builds: every element has its own resonance and structure, paid for in that element
  FE.RES_AT = 100;              // resonance fades in at this many of your element
  FE.RES_BASE_COST = 10;        // doubles click power; cost grows x10 each time
  FE.RES_COST_GROWTH = 10;
  FE.STRUCT_AT = 1000;          // structure fades in at this many of your element
  FE.STRUCT_BASE_COST = 1000;   // cost grows by STRUCT_COST_STEP each time, no limit
  FE.STRUCT_COST_STEP = 1000;
  FE.STRUCT_RATE = 100;         // element per second each, scaled by the multiplier (not click power)
  FE.STRUCT_NAMES = { air: 'windmill', water: 'stream', earth: 'boulder', fire: 'bonfire' };
  FE.SAVE_KEY = 'four-elements-save-v1';
  FE.SIZE_KEY = 'four-elements-size-v1';
  FE.SOUND_KEY = 'four-elements-sound-v1';
  FE.MUSIC_KEY = 'four-elements-music-v1';

  FE.OPTIONS = { air: 'Breeze', water: 'Puddle', earth: 'Patch of Dirt', fire: 'Embers' };
  FE.FIRST_MSG = {
    air:   'The breeze stirs, hardly more than a sigh.',
    water: 'The puddle is shallow, giving up a drop at a time.',
    earth: 'The dirt is dry and loose, crumbling in your hand.',
    fire:  'The embers flicker weakly.'
  };
  FE.FULL_VERB = { air: 'smothered', water: 'drowned', earth: 'swallowed', fire: 'consumed' };
  FE.FLAVOR = { air: 'restless winds', water: 'rising tides', earth: 'settling stone', fire: 'roaring flames' };   // balance status

  // ---- spells and vagrants: they start once you hold two elements ----
  FE.SPELLS = { air: 'Lightning', water: 'Hypnosis', earth: 'Binding', fire: 'Fireball' };
  FE.BEATS = { water: 'fire', fire: 'air', air: 'earth', earth: 'water' };   // x beats BEATS[x]
  FE.STRONG = 2;                // damage multiplier of a spell against the element it beats
  FE.WEAK = 0.5;                // ...and against the element that beats it
  FE.LEADER_DELAY = 30;         // seconds after the 2nd element before the scripted vagrant leader arrives
  FE.LEADER_LINES = [[20, 'A vagrant settlement on the horizon.'], [10, 'The vagrants have seen you.']];   // [seconds left, story line]
  FE.LEADER_HP = 1000;
  FE.VAGRANT_TIME = 60;         // seconds any vagrant stays before it raids and leaves
  FE.VAGRANT_HP_BASE = 0.15;    // later vagrants: this share of CAP, plus VAGRANT_HP_STEP per vagrant beaten, at most CAP
  FE.VAGRANT_HP_STEP = 0.05;
  FE.RAID_TAKE = 0.25;          // a raid takes this share of every stored element, plus one structure
  // threat meter (0-100): a vagrant arrives when it fills. It gains, per second:
  FE.THREAT_IMBALANCE = 1.5;    // x imbalance (0 = even, 1 = everything you hold is one element)
  FE.THREAT_PER_WORK = 0.08;    // x works running (structures and converters)
  FE.THREAT_PER_RATE = 1 / 3000;   // x elements per second the structures make
  FE.THREAT_LEADER = 1;         // flat, while the leader is still at large, so it always comes back
  FE.SPELL_SLOTS = 3;           // conjuring is blocked while you hold this many spells

  // ---- crafting: opens with the 3rd element ----
  FE.MATERIALS = ['metal', 'sand', 'glass', 'gold'];
  // Converters, per one owned and per second: `use` goes in and `make` comes out, only while `when` holds (that element's
  // share of the balance bar must be above the number). The four element ones let you make the sealed 4th element.
  // Each one costs `cost`, plus CONVERTER_COST_STEP of that again for every one you already own.
  FE.CONVERTERS = [
    { id: 'hearth',    name: 'Hearth',     use: { earth: 50, air: 50 },             make: { fire: 100 }, cost: { earth: 1000, air: 1000 } },
    { id: 'steamvent', name: 'Steam Vent', use: { fire: 50, water: 50 },            make: { air: 100 },  cost: { fire: 1000, water: 1000 } },
    { id: 'siltbed',   name: 'Silt Bed',   use: { water: 50, air: 50 },             make: { earth: 100 },cost: { water: 1000, air: 1000 } },
    { id: 'hotspring', name: 'Hot Spring', use: { fire: 50, earth: 50 },            make: { water: 100 },cost: { fire: 1000, earth: 1000 } },
    { id: 'sifter',    name: 'Sifter',     use: { earth: 20, air: 10 },             make: { sand: 2 },   cost: { earth: 1000, air: 500 },  when: ['earth', 0.5] },
    { id: 'furnace',   name: 'Furnace',    use: { fire: 30, earth: 20, air: 10 },   make: { metal: 1 },  cost: { fire: 1500, earth: 500 }, when: ['fire', 0.8] },
    { id: 'kiln',      name: 'Kiln',       use: { fire: 20, air: 10, sand: 2 },     make: { glass: 1 },  cost: { fire: 1000, sand: 20 },   when: ['fire', 0.6] },
    { id: 'crucible',  name: 'Crucible',   use: { fire: 30, metal: 1 },             make: { gold: 1 },   cost: { fire: 1000, metal: 20 },  when: ['fire', 0.7] }
  ];
  FE.CONVERTER_COST_STEP = 0.5;
  FE.FITTINGS_COST = { metal: 20 };     // per element: its structures make FITTINGS_BOOST times as much
  FE.FITTINGS_BOOST = 2;
  FE.LENSES_COST = { glass: 10 };       // every converter makes LENSES_BOOST times as much
  FE.LENSES_BOOST = 1.5;
  FE.GILDING_COST = { gold: 10 };       // works add GILDING_THREAT of their usual threat
  FE.GILDING_THREAT = 0.5;
  FE.FLASK_COST = { glass: 10, gold: 10 };   // the Brewing Flask ends the slice

  // ---- sound effects: Kenney's Interface Sounds and Impact Sounds (CC0), as audio/<file>.wav. vol is 0-1. A sound
  // with several files plays one of them at random. ----
  FE.SOUNDS = {
    gather:   { files: ['gather1', 'gather2', 'gather3'], vol: 0.2 },
    discover: { files: ['discover'], vol: 0.5 },          // a new element
    build:    { files: ['build1', 'build2'], vol: 0.6 },  // any build or upgrade
    full:     { files: ['full'], vol: 0.4 },              // storage fills up
    condense: { files: ['condense'], vol: 0.6 },
    conjure:  { files: ['conjure'], vol: 0.5 },
    cast:     { files: ['cast'], vol: 0.45 },
    arrive:   { files: ['arrive'], vol: 0.45 },           // a vagrant
    raid:     { files: ['raid'], vol: 0.6 },
    defeat:   { files: ['defeat'], vol: 0.3 },            // a vagrant falls
    end:      { files: ['end'], vol: 0.7 },               // the Brewing Flask
    ui:       { files: ['ui'], vol: 0.25 }                // footer links, the builds pager, works switches
  };
  // background music: "Cathedral in the forest" by congusbongus (OpenGameArt, CC0), a seamless loop
  FE.MUSIC = { file: 'audio/music.mp3', vol: 0.3, fadeIn: 3 };   // fadeIn in seconds

  FE.ICONS = {
    air:   '<path d="M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    water: '<path d="M12 3C9 7.5 5.5 11 5.5 15a6.5 6.5 0 0 0 13 0C18.5 11 15 7.5 12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 15.5a3 3 0 0 0 2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    earth: '<path d="M2.5 19.5 9 7.5l4 7 2.5-3.5 6 8.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 7.5l1.6 2.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    fire:  '<path d="M12 2.5c.6 3-1.8 4.6-3.4 7C7 12 6 13.5 6 15.5a6 6 0 0 0 12 0c0-2.6-1.3-4.2-2.6-5.7-.3 1.5-1 2.4-2 2.9.5-3.8-.3-7-1.4-10.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
  };

  // resource values are kept to one decimal place
  FE.round1 = n => Math.round(n * 10) / 10;
  FE.fmt = n => FE.round1(n).toLocaleString('en-US', { maximumFractionDigits: 1 });   // 12,345 and 12,345.6 alike

  // water text: every letter is its own span. --o = signed distance from the middle, --d = absolute distance
  FE.letters = t => {
    const a = [...t], mid = (a.length - 1) / 2;
    return a.map((ch, i) => `<i class="ch" style="--o:${(i - mid).toFixed(2)};--d:${Math.abs(i - mid).toFixed(2)}">${ch}</i>`).join('');
  };
  FE.wordHTML = (k, t, fx) => `<span class="w${fx ? ' fx' : ''} w-${k}">${k === 'water' ? FE.letters(t) : t}</span>`;
});
