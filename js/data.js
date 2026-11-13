'use strict';
/* ===== Wallbreakers: data ===== */
const W = 1920, H = 1080;
const FIELD = { x0: 40, y0: 110, y1: 1000 };
const WALL = { x: 1650, w: 60, y0: 110, y1: 1000 };
const AURA_R = 180, SQUAD_CAP = 100, DEPLOY_X = 700, UNIT_SCALE = 1.3, SPEED_SCALE = 1.3, SAVE_KEY = 'wallbreakers-save-v1';

const EL = {
  fire:  { n: 'Fire',  c: '#ff7a3a', d: '#8a2c0c' },
  water: { n: 'Water', c: '#3e9bff', d: '#12468f' },
  earth: { n: 'Earth', c: '#c99a45', d: '#6b4a14' },
  air:   { n: 'Air',   c: '#6fe3c1', d: '#13755f' }
};
const ELS = ['fire', 'water', 'earth', 'air'];
const ROLES = { tank: 'Tank', dps: 'Damage', heal: 'Healer', util: 'Utility' };
const ATTR = {
  fire:  'Attacks ignite. A burn lands 3 damage ticks and every hit refreshes the count. Each fire unit adds its own share of attack to the burn.',
  water: 'Heals hard, but every hit and heal strips 15% defense from its target (allies too). Only the strongest reduction applies.',
  earth: 'Built tough. Hits and shields make targets sluggish: attack interval x1.5.',
  air:   'Stats rise with movement speed, up to +25 to 30%. The bonus ends after standing still for 1.5 seconds.'
};

const UNITS = {};
function def(id, o) { UNITS[id] = Object.assign({ id, heal: null, atk: 0, hits: 0 }, o); }

/* range is the gap between edges. melee ~14, ranged ~200 */
def('fire_tank',  { el: 'fire', role: 'tank', name: 'Magma Golem', short: 'Magma', cost: 100, weight: 20, kind: 'melee', hp: 420, atk: 28, def: 8, spd: 36, range: 14, iv: 2.2, taunt: 3, r: 20,
  blurb: 'Slow, heavy swings that set targets alight. Soaks hits.' });
def('fire_dps',   { el: 'fire', role: 'dps', name: 'Burning Skull', short: 'Skull', cost: 50, weight: 5, kind: 'proj', hp: 130, atk: 24, def: 2, spd: 62, range: 200, iv: 1.1, taunt: 1, r: 14,
  blurb: 'Ranged fireballs. Several skulls stack their burn damage.' });
def('fire_heal',  { el: 'fire', role: 'heal', name: 'Walking Furnace', short: 'Furnace', cost: 65, weight: 8, kind: 'aura', hp: 150, atk: 0, def: 4, spd: 50, range: 0, iv: 1, taunt: 0, r: 16,
  heal: { kind: 'aura', pow: 4, iv: 1, rad: 135 }, blurb: 'Heals everyone near it, a little at a time.' });
def('fire_flame', { el: 'fire', role: 'util', name: 'Flamethrower', short: 'Flamer', cost: 90, weight: 12, kind: 'flame', stationary: true, hp: 230, atk: 17, def: 5, spd: 0, range: 120, iv: 0.28, taunt: 3, r: 16,
  blurb: 'Stationary turret. Place it anywhere before battle. Draws aggro.' });
def('fire_hound', { el: 'fire', role: 'util', name: 'Hellhound', short: 'Hound', cost: 50, weight: 4, kind: 'hound', dormant: true, hp: 95, atk: 24, def: 1, spd: 175, range: 12, iv: 0.55, taunt: 1, r: 13,
  blurb: 'Waits in the backline until you give it a target. Very fast.' });

def('water_tank', { el: 'water', role: 'tank', name: 'Water Golem', short: 'Tide', cost: 100, weight: 20, kind: 'melee', hp: 440, atk: 18, def: 6, spd: 40, range: 14, iv: 1.8, taunt: 3, r: 20, hits: 16,
  blurb: 'Falls after a fixed number of hits, not damage taken.' });
