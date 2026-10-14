/* ui.js - building and drawing the page: choices, multiplier, stores, balance bar. */
(function (FE) {
  const $ = FE.$, { ELEMENTS, ICONS } = FE;

  // one-off: bar segments + legend (elements then emptiness) and the stores rows
  FE.buildStatic = function () {
    ELEMENTS.forEach(({ id }) => {
      const seg = document.createElement('span');
      seg.id = 'seg-' + id; seg.style.background = `var(--${id})`;
      seg.innerHTML = `<span class="segin"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id]}</svg><b id="segpct-${id}">0%</b></span>`;
      $('bar').appendChild(seg);
      const row = document.createElement('div');
      row.className = 'row';
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

    ELEMENTS.forEach(({ id }) => {
      const r = document.createElement('div');
      r.className = 'row'; r.id = 'row-' + id; r.hidden = true;
      r.innerHTML = `<span>${id}</span><span class="n" id="n-${id}">0</span>`;
      $('store-rows').appendChild(r);
    });
  };

  // four "Investigate" options at first; afterwards only the chosen element, bound to the 1 key
  FE.renderChoices = function () {
    const g = $('gather'), chosen = FE.state.chosen;
    g.replaceChildren();
    ELEMENTS.filter(e => !chosen || e.id === chosen).forEach(({ id, key }) => {
      const shown = chosen ? '1' : key;
      const btn = document.createElement('button');
      btn.className = 'el pick pick-' + id + (chosen ? ' solo' : ''); btn.id = 'btn-' + id; btn.type = 'button';
      btn.innerHTML = (chosen ? FE.wordHTML(id, id) : `Investigate the ${FE.wordHTML(id, FE.OPTIONS[id])}`)
        + `<span class="key" aria-hidden="true">${shown}</span>`;
      btn.setAttribute('aria-keyshortcuts', shown);
      btn.addEventListener('click', () => FE.act(id));
      g.appendChild(btn);
    });
  };

  FE.updateMult = function () {
    const el = $('mult'), chosen = FE.state.chosen;
    if (!chosen) { el.hidden = true; return; }
    el.hidden = false;
    el.style.setProperty('--c', `var(--${chosen})`);
    const t = '×' + FE.multiplier().toFixed(1);
    if (el.textContent !== t) el.textContent = t;
  };

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
    $('empty').hidden = anyStore;

    const total = FE.totalCount();
    const denom = Math.max(FE.CAP, total), empty = Math.max(0, FE.round1(FE.CAP - total));
    if (!s.balanceShown && total >= FE.BALANCE_AT) s.balanceShown = true;
    $('balance-box').hidden = !s.balanceShown;
    $('total').textContent = FE.fmt(total);

    const shares = ELEMENTS.map(({ id }) => ({ id, share: Math.max(0, s.counts[id]) / denom }));
    shares.push({ id: 'void', share: empty / denom });
    shares.forEach(({ id, share }, i) => {
      const pct = Math.round(share * 100) + '%';
      const seg = $('seg-' + id);
      seg.style.width = (share * 100).toFixed(2) + '%';
      seg.classList.toggle('narrow', share < 0.1);
      // thin divider only between two visible segments, so there are no stray dark edges
      seg.style.borderRightWidth = (share > 0 && shares.slice(i + 1).some(x => x.share > 0)) ? '1px' : '0';
      $('segpct-' + id).textContent = pct;
      $('pct-' + id).textContent = pct;
    });
    $('seg-void').classList.toggle('gone', empty <= 0);
    $('row-void').classList.toggle('gone', empty <= 0);

    const btn = s.chosen && $('btn-' + s.chosen);
    if (btn) btn.disabled = total >= FE.CAP;
    FE.updateMult();
  };
})(window.FE);
