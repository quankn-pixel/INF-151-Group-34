/* ui.js - building and drawing the page: choices, multiplier, stores, upgrades, balance bar. */
(function (FE) {
  const $ = FE.$, { ELEMENTS, ICONS } = FE;

  // one-off: bar segments + legend (elements then emptiness), stores rows, upgrade buttons
  FE.buildStatic = function () {
    ELEMENTS.forEach(({ id }) => {
      const seg = document.createElement('span');
      seg.id = 'seg-' + id; seg.style.background = `var(--${id})`;
      seg.innerHTML = `<span class="segin"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id]}</svg><b id="segpct-${id}">0%</b></span>`;
      $('bar').appendChild(seg);
      const row = document.createElement('div');
      row.className = 'row'; row.id = 'leg-' + id;
      row.innerHTML = `<span class="swatch" style="background:var(--${id})"></span><span>${id}</span><span class="n" id="pct-${id}">0%</span>`;
      $('legend').appendChild(row);
    });
    // emptiness: acts like an element in the bar, but has no icon
    const seg = document.createElement('span');
    seg.id = 'seg-void'; seg.style.background = 'var(--void)';
    seg.innerHTML = `<span class="segin"><b id="segpct-void">100%</b></span>`;
    $('bar').appendChild(seg);
    const row = document.createElement('div');
    row.className = 'row'; row.id = 'row-void';
    row.innerHTML = `<span class="swatch" style="background:var(--void)"></span><span>emptiness</span><span class="n" id="pct-void">100%</span>`;
    $('legend').appendChild(row);
    $('cap').textContent = '/ ' + FE.CAP.toLocaleString('en-US');

    ELEMENTS.forEach(({ id }) => {
      const r = document.createElement('div');
      r.className = 'row'; r.id = 'row-' + id; r.hidden = true;
      r.innerHTML = `<span>${id}</span><span class="n" id="n-${id}">0</span>`;
      $('store-rows').appendChild(r);
    });
    const cr = document.createElement('div');
    cr.className = 'row'; cr.id = 'row-crystal'; cr.hidden = true;
    cr.innerHTML = `<span id="crystal-label">tier 1 crystal</span><span class="n" id="n-crystal">0</span>`;
    $('store-rows').appendChild(cr);

    $('cond-note').textContent = `(+${FE.CRYSTAL_MAX_MULT.toFixed(1)} max multiplier each)`;
    $('btn-res').addEventListener('click', () => FE.buyRes());
    $('btn-struct').addEventListener('click', () => FE.buyStruct());
    $('btn-cond').addEventListener('click', () => FE.condense());
  };

  // four "Investigate" options at first; afterwards only the chosen element, bound to the 1 key
  FE.renderChoices = function () {
    const g = $('gather'), chosen = FE.state.chosen;
    const hadFocus = g.contains(document.activeElement);       // keep keyboard focus when the buttons are rebuilt
    g.replaceChildren();
    ELEMENTS.filter(e => !chosen || e.id === chosen).forEach(({ id, key }) => {
      const shown = chosen ? '1' : key;
      const btn = document.createElement('button');
      btn.className = 'el pick pick-' + id + (chosen ? ' solo' : ''); btn.id = 'btn-' + id; btn.type = 'button';
      btn.innerHTML = (chosen ? FE.wordHTML(id, id) : `Investigate the ${FE.wordHTML(id, FE.OPTIONS[id])}`)
        + `<span class="key" aria-hidden="true">${shown}</span><span class="hang" aria-hidden="true"></span>`;
      btn.setAttribute('aria-keyshortcuts', shown);
      btn.addEventListener('click', () => FE.act(id));
      g.appendChild(btn);
    });
    if (hadFocus && g.firstChild) g.firstChild.focus();
  };

  // the multiplier readout and the structures' live rate change as icons come and go, so this runs on a timer
  FE.updateMult = function () {
    const el = $('mult'), s = FE.state, chosen = s.chosen;
    if (!chosen) { el.hidden = true; return; }
    el.hidden = false;
    el.style.setProperty('--c', `var(--${chosen}-ink)`);
    const m = FE.multiplier();
    const t = '×' + m.toFixed(1);
    if (el.textContent !== t) el.textContent = t;
    const owned = s.up.struct;
    $('struct-info').textContent = `owned ${owned} · +${FE.fmt(owned * FE.STRUCT_RATE * m)}/s`;
  };

  function renderUpgrades(total) {
    const s = FE.state, c = s.chosen, n = c ? s.counts[c] : 0, locked = total >= FE.CAP;
    if (c && n >= FE.RES_AT) s.seen.res = true;
    if (c && n >= FE.STRUCT_AT) s.seen.struct = true;
    if (locked) s.seen.cond = true;
    $('up-res').hidden = !s.seen.res;
    $('up-struct').hidden = !s.seen.struct;
    $('up-cond').hidden = !s.seen.cond;
    $('upgrades-box').hidden = !(s.seen.res || s.seen.struct || s.seen.cond);
    if (!c) return;
    $('upgrades-box').style.setProperty('--c', `var(--${c}-ink)`);

    // costs only read as affordable while buying is actually possible (never while storage is full)
    const rc = FE.resCost(), resMax = FE.resMaxed();
    $('btn-res').textContent = `${c} resonance`;
    $('btn-res').disabled = locked || resMax || n < rc;
    $('res-power').textContent = `click power ${FE.fmt(FE.clickPower())}`;
    $('res-cost').innerHTML = resMax ? 'maxed · the next level would cost more than storage can hold'
      : `cost <span class="${n >= rc && !locked ? 'have' : ''}">${FE.fmt(rc)} ${c}</span> · doubles click power`;

    const sc = FE.structCost();
    $('btn-struct').textContent = FE.STRUCT_NAMES[c];
    $('btn-struct').disabled = locked || n < sc;
    $('struct-cost').innerHTML = `cost <span class="${n >= sc && !locked ? 'have' : ''}">${FE.fmt(sc)} ${c}</span> · makes ${FE.STRUCT_RATE} ${c}/s each, scales with multiplier`;

    $('btn-cond').textContent = `condense a tier 1 ${c} crystal`;
    $('btn-cond').disabled = !locked;
  }

  FE.render = function () {
    const s = FE.state;
    let anyStore = false;
    ELEMENTS.forEach(({ id }) => {
      const n = s.counts[id];
      $('n-' + id).textContent = FE.fmt(n);
      const show = n >= 0.1 || s.clicked[id];
      $('row-' + id).hidden = !show;
      if (show) anyStore = true;
    });
    $('row-crystal').hidden = s.crystals <= 0;
    if (s.crystals > 0) {
      anyStore = true;
      $('n-crystal').textContent = FE.fmt(s.crystals);
      $('crystal-label').textContent = `tier 1 ${s.chosen} crystal`;
    }
    $('empty').hidden = anyStore;

    const total = FE.totalCount();
    const denom = Math.max(FE.CAP, total), empty = Math.max(0, FE.round1(FE.CAP - total));
    if (!s.balanceShown && total >= FE.BALANCE_AT) s.balanceShown = true;
    $('balance-box').hidden = !s.balanceShown;
    $('total').textContent = FE.fmt(total);

    // only your own element appears in the bar and legend; percentages round DOWN so it reads 0% until 1,000
    const shares = ELEMENTS.map(({ id }) => ({ id, share: Math.max(0, s.counts[id]) / denom }));
    shares.push({ id: 'void', share: empty / denom });
    const pcts = {}, barW = $('bar').clientWidth;
    let used = 0;
    shares.forEach(({ id, share }) => { if (id !== 'void') { pcts[id] = Math.floor(share * 100 + 1e-9); used += pcts[id]; } });
    pcts.void = Math.max(0, 100 - used);                       // elements + emptiness always read as 100%
    shares.forEach(({ id, share }, i) => {
      const mine = id === 'void' || id === s.chosen;
      const seg = $('seg-' + id);
      seg.hidden = !mine;
      if (id !== 'void') $('leg-' + id).hidden = !mine;
      seg.style.width = (share * 100).toFixed(2) + '%';
      // thin divider only between two visible segments, so there are no stray dark edges
      seg.style.borderRightWidth = (share > 0 && shares.slice(i + 1).some(x => x.share > 0)) ? '1px' : '0';
      $('segpct-' + id).textContent = pcts[id] + '%';
      $('pct-' + id).textContent = pcts[id] + '%';
      // hide the label (icon + %) whenever the segment is too thin to hold all of it, at any screen width
      seg.classList.toggle('narrow', share * barW < seg.firstChild.offsetWidth + 8);
    });
    $('seg-void').classList.toggle('gone', empty <= 0);
    $('row-void').classList.toggle('gone', empty <= 0);

    const btn = s.chosen && $('btn-' + s.chosen);
    if (btn) btn.disabled = total >= FE.CAP;
    renderUpgrades(total);
    FE.updateMult();
  };
})(window.FE);
