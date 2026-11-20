/* endgame.js - what comes after layer 2. Once the last map is cleared the player is given a star core and must choose, for good:
 *   Conquest: forge a weapon from the core and invade star systems on a map of the galaxy. Every conquered system automates
 *             one element for you; conquering enough of them starts the ending.
 *   Your own star: build a new star from the core and defend it from invaders. The star makes energy for turrets; raising it
 *             to its last stage starts the ending.
 * Both live in a full-screen overlay (#eg). Load after minigames.js and before ui.js. */
FE.module(function (FE) {
  const $ = FE.$, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const hs = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };

  const blank = () => ({ got: false, path: null, ended: false, weapon: 0, conq: {}, forge: { level: 1, energy: 0, hp: 150, wave: 0, turrets: [0, 0, 0, 0, 0, 0, 0, 0] } });
  const oldFresh = FE.freshState;
  FE.freshState = () => Object.assign(oldFresh(), { core: blank() });
  if (!FE.state.core) FE.state.core = blank();
  const C = () => FE.state.core;

  // ---------------- data ----------------
  const NEED = 8, WEAPON_MAX = 6, LEVEL_MAX = 5;
  const SYS = [
    { name: 'Dead Sol', x: .07, y: .5, links: [1, 2, 3], home: true },
    { name: 'Ember Reach', x: .2, y: .28, links: [0, 3], el: 'fire' },
    { name: 'Tide Haven', x: .2, y: .72, links: [0, 3], el: 'water' },
    { name: 'Gale Ring', x: .34, y: .5, links: [0, 1, 2, 4, 5], el: 'air' },
    { name: 'Stone Cradle', x: .46, y: .24, links: [3, 6], el: 'earth' },
    { name: 'Mist Verge', x: .46, y: .76, links: [3, 6], el: 'water' },
    { name: 'Cinder Crown', x: .58, y: .5, links: [4, 5, 7, 8], el: 'fire' },
    { name: 'Whisper Deep', x: .7, y: .27, links: [6, 9], el: 'air' },
    { name: 'Granite Veil', x: .7, y: .73, links: [6, 9], el: 'earth' },
    { name: 'Solar Throne', x: .82, y: .5, links: [7, 8, 10, 11], el: 'fire' },
    { name: 'Event Verge', x: .93, y: .3, links: [9], el: 'air' },
    { name: 'Last Lantern', x: .93, y: .7, links: [9], el: 'water' }
  ];
  SYS.forEach((s, i) => { if (!s.home) { s.def = Math.round(25 * Math.pow(1.55, i - 1)); s.yield = Math.round(40 * Math.pow(2.4, i - 1)); } });
  const owned = i => i === 0 || !!C().conq[i];
  const nConq = () => Object.keys(C().conq).filter(k => C().conq[k]).length;
  const power = () => FE.UNITS.reduce((n, u) => { const st = FE.unitStats(u.id); return n + FE.state.units[u.id] * (st.hp + st.atk); }, 0) * (1 + .25 * C().weapon);
  const weaponCost = () => Math.round(20 * Math.pow(2, C().weapon));
  const levelCost = () => Math.round(150 * Math.pow(3.2, C().forge.level - 1));
  const energyRate = () => 4 * C().forge.level * C().forge.level;
  const maxHp = () => 100 + 50 * C().forge.level;
  const starR = () => 18 + 8 * C().forge.level;
  const turretCost = lv => lv === 0 ? 40 : 60 * lv * lv;

  // ---------------- dom ----------------
  const css = document.createElement('style');
  css.textContent = `#eg{position:fixed;inset:0;z-index:70;background:#02030a;color:#e9eefc;display:flex;flex-direction:column;font-family:"Times New Roman",Times,serif}
#eg[hidden]{display:none}.eg-top{display:flex;align-items:center;gap:18px;padding:12px 20px;border-bottom:1px solid rgba(170,190,255,.2)}
.eg-top b{font-size:1.5em;font-weight:normal;letter-spacing:.08em}.eg-top span{margin-left:auto;color:#aab4d8;font-variant-numeric:tabular-nums}
.eg-main{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 310px}#eg-cv{width:100%;height:100%;display:block;cursor:pointer}
#eg-side{padding:16px 18px;border-left:1px solid rgba(170,190,255,.2);overflow:auto;line-height:1.45;font-size:.95em}#eg-side h4{margin:0 0 6px;font-weight:normal;font-size:1.3em}
#eg-side .dim{color:#8d9bc4}#eg-side p{margin:6px 0}
#eg button,#sc-btn{font:inherit;color:#e9eefc;background:rgba(255,255,255,.05);border:1px solid rgba(190,205,255,.55);border-radius:6px;padding:5px 14px;cursor:pointer;margin:4px 6px 4px 0}
#eg button:hover:not(:disabled),#sc-btn:hover{background:rgba(190,205,255,.18)}#eg button:disabled{color:#6c7799;border-color:rgba(190,205,255,.2);cursor:default}
#sc-btn{position:fixed;top:10px;right:14px;z-index:31;box-shadow:0 0 16px -4px #ffd36b;border-color:#ffd36b;color:#ffe6a8}#sc-btn[hidden]{display:none}
#eg-end{position:fixed;inset:0;z-index:90;background:#02030a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;font-family:"Times New Roman",serif;padding:30px}
#eg-end p{margin:0;font-size:1.7em;letter-spacing:.04em;opacity:0;transition:opacity 2s ease;text-shadow:0 0 22px rgba(190,205,255,.6)}#eg-end p.on{opacity:1}
#eg-end button{font:inherit;color:#fff;background:none;border:1px solid #fff;border-radius:6px;padding:8px 22px;cursor:pointer;opacity:0;transition:opacity 2s ease}#eg-end button.on{opacity:1}`;
  document.head.appendChild(css);
  const eg = document.createElement('div'); eg.id = 'eg'; eg.hidden = true;
  eg.innerHTML = '<div class="eg-top"><b id="eg-title"></b><span id="eg-res"></span><button type="button" id="eg-back">Back to the layers</button></div><div class="eg-main"><canvas id="eg-cv"></canvas><div id="eg-side"></div></div>';
  document.body.appendChild(eg);
  const cvs = $('eg-cv'), ctx = cvs.getContext('2d'), side = $('eg-side');
  const scBtn = document.createElement('button'); scBtn.id = 'sc-btn'; scBtn.type = 'button'; scBtn.hidden = true; document.body.appendChild(scBtn);

  let sel = -1, raf = 0, last = 0, sideSig = '', W = 0, H = 0, T = 0;
  let en = [], shots = [], cds = [0, 0, 0, 0, 0, 0, 0, 0], wt = 8, asked = false;

  function open() { if (!C().path) return; eg.hidden = false; FE.modalOpen = true; en = []; shots = []; wt = 8; sideSig = ''; fit(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  function close() { eg.hidden = true; FE.modalOpen = false; cancelAnimationFrame(raf); FE.save(); FE.render(); }
  $('eg-back').addEventListener('click', close);
  function fit() { W = cvs.width = cvs.clientWidth; H = cvs.height = cvs.clientHeight; }
  addEventListener('resize', () => { if (!eg.hidden) fit(); });

  // ---------------- the choice ----------------
  function choose(path) {
    C().path = path; FE.save(); FE.closePanel();
    FE.toast(path === 'conquest' ? 'The star core becomes a weapon. The galaxy awaits.' : 'The star core is planted. A new star begins to burn.', 5200);
    open();
  }
  function showChoice() {
    asked = true;
    FE.openPanel({
      kind: 'core', noBackdrop: true, sig: () => 'core' + C().path,
      build(box) {
        box.appendChild(FE.h('h3', '', 'The Star Core'));
        box.appendChild(FE.h('p', '', 'The surface is yours again. In the ruins you find a star core, still warm. It can be used once, and you must choose how.'));
        if (C().path) { box.appendChild(FE.h('p', 'dim', 'Your choice is made.')); box.appendChild(FE.h('div', 'btns')).appendChild(FE.panelButton('Close', FE.closePanel)); return; }
        const a = FE.h('div', 'qcard', '<div class="q-task">Forge a weapon and invade</div><div class="q-line">Take the core to the stars. Invade other star systems and conquer them; each one feeds you an element on its own. Conquer ' + NEED + ' and the war is won.</div>');
        a.appendChild(FE.panelButton('Take up the weapon', () => choose('conquest')));
        const b = FE.h('div', 'qcard', '<div class="q-task">Build your own star</div><div class="q-line">Your star is dead, so light a new one. Defend it from invaders; it makes the energy that builds your defences. Raise it to its last stage and the world is saved.</div>');
        b.appendChild(FE.panelButton('Light a new star', () => choose('forge')));
        box.appendChild(a); box.appendChild(b);
        box.appendChild(FE.h('p', 'dim', 'This choice is permanent.'));
      }
    });
  }
  scBtn.addEventListener('click', () => { if (C().path) open(); else showChoice(); });

  // ---------------- the ending ----------------
  function ending() {
    if (C().ended) return; C().ended = true; FE.save();
    const lines = C().path === 'conquest'
      ? ['The last lantern is lit.', 'Eight stars now answer to you, and the cold has nowhere left to hide.', 'The world is not saved by one fire, but by many.', 'The end.']
      : ['Your star burns, steady and bright.', 'The forest wakes under a new sky.', 'The cold recedes, and the world remembers warmth.', 'The end.'];
    const d = document.createElement('div'); d.id = 'eg-end';
    lines.forEach((t, i) => { const p = document.createElement('p'); p.textContent = t; d.appendChild(p); setTimeout(() => p.classList.add('on'), 600 + i * 2800); });
    const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Keep playing'; d.appendChild(b);
    setTimeout(() => b.classList.add('on'), 600 + lines.length * 2800);
    b.addEventListener('click', () => d.remove());
    document.body.appendChild(d);
  }

  // ---------------- conquest ----------------
  function invade(i) {
    const s = SYS[i];
    if (!s || owned(i) || !s.links.some(owned) || power() < s.def) return;
    FE.UNITS.forEach(u => { const n = FE.state.units[u.id]; FE.state.units[u.id] = n - Math.ceil(n * .2); });
    C().conq[i] = true;
    FE.toast(`${s.name} conquered. It now makes ${FE.fmt(s.yield)} ${s.el}/s for you. You lost a fifth of your army.`, 5200);
    FE.save(); FE.render();
    if (nConq() >= NEED) setTimeout(ending, 1200);
  }
  const nodePos = s => [s.x * W, s.y * H];
  function drawGalaxy() {
    const c = ctx; c.clearRect(0, 0, W, H); c.fillStyle = '#02030a'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(255,255,255,${.15 + .5 * hs(i, 3) * (.6 + .4 * Math.sin(T + i))})`; c.fillRect(hs(i, 1) * W, hs(i, 2) * H, 1.4, 1.4); }
    SYS.forEach((s, i) => s.links.forEach(j => { if (j < i) return; const [x1, y1] = nodePos(s), [x2, y2] = nodePos(SYS[j]), live = owned(i) && owned(j);
      c.strokeStyle = live ? 'rgba(255,230,160,.7)' : 'rgba(170,190,255,.2)'; c.lineWidth = live ? 2 : 1; c.setLineDash(live ? [] : [4, 6]); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }));
    c.setLineDash([]);
    SYS.forEach((s, i) => {
      const [x, y] = nodePos(s), col = s.home ? '#8d98bf' : FE.PAL[s.el].glow, mine = owned(i), reach = !mine && s.links.some(owned), r = s.home ? 16 : 11 + i * .5;
      if (mine && !s.home) { const g = c.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, rgba(col, .6)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(x - r * 4, y - r * 4, r * 8, r * 8); }
      c.fillStyle = mine ? col : reach ? rgba(col, .45) : rgba(col, .15); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.strokeStyle = i === sel ? '#fff' : reach ? rgba(col, .9) : rgba(col, .3); c.lineWidth = i === sel ? 3 : 1.5; c.beginPath(); c.arc(x, y, r + 4, 0, TAU); c.stroke();
      if (s.home) { c.strokeStyle = '#0a0d1a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 6, y - 8); c.lineTo(x + 1, y); c.lineTo(x - 3, y + 8); c.stroke(); }
      c.fillStyle = mine || reach ? '#e9eefc' : '#6c7799'; c.font = '14px "Times New Roman",serif'; c.textAlign = 'center'; c.fillText(s.name, x, y + r + 22);
    });
  }
  function sideConquest() {
    const k = nConq(), p = Math.floor(power()), s = SYS[sel];
    let h = `<h4>Conquest</h4><p>Systems conquered: <b>${k} / ${NEED}</b></p><p>Army power: <b>${FE.fmt(p)}</b> <span class="dim">(health + attack of every unit, ×${(1 + .25 * C().weapon).toFixed(2)} from the weapon)</span></p>`;
    h += `<p>Core weapon level ${C().weapon} / ${WEAPON_MAX}</p><button type="button" data-act="weapon" ${C().weapon >= WEAPON_MAX || FE.state.stardust < weaponCost() ? 'disabled' : ''}>${C().weapon >= WEAPON_MAX ? 'Fully charged' : `Charge the core: ${FE.fmt(weaponCost())} stardust`}</button>`;
    if (s) {
      const mine = owned(sel), reach = s.links.some(owned);
      h += `<hr><h4>${s.name}</h4>`;
      if (s.home) h += '<p class="dim">Your dead star. Everything starts here.</p>';
      else {
        h += `<p>Element: ${s.el}<br>Defence: ${FE.fmt(s.def)}<br>Yield once conquered: ${FE.fmt(s.yield)} ${s.el}/s</p>`;
        if (mine) h += '<p class="dim">Conquered. It is feeding you.</p>';
        else if (!reach) h += '<p class="dim">Out of reach. Conquer a linked system first.</p>';
        else h += `<button type="button" data-act="invade" ${p < s.def ? 'disabled' : ''}>${p < s.def ? 'Army too weak' : 'Invade (lose a fifth of your army)'}</button>`;
      }
    } else h += '<p class="dim">Click a system. You can invade only those linked to a system you hold.</p>';
    return h;
  }
  function conquestClick(x, y) {
    sel = -1;
    SYS.forEach((s, i) => { const [nx, ny] = nodePos(s); if (Math.hypot(x - nx, y - ny) < 26) sel = i; });
  }

  // ---------------- your own star ----------------
  function forgeStep(dt) {
    const F = C().forge, cx = W / 2, cy = H / 2, rt = Math.min(W, H) * .2;
    wt -= dt;
    if (wt <= 0) {
      F.wave++; wt = 18;
      for (let i = 0, n = 2 + F.wave; i < n; i++) { const a = Math.random() * TAU, d = Math.hypot(W, H) / 2 + 20; en.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, hp: 12 * Math.pow(1.15, F.wave), max: 12 * Math.pow(1.15, F.wave), v: 26 + Math.random() * 10 }); }
    }
    for (const e of en) {
      const dx = cx - e.x, dy = cy - e.y, d = Math.hypot(dx, dy) || 1;
      if (d < starR() + 6) { F.hp -= 10; e.hp = 0; continue; }
      e.x += dx / d * e.v * dt; e.y += dy / d * e.v * dt;
    }
    F.turrets.forEach((lv, i) => {
      if (!lv) return;
      cds[i] -= dt; if (cds[i] > 0) return;
      const a = i * TAU / 8, tx = cx + Math.cos(a) * rt, ty = cy + Math.sin(a) * rt, range = 150 + 40 * lv;
      let best = null, bd = range;
      for (const e of en) { if (e.hp <= 0) continue; const d = Math.hypot(e.x - tx, e.y - ty); if (d < bd) { bd = d; best = e; } }
      if (best) { best.hp -= 5 * lv; cds[i] = .8; shots.push({ x1: tx, y1: ty, x2: best.x, y2: best.y, t: 0 }); }
    });
    en = en.filter(e => e.hp > 0);
    shots.forEach(s => s.t += dt); shots = shots.filter(s => s.t < .2);
    F.hp = Math.min(maxHp(), F.hp + (1 + F.level) * dt * .5);
    if (F.hp <= 0) { F.hp = maxHp(); en = []; F.energy *= .5; wt = 12; FE.toast('Your star flickered and nearly died. The invaders fled, and half your energy was lost.', 4800); }
  }
  function drawForge() {
    const c = ctx, F = C().forge, cx = W / 2, cy = H / 2, rt = Math.min(W, H) * .2, R = starR();
    c.clearRect(0, 0, W, H); c.fillStyle = '#02030a'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(255,255,255,${.15 + .5 * hs(i, 3)})`; c.fillRect(hs(i, 1) * W, hs(i, 2) * H, 1.4, 1.4); }
    c.globalCompositeOperation = 'lighter';
    let g = c.createRadialGradient(cx, cy, 0, cx, cy, R * 5); g.addColorStop(0, `rgba(255,214,140,${.5 + .05 * F.level})`); g.addColorStop(1, 'rgba(255,140,60,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 6 + F.level * 3; i++) { const a = i / (6 + F.level * 3) * TAU + T * .2; c.strokeStyle = 'rgba(255,225,170,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.lineTo(cx + Math.cos(a) * (R * 1.6 + 8 * Math.sin(T * 3 + i)), cy + Math.sin(a) * (R * 1.6 + 8 * Math.sin(T * 3 + i))); c.stroke(); }
    c.globalCompositeOperation = 'source-over';
    g = c.createRadialGradient(cx - R * .3, cy - R * .3, 1, cx, cy, R); g.addColorStop(0, '#fffbe8'); g.addColorStop(.6, '#ffd36b'); g.addColorStop(1, '#f2683a'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(190,205,255,.12)'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, rt, 0, TAU); c.stroke();
    F.turrets.forEach((lv, i) => {
      const a = i * TAU / 8, x = cx + Math.cos(a) * rt, y = cy + Math.sin(a) * rt;
      c.strokeStyle = lv ? '#9fe8c0' : 'rgba(190,205,255,.35)'; c.lineWidth = 1.5; c.setLineDash(lv ? [] : [3, 4]); c.beginPath(); c.arc(x, y, 14, 0, TAU); c.stroke(); c.setLineDash([]);
      if (lv) { c.fillStyle = '#9fe8c0'; for (let k = 0; k < lv; k++) c.fillRect(x - 9 + k * 7, y - 3, 5, 6); }
    });
    for (const e of en) { c.fillStyle = '#0a0d1a'; c.strokeStyle = '#ff7a6a'; c.lineWidth = 2; c.beginPath(); c.moveTo(e.x, e.y - 9); c.lineTo(e.x + 8, e.y + 7); c.lineTo(e.x - 8, e.y + 7); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,122,106,.8)'; c.fillRect(e.x - 8, e.y + 10, 16 * e.hp / e.max, 2); }
    c.globalCompositeOperation = 'lighter';
    for (const s of shots) { c.strokeStyle = `rgba(160,255,200,${1 - s.t / .2})`; c.lineWidth = 2; c.beginPath(); c.moveTo(s.x1, s.y1); c.lineTo(s.x2, s.y2); c.stroke(); }
    c.globalCompositeOperation = 'source-over';
  }
  function sideForge() {
    const F = C().forge, last = F.level >= LEVEL_MAX;
    return `<h4>Your star</h4><p>Stage <b>${F.level} / ${LEVEL_MAX}</b><br>Health ${Math.ceil(F.hp)} / ${maxHp()}<br>Energy <b>${FE.fmt(F.energy)}</b> (+${FE.fmt(energyRate())}/s)<br>Wave ${F.wave}</p>`
      + `<button type="button" data-act="lvl" ${last || F.energy < levelCost() ? 'disabled' : ''}>${last ? 'Fully grown' : `Raise the star: ${FE.fmt(levelCost())} energy`}</button>`
      + `<p class="dim">Click the star for a little energy. Click a ring slot to build a turret (${turretCost(0)}) or upgrade it (${turretCost(1)}, then ${turretCost(2)}). Invaders arrive in waves from the edges. Raise the star to stage ${LEVEL_MAX} to finish the story.</p>`;
  }
  function forgeClick(x, y) {
    const F = C().forge, cx = W / 2, cy = H / 2, rt = Math.min(W, H) * .2;
    if (Math.hypot(x - cx, y - cy) < starR() + 8) { F.energy += 2 * F.level; return; }
    F.turrets.forEach((lv, i) => {
      const a = i * TAU / 8;
      if (Math.hypot(x - (cx + Math.cos(a) * rt), y - (cy + Math.sin(a) * rt)) > 18 || lv >= 3) return;
      const c = turretCost(lv); if (F.energy >= c) { F.energy -= c; F.turrets[i] = lv + 1; FE.save(); }
    });
  }

  cvs.addEventListener('pointerdown', e => {
    const r = cvs.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
    if (C().path === 'conquest') conquestClick(x, y); else forgeClick(x, y);
    sideSig = '';
  });
  side.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b || b.disabled) return;
    const a = b.dataset.act, F = C().forge;
    if (a === 'invade') invade(sel);
    else if (a === 'weapon') { if (FE.state.stardust >= weaponCost() && C().weapon < WEAPON_MAX) { FE.state.stardust -= weaponCost(); C().weapon++; FE.save(); FE.render(); } }
    else if (a === 'lvl') { if (F.level < LEVEL_MAX && F.energy >= levelCost()) { F.energy -= levelCost(); F.level++; F.hp = maxHp(); FE.save(); if (F.level >= LEVEL_MAX) setTimeout(ending, 1500); } }
    sideSig = '';
  });

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
    if (eg.hidden) return;
    if (cvs.clientWidth !== W || cvs.clientHeight !== H) fit();
    $('eg-title').textContent = C().path === 'conquest' ? 'The Galaxy' : 'A New Star';
    if (C().path === 'conquest') { drawGalaxy(); $('eg-res').textContent = `army power ${FE.fmt(Math.floor(power()))} · stardust ${FE.fmt(FE.state.stardust)}`; }
    else { forgeStep(dt); drawForge(); $('eg-res').textContent = `energy ${FE.fmt(C().forge.energy)}`; }
    const html = C().path === 'conquest' ? sideConquest() : sideForge();
    if (html !== sideSig) { sideSig = html; side.innerHTML = html; }
  }

  // ---------------- always running: automation, the Star Core button, the first offer ----------------
  let lastT = performance.now();
  setInterval(() => {
    const t = performance.now(), dt = Math.min((t - lastT) / 1000, 3600); lastT = t;
    const s = FE.state; if (!s.cur) return;
    const c = C();
    if (c.path === 'conquest') SYS.forEach((sy, i) => { if (c.conq[i] && sy.el) FE.credit(sy.el, sy.yield * dt); });
    if (c.path === 'forge') c.forge.energy += energyRate() * dt;
    if (!c.got && s.cleared && s.cleared.reclaim3 && !(FE.combat && FE.combat.active)) { c.got = true; FE.save(); }
    if (c.got && !c.path && !asked && !FE.modalOpen && FE.view < 3 && !(FE.combat && FE.combat.active)) showChoice();
    scBtn.hidden = !(c.got && FE.view < 3 && eg.hidden && !FE.modalOpen && !(FE.combat && FE.combat.active) && !FE.collapsing);
    scBtn.textContent = c.path === 'conquest' ? 'Galaxy Map' : c.path === 'forge' ? 'Your Star' : 'Star Core';
  }, 100);
});
