'use strict';
/* ===== Wallbreakers: data ===== */
const W = 1920, H = 1080;
const FIELD = { x0: 40, y0: 110, y1: 1000 };
const WALL = { x: 1650, w: 60, y0: 110, y1: 1000 };
const START_CRYSTALS = 1, SQUAD_CAP = 20, MAX_TIER = 2;   // starting crystals per element, squad weight limit, highest ascension tier
const AURA_R = 180, DEPLOY_X = 700, UNIT_SCALE = 1.3, SPEED_SCALE = 1.3, SAVE_KEY = 'wallbreakers-save-v2';
/* Temporarily switched off. Flip to true to bring them back. */
const FEATURES = { interactions: false, fusion: false };

const EL = {
  fire:  { n: 'Fire',  c: '#ff7a3a', d: '#8a2c0c' },
  water: { n: 'Water', c: '#3e9bff', d: '#12468f' },
  earth: { n: 'Earth', c: '#c99a45', d: '#6b4a14' },
  air:   { n: 'Air',   c: '#6fe3c1', d: '#13755f' }
};
const ELS = ['fire', 'water', 'earth', 'air'];
const ROLES = { basic: 'Recruit', tank: 'Tank', dps: 'Damage', heal: 'Healer', util: 'Utility' };

const UNITS = {};
function def(id, o) { UNITS[id] = Object.assign({ id, heal: null, atk: 0, hits: 0, locked: true }, o); }

/* range is the gap between edges. melee ~14, ranged ~200 */
/* the four recruits are the only units */
def('fire_basic', { el: 'fire', role: 'basic', name: 'Fire Recruit', short: 'Fire', cost: 1, weight: 2, kind: 'melee', hp: 100, atk: 12, def: 3, spd: 50, range: 14, iv: 1.2, taunt: 1, r: 15, locked: false,
  blurb: 'A plain melee soldier. No abilities, average everything.' });
def('water_basic', { el: 'water', role: 'basic', name: 'Water Recruit', short: 'Water', cost: 1, weight: 2, kind: 'melee', hp: 100, atk: 12, def: 3, spd: 50, range: 14, iv: 1.2, taunt: 1, r: 15, locked: false,
  blurb: 'A plain melee soldier. No abilities, average everything.' });
def('earth_basic', { el: 'earth', role: 'basic', name: 'Earth Recruit', short: 'Earth', cost: 1, weight: 2, kind: 'melee', hp: 100, atk: 12, def: 3, spd: 50, range: 14, iv: 1.2, taunt: 1, r: 15, locked: false,
  blurb: 'A plain melee soldier. No abilities, average everything.' });
def('air_basic', { el: 'air', role: 'basic', name: 'Air Recruit', short: 'Air', cost: 1, weight: 2, kind: 'melee', hp: 100, atk: 12, def: 3, spd: 50, range: 14, iv: 1.2, taunt: 1, r: 15, locked: false,
  blurb: 'A plain melee soldier. No abilities, average everything.' });
function instLocked(i) { return i.comps.some(id => UNITS[id].locked); }

const BY_EL = {};
ELS.forEach(e => BY_EL[e] = Object.values(UNITS).filter(u => u.el === e).sort((a, b) => a.locked - b.locked));

const LINKS = [
  ['fire', 'earth', 'Earth loses 20% defense. When it falls it splits into two smaller copies at half HP.'],
  ['fire', 'water', 'Water loses 15% max HP and gains 35% speed.'],
  ['fire', 'air', 'Air drains HP slowly, gaining +25% attack and heal power.'],
  ['water', 'fire', 'Fire loses its burn, but deals 35% bonus damage and healing.'],
  ['water', 'earth', 'Earth is 20% slower and gets a barrier of 18% max HP.'],
  ['water', 'air', 'Air is 15% slower and gains 25% defense.'],
  ['earth', 'fire', 'Fire loses 15% attack and gains 25% defense.'],
  ['earth', 'water', 'Water gains aggro and a 20% chance to crit for x1.6.'],
  ['earth', 'air', 'Air gets a barrier (15% of Earth max HP) and swaps its attack with the Earth unit’s defense.'],
  ['air', 'fire', 'Fire gains speed, attack speed and power, but takes 20% more damage.'],
  ['air', 'water', 'Water attacks may ignore defense, and so may attacks against it (more defense, more chance).'],
  ['air', 'earth', 'Earth reflects part of its defense back at attackers.']
];

