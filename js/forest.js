/* forest.js - the new layer 1: a dark forest on a planet. The game now opens here, with nothing cosmic in sight.
 *   fire = a bonfire, water = a puddle, air = a steam vent, earth = dirt and rocks converging into a spot.
 * The higher the vessel's tier, the larger and more intense it is. "Collapse" is called "extinguish" here: put the vessel out
 * and take its crystals (the first crystal opens layer 2, the army).
 *
 * The old layer 1 (the star in outer space) is now LAYER 3, above the army. It keeps all of its own progress, quests, mini-games
 * and the endgame choice; it opens once the first map (Breach the Surface) is cleared (see l3Open). The forest keeps its own
 * progress in state.forest, so the two never share a count.
 *
 * Internally the old numbering is kept so that nothing else has to change: view 1 = the space page, 2 = the army, 3 = combat,
 * and the new forest is view 0. Vertically, from the bottom: forest (0), army (2), space (1). This file takes over FE.goto,
 * the wheel / swipe / arrow keys, and the layer links. Load it after ui.js and before controls.js. */
FE.module(function (FE) {
  const $ = FE.$, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const hs = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
  const ease = u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  const IDS = FE.ELEMENTS.map(e => e.id);

  // ---------------------------------------------------------------- state
  const blankEl = () => ({ count: 0, tier: 0, up: { res: 0, gath: 0, harm: 0, eng: 0 } });
  const blank = () => ({ cur: null, seen: {}, els: Object.fromEntries(IDS.map(k => [k, blankEl()])), l3: false, l3seen: false, ext: 0 });
  const oldFresh = FE.freshState;
  FE.freshState = () => Object.assign(oldFresh(), { forest: blank() });
  if (!FE.state.forest) FE.state.forest = blank();
  const F = () => FE.state.forest, fe = k => F().els[k || F().cur];

  // ---------------------------------------------------------------- numbers
  const TIER_COST = [1500, 60000, 2500000], MAX_T = 3, EXT_MIN = 2;           // what a vessel costs to grow; the lowest tier that can be extinguished
  const tierCost = t => t >= MAX_T ? null : TIER_COST[t];
  const yieldOf = t => (t >= 3 ? 3 : 1) * (FE.has('dbl') ? 2 : 1);              // crystals an extinguished vessel gives
  const mult = k => Math.pow(FE.STAR_MULT, fe(k).tier) * Math.pow(1.5, fe(k).up.harm) * (FE.has('prod') ? 2 : 1);
  const rate = k => (fe(k).up.gath * FE.GATHER_RATE + fe(k).up.eng * FE.ENGINE_RATE) * mult(k);
  const clickGain = () => Math.pow(FE.CLICK_GROWTH, fe().up.res) * mult(F().cur);
  const upCost = b => Math.ceil(FE.UPS[b].base * Math.pow(FE.UPS[b].grow, fe().up[b]));
  const BUILDS = ['res', 'gath', 'harm', 'eng'];
  const VNAME = { fire: ['small fire', 'campfire', 'bonfire', 'roaring pyre'], water: ['puddle', 'pool', 'pond', 'spring'],
                  air: ['steam vent', 'hot vent', 'geyser', 'great geyser'], earth: ['dirt patch', 'mound', 'cairn', 'stone heap'] };
  const VERB = { fire: 'Feed the fire', water: 'Deepen the pool', air: 'Widen the vent', earth: 'Heap the cairn' };
  const NAMES = { air: { gath: 'draft', eng: 'chimney' }, water: { gath: 'trickle', eng: 'spring' }, earth: { gath: 'digger', eng: 'quarry' }, fire: { gath: 'ember', eng: 'bellows' } };
  const INTRO = { fire: 'The forest is dark and cold. Rake the embers.', water: 'The forest is dark. Rainwater has pooled in a hollow.',
                  air: 'The forest is dark. Steam seeps from a crack in the cold ground.', earth: 'The forest is dark. Loose dirt and stones are creeping toward one spot.' };
  const l3Open = () => !!((FE.state.cleared && FE.state.cleared.breach) || F().l3);       // the old star layer (layer 3) opens with the first cleared map
  FE.forestLayer3Open = l3Open;
  const busy = () => FE.collapsing || FE.modalOpen;

  // ---------------------------------------------------------------- page and styles
  const css = document.createElement('style');
  css.textContent = `
#pageF{display:grid;grid-template-rows:auto minmax(0,1fr);padding:30px 24px 48px;background:#02030a;color:#e9eefc}
#pageF[data-el="air"]{--c:var(--air-ink)}#pageF[data-el="water"]{--c:var(--water-ink)}#pageF[data-el="earth"]{--c:var(--earth-ink)}#pageF[data-el="fire"]{--c:var(--fire-ink)}
#fz-bg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
#fz-btn{position:absolute;left:50%;top:60%;transform:translate(-50%,-50%);padding:0;border:0;border-radius:50%;background:transparent;cursor:pointer;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
#fz-btn:focus-visible{outline:2px solid #fff;outline-offset:3px}
#fz-cond{position:absolute;left:50%;top:80%;transform:translateX(-50%);width:min(440px,var(--free,440px));text-align:center;z-index:2;pointer-events:auto}
.fz-bar{height:5px;border:1px solid var(--c,#fff);margin:6px 0 10px;overflow:hidden}.fz-bar>i{display:block;height:100%;width:0;background:var(--c,#fff);transition:width .2s ease}
#fz-info{font-size:.875em;color:#aab4d8;font-variant-numeric:tabular-nums}
#pageF .game-title{text-shadow:0 0 18px rgba(0,0,0,.8)}#pageF .goal{color:#b8c2e2;text-shadow:0 0 10px rgba(0,0,0,.9)}#pageF .goal.ready{color:#fff}
#pageF .tab,#pageF .box,#pageF .upgrades,#pageF .store{background:rgba(8,11,20,.88)}#pageF .card{background:rgba(8,11,20,.9)}
#nav-up{display:none!important}
#pages[data-view="0"] #page2{transform:translateY(-100%)}#pages[data-view="0"] #page1{transform:translateY(-200%)}
#pages[data-view="2"] #pageF{transform:translateY(100%)}#pages[data-view="2"] #page1{transform:translateY(-100%)}
#pages[data-view="1"] #pageF{transform:translateY(200%)}#pages[data-view="1"] #page2{transform:translateY(100%)}#pages[data-view="1"] #page1{transform:none}
#pages[data-view="3"] #pageF{transform:translateY(100%)}#pages[data-view="3"] #page1{transform:translateY(-100%)}
@media (max-width:860px){#pageF{overflow-y:auto;grid-template-rows:auto auto auto}}`;
  document.head.appendChild(css);

  const page = document.createElement('section');
  page.className = 'page'; page.id = 'pageF'; page.setAttribute('aria-label', 'layer 1');
  page.innerHTML = `<canvas id="fz-bg" aria-hidden="true"></canvas>
    <header class="l1-top"><h1 class="game-title">Four Elements</h1><p class="goal" id="fz-goal" aria-live="polite"></p></header>
    <div class="l1-main">
      <nav class="tabs" id="fz-tabs" role="tablist" aria-label="elements"></nav>
      <div class="stage" id="fz-stage">
        <button id="fz-btn" type="button" aria-label="gather"></button>
        <div id="fz-cond"><div id="fz-info"></div><div class="fz-bar" aria-hidden="true"><i id="fz-fill"></i></div>
          <div class="cond-btns"><button class="el wide" id="fz-grow" type="button"></button><button class="el wide collapse" id="fz-ext" type="button" hidden></button></div></div>
      </div>
      <aside class="box upgrades" id="fz-ups"><span class="label">builds</span><div class="cards scroll" id="fz-cards"></div></aside>
    </div>
    <aside class="box store" id="fz-store"><span class="label">stores</span><div id="fz-rows"></div></aside>
    <button class="nav up" id="fz-up" type="button" aria-disabled="true">&#9650; layer 2</button>`;
  $('pages').insertBefore(page, $('pages').firstChild);
  const mkNav = (id, cls, html, parent) => { const b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = cls; b.innerHTML = html; b.hidden = true; parent.appendChild(b); return b; };
  const navL3 = mkNav('nav-l3', 'nav up unlocked', '&#9650; layer 3', $('page2'));        // the army: up to the stars
  const navL2 = mkNav('nav-l2', 'nav down', '&#9660; layer 2', $('page1'));               // the stars: down to the army
  FE.view = 0; $('pages').dataset.view = '0';

  const bg = $('fz-bg'), cx = bg.getContext('2d'), btn = $('fz-btn');
  const svg = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  IDS.forEach(id => {                                                                          // element tabs
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tab'; b.id = 'ftab-' + id; b.dataset.el = id; b.setAttribute('role', 'tab'); b.title = `${id} (${FE.ELEMENTS.find(x => x.id === id).key})`;
    b.innerHTML = `<span class="t-ico">${svg(FE.ICONS[id])}</span><span class="t-name">${id}</span><span class="t-mark" aria-hidden="true">&#9679;</span>`;
    b.addEventListener('click', () => switchEl(id));
    $('fz-tabs').appendChild(b);
  });
  BUILDS.forEach(b => {                                                                        // builds
    const c = document.createElement('button');
    c.type = 'button'; c.className = 'card'; c.id = 'fz-up-' + b; c.hidden = true;
    c.innerHTML = '<span class="card-title"></span><span class="card-cost"></span><span class="card-note"></span>';
    c.addEventListener('click', () => buy(b));
    $('fz-cards').appendChild(c);
  });
  IDS.forEach(id => {                                                                          // stores
    const r = document.createElement('div');
    r.className = 's-row'; r.dataset.el = id; r.id = 'fsrow-' + id;
    r.innerHTML = `<div class="s-main"><span class="s-ico">${svg(FE.ICONS[id])}</span><span class="s-name">${id}</span><span class="s-n" id="fsn-${id}">0</span></div>`
      + `<div class="s-more" id="fsm-${id}"><div class="s-line" id="fsr-${id}"></div><div class="s-line" id="fsc-${id}"></div><div class="s-line" id="fss-${id}"></div></div>`;
    $('fz-rows').appendChild(r);
  });

  // ---------------------------------------------------------------- the scene (drawn once per size) and the vessels (every frame)
  let dpr = 1, PW = 0, PH = 0, VX = 0, VY = 0, S0 = 1, scene = null, T = 0, kick = 0, flash = 0, vt = 0, last = performance.now(), lastBd = 0;
  const P = [], floats = [];

  function glow(c, x, y, r, col, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function pine(c, x, base, h, w) {
    c.beginPath();
    for (let t = 0; t < 4; t++) {
      const y0 = base - h + t * h * .22, y1 = y0 + h * .38, hw = w * (.3 + .2 * t);
      c.moveTo(x, y0); c.lineTo(x + hw, y1); c.lineTo(x - hw, y1); c.closePath();
    }
    c.fill();
    c.fillRect(x - w * .06, base - h * .12, w * .12, h * .14);
  }
  function buildScene() {
    scene = document.createElement('canvas'); scene.width = Math.round(PW * dpr); scene.height = Math.round(PH * dpr);
    const c = scene.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const hz = PH * .68;
    let g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#01020a'); g.addColorStop(.7, '#08122a'); g.addColorStop(1, '#13223e');
    c.fillStyle = g; c.fillRect(0, 0, PW, hz + 4);
    for (let i = 0; i < 170; i++) {                                                        // the sky is still full of stars: far away and quiet
      const z = .6 + 1.3 * Math.pow(hs(i, 4), 3);
      c.fillStyle = `rgba(255,255,255,${.25 + .6 * hs(i, 3)})`; c.fillRect(hs(i, 1) * PW, Math.pow(hs(i, 2), 1.4) * hz * .92, z, z);
    }
    const mx = PW * .8, my = PH * .15, mr = Math.max(14, Math.min(PW, PH) * .04);        // a moon
    glow(c, mx, my, mr * 6, '#bcd2ff', .22);
    c.fillStyle = '#e9efff'; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
    c.fillStyle = 'rgba(120,140,190,.35)';
    [[-.3, -.2, .25], [.25, .15, .18], [-.1, .4, .12]].forEach(([a, b, r]) => { c.beginPath(); c.arc(mx + a * mr, my + b * mr, r * mr, 0, TAU); c.fill(); });
    g = c.createLinearGradient(0, hz - PH * .14, 0, hz + PH * .02); g.addColorStop(0, 'rgba(60,90,140,0)'); g.addColorStop(1, 'rgba(60,90,140,.28)');
    c.fillStyle = g; c.fillRect(0, hz - PH * .14, PW, PH * .16);
    [{ base: .66, h: .17, col: '#07101e', sp: 30 }, { base: .71, h: .23, col: '#050b16', sp: 44 }].forEach((r, L) => {   // two rows of trees behind the clearing
      c.fillStyle = r.col;
      for (let x = -20, i = 0; x < PW + 40; x += r.sp * (.7 + .6 * hs(i, 11 + L)), i++) {
        const h = PH * r.h * (.6 + .7 * hs(i, 3 + L));
        pine(c, x, PH * r.base, h, h * (.36 + .1 * hs(i, 5)));
      }
      c.fillRect(0, PH * r.base, PW, PH * .08);
    });
    g = c.createLinearGradient(0, PH * .7, 0, PH); g.addColorStop(0, '#0b1712'); g.addColorStop(.35, '#06100c'); g.addColorStop(1, '#010203');   // the forest floor
    c.fillStyle = g; c.fillRect(0, PH * .7, PW, PH * .3);
    for (let i = 0; i < 420; i++) {                                                        // grass and fallen needles
      const x = hs(i, 21) * PW, y = PH * (.72 + .27 * hs(i, 22)), l = 3 + 7 * hs(i, 23);
      c.strokeStyle = `rgba(70,110,80,${.08 + .12 * hs(i, 24)})`; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (hs(i, 25) - .5) * 5, y - l); c.stroke();
    }
    c.fillStyle = '#010204';                                                               // near trunks and boughs frame both sides
    [[-.02, 1], [.05, .85], [.11, .68], [.9, .9], [.96, 1], [1.02, .78]].forEach(([fx, k]) => { const h = PH * .85 * k; pine(c, fx * PW, PH * 1.04, h, h * .34); });
  }

  // vessels, designed around a radius of 84 units and centred on the origin
  function bonfire(c, I, k, tier) {
    glow(c, 0, 8, 150 * I, '#ff8a3d', .3 + .08 * Math.sin(T * 9));
    for (const s of [-1, 1]) {                                                    // two crossed logs, glowing at the ends
      c.save(); c.translate(0, 38); c.rotate(s * .38); c.fillStyle = '#4a2f1a'; c.strokeStyle = '#24160b'; c.lineWidth = 2;
      c.fillRect(-54, -8, 108, 16); c.strokeRect(-54, -8, 108, 16);
      c.fillStyle = rgba('#ff8a3d', .55 + .25 * Math.sin(T * 6 + s)); c.fillRect(-54, -8, 14, 16); c.fillRect(40, -8, 14, 16);
      c.restore();
    }
    c.globalCompositeOperation = 'lighter';
    const n = 5 + Math.round(I * 2);
    [['#f2683a', 1, .85], ['#ffb347', .68, .9], ['#fff6c0', .38, .95]].forEach(([col, kk, al]) => {
      c.fillStyle = rgba(col, al);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1) - .5) * 74, h = (30 + 52 * hs(i, 1)) * I * (.75 + .25 * Math.sin(T * (5 + 4 * hs(i, 2)) + i)) * (1 + .35 * k) * kk, w = 14 * I * kk, sw = Math.sin(T * 3 + i * 2) * 8 * kk, b = 38;
        c.beginPath(); c.moveTo(x - w, b); c.quadraticCurveTo(x - w * .6, b - h * .5, x + sw, b - h); c.quadraticCurveTo(x + w * .6, b - h * .5, x + w, b); c.fill();
      }
    });
    for (let i = 0; i < 8 + tier * 4; i++) {                                      // embers rising
      const u = (T * .5 + hs(i, 1)) % 1, x = Math.sin(i * 3 + u * 5) * 28 + (hs(i, 2) - .5) * 56, y = 32 - u * 130 * I;
      c.fillStyle = rgba('#ffd36b', 1 - u); c.beginPath(); c.arc(x, y, 1.7 * (1 - u * .5), 0, TAU); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }
  function puddle(c, I, k, tier) {
    c.save(); c.translate(0, 28);
    glow(c, 0, 0, 130 * I, '#3fa0ff', .16);
    const g = c.createRadialGradient(-24, -10, 4, 0, 0, 104); g.addColorStop(0, '#a8ecff'); g.addColorStop(.45, '#4a97e8'); g.addColorStop(1, '#1c5aae');
    c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 100, 44, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba('#d9f1ff', .55); c.lineWidth = 2; c.stroke();
    c.save(); c.beginPath(); c.ellipse(0, 0, 98, 42, 0, 0, TAU); c.clip();
    c.strokeStyle = rgba('#ffffff', .3); c.lineWidth = 2;                         // sky glints
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-40 + i * 26, -18 + (i % 2) * 10, 16, 3.6, 5.2 + .2 * Math.sin(T + i)); c.stroke(); }
    c.restore();
    const n = 3 + tier;
    for (let i = 0; i < n; i++) {                                                 // ripples spreading out
      const u = (T * .35 + i / n) % 1, r = 8 + 88 * u;
      c.strokeStyle = rgba('#e8f8ff', .6 * (1 - u)); c.lineWidth = 1.8; c.beginPath(); c.ellipse(0, 0, r, r * .44, 0, 0, TAU); c.stroke();
    }
    if (k > .02) { c.strokeStyle = rgba('#ffffff', .9 * k); c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, 30 + 66 * (1 - k), (30 + 66 * (1 - k)) * .44, 0, 0, TAU); c.stroke(); }
    const q = (T * .9) % 1, id = Math.floor(T * .9);                              // a drop falls in now and then
    if (q < .8) { const dy = -110 + 110 * (q / .8) * (q / .8), dx = Math.sin(id * 7.3) * 34; c.fillStyle = '#bfe8ff'; c.beginPath(); c.arc(dx, dy, 3.6, 0, TAU); c.fill(); }
    for (let i = 0; i < tier * 2; i++) {                                          // bubbles rising from the deep
      const u = (T * .3 + hs(i, 1)) % 1, x = (hs(i, 2) - .5) * 120, y = 10 - u * 80 * I;
      c.strokeStyle = rgba('#d9f1ff', .7 * (1 - u)); c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, 2 + 3 * hs(i, 3), 0, TAU); c.stroke();
    }
    c.restore();
  }
  function steamVent(c, I, k, tier) {
    c.save(); c.translate(0, 44);
    c.fillStyle = '#2b3342'; c.strokeStyle = '#4b566c'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 66, 23, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#05070d'; c.beginPath(); c.ellipse(0, 2, 50, 16, 0, 0, TAU); c.fill();
    c.save(); c.beginPath(); c.ellipse(0, 2, 50, 16, 0, 0, TAU); c.clip();
    c.strokeStyle = '#5b6784'; c.lineWidth = 2;
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 15, -14); c.lineTo(i * 15, 18); c.stroke(); }
    c.restore();
    glow(c, 0, -4, 70 * I, '#bfe3f2', .35 + .15 * k);
    c.globalCompositeOperation = 'lighter';
    const N = Math.round(14 * I) + Math.round(8 * k);
    for (let i = 0; i < N; i++) {                                                 // billows of steam
      const u = (T * .32 * (1 + .2 * I) + i / N) % 1, y = -6 - u * 150 * I, x = Math.sin(u * 7 + i * 1.9) * (8 + 36 * u), r = 14 + 40 * u, a = Math.min(1, u * 5) * (1 - u) * .5;
      glow(c, x, y, r, '#e6f6ff', a);
    }
    c.globalCompositeOperation = 'source-over';
    c.restore();
  }
  function rockPile(c, I, k, tier) {
    c.save(); c.translate(0, 38);
    glow(c, 0, -10, 120 * I, '#e0a74f', .12);
    const g = c.createLinearGradient(0, -44, 0, 12); g.addColorStop(0, '#b9884f'); g.addColorStop(1, '#4a2f1a');
    c.fillStyle = g; c.strokeStyle = '#3a2614'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-96, 12); c.quadraticCurveTo(-70, -8, -30, -26); c.quadraticCurveTo(0, -46 - 6 * I, 34, -24); c.quadraticCurveTo(70, -8, 96, 12); c.closePath(); c.fill(); c.stroke();
    const rock = (x, y, r, seed, rot, shade) => {
      c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = shade; c.strokeStyle = '#3a2614'; c.lineWidth = 1.2; c.beginPath();
      for (let v = 0; v < 6; v++) { const a = v / 6 * TAU, kk = .72 + .45 * hs(seed + v, 3); v ? c.lineTo(Math.cos(a) * r * kk, Math.sin(a) * r * kk) : c.moveTo(Math.cos(a) * r * kk, Math.sin(a) * r * kk); }
      c.closePath(); c.fill(); c.stroke(); c.restore();
    };
    const pile = 6 + Math.round(4 * I);
    for (let i = 0; i < pile; i++) rock((hs(i, 1) - .5) * 120, 6 - hs(i, 2) * 34 * (1 - Math.abs(hs(i, 1) - .5)), 8 + 11 * hs(i, 3), i * 3, hs(i, 4) * TAU, i % 2 ? '#8a6a4f' : '#a58157');
    const M = 9 + tier * 3;
    for (let i = 0; i < M; i++) {                                                 // loose earth and stone drawn in from far off
      const u = (T * .1 + hs(i, 4)) % 1, e = u * u, d = lerp(250, 36, e), a = hs(i, 5) * TAU + u * 1.5, al = Math.min(1, u * 6) * (1 - Math.max(0, u - .9) * 10);
      c.globalAlpha = al; rock(Math.cos(a) * d, Math.sin(a) * d * .35 - (1 - e) * 20, 3 + 5 * hs(i, 6) * (1 - .5 * u), i * 5, u * 8, '#9c7a4e');
    }
    c.globalAlpha = 1;
    if (k > .05) { c.strokeStyle = rgba('#ffd36b', k * .8); c.lineWidth = 2; c.beginPath(); c.ellipse(0, -8, 40 + 60 * (1 - k), 14 + 20 * (1 - k), 0, 0, TAU); c.stroke(); }
    c.restore();
  }
  const VESSEL = { fire: bonfire, water: puddle, air: steamVent, earth: rockPile };

  // ---------------------------------------------------------------- size and layout
  function layout() {
    const narrow = matchMedia('(max-width: 860px)').matches;
    let size;
    if (narrow) size = Math.min(440, PW * .92, PH * .5);
    else {
      const pr = page.getBoundingClientRect(), tr = $('fz-tabs').getBoundingClientRect(), ur = $('fz-ups').getBoundingClientRect();
      const half = Math.max(60, Math.min(PW / 2 - (tr.right - pr.left), (ur.left - pr.left) - PW / 2));
      size = Math.min(560, PH * .56, half * 2 * 1.2);
      page.style.setProperty('--free', Math.max(240, Math.min(440, half * 2 - 8)) + 'px');
    }
    S0 = Math.max(.42, size / 560) * 1.1;
    VX = PW / 2; VY = PH * .6;
  }
  function size() {
    const w = page.clientWidth, h = page.clientHeight;
    if (!w || !h) return false;
    dpr = Math.min(1.5, devicePixelRatio || 1);
    if (w !== PW || h !== PH) { PW = w; PH = h; bg.width = Math.round(PW * dpr); bg.height = Math.round(PH * dpr); buildScene(); layout(); }
    return true;
  }
  if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(() => { if (PW) layout(); }); ro.observe($('fz-tabs')); ro.observe($('fz-ups')); }
  addEventListener('resize', () => { if (PW) { size(); layout(); } });

  // ---------------------------------------------------------------- extinguishing: the vessel dies down, smoke rises, crystals are left
  let ex = null, extArmed = 0;
  const T1 = 1.5;
  function applyExt() {
    const s = FE.state, f = F(), el = f.cur, e = fe(), n = yieldOf(e.tier), first = !s.layer2;
    s.crystals[el] += n; s.layer2 = true; f.els[el] = blankEl(); f.ext++; vt = 0;
    FE.save();
    return { n, first, el };
  }
  function finishExt() {
    const r = ex.res, s = FE.state;
    FE.collapsing = false; ex = null;
    FE.toast(r.first ? `${r.n === 1 ? 'A' : r.n} ${r.el} crystal${r.n === 1 ? '' : 's'} extracted. Layer 2 is above: scroll up or use the arrow to reach it.`
                     : `${r.n === 1 ? 'A' : r.n} ${r.el} crystal${r.n === 1 ? '' : 's'} extracted (${s.crystals[r.el]} in all).`, 5600);
    FE.save(); renderForest();
    if (r.first) FE.goto(2);
  }
  function extinguish() {
    const e = fe(); if (busy() || ex || e.tier < EXT_MIN) return;
    if (!(extArmed && Date.now() < extArmed)) { extArmed = Date.now() + 4000; renderForest(); setTimeout(renderForest, 4100); return; }
    extArmed = 0; ex = { t: 0, applied: false, res: null }; FE.collapsing = true; renderForest();
  }

  // ---------------------------------------------------------------- one frame
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (FE.view !== 0 || document.hidden || !F().cur || !size()) return;
    T += dt; kick = Math.max(0, kick - dt * 4); flash = Math.max(0, flash - dt * 1.4);
    const el = F().cur, e = fe();
    let exA = 1, dim = 0;
    if (ex) {
      ex.t += dt;
      if (ex.t < T1) {
        exA = 1 - ease(ex.t / T1); dim = Math.sin(Math.PI * ex.t / T1 * .5);
        for (let i = 0; i < 2 && P.length < 300; i++) P.push({ type: 'smoke', x: VX + rand(-30, 30) * S0, y: VY + rand(-20, 20) * S0, vx: rand(-10, 10), vy: -rand(26, 60), t: 0, life: rand(1.6, 2.6), r: rand(20, 44) * S0 * (1 + .2 * vt) });
      } else {
        if (!ex.applied) {
          ex.applied = true; ex.res = applyExt();
          for (let i = 0; i < Math.min(ex.res.n, 6); i++) P.push({ type: 'crystal', col: ex.res.el, x: VX + (i - (Math.min(ex.res.n, 6) - 1) / 2) * 38 * S0, y: VY - 10 * S0, vx: 0, vy: -46, t: 0, life: 2.6, seed: i });
        }
        exA = clamp((ex.t - T1 - .5) / 1.0, 0, 1); dim = Math.max(0, 1 - (ex.t - T1) / 1.2) * .6;
        if (ex.t > T1 + 1.6) finishExt();
      }
    } else vt += (e.tier - vt) * Math.min(1, dt * 3);
    const tier = Math.round(vt), I = 1 + vt * .38, sz = S0 * (1 + .22 * vt);

    const c = cx, p = FE.PAL[el];
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, PW, PH);
    c.drawImage(scene, 0, 0, PW, PH);
    for (let i = 0; i < 50; i++) {                                                           // a few stars twinkle
      const a = .35 + .55 * Math.sin(T * (.6 + 2 * hs(i, 6)) + i * 3) * .5 + .3;
      c.fillStyle = `rgba(255,255,255,${clamp(a, 0, 1) * .55})`; c.fillRect(hs(i * 3, 1) * PW, Math.pow(hs(i * 3, 2), 1.4) * PH * .62 * .92, 1.6, 1.6);
    }
    c.globalCompositeOperation = 'lighter';                                                  // fireflies, and the vessel's light on the clearing
    for (let i = 0; i < 14; i++) {
      const x = hs(i, 41) * PW + Math.sin(T * .35 + i * 5) * 40, y = PH * (.55 + .4 * hs(i, 42)) + Math.cos(T * .4 + i * 3) * 18, a = Math.pow(Math.max(0, Math.sin(T * 1.2 + i * 2)), 3) * .8;
      if (a > .02) glow(c, x, y, 8, '#d8ff8a', a);
    }
    glow(c, VX, VY + 50 * sz, 300 * sz * (1 + .25 * vt), p.glow, (.1 + .035 * vt) * exA + .05 * flash);
    c.globalCompositeOperation = 'source-over';

    if (exA > .01) {                                                                         // the vessel
      c.save(); c.globalAlpha = exA; c.translate(VX, VY); c.scale(sz * (1 + .05 * kick), sz * (1 + .05 * kick));
      VESSEL[el](c, I * (ex && !ex.applied ? Math.max(.25, exA) : 1), kick, tier);
      c.restore();
    }
    const cost = tierCost(e.tier), ready = !ex && cost != null && e.count >= cost;
    if (ready) {                                                                             // brimming: a pulsing ring and glints, the sign that it can grow
      const pu = .5 + .5 * Math.sin(T * 3.2), R = 104 * sz * (1 + .04 * pu);
      c.save(); c.translate(VX, VY + 8 * sz); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = rgba(p.glow, .25 + .3 * pu); c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, R, R * .8, 0, 0, TAU); c.stroke();
      for (let i = 0; i < 6; i++) { const a = T * .9 + i * TAU / 6, x = Math.cos(a) * R, y = Math.sin(a) * R * .8, s = 4 + 3 * Math.sin(T * 5 + i * 2); c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(x - s / 2, y - .6, s, 1.2); c.fillRect(x - .6, y - s / 2, 1.2, s); }
      c.restore();
    }
    if (flash > .01) { c.save(); c.globalCompositeOperation = 'lighter'; glow(c, VX, VY, 260 * sz, '#ffffff', .6 * flash); c.strokeStyle = rgba(p.glow, .8 * flash); c.lineWidth = 5 * flash + 1; c.beginPath(); c.arc(VX, VY, 110 * sz * (1 + 1.6 * (1 - flash)), 0, TAU); c.stroke(); c.restore(); }

    for (let i = P.length - 1; i >= 0; i--) {                                                // smoke, sparks, crystals
      const q = P[i]; q.t += dt; if (q.t >= q.life) { P.splice(i, 1); continue; }
      const u = q.t / q.life; q.x += q.vx * dt; q.y += q.vy * dt; if (q.g) q.vy += q.g * dt;
      if (q.type === 'smoke') glow(c, q.x, q.y, q.r * (1 + u), '#8c96ad', .3 * (1 - u));
      else if (q.type === 'crystal') {
        const cp = FE.PAL[q.col], x = q.x + Math.sin(q.t * 3 + q.seed) * 8, s = 13 * S0 * (1 + .2 * Math.sin(q.t * 6)), a = Math.min(1, u * 6) * (1 - Math.max(0, u - .7) / .3);
        c.save(); c.globalAlpha = a; c.globalCompositeOperation = 'lighter'; glow(c, x, q.y, s * 3, cp.glow, .6);
        c.globalCompositeOperation = 'source-over'; c.fillStyle = cp.core; c.strokeStyle = '#fff'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(x, q.y - s); c.lineTo(x + s * .6, q.y); c.lineTo(x, q.y + s); c.lineTo(x - s * .6, q.y); c.closePath(); c.fill(); c.stroke(); c.restore();
      } else { c.fillStyle = rgba(q.col, 1 - u); c.beginPath(); c.arc(q.x, q.y, q.r * (1 - u * .4), 0, TAU); c.fill(); }
    }
    c.font = '600 22px "Times New Roman", serif'; c.textAlign = 'center';
    for (let i = floats.length - 1; i >= 0; i--) {                                           // the numbers a click gives
      const f = floats[i]; f.t += dt; if (f.t > 1) { floats.splice(i, 1); continue; }
      c.globalAlpha = 1 - f.t * f.t; c.fillStyle = '#ffffff'; c.fillText('+' + f.text, f.x, f.y - 46 * (1 - Math.pow(1 - f.t, 3))); c.globalAlpha = 1;
    }
    if (dim > .01) { c.fillStyle = `rgba(0,0,8,${.5 * dim})`; c.fillRect(0, 0, PW, PH); }

    const bd = Math.round(2 * 96 * sz + 8);                                                  // the clickable disc follows the vessel
    if (bd !== lastBd) { lastBd = bd; btn.style.width = btn.style.height = bd + 'px'; }
    const L = VX + 'px', Tp = (VY - 10 * sz) + 'px';
    if (btn.style.left !== L) btn.style.left = L;
    if (btn.style.top !== Tp) btn.style.top = Tp;
    const cd = $('fz-cond'), ct = (VY + 78 * sz + 6) + 'px';
    if (cd.style.top !== ct) cd.style.top = ct;
  }

  // ---------------------------------------------------------------- what the player does
  function gather(x, y) {
    if (FE.view !== 0 || busy() || ex || !F().cur) return;
    const g = clickGain(), el = F().cur;
    fe().count += g; kick = 1;
    if (x == null) { x = VX; y = VY - 30 * S0; }
    floats.push({ x: x + rand(-10, 10), y: y - 10, t: 0, text: FE.fmt(g) });
    const col = FE.PAL[el].glow, up = el === 'fire' || el === 'air';
    for (let i = 0; i < 3 && P.length < 300; i++) P.push({ type: 'spark', col, x: VX + rand(-30, 30) * S0, y: VY + 20 * S0, vx: rand(-40, 40), vy: -rand(60, 140), g: up ? -30 : 300, t: 0, life: rand(.4, .8), r: rand(1.5, 3) });
    renderForest();
  }
  function grow() {
    const e = fe(), cost = tierCost(e.tier);
    if (busy() || ex || cost == null || e.count < cost) return;
    e.count -= cost; e.tier++; flash = 1; kick = 1;
    FE.save(); renderForest();
  }
  function buy(b) {
    const e = fe(), c = upCost(b);
    if (busy() || ex || e.count < c) return;
    e.count -= c; e.up[b]++;
    FE.save(); renderForest();
  }
  function switchEl(id) {
    if (busy() || ex || id === F().cur || !IDS.includes(id)) return;
    F().cur = id; extArmed = 0; vt = fe().tier; floats.length = 0; P.length = 0;
    FE.save(); renderForest();
  }
  FE.forest = { state: F, gather, grow, buy, switchEl, extinguish, rate, clickGain };

  // the round disc over the vessel: a click gathers; holding the mouse clicks ten times a second
  let hold = null, hx = 0, hy = 0;
  const aim = e => { const r = bg.getBoundingClientRect(); hx = e.clientX - r.left; hy = e.clientY - r.top; };
  const stopHold = () => { clearInterval(hold); hold = null; };
  btn.addEventListener('pointerdown', e => { if (e.button) return; aim(e); gather(hx, hy); stopHold(); hold = setInterval(() => gather(hx, hy), FE.HOLD_MS); });
  btn.addEventListener('pointermove', e => { if (hold) aim(e); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => btn.addEventListener(t, stopHold));
  addEventListener('blur', stopHold); document.addEventListener('visibilitychange', stopHold);
  btn.addEventListener('click', e => { if (e.detail === 0) gather(); });
  $('fz-grow').addEventListener('click', grow);
  $('fz-ext').addEventListener('click', extinguish);
  $('fz-up').addEventListener('click', () => FE.goto(2));

  // ---------------------------------------------------------------- the words and numbers on the page
  const cache = new WeakMap();
  const put = (el, html) => { if (cache.get(el) !== html) { cache.set(el, html); el.innerHTML = html; } };
  const txt = (el, t) => { if (el.textContent !== t) el.textContent = t; };

  function goalText() {
    const el = F().cur, e = fe(), cost = tierCost(e.tier), noun = VNAME[el][e.tier];
    if (cost != null && e.count >= cost) return `Lo! The ${el} gathers. ${VERB[el]}, noble one, and the ${noun} will grow.`;
    if (!e.tier && e.count < 25 && !e.up.gath && !e.up.res) return INTRO[el];
    if (cost == null) return `the ${noun} burns as large as it can. extinguish it to take its crystals.`;
    return `gather ${FE.fmt(cost)} ${el} to ${VERB[el].toLowerCase()}: ${FE.fmt(e.count)} / ${FE.fmt(cost)}.${e.tier >= EXT_MIN ? ' or extinguish it for crystals.' : ''}`;
  }
  function renderForest() {
    const f = F();
    if (!f.cur) { if (FE.state.cur) f.cur = FE.state.cur; else return; }
    const s = FE.state, el = f.cur, e = fe(), cost = tierCost(e.tier), ready = cost != null && e.count >= cost, noun = VNAME[el][e.tier];
    page.dataset.el = el;
    const g = $('fz-goal'); txt(g, goalText()); g.classList.toggle('ready', ready);
    IDS.forEach(id => {                                                                        // tabs and stores
      const t = $('ftab-' + id), on = id === el;
      t.classList.toggle('active', on); t.setAttribute('aria-selected', String(on));
      txt($('fsn-' + id), FE.fmt(f.els[id].count)); $('fsrow-' + id).classList.toggle('cur', on); $('fsm-' + id).hidden = !on;
    });
    txt($('fsr-' + el), `+${FE.fmt(rate(el))}/s`); txt($('fsc-' + el), `click: +${FE.fmt(clickGain())}`);
    txt($('fss-' + el), `${noun} · tier ${e.tier} · production ×${(mult(el)).toFixed(1)}`);
    txt($('fz-info'), cost == null ? `${noun} · tier ${e.tier}, as large as it gets` : `${noun}: ${FE.fmt(e.count)} / ${FE.fmt(cost)} ${el}`);
    $('fz-fill').style.width = (cost == null ? 100 : clamp(e.count / cost, 0, 1) * 100).toFixed(1) + '%';
    const gr = $('fz-grow'); gr.hidden = cost == null;
    if (cost != null) { txt(gr, `${VERB[el]}: ${FE.fmt(cost)} ${el}`); gr.disabled = !ready || busy() || !!ex; }
    const xb = $('fz-ext'), armed = extArmed && Date.now() < extArmed; xb.hidden = e.tier < EXT_MIN;
    if (!xb.hidden) { const yc = yieldOf(e.tier); xb.disabled = busy() || !!ex; xb.classList.toggle('armed', !!armed); txt(xb, armed ? 'click again: the vessel and all progress are lost' : `extinguish the ${noun}: +${yc} ${el} crystal${yc === 1 ? '' : 's'}`); }
    BUILDS.forEach(b => {                                                                      // builds
      const card = $('fz-up-' + b), u = FE.UPS[b], c = upCost(b), key = el + '.' + b;
      if (e.count >= u.show || f.seen[key]) f.seen[key] = true;
      card.hidden = !f.seen[key]; if (card.hidden) return;
      const [title, price, note] = card.children, n = e.up[b];
      let t, d;
      if (b === 'res') { t = 'tending'; d = `click power ${FE.fmt(Math.pow(FE.CLICK_GROWTH, n))} → ${FE.fmt(Math.pow(FE.CLICK_GROWTH, n + 1))}`; }
      else if (b === 'gath') { t = NAMES[el].gath; d = `+${FE.GATHER_RATE}/s each`; }
      else if (b === 'eng') { t = NAMES[el].eng; d = `+${FE.ENGINE_RATE}/s each`; }
      else { t = 'harmony'; d = 'all production ×1.5'; }
      put(title, t + (n ? ` ×${n}` : '')); put(price, `<span class="${e.count >= c ? 'have' : ''}">${FE.fmt(e.count)} / ${FE.fmt(c)}</span> ${el}`); put(note, d);
      card.disabled = e.count < c || busy() || !!ex;
    });
    const up = $('fz-up'); up.hidden = FE.view !== 0; up.classList.toggle('unlocked', s.layer2); up.setAttribute('aria-disabled', String(!s.layer2));
  }

  // the old star layer, now layer 3: its goal line used to say "Layer 2: Raise an Army" whenever layer 2 was open, which would
  // hide the star's own goal for good. ui.js only rewrites the line when its text changes, so we overwrite it here.
  function fixStarGoal() {
    const e = FE.E(), el = FE.el(), cost = FE.nextStarCost(), ready = cost != null && !e.exo && !e.strange && e.count >= cost;
    if (!el || ready || e.exo || e.strange) return;
    const have = cost != null && e.count >= cost ? 'ready.' : cost != null ? `${FE.fmt(e.count)} / ${FE.fmt(cost)}.` : '';
    const t = cost == null ? 'your star is as large as it can grow. collapse it for crystals.'
      : e.tier === 0 ? `gather ${FE.fmt(cost)} ${el} and condense it into a star: ${have}`
      : `condense a tier ${e.tier + 1} star: ${have}${e.tier >= FE.COLLAPSE_TIER ? ' or collapse this one.' : ''}`;
    txt($('goal'), t);
  }
  const oldRender = FE.render;
  FE.render = function () {
    oldRender();
    renderForest();
    navL3.hidden = FE.view !== 2 || !l3Open();
    navL2.hidden = FE.view !== 1;
    if (FE.view === 1) fixStarGoal();
  };

  // ---------------------------------------------------------------- moving between the layers
  // from the bottom: the forest (0), the army (2), the stars (1). Combat (3) is to the right of the army.
  let booted = false, lastNav = 0;
  const oldGoto = FE.goto;
  FE.goto = function (v, instant) {
    if (!booted) { booted = true; v = 0; instant = true; lateInit(); }             // ui.js opens "layer 1" at the start: that is the forest now
    const s = FE.state;
    if (v === 1 && !l3Open()) return;
    if (v === 2 && !s.layer2) return;
    if (v === 3 && !FE.combat.active) return;
    FE.view = v;
    const pages = $('pages');
    pages.scrollTop = 0; pages.scrollLeft = 0;
    pages.classList.toggle('instant', !!instant);
    pages.dataset.view = String(v);
    document.body.classList.toggle('v2', v >= 2);
    document.body.classList.toggle('v3', v === 3);
    if (v === 2) FE.scatterDots();
    [['pageF', 0], ['page1', 1], ['page2', 2], ['page3', 3]].forEach(([id, n]) => { const p = $(id); p.inert = v !== n; p.setAttribute('aria-hidden', String(v !== n)); });
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => pages.classList.remove('instant')));
    FE.render();
  };
  function lateInit() {
    if (!F().cur && FE.state.cur) F().cur = FE.state.cur;
    vt = F().cur ? fe().tier : 0;
    const tu = FE.testingUnlock;                                                   // TESTING ONLY: it also opens layer 3
    if (tu) FE.testingUnlock = function () { F().l3 = true; return tu.apply(this, arguments); };
  }
  // the links
  $('nav-down').addEventListener('click', e => { e.stopImmediatePropagation(); FE.goto(0); }, true);   // the army's "layer 1" is the forest now
  navL3.addEventListener('click', () => FE.goto(1));
  navL2.addEventListener('click', () => FE.goto(2));

  // wheel, swipe and the arrow keys (controls.js would send them to the old numbering, so they are claimed here first)
  function nav(dir) {                                                              // -1 = up, 1 = down
    const now = performance.now();
    if (FE.collapsing || FE.condensing || FE.view === 3 || FE.modalOpen || now - lastNav < 900) return;
    const v = FE.view;
    if (dir < 0) { if (v === 0 && FE.state.layer2) { lastNav = now; FE.goto(2); } else if (v === 2 && l3Open()) { lastNav = now; FE.goto(1); } }
    else if (v === 1) { lastNav = now; FE.goto(2); } else if (v === 2) { lastNav = now; FE.goto(0); }
  }
  addEventListener('wheel', e => {
    if (FE.modalOpen || Math.abs(e.deltaY) < 12 || e.target.closest('.scroll')) return;
    e.stopPropagation(); nav(e.deltaY < 0 ? -1 : 1);
  }, { capture: true, passive: true });
  let ty = null;
  addEventListener('touchstart', e => { if (FE.modalOpen) return; e.stopPropagation(); ty = e.target.closest('.scroll') ? null : e.touches[0].clientY; }, { capture: true, passive: true });
  addEventListener('touchend', e => {
    if (FE.modalOpen) return; e.stopPropagation();
    if (ty == null) return; const d = e.changedTouches[0].clientY - ty; ty = null; if (Math.abs(d) > 70) nav(d > 0 ? -1 : 1);
  }, { capture: true, passive: true });

  // the keyboard on the forest: space gathers (hold it to repeat), the element's own letter gathers, another letter switches tabs
  let sh = null;
  const stopSpace = () => { clearInterval(sh); sh = null; };
  addEventListener('blur', stopSpace); document.addEventListener('visibilitychange', stopSpace);
  addEventListener('keyup', e => { if (e.key !== ' ' || FE.view !== 0) return; if (sh) { e.preventDefault(); e.stopPropagation(); } stopSpace(); }, true);
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || FE.modalOpen) return;
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.stopPropagation(); nav(-1); return; }
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.stopPropagation(); nav(1); return; }
    if (FE.view !== 0) return;
    if (e.key === ' ') {
      e.preventDefault(); e.stopPropagation();
      if (e.repeat || sh) return;
      gather(); sh = setInterval(() => { if (FE.view !== 0) stopSpace(); else gather(); }, FE.HOLD_MS);
      return;
    }
    const d = FE.ELEMENTS.find(x => x.key === e.key.toLowerCase());
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    if (e.repeat) return;
    if (d.id === F().cur) gather(); else switchEl(d.id);
  }, true);

  // ---------------------------------------------------------------- always running
  const oldRogue = FE.rogueChance;
  if (oldRogue) FE.rogueChance = () => l3Open() ? oldRogue() : 0;                   // no rogue stars in a sky nobody has been to yet
  let lastT = performance.now();
  setInterval(() => {
    const t = performance.now(), dt = Math.min((t - lastT) / 1000, 3600); lastT = t;
    const f = F(); if (!f.cur) return;
    IDS.forEach(k => { f.els[k].count += rate(k) * dt; });
    if (l3Open() && !f.l3seen && !FE.modalOpen && !(FE.combat && FE.combat.active)) {
      f.l3seen = true; FE.save();
      FE.toast('Above the army, the sky has opened: layer 3. The old stars are waiting.', 6400);
    }
  }, 100);
  requestAnimationFrame(frame);
});
