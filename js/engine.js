'use strict';
/* ===== Wallbreakers: battle engine ===== */
let G = null;            // save state
let B = null;            // current battle
let UID = 1000;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pickR = a => a[Math.floor(Math.random() * a.length)];

function newMod() {
  return { atkMul: 1, defMul: 1, spdMul: 1, ivMul: 1, takenMul: 1, hpMul: 1, healMul: 1, dotOff: false, bonus: 0, crit: 0, tauntAdd: 0,
    ignore: 0, enemyIgnore: 0, reflect: 0, atkSet: null, defSet: null, drain: false, split: false, seen: {} };
}

/* ---------- construction ---------- */
function makeUnit(inst, x, y, o) {
  o = o || {};
  const cs = inst.comps.map(id => UNITS[id]), s = inst.stats, kinds = cs.map(c => c.kind);
  const ak = kinds.includes('proj') ? 'proj' : kinds.includes('melee') ? 'melee' : (kinds.find(k => ['flame', 'hound', 'ram', 'rod', 'crab'].includes(k)) || null);
  const hp = s.hp * (o.hpMul || 1);
  const u = {
    isUnit: true, team: 0, uid: ++UID, inst, name: inst.name, comps: inst.comps.slice(), els: instElements(inst),
    x, y, home: { x, y }, r: Math.max.apply(null, cs.map(c => c.r)) * (o.scale || 1) * UNIT_SCALE,
    baseMax: hp, maxHp: hp, hp, shield: 0, atk: s.atk, def: s.def, spd: s.spd * SPEED_SCALE, range: s.range, iv: s.iv, taunt: s.taunt,
    healMul: s.healMul, hitsN: s.hits ? Math.round(s.hits) : 0,
    ak, ranged: ak === 'proj', stationary: cs.some(c => c.stationary), dormant: cs.some(c => c.dormant),
    heals: cs.filter(c => c.heal).map(c => Object.assign({}, c.heal, { t: rnd(0, c.heal.iv) })),
    cd: rnd(.1, .6), order: null, mod: newMod(), e: null, mom: 0, idle: 0, moving: false,
    dd: null, slug: 0, fdot: null, dots: [], paralyzed: false, forced: 0, reflectCd: 0, shCd: {}, flash: 0,
    noSplit: !!o.noSplit, dead: false, spent: false, mT: rnd(2, 5), vr: 25, ramSt: 'charge', rod: null, abilityUsed: false,
    wind: inst.comps.includes('air_dps'), aim: 0, small: !!o.scale
  };
  u.order = u.dormant ? { t: 'idle' } : (u.stationary || ak === 'crab' || ak === 'rod') ? { t: 'hold' } : { t: 'wall' };
  computeEff(u);
  return u;
}
function makeEnemy(type, x, y) {
  const d = ENEMY[type];
  const e = { isEnemy: true, team: 1, type, uid: ++UID, name: d.name, x, y, r: d.r * UNIT_SCALE, hp: d.hp, maxHp: d.hp, atk: d.atk, def: d.def, iv: d.iv,
    range: d.range, immuneSlug: !!d.immuneSlug, cd: d.iv * rnd(.3, 1), dd: null, slug: 0, fdot: null, dots: [], paralyzed: false,
    dead: false, flash: 0, aim: Math.PI, mod: null, e: null, shT: 5, smT: 12 };
  computeEff(e);
  return e;
}
function layoutSquad(insts) {
  const base = { tank: 620, dps: 480, heal: 340, util: 230 }, groups = { tank: [], dps: [], heal: [], util: [] };
  insts.forEach(i => {
    const roles = instRoles(i); const r = roles.includes('util') ? 'util' : roles.includes('tank') ? 'tank' : roles.includes('dps') ? 'dps' : 'heal';
    groups[r].push(i);
  });
  const cy = (FIELD.y0 + FIELD.y1) / 2, maxRows = Math.floor((FIELD.y1 - FIELD.y0 - 100) / 72);
  for (const r in groups) {
    const g = groups[r], ncol = Math.ceil(g.length / maxRows), per = Math.ceil(g.length / Math.max(1, ncol));
    for (let c = 0; c < ncol; c++) {
      const col = g.slice(c * per, (c + 1) * per);
      col.forEach((inst, k) => {
        const y = cy + (k - (col.length - 1) / 2) * 72; let x = base[r] - c * 64;
        if (inst.comps.includes('fire_flame')) x = DEPLOY_X - 40;
        B.units.push(makeUnit(inst, x, y));
      });
    }
  }
}
function startBattle(si) {
  B = { si, stage: STAGES[si], wave: 0, t: 0, phase: 'deploy', paused: false, speed: 1, sel: [], targeting: null, units: [], enemies: [], projs: [],
    fx: [], mounds: [], tele: [], marks: [], links: [], wall: null, boss: null, auraT: 0, loseT: 0, onPhase: null, hover: null, drag: null, reward: null };
  loadWave(0);
  return B;
}
function loadWave(i) {
  B.wave = i; const wv = B.stage.waves[i];
  B.units = []; B.enemies = []; B.projs = []; B.fx = []; B.mounds = []; B.tele = []; B.marks = []; B.links = [];
  B.sel = []; B.targeting = null; B.phase = 'deploy'; B.loseT = 0; B.auraT = 0;
  B.wall = { isWall: true, team: 1, x: WALL.x, y: (WALL.y0 + WALL.y1) / 2, hp: wv.wall.hp, maxHp: wv.wall.hp, def: wv.wall.def, dd: null, fdot: null, dots: null, dead: false, flash: 0, e: { def: wv.wall.def } };
  wv.enemies.forEach(a => B.enemies.push(makeEnemy(a[0], a[1], a[2])));
  B.boss = B.enemies.find(e => e.type === 'boss') || null;
  const insts = (G.squads[i] || []).map(id => G.units.find(u => u.uid === id)).filter(Boolean);
  layoutSquad(insts);
  recomputeAuras();
}
function beginFight() { if (B.phase === 'deploy' && B.units.length) { B.phase = 'fight'; B.sel = []; B.targeting = null; } }