/* ---- enemies ---- */
const ENEMY = {
  archer:   { name: 'Archer', hp: 60, atk: 10, def: 0, iv: 0.6, range: 270, r: 11, immuneSlug: true, speed: 620,
              note: 'Rapid fire at the highest aggro. Ignores sluggish.' },
  ballista: { name: 'Ballista', hp: 300, atk: 38, def: 7, iv: 3, range: 340, r: 17, speed: 760,
              note: 'Hunts ranged units. Bolts cause bleeding.' },
  cannon:   { name: 'Cannon', hp: 340, atk: 46, def: 9, iv: 5, range: 370, r: 18, speed: 430, aoe: 68,
              note: 'Area blasts on high-aggro targets.' },
  catapult: { name: 'Catapult', hp: 560, atk: 72, def: 10, iv: 8, range: 520, r: 22, speed: 300, aoe: 112,
              note: 'Huge area hits on your backline.' },
  boss:     { name: 'Warlord Gorrath', hp: 2300, atk: 56, def: 14, iv: 1.8, range: 150, r: 34, boss: true,
              note: 'The wall stands while he lives. Shockwaves and reinforcements.' }
};

/* enemies stand ON the wall or BEHIND it, never in front */
const row = (t, n, x, y0, y1, sc) => { const a = []; for (let i = 0; i < n; i++) a.push([t, x, Math.round(n === 1 ? (y0 + y1) / 2 : y0 + (y1 - y0) * i / (n - 1)), sc || 1]); return a; };
const ON = WALL.x + WALL.w / 2, BK = WALL.x + WALL.w + 80, BK2 = BK + 90;
const cat = (...l) => [].concat(...l);
/* enemy entry = [type, x, y, strength]; strength scales that enemy's HP and attack */
const STAGES = [
  { name: 'Outer Gate', blurb: 'A thin wall and a lone archer. Learn the controls.',
    reward: { fire: 3, water: 3, earth: 3, air: 3 },
    waves: [{ wall: { hp: 150, def: 1 }, enemies: row('archer', 1, ON, 540, 540, .5) }] },
  { name: 'Broken Rampart', blurb: 'A sturdier wall, archers and a ballista behind it. Bring a big squad. Clearing it unlocks ascension.',
    reward: { fire: 0, water: 0, earth: 0, air: 0 }, unlock: 'ascend',
    waves: [{ wall: { hp: 900, def: 3 }, enemies: cat(row('archer', 4, ON, 400, 680, .6), row('ballista', 2, BK, 460, 620, .5)) }] },
  { name: 'The Last Bastion', blurb: 'Two walls, two squads. The final challenge. Ascend your units first.',
    reward: { fire: 10, water: 10, earth: 10, air: 10 },
    waves: [
      { wall: { hp: 1200, def: 4 }, enemies: cat(row('archer', 5, ON, 380, 700, .65), row('ballista', 2, BK, 460, 620, .55)) },
      { wall: { hp: 1500, def: 5 }, enemies: cat(row('archer', 6, ON, 360, 720, .65), row('ballista', 2, BK, 460, 620, .55), row('cannon', 1, BK2, 540, 540, .35)) }] }
];

