/* ui.js - building and drawing the page: element buttons, multiplier, stores, works, builds, balance bar, end message.
 * The spells box, the vagrant box and the threat row are drawn by combat.js. */
FE.module(function (FE) {
  const $ = FE.$, { ELEMENTS, ICONS } = FE;
  const svg = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const LOCK = '<rect x="5" y="11" width="14" height="10" rx="1.5" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/>';
  const mine = () => ELEMENTS.map(e => e.id).filter(id => FE.state.owned.includes(id));   // always air, water, earth, fire order
  // most of this runs ten times a second, so only touch the DOM when something actually changed
  const last = new WeakMap();
  const put = (el, html) => { if (last.get(el) !== html) { last.set(el, html); el.innerHTML = html; } };
  const text = (id, t) => { const el = $(id); if (el.textContent !== t) el.textContent = t; };

  // one-off: a bar segment, legend row and stores row per element, then the crystal and planet rows
  FE.buildStatic = function () {
    ELEMENTS.forEach(({ id }) => {
      const seg = document.createElement('span');
      seg.id = 'seg-' + id; seg.style.background = `var(--${id})`; seg.hidden = true;
      seg.innerHTML = `<span class="segin">${svg(ICONS[id])}<b id="segpct-${id}">0%</b></span>`;
      $('bar').appendChild(seg);
      const leg = document.createElement('div');
      leg.className = 'row'; leg.id = 'leg-' + id; leg.hidden = true;
      leg.innerHTML = `<span class="swatch" style="background:var(--${id})"></span><span>${id}</span><span class="n" id="pct-${id}">0%</span>`;
      $('legend').appendChild(leg);
      const row = document.createElement('div');
      row.className = 'row store'; row.id = 'row-' + id; row.hidden = true;
      row.innerHTML = `<span class="ink-${id}">${id}</span><span class="n" id="n-${id}">0</span><span class="per" id="per-${id}"></span>`;
      $('store-rows').appendChild(row);
    });
    [['crystal', 'tier 1 crystal'], ['planet', 'planet']].forEach(([id, label]) => {
      const row = document.createElement('div');
      row.className = 'row store'; row.id = 'row-' + id; row.hidden = true;
      row.innerHTML = `<span>${label}</span><span class="n" id="n-${id}">0</span><span class="per"></span>`;
      $('store-rows').appendChild(row);
    });
    $('cap').textContent = '/ ' + FE.CAP.toLocaleString('en-US');
    $('btn-conjure').addEventListener('click', () => FE.conjure());
    $('end-close').addEventListener('click', () => FE.hideEnd());
  };

  // Your elements (keys a w e f), then, while choosing, an "Investigate" option for each one you don't have yet
  FE.renderChoices = function () {
    const g = $('gather'), s = FE.state;
    const hadFocus = g.contains(document.activeElement);       // keep keyboard focus when the buttons are rebuilt
    g.replaceChildren();
    const add = ({ id, key }, investigate) => {
      const btn = document.createElement('button');
      btn.className = 'el pick pick-' + id + (investigate ? '' : ' solo'); btn.id = 'btn-' + id; btn.type = 'button';
      btn.innerHTML = (investigate ? `Investigate the ${FE.wordHTML(id, FE.OPTIONS[id])}` : `<span class="ico">${svg(ICONS[id])}</span>${FE.wordHTML(id, id)}`)
        + `<span class="key" aria-hidden="true">(${key})</span><span class="hang" aria-hidden="true"></span>`;
      btn.setAttribute('aria-keyshortcuts', key);
      btn.addEventListener('click', () => FE.act(id));
      g.appendChild(btn);
    };
    ELEMENTS.filter(e => s.owned.includes(e.id)).forEach(e => add(e, false));
    if (s.picking) {
      if (s.owned.length) {
        const h = document.createElement('h2');
        h.textContent = 'something else stirs.';
        g.appendChild(h);
      }
      ELEMENTS.filter(e => !s.owned.includes(e.id)).forEach(e => add(e, true));
    }
    if (hadFocus) { const b = g.querySelector('button'); if (b) b.focus(); }
  };

  // the multiplier readout changes as icons come and go, so this also runs on its own timer
  FE.updateMult = function () {
    const el = $('mult'), s = FE.state;
    if (!s.owned.length) { el.hidden = true; return; }
    el.hidden = false;
    el.style.setProperty('--c', `var(--${FE.majority()}-ink)`);
    const t = '×' + FE.multiplier().toFixed(1);
    if (el.textContent !== t) el.textContent = t;
  };

  function renderStores() {
    const s = FE.state;
    ELEMENTS.forEach(({ id }) => {
      const show = s.owned.includes(id);
      $('row-' + id).hidden = !show;
      if (!show) return;
      text('n-' + id, FE.fmt(s.counts[id]));
      text('per-' + id, s.up[id].struct ? `+${FE.fmt(FE.rate(id))}/s` : '');
    });
    $('row-crystal').hidden = !s.crystals;
    text('n-crystal', FE.fmt(s.crystals));
    $('row-planet').hidden = !s.planets;
    text('n-planet', FE.fmt(s.planets));
    $('empty').hidden = s.owned.length > 0;
  }

  // works: the structures you own and what they make right now
  function renderWorks() {
    const s = FE.state, ks = mine().filter(k => s.up[k].struct > 0);
    $('works-box').hidden = !ks.length;
    put($('works'), ks.map(k => `<div class="row"><span>${FE.STRUCT_NAMES[k]} ×${s.up[k].struct}</span>`
      + `<span class="n">+${FE.fmt(FE.rate(k))} <span class="ink-${k}">${k}</span>/s</span></div>`).join(''));
  }

  // ---- builds: per element its resonance and structure, then condense. Ones not found yet show as locks. ----
  let buildSig = null;
  function renderBuilds(total) {
    const s = FE.state, locked = total >= FE.CAP, list = [];
    mine().forEach(k => {
      if (s.counts[k] >= FE.RES_AT) s.seen['res-' + k] = true;
      if (s.counts[k] >= FE.STRUCT_AT) s.seen['struct-' + k] = true;
      list.push('res-' + k, 'struct-' + k);
    });
    if (s.owned.length) {
      if (locked) s.seen.cond = true;
      list.push('cond');
    }
    const show = list.some(b => s.seen[b]);
    $('builds-box').hidden = !show;
    if (!show) return;
    const sig = list.map(b => (s.seen[b] ? '+' : '-') + b).join();
    if (sig !== buildSig) {                                    // rebuilt only when a build is found, never mid-click
      buildSig = sig;
      $('builds').replaceChildren(...list.map(b => s.seen[b] ? card(b) : lock(b)));
    }
    list.forEach(b => { if (s.seen[b]) fill(b, locked, total); });
  }

  // one row per element (resonance | structure); condense takes a row of its own
  function card(b) {
    const [kind, k] = b.split('-');
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'card' + (kind === 'cond' ? ' wide' : ''); el.id = 'build-' + b;
    if (k) el.style.setProperty('--c', `var(--${k}-ink)`);
    el.innerHTML = '<span class="card-title"></span><span class="card-cost"></span><span class="card-note"></span>';
    el.addEventListener('click', () => kind === 'res' ? FE.buyRes(k) : kind === 'struct' ? FE.buyStruct(k) : FE.condense());
    return el;
  }
  function lock(b) {
    const el = document.createElement('div');
    el.className = 'card lock' + (b === 'cond' ? ' wide' : ''); el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'a build not found yet');
    el.innerHTML = svg(LOCK);
    return el;
  }
  // what you hold / what it costs. Only reads as affordable while buying is actually possible (never while storage is full).
  const need = (have, cost, unit, ok) => `<span class="${ok ? 'have' : ''}">${FE.fmt(have)} / ${FE.fmt(cost)}</span> ${unit}`;

  function fill(b, locked, total) {
    const s = FE.state, el = $('build-' + b), [kind, k] = b.split('-');
    const [title, cost, note] = el.children;
    let can;
    if (kind === 'res') {
      const c = FE.resCost(k), maxed = FE.resMaxed(k), p = FE.clickPower(k);
      can = !locked && !maxed && s.counts[k] >= c;
      put(title, `${k} resonance`);
      put(cost, maxed ? 'maxed' : need(s.counts[k], c, k, can));
      put(note, maxed ? `click power ${FE.fmt(p)}` : `click power ${FE.fmt(p)} → ${FE.fmt(p * 2)}`);
    } else if (kind === 'struct') {
      const c = FE.structCost(k);
      can = !locked && s.counts[k] >= c;
      put(title, FE.STRUCT_NAMES[k]);
      put(cost, need(s.counts[k], c, k, can));
      put(note, `+${FE.STRUCT_RATE} ${k}/s each`);
    } else {
      can = locked;
      put(title, 'condense');
      put(cost, need(total, FE.CAP, 'stored', can));
      put(note, s.planets ? `a crystal: +${FE.CRYSTAL_MAX_MULT} max multiplier. resets everything.`
        : 'a crystal and a planet: a new element. resets everything.');
    }
    el.disabled = !can;
  }

  // ---- balance: each element's share of what you hold ----
  function renderBalance(total) {
    const s = FE.state;
    if (!s.balanceShown && total >= FE.BALANCE_AT) s.balanceShown = true;
    $('balance-box').hidden = !s.balanceShown;
    if (!s.balanceShown) return;
    text('total', FE.fmt(total));
    const ks = mine(), barW = $('bar').clientWidth;
    ELEMENTS.forEach(({ id }) => { $('seg-' + id).hidden = $('leg-' + id).hidden = !ks.includes(id); });
    const shares = ks.map(k => ({ k, share: total > 0 ? Math.max(0, s.counts[k]) / total : 0 }));
    shares.forEach(({ k, share }, i) => {
      const seg = $('seg-' + k);
      const pct = share <= 0 ? '0%' : share < 0.01 ? '<1%' : Math.round(share * 100) + '%';
      seg.style.width = (share * 100).toFixed(2) + '%';
      // thin divider only between two visible segments, so there are no stray dark edges
      seg.style.borderRightWidth = (share > 0 && shares.slice(i + 1).some(x => x.share > 0)) ? '1px' : '0';
      text('segpct-' + k, pct);
      text('pct-' + k, pct);
      // hide the label (icon + %) whenever the segment is too thin to hold all of it, at any screen width
      seg.classList.toggle('narrow', share * barW < seg.firstChild.offsetWidth + 8);
    });
    const top = FE.majority();
    put($('status'), total <= 0 ? 'empty.' : ks.length > 1 && FE.imbalance() < 0.15 ? 'even.'
      : `<span class="ink-${top}">${FE.FLAVOR[top]}.</span>`);
  }

  FE.render = function () {
    const s = FE.state, total = FE.totalCount();
    renderStores();
    renderWorks();
    renderBuilds(total);
    renderBalance(total);
    s.owned.forEach(k => { const b = $('btn-' + k); if (b) b.disabled = total >= FE.CAP; });
    FE.renderCombat(total);
    FE.updateMult();
  };

  // ---- end of the prototype: shown once, when the 3rd element is found. The game keeps running behind it. ----
  const clock = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  FE.showEnd = function () {
    const s = FE.state;
    s.ended = true;
    $('end-stats').textContent = `${clock(s.played)} played · ${plural(s.conjured, 'spell')} conjured · ${plural(s.kills, 'vagrant')} beaten`;
    $('end-overlay').hidden = false;
    $('end-close').focus();
  };
  FE.hideEnd = function () {
    if ($('end-overlay').hidden) return;
    $('end-overlay').hidden = true;
    const b = $('gather').querySelector('button');
    if (b) b.focus();
  };
});