/* ---------- stats ---------- */
function computeEff(o) {
  if (o.isWall) { o.e = { def: o.def * (1 - (o.dd ? o.dd.pct : 0)) }; return; }
  if (o.isEnemy) { o.e = { atk: o.atk, def: o.def * (1 - (o.dd ? o.dd.pct : 0)), iv: o.iv * (o.slug > 0 && !o.immuneSlug ? 1.5 : 1) }; return; }
  const m = o.mod, mom = o.els.includes('air') ? o.mom : 0, ab = 1 + .25 * mom;
  let atk = (m.atkSet != null ? m.atkSet : o.atk) * m.atkMul * ab;
  let def = (m.defSet != null ? m.defSet : o.def) * m.defMul * ab * (1 - (o.dd ? o.dd.pct : 0));
  const spd = o.spd * m.spdMul * (1 + .3 * mom);
  const iv = o.iv * m.ivMul / (1 + .25 * mom) * (o.slug > 0 ? 1.5 : 1);
  let taken = m.takenMul / (1 + .25 * mom);
  if (o.comps.includes('earth_tank') && o.hp < o.maxHp * .4) { atk *= 1.4; taken *= .7; }
  o.e = { atk, def: Math.max(0, def), spd, iv, taken, heal: o.healMul * m.healMul, tn: o.taunt + m.tauntAdd };
}
function grantShield(T, key, amt) {
  if (B.t - (T.shCd[key] === undefined ? -99 : T.shCd[key]) >= 20) { T.shCd[key] = B.t; T.shield = Math.min(T.shield + amt, T.maxHp * .5); }
}
const INTER = {
  'fire>earth': (S, T, m) => { if (T.noSplit) return; m.defMul *= .8; m.split = true; },
  'fire>water': (S, T, m) => { m.hpMul *= .85; m.spdMul *= 1.35; },
  'fire>air': (S, T, m) => { m.atkMul *= 1.25; m.healMul *= 1.25; m.drain = true; },
  'water>fire': (S, T, m) => { m.dotOff = true; m.bonus = .35; m.healMul *= 1.35; },
  'water>earth': (S, T, m) => { m.spdMul *= .8; grantShield(T, 'we', T.maxHp * .18); },
  'water>air': (S, T, m) => { m.spdMul *= .85; m.defMul *= 1.25; },
  'earth>fire': (S, T, m) => { m.atkMul *= .85; m.defMul *= 1.25; },
  'earth>water': (S, T, m) => { m.tauntAdd += 2; m.crit = .2; },
  'earth>air': (S, T, m) => { grantShield(T, 'ea', S.maxHp * .15); m.atkSet = S.def; S.mod.defSet = T.atk; },
  'air>fire': (S, T, m) => { m.atkMul *= 1.15; m.ivMul *= .85; m.spdMul *= 1.2; m.takenMul *= 1.2; },
  'air>water': (S, T, m) => { const p = Math.min(.6, T.def * .04); m.ignore = p; m.enemyIgnore = p; },
  'air>earth': (S, T, m) => { m.reflect = .6; }
};
function recomputeAuras() {
  const us = B.units.filter(u => !u.dead && !(u.rod && u.rod.state === 'fly'));
  us.forEach(u => { u.mod = newMod(); });
  B.links = [];
  for (const T of us) {
    const near = us.filter(S => S !== T && dist(S, T) <= AURA_R).sort((a, b) => dist(a, T) - dist(b, T));
    for (const S of near) for (const se of S.els) for (const te of T.els) {
      if (se === te) continue;
      const k = se + '>' + te; if (T.mod.seen[k]) continue; T.mod.seen[k] = 1;
      INTER[k](S, T, T.mod);
      B.links.push({ a: S, b: T, c: EL[se].c });
    }
  }
  us.forEach(u => { const nm = u.baseMax * u.mod.hpMul; if (Math.abs(nm - u.maxHp) > .01) { u.hp *= nm / u.maxHp; u.maxHp = nm; } });
}

/* ---------- fx helpers ---------- */
function txt(x, y, text, col, size) { if (B.fx.length < 160) B.fx.push({ k: 'txt', x: x + rnd(-6, 6), y, t: 0, max: .8, text, col, size: (size || 12) * 1.35 }); }
function ring(x, y, r0, r1, col, max, w) { B.fx.push({ k: 'ring', x, y, r0, r1, t: 0, max: max || .4, col, w: w || 2 }); }
function burst(x, y, col, n) { for (let i = 0; i < (n || 10); i++) { const a = rnd(0, 6.28), s = rnd(40, 160); B.fx.push({ k: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: rnd(.3, .6), col, s: rnd(2, 4) }); } }
function beam(x1, y1, x2, y2, col, w) { B.fx.push({ k: 'beam', x1, y1, x2, y2, t: 0, max: .18, col, w: w || 3 }); }
function bolt(x, y, col) {
  const pts = [[x + rnd(-10, 10), y - 360]]; for (let i = 1; i < 8; i++) pts.push([x + rnd(-18, 18), y - 360 + i * 45]); pts.push([x, y]);
  B.fx.push({ k: 'bolt', pts, t: 0, max: .25, col });
}
function updateFx(dt) {
  for (const f of B.fx) { f.t += dt; if (f.k === 'spark') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= .94; f.vy *= .94; } if (f.k === 'txt') f.y -= 26 * dt; }
  B.fx = B.fx.filter(f => f.t < f.max);
  for (const m of B.marks) m.t += dt; B.marks = B.marks.filter(m => m.t < .8);
}

