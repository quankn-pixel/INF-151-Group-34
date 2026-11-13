'use strict';
/* ===== Wallbreakers: screens, shop and input ===== */
const $ = s => document.querySelector(s);
let screen = 'title';
const gem = el => '<svg class="gem" viewBox="0 0 16 16" aria-hidden="true"><polygon points="8,1 14,6 8,15 2,6" fill="' + EL[el].c + '"/><polygon points="8,1 14,6 8,7 2,6" fill="#fff" fill-opacity=".38"/><polygon points="8,7 14,6 8,15" fill="#000" fill-opacity=".2"/></svg>';

/* ---------- save ---------- */
function newSave() { return { v: 1, crystals: { fire: 9999, water: 9999, earth: 9999, air: 9999 }, units: [], squads: [[], []], cleared: {}, next: 1 }; }
function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 1 && Array.isArray(s.units)) return s; } catch (e) { } return null; }
function migrate(s) {
  s.units.forEach(i => { if (!i.weight) i.weight = Math.round(i.comps.reduce((a, id) => a + UNITS[id].weight, 0) * (i.comps.length > 1 ? .85 : 1) * Math.pow(1.4, i.tier - 1)); });
  s.squads = s.squads.map(q => { let w = 0; return q.filter(id => { const u = s.units.find(x => x.uid === id); if (!u || w + u.weight > SQUAD_CAP) return false; w += u.weight; return true; }); });
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) { } }
const crysHTML = () => ELS.map(e => '<span title="' + EL[e].n + ' crystals">' + gem(e) + G.crystals[e] + '</span>').join('');

function show(name) {
  ['title', 'shop', 'stages', 'battle'].forEach(n => { $('#' + n).hidden = n !== name; });
  screen = name;
  if (name === 'shop') renderShop();
  if (name === 'stages') renderStages();
  if (name === 'battle') resizeCanvas();
}
function fillIcons(root) {
  root.querySelectorAll('.ico[data-c]').forEach(el => { el.innerHTML = ''; el.appendChild(spriteCanvas(el.dataset.c.split(','), 44)); });
}

/* ---------- title ---------- */
let eraseArm = 0;
function initTitle() {
  $('#btnContinue').hidden = !G;
  $('#btnContinue').onclick = () => show('shop');
  $('#btnNew').onclick = () => {
    if (G && !eraseArm) { eraseArm = 1; $('#btnNew').textContent = 'Erase save? Click again'; setTimeout(() => { eraseArm = 0; $('#btnNew').textContent = 'New game'; }, 3200); return; }
    G = newSave(); save(); eraseArm = 0; $('#btnNew').textContent = 'New game'; $('#btnContinue').hidden = false; show('shop');
  };
  $('#btnNew').textContent = G ? 'New game' : 'Begin siege';
}

