/* endgame.js - what comes after layer 2. Once the last map is cleared the player is given a star core and must choose, for good:
 *   Conquest:  the core becomes a weapon that strengthens the whole army. A map of the galaxy opens, a spiral of star systems with
 *              nodes scattered all over it. You start at the rim and fight inward. Every invasion is a real battle on a layer 2
 *              battlefield (combat.js), and every system you take feeds you resources by itself. Take the heart of the galaxy and
 *              the war is won. The star layer never opens on this path: the forest stays your layer 1.
 *   Own star:  the forest is gone. Outer space (the old layer 1, a star you build) takes its place as layer 1. Once a star exists,
 *              invaders arrive in waves and lock into orbit around the edge of your system. Condensed stars unlock planets: weapon
 *              builds that circle your star and shoot at the invaders. Lose an invasion and you lose a share of your resources and
 *              builds; win and you are rewarded. Win enough invasions and the story ends. The mini-game shards and upgrades carry over.
 * Both live in a full-screen overlay (#eg). Load after minigames.js (and mgupgrades.js) and before ui.js. */
FE.module(function (FE) {
  const $ = FE.$, TAU = Math.PI * 2, IDS = FE.ELEMENTS.map(e => e.id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const hs = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };

  const blankStar = () => ({ unlocked: {}, planets: { air: 0, water: 0, earth: 0, fire: 0 }, wins: 0, losses: 0, n: 0, nextAt: 0, started: false });
  const blank = () => ({ got: false, path: null, ended: false, weapon: 0, conq: {}, star: blankStar() });
  const oldFresh = FE.freshState;
  FE.freshState = () => Object.assign(oldFresh(), { core: blank() });
  if (!FE.state.core) FE.state.core = blank();
  const C = () => FE.state.core, S = () => C().star;

  // ================================================================ data
  const WEAPON_MAX = 6, WEAPON_STEP = .25, NEED_WINS = 8;
  const weaponCost = () => Math.round(20 * Math.pow(2, C().weapon));
  // the core weapon makes every unit stronger, in every fight, from the moment you take it up
  const oldStats = FE.unitStats;
  FE.unitStats = id => {
    const st = oldStats(id), c = FE.state.core;
    if (!c || c.path !== 'conquest' || !c.weapon) return st;
    const m = 1 + WEAPON_STEP * c.weapon; return { hp: Math.ceil(st.hp * m), atk: Math.ceil(st.atk * m) };
  };

  // ---- the galaxy: three arms that swirl in from the rim to the heart, with more systems scattered between them ----
  const ARMS = 3, K = 8, SWIRL = 4.6;
  const NAMES = ['Dead Sol', 'Ember Reach', 'Tide Haven', 'Gale Ring', 'Stone Cradle', 'Mist Verge', 'Cinder Crown', 'Whisper Deep', 'Granite Veil', 'Solar Throne', 'Event Verge',
    'Last Lantern', 'Ash Meridian', 'Quiet Harbour', 'Iron Orchard', 'Pale Cascade', 'Hollow Spire', 'Saffron Drift', 'Cold Anvil', 'Lantern Wake', 'Vesper Gate', 'Moth Chorus',
    'Dune of Glass', 'Orrery', 'Thistle Deep', 'Kiln of Dawn', 'Slate Choir', 'Wren Nebula', 'Marrow Light', 'Brass Horizon', 'Tallow Moon', 'Rime Court', 'Sable Crossing', 'Heart of the Galaxy'];
  const armAngle = (a, r) => a * TAU / ARMS + SWIRL * (.95 - r);
  const SYS = [];
  const addSys = (r, th, o) => { SYS.push(Object.assign({ r, x: Math.cos(th) * r, y: Math.sin(th) * r, links: [] }, o)); return SYS.length - 1; };
  const link = (i, j) => { if (i !== j && !SYS[i].links.includes(j)) { SYS[i].links.push(j); SYS[j].links.push(i); } };
  const arm = [];
  for (let a = 0; a < ARMS; a++) {
    arm[a] = [];
    for (let k = 0; k < K; k++) {
      const r = .93 - k / (K - 1) * .72 + (hs(a * 9 + k, 4) - .5) * .05, th = armAngle(a, r) + (hs(a * 9 + k, 5) - .5) * .16;
      arm[a][k] = addSys(r, th, {});
      if (k) link(arm[a][k - 1], arm[a][k]);
    }
  }
  const HOME = arm[0][0], HEART = addSys(0, 0, { center: true });
  for (let a = 0; a < ARMS; a++) link(arm[a][K - 1], HEART);
  for (let g = 0; g < ARMS; g++) {                                   // systems between the arms; they join one arm to the next
    let prev = -1;
    [.76, .52, .33].forEach((r, n) => {
      const th = armAngle(g + .5, r) + (hs(g * 7 + n, 6) - .5) * .25, i = addSys(r + (hs(g * 7 + n, 7) - .5) * .05, th, {});
      const near = ar => ar.reduce((b, j) => Math.hypot(SYS[j].x - SYS[i].x, SYS[j].y - SYS[i].y) < Math.hypot(SYS[b].x - SYS[i].x, SYS[b].y - SYS[i].y) ? j : b, ar[0]);
      link(i, near(arm[g])); link(i, near(arm[(g + 1) % ARMS]));
      if (prev >= 0) link(prev, i);
      prev = i;
    });
  }
  SYS.forEach((s, i) => {
    s.i = i; s.home = i === HOME;
    s.name = s.home ? NAMES[0] : s.center ? NAMES[NAMES.length - 1] : NAMES[1 + (i % (NAMES.length - 2))];
    s.el = IDS[Math.floor(hs(i, 8) * 4)];
    s.tier = s.center ? 10 : clamp(Math.round((1 - s.r) * 8) + 1, 1, 9);
    s.yield = Math.round(25 * Math.pow(1.5, s.tier - 1));
  });
  const owned = i => i === HOME || !!C().conq[i];
  const reachable = i => !owned(i) && SYS[i].links.some(owned);
  const nConq = () => Object.keys(C().conq).filter(k => C().conq[k]).length;

  // what a system's battle looks like: a layer 2 map, built from the system's tier. Always the same for the same system.
  function mapFor(i) {
    const s = SYS[i], t = s.tier, en = [], n = k => hs(i * 13 + k, 2);
    const nMage = Math.floor((t + 1) / 2), nGiant = s.center ? 3 : Math.max(0, Math.floor((t - 2) / 2));
    en.push({ type: 'wall', at: .16, hp: 12 + 8 * t });
    if (t >= 5) en.push({ type: 'wall', at: .5, hp: 10 + 6 * t });
    for (let k = 0; k < Math.floor(t / 2) + 1; k++) en.push({ type: 'sleeper', x: .3 + .05 * (k % 3), dy: (k - 1) * 4.4 * (k % 2 ? 1 : -1) });
    for (let k = 0; k < 3 + t; k++) en.push({ type: 'stick', x: .56 + .06 * n(k), dx: (n(k + 40) - .5) * 5, dy: (n(k + 80) - .5) * 22 });
    for (let k = 0; k < t; k++) en.push({ type: 'brute', x: .7 + .05 * n(k + 5), dy: ((k + .5) / t - .5) * 24 });
    for (let k = 0; k < nMage; k++) en.push({ type: 'mage', x: .34 + .05 * n(k + 9), dy: ((k + .5) / nMage - .5) * 26 });
    for (let k = 0; k < nGiant; k++) en.push({ type: 'giant', x: .86, dy: ((k + .5) / nGiant - .5) * 22 });
    return { id: 'sys' + i, name: s.name, title: s.center ? 'The Heart is Yours' : 'System Conquered', width: 64, height: 33.6, bow: 3.1, enemies: en };
  }
  const forces = m => { const c = {}; m.enemies.forEach(e => { c[e.type] = (c[e.type] || 0) + 1; }); return Object.keys(c).map(k => `${c[k]} ${k}${c[k] > 1 ? 's' : ''}`).join(', '); };

  // ---- the planets of your own star ----
  const PERIM = 880;                                              // the invaders lock their orbit this far from the star (the field is 1000 to the edge)
  const PL = {
    air:   { name: 'Gale',  ring: 290, base: 2500, grow: 1.6, cd: .55, dmg: 3.2, range: 680, spd: 950, col: '#bfe6f5', blurb: 'fires fast, light shots' },
    water: { name: 'Tide',  ring: 390, base: 3500, grow: 1.6, cd: 1.1, dmg: 3,   range: 720, spd: 720, col: '#5aa9f5', blurb: 'its shots slow the invaders' },
    earth: { name: 'Stone', ring: 490, base: 4500, grow: 1.6, cd: 2.4, dmg: 15,  range: 820, spd: 560, col: '#d8a560', blurb: 'heavy shells that burst on impact' },
    fire:  { name: 'Ember', ring: 590, base: 6000, grow: 1.6, cd: 1.4, dmg: 7,   range: 700, spd: 820, col: '#ff8a3d', blurb: 'sets the invaders alight' }
  };
  const PL_MAX = 6;
  const planetCost = el => Math.ceil(PL[el].base * Math.pow(PL[el].grow, S().planets[el]));
  const sumTier = () => IDS.reduce((n, k) => n + FE.state.els[k].tier, 0);
  const dmgMult = el => 1 + .6 * FE.state.els[el].tier;
  const starMax = () => 150 + 40 * sumTier();
  const KINDS = {
    scout: { hp: 14,  dmg: 2,  cd: 2.2, v: 80, w: .22, col: '#ff9a8a', s: 11 },
    ship:  { hp: 50,  dmg: 5,  cd: 3,   v: 52, w: .14, col: '#ff7a6a', s: 15 },
    dread: { hp: 240, dmg: 14, cd: 4,   v: 34, w: .08, col: '#ff5a5a', s: 24 }
  };

  // ================================================================ the overlay
  const css = document.createElement('style');
  css.textContent = `#eg{position:fixed;inset:0;z-index:70;background:#02030a;color:#e9eefc;display:flex;flex-direction:column;font-family:"Times New Roman",Times,serif}
#eg[hidden]{display:none}.eg-top{display:flex;align-items:center;gap:18px;padding:12px 20px;border-bottom:1px solid rgba(170,190,255,.2)}
.eg-top b{font-size:1.5em;font-weight:normal;letter-spacing:.08em}.eg-top span{margin-left:auto;color:#aab4d8;font-variant-numeric:tabular-nums}
.eg-main{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 320px;grid-template-rows:minmax(0,1fr)}#eg-cv{width:100%;height:100%;min-width:0;min-height:0;display:block;cursor:pointer}
#eg-side{padding:16px 18px;border-left:1px solid rgba(170,190,255,.2);overflow:auto;line-height:1.45;font-size:.95em}#eg-side h4{margin:0 0 6px;font-weight:normal;font-size:1.3em}
#eg-side .dim{color:#8d9bc4}#eg-side p{margin:6px 0}#eg-side hr{border:0;border-top:1px solid rgba(170,190,255,.2);margin:12px 0}
#eg-side .pl{padding:8px 0;border-top:1px solid rgba(170,190,255,.14)}#eg-side .pl b{font-weight:normal;font-size:1.05em}#eg-side .pl small{display:block;color:#a9b5da}
#eg-side .bad{color:#ff9a8a}#eg-side .good{color:#9fe8c0}
#eg button,#sc-btn{font:inherit;color:#e9eefc;background:rgba(255,255,255,.05);border:1px solid rgba(190,205,255,.55);border-radius:6px;padding:5px 14px;cursor:pointer;margin:4px 6px 4px 0}
#eg button:hover:not(:disabled),#sc-btn:hover{background:rgba(190,205,255,.18)}#eg button:disabled{color:#6c7799;border-color:rgba(190,205,255,.2);cursor:default}
#sc-btn{position:fixed;top:10px;right:14px;z-index:31;box-shadow:0 0 16px -4px #ffd36b;border-color:#ffd36b;color:#ffe6a8}#sc-btn[hidden]{display:none}
#sc-btn.alert{border-color:#ff7a6a;color:#ffd0c8;box-shadow:0 0 22px 0 #ff5a4a;animation:scping 1.1s ease-in-out infinite}@keyframes scping{50%{box-shadow:0 0 6px -2px #ff5a4a}}
#eg-end{position:fixed;inset:0;z-index:90;background:#02030a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center;font-family:"Times New Roman",serif;padding:30px}
#eg-end p{margin:0;font-size:1.7em;letter-spacing:.04em;opacity:0;transition:opacity 2s ease;text-shadow:0 0 22px rgba(190,205,255,.6)}#eg-end p.on{opacity:1}
#eg-end button{font:inherit;color:#fff;background:none;border:1px solid #fff;border-radius:6px;padding:8px 22px;cursor:pointer;opacity:0;transition:opacity 2s ease}#eg-end button.on{opacity:1}`;
  document.head.appendChild(css);
  const eg = document.createElement('div'); eg.id = 'eg'; eg.hidden = true;
  eg.innerHTML = '<div class="eg-top"><b id="eg-title"></b><span id="eg-res"></span><button type="button" id="eg-back">Back to the layers</button></div><div class="eg-main"><canvas id="eg-cv"></canvas><div id="eg-side"></div></div>';
  document.body.appendChild(eg);
  const cvs = $('eg-cv'), ctx = cvs.getContext('2d'), side = $('eg-side');
  const scBtn = document.createElement('button'); scBtn.id = 'sc-btn'; scBtn.type = 'button'; scBtn.hidden = true; document.body.appendChild(scBtn);

  let sel = -1, raf = 0, last = 0, sideSig = '', W = 0, H = 0, T = 0, DPR = 1, gbg = null, asked = false, fight = null;
  const text = (id, t) => { const e = $(id); if (e && e.textContent !== t) e.textContent = t; };

  function fit() {
    DPR = Math.min(1.5, devicePixelRatio || 1);
    const w = cvs.clientWidth, h = cvs.clientHeight; if (!w || !h) return;
    W = w; H = h; cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR); gbg = null;
  }
  function open() {
    if (!C().path) return;
    eg.hidden = false; FE.modalOpen = true; sideSig = ''; sel = -1; fit(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function close() { eg.hidden = true; FE.modalOpen = false; cancelAnimationFrame(raf); FE.save(); FE.render(); }
  $('eg-back').addEventListener('click', close);
  addEventListener('resize', () => { if (!eg.hidden) fit(); });

  // ================================================================ the choice
  function choose(path) {
    C().path = path;
    if (path === 'forge') {                                          // the forest is gone: its mini-game shards go with you to the stars
      const p = FE.state.fplay;
      if (p && FE.state.mgMeta) { FE.state.mgMeta.shards += p.shards; p.shards = 0; p.buff = null; p.curse = null; p.echo = 0; }
      S().nextAt = 0; S().started = false;
    }
    FE.save(); FE.closePanel();
    if (path === 'conquest') { FE.toast('The star core becomes a weapon. Every unit of yours grows stronger, and the galaxy awaits.', 5600); open(); }
    else {
      FE.toast('The forest is gone. Above the ashes, the old sky opens: build a star, and defend it.', 6400);
      FE.goto(1, true); FE.render();
    }
  }
  function showChoice() {
    asked = true;
    FE.openPanel({
      kind: 'core', noBackdrop: true, sig: () => 'core' + C().path,
      build(box) {
        box.appendChild(FE.h('h3', '', 'The Star Core'));
        box.appendChild(FE.h('p', '', 'The surface is yours again. In the ruins you find a star core, still warm. It can be used once, and you must choose how.'));
        if (C().path) { box.appendChild(FE.h('p', 'dim', 'Your choice is made.')); box.appendChild(FE.h('div', 'btns')).appendChild(FE.panelButton('Close', FE.closePanel)); return; }
        const a = FE.h('div', 'qcard', '<div class="q-task">Forge a weapon and invade</div><div class="q-line">The core strengthens every unit you own. A map of the galaxy opens: fight inward from the rim, one system at a time, in battles like the ones you know. Each system you take feeds you resources by itself. Take the heart of the galaxy and the war is won.</div><div class="q-line bad">You will never light a star of your own: the star layer stays closed.</div>');
        a.appendChild(FE.panelButton('Take up the weapon', () => choose('conquest')));
        const b = FE.h('div', 'qcard', '<div class="q-task">Build your own star</div><div class="q-line">Light a new star in the old sky. Condensed stars unlock planets that circle it and shoot the invaders who come to take it. Lose a battle and you lose resources and builds. Hold the line through ' + NEED_WINS + ' invasions and the world is saved.</div><div class="q-line bad">The dark forest is gone for good: outer space takes its place as your first layer.</div>');
        b.appendChild(FE.panelButton('Light a new star', () => choose('forge')));
        box.appendChild(a); box.appendChild(b);
        box.appendChild(FE.h('p', 'dim', 'This choice is permanent.'));
      }
    });
  }
  scBtn.addEventListener('click', () => { if (C().path) open(); else showChoice(); });

  // ================================================================ the ending
  function ending() {
    if (C().ended) return; C().ended = true; FE.save();
    const lines = C().path === 'conquest'
      ? ['The heart of the galaxy answers to you.', 'Every star you took burns for you, and the cold has nowhere left to hide.', 'The world is not saved by one fire, but by many.', 'The end.']
      : ['Your star burns, steady and bright.', 'Every invader that came was turned back by the worlds you made.', 'The cold recedes, and the sky remembers warmth.', 'The end.'];
    const d = document.createElement('div'); d.id = 'eg-end';
    lines.forEach((t, i) => { const p = document.createElement('p'); p.textContent = t; d.appendChild(p); setTimeout(() => p.classList.add('on'), 600 + i * 2800); });
    const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Keep playing'; d.appendChild(b);
    setTimeout(() => b.classList.add('on'), 600 + lines.length * 2800);
    b.addEventListener('click', () => d.remove());
    document.body.appendChild(d);
  }

  // ================================================================ conquest: the galaxy map
  const R = () => Math.min(W - 40, H - 20) * .47;
  const gp = s => [W / 2 + s.x * R(), H / 2 + s.y * R()];
  function makeBg() {
    gbg = document.createElement('canvas'); gbg.width = Math.round(W * DPR); gbg.height = Math.round(H * DPR);
    const c = gbg.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.fillStyle = '#02030a'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(255,255,255,${.1 + .45 * hs(i, 3)})`; c.fillRect(hs(i, 1) * W, hs(i, 2) * H, 1.3, 1.3); }
    const cx = W / 2, cy = H / 2, r0 = R();
    c.globalCompositeOperation = 'lighter';
    for (let a = 0; a < ARMS; a++) {                                  // the broad glow of each arm
      for (let k = 0; k < 60; k++) {
        const r = .95 - k / 60 * .9, th = armAngle(a, r), x = cx + Math.cos(th) * r * r0, y = cy + Math.sin(th) * r * r0, rad = r0 * (.1 + .06 * r);
        const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, `rgba(${Math.round(120 + 110 * (1 - r))},${Math.round(150 + 60 * (1 - r))},255,${.05 + .04 * (1 - r)})`); g.addColorStop(1, 'rgba(60,90,200,0)');
        c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    }
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, r0 * .38); g.addColorStop(0, 'rgba(255,225,170,.7)'); g.addColorStop(.4, 'rgba(255,180,110,.22)'); g.addColorStop(1, 'rgba(255,140,80,0)');
    c.fillStyle = g; c.fillRect(cx - r0 * .4, cy - r0 * .4, r0 * .8, r0 * .8);
    for (let i = 0; i < 3600; i++) {                                  // a haze of stars along the arms, thick near the heart
      const a = Math.floor(hs(i, 1) * ARMS), u = Math.pow(hs(i, 2), 1.3), r = .04 + u * .93, th = armAngle(a, r) + (hs(i, 3) + hs(i, 9) - 1) * (.55 + .5 * (1 - r)), rr = r + (hs(i, 4) - .5) * .06;
      const col = r < .3 ? '255,222,170' : r < .6 ? '215,228,255' : '150,180,255';
      c.fillStyle = `rgba(${col},${.15 + .5 * hs(i, 5)})`; const sz = .5 + 1.4 * hs(i, 6) * hs(i, 6);
      c.fillRect(cx + Math.cos(th) * rr * r0, cy + Math.sin(th) * rr * r0, sz, sz);
    }
    c.globalCompositeOperation = 'source-over';
  }
  function drawGalaxy() {
    const c = ctx; c.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!gbg) makeBg();
    c.drawImage(gbg, 0, 0, W, H);
    SYS.forEach((s, i) => s.links.forEach(j => {
      if (j < i) return;
      const [x1, y1] = gp(s), [x2, y2] = gp(SYS[j]), live = owned(i) && owned(j), open2 = (owned(i) && reachable(j)) || (owned(j) && reachable(i));
      c.strokeStyle = live ? 'rgba(255,230,160,.85)' : open2 ? 'rgba(190,210,255,.5)' : 'rgba(170,190,255,.14)'; c.lineWidth = live ? 2.2 : 1; c.setLineDash(live ? [] : [4, 6]);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }));
    c.setLineDash([]);
    SYS.forEach((s, i) => {
      const [x, y] = gp(s), col = s.home ? '#d8e0ff' : s.center ? '#ffd36b' : FE.PAL[s.el].glow, mine = owned(i), reach = reachable(i), r = s.center ? 15 : s.home ? 11 : 5 + s.tier * .45;
      if (mine || s.center) { const g = c.createRadialGradient(x, y, 0, x, y, r * 4.5); g.addColorStop(0, rgba(col, .65)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.fillRect(x - r * 4.5, y - r * 4.5, r * 9, r * 9); }
      c.fillStyle = mine ? col : reach ? rgba(col, .6) : rgba(col, .28); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      if (reach) { c.strokeStyle = rgba(col, .5 + .4 * Math.sin(T * 3 + i)); c.lineWidth = 2; c.beginPath(); c.arc(x, y, r + 5 + 2 * Math.sin(T * 3 + i), 0, TAU); c.stroke(); }
      if (i === sel) { c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, r + 7, 0, TAU); c.stroke(); }
      if (s.home) { c.strokeStyle = '#0a0d1a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 4, y - 5); c.lineTo(x + 1, y); c.lineTo(x - 2, y + 5); c.stroke(); }
      if (mine || reach || i === sel || s.center) { c.fillStyle = mine ? '#f2f5ff' : '#aab6dc'; c.font = '13px "Times New Roman",serif'; c.textAlign = 'center'; c.fillText(s.name, x, y + r + 18); }
    });
  }
  function conquer(i) {
    const s = SYS[i]; C().conq[i] = true;
    FE.toast(`${s.name} is yours. It now feeds you ${FE.fmt(s.yield)} ${s.center ? 'of every element' : s.el} per second, and more as your forest grows.`, 5600);
    FE.save(); FE.render();
    if (s.center) setTimeout(ending, 1500);
  }
  // an invasion is a battle on a layer 2 map: the same fight, the same army, the same rules. See combat.js.
  function startFight(i) {
    const s = SYS[i];
    if (fight || !s || owned(i) || !reachable(i) || (FE.combat && FE.combat.active) || FE.collapsing) return;
    if (FE.UNITS.every(u => !FE.state.units[u.id])) { FE.toast('You have no army to send. Raise some units first.', 3600); return; }
    const m = mapFor(i); FE.MAPS.push(m); FE.state.target = FE.MAPS.length - 1; fight = { i, id: m.id };
    close(); FE.venture();
    if (!FE.combat.active) endFight();
  }
  function endFight() {
    if (!fight) return;
    const f = fight, won = !!FE.state.cleared[f.id]; fight = null;
    delete FE.state.cleared[f.id];
    const k = FE.MAPS.findIndex(m => m.id === f.id); if (k >= 0) FE.MAPS.splice(k, 1);
    FE.state.target = null;
    if (won) { delete FE.state.mapProg[f.id]; conquer(f.i); }
    if (C().path === 'conquest') setTimeout(open, 150);
  }
  const cp = $('c-panel');
  if (cp) new MutationObserver(() => { if (fight) { const n = $('p-next'); if (n) n.remove(); } }).observe(cp, { childList: true, subtree: true });   // there is no "next map" in a conquest
  const armyCount = () => FE.UNITS.reduce((n, u) => n + FE.state.units[u.id], 0);
  function sideConquest() {
    const s = SYS[sel], k = nConq();
    let h = `<h4>The Galaxy</h4><p>Systems taken: <b>${k}</b><br>Your army: <b>${FE.fmt(armyCount())}</b> units</p><p class="dim">Fight inward from the rim. You can invade any system linked to one you hold. Every invasion is a battle like the ones in layer 2. Take the heart of the galaxy to win.</p>`;
    h += `<p>Core weapon level ${C().weapon} / ${WEAPON_MAX}: all units ×${(1 + WEAPON_STEP * C().weapon).toFixed(2)} health and damage</p><button type="button" data-act="weapon" ${C().weapon >= WEAPON_MAX || FE.state.stardust < weaponCost() ? 'disabled' : ''}>${C().weapon >= WEAPON_MAX ? 'Fully charged' : `Charge the core: ${FE.fmt(weaponCost())} stardust`}</button>`;
    h += '<hr>';
    if (!s) return h + '<p class="dim">Click a system on the map.</p>';
    h += `<h4>${s.name}</h4>`;
    if (s.home) return h + '<p class="dim">Your dead star, on the rim. Everything starts here.</p>';
    h += `<p>${s.center ? 'The heart of the galaxy.' : `Element: ${s.el}`}<br>Danger: ${s.tier}<br>Defenders: ${forces(mapFor(sel))}<br>Yield when taken: ${FE.fmt(s.yield)} ${s.center ? 'of every element' : s.el}/s</p>`;
    if (owned(sel)) h += '<p class="good">Taken. It is feeding you.</p>';
    else if (!reachable(sel)) h += '<p class="dim">Out of reach. Take a linked system first.</p>';
    else h += '<button type="button" data-act="invade">Invade: send your army into battle</button><p class="dim">Survivors come home. Fallen units are gone, but give echoes.</p>';
    return h;
  }
  function conquestClick(x, y) { sel = -1; SYS.forEach((s, i) => { const [nx, ny] = gp(s); if (Math.hypot(x - nx, y - ny) < 22) sel = i; }); }

  // ================================================================ your own star: the defence
  // the field is 2000 x 2000 units with the star in the middle, so the fight is the same on every screen
  let D = null;                                                         // the invasion in progress, or null
  let ringA = { air: 0, water: 0, earth: 0, fire: 0 }, shots = [], fx = [], beams = [];
  const ringW = el => (el === 'air' || el === 'earth' ? 1 : -1) * .5 * Math.pow(290 / PL[el].ring, .8);
  const planetPos = (el, k, n) => { const a = ringA[el] + k * TAU / n; return [Math.cos(a) * PL[el].ring, Math.sin(a) * PL[el].ring]; };
  const starHpNow = () => D ? D.hp : starMax();

  function unlockCheck() {
    IDS.forEach(k => { if (FE.state.els[k].tier >= 1 && !S().unlocked[k]) { S().unlocked[k] = true; FE.toast(`Your ${k} star burns: the ${PL[k].name} planet is unlocked.`, 4800); } });
    if (!S().started && Object.keys(S().unlocked).length) {
      S().started = true; S().nextAt = Date.now() + 240000; FE.save();
      FE.toast('A star! Invaders have seen its light. They arrive in four minutes. Open the Star System and build planets.', 8000);
    }
  }
  function waveList(n, wi) {
    const out = [];
    for (let i = 0; i < 3 + n + wi * 2; i++) out.push('scout');
    if (wi >= 1) for (let i = 0; i < 1 + Math.floor(n / 2) + wi; i++) out.push('ship');
    if (wi >= 3) for (let i = 0; i < 1 + Math.floor(n / 3); i++) out.push('dread');
    return out;
  }
  function startInvasion() {
    if (D) return;
    const n = S().n, waves = Math.min(5, 2 + Math.floor(n / 2));
    D = { n, hp: starMax(), max: starMax(), waves, wi: 0, t: 3, en: [], over: 0, res: null, cds: {} };
    shots = []; beams = [];
    FE.toast(`Invasion ${n + 1}: the invaders are here. ${waves} waves.`, 4200);
  }
  function spawnWave() {
    const list = waveList(D.n, D.wi), sc = Math.pow(1.2, D.n);
    list.forEach((k, i) => {
      const t = KINDS[k], a = rand(TAU);
      D.en.push({ k, t, a, r: 1250 + i * 18, lane: PERIM + rand(-30, 30), hp: t.hp * sc, max: t.hp * sc, cd: rand(.5, t.cd), locked: false, slow: 0, burn: 0, burnDps: 0, w: t.w * (Math.random() < .5 ? 1 : -1) * rand(.8, 1.2), x: 0, y: 0 });
    });
    D.wi++; D.t = 17;
  }
  function loseInvasion() {
    const lostRes = .3, lostBuilds = .2;
    IDS.forEach(k => {
      const e = FE.state.els[k]; e.count *= 1 - lostRes;
      Object.keys(e.up).forEach(b => { e.up[b] = Math.floor(e.up[b] * (1 - lostBuilds)); });
      S().planets[k] = Math.max(0, S().planets[k] - Math.round(S().planets[k] * lostBuilds));
    });
    S().losses++; S().n++; S().nextAt = Date.now() + 300000;
    D.res = { win: false, text: `The star held out no longer. The invaders took ${Math.round(lostRes * 100)}% of every resource, ${Math.round(lostBuilds * 100)}% of your builds and planets, then withdrew.` };
    FE.toast('The invasion succeeded. You lost resources, builds and planets.', 6000);
  }
  function winInvasion() {
    const n = D.n, out = [], sh = 3 + n;
    if (FE.state.mgMeta) FE.state.mgMeta.shards += sh;
    out.push(`${sh} mini-game shards`);
    const pool = ['crystals', 'buff', 'stock', 'dust', 'planet'];
    for (let q = 0; q < 2 && pool.length; q++) {
      const id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      if (id === 'crystals') { const el = pick(IDS), c = 1 + Math.floor(n / 2); FE.state.crystals[el] += c; FE.state.layer2 = true; out.push(`${c} ${el} crystal${c > 1 ? 's' : ''}`); }
      else if (id === 'buff') { const m = Math.min(4, 2 + n * .25); if (!FE.buffOn() || FE.state.buff.mult < m) FE.state.buff = { mult: m, end: Date.now() + 600000 }; out.push(`all production ×${m} for 10 minutes`); }
      else if (id === 'stock') { IDS.forEach(k => { FE.state.els[k].count += Math.max(5000 * (n + 1), FE.rate(k) * 900); }); out.push('a stockpile of every element (15 minutes of production)'); }
      else if (id === 'dust') { FE.state.stardust += 20 * (n + 1); out.push(`${20 * (n + 1)} echoes`); }
      else { const opt = IDS.filter(k => S().unlocked[k] && S().planets[k] < PL_MAX); if (opt.length) { const k = pick(opt); S().planets[k]++; out.push(`a free ${PL[k].name} planet`); } else q--; }
    }
    S().wins++; S().n++; S().nextAt = Date.now() + 240000 + rand(0, 60000);
    D.res = { win: true, text: `The invaders are gone. Rewards: ${out.join('; ')}.` };
    FE.toast('The invasion is beaten. ' + out.join('; ') + '.', 7000);
    if (S().wins >= NEED_WINS) setTimeout(ending, 2200);
  }
  function stepDef(dt) {
    dt = Math.min(dt, .1);
    IDS.forEach(k => { ringA[k] += ringW(k) * dt; });
    fx.forEach(f => { f.t += dt; }); fx = fx.filter(f => f.t < f.life); beams.forEach(b => { b.t += dt; }); beams = beams.filter(b => b.t < .25);
    if (!D) return;
    if (D.over > 0) { D.over += dt; if (D.over > 6) { D = null; shots = []; beams = []; FE.render(); } return; }
    D.t -= dt;
    if (D.wi < D.waves && D.t <= 0) spawnWave();
    for (const e of D.en) {                                           // the invaders fly in, lock their orbit on the edge of your system, and fire on the star
      e.slow = Math.max(0, e.slow - dt); e.burn = Math.max(0, e.burn - dt);
      if (e.burn > 0) e.hp -= e.burnDps * dt;
      const k = e.slow > 0 ? .5 : 1;
      if (e.r > e.lane) { e.r = Math.max(e.lane, e.r - e.t.v * k * dt); e.a += e.w * .3 * k * dt; if (e.r <= e.lane) e.locked = true; }
      else e.a += e.w * k * dt;
      e.x = Math.cos(e.a) * e.r; e.y = Math.sin(e.a) * e.r;
      if (e.locked) { e.cd -= dt * k; if (e.cd <= 0) { e.cd = e.t.cd; D.hp -= e.t.dmg; beams.push({ x: e.x, y: e.y, t: 0 }); } }
    }
    IDS.forEach(el => {                                               // the planets shoot
      const n = S().planets[el], P = PL[el]; if (!n) return;
      for (let k = 0; k < n; k++) {
        const key = el + k; D.cds[key] = (D.cds[key] == null ? rand(0, P.cd) : D.cds[key]) - dt;
        if (D.cds[key] > 0) continue;
        const [px, py] = planetPos(el, k, n); let best = null, bd = P.range;
        for (const e of D.en) { if (e.hp <= 0) continue; const d = Math.hypot(e.x - px, e.y - py); if (d < bd) { bd = d; best = e; } }
        if (!best) { D.cds[key] = .1; continue; }
        D.cds[key] = P.cd; shots.push({ x: px, y: py, tgt: best, el, P, dmg: P.dmg * dmgMult(el) });
      }
    });
    for (const s of shots) {
      const t = s.tgt, d = Math.hypot(t.x - s.x, t.y - s.y), st = s.P.spd * dt;
      if (t.hp <= 0) { s.dead = true; continue; }
      if (d <= st + 8) {
        s.dead = true;
        const hit = (e, dmg) => { e.hp -= dmg; if (s.el === 'water') e.slow = 2.5; if (s.el === 'fire') { e.burn = 3; e.burnDps = Math.max(e.burnDps, 4 * dmgMult('fire')); } };
        if (s.el === 'earth') { fx.push({ x: t.x, y: t.y, t: 0, life: .4, r: 90, col: s.P.col }); D.en.forEach(e => { if (Math.hypot(e.x - t.x, e.y - t.y) < 90) hit(e, s.dmg * (e === t ? 1 : .5)); }); }
        else { hit(t, s.dmg); fx.push({ x: t.x, y: t.y, t: 0, life: .25, r: 30, col: s.P.col }); }
      } else { s.x += (t.x - s.x) / d * st; s.y += (t.y - s.y) / d * st; }
    }
    shots = shots.filter(s => !s.dead);
    D.en = D.en.filter(e => { if (e.hp > 0) return true; fx.push({ x: e.x, y: e.y, t: 0, life: .5, r: e.t.s * 3, col: '#ffb0a0' }); return false; });
    D.hp = Math.min(D.max, D.hp + .4 * dt);
    if (D.hp <= 0) { D.hp = 0; D.en = []; D.over = .001; loseInvasion(); FE.save(); }
    else if (D.wi >= D.waves && !D.en.length) { D.over = .001; winInvasion(); FE.save(); }
  }
  function drawDef() {
    const c = ctx, k = Math.min(W, H) / 2 / 1060, cx = W / 2, cy = H / 2;
    c.setTransform(DPR, 0, 0, DPR, 0, 0); c.fillStyle = '#02030a'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) { c.fillStyle = `rgba(255,255,255,${.12 + .45 * hs(i, 3)})`; c.fillRect(hs(i, 1) * W, hs(i, 2) * H, 1.3, 1.3); }
    const X = x => cx + x * k, Y = y => cy + y * k, R0 = (46 + 5 * Math.min(sumTier(), 12)) * k;
    c.strokeStyle = 'rgba(255,120,100,.14)'; c.lineWidth = 2; c.setLineDash([10, 12]); c.beginPath(); c.arc(cx, cy, PERIM * k, 0, TAU); c.stroke(); c.setLineDash([]);   // the outer perimeter
    IDS.forEach(el => { if (!S().unlocked[el]) return; c.strokeStyle = rgba(PL[el].col, .18); c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, PL[el].ring * k, 0, TAU); c.stroke(); });
    c.globalCompositeOperation = 'lighter';
    let g = c.createRadialGradient(cx, cy, 0, cx, cy, R0 * 5); g.addColorStop(0, 'rgba(255,214,140,.6)'); g.addColorStop(1, 'rgba(255,140,60,0)'); c.fillStyle = g; c.fillRect(cx - R0 * 5, cy - R0 * 5, R0 * 10, R0 * 10);
    c.globalCompositeOperation = 'source-over';
    g = c.createRadialGradient(cx - R0 * .3, cy - R0 * .3, 1, cx, cy, R0); g.addColorStop(0, '#fffbe8'); g.addColorStop(.6, '#ffd36b'); g.addColorStop(1, '#f2683a'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R0, 0, TAU); c.fill();
    IDS.forEach(el => {
      const n = S().planets[el]; for (let q = 0; q < n; q++) {
        const [px, py] = planetPos(el, q, n), x = X(px), y = Y(py);
        c.globalCompositeOperation = 'lighter'; g = c.createRadialGradient(x, y, 0, x, y, 40); g.addColorStop(0, rgba(PL[el].col, .5)); g.addColorStop(1, rgba(PL[el].col, 0)); c.fillStyle = g; c.fillRect(x - 40, y - 40, 80, 80);
        c.globalCompositeOperation = 'source-over'; c.fillStyle = PL[el].col; c.beginPath(); c.arc(x, y, Math.max(6, 17 * k), 0, TAU); c.fill();
      }
    });
    if (!D) return;
    for (const e of D.en) {
      const x = X(e.x), y = Y(e.y), s = Math.max(6, e.t.s * k * 1.4);
      c.save(); c.translate(x, y); c.rotate(e.a + Math.PI);
      c.fillStyle = '#0a0d1a'; c.strokeStyle = e.slow > 0 ? '#7fc3ff' : e.burn > 0 ? '#ffb347' : e.t.col; c.lineWidth = 2; c.beginPath(); c.moveTo(s, 0); c.lineTo(-s * .8, s * .75); c.lineTo(-s * .4, 0); c.lineTo(-s * .8, -s * .75); c.closePath(); c.fill(); c.stroke(); c.restore();
      if (e.hp < e.max) { c.fillStyle = 'rgba(255,122,106,.85)'; c.fillRect(x - s, y + s + 4, 2 * s * Math.max(0, e.hp) / e.max, 2); }
    }
    c.globalCompositeOperation = 'lighter';
    for (const b of beams) { c.strokeStyle = `rgba(255,90,80,${.8 * (1 - b.t / .25)})`; c.lineWidth = 2; c.beginPath(); c.moveTo(X(b.x), Y(b.y)); c.lineTo(cx, cy); c.stroke(); }
    for (const s of shots) { c.fillStyle = s.P.col; c.beginPath(); c.arc(X(s.x), Y(s.y), s.el === 'earth' ? 5 : 3, 0, TAU); c.fill(); }
    for (const f of fx) { c.strokeStyle = rgba(f.col, 1 - f.t / f.life); c.lineWidth = 2; c.beginPath(); c.arc(X(f.x), Y(f.y), f.r * k * (.4 + f.t / f.life), 0, TAU); c.stroke(); }
    c.globalCompositeOperation = 'source-over';
    const bw = Math.min(360, W * .5);
    c.fillStyle = 'rgba(190,205,255,.15)'; c.fillRect(cx - bw / 2, 18, bw, 8); c.fillStyle = D.hp / D.max > .4 ? '#9fe8c0' : '#ff7a6a'; c.fillRect(cx - bw / 2, 18, bw * D.hp / D.max, 8);
    c.fillStyle = '#e9eefc'; c.font = '17px "Times New Roman",serif'; c.textAlign = 'center';
    c.fillText(D.over ? (D.res && D.res.win ? 'The invasion is beaten' : 'The star has fallen') : `Invasion ${D.n + 1} · wave ${Math.min(D.wi, D.waves)} / ${D.waves}`, cx, 50);
  }
  function sideStar() {
    const st = S();
    let h = `<h4>Your star system</h4><p>Invasions beaten: <b>${st.wins} / ${NEED_WINS}</b> · lost: ${st.losses}</p>`;
    h += '<p id="sd-status" class="dim"></p><p>Star: <b id="sd-hp"></b></p>';
    h += '<p class="dim">Condense a star of an element to unlock its planet. Planets circle your star and shoot invaders; the invaders lock their orbit on the outer edge and fire on the star. Lose a battle and you lose resources, builds and planets.</p><hr>';
    IDS.forEach(el => {
      const P = PL[el], n = st.planets[el], un = st.unlocked[el];
      h += `<div class="pl"><b>${P.name}</b> (${el}) ${n} / ${PL_MAX}<small>${P.blurb} · damage ×${dmgMult(el).toFixed(1)} from your ${el} star</small>`;
      if (!un) h += '<small>Locked: condense a star of this element.</small>';
      else h += `<button type="button" data-act="planet" data-el="${el}" id="pb-${el}" ${n >= PL_MAX ? 'disabled' : ''}>${n >= PL_MAX ? 'Full orbit' : `Add a planet: ${FE.fmt(planetCost(el))} ${el}`}</button>`;
      h += '</div>';
    });
    if (st.wins >= NEED_WINS) h += '<p class="good">The world is saved. You may keep defending.</p>';
    return h;
  }
  function liveStar() {
    const st = S(), now = Date.now();
    text('sd-hp', `${Math.ceil(starHpNow())} / ${D ? D.max : starMax()}`);
    text('sd-status', D ? (D.over ? (D.res ? D.res.text : '') : `An invasion is under way: wave ${Math.min(D.wi, D.waves)} of ${D.waves}.`) : st.started ? `Next invasion in ${FE.clock(Math.max(0, Math.ceil((st.nextAt - now) / 1000)))}.` : 'No star yet. Condense a star in the sky to begin.');
    IDS.forEach(el => { const b = $('pb-' + el); if (b && st.planets[el] < PL_MAX) { const off = FE.state.els[el].count < planetCost(el); if (b.disabled !== off) b.disabled = off; } });
  }

  // ================================================================ input and the loop
  cvs.addEventListener('pointerdown', e => {
    const r = cvs.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
    if (C().path === 'conquest') { conquestClick(x, y); sideSig = ''; }
  });
  side.addEventListener('click', e => {
    const b = e.target.closest('button[data-act]'); if (!b || b.disabled) return;
    const a = b.dataset.act;
    if (a === 'invade') startFight(sel);
    else if (a === 'weapon') { if (FE.state.stardust >= weaponCost() && C().weapon < WEAPON_MAX) { FE.state.stardust -= weaponCost(); C().weapon++; FE.save(); FE.render(); } }
    else if (a === 'planet') { const el = b.dataset.el, c = planetCost(el); if (S().unlocked[el] && S().planets[el] < PL_MAX && FE.state.els[el].count >= c) { FE.state.els[el].count -= c; S().planets[el]++; FE.save(); FE.render(); } }
    sideSig = '';
  });
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.1, (now - last) / 1000); last = now; T += dt;
    if (eg.hidden) return;
    if (cvs.clientWidth !== W || cvs.clientHeight !== H) fit();
    if (!W) return;
    if (C().path === 'conquest') {
      drawGalaxy(); $('eg-title').textContent = 'The Galaxy'; text('eg-res', `army ${FE.fmt(armyCount())} · echoes ${FE.fmt(FE.state.stardust)}`);
      const html = sideConquest(); if (html !== sideSig) { sideSig = html; side.innerHTML = html; }
    } else {
      stepDef(dt); drawDef(); $('eg-title').textContent = 'Your Star System'; text('eg-res', `planets ${IDS.reduce((n, k) => n + S().planets[k], 0)}`);
      const html = sideStar(); if (html !== sideSig) { sideSig = html; side.innerHTML = html; }
      liveStar();
    }
  }

  // ================================================================ always running
  let lastT = performance.now();
  setInterval(() => {
    const t = performance.now(), dt = Math.min((t - lastT) / 1000, 3600); lastT = t;
    const s = FE.state; if (!s.cur) return;
    const c = C();
    if (c.path === 'conquest') {                                                    // every system you hold makes resources for the forest by itself
      const Fo = FE.forest && FE.forest.state && FE.forest.state();
      if (Fo && Fo.els) SYS.forEach((sy, i) => {
        if (!c.conq[i]) return;
        (sy.center ? IDS : [sy.el]).forEach(k => { Fo.els[k].count += (sy.yield + .1 * FE.forest.rate(k)) * dt; });
      });
      if (fight && !(FE.combat && FE.combat.active)) endFight();
    }
    if (c.path === 'forge') {
      unlockCheck();
      if (S().started && !D && Date.now() >= S().nextAt && !(FE.combat && FE.combat.active)) startInvasion();
      if (eg.hidden || document.hidden) stepDef(dt);
    }
    if (!c.got && s.cleared && s.cleared.reclaim3 && !(FE.combat && FE.combat.active)) { c.got = true; FE.save(); }
    if (c.got && !c.path && !asked && !FE.modalOpen && FE.view < 3 && !(FE.combat && FE.combat.active)) showChoice();
    scBtn.hidden = !(c.got && FE.view < 3 && eg.hidden && !FE.modalOpen && !(FE.combat && FE.combat.active) && !FE.collapsing && !fight);
    scBtn.textContent = c.path === 'conquest' ? 'Galaxy Map' : c.path === 'forge' ? (D && !D.over ? 'Invasion! Star System' : 'Star System') : 'Star Core';
    scBtn.classList.toggle('alert', !!(D && !D.over && eg.hidden));
  }, 100);
  FE.endgame = { C, SYS, HOME, HEART, mapFor, startInvasion, stepDef, def: () => D, planetCost, PL, open };
});