/* ---------- damage ---------- */
function setDD(t, pct) { if (!t.dd || pct >= t.dd.pct) t.dd = { pct, t: 3.5 }; }
function onHitAttr(src, tgt) {
  if (src.els.includes('fire') && !src.mod.dotOff) {
    const f = tgt.fdot || (tgt.fdot = { active: false, ticks: 0, timer: .7, src: {} });
    if (!f.active) { f.active = true; f.timer = .7; }
    f.ticks = 3; f.src[src.uid] = { v: src.e.atk * .22, exp: B.t + 3.2 };
  }
  if (src.els.includes('water')) setDD(tgt, src.comps.includes('water_dps') ? .30 : .15);
  if (src.els.includes('earth') && !tgt.isWall && !tgt.immuneSlug) tgt.slug = Math.max(tgt.slug || 0, 3);
}
function applyDamage(t, dmg, src, o) {
  o = o || {};
  if (t.dead || !(dmg > 0)) return 0;
  if (t.isWall) {
    t.hp -= dmg; t.flash = .08;
    if (t.hp <= 0) { if (B.boss && !B.boss.dead) t.hp = 1; else { t.hp = 0; t.dead = true; wallBreak(); } }
    if (!o.quiet) txt(t.x - 40, t.y + rnd(-200, 200), Math.round(dmg), o.col || '#fff', o.crit ? 15 : 11);
    return dmg;
  }
  if (t.isUnit) {
    if (t.hitsN) { if (o.dot) return 0; dmg = t.maxHp / t.hitsN; } else dmg *= t.e.taken;
    if (t.shield > 0) { const ab = Math.min(t.shield, dmg); t.shield -= ab; dmg -= ab; }
    t.hp -= dmg;
    if (!o.quiet && dmg > .5) txt(t.x, t.y - t.r - 8, Math.round(dmg), '#ff6b7f');
    if (t.hp <= 0) killUnit(t);
    return dmg;
  }
  t.hp -= dmg;
  if (!o.quiet) txt(t.x, t.y - t.r - 8, Math.round(dmg), o.col || (o.crit ? '#ffd166' : '#fff'), o.crit ? 15 : 12);
  if (t.hp <= 0) killEnemy(t);
  return dmg;
}
function hit(src, tgt, raw, o) {
  o = o || {};
  if (tgt.dead) return 0;
  const sm = src.mod; let crit = false;
  if (sm && sm.crit && Math.random() < sm.crit) { raw *= 1.6; crit = true; }
  const ign = (sm && Math.random() < sm.ignore) || (tgt.mod && Math.random() < tgt.mod.enemyIgnore);
  const df = tgt.e ? tgt.e.def : 0;
  const dmg = ign ? raw : Math.max(raw - df, raw * .05);
  const dealt = applyDamage(tgt, dmg, src, { crit });
  if (src.isUnit) {
    onHitAttr(src, tgt);
    if (sm.bonus > 0 && dealt > 0) applyDamage(tgt, dealt * sm.bonus, src, { col: '#7cc4ff' });
  } else if (src.type === 'ballista' && tgt.isUnit) tgt.dots.push({ dps: raw * .3 / 3, t: 3 });
  if (tgt.isUnit) {
    if (tgt.mod.reflect > 0 && tgt.reflectCd <= 0 && src.team === 1 && !o.noReflect) { tgt.reflectCd = .35; applyDamage(src, tgt.e.def * tgt.mod.reflect, tgt, { col: '#7fe6c6' }); }
    if (tgt.comps.includes('air_tank') && src.x !== undefined) {
      const a = Math.atan2(tgt.y - src.y, tgt.x - src.x); tgt.x += Math.cos(a) * 7; tgt.y += Math.sin(a) * 7; tgt.idle = 0; tgt.mom = Math.min(1, tgt.mom + .15);
    }
    tgt.flash = .1;
  } else tgt.flash = .08;
  return dealt;
}
function heal(src, tgt, amt, o) {
  o = o || {};
  amt *= src.e.heal;
  const real = Math.min(amt, tgt.maxHp - tgt.hp);
  if (real <= .2) return;
  tgt.hp += real; txt(tgt.x, tgt.y - tgt.r - 8, '+' + Math.round(real), '#6ee7a0', 11);
  if (src.els.includes('water') && !o.noDD) setDD(tgt, .15);
}
function killUnit(u) {
  u.dead = true; u.hp = 0; burst(u.x, u.y, EL[u.els[0]].c, 14);
  B.sel = B.sel.filter(s => s !== u);
  if (u.mod.split && !u.noSplit) {
    for (let i = 0; i < 2; i++) {
      const c = makeUnit(u.inst, clamp(u.x + (i ? 26 : -26), FIELD.x0, WALL.x - 40), clamp(u.y + rnd(-24, 24), FIELD.y0, FIELD.y1), { hpMul: .5, scale: .7, noSplit: true });
      c.order = { t: 'wall' }; B.units.push(c);
    }
    txt(u.x, u.y - 30, 'splits!', '#ff9a5a', 13);
  }
}
function killEnemy(e) { e.dead = true; e.hp = 0; burst(e.x, e.y, '#e5486a', 16); ring(e.x, e.y, 6, e.r * 2.2, '#e5486a', .4); if (e.type === 'boss') txt(e.x, e.y - 60, 'Warlord defeated', '#f2c14e', 16); }
function wallBreak() {
  for (let i = 0; i < 24; i++) burst(WALL.x + rnd(0, WALL.w), rnd(WALL.y0, WALL.y1), '#9aa3bd', 2);
  B.phase = B.wave >= B.stage.waves.length - 1 ? 'won' : 'wavewin';
  B.sel = []; B.targeting = null;
  if (B.onPhase) B.onPhase(B.phase);
}
function tickStatus(o, dt) {
  if (o.flash > 0) o.flash -= dt;
  if (o.dd) { o.dd.t -= dt; if (o.dd.t <= 0) o.dd = null; }
  if (o.slug > 0) o.slug -= dt;
  if (o.forced > 0) o.forced -= dt;
  const f = o.fdot;
  if (f && f.active) {
    f.timer -= dt;
    if (f.timer <= 0) {
      let v = 0; for (const k in f.src) { if (f.src[k].exp < B.t) delete f.src[k]; else v += f.src[k].v; }
      if (v > 0) applyDamage(o, v, null, { col: '#ff9a5a', dot: true });
      f.ticks--; f.timer = .7; if (f.ticks <= 0 || v <= 0) { f.active = false; f.src = {}; }
    }
  }
  if (o.dots && o.dots.length) {
    for (const d of o.dots) { const a = d.dps * Math.min(dt, d.t); d.t -= dt; applyDamage(o, a, null, { dot: true, quiet: true }); }
    o.dots = o.dots.filter(d => d.t > 0);
  }
}