/* ---------- shop ---------- */
let shopEl = 'fire', fuseSel = [], shopMsg = '';
function statsHTML(s, comps, w) {
  const cs = comps.map(id => UNITS[id]), parts = [['HP', s.hp]];
  if (s.atk > 0) parts.push([cs.some(c => c.kind === 'ram') ? 'RAM' : cs.some(c => c.kind === 'rod') ? 'BOLT' : 'ATK', s.atk]);
  parts.push(['DEF', s.def]);
  if (s.spd > 0) parts.push(['SPD', s.spd]);
  if (cs.some(c => ['melee', 'proj', 'flame', 'hound'].includes(c.kind))) parts.push(['RNG', s.range <= 20 ? 'melee' : s.range]);
  if (s.hits) parts.push(['HITS', s.hits]);
  cs.filter(c => c.heal).forEach(c => parts.push([c.heal.kind === 'shield' ? 'BARRIER' : 'HEAL', Math.round(c.heal.pow * s.healMul) + (c.heal.kind === 'aura' ? '/s' : '')]));
  if (w) parts.unshift(['WT', w]);
  return parts.map(p => p[0] + ' <b>' + (typeof p[1] === 'number' ? Math.round(p[1]) : p[1]) + '</b>').join(' ');
}
function sqOf(uid) { return G.squads[0].includes(uid) ? 0 : G.squads[1].includes(uid) ? 1 : -1; }
function renderShop() {
  $('#shopCrys').innerHTML = crysHTML();
  $('#elTabs').innerHTML = ELS.map(e => '<button class="tab" data-el="' + e + '" aria-pressed="' + (e === shopEl) + '">' + gem(e) + EL[e].n + '</button>').join('');
  $('#elAttr').style.borderLeftColor = EL[shopEl].c;
  $('#elAttr').innerHTML = '<b style="color:' + EL[shopEl].c + '">' + EL[shopEl].n + ' attribute.</b> ' + ATTR[shopEl];
  $('#cards').innerHTML = BY_EL[shopEl].map(c => {
    const afford = G.crystals[c.el] >= c.cost;
    return '<div class="card"><div class="top"><span class="ico" data-c="' + c.id + '"></span><div><div class="nm">' + c.name + '</div><div class="role">' + ROLES[c.role] + '</div></div></div><p>' + c.blurb + '</p><div class="stats">' + statsHTML(baseStats(c), [c.id], c.weight) + '</div><div class="buyrow"><span class="cost">' + gem(c.el) + c.cost + '</span><button class="btn primary sm" data-buy="' + c.id + '"' + (afford ? '' : ' disabled') + '>Buy</button></div></div>';
  }).join('');
  fillIcons($('#cards'));
  renderBarracks();
}
function rowHTML(i) {
  const s = sqOf(i.uid), fs = fuseSel.includes(i.uid);
  const els = instElements(i).map(gem).join(''), roles = instRoles(i).map(r => ROLES[r]).join(' / ');
  return '<div class="urow' + (fs ? ' fsel' : '') + '" data-uid="' + i.uid + '"><span class="ico" data-c="' + i.comps.join(',') + '"></span><div style="min-width:0"><div class="nm">' + i.name + (i.tier > 1 ? '<i>T' + i.tier + '</i>' : '') + '</div><div class="role" style="display:flex;gap:4px;align-items:center">' + els + '<span>' + roles + '</span></div><div class="stats">' + statsHTML(i.stats, i.comps, i.weight) + '</div></div><div class="uact">' +
    '<button class="btn sm' + (s === 0 ? ' on' : '') + '" data-act="sq" data-v="0" title="Squad 1 fights wave 1">Squad 1</button>' +
    '<button class="btn sm' + (s === 1 ? ' on' : '') + '" data-act="sq" data-v="1" title="Squad 2 fights wave 2">Squad 2</button>' +
    '<button class="btn sm' + (s === -1 ? ' on' : '') + '" data-act="sq" data-v="-1">Bench</button>' +
    '<button class="btn sm' + (fs ? ' on' : '') + '" data-act="fuse">Fuse</button>' +
    '<button class="btn sm ghost" data-act="sell" title="Refund 50%">Sell</button></div></div>';
}
const ATTR_SHORT = { fire: 'burn', water: 'defense shred', earth: 'sluggish', air: 'momentum' };
function fuseHTML() {
  const a = G.units.find(u => u.uid === fuseSel[0]), b = G.units.find(u => u.uid === fuseSel[1]);
  let body;
  if (!a) body = '<div class="empty">Press Fuse on two units. Two identical units upgrade a tier (x1.5 HP, x1.4 ATK, x1.3 DEF). Two different units merge into one that carries both elements. Fusions are free.</div>';
  else if (!b) body = '<div class="empty"><b>' + a.name + '</b> is selected. Pick a second unit.</div>';
  else {
    const r = fuseInsts(a, b, -1);
    if (r.error) body = '<div class="err">' + r.error + '</div><div class="row"><button class="btn sm ghost" data-act="clearfuse">Clear</button></div>';
    else {
      const i = r.inst, els = instElements(i);
      const note = i.kind === 'tier' ? 'Becomes tier ' + i.tier + '.' : 'Carries ' + els.map(e => EL[e].n + ' ' + ATTR_SHORT[e]).join(' and ') + '. Its elements affect other units, not itself. Roles: ' + instRoles(i).map(x => ROLES[x]).join(' + ') + '.';
      body = '<div class="urow"><span class="ico" data-c="' + i.comps.join(',') + '"></span><div style="min-width:0"><div class="nm">' + i.name + '</div><div class="stats">' + statsHTML(i.stats, i.comps, i.weight) + '</div><div class="muted" style="font-size:12px;margin-top:4px">' + note + '</div></div></div><div style="display:flex;gap:8px"><button class="btn primary sm" data-act="dofuse">Fuse now</button><button class="btn sm ghost" data-act="clearfuse">Clear</button></div>';
    }
  }
  return '<div class="fuse"><h3>Fusion</h3>' + body + '</div>';
}
function squadWeight(n) { return G.squads[n].reduce((s, id) => { const u = G.units.find(x => x.uid === id); return s + (u ? u.weight : 0); }, 0); }
function renderBarracks() {
  const by = id => G.units.find(u => u.uid === id);
  const sq = n => G.squads[n].map(by).filter(Boolean);
  const bench = G.units.filter(u => sqOf(u.uid) < 0);
  const sec = (title, sub, list, wt) => '<div class="sq"><header><h3>' + title + '</h3><span>' + sub + '</span></header>' +
    (wt === undefined ? '' : '<div class="wbar' + (wt >= SQUAD_CAP * .95 ? ' full' : '') + '"><i style="width:' + Math.min(100, wt / SQUAD_CAP * 100) + '%"></i></div>') +
    (list.length ? list.map(rowHTML).join('') : '<div class="empty">Empty.</div>') + '</div>';
  const msg = shopMsg ? '<div class="' + (shopMsg[0] === '!' ? 'err' : 'ok') + '">' + shopMsg.replace(/^!/, '') + '</div>' : '';
  const w0 = squadWeight(0), w1 = squadWeight(1);
  $('#barInner').innerHTML = fuseHTML() + msg +
    sec('Squad 1', 'Wave 1 \u00b7 weight ' + w0 + ' / ' + SQUAD_CAP + ' \u00b7 ' + G.squads[0].length + ' units', sq(0), w0) +
    sec('Squad 2', 'Wave 2 \u00b7 weight ' + w1 + ' / ' + SQUAD_CAP + ' \u00b7 ' + G.squads[1].length + ' units', sq(1), w1) +
    sec('Bench', bench.length + ' unit' + (bench.length === 1 ? '' : 's'), bench);
  fillIcons($('#barInner'));
}
function buyUnit(id) {
  const c = UNITS[id]; if (G.crystals[c.el] < c.cost) return;
  G.crystals[c.el] -= c.cost;
  const inst = mkInst(id, G.next++); G.units.push(inst);
  const sq = squadWeight(0) + inst.weight <= SQUAD_CAP ? 0 : squadWeight(1) + inst.weight <= SQUAD_CAP ? 1 : -1;
  if (sq >= 0) G.squads[sq].push(inst.uid);
  shopMsg = ''; save(); renderShop();
}
function initShop() {
  $('#elTabs').onclick = e => { const b = e.target.closest('[data-el]'); if (b) { shopEl = b.dataset.el; renderShop(); } };
  $('#cards').onclick = e => { const b = e.target.closest('[data-buy]'); if (b) buyUnit(b.dataset.buy); };
  $('#barInner').onclick = e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const row = b.closest('[data-uid]'), uid = row ? +row.dataset.uid : 0, act = b.dataset.act;
    if (act === 'sq') {
      const v = +b.dataset.v; G.squads = G.squads.map(s => s.filter(id => id !== uid));
      if (v >= 0) { const un = G.units.find(x => x.uid === uid); if (squadWeight(v) + un.weight > SQUAD_CAP) { shopMsg = '!Squad ' + (v + 1) + ' is at its weight limit (' + squadWeight(v) + ' / ' + SQUAD_CAP + '). ' + un.name + ' weighs ' + un.weight + '.'; renderShop(); return; } G.squads[v].push(uid); }
    } else if (act === 'fuse') {
      fuseSel = fuseSel.includes(uid) ? fuseSel.filter(x => x !== uid) : (fuseSel.length >= 2 ? [fuseSel[1], uid] : fuseSel.concat(uid));
    } else if (act === 'clearfuse') fuseSel = [];
    else if (act === 'dofuse') {
      const a = G.units.find(u => u.uid === fuseSel[0]), bb = G.units.find(u => u.uid === fuseSel[1]);
      const r = a && bb ? fuseInsts(a, bb, G.next) : null;
      if (r && r.inst) {
        G.next++; const s = sqOf(a.uid) >= 0 ? sqOf(a.uid) : sqOf(bb.uid);
        G.units = G.units.filter(u => u !== a && u !== bb); G.squads = G.squads.map(q => q.filter(id => id !== a.uid && id !== bb.uid));
        G.units.push(r.inst); if (s >= 0) G.squads[s].push(r.inst.uid);
        shopMsg = 'Created ' + r.inst.name + '.'; fuseSel = [];
      }
    } else if (act === 'sell') {
      const i = G.units.find(u => u.uid === uid); if (!i) return;
      const refund = instCost(i); for (const e in refund) G.crystals[e] += Math.floor(refund[e] * .5);
      G.units = G.units.filter(u => u !== i); G.squads = G.squads.map(q => q.filter(id => id !== uid)); fuseSel = fuseSel.filter(x => x !== uid);
      shopMsg = 'Sold ' + i.name + ' for half its cost.';
    }
    if (act !== 'fuse' && act !== 'sq' && act !== 'clearfuse' && act !== 'dofuse' && act !== 'sell') shopMsg = '';
    save(); renderShop();
  };
  $('#toStages').onclick = () => show('stages');
  $('#shopHome').onclick = () => { initTitle(); show('title'); };
  $('#linksList').innerHTML = LINKS.map(l => '<li><span class="lk">' + gem(l[0]) + EL[l[0]].n + ' → ' + gem(l[1]) + EL[l[1]].n + '</span>' + l[2] + '</li>').join('');
}