def('water_dps',  { el: 'water', role: 'dps', name: 'Ghost Pirate', short: 'Pirate', cost: 50, weight: 5, kind: 'proj', hp: 120, atk: 24, def: 2, spd: 58, range: 215, iv: 1.4, taunt: 1, r: 14,
  blurb: 'Cannonballs that cut defense twice as deep (30%).' });
def('water_heal', { el: 'water', role: 'heal', name: 'Siren', short: 'Siren', cost: 65, weight: 8, kind: 'spring', hp: 105, atk: 0, def: 3, spd: 56, range: 0, iv: 1.8, taunt: 0, r: 15,
  heal: { kind: 'spring', pow: 40, iv: 1.8, rng: 175, splash: 70 }, blurb: 'Springs heal the weakest ally big and splash its neighbors.' });
def('water_crab', { el: 'water', role: 'util', name: 'Shining Hermit Crab', short: 'Crab', cost: 110, weight: 22, kind: 'crab', hp: 700, atk: 0, def: 14, spd: 40, range: 0, iv: 1, taunt: 2, r: 20,
  blurb: 'Once per battle, mark a region: allies inside take top aggro for 8s.' });

def('earth_tank', { el: 'earth', role: 'tank', name: 'Earth Golem', short: 'Terra', cost: 110, weight: 24, kind: 'melee', hp: 520, atk: 20, def: 14, spd: 34, range: 14, iv: 2.0, taunt: 3, r: 21,
  blurb: 'Below 40% HP it hits harder and takes less. Slower swings hit harder.' });
def('earth_dps',  { el: 'earth', role: 'dps', name: 'Gargoyle', short: 'Gargoyle', cost: 55, weight: 6, kind: 'proj', hp: 160, atk: 26, def: 6, spd: 50, range: 205, iv: 1.5, taunt: 1, r: 15,
  blurb: 'Hurls boulders and raises mounds that soak enemy shots.' });
def('earth_heal', { el: 'earth', role: 'heal', name: 'Weeping Statue', short: 'Statue', cost: 65, weight: 8, kind: 'shield', hp: 135, atk: 0, def: 9, spd: 44, range: 0, iv: 2.5, taunt: 0, r: 16,
  heal: { kind: 'shield', pow: 48, iv: 2.5, rng: 155 }, blurb: 'Does not heal. Wraps allies in barriers.' });
def('earth_ram',  { el: 'earth', role: 'util', name: 'Rhinoceros', short: 'Rhino', cost: 120, weight: 24, kind: 'ram', hp: 640, atk: 150, def: 13, spd: 250, range: 0, iv: 1, taunt: 2, r: 22,
  blurb: 'Starts slow, speeds up while running. One huge ram, then backs off and recharges.' });

def('air_tank',   { el: 'air', role: 'tank', name: 'Tornado', short: 'Cyclone', cost: 90, weight: 18, kind: 'melee', hp: 340, atk: 16, def: 5, spd: 66, range: 14, iv: 1.4, taunt: 3, r: 19,
  blurb: 'Hits push it forward, keeping its speed bonus alive.' });
def('air_dps',    { el: 'air', role: 'dps', name: 'Eagle', short: 'Eagle', cost: 50, weight: 5, kind: 'proj', hp: 115, atk: 20, def: 1, spd: 118, range: 205, iv: 0.9, taunt: 1, r: 14,
  blurb: 'Wind blades. Its wind current deflects or weakens enemy shots.' });
def('air_heal',   { el: 'air', role: 'heal', name: 'Wind Nymph', short: 'Nymph', cost: 60, weight: 7, kind: 'nymph', hp: 90, atk: 0, def: 1, spd: 150, range: 0, iv: 0.9, taunt: 0, r: 12,
  heal: { kind: 'nymph', pow: 20, iv: 0.9, rad: 62 }, blurb: 'Darts to the hurt, heals at close range, returns to the back.' });
