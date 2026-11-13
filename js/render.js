'use strict';
/* ===== Wallbreakers: canvas rendering ===== */
let BG = null;
function makeBG() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#0f1823'); gr.addColorStop(.7, '#111826'); gr.addColorStop(1, '#171320');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(160,185,220,.055)'; g.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, H); g.stroke(); }
  for (let y = 0; y <= H; y += 40) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(W, y + .5); g.stroke(); }
  g.strokeStyle = 'rgba(160,185,220,.13)'; g.lineWidth = 2;
  g.strokeRect(FIELD.x0 - 8, FIELD.y0 - 8, WALL.x - FIELD.x0 + 8, FIELD.y1 - FIELD.y0 + 16);
  g.fillStyle = 'rgba(160,185,220,.1)'; g.font = '600 12px "IBM Plex Mono",monospace';
  for (let x = 200; x < WALL.x; x += 200) { g.fillText(String(Math.round((WALL.x - x) / 10)) + ' m', x + 4, FIELD.y1 + 28); g.fillRect(x, FIELD.y1 + 8, 1, 8); }
  return c;
}
function hpBar(g, x, y, w, ratio, col, shieldRatio) {
  g.fillStyle = 'rgba(5,8,12,.8)'; g.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  g.fillStyle = col; g.fillRect(x - w / 2, y, w * clamp(ratio, 0, 1), 4);
  if (shieldRatio > 0) { g.fillStyle = '#dff3ff'; g.fillRect(x - w / 2, y - 3, w * clamp(shieldRatio, 0, 1), 2); }
}
function renderBattle(g) {
  if (!BG) BG = makeBG();
  g.drawImage(BG, 0, 0);
  const deploy = B.phase === 'deploy', t = B.t;
  if (deploy) {
    g.fillStyle = 'rgba(242,193,78,.06)'; g.fillRect(FIELD.x0 - 8, FIELD.y0 - 8, DEPLOY_X - FIELD.x0 + 8, FIELD.y1 - FIELD.y0 + 16);
    g.strokeStyle = 'rgba(242,193,78,.5)'; g.setLineDash([8, 8]); g.lineWidth = 2; g.beginPath(); g.moveTo(DEPLOY_X, FIELD.y0 - 8); g.lineTo(DEPLOY_X, FIELD.y1 + 8); g.stroke();
    g.strokeStyle = 'rgba(255,122,58,.35)'; g.beginPath(); g.moveTo(WALL.x - 70, FIELD.y0 - 8); g.lineTo(WALL.x - 70, FIELD.y1 + 8); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(242,193,78,.75)'; g.font = '600 17px "IBM Plex Mono",monospace'; g.fillText('DEPLOYMENT ZONE', FIELD.x0, FIELD.y0 - 18);
    g.fillStyle = 'rgba(255,122,58,.7)'; g.fillText('FLAMETHROWERS MAY GO UP TO HERE', WALL.x - 70 - 340, FIELD.y0 - 18);
  }
  drawWall(g, B.wall, B.boss && !B.boss.dead);
  // interaction radius: faint circle in the unit's own element colour
  if (B.showAura !== false) {
    for (const u of B.units) {
      if (u.dead || (u.rod && u.rod.state === 'fly')) continue;
      const sel = B.sel.includes(u);
      g.lineWidth = sel ? 2.5 : 1.4; g.globalAlpha = sel ? .5 : .13;
      g.strokeStyle = EL[u.els[0]].c; g.beginPath(); g.arc(u.x, u.y, AURA_R, 0, 6.28); g.stroke();
      if (u.els[1]) { g.strokeStyle = EL[u.els[1]].c; g.setLineDash([12, 12]); g.beginPath(); g.arc(u.x, u.y, AURA_R, 0, 6.28); g.stroke(); g.setLineDash([]); }
      if (sel) { g.globalAlpha = .05; g.fillStyle = EL[u.els[0]].c; g.beginPath(); g.arc(u.x, u.y, AURA_R, 0, 6.28); g.fill(); }
    }
    g.globalAlpha = 1;
  }
  // passive auras
  for (const u of B.units) {
    if (u.dead) continue;
    for (const h of u.heals) if (h.kind === 'aura') { g.fillStyle = 'rgba(255,122,58,.05)'; g.beginPath(); g.arc(u.x, u.y, h.rad, 0, 6.28); g.fill(); }
    if (u.wind) { g.strokeStyle = 'rgba(111,227,193,.22)'; g.lineWidth = 2; g.setLineDash([10, 14]); g.lineDashOffset = -t * 30; g.beginPath(); g.arc(u.x, u.y, 70, 0, 6.28); g.stroke(); g.setLineDash([]); }
  }
  // mounds
  for (const m of B.mounds) {
    const gr = g.createRadialGradient(m.x - 5, m.y - 6, 2, m.x, m.y, m.r); gr.addColorStop(0, '#dcb36a'); gr.addColorStop(1, '#6b4a14');
    g.fillStyle = gr; g.beginPath(); g.arc(m.x, m.y, m.r, 0, 6.28); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
    hpBar(g, m.x, m.y - m.r - 8, 30, m.hp / m.max, '#c99a45');
  }
  // telegraphs
  for (const tl of B.tele) { const k = 1 - tl.t / tl.max; g.fillStyle = 'rgba(229,72,106,' + (.06 + .14 * k) + ')'; g.strokeStyle = 'rgba(229,72,106,.8)'; g.lineWidth = 2; g.beginPath(); g.arc(tl.x, tl.y, tl.r, 0, 6.28); g.fill(); g.stroke(); g.beginPath(); g.arc(tl.x, tl.y, tl.r * k, 0, 6.28); g.stroke(); }
  // enemies
  for (const e of B.enemies) {
    if (e.dead) continue;
    drawEnemy(g, e, t);
    hpBar(g, e.x, e.y - e.r - 12, e.type === 'boss' ? 90 : e.r * 2 + 8, e.hp / e.maxHp, '#e5486a');
    statusDots(g, e, e.y - e.r - 20);
    if (B.hover === e && B.sel.length) { g.strokeStyle = '#e5486a'; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath(); g.arc(e.x, e.y, e.r + 9, 0, 6.28); g.stroke(); g.setLineDash([]); }
  }
  if (B.hover === B.wall && B.sel.length && B.phase === 'fight') { g.strokeStyle = '#e5486a'; g.lineWidth = 3; g.setLineDash([8, 6]); g.strokeRect(WALL.x - 6, WALL.y0 - 6, WALL.w + 12, WALL.y1 - WALL.y0 + 12); g.setLineDash([]); }
  // units
  const us = B.units.filter(u => !u.dead).sort((a, b) => a.y - b.y);
  for (const u of us) {
    // glow in the colour of each element currently affecting this unit
    const srcs = Object.keys(u.mod.seen).map(k => k.split('>')[0]).filter((e, i, a) => a.indexOf(e) === i);
    for (let i = srcs.length - 1; i >= 0; i--) {
      const c = EL[srcs[i]].c;
      g.save(); g.shadowColor = c; g.shadowBlur = 26; g.globalAlpha = .6 + .25 * Math.sin(t * 4 + i); g.fillStyle = c;
      g.beginPath(); g.arc(u.x, u.y, u.r + 3 + i * 5, 0, 6.28); g.fill(); g.restore();
    }
    if (u.mom > .2) { g.strokeStyle = 'rgba(111,227,193,' + (u.mom * .6) + ')'; g.lineWidth = 2; g.beginPath(); g.arc(u.x, u.y, u.r + 5, 0, 6.28); g.stroke(); }
    if (u.forced > 0) { g.strokeStyle = 'rgba(242,193,78,.9)'; g.lineWidth = 3; g.beginPath(); g.arc(u.x, u.y, u.r + 8 + Math.sin(t * 8) * 2, 0, 6.28); g.stroke(); }
    if (B.sel.includes(u)) { g.strokeStyle = '#f2c14e'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(u.x, u.y + u.r * .55, u.r + 7, u.r * .7 + 4, 0, 0, 6.28); g.stroke(); }
    let sc = u.small ? .8 : 1;
    if (u.dormant && u.order.t === 'idle') g.globalAlpha = .85;
    drawSprite(g, u.comps, u.x, u.y, u.r * sc, { flash: u.flash > 0 });
    g.globalAlpha = 1;
    if (!(u.rod && u.rod.state === 'planted' && false)) {
      hpBar(g, u.x, u.y - u.r - 10, Math.max(26, u.r * 2), u.hp / u.maxHp, u.hitsN ? '#7cc4ff' : '#58d68d', u.shield / u.maxHp);
      statusDots(g, u, u.y - u.r - 18);
    }
    if (u.inst.tier > 1) { g.fillStyle = '#f2c14e'; for (let i = 0; i < u.inst.tier; i++) g.fillRect(u.x - u.inst.tier * 3 + i * 6 + 1, u.y + u.r + 4, 4, 4); }
    if (u.rod && u.rod.state === 'planted') { g.strokeStyle = 'rgba(111,227,193,.3)'; g.setLineDash([4, 6]); g.beginPath(); g.arc(u.x, u.y, 90, 0, 6.28); g.stroke(); g.setLineDash([]); }
    if (B.sel.includes(u) && u.ranged) { g.strokeStyle = 'rgba(242,193,78,.2)'; g.setLineDash([6, 8]); g.lineWidth = 1.5; g.beginPath(); g.arc(u.x, u.y, u.range + u.r, 0, 6.28); g.stroke(); g.setLineDash([]); }
  }
  // projectiles
  for (const p of B.projs) {
    g.save();
    if (p.team === 1) {
      if (p.aoe) {
        const prog = p.d0 ? clamp(1 - Math.hypot(p.tx - p.x, p.ty - p.y) / p.d0, 0, 1) : 0, lift = Math.sin(Math.PI * prog) * (p.kind === 'catapult' ? 80 : 30);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(p.x, p.y, p.r, p.r * .5, 0, 0, 6.28); g.fill();
        g.fillStyle = p.kind === 'catapult' ? '#8d95a8' : '#2a2f3d'; g.strokeStyle = '#e5486a'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y - lift, p.r, 0, 6.28); g.fill(); g.stroke();
      } else {
        g.translate(p.x, p.y); g.rotate(p.ang); g.strokeStyle = p.kind === 'ballista' ? '#ffd0d8' : '#d9dde8'; g.lineWidth = p.kind === 'ballista' ? 4 : 2;
        const L = p.kind === 'ballista' ? 26 : 13; g.beginPath(); g.moveTo(-L, 0); g.lineTo(0, 0); g.stroke();
      }
    } else {
      g.fillStyle = p.col; g.shadowColor = p.col; g.shadowBlur = 10;
      g.translate(p.x, p.y); g.rotate(p.ang);
      if (p.kind === 'air_dps') { g.beginPath(); g.moveTo(10, 0); g.lineTo(-8, -5); g.lineTo(-4, 0); g.lineTo(-8, 5); g.closePath(); g.fill(); }
      else { g.beginPath(); g.arc(0, 0, p.r, 0, 6.28); g.fill(); g.globalAlpha = .35; g.beginPath(); g.ellipse(-p.r * 2, 0, p.r * 2, p.r * .7, 0, 0, 6.28); g.fill(); }
    }
    g.restore();
  }
  // fx
  for (const f of B.fx) {
    const k = f.t / f.max;
    if (f.k === 'txt') { g.globalAlpha = 1 - k * k; g.font = '600 ' + f.size + 'px "IBM Plex Mono",monospace'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(5,8,12,.85)'; g.strokeText(f.text, f.x, f.y); g.fillStyle = f.col; g.fillText(f.text, f.x, f.y); g.textAlign = 'left'; }
    else if (f.k === 'ring') { g.globalAlpha = 1 - k; g.strokeStyle = f.col; g.lineWidth = f.w; g.beginPath(); g.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * k, 0, 6.28); g.stroke(); }
    else if (f.k === 'spark') { g.globalAlpha = 1 - k; g.fillStyle = f.col; g.fillRect(f.x - f.s / 2, f.y - f.s / 2, f.s, f.s); }
    else if (f.k === 'beam') { g.globalAlpha = 1 - k; g.strokeStyle = f.col; g.lineWidth = f.w; g.beginPath(); g.moveTo(f.x1, f.y1); g.lineTo(f.x2, f.y2); g.stroke(); }
    else if (f.k === 'bolt') { g.globalAlpha = 1 - k; g.strokeStyle = f.col; g.lineWidth = 4; g.shadowColor = '#6fe3c1'; g.shadowBlur = 14; g.beginPath(); f.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.shadowBlur = 0; }
    g.globalAlpha = 1;
  }
  for (const m of B.marks) { g.globalAlpha = 1 - m.t / .8; g.strokeStyle = '#f2c14e'; g.lineWidth = 2; g.beginPath(); g.arc(m.x, m.y, 4 + m.t * 20, 0, 6.28); g.stroke(); g.globalAlpha = 1; }
  // targeting preview
  if (B.targeting && B.hoverPt) {
    const T = B.targeting, hp = B.hoverPt;
    g.strokeStyle = T.type === 'shine' ? '#f2c14e' : '#6fe3c1'; g.lineWidth = 2; g.setLineDash([8, 6]);
    g.beginPath(); g.arc(hp.x, hp.y, T.type === 'shine' ? 130 : 90, 0, 6.28); g.stroke();
    if (T.type === 'throw') { g.beginPath(); g.moveTo(T.unit.x, T.unit.y); g.lineTo(hp.x, hp.y); g.stroke(); }
    g.setLineDash([]);
  }
  if (B.drag && B.drag.active) {
    const d = B.drag; g.fillStyle = 'rgba(242,193,78,.09)'; g.strokeStyle = 'rgba(242,193,78,.9)'; g.lineWidth = 1.5;
    g.fillRect(Math.min(d.sx, d.x), Math.min(d.sy, d.y), Math.abs(d.x - d.sx), Math.abs(d.y - d.sy)); g.strokeRect(Math.min(d.sx, d.x), Math.min(d.sy, d.y), Math.abs(d.x - d.sx), Math.abs(d.y - d.sy));
  }
  if (B.paused) { g.fillStyle = 'rgba(8,12,18,.5)'; g.fillRect(0, 0, W, H); g.fillStyle = '#e9eef6'; g.font = '800 96px "Big Shoulders Display",Impact,sans-serif'; g.textAlign = 'center'; g.fillText('PAUSED', W / 2, H / 2); g.textAlign = 'left'; }
}
function statusDots(g, o, y) {
  const list = [];
  if (o.fdot && o.fdot.active) list.push('#ff9a5a');
  if (o.slug > 0 && !o.immuneSlug) list.push('#c99a45');
  if (o.dd) list.push('#3e9bff');
  if (o.dots && o.dots.length) list.push('#e5486a');
  if (o.paralyzed) list.push('#ffe066');
  if (o.isUnit && o.mod.drain) list.push('#6fe3c1');
  list.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(o.x - (list.length - 1) * 4 + i * 8, y, 3, 0, 6.28); g.fill(); });
}

