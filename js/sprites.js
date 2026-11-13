'use strict';
/* ===== Wallbreakers: procedural art ===== */
const INK = '#0b1018';
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
}
function poly(g, s, pts, close) {
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0] * s, p[1] * s) : g.moveTo(p[0] * s, p[1] * s));
  if (close) g.closePath(); g.stroke();
}
function circ(g, s, x, y, r, fill) { g.beginPath(); g.arc(x * s, y * s, r * s, 0, 6.2832); fill ? g.fill() : g.stroke(); }
function shapePts(id, role, r) {
  const P = [];
  const ngon = (n, rad, rot) => { for (let i = 0; i < n; i++) { const a = rot + i * 6.28318 / n; P.push([Math.cos(a) * rad, Math.sin(a) * rad]); } };
  if (id === 'fire_flame') ngon(5, r * 1.1, -1.5708);
  else if (id === 'fire_hound') P.push([r * 1.25, 0], [0, -r * .72], [-r * .95, 0], [0, r * .72]);
  else if (id === 'water_crab') ngon(8, r * 1.08, .3927);
  else if (id === 'earth_ram') P.push([r * 1.25, 0], [r * .2, -r], [-r, -r * .8], [-r * .5, 0], [-r, r * .8], [r * .2, r]);
  else if (id === 'air_rod') { for (let i = 0; i < 8; i++) { const a = i * .7854 - 1.5708, rad = i % 2 ? r * .5 : r * 1.2; P.push([Math.cos(a) * rad, Math.sin(a) * rad]); } }
  else if (role === 'tank') ngon(6, r * 1.08, 0);
  else if (role === 'dps') P.push([r * 1.2, 0], [-r * .85, -r * .95], [-r * .85, r * .95]);
  return P;
}
function bodyPath(g, id, role, r) {
  g.beginPath();
  if (role === 'heal') g.arc(0, 0, r, 0, 6.2832);
  else { shapePts(id, role, r).forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); }
}
/* solid shape per unit, filled with its element colour(s). comps: unit ids. opts: {alpha, flash} */
function drawSprite(g, comps, x, y, r, opts) {
  opts = opts || {};
  const cs = comps.map(id => UNITS[id]), A = cs[0], Bc = cs[1];
  const ca = EL[A.el].c, cb = Bc ? EL[Bc.el].c : ca;
  g.save(); g.translate(x, y); g.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
  bodyPath(g, A.id, A.role, r);
  if (cb !== ca) { const f = g.createLinearGradient(-r, 0, r, 0); f.addColorStop(0, ca); f.addColorStop(.5, ca); f.addColorStop(.5, cb); f.addColorStop(1, cb); g.fillStyle = f; }
  else g.fillStyle = ca;
  g.fill();
  g.lineWidth = Math.max(1.5, r * .11); g.lineJoin = 'round'; g.strokeStyle = opts.flash ? '#ffffff' : mixHex(ca, '#000000', .55); g.stroke();
  g.restore();
}
function spriteCanvas(comps, size) {
  const c = document.createElement('canvas'), d = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = Math.round(size * d); c.style.width = c.style.height = size + 'px';
  const g = c.getContext('2d'); g.scale(d, d);
  drawSprite(g, comps, size / 2, size / 2, size * .36);
  return c;
}