/* ---------- stages ---------- */
function waveSummary(w) {
  const c = {}; w.enemies.forEach(e => c[e[0]] = (c[e[0]] || 0) + 1);
  return Object.keys(c).map(k => c[k] + '× ' + ENEMY[k].name).join(', ');
}
function stageBlock(i) {
  const st = STAGES[i];
  if (!G.squads[0].length) return 'Put units in Squad 1';
  if (st.waves.length > 1 && !G.squads[1].length) return 'Put units in Squad 2';
  return '';
}
function renderStages() {
  $('#stCrys').innerHTML = crysHTML();
  $('#squadNote').innerHTML = '<span>Squad 1: ' + G.squads[0].length + ' units, weight ' + squadWeight(0) + ' / ' + SQUAD_CAP + ' (wall 1)</span><span>Squad 2: ' + G.squads[1].length + ' units, weight ' + squadWeight(1) + ' / ' + SQUAD_CAP + ' (wall 2)</span>';
  $('#stageGrid').innerHTML = STAGES.map((s, i) => {
    const blk = stageBlock(i), cl = G.cleared[i];
    const rew = ELS.map(e => '<span class="cost">' + gem(e) + Math.round(s.reward[e] * (cl ? .5 : 1)) + '</span>').join(' ');
    return '<div class="stage"><header><h3>' + s.name + '</h3><span class="badge' + (cl ? ' clr' : '') + '">' + (cl ? 'Cleared' : s.waves.length + (s.waves.length > 1 ? ' walls' : ' wall')) + '</span></header><div class="muted" style="font-size:13px">' + s.blurb + '</div><div class="wave">' +
      s.waves.map((w, k) => '<div><b>Wall ' + (k + 1) + '</b> · ' + w.wall.hp + ' HP, ' + w.wall.def + ' DEF</div><div>' + waveSummary(w) + '</div>').join('') + '</div><div class="crys" style="gap:10px">' + rew + '</div>' +
      '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn primary" data-stage="' + i + '"' + (blk ? ' disabled' : '') + '>Deploy</button>' + (blk ? '<span class="err">' + blk + '</span>' : '') + '</div></div>';
  }).join('');
}
function initStages() {
  $('#stageGrid').onclick = e => { const b = e.target.closest('[data-stage]'); if (b && !b.disabled) openBattle(+b.dataset.stage); };
  $('#backShop').onclick = () => show('shop');
}

