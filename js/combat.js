/* combat.js - layer 3, the battlefield. An autobattler: your units spawn at the left edge, column by column, swarm one enemy
 * together and hit it once a second. The player cannot steer them; clicking a unit only selects it (its tag below is highlighted).
 * Nothing happens until you click the screen that covers the map when you arrive.
 *
 * Scale: everything here is in map units (see FE.COMBAT, FE.ENEMIES and FE.MAPS in config.js). The screen scale is worked out
 * from the map width, and a unit is always the same size in map units, so a larger map makes the army feel smaller and slower.
 *
 * Enemies are heavy: nothing pushes them, your units flow around them. Each kind has its own small brain (see enemiesAct):
 * sleepers do nothing, melee enemies charge whatever they notice, the mage zaps from range.
 *
 * Units out on an expedition are taken out of state.units when you venture forth (state.expedition) and only come back
 * as survivors. Stardust from a death is added to the state at once. What you destroy on a map is kept in state.mapProg. */
FE.module(function (FE) {
  const $ = FE.$, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const hs = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
  const blend = (a, b, t) => { const A = rgb(a), B = rgb(b); return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`; };
  const CFG = FE.COMBAT;
  const HEAL = '#8fdcff', ZAP = '#ffe45c', LASER = '#ff5a4a';              // the colour of healing, of the mage's lightning, and of the cannon's laser

  const C = FE.combat = { active: false };
  let cv, ctx, dpr = 1, cw = 0, ch = 0, sc = 1, ox = 0, oy = 0;          // canvas size, map units -> pixels
  let map, roster, units, queue, waves, wi, enemies, target, parts, rings, bolts, lasers, orbs, selected, swarm = { x: 0, y: 0 };
  let T = 0, running = false, started = false, paused = false, modal = false, speedIdx = 0, spawnT = 0, over = false, endT = 0, dustGained = 0, armedAt = 0, last = performance.now();
  let arrows = [], tagSig = '', kills = {}, wallHit = {};                  // what this fight destroyed: enemies killed by kind, damage dealt to each wall
  const spr = {};

  const totalDust = list => list.reduce((n, u) => n + u.dust, 0);

  // a soft glow, one per colour
  function sprite(key, color) {
    if (spr[key]) return spr[key];
    const k = document.createElement('canvas'); k.width = k.height = 64;
    const g = k.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32), c = color || FE.PAL[key].glow;
    gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(.3, rgba(c, .5)); gr.addColorStop(.65, rgba(c, .12)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (spr[key] = k);
  }

  // ---------------------------------------------------------------- the map
  // a wall is a thin curve across the whole height of the map. Its ends bend back toward the left, so it cups your units.
  const wallX = (e, y) => { const u = (y - map.height / 2) / (map.height / 2); return e.cx + (e.sgn || -1) * map.bow * u * u; };
  function makeWall(w, i) {
    const e = { kind: 'wall', i, hp: w.hp, max: w.hp, atk: 0, cx: map.width * w.at, pts: [], flash: 0, dead: false, deadT: 0, thick: w.thick || 1, sgn: w.curve === 'right' ? 1 : -1, flag: !!w.flag, labelGap: w.labelGap || 0 };
    for (let k = 0; k <= 32; k++) { const y = map.height * k / 32; e.pts.push([wallX(e, y), y]); }
    return e;
  }
  // a body: sleeper, brute, stick fighter, mage, giant, cannon (see FE.ENEMIES)
  function makeFoe(f, i) {
    const t = FE.ENEMIES[f.type], x = map.width * f.x + (f.dx || 0), y = map.height / 2 + (f.dy || 0);
    return { kind: f.type, t, i, hp: t.hp, max: t.hp, r: t.r, x, y, hx: x, hy: y, cd: t.cannon ? t.every : (t.every || 1) * .5, cool: 0, lastFace: Math.PI, wheel: 0, aimErr: 0, thinkT: 0, tgt: null, aggroed: false,
             flash: 0, swingP: 0, face: Math.PI, dead: false, deadT: 0 };
  }
  // the nearest point on a wall to (px, py)
  function nearest(e, px, py) {
    let best = null, bd = Infinity;
    for (let i = 0; i < e.pts.length - 1; i++) {
      const [ax, ay] = e.pts[i], [bx, by] = e.pts[i + 1], dx = bx - ax, dy = by - ay;
      const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1), x = ax + dx * t, y = ay + dy * t, d = Math.hypot(px - x, py - y);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return { x: best[0], y: best[1], d: bd };
  }
  // how far (px, py) is from the surface of anything that is an enemy
  const surfaceDist = (e, px, py) => e.kind === 'wall' ? nearest(e, px, py).d : Math.hypot(px - e.x, py - e.y) - e.r;
  const surfacePoint = (e, px, py) => {
    if (e.kind === 'wall') return nearest(e, px, py);
    const dx = px - e.x, dy = py - e.y, d = Math.hypot(dx, dy) || 1;
    return { x: e.x + dx / d * e.r, y: e.y + dy / d * e.r, d: d - e.r };
  };

  // ---------------------------------------------------------------- what stays destroyed
  // state.mapProg[map id][enemy index] = { dead: 1 } or, for a wall, { hp }. Walls never heal, whatever died stays dead, and
  // enemies that are still alive come back at full health. A map that is fully cleared forgets all of it (see finish).
  function remember(e) {
    const m = FE.state.mapProg, p = m[map.id] || (m[map.id] = {});
    p[e.i] = e.dead ? { dead: 1 } : { hp: e.hp };
  }
  function applyProgress() {
    const p = FE.state.mapProg[map.id];
    if (!p) return;
    enemies.forEach(e => {
      const q = p[e.i]; if (!q) return;
      if (q.dead) { e.dead = true; e.hp = 0; e.deadT = 99; }
      else if (e.kind === 'wall' && q.hp != null) e.hp = q.hp;
    });
  }

  // ---------------------------------------------------------------- starting and ending
  FE.venture = function () { ventureTo(FE.targetIdx()); };

  function ventureTo(idx) {
    const s = FE.state;
    if (C.active || FE.collapsing || FE.UNITS.every(u => !s.units[u.id])) return;
    s.expedition = {}; s.expStarted = false;
    FE.UNITS.forEach(u => { s.expedition[u.id] = s.units[u.id]; s.units[u.id] = 0; });
    FE.save();
    begin(FE.MAPS[idx]);
  }

  function begin(m) {
    map = m; C.active = true;
    roster = []; units = []; queue = []; waves = []; wi = 0; parts = []; rings = []; bolts = []; lasers = []; arrows = []; orbs = []; selected = null; target = null;
    dustGained = 0; over = false; endT = 0; T = 0; spawnT = 0; kills = {}; wallHit = {};
    running = false; started = false; paused = false; modal = false; speedIdx = 0; tagSig = '';
    let id = 0;
    FE.UNITS.forEach(u => {
      const st = FE.unitStats(u.id);
      for (let i = 0; i < FE.state.expedition[u.id]; i++) {
        const r = Math.random();
        roster.push({ id: ++id, el: u.id, name: u.name, hp: st.hp, max: st.hp, atk: st.atk, dust: u.dust, spawned: false, dead: false,
                      x: 0, y: 0, vx: 0, vy: 0, cd: 0, age: 0, flare: 0, heal: 0, hit: 0, pend: 0,
                      slot: rand(-Math.PI, Math.PI), lay: r < .55 ? 0 : r < .87 ? 1 : 2 });   // slot / lay: where around an enemy this unit likes to stand
      }
    });
    queue = roster.slice().sort((a, b) => b.max - a.max || a.atk - b.atk);        // most health first, then least damage first
    // one wave (a column) per kind of unit, in that order; a kind with more units than fit in a column fills several
    const cap = Math.max(1, Math.floor((map.height - 2) / CFG.colSpacing)), kinds = [];
    queue.forEach(u => { let g = kinds.find(k => k.el === u.el); if (!g) kinds.push(g = { el: u.el, list: [] }); g.list.push(u); });
    kinds.forEach(g => { for (let i = 0; i < g.list.length; i += cap) waves.push(g.list.slice(i, i + cap)); });

    enemies = map.enemies.map((f, i) => f.type === 'wall' ? makeWall(f, i) : makeFoe(f, i));
    applyProgress();
    $('c-title').textContent = map.name;
    $('c-pause').textContent = 'Pause'; $('c-speed').innerHTML = CFG.speeds[0] + '&times;'; $('c-paused').hidden = true;
    closePanel();
    $('c-start').hidden = false;                                                    // nothing happens until it is clicked
    armedAt = performance.now() + 1000;                                             // (a click that lands while the screen is still sliding over is ignored)
    FE.goto(3);
    fit(); drawTags();
    setTimeout(() => { if (C.active && map === m && !started) $('c-start').focus({ preventScroll: true }); }, 950);
  }

  function startBattle() {
    if (!C.active || started || over || performance.now() < armedAt) return;
    started = true; running = true; FE.state.expStarted = true;
    $('c-start').hidden = true;
    FE.save();
  }

  function leave() {
    C.active = false; running = false;
    $('c-start').hidden = true;
    FE.goto(2);
    setTimeout(() => { if (!C.active) closePanel(); }, 1000);
    FE.render(); FE.save();
  }

  // units that were out when the page was closed count as retreated: all of them are lost, and all of them give their stardust.
  // (If the battle had not started yet, nothing happened to them: they simply come home.)
  FE.recoverExpedition = function () {
    const s = FE.state, ex = s.expedition;
    if (!ex) return;
    if (!s.expStarted) { FE.UNITS.forEach(u => { s.units[u.id] += ex[u.id] || 0; }); s.expedition = null; return; }
    let n = 0, d = 0;
    FE.UNITS.forEach(u => { n += ex[u.id] || 0; d += (ex[u.id] || 0) * u.dust; });
    s.stardust += d; s.expedition = null; s.expStarted = false;
    if (n) setTimeout(() => FE.toast(`Your ${n} units were still out in battle. They were abandoned: +${FE.fmt(d)} stardust.`, 6000), 600);
  };

  // Retreat before the battle began: nothing is lost, the units just come home
  function cancelVenture() {
    const s = FE.state;
    FE.UNITS.forEach(u => { s.units[u.id] += (s.expedition && s.expedition[u.id]) || 0; });
    s.expedition = null; s.expStarted = false;
    FE.toast('Your units came home.', 2600);
    leave();
  }

  function retreat() {
    const s = FE.state, n = roster.length, d = totalDust(roster);
    s.stardust += d; dustGained += d; s.expedition = null; s.expStarted = false;
    FE.toast(n ? `${n} unit${n === 1 ? '' : 's'} abandoned: +${FE.fmt(d)} stardust.` : 'You left the field.', 4200);
    leave();
  }

  function finish(win) {
    over = true; running = false;
    const s = FE.state, idx = FE.MAPS.indexOf(map), next = FE.MAPS[idx + 1];
    if (win) {                                                       // survivors come home at once, so closing the page cannot lose them
      roster.forEach(u => { s.units[u.el]++; });
      s.expedition = null; s.expStarted = false;
      const first = !s.cleared[map.id];
      s.cleared[map.id] = true;
      delete s.mapProg[map.id];                                      // the whole map is cleared: everything comes back next time (for testing; Venture Forth moves on anyway)
      s.target = null;                                               // Venture Forth goes to the next map not cleared
      let reward = null;
      if (first && map.reward) { reward = FE.REWARDS[map.reward]; if (map.reward === 'stabilizer') s.stabilizer = true; }
      FE.save(); FE.render();
      const rewardHtml = reward ? `<div class="reward"><b>${reward.name}</b>${reward.desc}</div>`
        : map.reward ? `<p class="dim">${FE.REWARDS[map.reward].name} (already claimed)</p>`
        : '';                                                                    // (maps marked placeholder have no reward yet: nothing is shown)
      panel(`<h3>${map.title}</h3>
        <p>stardust gained: <span class="dust">${FE.fmt(dustGained)}</span></p>
        ${roster.length ? `<p class="dim">${dustGained === 0 ? 'every unit survived.' : `${roster.length} unit${roster.length === 1 ? '' : 's'} survived.`}</p>` : '<p class="dim">no one survived.</p>'}
        ${report()}
        ${rewardHtml}
        <div class="btns"><button class="el" id="p-back" type="button">Back</button>${roster.length && next ? `<button class="el" id="p-next" type="button">Proceed &mdash; ${next.name}</button>` : ''}</div>
        <p class="dim">Back keeps your surviving units.</p>`);
      $('p-back').onclick = leave;
      if ($('p-next')) $('p-next').onclick = () => {
        if (next) { C.active = false; ventureTo(idx + 1); return; }          // the survivors go straight on to the next map
        panel(`<h3>Demo complete</h3><p>You beat the current demo.</p><p class="dim">The next map is not built yet. Your surviving units are safe.</p><div class="btns"><button class="el" id="p-back2" type="button">Back</button></div>`);
        $('p-back2').onclick = leave;
      };
    } else {
      s.expedition = null; s.expStarted = false; FE.save(); FE.render();
      panel(`<h3>Your army fell</h3><p>stardust gained: <span class="dust">${FE.fmt(dustGained)}</span></p>
        ${report()}
        ${s.mapProg[map.id] ? '<p class="rep">what you destroyed stays destroyed.</p>' : ''}
        <div class="btns"><button class="el" id="p-back" type="button">Back</button></div>`);
      $('p-back').onclick = leave;
    }
  }

  // the end-of-fight table: enemies killed on the left, damage to walls on the right. The biggest wall on the map is the main wall,
  // the others are auxiliary walls (numbered from the left).
  function report() {
    const names = { sleeper: 'sleeper', brute: 'brute', stick: 'stick fighter', mage: 'mage', giant: 'giant', archer: 'archer', cannon: 'cannon' };
    const k = Object.keys(kills).map(t => `${kills[t]} ${names[t] || t}${kills[t] === 1 ? '' : 's'}`);
    const walls = enemies.filter(e => e.kind === 'wall'), main = walls.reduce((b, e) => !b || e.max > b.max ? e : b, null);
    const aux = walls.filter(e => e !== main).sort((x, y) => x.cx - y.cx);
    const w = walls.map(e => ({ e, d: wallHit[e.i] || 0, n: e === main ? 'main wall' : `auxiliary wall ${aux.indexOf(e) + 1}` })).filter(x => x.d > 0)
      .sort((x, y) => (x.e === main ? -1 : y.e === main ? 1 : x.e.cx - y.e.cx))
      .map(x => `${x.n}: ${FE.fmt(x.d)} damage (${x.e.dead ? 'destroyed' : `${FE.fmt(x.e.hp)} of ${FE.fmt(x.e.max)} left`})`);
    const col = (h, l) => `<div><b>${h}</b>${l.length ? l.map(t => `<p class="rep">${t}</p>`).join('') : '<p class="rep">none</p>'}</div>`;
    return `<div class="rep-table">${col('enemies killed', k)}${col('damage to walls', w)}</div>`;
  }

  // ---------------------------------------------------------------- the pop-up panel
  function panel(html) { $('c-panel').innerHTML = html; $('c-modal').hidden = false; const b = $('c-panel').querySelector('button'); if (b) b.focus(); }
  function closePanel() { $('c-modal').hidden = true; modal = false; }
  function askRetreat() {
    if (!C.active || over) return;
    if (!started) { cancelVenture(); return; }
    modal = true;
    const n = roster.length, d = totalDust(roster);
    panel(`<h3>Retreat?</h3>
      <p>Abandon your ${n} unit${n === 1 ? '' : 's'}? They are lost for good.</p>
      <p>You would gain <span class="dust">${FE.fmt(d)}</span> stardust from them.</p>
      <div class="btns"><button class="el" id="p-yes" type="button">Abandon them</button><button class="el" id="p-no" type="button">Keep fighting</button></div>`);
    $('p-yes').onclick = retreat;
    $('p-no').onclick = closePanel;
  }

  // ---------------------------------------------------------------- effects
  function burst(x, y, c, n, vmin, vmax) {
    for (let i = 0; i < n; i++) { const a = rand(TAU), v = rand(vmin || 2, vmax || 9); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: rand(.3, .7), c, r: rand(.15, .3) }); }
  }
  const ring = (x, y, c, life, r0, r1, fill) => rings.push({ x, y, c, age: 0, life, r0, r1, fill: !!fill });

  // a unit is gone: a flash, two rings and a spray of sparks, so a death is never missed
  function pop(u) {
    const c = FE.PAL[u.el].glow;
    ring(u.x, u.y, '#ffffff', .22, .2, 1.4, true);
    ring(u.x, u.y, c, .5, .4, 2.8);
    burst(u.x, u.y, c, 16, 3, 11);
  }
  function breakWall(e) {
    e.dead = true; e.deadT = 0;
    e.pts.forEach(([x, y], i) => { if (i % 2 === 0) for (let k = 0; k < 2; k++) parts.push({ x, y, vx: rand(-3, 8), vy: rand(-5, 5), age: 0, life: rand(.5, 1.1), c: '#ffffff', r: rand(.1, .22) }); });
  }
  function breakFoe(e) {
    e.dead = true; e.deadT = 0;
    ring(e.x, e.y, '#ffffff', .6, e.r, e.r + 3 + e.r * .6);
    burst(e.x, e.y, '#ffffff', 14 + Math.round(e.r * 3), 2, 6 + e.r);
  }

  // ---------------------------------------------------------------- the simulation
  function hurt(u, dmg) {
    if (u.dead) return;
    u.hp -= dmg; u.hit = 1;
    if (u.hp > 0) return;
    u.hp = 0; u.dead = true;
    const i = units.indexOf(u); if (i >= 0) units.splice(i, 1);
    const j = roster.indexOf(u); if (j >= 0) roster.splice(j, 1);
    if (selected === u.id) selected = null;
    FE.state.stardust += u.dust; dustGained += u.dust;
    pop(u);
  }

  // a unit hits an enemy
  function strike(u, e) {
    u.flare = 1;
    if (e.kind === 'wall') wallHit[e.i] = (wallHit[e.i] || 0) + Math.min(u.atk, e.hp);
    e.hp -= u.atk; e.flash = 1; e.aggroed = true;
    const q = surfacePoint(e, u.x, u.y);
    for (let i = 0; i < 2; i++) parts.push({ x: q.x, y: q.y, vx: rand(-6, 1), vy: rand(-4, 4), age: 0, life: rand(.15, .35), c: FE.PAL[u.el].glow, r: rand(.12, .22) });
    if (e.hp <= 0) { e.hp = 0; e.kind === 'wall' ? breakWall(e) : (breakFoe(e), kills[e.kind] = (kills[e.kind] || 0) + 1); }
    if (e.kind === 'wall' || e.dead) remember(e);
  }

  // a water speck mends the most hurt ally nearby with a tiny orb, instead of attacking. It never heals past full health:
  // orbs still in flight count toward an ally's health (pend), so no one is sent more than they can use.
  function healAlly(u) {
    let best = null, bs = Infinity;
    for (const o of units) {
      if (o === u || o.dead || o.hp + o.pend >= o.max) continue;
      const d = Math.hypot(o.x - u.x, o.y - u.y);
      if (d > CFG.healRange) continue;
      const score = (o.hp + o.pend) / o.max + d * .001;
      if (score < bs) { bs = score; best = o; }
    }
    if (!best) return false;
    const amt = Math.min(CFG.healAmount, best.max - best.hp - best.pend);
    best.pend += amt;
    orbs.push({ x: u.x, y: u.y, to: best, amt, age: 0 });
    u.flare = 1;
    return true;
  }
  function stepOrbs(dt) {
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i], t = o.to; o.age += dt;
      if (t.dead) { orbs.splice(i, 1); burst(o.x, o.y, HEAL, 3, 1, 3); continue; }
      const dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy), st = CFG.orbSpeed * dt;
      if (d <= st + .25) {                                                          // it arrives
        t.pend = Math.max(0, t.pend - o.amt);
        t.hp = Math.min(t.max, t.hp + o.amt); t.heal = 1;
        burst(t.x, t.y, HEAL, 6, 1, 4); ring(t.x, t.y, HEAL, .4, .3, 1.8);
        orbs.splice(i, 1); continue;
      }
      o.x += dx / d * st; o.y += dy / d * st;
      if (Math.random() < .6) parts.push({ x: o.x, y: o.y, vx: rand(-.5, .5), vy: rand(-.5, .5), age: 0, life: rand(.12, .25), c: HEAL, r: .13 });
    }
  }

  // the mage: a zigzag of lightning from its hat to a unit. It appears at once, hurts at once, and fades over a second.
  function zap(e, u) {
    const sx = e.x, sy = e.y - e.r * .7 - e.r * 1.5, dx = u.x - sx, dy = u.y - sy, L = Math.hypot(dx, dy) || 1, n = Math.max(3, Math.round(L / 1.3)), nx = -dy / L, ny = dx / L;
    const pts = [[sx, sy]];
    for (let i = 1; i < n; i++) { const t = i / n, off = (i % 2 ? 1 : -1) * rand(.35, .9); pts.push([sx + dx * t + nx * off, sy + dy * t + ny * off]); }
    pts.push([u.x, u.y]);
    bolts.push({ pts, age: 0, life: 1 });
    e.cd = e.t.every; e.flash = Math.max(e.flash, .5);
    burst(u.x, u.y, ZAP, 8, 2, 8);
    hurt(u, e.t.atk);
  }

  // the archer: an arrow is a small white line that flies perfectly straight from where it was loosed, aimed at where the target
  // was at that moment (plus a little spread). It hits the first unit it touches, so it can miss, or hit someone else.
  function fireArrow(e, u) {
    const a = Math.atan2(u.y - e.y, u.x - e.x) + rand(-e.t.spread, e.t.spread), c = Math.cos(a), s = Math.sin(a);
    arrows.push({ x: e.x + c * (e.r + .4), y: e.y + s * (e.r + .4), vx: c * e.t.arrowSpeed, vy: s * e.t.arrowSpeed, dmg: e.t.atk, c, s });
    e.cd = e.t.every; e.flash = Math.max(e.flash, .35);
  }
  function stepArrows(dt) {
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i], nx = a.x + a.vx * dt, ny = a.y + a.vy * dt, dx = nx - a.x, dy = ny - a.y, L2 = dx * dx + dy * dy || 1e-6, rad = CFG.unitSize / 2 + .12;
      let hit = null, ht = Infinity;
      for (const u of units) {
        const t = clamp(((u.x - a.x) * dx + (u.y - a.y) * dy) / L2, 0, 1);
        if (Math.hypot(u.x - (a.x + dx * t), u.y - (a.y + dy * t)) < rad && t < ht) { ht = t; hit = u; }
      }
      if (hit) { burst(a.x + dx * ht, a.y + dy * ht, '#ffffff', 5, 1, 5); arrows.splice(i, 1); hurt(hit, a.dmg); continue; }
      a.x = nx; a.y = ny;
      if (nx < -4 || nx > map.width + 4 || ny < -4 || ny > map.height + 4) arrows.splice(i, 1);
    }
  }

  // the cannon's mouth: the tip of its barrel, which points the way it faces (at its target)
  const mouthAt = e => ({ x: e.x + Math.cos(e.face) * e.r * 1.1, y: e.y + Math.sin(e.face) * e.r * 1.1 });
  // the cannon: a straight laser from its mouth to a unit. It appears at once, hurts at once, and fades over a second, and it
  // ends in an explosion of sparks. The mouth then dims (e.cool counts the dimming down) and the cannon starts charging again.
  function fireCannon(e, u) {
    const m = mouthAt(e), hx = u.x, hy = u.y;
    lasers.push({ x1: m.x, y1: m.y, x2: hx, y2: hy, age: 0, life: 1 });
    e.cd = e.t.every; e.cool = 1; e.flash = Math.max(e.flash, .6);
    burst(m.x, m.y, LASER, 8, 2, 6);                                      // a flash at the mouth
    ring(hx, hy, '#ffffff', .22, .2, 1.7, true);                          // and the explosion where it hits
    ring(hx, hy, LASER, .55, .4, 3.6);
    burst(hx, hy, LASER, 26, 3, 13);
    burst(hx, hy, '#ffffff', 8, 2, 7);
    hurt(u, e.t.atk);
  }

  // a column of one kind of unit appears at once at the left edge
  function spawnWave(list) {
    const n = list.length, H = map.height;
    list.forEach((u, k) => {
      u.spawned = true; u.x = CFG.spawnX; u.y = H / 2 + (k - (n - 1) / 2) * CFG.colSpacing;
      u.vx = CFG.unitSpeed; u.vy = 0; u.cd = rand(.2, 1); u.age = 0;
      units.push(u);
      ring(u.x, u.y, FE.PAL[u.el].glow, .35, .2, 1.5);
    });
  }

  // does this enemy stand on our side of the first standing wall? (anything behind it cannot be reached yet)
  const reachable = (e, wall) => e.kind === 'wall' ? e === wall : (!wall || e.x < wallX(wall, e.y));

  // the swarm picks one enemy together: the one nearest to its middle, and it sticks with it unless another is clearly nearer
  function chooseTarget(alive, wall, dt) {
    if (!units.length) { target = null; return; }
    let cx = 0, cy = 0; for (const u of units) { cx += u.x; cy += u.y; } cx /= units.length; cy /= units.length;
    swarm.x = cx; swarm.y = cy;
    let best = null, bd = Infinity;
    for (const e of alive) { if (!reachable(e, wall)) continue; const d = surfaceDist(e, cx, cy); if (d < bd) { bd = d; best = e; } }
    if (target && !target.dead && reachable(target, wall) && target !== best && surfaceDist(target, cx, cy) <= bd + 3) best = target;
    target = best;
    // the side of the enemy the units like to stand on follows the swarm, but slowly, so they do not keep circling it
    if (target && target.kind !== 'wall') {
      const want = Math.atan2(cy - target.y, cx - target.x);
      if (target.baseA === undefined) target.baseA = want;
      else { const d = Math.atan2(Math.sin(want - target.baseA), Math.cos(want - target.baseA)); target.baseA += d * Math.min(1, dt * .5); }
    }
  }

  // the point to head for: the goal, or a point beside the enemy's body when the body is in the way
  function around(u, e, gx, gy) {
    const vx = gx - u.x, vy = gy - u.y, L2 = vx * vx + vy * vy;
    if (L2 < .01) return [gx, gy];
    const t = ((e.x - u.x) * vx + (e.y - u.y) * vy) / L2;
    if (t <= 0 || t >= 1) return [gx, gy];
    const px = u.x + vx * t, py = u.y + vy * t, Ra = e.r + CFG.unitSize * .5 + .5;
    if (Math.hypot(px - e.x, py - e.y) >= Ra) return [gx, gy];
    const L = Math.sqrt(L2), nx = -vy / L, ny = vx / L, side = vx * (e.y - u.y) - vy * (e.x - u.x) > 0 ? -1 : 1;
    return [e.x + nx * Ra * 1.2 * side, e.y + ny * Ra * 1.2 * side];
  }

  function spawn(dt) {
    spawnT -= dt;
    while (spawnT <= 0 && wi < waves.length) { spawnWave(waves[wi++]); spawnT += CFG.colGap; }
    if (wi >= waves.length) spawnT = 0;
  }

  // who an enemy goes for: of the units it can see, the one with the most health (then the nearest)
  function pickFor(e) {
    const t = e.t, seeR = t.ranged ? t.range : e.aggroed ? Math.max(t.aggro * 3, 30) : t.aggro;
    let best = null, bm = -1, bd = Infinity;
    for (const u of units) {
      const d = Math.hypot(u.x - e.x, u.y - e.y) - e.r - CFG.unitSize / 2;
      if (d > seeR) continue;
      if (u.max > bm || (u.max === bm && d < bd)) { best = u; bm = u.max; bd = d; }
    }
    return best;
  }

  function enemiesAct(dt, alive, wall) {
    const half = CFG.unitSize / 2;
    for (const e of alive) {
      const t = e.t;
      if (e.kind === 'wall' || t.sleeps) continue;
      if (!t.cannon) e.cd = Math.max(0, e.cd - dt);                                  // (a cannon only charges while it has a target)
      e.thinkT -= dt;
      if (e.tgt && e.tgt.dead) e.tgt = null;
      if (!e.tgt && e.thinkT <= 0) { e.tgt = pickFor(e); e.thinkT = .25; }
      const u = e.tgt;
      if (!u) continue;
      if (t.cannon) e.cd = Math.max(0, e.cd - dt);
      const dx = u.x - e.x, dy = u.y - e.y, dist = Math.hypot(dx, dy) || .001, gap = dist - e.r - half;
      const want = Math.atan2(dy, dx);
      if (t.turn) {                                                                    // a cannon swings round (its wheels turn): it cannot fire until it points at its target
        const d = Math.atan2(Math.sin(want - e.face), Math.cos(want - e.face)), st = clamp(d, -t.turn * dt, t.turn * dt);
        e.face += st; e.aimErr = Math.abs(d - st);
      } else e.face = want;
      if (t.ranged) { if (gap > t.range) e.tgt = null; else if (e.cd <= 0 && (!t.turn || e.aimErr < .05)) (t.cannon ? fireCannon : t.archer ? fireArrow : zap)(e, u); continue; }
      if (gap > t.reach) {                                                             // out of reach: walk up to it
        if (gap > Math.max(t.aggro * 3, 30)) { e.tgt = null; continue; }               // it got away
        const st = Math.min(t.speed * dt, gap - t.reach * .5);
        e.x += dx / dist * st; e.y += dy / dist * st;
      } else if (e.cd <= 0) {                                                          // in reach: stand still and hit it
        e.cd = t.every; e.swingP = 1;
        burst(u.x, u.y, '#ffffff', 4, 1, 5);
        hurt(u, t.atk);
      }
    }
    // enemies are heavy: only their own kind can shove them. They keep out of each other, out of walls they started behind, and in the map.
    const solid = alive.filter(e => e.kind !== 'wall');
    for (const e of solid) {
      if (e.t.sleeps || !e.t.speed) continue;
      for (const o of solid) {
        if (o === e) continue;
        const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || .001, over = e.r + o.r - d;
        if (over > 0) { const k = (o.t.sleeps || !o.t.speed ? 1 : .5) * over; e.x += dx / d * k; e.y += dy / d * k; }
      }
      for (const w of alive) if (w.kind === 'wall' && e.hx > w.cx) e.x = Math.max(e.x, wallX(w, e.y) + e.r + .1);
      e.x = clamp(e.x, e.r, map.width - e.r); e.y = clamp(e.y, e.r, map.height - e.r);
    }
  }

  function step(dt) {
    T += dt;
    for (const p of parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 2 * dt; p.vy *= 1 - 2 * dt; }
    parts = parts.filter(p => p.age < p.life);
    for (const r of rings) r.age += dt; rings = rings.filter(r => r.age < r.life);
    for (const b of bolts) b.age += dt; bolts = bolts.filter(b => b.age < b.life);
    for (const b of lasers) b.age += dt; lasers = lasers.filter(b => b.age < b.life);
    for (const e of enemies) { e.flash = Math.max(0, e.flash - dt * 4); e.swingP = Math.max(0, e.swingP - dt * 3.5); if (e.cool) e.cool = Math.max(0, e.cool - dt); if (e.dead) e.deadT += dt; }
    for (const u of roster) { u.flare = Math.max(0, u.flare - dt * 4); u.heal = Math.max(0, u.heal - dt * 2); u.hit = Math.max(0, u.hit - dt * 5); u.age += dt; }
    stepOrbs(dt);
    if (over) return;

    spawn(dt);
    const alive = enemies.filter(e => !e.dead);
    const wall = alive.reduce((b, e) => e.kind === 'wall' && (!b || e.cx < b.cx) ? e : b, null);   // the first wall still standing stops everyone
    chooseTarget(alive, wall, dt);
    const solid = alive.filter(e => e.kind !== 'wall'), half = CFG.unitSize / 2;

    // separation grid
    const grid = new Map(), G = CFG.sepDist;
    for (const u of units) { const k = Math.floor(u.x / G) * 4096 + Math.floor(u.y / G); (grid.get(k) || grid.set(k, []).get(k)).push(u); }

    for (const u of units) {
      let wx = 0, wy = 0, inRange = false;
      if (target) {
        if (target.kind === 'wall') {
          const p = nearest(target, u.x, u.y), d = p.d;
          if (d > CFG.approach) { wx = (p.x - u.x) / d * CFG.unitSpeed; wy = (p.y - u.y) / d * CFG.unitSpeed; }
          inRange = d <= CFG.range;
        } else {
          // spread out around the enemy: every unit has its own place on a ring around it, and goes round the body to get there
          const e = target, dist = Math.hypot(u.x - e.x, u.y - e.y);
          inRange = dist - e.r <= CFG.range;
          const base = e.baseA === undefined ? Math.atan2(swarm.y - e.y, swarm.x - e.x) : e.baseA, a = base + u.slot * .95, hold = e.r + .75 + u.lay * .85;
          const gx = e.x + Math.cos(a) * hold, gy = e.y + Math.sin(a) * hold, gd = Math.hypot(gx - u.x, gy - u.y);
          if (gd > .6) {
            const [ax, ay] = around(u, e, gx, gy), L = Math.hypot(ax - u.x, ay - u.y) || 1;
            const sp = inRange ? Math.min(CFG.unitSpeed, CFG.settleSpeed + gd * 1.5) : CFG.unitSpeed;   // already in range: only creep
            wx = (ax - u.x) / L * sp; wy = (ay - u.y) / L * sp;
          }
        }
      }
      // a unit acts once a second: a water speck mends a hurt ally instead of hitting
      u.cd -= dt;
      if (u.cd <= 0) {
        if (u.el === 'water' && healAlly(u)) u.cd += 1 / FE.UNIT_APS;
        else if (inRange && target && !target.dead) { strike(u, target); u.cd += 1 / FE.UNIT_APS; }
        else u.cd = Math.max(0, u.cd);
      }
      if (!inRange) u.cd = Math.max(u.cd, .15);
      u.vx += (wx - u.vx) * Math.min(1, dt * 10); u.vy += (wy - u.vy) * Math.min(1, dt * 10);
      u.x += u.vx * dt; u.y += u.vy * dt;
    }
    // push overlapping units apart, keep them in the map, on their side of the wall, and out of the enemies' bodies
    for (const u of units) {
      const gx = Math.floor(u.x / G), gy = Math.floor(u.y / G);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const cell = grid.get((gx + a) * 4096 + gy + b); if (!cell) continue;
        for (const o of cell) {
          if (o === u) continue;
          let dx = u.x - o.x, dy = u.y - o.y, d = Math.hypot(dx, dy);
          if (d >= G) continue;
          if (d < .001) { dx = rand(-1, 1); dy = rand(-1, 1); d = Math.hypot(dx, dy) || 1; }
          const push = (G - d) * .5; u.x += dx / d * push; u.y += dy / d * push;
        }
      }
      for (const e of solid) {                                   // heavy: the unit gives way, the enemy does not
        const dx = u.x - e.x, dy = u.y - e.y, d = Math.hypot(dx, dy) || .001, min = e.r + half + .05;
        if (d < min) { u.x = e.x + dx / d * min; u.y = e.y + dy / d * min; const vn = (u.vx * dx + u.vy * dy) / d; if (vn < 0) { u.vx -= vn * dx / d; u.vy -= vn * dy / d; } }
      }
      if (wall) { const lim = wallX(wall, u.y) - .5; if (u.x > lim) { u.x = lim; if (u.vx > 0) u.vx = 0; } }
      u.x = clamp(u.x, .5, map.width - .5); u.y = clamp(u.y, .5, map.height - .5);
    }

    enemiesAct(dt, alive, wall);
    stepArrows(dt);
    for (const e of enemies) if (e.kind === 'cannon') { e.wheel += Math.atan2(Math.sin(e.face - e.lastFace), Math.cos(e.face - e.lastFace)); e.lastFace = e.face; }

    if (!enemies.some(e => !e.dead)) { endT += dt; if (endT > 1.3) finish(true); }
    else if (!roster.length) { endT += dt; if (endT > .9) finish(false); }
  }

  // ---------------------------------------------------------------- drawing
  function fit() {
    const f = $('c-field'); if (!f || !map) return;
    cw = f.clientWidth; ch = f.clientHeight; if (!cw) return;
    dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    sc = Math.min(cw / map.width, ch / map.height) * .985;                      // pixels per map unit
    ox = (cw - map.width * sc) / 2; oy = (ch - map.height * sc) / 2;
  }

  function drawWall(e, px) {
    if (e.dead) {
      const t = e.deadT, a = Math.max(0, 1 - t / 1.1);
      if (a <= 0) return;
      ctx.strokeStyle = `rgba(255,255,255,${.85 * a})`; ctx.lineWidth = 1.6 * px * e.thick; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < e.pts.length - 1; i++) {
        if (hs(i, e.i) < .3) continue;
        const dx = (hs(i, 3 + e.i) - .3) * t * 5, dy = (hs(i, 9) - .5) * t * 4;
        ctx.moveTo(e.pts[i][0] + dx, e.pts[i][1] + dy); ctx.lineTo(e.pts[i + 1][0] + dx, e.pts[i + 1][1] + dy);
      }
      ctx.stroke();
      return;
    }
    ctx.lineCap = 'round'; ctx.beginPath();
    e.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = `rgba(190,205,255,${.1 + .25 * e.flash})`; ctx.lineWidth = 7 * px * e.thick; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${.78 + .22 * e.flash})`; ctx.lineWidth = (1.5 + e.flash) * px * e.thick; ctx.stroke();
    ctx.fillStyle = 'rgba(233,238,252,.85)'; ctx.font = `${17 * px}px "Times New Roman", serif`; ctx.textAlign = 'center';
    ctx.fillText(String(e.hp), e.pts[0][0] - e.labelGap, 1.7);
    if (e.flag) {                                                  // a small flag on a pole, to the right of the wall's upper end
      const fx = e.pts[0][0] + 1.3 + .3 * e.thick, w = Math.sin(T * 3) * .25;
      ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.3 * px;
      ctx.beginPath(); ctx.moveTo(fx, .5); ctx.lineTo(fx, 4.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx, .5); ctx.lineTo(fx + 2.3, 1.35 + w); ctx.lineTo(fx, 2.2); ctx.closePath();
      ctx.fillStyle = 'rgba(190,205,255,.18)'; ctx.fill(); ctx.stroke();
    }
  }

  // an enemy's health, in the same style as a wall's: the number above it, and a thin ring around it with one segment (and a
  // little divider) for each hit point. Bodies with a lot of health (the giant) get a plain ring that simply drains.
  function drawHealth(e, px) {
    const R = e.r + .65, n = e.max <= 12 ? e.max : 0, top = e.y - R - (e.kind === 'mage' ? e.r * 1.5 : 0);
    ctx.lineCap = 'butt'; ctx.lineWidth = 2.2 * px;
    if (n) {
      const seg = TAU / n, gap = Math.min(.18, seg * .3);
      for (let i = 0; i < n; i++) {
        const a0 = -Math.PI / 2 + i * seg + gap / 2;
        ctx.strokeStyle = i < e.hp ? `rgba(215,225,255,${.7 + .3 * e.flash})` : 'rgba(190,205,255,.1)';
        ctx.beginPath(); ctx.arc(e.x, e.y, R, a0, a0 + seg - gap); ctx.stroke();
      }
    } else {
      ctx.strokeStyle = 'rgba(190,205,255,.1)'; ctx.beginPath(); ctx.arc(e.x, e.y, R, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(215,225,255,${.7 + .3 * e.flash})`; ctx.beginPath(); ctx.arc(e.x, e.y, R, -Math.PI / 2, -Math.PI / 2 + TAU * e.hp / e.max); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(233,238,252,.85)'; ctx.font = `${17 * px}px "Times New Roman", serif`; ctx.textAlign = 'center';
    ctx.fillText(String(e.hp), e.x, top - .5);
  }

  function drawWeapon(e, px) {
    const w = e.t.weapon; if (!w) return;
    const wa = e.face + .85 - 1.7 * Math.sin(Math.PI * (1 - e.swingP)), ca = Math.cos(wa), sa = Math.sin(wa);   // rests at the side, chops across the way it faces
    const len = e.r * (w === 'club' ? .95 : 1.25), bx = e.x + ca * e.r * .92, by = e.y + sa * e.r * .92, tx = e.x + ca * (e.r + len), ty = e.y + sa * (e.r + len);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(190,205,255,${.12 + .2 * e.swingP})`; ctx.lineWidth = Math.max(6 * px, e.r * .5); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = Math.max(1.8 * px, e.r * (w === 'club' ? .2 : .1)); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    if (w === 'club') { ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(tx, ty, e.r * .27, 0, TAU); ctx.fill(); }
  }
  // the cannon, seen from above like a ship's cannon: the barrel is the whole enemy (a tapered tube with a rounded rear, bands and
  // a lip), on an axle with a big wheel each side. When it swings round the wheels turn (e.wheel), in opposite directions.
  function drawCannon(e, px) {
    const r = e.r, H = r * 1.1, f = e.flash;
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face);
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.3 * px;
    ctx.beginPath(); ctx.moveTo(-.15 * r, -.95 * r); ctx.lineTo(-.15 * r, .95 * r); ctx.stroke();               // the axle
    const wl = .9 * r, ww = .3 * r, step = wl / 4;
    for (const sd of [-1, 1]) {
      const cy = sd * .78 * r, x0 = -.15 * r - wl / 2;
      ctx.beginPath(); ctx.rect(x0, cy - ww / 2, wl, ww);
      ctx.fillStyle = 'rgba(6,9,26,.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5 * px; ctx.stroke();
      ctx.lineWidth = 1.1 * px; ctx.strokeStyle = 'rgba(190,205,255,.75)';
      const ph = ((sd * e.wheel * .8 * r) % step + step) % step;                                               // spokes roll along the wheel
      for (let k = -1; k <= 4; k++) { const x = x0 + ph + k * step; if (x > x0 + .02 && x < x0 + wl - .02) { ctx.beginPath(); ctx.moveTo(x, cy - ww / 2); ctx.lineTo(x, cy + ww / 2); ctx.stroke(); } }
    }
    const body = () => {
      ctx.beginPath(); ctx.moveTo(-H + .35 * r, -.4 * r); ctx.lineTo(H, -.3 * r); ctx.lineTo(H, .3 * r); ctx.lineTo(-H + .35 * r, .4 * r);
      ctx.quadraticCurveTo(-H - .08 * r, 0, -H + .35 * r, -.4 * r); ctx.closePath();
    };
    body(); ctx.fillStyle = 'rgba(6,9,26,.95)'; ctx.fill();
    ctx.fillStyle = `rgba(190,205,255,${.05 + .14 * f})`; ctx.fill();
    ctx.strokeStyle = `rgba(190,205,255,${.1 + .25 * f})`; ctx.lineWidth = 7 * px; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${.78 + .22 * f})`; ctx.lineWidth = (1.5 + f) * px; ctx.stroke();
    ctx.lineWidth = 1.1 * px; ctx.strokeStyle = 'rgba(255,255,255,.5)';
    for (const bx of [-.35 * r, .3 * r]) { const hw = (.35 + .05 * (bx / r + 1)) * r; ctx.beginPath(); ctx.moveTo(bx, -hw); ctx.lineTo(bx, hw); ctx.stroke(); }   // bands
    ctx.restore();
  }
  // the cannon's mouth. Right after a shot it flares, then dims almost to nothing for about a second; after that it glows
  // brighter and brighter until the next shot (e.cd counts the charge down, e.cool the dimming).
  function drawMouth(e, px) {
    const ch = 1 - e.cd / e.t.every, ramp = clamp((ch - .2) / .8, 0, 1), cool = e.cool || 0;
    const b = cool > 0 ? .1 + .9 * cool : .1 + .9 * Math.pow(ramp, 1.6);        // 0.1 = dim, 1 = about to fire
    // no visible opening: the glow sits at the very end of the barrel and only the half outside it can be seen, as if the light
    // were inside the barrel and only what escapes shows
    const H = e.r * 1.1, g = e.r * (.3 + 1.1 * b);
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.face);
    ctx.beginPath(); ctx.rect(H, -e.r * 4, e.r * 4, e.r * 8); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, b * 1.1); ctx.drawImage(sprite('laser', LASER), H - g, -g, g * 2, g * 2);
    if (b > .45) { const h = g * .45; ctx.globalAlpha = (b - .45) / .55; ctx.drawImage(sprite('laserhot', '#fff0e0'), H - h, -h, h * 2, h * 2); }
    ctx.restore();
  }
  // the archer's bow: an arc on the side it faces, with a string that is drawn back (and an arrow nocked) just before it shoots
  function drawBow(e, px) {
    const R = e.r * 1.45, sp = .85, f = e.face, pull = clamp(1 - e.cd / .7, 0, 1);
    const ax = e.x + Math.cos(f - sp) * R, ay = e.y + Math.sin(f - sp) * R, bx = e.x + Math.cos(f + sp) * R, by = e.y + Math.sin(f + sp) * R;
    const mr = R * Math.cos(sp) - pull * e.r * .6, mx = e.x + Math.cos(f) * mr, my = e.y + Math.sin(f) * mr;
    ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 1.5 * px;
    ctx.beginPath(); ctx.arc(e.x, e.y, R, f - sp, f + sp); ctx.stroke();
    ctx.lineWidth = 1 * px; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(mx, my); ctx.lineTo(bx, by); ctx.stroke();
    if (pull > 0) { ctx.strokeStyle = `rgba(255,255,255,${.4 + .5 * pull})`; ctx.lineWidth = 1.2 * px; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(e.x + Math.cos(f) * (R + .5), e.y + Math.sin(f) * (R + .5)); ctx.stroke(); }
  }
  function drawHat(e, px) {
    const r = e.r, by = e.y - r * .7, tip = by - r * 1.5, charge = e.cd < .8 ? 1 - e.cd / .8 : 0;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(e.x - r * .72, by); ctx.quadraticCurveTo(e.x - r * .05, by - r * .8, e.x + r * .22, tip); ctx.quadraticCurveTo(e.x + r * .35, by - r * .7, e.x + r * .72, by); ctx.closePath();
    ctx.fillStyle = 'rgba(190,205,255,.1)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 1.5 * px; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(e.x - r * 1.05, by); ctx.lineTo(e.x + r * 1.05, by); ctx.stroke();                       // the brim
    if (charge > 0) { const g = r * 1.9 * charge; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .9 * charge; ctx.drawImage(sprite('zap', ZAP), e.x + r * .22 - g, tip - g, g * 2, g * 2); ctx.restore(); }
  }
  function drawZzz(e, px) {
    ctx.textAlign = 'left';
    for (let k = 0; k < 3; k++) {
      const ph = (T * .4 + k / 3) % 1, a = Math.sin(Math.PI * ph);
      ctx.font = `italic ${(11 + 9 * ph) * px}px "Times New Roman", serif`;
      ctx.fillStyle = `rgba(233,238,252,${.8 * a})`;
      ctx.fillText(k % 2 ? 'z' : 'Z', e.x + e.r * .55 + ph * e.r * 1.2 + Math.sin(ph * 6 + k) * .25, e.y - e.r * .5 - ph * e.r * 2.3);
    }
  }
  function drawFoe(e, px) {
    if (e.dead) {                                                // the shell breaks into arcs that drift apart and fade
      const t = e.deadT, a = Math.max(0, 1 - t / 1.1);
      if (a <= 0) return;
      ctx.strokeStyle = `rgba(255,255,255,${.85 * a})`; ctx.lineWidth = 1.6 * px; ctx.lineCap = 'round';
      for (let k = 0; k < 9; k++) {
        const a0 = k / 9 * TAU + hs(k, e.i) * .25, mid = a0 + .3, drift = t * (1.5 + hs(k, 3) * 4);
        ctx.beginPath(); ctx.arc(e.x + Math.cos(mid) * drift, e.y + Math.sin(mid) * drift, e.r, a0, a0 + .6); ctx.stroke();
      }
      return;
    }
    if (e.kind === 'cannon') { drawCannon(e, px); drawMouth(e, px); drawHealth(e, px); return; }
    const f = e.flash;
    drawWeapon(e, px);
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU);
    ctx.fillStyle = `rgba(6,9,26,.9)`; ctx.fill();                                              // opaque, so a weapon never shows through the body
    ctx.fillStyle = `rgba(190,205,255,${.05 + .14 * f})`; ctx.fill();
    ctx.strokeStyle = `rgba(190,205,255,${.1 + .25 * f})`; ctx.lineWidth = 7 * px; ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${.78 + .22 * f})`; ctx.lineWidth = (1.5 + f) * px; ctx.stroke();
    if (e.kind === 'giant') { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = px; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * .8, 0, TAU); ctx.stroke(); }
    if (e.kind === 'mage') drawHat(e, px);
    if (e.kind === 'archer') drawBow(e, px);
    if (e.t.sleeps) drawZzz(e, px);
    drawHealth(e, px);
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
    const px = 1 / sc;
    ctx.strokeStyle = 'rgba(190,205,255,.1)'; ctx.lineWidth = px; ctx.strokeRect(0, 0, map.width, map.height);

    for (const e of enemies) e.kind === 'wall' ? drawWall(e, px) : drawFoe(e, px);

    // units: a small square with a soft glow of its element. The glow is quiet while it waits and flares to full strength
    // when the unit hits something (or heals someone), so you can see who is doing damage.
    const s = CFG.unitSize, glFull = Math.max(s * 2.6, 24 * px);
    ctx.globalCompositeOperation = 'lighter';
    for (const u of units) {
      const f = u.flare, gl = glFull * (.78 + .22 * f), born = Math.min(1, u.age / .25);
      ctx.globalAlpha = (.2 + .55 * f) * born;
      ctx.drawImage(sprite(u.el), u.x - gl, u.y - gl, gl * 2, gl * 2);
      if (u.heal > 0) { const hg = glFull * (.9 + .3 * u.heal); ctx.globalAlpha = .75 * u.heal; ctx.drawImage(sprite('heal', HEAL), u.x - hg, u.y - hg, hg * 2, hg * 2); }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (const u of units) {
      const p = FE.PAL[u.el], k = Math.min(1, u.age / .2), q = s * k;
      ctx.fillStyle = p.glow; ctx.fillRect(u.x - q / 2, u.y - q / 2, q, q);
      const h = u.heal, cs = q / 2 * (1 + .45 * h);                       // a healed unit's core flashes light blue (and swells a little)
      ctx.fillStyle = h > .02 ? blend(p.core, HEAL, Math.min(1, h * 1.5)) : p.core; ctx.fillRect(u.x - cs / 2, u.y - cs / 2, cs, cs);
      if (u.hit > 0) { ctx.fillStyle = `rgba(255,255,255,${.85 * u.hit})`; ctx.fillRect(u.x - q / 2, u.y - q / 2, q, q); }
      if (u.id === selected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * px; ctx.strokeRect(u.x - s * .85, u.y - s * .85, s * 1.7, s * 1.7); }
      if (u.hp < u.max) { ctx.fillStyle = p.glow; ctx.fillRect(u.x - s / 2, u.y + s * .7, s * u.hp / u.max, 2 * px); }
    }

    ctx.globalCompositeOperation = 'lighter';
    for (const b of bolts) {                                              // lightning: there at once, then it fades
      const a = Math.pow(1 - b.age / b.life, 1.4);
      ctx.lineJoin = ctx.lineCap = 'round'; ctx.beginPath();
      b.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.strokeStyle = rgba(ZAP, .4 * a); ctx.lineWidth = 6 * px; ctx.stroke();
      ctx.strokeStyle = `rgba(255,252,225,${.95 * a})`; ctx.lineWidth = 1.7 * px; ctx.stroke();
    }
    for (const b of lasers) {                                             // lasers: there at once, then they thin out and fade
      const a = Math.pow(1 - b.age / b.life, 1.4);
      ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2);
      ctx.strokeStyle = rgba(LASER, .35 * a); ctx.lineWidth = (3 + 9 * a) * px; ctx.stroke();
      ctx.strokeStyle = `rgba(255,238,225,${.95 * a})`; ctx.lineWidth = (.6 + 2.2 * a) * px; ctx.stroke();
    }
    ctx.lineCap = 'round';
    for (const a of arrows) {                                             // arrows: small white lines
      ctx.strokeStyle = 'rgba(190,205,255,.3)'; ctx.lineWidth = 4 * px; ctx.beginPath(); ctx.moveTo(a.x - a.c * 1.5, a.y - a.s * 1.5); ctx.lineTo(a.x, a.y); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 * px; ctx.stroke();
    }
    for (const o of orbs) {                                               // the tiny water orbs
      const g = 1.1; ctx.globalAlpha = .9; ctx.drawImage(sprite('heal', HEAL), o.x - g, o.y - g, g * 2, g * 2);
      ctx.globalAlpha = 1; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(o.x, o.y, .2, 0, TAU); ctx.fill();
    }
    for (const r of rings) {
      const q = r.age / r.life, rad = lerp(r.r0, r.r1, easeOut(q));
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU);
      if (r.fill) { ctx.fillStyle = rgba(r.c, .5 * (1 - q)); ctx.fill(); }
      ctx.strokeStyle = rgba(r.c, .85 * (1 - q)); ctx.lineWidth = (2.2 - 1.2 * q) * px; ctx.stroke();
    }
    for (const q of parts) { ctx.fillStyle = rgba(q.c, 1 - q.age / q.life); ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- the row of unit tags along the bottom
  // sorted by lowest health percentage, then highest max health. Units that are unhurt share one tag per kind.
  // Each tag has a health bar with a divider between hit points, and glows light blue when its unit is healed.
  const hpBar = (hp, max) => {
    if (max > 24) return `<span class="hpb solid"><s class="on" style="width:${(hp / max * 100).toFixed(0)}%"></s></span>`;
    let h = ''; for (let i = 0; i < max; i++) h += `<s${i < hp ? ' class="on"' : ''}></s>`;
    return `<span class="hpb">${h}</span>`;
  };
  function drawTags() {
    const groups = {}, singles = [];
    for (const u of roster) { if (u.hp >= u.max) (groups[u.el] = groups[u.el] || []).push(u); else singles.push(u); }
    const list = singles.map(u => ({ pct: u.hp / u.max, max: u.max, name: u.name, u, us: [u] }));
    for (const el in groups) { const g = groups[el]; list.push({ pct: 1, max: g[0].max, name: g[0].name, el, g, us: g }); }
    list.sort((a, b) => a.pct - b.pct || b.max - a.max || a.name.localeCompare(b.name));
    const sig = list.map(t => t.u ? `u${t.u.id}:${t.u.hp}:${t.u.id === selected}` : `c${t.el}:${t.g.length}:${t.g.some(u => u.id === selected)}`).join('|');
    const box = $('c-tags');
    if (sig !== tagSig) {
      tagSig = sig;
      box.innerHTML = list.map(t => t.u
        ? `<button class="ctag${t.u.id === selected ? ' sel' : ''}" data-el="${t.u.el}" data-uid="${t.u.id}" type="button">${t.name}<i>${t.u.hp}/${t.u.max}</i>${hpBar(t.u.hp, t.u.max)}</button>`
        : `<button class="ctag${t.g.some(u => u.id === selected) ? ' sel' : ''}" data-el="${t.el}" data-clump="${t.el}" type="button">${t.name}<i>&times;${t.g.length}</i>${hpBar(t.max, t.max)}</button>`).join('');
    }
    const kids = box.children;                                    // the glow when healed (the order matches the list: the signature says so)
    for (let i = 0; i < kids.length && i < list.length; i++) {
      let h = 0; for (const u of list[i].us) if (u.heal > h) h = u.heal;
      const v = h.toFixed(2);
      if (kids[i]._h !== v) { kids[i]._h = v; kids[i].style.setProperty('--heal', v); }
    }
  }

  // ---------------------------------------------------------------- loop and input
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = Math.min(.05, (now - last) / 1000); last = now;
    if (!C.active || FE.view !== 3 || document.hidden || !cw) return;
    if (running && !paused && !modal) {
      const total = raw * CFG.speeds[speedIdx] * CFG.timeScale, n = Math.max(1, Math.ceil(total / .03));
      for (let i = 0; i < n; i++) step(total / n);
    }
    draw(); drawTags();
  }

  function pick(e) {
    const r = cv.getBoundingClientRect(), mx = (e.clientX - r.left - ox) / sc, my = (e.clientY - r.top - oy) / sc;
    let best = null, bd = Math.max(1, 12 / sc);
    for (const u of units) { const d = Math.hypot(u.x - mx, u.y - my); if (d < bd) { bd = d; best = u; } }
    selected = best ? best.id : null;
    drawTags();
  }

  FE.buildCombat = function () {
    cv = $('c-cv'); ctx = cv.getContext('2d');
    new ResizeObserver(fit).observe($('c-field'));
    cv.addEventListener('pointerdown', e => { if (C.active && !over) pick(e); });
    $('c-start').addEventListener('click', startBattle);
    $('c-retreat').addEventListener('click', askRetreat);
    $('c-pause').addEventListener('click', () => { paused = !paused; $('c-pause').textContent = paused ? 'Resume' : 'Pause'; $('c-paused').hidden = !paused; });
    $('c-speed').addEventListener('click', () => { speedIdx = (speedIdx + 1) % CFG.speeds.length; $('c-speed').innerHTML = CFG.speeds[speedIdx] + '&times;'; });
    $('c-tags').addEventListener('click', e => {
      const b = e.target.closest('.ctag'); if (!b) return;
      if (b.dataset.uid) { const id = +b.dataset.uid; selected = selected === id ? null : id; }
      else {
        const g = roster.filter(u => u.el === b.dataset.clump && u.hp >= u.max), cur = g.find(u => u.id === selected);
        selected = cur ? null : (g.find(u => u.spawned) || g[0] || {}).id || null;
      }
      drawTags();
    });
    requestAnimationFrame(frame);
  };
});