/* ---- enemies ---- */
const EN_BODY = '#3c4357', EN_EDGE = '#e5486a';
function drawEnemy(g, e, t) {
  g.save(); g.translate(e.x, e.y);
  const r = e.r, flash = e.flash > 0;
  g.lineWidth = 2; g.strokeStyle = flash ? '#fff' : EN_EDGE; g.fillStyle = flash ? '#7a8196' : EN_BODY; g.lineJoin = 'round'; g.lineCap = 'round';
  const aim = e.aim || Math.PI;
  if (e.type === 'archer') {
    g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill(); g.stroke();
    g.save(); g.rotate(aim); g.beginPath(); g.arc(r * .2, 0, r * 1.05, -1.1, 1.1); g.stroke(); g.restore();
  } else if (e.type === 'ballista') {
    g.beginPath(); g.rect(-r, -r * .8, r * 2, r * 1.6); g.fill(); g.stroke();
    g.save(); g.rotate(aim); g.strokeStyle = '#d9dde8'; g.lineWidth = 3; g.beginPath(); g.moveTo(-r * .2, 0); g.lineTo(r * 1.3, 0); g.stroke();
    g.strokeStyle = EN_EDGE; g.beginPath(); g.moveTo(r * .2, -r * 1.1); g.lineTo(-r * .2, 0); g.lineTo(r * .2, r * 1.1); g.stroke(); g.restore();
  } else if (e.type === 'cannon') {
    g.save(); g.rotate(aim); g.beginPath(); g.rect(0, -r * .38, r * 1.5, r * .76); g.fill(); g.stroke(); g.restore();
    g.beginPath(); g.arc(0, 0, r * .85, 0, 6.2832); g.fill(); g.stroke();
    g.fillStyle = EN_EDGE; g.beginPath(); g.arc(0, 0, r * .25, 0, 6.2832); g.fill();
  } else if (e.type === 'catapult') {
    g.beginPath(); g.rect(-r, -r * .85, r * 2, r * 1.7); g.fill(); g.stroke();
    g.save(); g.rotate(aim + (e.cd < .5 ? -.6 : 0)); g.strokeStyle = '#d9dde8'; g.lineWidth = 4; g.beginPath(); g.moveTo(-r * .2, 0); g.lineTo(r * 1.4, 0); g.stroke();
    g.fillStyle = EN_EDGE; g.beginPath(); g.arc(r * 1.4, 0, 6, 0, 6.2832); g.fill(); g.restore();
  } else if (e.type === 'boss') {
    g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * 1.0472 + .5236; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#f2c14e'; g.beginPath(); g.moveTo(-r * .5, -r * .15); g.lineTo(-r * .5, -r * .7); g.lineTo(-r * .2, -r * .4); g.lineTo(0, -r * .8); g.lineTo(r * .2, -r * .4); g.lineTo(r * .5, -r * .7); g.lineTo(r * .5, -r * .15); g.closePath(); g.fill();
    g.fillStyle = EN_EDGE; g.beginPath(); g.arc(-r * .22, r * .12, 4, 0, 6.2832); g.arc(r * .22, r * .12, 4, 0, 6.2832); g.fill();
  }
  g.restore();
}
function drawWall(g, wall, boss) {
  const x = WALL.x, y = WALL.y0, w = WALL.w, h = WALL.y1 - WALL.y0;
  g.save();
  g.fillStyle = '#2b3245'; g.fillRect(x, y, w, h);
  g.strokeStyle = '#4b556e'; g.lineWidth = 2;
  const bh = 36;
  for (let i = 0; i * bh < h; i++) {
    const yy = y + i * bh; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke();
    const off = (i % 2) ? w * .5 : w * .25; g.beginPath(); g.moveTo(x + off, yy); g.lineTo(x + off, Math.min(yy + bh, y + h)); g.stroke();
  }
  const dmg = 1 - wall.hp / wall.maxHp;
  g.strokeStyle = '#0b1018'; g.lineWidth = 2.5;
  const cr = [[.3, .1], [.65, .22], [.2, .38], [.7, .5], [.35, .66], [.6, .8], [.25, .9]];
  cr.forEach((c, i) => { if (dmg > i / cr.length * .9) { const cy = y + h * c[1], cx = x + w * c[0]; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 9, cy + 14); g.lineTo(cx - 5, cy + 26); g.stroke(); } });
  g.fillStyle = '#4b556e'; for (let i = 0; i * 40 < h - 20; i++) g.fillRect(x - 6, y + i * 40 + 6, 8, 18);
  g.strokeStyle = wall.flash > 0 ? '#fff' : EN_EDGE; g.lineWidth = 3; g.strokeRect(x, y, w, h);
  if (boss) { g.fillStyle = 'rgba(242,193,78,.16)'; g.fillRect(x, y, w, h); }
  g.restore();
}