/* ---- unit instances and fusion ---- */
const tmul = (b, t, k) => b * Math.pow(k, t - 1);
function baseStats(c) {
  return { hp: c.hp, atk: c.atk, def: c.def, spd: c.spd, range: c.range, iv: c.iv, taunt: c.taunt, healMul: 1, hits: c.hits || 0 };
}
function mkInst(id, uid) {
  const c = UNITS[id];
  return { uid, comps: [id], tier: 1, name: c.name, weight: c.weight, stats: baseStats(c) };
}
function instKey(i) { return i.comps.join('+'); }
function instCost(i) {
  const per = {}; i.comps.forEach(id => { per[UNITS[id].el] = (per[UNITS[id].el] || 0) + UNITS[id].cost; });
  const k = Math.pow(2, i.tier - 1); Object.keys(per).forEach(e => per[e] *= k);
  return per;
}
function instElements(i) { return [...new Set(i.comps.map(id => UNITS[id].el))]; }
function instRoles(i) { return [...new Set(i.comps.map(id => UNITS[id].role))]; }
function isUtil(i) { return i.comps.some(id => UNITS[id].role === 'util'); }

/* returns { inst } or { error } ; does not mutate */
function fuseInsts(a, b, uid) {
  if (a.uid === b.uid) return { error: 'Pick two different units.' };
  const same = instKey(a) === instKey(b);
  if (same) {
    if (a.tier !== b.tier) return { error: 'Identical units must share a tier to upgrade.' };
    if (a.tier >= MAX_TIER) return { error: 'Already at the highest tier for now.' };
    const s = a.stats;
    return { inst: { uid, comps: a.comps.slice(), tier: a.tier + 1, weight: Math.round(a.weight * 1.4),
      name: a.name.replace(/ T\d$/, '') + ' T' + (a.tier + 1),
      stats: Object.assign({}, s, { hp: s.hp * 2, atk: s.atk * 2, def: s.def * 2, healMul: s.healMul * 2, hits: s.hits * 2 }),
      kind: 'tier' } };
  }
  if (!FEATURES.fusion) return { error: 'Fusing different units is paused for now. Only identical units can ascend.' };
  if (isUtil(a) || isUtil(b)) return { error: 'Utility units can only be upgraded with an identical copy.' };
  if (a.comps.length > 1 || b.comps.length > 1) return { error: 'A fusion can only be combined with an identical fusion.' };
  const ca = UNITS[a.comps[0]], cb = UNITS[b.comps[0]];
  const sa = a.stats, sb = b.stats, sameRole = ca.role === cb.role;
  const comb = (x, y) => Math.max(x, y) + 0.35 * Math.min(x, y);
  const avg = (x, y) => (x + y) / 2;
  const st = {};
  if (sameRole) {
    const f = (x, y) => avg(x, y) * 1.3;
    st.hp = f(sa.hp, sb.hp); st.atk = f(sa.atk, sb.atk); st.def = f(sa.def, sb.def);
    st.iv = (sa.atk && sb.atk) ? avg(sa.iv, sb.iv) * 0.9 : (sa.atk ? sa.iv : sb.iv);
  } else {
    st.hp = comb(sa.hp, sb.hp); st.atk = comb(sa.atk, sb.atk); st.def = comb(sa.def, sb.def);
    st.iv = (sa.atk && sb.atk) ? avg(sa.iv, sb.iv) : (sa.atk ? sa.iv : sb.iv);
  }
  st.range = Math.max(sa.range, sb.range);
  st.spd = avg(sa.spd, sb.spd);
  st.taunt = Math.max(sa.taunt, sb.taunt);
  st.healMul = Math.max(sa.healMul, sb.healMul) * (sameRole && ca.role === 'heal' ? 1.3 : 1);
  st.hits = Math.max(sa.hits, sb.hits);
  const comps = [a.comps[0], b.comps[0]];
  return { inst: { uid, comps, tier: 1, name: ca.short + '-' + cb.short, weight: Math.max(1, Math.round((a.weight + b.weight) * .85)), stats: st, kind: 'fusion' } };
}