/* ---------- movement ---------- */
function stepToward(u, tx, ty, dt, stop, spd) {
  const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
  if (d <= stop + .5) return true;
  const mv = Math.min((spd == null ? u.e.spd : spd) * dt, d - stop);
  u.x += dx / d * mv; u.y += dy / d * mv; u.moving = true;
  return d - mv <= stop + .5;
}
function wallPoint(u) { return { x: WALL.x, y: clamp(u.y, WALL.y0, WALL.y1) }; }
function gapTo(u, t) { if (t.isWall) { const p = wallPoint(u); return Math.hypot(p.x - u.x, p.y - u.y) - u.r; } return dist(u, t) - u.r - t.r; }
function approach(u, t, dt) {
  const sg = u.range * .9;
  if (t.isWall) { const p = wallPoint(u); stepToward(u, p.x, p.y, dt, sg + u.r); }
  else stepToward(u, t.x, t.y, dt, sg + u.r + t.r);
}
function autoTarget(u) {
  let best = null, bd = 1e9;
  for (const e of B.enemies) { if (e.dead) continue; const g = gapTo(u, e); if (g <= u.range && g < bd) { bd = g; best = e; } }
  if (best) return best;
  if (!B.wall.dead && gapTo(u, B.wall) <= u.range) return B.wall;
  return null;
}

