/* combat.js - layer 3, the battlefield. An autobattler: units spawn at the left edge, swarm the nearest enemy together and hit it
 * once a second. The player cannot steer them; clicking a unit only selects it (its tag below is highlighted).
 *
 * Scale: everything here is in map units (see FE.COMBAT and FE.MAPS in config.js). The screen scale is worked out from the
 * map width, and a unit is always the same size in map units, so a larger map makes the army feel smaller and slower.
 *
 * Units out on an expedition are taken out of state.units when you venture forth (state.expedition) and only come back
 * as survivors. Stardust from a death is added to the state at once. */
FE.module(function (FE) {
  const $ = FE.$, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const hs = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
  const CFG = FE.COMBAT;

  const C = FE.combat = { active: false };
  let cv, ctx, dpr = 1, cw = 0, ch = 0, sc = 1, ox = 0, oy = 0;          // canvas size, map units -> pixels
  let map, roster, units, queue, qi, enemies, parts, selected;
  let T = 0, running = false, paused = false, modal = false, speedIdx = 0, spawnT = 0, over = false, endT = 0, dustGained = 0, last = performance.now();
  let tagSig = '';
  const spr = {};

  const ELNAME = id => FE.UNITS.find(u => u.id === id);
  const totalDust = list => list.reduce((n, u) => n + u.dust, 0);

  // a soft glow, one per element
  function sprite(el) {
    if (spr[el]) return spr[el];
    const k = document.createElement('canvas'); k.width = k.height = 64;
    const g = k.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32), c = FE.PAL[el].glow;
    gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(.3, rgba(c, .5)); gr.addColorStop(.65, rgba(c, .12)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (spr[el] = k);
  }

  // ---------------------------------------------------------------- the map
  // a wall is a thin curve across the whole height of the map. Its ends bend back toward the left, so it cups your units.
  const wallX = (e, y) => { const u = (y - map.height / 2) / (map.height / 2); return e.cx - map.bow * u * u; };
  function makeWall(w, i) {
    const e = { kind: 'wall', i, hp: w.hp, max: w.hp, atk: 0, cx: map.width * w.at, pts: [], flash: 0, dead: false, deadT: 0 };
    for (let k = 0; k <= 32; k++) { const y = map.height * k / 32; e.pts.push([wallX(e, y), y]); }
    return e;
  }
  // the nearest point on an enemy to (px, py)
  function nearest(e, px, py) {
    let best = null, bd = Infinity;
    for (let i = 0; i < e.pts.length - 1; i++) {
      const [ax, ay] = e.pts[i], [bx, by] = e.pts[i + 1], dx = bx - ax, dy = by - ay;
      const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1), x = ax + dx * t, y = ay + dy * t, d = Math.hypot(px - x, py - y);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return { x: best[0], y: best[1], d: bd };
  }

  // ---------------------------------------------------------------- starting and ending
  FE.venture = function () {
    const s = FE.state;
    if (C.active || FE.collapsing || FE.UNITS.every(u => !s.units[u.id])) return;
    s.expedition = {};
    FE.UNITS.forEach(u => { s.expedition[u.id] = s.units[u.id]; s.units[u.id] = 0; });
    FE.save();
    begin(FE.MAPS[0]);
  };

  function begin(m) {
    map = m; C.active = true;
    roster = []; units = []; queue = []; qi = 0; parts = []; selected = null; dustGained = 0; over = false; endT = 0; T = 0; spawnT = 0;
    running = false; paused = false; modal = false; speedIdx = 0; tagSig = '';
    let id = 0;
    FE.UNITS.forEach(u => { for (let i = 0; i < FE.state.expedition[u.id]; i++) roster.push({ id: ++id, el: u.id, name: u.name, hp: u.hp, max: u.hp, atk: u.atk, dust: u.dust, spawned: false, x: 0, y: 0, vx: 0, vy: 0, cd: 0 }); });
    queue = roster.slice().sort((a, b) => b.max - a.max || a.atk - b.atk);        // most health first, then least damage first
    enemies = m.walls.map(makeWall);
    $('c-title').textContent = m.name;
    $('c-pause').textContent = 'Pause'; $('c-speed').innerHTML = CFG.speeds[0] + '&times;'; $('c-paused').hidden = true;
    closePanel();
    FE.goto(3);
    fit(); drawTags();
    setTimeout(() => { if (C.active && map === m) running = true; }, 1000);      // the units start spawning once the screen has fully moved over
  }

  function leave() {
    C.active = false; running = false;
    FE.goto(2);
    setTimeout(() => { if (!C.active) closePanel(); }, 1000);
    FE.render(); FE.save();
  }

  // units that were out when the page was closed count as retreated: all of them are lost, and all of them give their stardust
  FE.recoverExpedition = function () {
    const s = FE.state, ex = s.expedition;
    if (!ex) return;
    let n = 0, d = 0;
    FE.UNITS.forEach(u => { n += ex[u.id] || 0; d += (ex[u.id] || 0) * u.dust; });
    s.stardust += d; s.expedition = null;
    if (n) setTimeout(() => FE.toast(`Your ${n} units were still out in battle. They were abandoned: +${FE.fmt(d)} stardust.`, 6000), 600);
  };

  function retreat() {
    const s = FE.state, n = roster.length, d = totalDust(roster);
    s.stardust += d; dustGained += d; s.expedition = null;
    FE.toast(n ? `${n} unit${n === 1 ? '' : 's'} abandoned: +${FE.fmt(d)} stardust.` : 'You left the field.', 4200);
    leave();
  }

  function finish(win) {
    over = true; running = false;
    const s = FE.state;
    if (win) {                                                       // survivors come home at once, so closing the page cannot lose them
      roster.forEach(u => { s.units[u.el]++; });
      s.expedition = null;
      const first = !s.cleared[map.id];
      s.cleared[map.id] = true;
      let reward = null;
      if (first && map.reward) { reward = FE.REWARDS[map.reward]; if (map.reward === 'stabilizer') s.stabilizer = true; }
      FE.save(); FE.render();
      panel(`<h3>Surface Breached</h3>
        <p>stardust gained: <span class="dust">${FE.fmt(dustGained)}</span></p>
        ${dustGained === 0 ? '<p class="dim">every unit survived.</p>' : `<p class="dim">${roster.length} unit${roster.length === 1 ? '' : 's'} survived.</p>`}
        ${reward ? `<div class="reward"><b>${reward.name}</b>${reward.desc}</div>` : (map.reward ? `<p class="dim">${FE.REWARDS[map.reward].name} (already claimed)</p>` : '')}
        <div class="btns"><button class="el" id="p-back" type="button">Back</button><button class="el" id="p-next" type="button">Proceed &mdash; ${map.next}</button></div>
        <p class="dim">Back keeps your surviving units.</p>`);
      $('p-back').onclick = leave;
      $('p-next').onclick = () => {
        panel(`<h3>Demo complete</h3><p>You beat the current demo.</p><p class="dim">${map.next} is not built yet. Your surviving units are safe.</p><div class="btns"><button class="el" id="p-back2" type="button">Back</button></div>`);
        $('p-back2').onclick = leave;
      };
    } else {
      s.expedition = null; FE.save(); FE.render();
      panel(`<h3>Your army fell</h3><p>stardust gained: <span class="dust">${FE.fmt(dustGained)}</span></p><div class="btns"><button class="el" id="p-back" type="button">Back</button></div>`);
      $('p-back').onclick = leave;
    }
  }

  // ---------------------------------------------------------------- the pop-up panel
  function panel(html) { $('c-panel').innerHTML = html; $('c-modal').hidden = false; const b = $('c-panel').querySelector('button'); if (b) b.focus(); }
  function closePanel() { $('c-modal').hidden = true; modal = false; }
  function askRetreat() {
    if (!C.active || over) return;
    modal = true;
    const n = roster.length, d = totalDust(roster);
    panel(`<h3>Retreat?</h3>
      <p>Abandon your ${n} unit${n === 1 ? '' : 's'}? They are lost for good.</p>
      <p>You would gain <span class="dust">${FE.fmt(d)}</span> stardust from them.</p>
      <div class="btns"><button class="el" id="p-yes" type="button">Abandon them</button><button class="el" id="p-no" type="button">Keep fighting</button></div>`);
    $('p-yes').onclick = retreat;
    $('p-no').onclick = closePanel;
  }

  // ---------------------------------------------------------------- the simulation
  function hurt(u, dmg) {                                       // (nothing on the first map hurts units, but later enemies will)
    u.hp -= dmg;
    if (u.hp > 0) return;
    const i = units.indexOf(u); if (i >= 0) units.splice(i, 1);
    const j = roster.indexOf(u); if (j >= 0) roster.splice(j, 1);
    if (selected === u.id) selected = null;
    FE.state.stardust += u.dust; dustGained += u.dust;
    burst(u.x, u.y, u.el, 10);
  }
  function burst(x, y, el, n) { for (let i = 0; i < n; i++) { const a = rand(TAU), v = rand(2, 9); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: rand(.3, .7), c: FE.PAL[el].glow, r: rand(.15, .3) }); } }
  function breakWall(e) {
    e.dead = true; e.deadT = 0;
    e.pts.forEach(([x, y], i) => { if (i % 2 === 0) for (let k = 0; k < 2; k++) parts.push({ x, y, vx: rand(-3, 8), vy: rand(-5, 5), age: 0, life: rand(.5, 1.1), c: '#ffffff', r: rand(.1, .22) }); });
  }

  function spawn(dt) {
    spawnT -= dt;
    if (spawnT > 0 || qi >= queue.length) return;
    // a row at the left edge, filled from the middle outward; a unit waits until its slot is free
    const H = map.height;
    for (let k = 0; k < H; k++) {
      const y = H / 2 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (CFG.sepDist * 1.15);
      if (y < 1 || y > H - 1) continue;
      if (units.some(o => Math.abs(o.x - CFG.spawnX) < CFG.sepDist * 1.05 && Math.abs(o.y - y) < CFG.sepDist * 1.05)) continue;
      const u = queue[qi++]; u.spawned = true; u.x = CFG.spawnX; u.y = y; u.vx = CFG.unitSpeed; u.vy = 0; u.cd = rand(.2, 1);
      units.push(u); spawnT += CFG.spawnGap;
      return;
    }
    spawnT = 0;
  }

  function step(dt) {
    T += dt;
    for (const p of parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 2 * dt; p.vy *= 1 - 2 * dt; }
    parts = parts.filter(p => p.age < p.life);
    for (const e of enemies) { e.flash = Math.max(0, e.flash - dt * 4); if (e.dead) e.deadT += dt; }
    if (over) return;

    spawn(dt);
    const alive = enemies.filter(e => !e.dead);

    // the swarm acts as one mind: it goes for the enemy nearest to its middle
    let target = null;
    if (alive.length && units.length) {
      let cx = 0, cy = 0; for (const u of units) { cx += u.x; cy += u.y; } cx /= units.length; cy /= units.length;
      let bd = Infinity; for (const e of alive) { const d = nearest(e, cx, cy).d; if (d < bd) { bd = d; target = e; } }
    }
    const wall = alive.find(e => e.kind === 'wall');            // the first wall still standing stops everyone

    // separation grid
    const grid = new Map(), G = CFG.sepDist;
    for (const u of units) { const k = Math.floor(u.x / G) * 4096 + Math.floor(u.y / G); (grid.get(k) || grid.set(k, []).get(k)).push(u); }

    for (const u of units) {
      let wx = 0, wy = 0, inRange = false;
      if (target) {
        const p = nearest(target, u.x, u.y), d = p.d;
        if (d > CFG.range * .9) { wx = (p.x - u.x) / d * CFG.unitSpeed; wy = (p.y - u.y) / d * CFG.unitSpeed; }
        inRange = d <= CFG.range;
        if (inRange) {
          u.cd -= dt;
          while (u.cd <= 0 && !target.dead) {
            u.cd += 1 / FE.UNIT_APS;
            target.hp -= u.atk; target.flash = 1;
            const q = nearest(target, u.x, u.y);
            for (let i = 0; i < 2; i++) parts.push({ x: q.x, y: q.y, vx: rand(-6, 1), vy: rand(-4, 4), age: 0, life: rand(.15, .35), c: FE.PAL[u.el].glow, r: rand(.12, .22) });
            if (target.hp <= 0) { target.hp = 0; breakWall(target); }
          }
        } else u.cd = Math.max(u.cd, .15);
      }
      u.vx += (wx - u.vx) * Math.min(1, dt * 10); u.vy += (wy - u.vy) * Math.min(1, dt * 10);
      u.x += u.vx * dt; u.y += u.vy * dt;
    }
    // push overlapping units apart, keep them in the map and on their side of the wall
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
      if (wall) { const lim = wallX(wall, u.y) - .5; if (u.x > lim) { u.x = lim; if (u.vx > 0) u.vx = 0; } }
      u.x = clamp(u.x, .5, map.width - .5); u.y = clamp(u.y, .5, map.height - .5);
    }

    // enemies that fight back (none yet): they go for the unit with the most health and keep hitting it until it is dead
    for (const e of alive) {
      if (!e.atk) continue;
      if (!e.tgt || e.tgt.hp <= 0) e.tgt = units.reduce((b, u) => !b || u.max > b.max ? u : b, null);
      e.cd = (e.cd || 0) - dt;
      if (e.tgt && e.cd <= 0) { e.cd += 1; hurt(e.tgt, e.atk); }
    }

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

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
    const px = 1 / sc;
    ctx.strokeStyle = 'rgba(190,205,255,.1)'; ctx.lineWidth = px; ctx.strokeRect(0, 0, map.width, map.height);

    // walls
    for (const e of enemies) {
      if (e.dead) {
        const t = e.deadT, a = Math.max(0, 1 - t / 1.1);
        if (a <= 0) continue;
        ctx.strokeStyle = `rgba(255,255,255,${.85 * a})`; ctx.lineWidth = 1.6 * px; ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < e.pts.length - 1; i++) {
          if (hs(i, e.i) < .3) continue;
          const dx = (hs(i, 3 + e.i) - .3) * t * 5, dy = (hs(i, 9) - .5) * t * 4;
          ctx.moveTo(e.pts[i][0] + dx, e.pts[i][1] + dy); ctx.lineTo(e.pts[i + 1][0] + dx, e.pts[i + 1][1] + dy);
        }
        ctx.stroke();
        continue;
      }
      ctx.lineCap = 'round'; ctx.beginPath();
      e.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.strokeStyle = `rgba(190,205,255,${.1 + .25 * e.flash})`; ctx.lineWidth = 7 * px; ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${.78 + .22 * e.flash})`; ctx.lineWidth = (1.5 + e.flash) * px; ctx.stroke();
      ctx.fillStyle = 'rgba(233,238,252,.85)'; ctx.font = `${17 * px}px "Times New Roman", serif`; ctx.textAlign = 'center';
      ctx.fillText(String(e.hp), e.pts[0][0], 1.7);
    }

    // units: a small square with the glow of its element
    const s = CFG.unitSize, gl = Math.max(s * 2.6, 24 * px);
    ctx.globalCompositeOperation = 'lighter';
    for (const u of units) { ctx.globalAlpha = .75; ctx.drawImage(sprite(u.el), u.x - gl, u.y - gl, gl * 2, gl * 2); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (const u of units) {
      const p = FE.PAL[u.el];
      ctx.fillStyle = p.glow; ctx.fillRect(u.x - s / 2, u.y - s / 2, s, s);
      ctx.fillStyle = p.core; ctx.fillRect(u.x - s / 4, u.y - s / 4, s / 2, s / 2);
      if (u.id === selected) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * px; ctx.strokeRect(u.x - s * .85, u.y - s * .85, s * 1.7, s * 1.7); }
      if (u.hp < u.max) { ctx.fillStyle = p.glow; ctx.fillRect(u.x - s / 2, u.y + s * .7, s * u.hp / u.max, 2 * px); }
    }

    ctx.globalCompositeOperation = 'lighter';
    for (const q of parts) { ctx.fillStyle = rgba(q.c, 1 - q.age / q.life); ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- the row of unit tags along the bottom
  // sorted by lowest health percentage, then highest max health. Units that are unhurt share one tag per kind.
  function drawTags() {
    const groups = {}, singles = [];
    for (const u of roster) { if (u.hp >= u.max) (groups[u.el] = groups[u.el] || []).push(u); else singles.push(u); }
    const list = singles.map(u => ({ pct: u.hp / u.max, max: u.max, name: u.name, u }));
    for (const el in groups) { const g = groups[el]; list.push({ pct: 1, max: g[0].max, name: g[0].name, el, g }); }
    list.sort((a, b) => a.pct - b.pct || b.max - a.max || a.name.localeCompare(b.name));
    const sig = list.map(t => t.u ? `u${t.u.id}:${t.u.hp}:${t.u.id === selected}` : `c${t.el}:${t.g.length}:${t.g.some(u => u.id === selected)}`).join('|');
    if (sig === tagSig) return;
    tagSig = sig;
    $('c-tags').innerHTML = list.map(t => t.u
      ? `<button class="ctag${t.u.id === selected ? ' sel' : ''}" data-el="${t.u.el}" data-uid="${t.u.id}" type="button">${t.name}<i>${t.u.hp}/${t.u.max}</i><b style="width:${(t.pct * 100).toFixed(0)}%"></b></button>`
      : `<button class="ctag${t.g.some(u => u.id === selected) ? ' sel' : ''}" data-el="${t.el}" data-clump="${t.el}" type="button">${t.name}<i>&times;${t.g.length}</i></button>`).join('');
  }

  // ---------------------------------------------------------------- loop and input
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = Math.min(.05, (now - last) / 1000); last = now;
    if (!C.active || FE.view !== 3 || document.hidden || !cw) return;
    if (running && !paused && !modal) {
      const total = raw * CFG.speeds[speedIdx], n = Math.max(1, Math.ceil(total / .03));
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
