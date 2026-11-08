/* ui.js - building and drawing the page: the two layers and the way between them, the builds, the stores, the goal line,
 * the layer 2 stardust and starfield, and small notices. The star itself is drawn by effects.js. */
FE.module(function (FE) {
  const $ = FE.$;
  FE.view = 1;                                                   // 1 = layer 1, 2 = layer 2 (above it)

  // most of this runs ten times a second, so only touch the DOM when something actually changed
  const last = new WeakMap();
  const put = (el, html) => { if (last.get(el) !== html) { last.set(el, html); el.innerHTML = html; } };
  const text = (id, t) => { const el = $(id); if (el.textContent !== t) el.textContent = t; };
  const svg = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;

  // ---- moving between the layers ----
  FE.goto = function (v, instant) {
    if (v === 2 && (!FE.state.layer2 || !$('page2'))) return;
    FE.view = v;
    const pages = $('pages');
    pages.classList.toggle('instant', !!instant);
    pages.dataset.view = String(v);
    document.body.classList.toggle('v2', v === 2);
    [1, 2].forEach(n => { const p = $('page' + n); if (!p) return; p.inert = v !== n; p.setAttribute('aria-hidden', String(v !== n)); });
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => pages.classList.remove('instant')));
    FE.render();
  };

  // ---- small notice at the bottom ----
  let toastTimer = 0;
  FE.toast = function (t, ms) {
    const el = $('toast'); el.textContent = t; el.hidden = false;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms || 3600);
  };

  // ---- layer 2's starfield: always dark, tinted by the element ----
  function startSpace() {
    const cv = $('space'); if (!cv) return;
    const c = cv.getContext('2d');
    const hs = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
    let W = 0, H = 0;
    const size = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
    size(); addEventListener('resize', size);
    let T = 0, prev = performance.now();
    requestAnimationFrame(function loop(now) {
      requestAnimationFrame(loop);
      const dt = Math.min(.05, (now - prev) / 1000); prev = now;
      if (FE.view !== 2 || document.hidden) return;
      T += dt;
      const el = FE.el() || 'air', p = FE.PAL[el];
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#04060f'); g.addColorStop(1, '#0d1430');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 4; i++) {                              // faint nebula clouds in the element's colour
        const x = (hs(i, 1) * 1.2 - .1) * W + Math.sin(T * .05 + i) * 40, y = hs(i, 2) * H, r = Math.max(W, H) * (.25 + .15 * hs(i, 3));
        const gg = c.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, p.glow + '2e'); gg.addColorStop(1, p.glow + '00');
        c.fillStyle = gg; c.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let i = 0; i < 170; i++) {
        const x = hs(i, 4) * W, y = (hs(i, 5) * H + T * (2 + 6 * hs(i, 6))) % H, a = .25 + .75 * Math.abs(Math.sin(T * (.4 + hs(i, 7) * 1.6) + i)), s = hs(i, 8) < .1 ? 2.2 : 1.2;
        c.fillStyle = `rgba(${i % 5 ? '255,255,255' : '190,210,255'},${a * .85})`; c.fillRect(x, y, s, s);
      }
    });
  }

  FE.buildStatic = function () {
    const name = k => FE.NAMES[FE.el()] ? FE.NAMES[FE.el()][k] : k;
    // builds: one card each, shown as they become reachable
    Object.keys(FE.UPS).forEach(k => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'card'; b.id = 'up-' + k; b.hidden = true;
      b.innerHTML = '<span class="card-title"></span><span class="card-cost"></span><span class="card-note"></span>';
      b.addEventListener('click', () => FE.buy(k));
      $('cards').appendChild(b);
    });
    // the round button / star
    const cb = $('core-btn');
    cb.addEventListener('pointerdown', e => {
      if (e.button) return;
      const r = $('core').getBoundingClientRect();
      FE.gather((e.clientX - r.left) * 560 / r.width, (e.clientY - r.top) * 560 / r.height);
    });
    cb.addEventListener('click', e => { if (e.detail === 0) FE.gather(280, 280); });          // the keyboard: Enter or Space
    cb.addEventListener('pointerenter', () => { FE.core.hoverOn = true; });
    cb.addEventListener('pointerleave', () => { FE.core.hoverOn = false; });
    cb.addEventListener('focus', () => { FE.core.hoverOn = true; }); cb.addEventListener('blur', () => { FE.core.hoverOn = false; });
    $('btn-condense').addEventListener('click', () => FE.condense());
    $('btn-collapse').addEventListener('click', () => FE.collapse());
    if ($('nav-up')) { $('nav-up').addEventListener('click', () => FE.goto(2)); $('nav-down').addEventListener('click', () => FE.goto(1)); }
    // choosing (only when the game is opened without the home page)
    FE.ELEMENTS.forEach(({ id, key }) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'el pick pick-' + id; b.id = 'pick-' + id;
      b.innerHTML = `Investigate the <span class="ink-${id}"><b>${FE.OPTIONS[id]}</b></span><span class="key" aria-hidden="true">(${key})</span>`;
      b.addEventListener('click', () => FE.discover(id));
      $('choose-btns').appendChild(b);
    });
    // layer 2
    if ($('skill')) buildLayer2();
    FE.core.init();
    startSpace();
    FE.goto(1, true);
  };

  function buildLayer2() {
    FE.buildSkills();
    const sk = $('skill');
    const setOpen = on => { sk.classList.toggle('open', on); sk.setAttribute('aria-expanded', String(on)); sk.setAttribute('aria-label', on ? 'skill tree: click empty space to close' : 'skill tree: click to open'); };
    FE.closeSkills = () => setOpen(false);
    sk.addEventListener('click', e => {
      if (!sk.classList.contains('open')) { setOpen(true); return; }
      if (e.target.closest('.skill-info')) return;
      const node = e.target.closest('.node');
      if (node) FE.selectSkill(node.dataset.id); else setOpen(false);
    });
    sk.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === sk) { e.preventDefault(); setOpen(!sk.classList.contains('open')); } });
    FE.buildMini();
  }

  // ---- the goal line ----
  function goal() {
    const s = FE.state, el = FE.el(), cost = FE.nextStarCost();
    if (!el) return '';
    if (cost == null) return 'your star is as large as it can grow. collapse it for stardust.';
    const have = s.count >= cost ? 'ready.' : `${FE.fmt(s.count)} / ${FE.fmt(cost)}.`;
    if (s.tier === 0) return `gather ${FE.fmt(cost)} ${el} and condense it into a star: ${have}`;
    return `condense a tier ${s.tier + 1} star: ${have}${s.tier >= FE.COLLAPSE_TIER ? ' or collapse this one.' : ''}`;
  }

  FE.render = function () {
    const s = FE.state, el = FE.el();
    document.body.classList.toggle('choosing', !el);
    $('choose').hidden = !!el;
    if (!el) return;
    document.body.dataset.el = el;
    const names = FE.NAMES[el], cost = FE.nextStarCost(), prog = cost ? Math.min(1, s.count / cost) : 1;

    put($('goal'), goal());
    // buffs
    const now = Date.now();
    put($('buffs'), Object.keys(FE.BUFFS).filter(b => (s.buffs[b] || 0) > now).map(b => `<span class="buff" title="${FE.BUFFS[b].note}">${FE.BUFFS[b].name} &middot; ${Math.ceil((s.buffs[b] - now) / 1000)}s</span>`).join(''));

    // stores (bottom left)
    put($('s-ico'), svg(FE.ICONS[el]));
    text('s-name', el); text('s-n', FE.fmt(s.count));
    text('s-rate', `+${FE.fmt(FE.rate())}/s`);
    text('s-click', `click: +${FE.fmt(FE.clickGain())}`);
    text('s-star', s.tier ? `${FE.STAR_NAMES[s.tier]} star, tier ${s.tier} · production ×${FE.multiplier().toFixed(1)}` : `no star yet · production ×${FE.multiplier().toFixed(1)}`);

    // the star: progress, condense, collapse
    const maxed = cost == null;
    $('cond-info').textContent = maxed ? `tier ${s.tier} star` : `tier ${s.tier + 1} star: ${FE.fmt(s.count)} / ${FE.fmt(cost)} ${el}`;
    $('cond-fill').style.width = (prog * 100).toFixed(1) + '%';
    $('stage').style.setProperty('--cm', (-(280 - FE.core.radius() * 1.3) / 560).toFixed(3));
    const cb = $('btn-condense');
    cb.hidden = maxed;
    if (!maxed) { cb.disabled = s.count < cost || FE.collapsing; text('btn-condense', s.tier === 0 ? 'condense a star' : `condense: tier ${s.tier + 1}`); }
    const col = $('btn-collapse'), dust = FE.dustPreview(), armed = FE.collapseArmed && Date.now() < FE.collapseArmed;
    col.hidden = s.tier < FE.COLLAPSE_TIER;
    if (!col.hidden) {
      col.disabled = dust < 1 || FE.collapsing;
      col.classList.toggle('armed', !!armed);
      const t = dust < 1 ? 'collapse: hold more first' : armed ? 'click again: the star and all progress are lost' : `collapse the star: +${dust} stardust`;
      text('btn-collapse', t);
    }

    // builds (right)
    Object.keys(FE.UPS).forEach(k => {
      const card = $('up-' + k), u = FE.UPS[k], c = FE.upCost(k);
      if (k === 'excl' ? s.mg.plays > 0 : (s.count >= u.show || s.seen[k])) s.seen[k] = true;
      const show = !!s.seen[k];
      card.hidden = !show;
      if (!show) return;
      const [title, price, note] = card.children, n = s.up[k];
      let t, d;
      if (k === 'res') { t = `${el} resonance`; d = `click power ${FE.fmt(FE.clickPower())} → ${FE.fmt(FE.clickPower() * 2)}`; }
      else if (k === 'gath') { t = names.gath; d = `+${FE.GATHER_RATE * (FE.has('autonomy') ? 2 : 1)}/s each`; }
      else if (k === 'eng') { t = names.eng; d = `+${FE.ENGINE_RATE * (FE.has('gravity') ? 2 : 1)}/s each`; }
      else if (k === 'harm') { t = 'harmony'; d = 'all production ×1.5'; }
      else { t = names.excl; d = names.exclNote; }
      put(title, t + (n ? ` ×${n}` : ''));
      put(price, `<span class="${s.count >= c ? 'have' : ''}">${FE.fmt(s.count)} / ${FE.fmt(c)}</span> ${el}`);
      put(note, d);
      card.disabled = s.count < c;
      card.classList.toggle('excl', k === 'excl');
    });

    // layer 2
    if ($('page2')) $('nav-up').hidden = !s.layer2 || FE.view !== 1;
    else $('dust').hidden = !s.collapses;            // until layer 2 has its own page, the stardust sits on layer 1
    text('dust-n', FE.fmt(s.stardust));
    text('dust-sub', s.collapses ? `${s.collapses} collapse${s.collapses === 1 ? '' : 's'} · ${FE.fmt(s.totalDust)} received in all` : '');
    if ($('skill')) { FE.renderSkills(); FE.renderMini(); }
  };
});