/* ---------- player AI ---------- */
function projComp(u) { return u.comps.map(id => UNITS[id]).find(c => c.kind === 'proj') || UNITS[u.comps[0]]; }
function fireProj(u, tgt, raw) {
  const c = projComp(u), wall = tgt.isWall;
  const p = { team: 0, x: u.x, y: u.y, tgt: wall ? null : tgt, tx: wall ? WALL.x : tgt.x, ty: wall ? clamp(u.y, WALL.y0 + 4, WALL.y1 - 4) : tgt.y,
    speed: c.id === 'air_dps' ? 700 : 500, homing: !wall, col: EL[c.el].c, r: c.id === 'earth_dps' ? 7 : 5, kind: c.id, ang: 0,
    onHit: () => { if (!tgt.dead) hit(u, tgt, raw); } };
  B.projs.push(p);
}
function tryAttack(u, tgt) {
  if (u.cd > 0) return;
  u.cd = u.e.iv;
  if (u.paralyzed) { u.paralyzed = false; txt(u.x, u.y - u.r - 10, 'stunned', '#ffe066', 12); return; }
  const mul = u.comps.includes('earth_tank') ? Math.min(2.2, 1 + .35 * (u.e.iv - 1)) : 1;
  const raw = u.e.atk * mul;
  u.aim = Math.atan2(tgt.y - u.y, tgt.x - u.x);
  if (u.ak === 'proj') fireProj(u, tgt, raw);
  else {
    const tx = tgt.isWall ? WALL.x : tgt.x, ty = tgt.isWall ? clamp(u.y, WALL.y0, WALL.y1) : tgt.y;
    if (u.ak === 'flame') { for (let i = 0; i < 4; i++) { const a = u.aim + rnd(-.18, .18), s = rnd(200, 320); B.fx.push({ k: 'spark', x: u.x, y: u.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: rnd(.22, .4), col: pickR(['#ffb27a', '#ff7a3a', '#ffd166']), s: rnd(3, 6) }); } }
    else beam(u.x, u.y, tx, ty, EL[u.els[0]].c, 3);
    hit(u, tgt, raw);
  }
}
function aiCombat(u, dt) {
  const o = u.order;
  if (u.ak === 'crab' || u.ak === 'rod') { if (o.t === 'move' && stepToward(u, o.x, o.y, dt, 3)) u.order = { t: 'hold' }; return; }
  if (o.t === 'idle') return;
  if (o.t === 'move') { if (stepToward(u, o.x, o.y, dt, 3)) { u.order = u.dormant ? { t: 'idle' } : { t: 'hold' }; if (u.dormant) u.home = { x: u.x, y: u.y }; } return; }
  if (o.t === 'return') { if (stepToward(u, u.home.x, u.home.y, dt, 3)) u.order = { t: 'idle' }; return; }
  let tgt = null;
  if (o.t === 'attack') { if (o.target.dead) { u.order = u.dormant ? { t: 'return' } : { t: 'wall' }; return; } tgt = o.target; }
  else if (o.t === 'wall') {
    tgt = B.wall.dead ? null : B.wall;
    if (tgt && o.wy != null && !o.arrived) { if (stepToward(u, WALL.x - (u.range * .9 + u.r), o.wy, dt, 2)) o.arrived = true; return; }
  }
  else if (o.t === 'hold') tgt = autoTarget(u);
  if (!tgt) return;
  if (gapTo(u, tgt) > u.range) { if (!u.stationary && o.t !== 'hold') approach(u, tgt, dt); return; }
  tryAttack(u, tgt);
}
function aiRam(u, dt) {
  const o = u.order, maxV = u.e.spd;
  const accel = () => { u.vr = Math.min(maxV, u.vr + 80 * dt); };
  if (u.ramSt === 'back') { stepToward(u, u.backX, u.backY, dt, 4, 90); if (Math.hypot(u.backX - u.x, u.backY - u.y) < 8) u.ramSt = 'charge'; return; }
  if (o.t === 'move') { const done = stepToward(u, o.x, o.y, dt, 3, u.vr); accel(); if (done) u.order = { t: 'hold' }; return; }
  let tgt = null;
  if (o.t === 'attack') { if (o.target.dead) { u.order = { t: 'wall' }; return; } tgt = o.target; }
  else if (o.t === 'wall') tgt = B.wall.dead ? null : B.wall;
  if (!tgt) { u.vr = Math.max(25, u.vr - 300 * dt); return; }
  let contact = null;
  for (const e of B.enemies) if (!e.dead && dist(u, e) - u.r - e.r <= 5) { contact = e; break; }
  if (!contact && gapTo(u, B.wall) <= 5 && !B.wall.dead) contact = B.wall;
  if (contact) {
    const raw = u.e.atk * (u.vr / maxV);
    ring(u.x, u.y, 10, 60, EL.earth.c, .35, 3); burst(u.x, u.y, EL.earth.c, 10);
    hit(u, contact, raw); u.vr = 25; u.ramSt = 'back'; u.backX = clamp(u.x - 190, FIELD.x0 + 20, WALL.x - 200); u.backY = u.y; return;
  }
  const tx = tgt.isWall ? WALL.x : tgt.x, ty = tgt.isWall ? (o.wy != null ? o.wy : clamp(u.y, WALL.y0, WALL.y1)) : tgt.y;
  stepToward(u, tx, ty, dt, 0, u.vr); accel();
}
function lowestHp(list) { let b = null, br = .995; for (const a of list) { const r = a.hp / a.maxHp; if (r < br) { br = r; b = a; } } return b; }
function lowShield(list) { let b = null, br = 9; for (const a of list) { if (a.shield >= a.maxHp * .45) continue; const r = (a.hp + a.shield) / a.maxHp; if (r < br) { br = r; b = a; } } return b; }
function healable() { return B.units.filter(a => !a.dead && !a.rod); }
function runHeals(u, dt) {
  const allies = healable();
  for (const h of u.heals) {
    h.t -= dt; if (h.t > 0) continue;
    if (h.kind === 'aura') {
      h.t = h.iv; let any = false;
      for (const a of allies) if (dist(u, a) <= h.rad && a.hp < a.maxHp) { heal(u, a, h.pow); any = true; }
      if (any) ring(u.x, u.y, 8, h.rad, '#ffb27a', .5, 1.5);
    } else if (h.kind === 'nymph') {
      h.t = h.iv; let any = false;
      for (const a of allies) if (dist(u, a) <= h.rad + a.r && a.hp < a.maxHp) { heal(u, a, h.pow); any = true; }
      if (any) ring(u.x, u.y, 6, h.rad, '#6fe3c1', .35, 1.5);
    } else if (h.kind === 'spring') {
      const t = lowestHp(allies);
      if (t && dist(u, t) - t.r <= h.rng) {
        h.t = h.iv;
        B.projs.push({ team: 0, x: u.x, y: u.y, tgt: t, tx: t.x, ty: t.y, speed: 420, homing: true, col: '#7cc4ff', r: 5, kind: 'spring', ang: 0,
          onHit: () => { heal(u, t, h.pow); for (const a of allies) if (a !== t && !a.dead && dist(a, t) <= h.splash) heal(u, a, h.pow * .4, { noDD: true }); ring(t.x, t.y, 6, h.splash, '#7cc4ff', .4); } });
      } else h.t = .1;
    } else if (h.kind === 'shield') {
      const t = lowShield(allies);
      if (t && dist(u, t) - t.r <= h.rng) {
        h.t = h.iv; t.shield = Math.min(t.shield + h.pow * u.e.heal, t.maxHp * .5);
        if (u.els.includes('earth')) t.slug = Math.max(t.slug, 1.5);
        beam(u.x, u.y, t.x, t.y, '#c99a45', 3); ring(t.x, t.y, 6, t.r + 14, '#c99a45', .4);
      } else h.t = .1;
    }
  }
}
function aiSupport(u, dt) {
  const o = u.order;
  if (o && o.t === 'move') { if (stepToward(u, o.x, o.y, dt, 3)) u.order = { t: 'hold', hT: 1e9 }; return; }
  if (o && o.t === 'hold') { o.hT -= dt; if (o.hT > 0) return; u.order = null; }
  const allies = healable().filter(a => a !== u);
  const hk = u.heals[0] && u.heals[0].kind;
  const fighters = allies.filter(a => a.ak && a.ak !== 'crab' && a.ak !== 'rod');
  let dest = null, stop = 0;
  if (hk === 'aura') {
    const fs = fighters.length ? fighters : allies;
    if (fs.length) { dest = { x: fs.reduce((s, a) => s + a.x, 0) / fs.length - 40, y: fs.reduce((s, a) => s + a.y, 0) / fs.length }; stop = 12; }
  } else {
    const t = hk === 'shield' ? lowShield(allies) : lowestHp(allies);
    const h = u.heals[0];
    if (t) {
      if (hk === 'nymph') { dest = t; stop = 8; }
      else if (dist(u, t) - t.r > h.rng * .85) { dest = t; stop = h.rng * .8 + t.r; }
    } else {
      const fs = fighters.length ? fighters : allies;
      if (fs.length) { dest = { x: Math.max(FIELD.x0 + 20, Math.min.apply(null, fs.map(a => a.x)) - 60), y: fs.reduce((s, a) => s + a.y, 0) / fs.length }; stop = 8; }
    }
  }
  if (dest) stepToward(u, dest.x, dest.y, dt, stop);
}
function buildMound(u) {
  const mine = B.mounds.filter(m => m.owner === u);
  if (mine.length >= 2) B.mounds.splice(B.mounds.indexOf(mine[0]), 1);
  const hp = 60 + u.maxHp * .9;
  B.mounds.push({ x: clamp(u.x + 48, FIELD.x0, WALL.x - 40), y: clamp(u.y + rnd(-12, 12), FIELD.y0 + 10, FIELD.y1 - 10), r: 21, hp, max: hp, owner: u, t: 0 });
  burst(u.x + 48, u.y, '#c99a45', 6);
}
function updateRod(u, dt) {
  const r = u.rod;
  if (r.state === 'fly') {
    const d = Math.hypot(r.tx - u.x, r.ty - u.y), st = 560 * dt;
    if (d <= st) { u.x = r.tx; u.y = r.ty; r.state = 'planted'; r.t = 12; r.sT = .5; ring(u.x, u.y, 8, 90, '#6fe3c1', .6, 2); }
    else { u.x += (r.tx - u.x) / d * st; u.y += (r.ty - u.y) / d * st; }
    return;
  }
  r.t -= dt; r.sT -= dt;
  if (r.sT <= 0) {
    r.sT = 1.3;
    const a = rnd(0, 6.28), d = Math.sqrt(Math.random()) * 90, px = u.x + Math.cos(a) * d, py = u.y + Math.sin(a) * d;
    bolt(px, py, '#e9fff8'); ring(px, py, 6, 48, '#6fe3c1', .35, 3);
    for (const e of B.enemies) if (!e.dead && Math.hypot(e.x - px, e.y - py) <= 48 + e.r) { hit(u, e, u.e.atk); e.paralyzed = true; txt(e.x, e.y - e.r - 20, 'paralyzed', '#ffe066', 12); }
  }
  if (r.t <= 0) { u.dead = true; u.spent = true; burst(u.x, u.y, '#6fe3c1', 8); B.sel = B.sel.filter(s => s !== u); }
}
function updateUnit(u, dt) {
  tickStatus(u, dt);
  if (u.dead) return;
  if (u.reflectCd > 0) u.reflectCd -= dt;
  u.cd = Math.max(0, u.cd - dt);
  if (u.mod.drain && u.hp > u.maxHp * .2) u.hp -= u.maxHp * .012 * dt;
  if (u.rod) { updateRod(u, dt); return; }
  if (u.heals.length) runHeals(u, dt);
  if (u.ak === 'ram') aiRam(u, dt); else if (u.ak) aiCombat(u, dt); else aiSupport(u, dt);
  if (u.comps.includes('earth_dps')) { u.mT -= dt; if (u.mT <= 0) { u.mT = 7; if (B.enemies.some(e => !e.dead)) buildMound(u); } }
  if (u.els.includes('air')) {
    if (u.moving) { u.mom = Math.min(1, u.mom + dt * 1.2); u.idle = 0; }
    else { u.idle += dt; if (u.idle > 1.5) u.mom = Math.max(0, u.mom - dt * 2); }
  }
  u.moving = false;
}

