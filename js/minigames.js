/* minigames.js - the elemental event on the right of layer 2. Each element has its own mini-game. A game pays stardust
 * and a timed buff, then needs a rest before the next one. Playing once also opens the element's exclusive build on layer 1.
 *
 *   air   catch the drifting currents, and not the storm clouds
 *   fire  stoke the forge: stop the marker inside the glowing band
 *   water repeat the tides: ripples light in an order, you repeat it, one longer each round
 *   earth dig: find the crystals with a limited number of digs, guided by how warm each hole is
 */
FE.module(function (FE) {
  const $ = FE.$, W = 480, H = 320, TAU = Math.PI * 2;
  const rand = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const hs = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  const FONT = '"Times New Roman", Times, serif';
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };

  let ctx, running = null, runningTab = 'main', tab = 'main', T = 0, last = performance.now(), result = '';
  // two games: the main element's pays stardust and a buff; the auxiliary element's pays that element and spirits that gather it
  const tabEl = t => (t === 'aux' && FE.state.aux) ? FE.state.aux : FE.el();

  const INFO = {
    air:   { title: 'catch the currents', buff: 'tailwind', thresholds: [8, 16, 24, 32], minBuff: 4, unit: 'caught',
      blurb: 'Wisps of wind drift across the sky. Click them to gather their currents (20 seconds). Storm clouds cost you two.' },
    fire:  { title: 'stoke the forge', buff: 'inferno', thresholds: [6, 10, 13, 16], minBuff: 5, unit: 'heat',
      blurb: 'A spark runs along the bar. Click as it crosses the glowing band: dead centre is worth double. The band narrows each of the 8 rounds.' },
    water: { title: 'tidal echoes', buff: 'tidal', thresholds: [3, 5, 7, 9], minBuff: 2, unit: 'rounds',
      blurb: 'The pools ripple in an order. Repeat it. Each round adds one more ripple, and one wrong pool ends it.' },
    earth: { title: 'deep dig', buff: 'bedrock', thresholds: [2, 3, 5, 6], minBuff: 1, unit: 'crystals',
      blurb: 'Six crystals sleep in the rock. You have 14 digs. A hole shows how close the nearest crystal is: the warmer the number, the nearer.' }
  };
  FE.MG_INFO = INFO;

  function backdrop(el, t) {
    const p = FE.PAL[el], g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#080c1a'); g.addColorStop(1, '#141d38');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      const x = hs(i, 1) * W, y = (hs(i, 2) * H + t * (4 + 8 * hs(i, 3))) % H, a = .2 + .5 * Math.abs(Math.sin(t * (.5 + hs(i, 4)) + i));
      ctx.fillStyle = rgba(i % 4 ? '#ffffff' : p.glow, a * .6); ctx.fillRect(x, y, 1.6, 1.6);
    }
  }
  function glow(x, y, r, c, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  function text(s, x, y, size, color, align) { ctx.font = `${size}px ${FONT}`; ctx.textAlign = align || 'left'; ctx.fillStyle = color || '#dfe6ff'; ctx.fillText(s, x, y); }

  // ---------------- air ----------------
  function airGame() {
    const g = { t: 0, score: 0, wisps: [], clouds: [], wt: 0, ct: 1, bursts: [], bad: 0, over: false, dur: 20 };
    g.update = dt => {
      g.t += dt; g.wt -= dt; g.ct -= dt; g.bad = Math.max(0, g.bad - dt * 2.5);
      if (g.t >= g.dur) { g.over = true; return; }
      if (g.wt <= 0) { g.wt = rand(.35, .7); const d = Math.random() < .5 ? 1 : -1; g.wisps.push({ x: d > 0 ? -20 : W + 20, y0: rand(40, H - 40), vx: d * rand(70, 140), ph: rand(TAU), t: 0, trail: [] }); }
      if (g.ct <= 0) { g.ct = rand(1.2, 2.2); const d = Math.random() < .5 ? 1 : -1; g.clouds.push({ x: d > 0 ? -40 : W + 40, y0: rand(50, H - 50), vx: d * rand(40, 80), ph: rand(TAU), t: 0 }); }
      for (const a of [g.wisps, g.clouds]) for (let i = a.length - 1; i >= 0; i--) {
        const o = a[i]; o.t += dt; o.x += o.vx * dt; o.y = o.y0 + Math.sin(o.t * 2.2 + o.ph) * 32;
        if (o.trail) { o.trail.push([o.x, o.y]); if (o.trail.length > 14) o.trail.shift(); }
        if (o.x < -60 || o.x > W + 60) a.splice(i, 1);
      }
      for (let i = g.bursts.length - 1; i >= 0; i--) { g.bursts[i].t += dt; if (g.bursts[i].t > .5) g.bursts.splice(i, 1); }
    };
    g.click = (x, y) => {
      for (let i = g.wisps.length - 1; i >= 0; i--) { const o = g.wisps[i]; if (Math.hypot(o.x - x, o.y - y) < 26) { g.wisps.splice(i, 1); g.score++; g.bursts.push({ x: o.x, y: o.y, t: 0 }); return; } }
      for (let i = g.clouds.length - 1; i >= 0; i--) { const o = g.clouds[i]; if (Math.hypot(o.x - x, o.y - y) < 36) { g.clouds.splice(i, 1); g.score = Math.max(0, g.score - 2); g.bad = 1; return; } }
    };
    g.draw = () => {
      backdrop('air', T);
      for (const o of g.wisps) {
        ctx.lineCap = 'round';
        for (let i = 1; i < o.trail.length; i++) { ctx.strokeStyle = rgba('#bfe9ff', i / o.trail.length * .7); ctx.lineWidth = 1 + i * .35; ctx.beginPath(); ctx.moveTo(...o.trail[i - 1]); ctx.lineTo(...o.trail[i]); ctx.stroke(); }
        glow(o.x, o.y, 26, '#8fd3ee', .8); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(o.x, o.y, 5, 0, TAU); ctx.fill();
      }
      for (const o of g.clouds) {
        for (let i = 0; i < 5; i++) { ctx.fillStyle = rgba(i % 2 ? '#4a5266' : '#363d50', .95); ctx.beginPath(); ctx.arc(o.x + (i - 2) * 10, o.y + Math.sin(i * 2) * 5, 14 - Math.abs(i - 2) * 2, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = rgba('#ffe27a', .7 + .3 * Math.sin(T * 14)); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o.x - 2, o.y + 8); ctx.lineTo(o.x + 4, o.y + 16); ctx.lineTo(o.x - 3, o.y + 20); ctx.stroke();
      }
      for (const b of g.bursts) { ctx.strokeStyle = rgba('#fff', 1 - b.t * 2); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, 8 + b.t * 50, 0, TAU); ctx.stroke(); }
      if (g.bad > 0) { ctx.fillStyle = rgba('#ff6b5e', g.bad * .25); ctx.fillRect(0, 0, W, H); }
      text(`${g.score} caught`, 14, 24, 18); text(`${Math.max(0, Math.ceil(g.dur - g.t))}s`, W - 14, 24, 18, '#dfe6ff', 'right');
      ctx.fillStyle = rgba('#8fd3ee', .5); ctx.fillRect(0, H - 4, W * (1 - g.t / g.dur), 4);
    };
    g.score_ = () => g.score;
    return g;
  }

  // ---------------- fire ----------------
  function fireGame() {
    const ROUNDS = 8, ZONES = [.26, .22, .19, .16, .14, .12, .10, .09];
    const g = { round: 0, score: 0, pos: 0, dir: 1, zc: .5, zw: .26, state: 'run', t: 0, msg: '', over: false };
    const next = () => { g.pos = Math.random() < .5 ? 0 : 1; g.dir = g.pos ? -1 : 1; g.zw = ZONES[g.round]; g.zc = rand(.25, .75); g.state = 'run'; };
    next();
    g.update = dt => {
      if (g.state === 'run') { g.pos += g.dir * (.75 + .13 * g.round) * dt; if (g.pos >= 1) { g.pos = 1; g.dir = -1; } if (g.pos <= 0) { g.pos = 0; g.dir = 1; } }
      else { g.t += dt; if (g.t > .75) { g.t = 0; g.round++; if (g.round >= ROUNDS) g.over = true; else next(); } }
    };
    g.click = () => {
      if (g.state !== 'run') return;
      const d = Math.abs(g.pos - g.zc);
      if (d < .02) { g.score += 2; g.msg = 'perfect'; } else if (d < g.zw / 2) { g.score += 1; g.msg = 'good'; } else g.msg = 'cold';
      g.state = 'show'; g.t = 0;
    };
    g.draw = () => {
      backdrop('fire', T);
      const bx = 50, bw = W - 100, by = 218, heat = g.score / 16;
      for (let i = 0; i < 3; i++) {                                    // the fire grows with the heat
        const cx = W / 2 + (i - 1) * 46 * (.6 + heat), h = 28 + heat * 120 * (i === 1 ? 1 : .7) + Math.sin(T * 9 + i * 2) * 6;
        glow(cx, by - h * .5, 40 + heat * 90, '#ff8a3d', .35 + heat * .4);
        ctx.fillStyle = rgba(['#b32a0e', '#f2683a', '#ffd36b'][i], .85);
        ctx.beginPath(); ctx.moveTo(cx - 24, by - 6); ctx.quadraticCurveTo(cx - 20, by - h * .5, cx + Math.sin(T * 7 + i) * 6, by - h); ctx.quadraticCurveTo(cx + 20, by - h * .5, cx + 24, by - 6); ctx.fill();
      }
      ctx.fillStyle = '#20263d'; ctx.fillRect(bx, by, bw, 26);
      const zx = bx + (g.zc - g.zw / 2) * bw;
      ctx.fillStyle = rgba('#ffb347', .55); ctx.fillRect(zx, by, g.zw * bw, 26);
      ctx.fillStyle = '#fff6c0'; ctx.fillRect(bx + g.zc * bw - 2, by, 4, 26);
      const mx = bx + g.pos * bw; glow(mx, by + 13, 26, '#ffd36b', .9);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(mx, by - 4); ctx.lineTo(mx - 8, by - 16); ctx.lineTo(mx + 8, by - 16); ctx.fill();
      text(`round ${Math.min(ROUNDS, g.round + 1)} / ${ROUNDS}`, 14, 24, 18); text(`heat ${g.score}`, W - 14, 24, 18, '#dfe6ff', 'right');
      if (g.state === 'show') text(g.msg, W / 2, 272, 24, g.msg === 'cold' ? '#8aa0d8' : '#ffd36b', 'center');
    };
    g.score_ = () => g.score;
    return g;
  }

  // ---------------- water ----------------
  function waterGame() {
    const COLS = ['#4a97e8', '#3fd0d8', '#6a8cff', '#7fe0b8'];
    const rects = [0, 1, 2, 3].map(i => ({ x: 30 + (i % 2) * 215, y: 48 + Math.floor(i / 2) * 134, w: 205, h: 124 }));
    const g = { seq: [], phase: 'show', i: 0, t: .6, lit: -1, litT: 0, idx: 0, score: 0, over: false, msg: '' };
    const add = () => { g.seq.push(Math.floor(Math.random() * 4)); g.phase = 'show'; g.i = 0; g.t = .7; g.lit = -1; g.idx = 0; };
    add();
    g.update = dt => {
      g.litT = Math.max(0, g.litT - dt);
      if (g.phase === 'show') {
        g.t -= dt;
        if (g.t <= 0) {
          if (g.lit >= 0) { g.lit = -1; g.t = .22; if (g.i >= g.seq.length) { g.phase = 'input'; g.idx = 0; } }
          else if (g.i < g.seq.length) { g.lit = g.seq[g.i++]; g.litT = .45; g.t = .5; }
        }
      } else if (g.phase === 'gap') { g.t -= dt; if (g.t <= 0) { if (g.seq.length >= 12) g.over = true; else add(); } }
      else if (g.phase === 'fail') { g.t -= dt; if (g.t <= 0) g.over = true; }
    };
    g.click = (x, y) => {
      if (g.phase !== 'input') return;
      const i = rects.findIndex(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
      if (i < 0) return;
      g.lit = i; g.litT = .25;
      if (i === g.seq[g.idx]) { g.idx++; if (g.idx >= g.seq.length) { g.score = g.seq.length; g.phase = 'gap'; g.t = .8; g.msg = 'yes'; } }
      else { g.phase = 'fail'; g.t = .9; g.msg = 'the tide slips'; }
    };
    g.draw = () => {
      backdrop('water', T);
      rects.forEach((r, i) => {
        const on = g.litT > 0 && g.lit === i, a = on ? 1 : .22;
        ctx.fillStyle = rgba(COLS[i], a); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill();
        if (on) glow(r.x + r.w / 2, r.y + r.h / 2, 130, COLS[i], .6);
        ctx.strokeStyle = rgba('#a8ecff', on ? .9 : .3); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.stroke();
        for (let k = 0; k < 3; k++) { const q = ((T * .5 + k / 3 + i * .17) % 1); ctx.strokeStyle = rgba('#a8ecff', (on ? .7 : .22) * (1 - q)); ctx.beginPath(); ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, 12 + q * 60, 5 + q * 24, 0, 0, TAU); ctx.stroke(); }
      });
      text(`round ${g.seq.length}`, 14, 28, 18);
      text(g.phase === 'show' ? 'watch...' : g.phase === 'input' ? 'your turn' : g.msg, W - 14, 28, 18, '#dfe6ff', 'right');
    };
    g.score_ = () => g.score;
    return g;
  }

  // ---------------- earth ----------------
  function earthGame() {
    const COLS = 8, ROWS = 5, CELL = 56, OX = 16, OY = 36, GEMS = 6, DIGS = 14;
    const gems = new Set(); while (gems.size < GEMS) gems.add(Math.floor(Math.random() * COLS * ROWS));
    const g = { dug: {}, found: 0, digs: DIGS, over: false, endT: 0, flash: [] };
    const near = (c, r) => { let best = 99; for (const k of gems) { if (g.dug[k]) continue; best = Math.min(best, Math.max(Math.abs(k % COLS - c), Math.abs(Math.floor(k / COLS) - r))); } return best; };
    g.update = dt => {
      for (let i = g.flash.length - 1; i >= 0; i--) { g.flash[i].t += dt; if (g.flash[i].t > .6) g.flash.splice(i, 1); }
      if (g.found >= GEMS || g.digs <= 0) { g.endT += dt; if (g.endT > 1) g.over = true; }
    };
    g.click = (x, y) => {
      if (g.endT) return;
      const c = Math.floor((x - OX) / CELL), r = Math.floor((y - OY) / CELL);
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
      const k = r * COLS + c; if (g.dug[k]) return;
      g.digs--;
      if (gems.has(k)) { g.dug[k] = 'gem'; g.found++; g.flash.push({ x: OX + c * CELL + CELL / 2, y: OY + r * CELL + CELL / 2, t: 0 }); }
      else g.dug[k] = near(c, r);
    };
    g.draw = () => {
      backdrop('earth', T);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const k = r * COLS + c, x = OX + c * CELL, y = OY + r * CELL, d = g.dug[k];
        if (!d) {
          ctx.fillStyle = `hsl(${28 + hs(k, 1) * 8},${28 + hs(k, 2) * 12}%,${24 + hs(k, 3) * 10}%)`; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 6); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(x + 10 + hs(k, 4) * 20, y + 8); ctx.lineTo(x + 18 + hs(k, 5) * 24, y + CELL - 10); ctx.stroke();
        } else {
          ctx.fillStyle = '#10131f'; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 6); ctx.fill();
          if (d === 'gem') {
            glow(x + CELL / 2, y + CELL / 2, 34, '#ffd36b', .7 + .2 * Math.sin(T * 4 + k));
            ctx.fillStyle = '#ffe9b0'; ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 28, y + 10); ctx.lineTo(x + 44, y + 28); ctx.lineTo(x + 28, y + 46); ctx.lineTo(x + 12, y + 28); ctx.closePath(); ctx.fill(); ctx.stroke();
          } else {
            const col = d <= 1 ? '#ff6b3a' : d === 2 ? '#ffb347' : d === 3 ? '#e8d58a' : '#6f7da8';
            text(String(d >= 9 ? '9+' : d), x + CELL / 2, y + CELL / 2 + 8, 24, col, 'center');
          }
        }
      }
      for (const f of g.flash) { ctx.strokeStyle = rgba('#ffd36b', 1 - f.t / .6); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.x, f.y, 10 + f.t * 90, 0, TAU); ctx.stroke(); }
      text(`${g.found} / ${GEMS} crystals`, 14, 24, 18); text(`${g.digs} digs left`, W - 14, 24, 18, '#dfe6ff', 'right');
    };
    g.score_ = () => g.found;
    return g;
  }

  const MAKE = { air: airGame, fire: fireGame, water: waterGame, earth: earthGame };

  // ---- the shell: starting, finishing, paying out ----
  const readyKey = t => t === 'aux' ? 'auxReadyAt' : 'readyAt';
  const ready = t => Date.now() >= FE.state.mg[readyKey(t || tab)];
  function finishAux(g) {
    const el = FE.state.aux, info = INFO[el], st = FE.state, score = g.score_();
    const n = info.thresholds.filter(t => score >= t).length, amount = Math.round(score * 40 * (FE.has('echo') ? 2 : 1));
    const spirits = n >= 4 ? 2 : n >= 2 ? 1 : 0;
    st.mg.auxPlays++; st.mg.auxBest = Math.max(st.mg.auxBest, score); st.mg.auxReadyAt = Date.now() + FE.MG_COOLDOWN * 1000;
    st.auxCount += amount; st.auxUp.gath += spirits;
    result = `${score} ${info.unit}. ${FE.fmt(amount)} ${el} gathered.` + (spirits ? ` ${spirits === 1 ? 'A spirit of' : spirits + ' spirits of'} ${el} will now gather it for you (+${FE.AUX_GATH_RATE}/s each).` : ' Reach more to earn a spirit that gathers it for you.');
    running = null;
    FE.save(); FE.render();
  }
  function finish(g) {
    if (runningTab === 'aux') return finishAux(g);
    const el = FE.el(), info = INFO[el], st = FE.state, score = g.score_();
    const echo = FE.has('echo');
    const dust = info.thresholds.filter(t => score >= t).length * (echo ? 2 : 1);
    const buffed = score >= info.minBuff;
    st.mg.plays++; st.mg.best = Math.max(st.mg.best, score); st.mg.readyAt = Date.now() + FE.MG_COOLDOWN * 1000;
    st.stardust += dust; st.totalDust += dust;
    let line = `${score} ${info.unit}.`;
    if (dust) line += ` ${dust} stardust condensed.`; else line += ' Nothing condensed this time.';
    if (buffed) { st.buffs[info.buff] = Date.now() + FE.BUFF_SECONDS * (echo ? 1.5 : 1) * 1000; line += ` ${FE.BUFFS[info.buff].name}: ${FE.BUFFS[info.buff].note}.`; }
    if (st.mg.plays === 1) line += ` A build exclusive to ${el} has opened on layer 1.`;
    result = line; running = null;
    FE.save(); FE.render();
  }

  FE.startMini = function () {
    if (running || !ready() || !FE.el()) return;
    runningTab = tab; running = MAKE[tabEl(tab)](); result = '';
    FE.render();
  };
  FE.setMiniTab = t => { if (running || (t === 'aux' && !FE.state.aux)) return; tab = t; result = ''; FE.render(); };

  FE.buildMini = function () {
    const cv = $('mg'); ctx = cv.getContext('2d');
    cv.addEventListener('pointerdown', e => {
      if (!running) return;
      const r = cv.getBoundingClientRect();
      running.click((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height);
    });
    $('mg-start').addEventListener('click', () => FE.startMini());
    $('mgt-main').addEventListener('click', () => FE.setMiniTab('main'));
    $('mgt-aux').addEventListener('click', () => FE.setMiniTab('aux'));
    requestAnimationFrame(function loop(now) {
      requestAnimationFrame(loop);
      const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
      if (FE.view !== 2 || document.hidden || !FE.el()) return;
      if (running) {
        running.update(dt);
        running.draw();
        if (running.over) finish(running);
      } else {
        backdrop(tabEl(tab), T);
        const p = FE.PAL[tabEl(tab)]; glow(W / 2, H / 2, 150, p.glow, .35 + .08 * Math.sin(T * 1.6));
        text(ready() ? 'ready' : 'resting...', W / 2, H / 2 + 8, 28, '#dfe6ff', 'center');
      }
    });
  };

  // called from FE.render
  FE.renderMini = function () {
    const el = FE.el(); if (!el) return;
    const st = FE.state, aux = st.aux;
    if (!aux && tab === 'aux') tab = 'main';
    if (running) tab = runningTab;
    const te = tabEl(tab), info = INFO[te], isAux = tab === 'aux';
    const wait = Math.max(0, Math.ceil((st.mg[readyKey(tab)] - Date.now()) / 1000));
    const set = (id, t) => { const e = $(id); if (e.textContent !== t) e.textContent = t; };
    $('mg-tabs').hidden = !aux;
    if (aux) {
      set('mgt-main', `${el}: ${INFO[el].title}`); set('mgt-aux', `${aux}: ${INFO[aux].title}`);
      $('mgt-main').classList.toggle('on', !isAux); $('mgt-aux').classList.toggle('on', isAux);
      $('mgt-main').disabled = $('mgt-aux').disabled = !!running;
    }
    set('mg-title', info.title);
    set('mg-blurb', info.blurb + (isAux ? ` This one pays ${te} itself, and spirits that gather it: it cannot be gathered any other way.` : aux ? ' This one pays stardust and a buff.' : ''));
    const plays = isAux ? st.mg.auxPlays : st.mg.plays, best = isAux ? st.mg.auxBest : st.mg.best;
    set('mg-status', running ? 'in play' : wait ? `resting: ${FE.clock(wait)}` : plays ? `best: ${best} ${info.unit}` : 'ready');
    set('mg-result', result);
    const b = $('mg-start'); b.disabled = !!running || wait > 0;
    set('mg-start', running ? 'playing...' : 'begin');
  };
  FE.miniRunning = () => !!running;
});
