/* ui.js - building and drawing the page: the two layers and the way between them, the element tabs, the builds, the
 * stores, the goal line, the layer 2 crystal counts, and small notices. The star itself is drawn by effects.js, the space
 * around it by space.js, and the quest / mini-game panel and notices by quests.js. */
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
    pages.scrollTop = 0; pages.scrollLeft = 0;                // (belt and braces: the pages must never be scrolled out of place)
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

    // the round button / star: a click gathers; holding the mouse down clicks 10 times a second (holding the space bar does too: controls.js)
    const cb = $('core-btn');
    let hold = null, hx = 0, hy = 0;
    const aim = e => { [hx, hy] = FE.core.toLocal(e.clientX, e.clientY); };           // measured from the middle of the star
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
    cb.addEventListener('click', e => { if (e.detail === 0) FE.gather(); });          // the keyboard: Enter
    cb.addEventListener('pointerenter', () => { FE.core.hoverOn = true; });
    cb.addEventListener('pointerleave', () => { FE.core.hoverOn = false; });
    cb.addEventListener('focus', () => { FE.core.hoverOn = true; }); cb.addEventListener('blur', () => { FE.core.hoverOn = false; });
    $('cbtn').addEventListener('click', () => FE.space.startCondense());          // the hands do the rest (space.js), then FE.condense runs
    $('btn-collapse').addEventListener('click', () => FE.collapse());
    $('exo-btns').addEventListener('click', ev => {                                    // neutron star / black hole / antimatter buttons
      const b = ev.target.closest('button[data-act]');
      if (!b || b.disabled) return;
      const a = b.dataset.act;
      if (a === 'exo') FE.goExotic(); else if (a === 'extend') FE.extendHole(); else if (a === 'amplify') FE.amplifyHole(); else if (a === 'ignite') FE.reignite(+b.dataset.tier);
    });
    $('testing-btn').addEventListener('click', () => {                              // TESTING ONLY (it sits in the settings menu)
      $('settings-close').click();                                                  // close the menu first, so the toast and layer 2 are seen
      FE.testingUnlock();
    });
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

    // layer 2: two tabs on the left (army / echoes), units on the right
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
    FE.buildSpace();          // the background and what orbits (space.js)
    FE.buildQuests();         // the panel, quests and notices (quests.js)
    FE.buildMinigames();      // (minigames.js)
    FE.goto(1, true);
  };

  // ---- the goal line ----
  const readyToCondense = () => { const e = FE.E(), c = FE.nextStarCost(); return c != null && !e.exo && !e.strange && e.count >= c; };
  function goal() {
    const s = FE.state, e = FE.E(), el = FE.el(), cost = FE.nextStarCost();
    if (readyToCondense()) return e.tier === 0 ? 'Hark! The elements are gathered. Condense thy star now, noble one, ere the moment doth pass.' : `Lo! Thy star is ripe for ascension. Condense it, brave soul, and behold a tier ${e.tier + 1} star.`;
    if (e.exo) return `your ${el} star is a ${FE.EXO[e.exo.kind].name}: click it for antimatter.`;
    if (e.strange) return 'a strange star: everything you hold is draining into strange matter.';
    if (s.layer2) return 'Layer 2: Raise an Army';
    if (cost == null) return 'your star is as large as it can grow. collapse it for crystals.';
    const have = e.count >= cost ? 'ready.' : `${FE.fmt(e.count)} / ${FE.fmt(cost)}.`;
    if (e.tier === 0) return `gather ${FE.fmt(cost)} ${el} and condense it into a star: ${have}`;
    return `condense a tier ${e.tier + 1} star: ${have}${e.tier >= FE.COLLAPSE_TIER ? ' or collapse this one.' : ''}`;
  }

  // the neutron star / black hole / antimatter buttons under the star
  function exoButtons(s, e, el) {
    const b = [];
    if (FE.canExo()) {
      const k = FE.exoKind(e), d = FE.EXO[k];
      b.push(`<button type="button" class="el wide exo" data-act="exo" title="${d.dur} s of antimatter: ${d.passive}/s and ${d.click} a click. ${el} stops.">compress into a ${d.name}</button>`);
    }
    if (e.exo && e.exo.kind === 'hole') {
      b.push(`<button type="button" class="el wide sm" data-act="extend" ${s.strangeCrystals < 1 ? 'disabled' : ''}>+${FE.EXO_EXTEND} s (1 strange crystal)</button>`);
      b.push(`<button type="button" class="el wide sm" data-act="amplify" ${s.strangeCrystals < 1 ? 'disabled' : ''}>antimatter ×${FE.EXO_AMPLIFY} (1 strange crystal)</button>`);
    }
    if (!e.exo && !e.strange && s.antimatter > 0) {
      for (let t = 1; t < FE.REIGNITE.length; t++) {
        if (e.tier >= t) continue;
        b.push(`<button type="button" class="el wide sm" data-act="ignite" data-tier="${t}" ${s.antimatter < FE.REIGNITE[t] ? 'disabled' : ''}>light a tier ${t} star: ${FE.fmt(FE.REIGNITE[t])} antimatter</button>`);
      }
    }
    return b.join('');
  }

  // The condense panel sits under the star (space.css), but it must never run into the condense circle at the bottom of the
  // page: on a short screen, or with a row of antimatter buttons, it moves up over the star's glow instead.
  function fitCond() {
    const cd = $('cond');
    if (FE.view !== 1 || $('cbtn').hidden || matchMedia('(max-width: 860px)').matches) { if (cd.style.top) cd.style.top = ''; return; }
    const sh = $('stage').clientHeight, sr = FE.core.radius() * FE.core.s;
    const natural = sh / 2 + sr * 1.3 + 52, limit = $('altar').offsetTop - 10 - cd.offsetHeight;
    const t = Math.round(Math.max(sh / 2 + sr * 1.05, Math.min(natural, limit))) + 'px';
    if (cd.style.top !== t) cd.style.top = t;
  }

  FE.render = function () {
    const s = FE.state, el = FE.el();
    if (!el) return;
    const e = FE.E();
    document.body.dataset.el = el;
    if (e.strange) document.body.dataset.strange = '1'; else delete document.body.dataset.strange;
    const names = FE.NAMES[el], cost = FE.nextStarCost(), prog = cost ? Math.min(1, e.count / cost) : 1;

    const g = $('goal');
    put(g, goal());
    g.classList.toggle('glow', s.layer2);
    g.classList.toggle('ready', readyToCondense());

    // tabs: the one you are on is darkened and marked
    FE.ELEMENTS.forEach(({ id }) => {
      const t = $('tab-' + id), on = id === el, st = s.els[id];
      t.classList.toggle('active', on);
      t.classList.toggle('exo', !!st.exo); t.classList.toggle('strange', !!st.strange);
      t.setAttribute('aria-selected', String(on));
    });

    // stores (bottom left): every element in order; the current one opens
    FE.ELEMENTS.forEach(({ id }) => {
      const on = id === el;
      text('sn-' + id, FE.fmt(s.els[id].count));
      $('srow-' + id).classList.toggle('cur', on);
      $('sm-' + id).hidden = !on;
    });
    text('sr-' + el, e.exo ? `makes no ${el}: antimatter +${FE.fmt(FE.exoPassive(e))}/s` : `+${FE.fmt(FE.rate())}/s`);
    text('sc-' + el, e.exo ? `click: +${FE.fmt(FE.exoClick(e))} antimatter` : `click: +${FE.fmt(FE.clickGain())}`);
    text('ss-' + el, e.exo ? `${FE.EXO[e.exo.kind].name} · ${Math.ceil(FE.exoLeft(e))} s left`
      : e.tier ? `${FE.STAR_NAMES[e.tier]} star, tier ${e.tier} · production ×${FE.multiplier().toFixed(1)}` : `no star yet · production ×${FE.multiplier().toFixed(1)}`);

    // the star: progress (the ring in space.js; the bar is hidden), condense (not offered past tier 3), collapse
    const maxed = cost == null || !!e.exo || !!e.strange;
    $('cond-info').textContent = e.exo ? `${FE.EXO[e.exo.kind].name}: ${Math.ceil(FE.exoLeft(e))} s left` : e.strange ? `strange star: ${Math.max(0, Math.ceil((e.strange.end - Date.now()) / 1000))} s left`
      : maxed ? `tier ${e.tier} star` : `tier ${e.tier + 1} star: ${FE.fmt(e.count)} / ${FE.fmt(cost)} ${el}`;
    $('cond-fill').style.width = (prog * 100).toFixed(1) + '%';
    $('stage').style.setProperty('--sr', (FE.core.radius() * FE.core.s).toFixed(1) + 'px');          // the star's radius on screen: the condense panel sits just under it
    $('stage').classList.toggle('ready', !maxed && prog >= 1);
    const cb = $('cbtn');
    cb.hidden = maxed;
    if (!maxed) { cb.disabled = e.count < cost || FE.collapsing || FE.condensing; cb.setAttribute('aria-label', e.count < cost ? `the condense circle is filling: ${Math.floor(prog * 100)}%` : `condense a tier ${e.tier + 1} star`); }
    const col = $('btn-collapse'), armed = FE.collapseArmed && Date.now() < FE.collapseArmed;
    col.hidden = e.tier < FE.COLLAPSE_TIER || !!e.strange;
    if (!col.hidden) {
      col.disabled = FE.collapsing;
      col.classList.toggle('armed', !!armed);
      const yc = FE.crystalYield(e.tier);
      text('btn-collapse', armed ? 'click again: the star and all progress are lost' : `collapse the star: +${yc} ${el} crystal${yc === 1 ? '' : 's'}`);
    }
    put($('exo-btns'), exoButtons(s, e, el));
    fitCond();

    // builds (right)
    Object.keys(FE.UPS).forEach(k => {
      const card = $('up-' + k), u = FE.UPS[k], c = FE.upCost(k);
      if ((e.count >= u.show && (!u.needAM || s.antimatter > 0)) || e.seen[k]) e.seen[k] = true;
      const show = !!e.seen[k];
      card.hidden = !show;
      if (!show) return;
      const [title, price, note] = card.children, n = e.up[k];
      let t, d;
      if (k === 'res') { t = `${el} resonance`; d = `click power ${FE.fmt(FE.clickPower())} → ${FE.fmt(FE.clickPower() * FE.CLICK_GROWTH)}`; }
      else if (k === 'gath') { t = names.gath; d = `+${FE.GATHER_RATE}/s each`; }
      else if (k === 'eng') { t = names.eng; d = `+${FE.ENGINE_RATE}/s each`; }
      else if (k === 'conduit') { t = 'conduit'; d = `each click also adds ${Math.round(FE.CONDUIT_PCT * 100)}% of your production per second`; }
      else if (k === 'siphon') { t = 'antimatter siphon'; d = `+${FE.SIPHON_RATE} antimatter per second each, with or without a neutron star`; }
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
    up.hidden = FE.view !== 1 || !s.layer2;                       // no link to a layer that is not open yet
    up.classList.toggle('unlocked', s.layer2);
    up.setAttribute('aria-disabled', String(!s.layer2));
    FE.ELEMENTS.forEach(({ id }) => { const el = $('cr-' + id), h = `${id} crystals: ${FE.fmt(s.crystals[id])}${FE.gemHtml(id)}`; if (el._h !== h) { el._h = h; el.innerHTML = h; } });
    { const el = $('echo-total'), h = `Echoes: ${FE.fmt(s.stardust)}${FE.echoIcon}`; if (el._h !== h) { el._h = h; el.innerHTML = h; } }
    FE.renderHud();
    FE.renderPanel();
    FE.renderArmy();
    FE.renderTree();
  };
});