/* ---------- enemy AI ---------- */
function pickTarget(e) {
  const inr = B.units.filter(u => !u.dead && !(u.rod && u.rod.state === 'fly') && dist(e, u) - e.r - u.r <= e.range);
  if (!inr.length) return null;
  const forced = inr.filter(u => u.forced > 0); if (forced.length) return pickR(forced);
  const byTaunt = list => { const m = Math.max.apply(null, list.map(u => u.e.tn)); return pickR(list.filter(u => u.e.tn === m)); };
  if (e.type === 'ballista') { const rg = inr.filter(u => u.ranged); return byTaunt(rg.length ? rg : inr); }
  if (e.type === 'catapult') { const mx = Math.min.apply(null, inr.map(u => u.x)); return pickR(inr.filter(u => u.x <= mx + 30)); }
  return byTaunt(inr);
}
function explodeEnemy(e, x, y, rad, raw) {
  ring(x, y, 8, rad, '#e5486a', .4, 3); burst(x, y, '#ffb27a', 10);
  for (const u of B.units) if (!u.dead && !(u.rod && u.rod.state === 'fly') && Math.hypot(u.x - x, u.y - y) <= rad + u.r * .5) hit(e, u, raw, { aoe: true });
}
function enemyShot(e, tgt) {
  const d = ENEMY[e.type], raw = e.e.atk;
  e.aim = Math.atan2(tgt.y - e.y, tgt.x - e.x);
  if (e.type === 'boss') { hit(e, tgt, raw); ring(tgt.x, tgt.y, 4, 30, '#e5486a', .25, 3); return; }
  const aoe = d.aoe || 0;
  const p = { team: 1, x: e.x, y: e.y, tgt: aoe ? null : tgt, tx: tgt.x, ty: tgt.y, speed: d.speed, homing: !aoe, col: aoe ? '#222' : '#d9dde8', r: aoe ? (e.type === 'catapult' ? 9 : 6) : 3, kind: e.type, ang: 0, raw, mul: 1,
    aoe, onHit: pr => { if (aoe) explodeEnemy(e, pr.x, pr.y, aoe, raw * (pr.mul || 1)); else if (!tgt.dead) hit(e, tgt, raw * (pr.mul || 1)); } };
  B.projs.push(p);
}
function bossUpdate(e, dt) {
  const rage = e.hp < e.maxHp * .5 ? .65 : 1;
  e.shT -= dt; e.smT -= dt;
  if (e.shT <= 0) { e.shT = 6.5 * rage; B.tele.push({ x: e.x, y: e.y, r: 200, t: 1.3, max: 1.3, raw: e.e.atk * 1.1, src: e }); }
  if (e.smT <= 0) {
    e.smT = 15 * rage;
    if (B.enemies.filter(a => !a.dead && a.type === 'archer').length < 8) for (let i = 0; i < 2; i++) { const a = makeEnemy('archer', Math.min(W - 40, WALL.x + WALL.w + rnd(40, 160)), clamp(e.y + (i ? 110 : -110), FIELD.y0 + 20, FIELD.y1 - 20)); a.cd = 1; B.enemies.push(a); ring(a.x, a.y, 4, 30, '#e5486a', .4); }
    txt(e.x, e.y - 60, 'Reinforcements!', '#e5486a', 14);
  }
}
function updateEnemy(e, dt) {
  tickStatus(e, dt);
  if (e.dead) return;
  e.cd -= dt;
  if (e.type === 'boss') bossUpdate(e, dt);
  if (e.cd > 0) return;
  const tgt = pickTarget(e);
  if (!tgt) { e.cd = 0; return; }
  if (e.paralyzed) { e.paralyzed = false; e.cd = e.e.iv; txt(e.x, e.y - e.r - 12, 'stunned', '#ffe066', 12); return; }
  e.cd = e.e.iv;
  enemyShot(e, tgt);
}