/* ---------- title screen demo ---------- */
const DEMO = { units: [], shots: [], sparks: [], t: 0, spawn: 0, hp: 1, reset: 0 };
function demoStep(dt) {
  const d = DEMO; d.t += dt; d.spawn -= dt;
  const ids = Object.keys(UNITS);
  if (d.reset > 0) { d.reset -= dt; if (d.reset <= 0) { d.units = []; d.shots = []; d.hp = 1; } return stepSparks(d, dt); }
  if (d.spawn <= 0 && d.units.length < 24) {
    d.spawn = .7; const id = ids[Math.floor(Math.random() * ids.length)], c = UNITS[id];
    d.units.push({ id, x: -30, y: rnd(FIELD.y0 + 30, FIELD.y1 - 30), spd: c.stationary ? 90 : Math.max(60, c.spd * 1.2 + rnd(0, 25)), stop: rnd(700, WALL.x - 50), r: c.r * 1.3, role: c.role, cd: rnd(0, 1) });
  }
  for (const u of d.units) {
    if (u.x < u.stop) u.x += u.spd * dt;
    else { u.cd -= dt; if (u.cd <= 0) { u.cd = rnd(.8, 1.4); const c = UNITS[id2(u)]; d.shots.push({ x: u.x, y: u.y, vx: 520, el: c.el, melee: u.role === 'tank' }); } }
  }
  for (const s of d.shots) { s.x += s.vx * dt; if (s.x >= WALL.x) { s.dead = true; d.hp -= .0035; for (let i = 0; i < 3; i++) d.sparks.push({ x: WALL.x, y: s.y, vx: -rnd(40, 140), vy: rnd(-70, 70), t: 0, max: .4, c: EL[s.el].c }); } }
  d.shots = d.shots.filter(s => !s.dead);
  if (d.hp <= 0) { d.reset = 2.2; for (let i = 0; i < 70; i++) d.sparks.push({ x: WALL.x + rnd(0, WALL.w), y: rnd(WALL.y0, WALL.y1), vx: rnd(-200, 200), vy: rnd(-200, 200), t: 0, max: rnd(.5, 1.2), c: '#9aa3bd' }); }
  stepSparks(d, dt);
}
function id2(u) { return u.id; }
function stepSparks(d, dt) { for (const s of d.sparks) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; } d.sparks = d.sparks.filter(s => s.t < s.max); }
function renderDemo(g) {
  if (!BG) BG = makeBG();
  g.drawImage(BG, 0, 0);
  drawWall(g, { hp: Math.max(DEMO.hp, .02), maxHp: 1, flash: 0 }, false);
  for (const u of DEMO.units.slice().sort((a, b) => a.y - b.y)) drawSprite(g, [u.id], u.x, u.y, u.r * 1.05, { alpha: DEMO.reset > 0 ? .3 : 1 });
  for (const s of DEMO.shots) { g.fillStyle = EL[s.el].c; g.shadowColor = EL[s.el].c; g.shadowBlur = 10; g.beginPath(); g.arc(s.x, s.y, 4, 0, 6.28); g.fill(); g.shadowBlur = 0; }
  for (const s of DEMO.sparks) { g.globalAlpha = 1 - s.t / s.max; g.fillStyle = s.c; g.fillRect(s.x, s.y, 3, 3); }
  g.globalAlpha = 1;
}