/* ---------- battle HUD ---------- */
const cv = () => $('#cv');
let cg = null, sideSig = '', rosterT = 0;
function resizeCanvas() {
  const f = $('#field'), c = cv(); if (!f || !c) return;
  const fw = f.clientWidth, fh = f.clientHeight; if (fw < 10 || fh < 10) return;
  const sc = Math.min(fw / W, fh / H), cw = Math.floor(W * sc), ch = Math.floor(H * sc), d = Math.min(2, window.devicePixelRatio || 1);
  c.style.width = cw + 'px'; c.style.height = ch + 'px'; c.width = Math.round(cw * d); c.height = Math.round(ch * d);
  cg = c.getContext('2d');
}
function openBattle(si) {
  startBattle(si); B.onPhase = onPhase;
  $('#overlay').hidden = true; sideSig = ''; show('battle');
  $('#bStage').textContent = STAGES[si].name; setPauseUI(); $('#bAura').classList.add('on');
}
function setPauseUI() { $('#bPause').textContent = B && B.paused ? 'Resume' : 'Pause'; $('#bSpeed').textContent = (B ? B.speed : 1) + '×'; }
function onPhase(ph) {
  const ov = $('#overlay'); ov.hidden = false; let h = '';
  if (ph === 'wavewin') {
    h = '<div class="modal win"><h2>Wall breached</h2><p class="muted" style="margin:0">Squad 2 deploys against the next wall. Squad 1 holds the line behind you.</p><div class="row"><button class="btn primary" data-m="next">Deploy Squad 2</button></div></div>';
  } else if (ph === 'won') {
    const full = !G.cleared[B.si], rw = {};
    ELS.forEach(e => { rw[e] = Math.round(STAGES[B.si].reward[e] * (full ? 1 : .5)); G.crystals[e] += rw[e]; });
    G.cleared[B.si] = true; save();
    const nx = B.si + 1 < STAGES.length && !stageBlock(B.si + 1);
    h = '<div class="modal win"><h2>Wall down</h2><p class="muted" style="margin:0">' + STAGES[B.si].name + ' is yours. ' + (full ? 'First clear reward:' : 'Repeat reward (half):') + '</p><div class="crys">' + ELS.map(e => '<span>' + gem(e) + '+' + rw[e] + '</span>').join('') + '</div><div class="row">' + (nx ? '<button class="btn primary" data-m="nextstage">Next stage</button>' : '') + '<button class="btn" data-m="shop">Armory</button><button class="btn" data-m="stages">Stages</button><button class="btn ghost" data-m="retry">Replay</button></div></div>';
  } else if (ph === 'lost') {
    h = '<div class="modal lose"><h2>Squad lost</h2><p class="muted" style="margin:0">No units left on the field. Adjust your squads or tactics and try again.</p><div class="row"><button class="btn primary" data-m="retry">Retry</button><button class="btn" data-m="shop">Armory</button><button class="btn" data-m="stages">Stages</button></div></div>';
  }
  ov.innerHTML = h;
}
function initBattle() {
  $('#overlay').onclick = e => {
    const b = e.target.closest('[data-m]'); if (!b) return; const m = b.dataset.m;
    if (m === 'next') { loadWave(B.wave + 1); $('#overlay').hidden = true; sideSig = ''; }
    else if (m === 'retry') openBattle(B.si);
    else if (m === 'nextstage') openBattle(B.si + 1);
    else if (m === 'shop') { B = null; show('shop'); } else if (m === 'stages') { B = null; show('stages'); }
  };
  $('#bRetreat').onclick = () => { B = null; show('stages'); };
  $('#bPause').onclick = () => { if (B && B.phase === 'fight') { B.paused = !B.paused; setPauseUI(); } };
  $('#bSpeed').onclick = () => { if (B) { B.speed = B.speed === 1 ? 2 : 1; setPauseUI(); } };
  $('#side').onclick = e => {
    const b = e.target.closest('[data-act]'); if (!b || !B) return; const a = b.dataset.act;
    if (a === 'start') { beginFight(); sideSig = ''; }
    else if (a === 'cancel') { B.sel = []; B.targeting = null; }
    else if (a === 'shine' || a === 'throw') { const u = B.sel.find(x => x.ak === (a === 'shine' ? 'crab' : 'rod') && !x.abilityUsed && !x.dead); if (u) B.targeting = { type: a, unit: u }; }
  };
  $('#roster').addEventListener('pointerdown', e => {
    const c = e.target.closest('[data-u]'); if (!c || !B) return; const u = B.units.find(x => x.uid === +c.dataset.u); if (!u || u.dead) return;
    B.targeting = null;
    if (e.shiftKey) B.sel = B.sel.includes(u) ? B.sel.filter(x => x !== u) : B.sel.concat(u); else B.sel = [u];
  });
  $('#selAll').onclick = selectAll;
  $('#bAura').onclick = toggleAura;
  window.addEventListener('resize', resizeCanvas);
  if (window.ResizeObserver) new ResizeObserver(resizeCanvas).observe($('#field'));
  initPointer();
}
function toggleAura() { if (B) { B.showAura = B.showAura === false; $('#bAura').classList.toggle('on', B.showAura !== false); } }
function selectAll() { if (B) { B.targeting = null; B.sel = B.units.filter(u => !u.dead && !u.spent); } }
function renderSide() {
  const el = $('#side');
  if (!B) return;
  if (B.phase === 'deploy') {
    const foes = {}; B.enemies.forEach(e => foes[e.type] = (foes[e.type] || 0) + 1);
    el.innerHTML = '<button class="btn primary" data-act="start"' + (B.units.length ? '' : ' disabled') + '>Start battle</button><p class="hint"><b>Deploy.</b> Select units and click to place them in the gold zone. Flamethrowers can go further forward.</p><div class="foes">' +
      Object.keys(foes).map(k => '<span class="foe" title="' + ENEMY[k].note + '">' + foes[k] + '× ' + ENEMY[k].name + '</span>').join('') + '</div>';
    return;
  }
  const abil = [];
  const crab = B.sel.find(u => u.ak === 'crab' && !u.abilityUsed && !u.dead), rod = B.sel.find(u => u.ak === 'rod' && !u.abilityUsed && !u.dead);
  if (crab) abil.push('<button class="btn sm' + (B.targeting && B.targeting.type === 'shine' ? ' on' : '') + '" data-act="shine">Shine region (once)</button>');
  if (rod) abil.push('<button class="btn sm' + (B.targeting && B.targeting.type === 'throw' ? ' on' : '') + '" data-act="throw">Throw rod (once)</button>');
  let hint;
  if (B.targeting) hint = '<b>Click the battlefield</b> to use it. Right-click cancels.';
  else if (B.sel.length) hint = '<b>Click ground</b> to move. <b>Click an enemy</b> to focus (ranged units; melee head for the wall beside it). <b>Click the wall</b> to attack that section. <b>Right-click</b> cancels.';
  else hint = 'Click a unit or <b>drag</b> to select. <b>A</b> selects all. <b>Space</b> pauses.';
  el.innerHTML = (abil.length || B.sel.length ? '<div style="display:flex;gap:6px;flex-wrap:wrap">' + abil.join('') + (B.sel.length ? '<button class="btn sm ghost" data-act="cancel">Cancel selection</button>' : '') + '</div>' : '') + '<p class="hint">' + hint + '</p>' + (B.boss && !B.boss.dead ? '<p class="hint" style="color:var(--brass)">The wall cannot fall while the Warlord lives.</p>' : '');
}
function hudTick(dt) {
  if (!B) return;
  const w = B.wall, ratio = Math.max(0, w.hp / w.maxHp);
  $('#wallFill').style.width = (ratio * 100).toFixed(1) + '%';
  const sh = B.boss && !B.boss.dead && w.hp <= 1;
  $('#wallBar').classList.toggle('shielded', !!sh);
  $('#wallTxt').textContent = (sh ? 'SHIELDED BY WARLORD · ' : 'WALL ') + Math.ceil(w.hp) + ' / ' + w.maxHp;
  $('#bWave').textContent = 'Wall ' + (B.wave + 1) + ' of ' + B.stage.waves.length + ' · ' + (B.phase === 'deploy' ? 'deploying' : B.phase === 'fight' ? 'fighting' : B.phase);
  const sig = B.phase + '|' + (B.targeting ? B.targeting.type : '') + '|' + B.sel.map(u => u.uid + (u.abilityUsed ? 'u' : '')).join(',') + '|' + (B.units.length ? 1 : 0) + (B.boss && !B.boss.dead ? 'b' : '');
  if (sig !== sideSig) { sideSig = sig; renderSide(); }
  rosterT -= dt;
  if (rosterT <= 0) {
    rosterT = .25;
    $('#roster').innerHTML = B.units.filter(u => !u.dead).map(u => {
      const r = u.hp / u.maxHp;
      return '<div class="chip' + (B.sel.includes(u) ? ' sel' : '') + (r < .3 ? ' low' : '') + '" data-u="' + u.uid + '" style="border-left-color:' + EL[u.els[0]].c + '"><span class="n">' + u.name + '</span><span class="b"><i style="width:' + Math.max(0, r * 100) + '%"></i></span></div>';
    }).join('');
  }
}