/* ---------- projectiles, mounds, telegraphs ---------- */
function stepProjs(dt) {
  for (const p of B.projs) {
    if (p.dead) continue;
    if (p.homing && p.tgt && !p.tgt.dead) { p.tx = p.tgt.x; p.ty = p.tgt.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), st = p.speed * dt;
    p.ang = Math.atan2(dy, dx);
    const reach = (p.homing && p.tgt && !p.tgt.dead) ? p.tgt.r * .7 : 0;
    if (d <= st + reach) { p.x = p.tx; p.y = p.ty; p.onHit(p); p.dead = true; continue; }
    p.x += dx / d * st; p.y += dy / d * st;
    p.life = (p.life || 0) + dt; p.d0 = p.d0 || d;
    if (p.team === 1) {
      for (const m of B.mounds) if (m.hp > 0 && Math.hypot(p.x - m.x, p.y - m.y) < m.r + 4) {
        m.hp -= p.raw * (p.mul || 1); burst(p.x, p.y, '#c99a45', 5);
        if (p.aoe) p.onHit(p);
        p.dead = true; break;
      }
      if (p.dead) continue;
      for (const u of B.units) if (u.wind && !u.dead && dist(p, u) < 75 && !(p.seen && p.seen[u.uid])) {
        (p.seen || (p.seen = {}))[u.uid] = 1;
        if (Math.random() < .3) { p.dead = true; ring(p.x, p.y, 3, 22, '#6fe3c1', .3); txt(p.x, p.y - 10, 'deflected', '#6fe3c1', 11); break; }
        p.mul = (p.mul || 1) * .8;
      }
    }
  }
  B.projs = B.projs.filter(p => !p.dead);
  B.mounds.forEach(m => { m.t += dt; });
  B.mounds = B.mounds.filter(m => m.hp > 0 && m.t < 22);
}
function stepTele(dt) {
  for (const t of B.tele) {
    t.t -= dt;
    if (t.t <= 0 && !t.src.dead) { ring(t.x, t.y, 20, t.r, '#e5486a', .45, 5); for (const u of B.units) if (!u.dead && Math.hypot(u.x - t.x, u.y - t.y) <= t.r + u.r * .5) hit(t.src, u, t.raw, { aoe: true }); }
  }
  B.tele = B.tele.filter(t => t.t > 0 && !t.src.dead);
}