def('air_rod',    { el: 'air', role: 'util', name: 'Lightning Rod', short: 'Rod', cost: 60, weight: 5, kind: 'rod', hp: 90, atk: 38, def: 2, spd: 0, range: 0, iv: 1, taunt: 0, r: 12,
  blurb: 'Throw it anywhere. Lightning strikes the area and paralyzes.' });

const BY_EL = {};
ELS.forEach(e => BY_EL[e] = Object.values(UNITS).filter(u => u.el === e));

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
const row = (t, n, x, y0, y1) => { y0 = y0 || 170; y1 = y1 || 940; const a = []; for (let i = 0; i < n; i++) a.push([t, x, Math.round(n === 1 ? (y0 + y1) / 2 : y0 + (y1 - y0) * i / (n - 1))]); return a; };
const ON = WALL.x + WALL.w / 2, BK = WALL.x + WALL.w + 80, BK2 = BK + 90;
const cat = (...l) => [].concat(...l);
const STAGES = [
  { name: 'Outer Gate', blurb: 'A light garrison. Learn the controls.',
    reward: { fire: 90, water: 90, earth: 90, air: 90 },
    waves: [{ wall: { hp: 3400, def: 4 }, enemies: row('archer', 8, ON) }] },
  { name: 'Ballista Row', blurb: 'Bolts hunt your ranged units. Keep a tank in front.',
    reward: { fire: 120, water: 120, earth: 120, air: 120 },
    waves: [{ wall: { hp: 4400, def: 5 }, enemies: cat(row('ballista', 3, BK, 260, 860), row('archer', 8, ON, 200, 900)) }] },
  { name: 'Cannon Bastion', blurb: 'Two walls, two squads. Cannons punish clumping.',
    reward: { fire: 150, water: 150, earth: 150, air: 150 },
    waves: [
      { wall: { hp: 5000, def: 6 }, enemies: cat(row('cannon', 3, BK, 260, 860), row('archer', 8, ON, 200, 900)) },
      { wall: { hp: 6000, def: 7 }, enemies: cat(row('cannon', 4, BK, 220, 900), row('ballista', 2, BK2, 340, 780), row('archer', 10, ON, 180, 920)) }] },
  { name: 'Catapult Ridge', blurb: 'Long reach, huge blasts. Spread out or close the gap.',
    reward: { fire: 180, water: 180, earth: 180, air: 180 },
    waves: [
      { wall: { hp: 5800, def: 7 }, enemies: cat(row('catapult', 2, BK2, 340, 780), row('ballista', 3, BK, 260, 860), row('archer', 8, ON, 200, 900)) },
      { wall: { hp: 6800, def: 8 }, enemies: cat(row('catapult', 3, BK2, 260, 860), row('cannon', 3, BK, 260, 860), row('archer', 10, ON, 180, 920)) }] },
  { name: 'Warlord\u2019s Keep', blurb: 'Break the outer wall, then bring down the Warlord.',
    reward: { fire: 260, water: 260, earth: 260, air: 260 },
    waves: [
      { wall: { hp: 6800, def: 8 }, enemies: cat(row('ballista', 3, BK, 260, 860), row('cannon', 3, BK2, 300, 820), row('archer', 10, ON, 180, 920)) },
      { wall: { hp: 7800, def: 9 }, enemies: cat([['boss', ON + 50, 540]], row('catapult', 2, BK2, 260, 820), row('ballista', 3, BK, 260, 860), row('archer', 8, ON, 200, 900)) }] }
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
    if (a.tier >= 3) return { error: 'Already at maximum tier.' };
    const s = a.stats;
    return { inst: { uid, comps: a.comps.slice(), tier: a.tier + 1, weight: Math.round(a.weight * 1.4),
      name: a.name.replace(/ T\d$/, '') + ' T' + (a.tier + 1),
      stats: Object.assign({}, s, { hp: s.hp * 1.5, atk: s.atk * 1.4, def: s.def * 1.3, healMul: s.healMul * 1.4, hits: s.hits * 1.4 }),
      kind: 'tier' } };
  }
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
