/* army.js - layer 2, the Army tab and the unit list. Each unit you own is a faintly glowing dot that drifts around the left
 * side like a firefly, easing away from the edges. Buying condenses new dots into being. Units are made from crystals of their
 * own element. Venture Forth (combat.js) sends them all into battle. */
FE.module(function (FE) {
  const $ = FE.$, TAU = Math.PI * 2, CAP = 150;           // at most CAP dots are drawn per element; the counts stay exact
  const rand = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
  const text = (el, t) => { if (el.textContent !== t) el.textContent = t; };

  const dots = [], spr = {};
  let cv, ctx, W = 0, H = 0, T = 0, prev = performance.now(), scatter = false;

  // a soft round glow, drawn once per element colour
  function sprite(el) {
    if (spr[el]) return spr[el];
    const k = document.createElement('canvas'); k.width = k.height = 64;
    const g = k.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32), c = FE.PAL[el].glow;
    gr.addColorStop(0, rgba(c, 1)); gr.addColorStop(.25, rgba(c, .55)); gr.addColorStop(.6, rgba(c, .12)); gr.addColorStop(1, rgba(c, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (spr[el] = k);
  }

  // anim: the dot condenses into being (a ring closes in, a flash, the dot settles); otherwise it is simply there
  function spawn(el, anim) {
    const m = 36, a = rand(TAU), sp = rand(9, 20);
    dots.push({ el, x: rand(m, Math.max(m + 1, W - m)), y: rand(m, Math.max(m + 1, H - m)), a, sp, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, p: rand(TAU), w: rand(.4, 1), age: anim ? 0 : 9 });
  }
  const have = el => { let n = 0; for (const d of dots) if (d.el === el) n++; return n; };

  // every dot starts over from a random spot: asked for when the army tab or layer 2 is opened, done once it is on screen
  FE.scatterDots = () => { scatter = true; };
  function doScatter() {
    const m = 36;
    for (const d of dots) {
      d.x = rand(m, Math.max(m + 1, W - m)); d.y = rand(m, Math.max(m + 1, H - m));
      d.a = rand(TAU); d.vx = Math.cos(d.a) * d.sp; d.vy = Math.sin(d.a) * d.sp;
    }
    scatter = false;
  }

  // dots follow the counts (loading a save, or a change made while the tab was hidden)
  function sync() {
    FE.UNITS.forEach(({ id }) => {
      const want = Math.min(FE.state.units[id], CAP);
      let n = have(id);
      for (; n < want; n++) spawn(id, false);
      for (let i = dots.length - 1; n > want && i >= 0; i--) if (dots[i].el === id) { dots.splice(i, 1); n--; }
    });
  }

  FE.buyUnit = function (id) {
    const s = FE.state, u = FE.UNITS.find(x => x.id === id);
    if (!u || s.crystals[id] < 1) return;
    s.crystals[id]--; s.units[id] += u.per;
    if (W > 0 && !$('pane-army').hidden) { let n = have(id); for (let i = 0; i < u.per && n < CAP; i++, n++) spawn(id, true); }
    FE.render(); FE.save();
  };

  function size() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    if (!W) return;                                          // the tab is hidden: leave the dots alone (they used to be squashed into a corner)
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const d of dots) { d.x = clamp(d.x, 6, Math.max(7, W - 6)); d.y = clamp(d.y, 6, Math.max(7, H - 6)); }
  }

  function update(dt) {
    const M = 44;
    for (const d of dots) {
      d.age += dt;
      d.a += (Math.sin(T * d.w + d.p) * .7 + (Math.random() - .5) * 1.2) * dt;          // a lazy wander
      d.vx += (Math.cos(d.a) * d.sp - d.vx) * dt * 1.2;
      d.vy += (Math.sin(d.a) * d.sp - d.vy) * dt * 1.2;
      if (d.x < M) d.vx += (M - d.x) * 1.6 * dt; else if (d.x > W - M) d.vx -= (d.x - (W - M)) * 1.6 * dt;   // too close to an edge: ease back in
      if (d.y < M) d.vy += (M - d.y) * 1.6 * dt; else if (d.y > H - M) d.vy -= (d.y - (H - M)) * 1.6 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.x < 6) { d.x = 6; d.vx = Math.abs(d.vx); } else if (d.x > W - 6) { d.x = W - 6; d.vx = -Math.abs(d.vx); }   // and if it still gets there, it bounces
      if (d.y < 6) { d.y = 6; d.vy = Math.abs(d.vy); } else if (d.y > H - 6) { d.y = H - 6; d.vy = -Math.abs(d.vy); }
      d.a = Math.atan2(d.vy, d.vx);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const d of dots) {
      const k = clamp(d.age / .9, 0, 1), e = easeOut(k), pulse = .75 + .25 * Math.sin(T * 1.6 + d.p), c = FE.PAL[d.el].glow, sp = sprite(d.el);
      const gr = 15 * (1 + (1 - e) * 1.8);                                              // the glow starts wide and settles
      ctx.globalAlpha = clamp(.3 * pulse * (.3 + .7 * e) + (1 - e) * .55, 0, 1);
      ctx.drawImage(sp, d.x - gr, d.y - gr, gr * 2, gr * 2);
      ctx.globalAlpha = .55 + .3 * pulse;
      const cr = 5 * e + .5; ctx.drawImage(sp, d.x - cr, d.y - cr, cr * 2, cr * 2);
      ctx.globalAlpha = clamp(.55 + .35 * e, 0, 1); ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(d.x, d.y, 1.7 * e, 0, TAU); ctx.fill();
      if (k < 1) {                                                                       // the ring that closes in
        ctx.globalAlpha = 1; ctx.strokeStyle = rgba(c, .8 * Math.sin(k * Math.PI)); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(d.x, d.y, 4 + 38 * (1 - e), 0, TAU); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - prev) / 1000); prev = now;
    if (FE.view !== 2 || document.hidden || $('pane-army').hidden || !W) return;
    T += dt; sync(); if (scatter) doScatter(); update(dt); draw();
  }

  // ---- the unit page: stat lines with shimmering keywords, in the look of the Unit Keyword Shimmer mock-up ----
  // *words between stars* become keywords: the unit's colour at rest, with a soft light band that sweeps across when you hover the
  // unit and every few seconds on its own. Water's also glows while the band passes. (--a rest colour, --h2 the light of the band.)
  const KW = {
    air:   { a: '#aee0f7', h2: '#f4fbff', g: '#8fd3f5' },
    water: { a: '#6fb3ff', h2: '#a9d2ff', g: '#3d8bf0', glow: true },
    earth: { a: '#e2ad6e', h2: '#f8dba8', g: '#e2ad6e' },
    fire:  { a: '#ff875a', h2: '#ffcbb0', g: '#ff5a2e' }
  };
  const md = s => s.replace(/\*(.+?)\*/g, '<span class="kw">$1</span>');
  const statHtml = u => {
    const st = FE.unitStats(u.id), kw = (id, t) => u.id === id ? `<span class="kw">${t}</span>` : t;
    let x = '';
    if (u.per > 1) { const w = FE.NUM_WORD(u.per); x = `<span>${md(`*${w[0].toUpperCase() + w.slice(1)}*`)} <i class="ic"></i> per ${FE.gemHtml(u.id)}</span>`; }
    else if (u.id === 'water') x = `<span>${md(`*heal ${FE.COMBAT.healAmount}*`)}</span>`;
    return `<span>${kw('earth', `health ${st.hp}`)} · ${kw('fire', `attack ${st.atk}`)}</span>${x ? ' · ' + x : ''}`;
  };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function shimmer(row, id) {
    const k = KW[id], f0 = 'drop-shadow(0 0 0 rgba(0,0,0,0))', fb = `drop-shadow(0 0 5px ${k.g}99)`;
    row._play = () => {
      if (reduceMotion || FE.view !== 2) return;
      row.querySelectorAll('.kw').forEach(w => {
        if (w._an) w._an.cancel();
        w._an = !k.glow ? w.animate([{ backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0' }], { duration: 1300, easing: 'ease-in-out' })
          : w.animate([{ backgroundPosition: '100% 0', filter: f0 }, { filter: fb, offset: .5 }, { backgroundPosition: '0% 0', filter: f0 }], { duration: 1300, easing: 'ease-in-out' });
      });
    };
    row.addEventListener('pointerenter', row._play);
    return row;
  }

  FE.buildArmy = function () {
    cv = $('army-cv'); ctx = cv.getContext('2d');
    new ResizeObserver(size).observe(cv); size();
    FE.UNITS.forEach(u => {
      const r = document.createElement('div');
      r.className = 'unit'; r.dataset.el = u.id; r.id = 'unit-' + u.id;
      const k = KW[u.id]; r.style.setProperty('--a', k.a); r.style.setProperty('--h2', k.h2);
      r.innerHTML = `<span class="u-name">${u.name}</span><span class="u-stat" id="us-${u.id}"></span><span class="u-desc">${md(FE.unitBlurb(u))}</span>`
        + `<span class="u-n" id="un-${u.id}">0</span><button class="el" id="ub-${u.id}" type="button">1 ${u.id} crystal</button>`;
      r.querySelector('button').addEventListener('click', () => FE.buyUnit(u.id));
      $('units').appendChild(r); shimmer(r, u.id);
    });
    FE.UNITS.forEach((u, i) => setTimeout(() => { $('unit-' + u.id)._play(); setInterval($('unit-' + u.id)._play, 4200); }, 600 + i * 350));
    $('btn-venture').addEventListener('click', () => FE.venture());
    $('tgt-prev').addEventListener('click', () => FE.cycleTarget(-1));            // TESTING ONLY
    $('tgt-next').addEventListener('click', () => FE.cycleTarget(1));
    requestAnimationFrame(frame);
  };

  // ---- TESTING ONLY: the arrows under Venture Forth choose which map you venture to. Normally you are sent to the next map that
  // is not cleared yet; this lets you jump to any map to try it out. Delete this, the #tgt block in game.html and renderArmy's
  // part of it before release. ----
  FE.cycleTarget = function (dir) {
    const s = FE.state, i = FE.targetIdx(), j = Math.max(0, Math.min(FE.MAPS.length - 1, i + dir));
    if (j === i) return;
    s.target = j; FE.save(); FE.render();
  };

  FE.renderArmy = function () {
    FE.UNITS.forEach(({ id }) => {
      { const el = $('us-' + id), h = statHtml(FE.UNITS.find(x => x.id === id)); if (el._h !== h) { el._h = h; el.innerHTML = h; } }
      text($('un-' + id), FE.fmt(FE.state.units[id]));
      const b = $('ub-' + id), off = FE.state.crystals[id] < 1;
      if (b.disabled !== off) b.disabled = off;
    });
    const v = $('btn-venture'), none = FE.UNITS.every(u => !FE.state.units[u.id]);
    if (v.disabled !== none) v.disabled = none;

    // the target map, listed under Venture Forth once TESTING ONLY has been pressed (the arrows are TESTING ONLY, see cycleTarget)
    const tg = $('tgt'), shown = FE.testingOn();
    if (tg.hidden === shown) tg.hidden = !shown;
    if (shown) {
      const i = FE.targetIdx();
      text($('tgt-name'), FE.MAPS[i].name);
      $('tgt-prev').disabled = i === 0; $('tgt-next').disabled = i === FE.MAPS.length - 1;
    }
  };
});
