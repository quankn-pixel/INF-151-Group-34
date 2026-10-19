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
    { id: 'air',   key: '1' },
    { id: 'water', key: '2' },
    { id: 'earth', key: '3' },
    { id: 'fire',  key: '4' }
  ];

  FE.CAP = 100000;        // total storage: elements + emptiness always add up to this
  FE.BALANCE_AT = 100;    // the balance box appears once this many elements exist

  // multiplier: +0.1 per icon on screen (no limit on icons), never above the max multiplier
  FE.MULT_PER_ICON = 0.1;
  FE.BASE_MAX_MULT = 2;
  FE.CRYSTAL_MAX_MULT = 2;      // each crystal raises the max multiplier by this much

  // upgrades (all of them need the chosen element as payment)
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

  FE.OPTIONS = { air: 'Breeze', water: 'Puddle', earth: 'Patch of Dirt', fire: 'Embers' };
  FE.FIRST_MSG = {
    air:   'The breeze stirs, hardly more than a sigh.',
    water: 'The puddle is shallow, giving up a drop at a time.',
    earth: 'The dirt is dry and loose, crumbling in your hand.',
    fire:  'The embers flicker weakly.'
  };
  FE.FULL_VERB = { air: 'smothered', water: 'drowned', earth: 'swallowed', fire: 'consumed' };

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
