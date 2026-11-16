/* ui.js - building and drawing the page: the two layers and the way between them, the element tabs, the builds, the
 * stores, the goal line, the layer 2 crystal counts, and small notices. The star itself is drawn by effects.js. */
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
    if (v === 2 && !FE.state.layer2) return;
    if (v === 3 && !FE.combat.active) return;                // layer 3 is the battlefield, to the right of layer 2
    FE.view = v;
    const pages = $('pages');
    pages.classList.toggle('instant', !!instant);
    pages.dataset.view = String(v);
    document.body.classList.toggle('v2', v >= 2);
    document.body.classList.toggle('v3', v === 3);
    if (v === 2) FE.scatterDots();
    [1, 2, 3].forEach(n => { const p = $('page' + n); p.inert = v !== n; p.setAttribute('aria-hidden', String(v !== n)); });
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

  FE.buildStatic = function () {
    // builds: one card each, shown as they become reachable
    Object.keys(FE.UPS).forEach(k => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'card'; b.id = 'up-' + k; b.hidden = true;
      b.innerHTML = '<span class="card-title"></span><span class="card-cost"></span><span class="card-note"></span>';
      b.addEventListener('click', () => FE.buy(k));
      $('cards').appendChild(b);
    });
    const af = document.createElement('button');             // Elemental Affinity: last in the list
    af.type = 'button'; af.className = 'card excl'; af.id = 'up-aff'; af.hidden = true;
    af.innerHTML = '<span class="card-title"></span><span class="card-cost"></span><span class="card-note"></span>';
    af.addEventListener('click', () => FE.buyAffinity());
    $('cards').appendChild(af);

    // the round button / star: a click gathers; holding the mouse down clicks 5 times a second
    const cb = $('core-btn');
    let hold = null, hx = 280, hy = 280;
    const aim = e => { const r = $('core').getBoundingClientRect(); hx = (e.clientX - r.left) * 560 / r.width; hy = (e.clientY - r.top) * 560 / r.height; };
    const stop = () => { clearInterval(hold); hold = null; };
    cb.addEventListener('pointerdown', e => {
      if (e.button) return;
      aim(e); FE.gather(hx, hy);
      stop(); hold = setInterval(() => FE.gather(hx, hy), FE.HOLD_MS);
    });
    cb.addEventListener('pointermove', e => { if (hold) aim(e); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => cb.addEventListener(t, stop));
    addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    cb.addEventListener('click', e => { if (e.detail === 0) FE.gather(280, 280); });          // the keyboard: Enter or Space
    cb.addEventListener('pointerenter', () => { FE.core.hoverOn = true; });
    cb.addEventListener('pointerleave', () => { FE.core.hoverOn = false; });
    cb.addEventListener('focus', () => { FE.core.hoverOn = true; }); cb.addEventListener('blur', () => { FE.core.hoverOn = false; });
    $('btn-condense').addEventListener('click', () => FE.condense());
    $('btn-collapse').addEventListener('click', () => FE.collapse());
    $('nav-up').addEventListener('click', () => FE.goto(2));
    $('nav-down').addEventListener('click', () => FE.goto(1));

    // one tab per element, on the left
    FE.ELEMENTS.forEach(({ id, key }) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tab'; b.id = 'tab-' + id; b.dataset.el = id; b.setAttribute('role', 'tab'); b.title = `${id} (${key})`;
      b.innerHTML = `<span class="t-ico">${svg(FE.ICONS[id])}</span><span class="t-name">${id}</span><span class="t-mark" aria-hidden="true">&#9679;</span>`;
      b.addEventListener('click', () => FE.switchTo(id));
      $('tabs').appendChild(b);
    });

    // layer 2 (for now): one line per crystal
    FE.ELEMENTS.forEach(({ id }) => {
      const d = document.createElement('div');
      d.className = 'crystal'; d.dataset.el = id; d.id = 'cr-' + id;
      $('crystals').appendChild(d);
    });

    // stores: every element, in order; only the current one opens to show its rate, click and star
    FE.ELEMENTS.forEach(({ id }) => {
      const r = document.createElement('div');
      r.className = 's-row'; r.dataset.el = id; r.id = 'srow-' + id;
      r.innerHTML = `<div class="s-main"><span class="s-ico">${svg(FE.ICONS[id])}</span><span class="s-name">${id}</span><span class="s-n" id="sn-${id}">0</span></div>`
        + `<div class="s-more" id="sm-${id}"><div class="s-line" id="sr-${id}"></div><div class="s-line" id="sc-${id}"></div><div class="s-line" id="ss-${id}"></div></div>`;
      $('store-rows').appendChild(r);
    });

    // layer 2: two tabs on the left (army / stardust), units on the right
    const setTab = t => {
      $('pane-army').hidden = t !== 'army'; $('pane-dust').hidden = t !== 'stardust';
      if (t === 'army') FE.scatterDots();
      ['army', 'stardust'].forEach(k => { const b = $('l2t-' + k); b.classList.toggle('active', k === t); b.setAttribute('aria-selected', String(k === t)); });
    };
    $('l2t-army').addEventListener('click', () => setTab('army'));
    $('l2t-stardust').addEventListener('click', () => setTab('stardust'));
    FE.buildArmy();
    FE.buildTree();
    FE.buildCombat();

    FE.core.init();
    FE.goto(1, true);
  };

  // ---- the goal line ----
  function goal() {
    const s = FE.state, e = FE.E(), el = FE.el(), cost = FE.nextStarCost();
    if (s.layer2) return 'Layer 2: Raise an Army';
    if (cost == null) return 'your star is as large as it can grow. collapse it for crystals.';
    const have = e.count >= cost ? 'ready.' : `${FE.fmt(e.count)} / ${FE.fmt(cost)}.`;
    if (e.tier === 0) return `gather ${FE.fmt(cost)} ${el} and condense it into a star: ${have}`;
    return `condense a tier ${e.tier + 1} star: ${have}${e.tier >= FE.COLLAPSE_TIER ? ' or collapse this one.' : ''}`;
  }

  FE.render = function () {
    const s = FE.state, el = FE.el();
    if (!el) return;
    const e = FE.E();
    document.body.dataset.el = el;
    const names = FE.NAMES[el], cost = FE.nextStarCost(), prog = cost ? Math.min(1, e.count / cost) : 1;

    const g = $('goal');
    put(g, goal());
    g.classList.toggle('glow', s.layer2);

    // tabs: the one you are on is darkened and marked
    FE.ELEMENTS.forEach(({ id }) => {
      const t = $('tab-' + id), on = id === el;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });

    // stores (bottom left): every element in order; the current one opens
    FE.ELEMENTS.forEach(({ id }) => {
      const on = id === el;
      text('sn-' + id, FE.fmt(s.els[id].count));
      $('srow-' + id).classList.toggle('cur', on);
      $('sm-' + id).hidden = !on;
    });
    text('sr-' + el, `+${FE.fmt(FE.rate())}/s`);
    text('sc-' + el, `click: +${FE.fmt(FE.clickGain())}`);
    text('ss-' + el, e.tier ? `${FE.STAR_NAMES[e.tier]} star, tier ${e.tier} · production ×${FE.multiplier().toFixed(1)}` : `no star yet · production ×${FE.multiplier().toFixed(1)}`);

    // the star: progress, condense (not offered past tier 3), collapse
    const maxed = cost == null;
    $('cond-info').textContent = maxed ? `tier ${e.tier} star` : `tier ${e.tier + 1} star: ${FE.fmt(e.count)} / ${FE.fmt(cost)} ${el}`;
    $('cond-fill').style.width = (prog * 100).toFixed(1) + '%';
    $('stage').style.setProperty('--cm', (-(280 - FE.core.radius() * 1.3) / 560).toFixed(3));
    const cb = $('btn-condense');
    cb.hidden = maxed;
    if (!maxed) { cb.disabled = e.count < cost || FE.collapsing; text('btn-condense', e.tier === 0 ? 'condense a star' : `condense: tier ${e.tier + 1}`); }
    const col = $('btn-collapse'), armed = FE.collapseArmed && Date.now() < FE.collapseArmed;
    col.hidden = e.tier < FE.COLLAPSE_TIER;
    if (!col.hidden) {
      col.disabled = FE.collapsing;
      col.classList.toggle('armed', !!armed);
      const yc = FE.crystalYield(e.tier);
      text('btn-collapse', armed ? 'click again: the star and all progress are lost' : `collapse the star: +${yc} ${el} crystal${yc === 1 ? '' : 's'}`);
    }

    // builds (right)
    Object.keys(FE.UPS).forEach(k => {
      const card = $('up-' + k), u = FE.UPS[k], c = FE.upCost(k);
      if (e.count >= u.show || e.seen[k]) e.seen[k] = true;
      const show = !!e.seen[k];
      card.hidden = !show;
      if (!show) return;
      const [title, price, note] = card.children, n = e.up[k];
      let t, d;
      if (k === 'res') { t = `${el} resonance`; d = `click power ${FE.fmt(FE.clickPower())} → ${FE.fmt(FE.clickPower() * 2)}`; }
      else if (k === 'gath') { t = names.gath; d = `+${FE.GATHER_RATE}/s each`; }
      else if (k === 'eng') { t = names.eng; d = `+${FE.ENGINE_RATE}/s each`; }
      else { t = 'harmony'; d = 'all production ×1.5'; }
      put(title, t + (n ? ` ×${n}` : ''));
      put(price, `<span class="${e.count >= c ? 'have' : ''}">${FE.fmt(e.count)} / ${FE.fmt(c)}</span> ${el}`);
      put(note, d);
      card.disabled = e.count < c;
    });

    // elemental affinity: once per element, and for good
    const af = $('up-aff'), A = FE.AFFINITY, owned = !!s.affinity[el];
    if (e.count >= A.show || owned) e.seen.aff = true;
    af.hidden = !e.seen.aff;
    if (e.seen.aff) {
      const [at, ap, an] = af.children;
      put(at, owned ? 'elemental affinity &#10003;' : 'elemental affinity');
      put(ap, owned ? '<span class="have">unlocked for good</span>' : `<span class="${e.count >= A.cost ? 'have' : ''}">${FE.fmt(e.count)} / ${FE.fmt(A.cost)}</span> ${el}`);
      put(an, owned ? `all production of all elements ×${A.mult} &middot; permanent, it never resets, not even when a star collapses`
                    : `all production of all elements ×${A.mult} &middot; one per element, kept for good (never resets)`);
      af.disabled = owned || e.count < A.cost;
      af.classList.toggle('owned', owned);
    }

    // layer 2: the link is grey until the first crystal, then white; and the crystal counts
    const up = $('nav-up');
    up.hidden = FE.view !== 1;
    up.classList.toggle('unlocked', s.layer2);
    up.setAttribute('aria-disabled', String(!s.layer2));
    FE.ELEMENTS.forEach(({ id }) => text('cr-' + id, `${id} crystals: ${FE.fmt(s.crystals[id])}`));
    FE.renderArmy();
    FE.renderTree();
  };
});