/* ---------- pointer input ---------- */
function toWorld(e) { const r = cv().getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
function unitAt(p) { let b = null, bd = 1e9; for (const u of B.units) { if (u.dead) continue; const d = dist(u, p); if (d <= u.r + 6 && d < bd) { bd = d; b = u; } } return b; }
function enemyAt(p) { let b = null, bd = 1e9; for (const e of B.enemies) { if (e.dead) continue; const d = dist(e, p); if (d <= e.r + 8 && d < bd) { bd = d; b = e; } } return b; }
function wallAt(p) { return !B.wall.dead && p.x >= WALL.x - 6 && p.x <= WALL.x + WALL.w + 6 && p.y >= WALL.y0 && p.y <= WALL.y1; }
function cancelSel() { if (!B) return; B.sel = []; B.targeting = null; B.drag = null; }
function leftClick(p, shift) {
  if (B.phase !== 'fight' && B.phase !== 'deploy') return;
  if (B.targeting) { if (B.phase === 'fight') useAbility(p); return; }
  const u = unitAt(p);
  if (u) { B.sel = shift ? (B.sel.includes(u) ? B.sel.filter(x => x !== u) : B.sel.concat(u)) : [u]; return; }
  if (!B.sel.length) return;
  const en = enemyAt(p), wl = wallAt(p);
  if (B.phase === 'deploy') { if (en || wl) return; orderMove(B.sel, p); return; }
  if (en) orderAttack(B.sel, en); else if (wl) orderWall(B.sel, p); else orderMove(B.sel, p);
}
function initPointer() {
  const c = cv();
  c.addEventListener('contextmenu', e => { e.preventDefault(); cancelSel(); });
  c.addEventListener('pointerdown', e => {
    if (!B) return;
    if (e.button === 2) { e.preventDefault(); cancelSel(); return; }
    if (e.button !== 0) return;
    const p = toWorld(e); B.drag = { sx: p.x, sy: p.y, x: p.x, y: p.y, active: false, shift: e.shiftKey };
    try { c.setPointerCapture(e.pointerId); } catch (x) { }
  });
  c.addEventListener('pointermove', e => {
    if (!B) return;
    const p = toWorld(e); B.hoverPt = p;
    if (B.drag) { B.drag.x = p.x; B.drag.y = p.y; if (!B.drag.active && Math.hypot(p.x - B.drag.sx, p.y - B.drag.sy) > 10) B.drag.active = true; }
    B.hover = enemyAt(p) || (wallAt(p) ? B.wall : null);
    c.style.cursor = B.targeting ? 'crosshair' : (B.sel.length && B.hover && B.phase === 'fight') ? 'crosshair' : unitAt(p) ? 'pointer' : 'default';
  });
  c.addEventListener('pointerup', e => {
    if (!B || e.button !== 0 || !B.drag) return;
    const d = B.drag; B.drag = null;
    if (B.phase !== 'fight' && B.phase !== 'deploy') return;
    if (d.active && !B.targeting) {
      const x0 = Math.min(d.sx, d.x), x1 = Math.max(d.sx, d.x), y0 = Math.min(d.sy, d.y), y1 = Math.max(d.sy, d.y);
      const inside = B.units.filter(u => !u.dead && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1);
      B.sel = d.shift ? B.sel.concat(inside.filter(u => !B.sel.includes(u))) : inside;
    } else if (!d.active) leftClick({ x: d.sx, y: d.sy }, d.shift);
  });
  c.addEventListener('pointerleave', () => { if (B) { B.hover = null; B.hoverPt = null; } });
  window.addEventListener('keydown', e => {
    if (screen !== 'battle' || !B) return;
    if (e.code === 'Space') { e.preventDefault(); if (B.phase === 'fight') { B.paused = !B.paused; setPauseUI(); } }
    else if (e.key === 'Escape') cancelSel();
    else if (e.key === 'a' || e.key === 'A') selectAll();
    else if (e.key === 'r' || e.key === 'R') toggleAura();
  });
}

/* ---------- main loop ---------- */
let lastTs = 0;
function frame(ts) {
  const dt = Math.min(.05, (ts - lastTs) / 1000 || 0); lastTs = ts;
  if (screen === 'battle' && B && cg) {
    step(dt);
    cg.setTransform(cv().width / W, 0, 0, cv().height / H, 0, 0);
    cg.clearRect(0, 0, W, H);
    renderBattle(cg);
    hudTick(dt);
  } else if (screen === 'title') {
    demoStep(dt); renderDemo(DEMO.g);
  }
  requestAnimationFrame(frame);
}
function boot() {
  G = loadSave(); if (G) migrate(G);
  DEMO.g = $('#demo').getContext('2d');
  $('#gemsRow').innerHTML = ELS.map(gem).join('');
  initTitle(); initShop(); initStages(); initBattle();
  show('title');
  requestAnimationFrame(frame);
  window.__wb = { get G() { return G; }, get B() { return B; }, set G(v) { G = v; }, step, startBattle, loadWave, beginFight, makeUnit, openBattle, show, fuseInsts, mkInst, orderMove, orderAttack, orderWall, hit, recomputeAuras, onPhase, buyUnit, UNITS, STAGES };
}
document.addEventListener('DOMContentLoaded', boot);