/* ---------- world step ---------- */
function separate() {
  const all = B.units.filter(u => !u.dead && !(u.rod && u.rod.state === 'fly')).concat(B.enemies.filter(e => !e.dead));
  const mov = a => a.team === 0 && !a.stationary && !a.rod;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    if (a.team === 1 && b.team === 1) continue;
    if (a.team !== b.team && (a.ak === 'ram' || b.ak === 'ram')) continue;
    const d = Math.hypot(b.x - a.x, b.y - a.y), min = a.r + b.r - 2;
    if (d >= min || d < .01) continue;
    const push = min - d, nx = (b.x - a.x) / d, ny = (b.y - a.y) / d, am = mov(a), bm = mov(b);
    if (am && bm) { a.x -= nx * push / 2; a.y -= ny * push / 2; b.x += nx * push / 2; b.y += ny * push / 2; }
    else if (am) { a.x -= nx * push; a.y -= ny * push; }
    else if (bm) { b.x += nx * push; b.y += ny * push; }
  }
  for (const u of B.units) if (!u.dead) { u.x = clamp(u.x, FIELD.x0, WALL.x - u.r - 2); u.y = clamp(u.y, FIELD.y0, FIELD.y1); }
}
function sub(dt) {
  B.t += dt;
  B.auraT -= dt; if (B.auraT <= 0) { B.auraT = .2; recomputeAuras(); }
  B.units.forEach(computeEff); B.enemies.forEach(computeEff); computeEff(B.wall);
  if (B.phase === 'fight') {
    for (const u of B.units) if (!u.dead) updateUnit(u, dt);
    for (const e of B.enemies) updateEnemy(e, dt);
    tickStatus(B.wall, dt);
    stepProjs(dt); stepTele(dt); separate();
    B.units = B.units.filter(u => !u.dead || u.hp > 0 || false).filter(u => !u.dead);
    if (B.phase === 'fight' && !B.units.some(u => !u.dead && !u.spent)) { B.loseT += dt; if (B.loseT > .9) { B.phase = 'lost'; if (B.onPhase) B.onPhase('lost'); } }
  }
  updateFx(dt);
}
function step(dtRaw) {
  if (!B || B.paused) return;
  const dt = dtRaw * B.speed, n = Math.max(1, Math.ceil(dt / .034));
  for (let i = 0; i < n; i++) sub(dt / n);
}

/* ---------- player commands ---------- */
function canAttack(u) { return ['melee', 'proj', 'hound', 'ram'].includes(u.ak); }
function orderMove(units, p) {
  if (!units.length) return;
  const deploy = B.phase === 'deploy';
  const cx = units.reduce((s, u) => s + u.x, 0) / units.length, cy = units.reduce((s, u) => s + u.y, 0) / units.length;
  for (const u of units) {
    if ((u.stationary || u.spd === 0) && !deploy) continue;
    if (u.rod && u.rod.state) continue;
    let tx = units.length === 1 ? p.x : p.x + (u.x - cx) * .9, ty = units.length === 1 ? p.y : p.y + (u.y - cy) * .9;
    const lim = deploy ? (u.stationary ? WALL.x - 70 : DEPLOY_X) : WALL.x - u.r - 6;
    tx = clamp(tx, FIELD.x0 + u.r, lim); ty = clamp(ty, FIELD.y0 + 8, FIELD.y1 - 8);
    if (deploy) { u.x = tx; u.y = ty; u.home = { x: tx, y: ty }; ring(tx, ty, 4, 24, '#f2c14e', .3); }
    else { u.order = { t: 'move', x: tx, y: ty }; B.marks.push({ x: tx, y: ty, t: 0 }); if (u.ramSt === 'back') u.ramSt = 'charge'; }
  }
}
function wallOrder(units, y) {
  const mv = units.filter(u => canAttack(u) && !u.stationary);
  if (!mv.length) return;
  const cy = mv.reduce((s, u) => s + u.y, 0) / mv.length;
  for (const u of mv) u.order = { t: 'wall', wy: clamp(y + (u.y - cy) * .8, WALL.y0 + 12, WALL.y1 - 12), arrived: false };
}
function orderAttack(units, en) {
  if (B.phase !== 'fight') return;
  const melee = [];
  for (const u of units) {
    if (!canAttack(u) || u.stationary) continue;
    if (u.ranged || u.dormant) u.order = { t: 'attack', target: en }; else melee.push(u);
  }
  wallOrder(melee, en.y);   // melee units go to the stretch of wall nearest that enemy
  ring(en.x, en.y, 4, en.r + 14, '#e5486a', .35, 3);
}
function orderWall(units, p) {
  if (B.phase !== 'fight') return;
  wallOrder(units, p.y);
  B.marks.push({ x: WALL.x - 14, y: p.y, t: 0 }); ring(WALL.x + WALL.w / 2, p.y, 4, 46, '#e5486a', .4, 3);
}
function useAbility(p) {
  const T = B.targeting; if (!T) return;
  const u = T.unit;
  if (u.dead || u.abilityUsed) { B.targeting = null; return; }
  if (T.type === 'shine') {
    for (const a of B.units) if (!a.dead && Math.hypot(a.x - p.x, a.y - p.y) <= 130) { a.forced = 8; ring(a.x, a.y, 6, a.r + 12, '#f2c14e', .8, 3); }
    ring(p.x, p.y, 10, 130, '#f2c14e', .7, 3); u.abilityUsed = true;
  } else if (T.type === 'throw') {
    u.rod = { state: 'fly', tx: clamp(p.x, FIELD.x0 + 20, WALL.x - 20), ty: clamp(p.y, FIELD.y0 + 10, FIELD.y1 - 10) }; u.abilityUsed = true;
  }
  B.targeting = null;
}
