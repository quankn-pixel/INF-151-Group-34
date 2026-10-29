/* ui.js - building and drawing the page: goal line, element buttons, multiplier, stores, works, builds (in pages),
 * balance bar, end message. The spells box, the vagrant box and the threat row are drawn by combat.js. */
FE.module(function (FE) {
  const $ = FE.$, { ELEMENTS, ICONS } = FE;
  const svg = inner => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
  const LOCK = '<rect x="5" y="11" width="14" height="10" rx="1.5" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/>';
  const ids = ELEMENTS.map(e => e.id);
  const isElement = r => ids.includes(r);
  const mine = () => ids.filter(id => FE.state.owned.includes(id));      // always air, water, earth, fire order
  const inPlay = () => ids.filter(id => FE.present().includes(id));      // same, plus a 4th element a converter made
  // most of this runs ten times a second, so only touch the DOM when something actually changed
  const last = new WeakMap();
  const put = (el, html) => { if (last.get(el) !== html) { last.set(el, html); el.innerHTML = html; } };
  const text = (id, t) => { const el = $(id); if (el.textContent !== t) el.textContent = t; };
  const perSec = n => Math.abs(n) < 0.05 ? '' : `${n > 0 ? '+' : '−'}${FE.fmt(Math.abs(n))}/s`;
  const named = r => isElement(r) ? `<span class="ink-${r}">${r}</span>` : r;
  const amounts = rates => Object.entries(rates).map(([r, v]) => `${FE.fmt(v)} ${named(r)}`).join(' + ');
  const condition = id => { const [k, at] = FE.converter(id).when; return `${k} over ${Math.round(at * 100)}%`; };

  // one-off: a bar segment, legend row and stores row per element, then materials, crystal and planet rows
  FE.buildStatic = function () {
    const storeRow = (id, label) => {
      const row = document.createElement('div');
      row.className = 'row store'; row.id = 'row-' + id; row.hidden = true;
      row.innerHTML = `<span>${label}</span><span class="n" id="n-${id}">0</span><span class="per" id="per-${id}"></span>`;
      $('store-rows').appendChild(row);
    };
    ELEMENTS.forEach(({ id }) => {
      const seg = document.createElement('span');
      seg.id = 'seg-' + id; seg.style.background = `var(--${id})`; seg.hidden = true;
      seg.innerHTML = `<span class="segin">${svg(ICONS[id])}<b id="segpct-${id}">0%</b></span>`;
      $('bar').appendChild(seg);
      const leg = document.createElement('div');
      leg.className = 'row'; leg.id = 'leg-' + id; leg.hidden = true;
      leg.innerHTML = `<span class="swatch" style="background:var(--${id})"></span><span>${id}</span><span class="n" id="pct-${id}">0%</span>`;
      $('legend').appendChild(leg);
      storeRow(id, named(id));
    });
    FE.MATERIALS.forEach(m => storeRow(m, m));
    storeRow('crystal', 'tier 1 crystal');
    storeRow('crystal2', 'tier 2 crystal');
    storeRow('planet', 'planet');
    $('cap').textContent = '/ ' + FE.CAP.toLocaleString('en-US');
    $('btn-conjure').addEventListener('click', () => FE.conjure());
    $('end-close').addEventListener('click', () => FE.hideEnd());
    $('pg-prev').addEventListener('click', () => FE.showBuildsPage(page - 1));
    $('pg-next').addEventListener('click', () => FE.showBuildsPage(page + 1));
    $('works').addEventListener('click', e => {
      const b = e.target.closest('button[data-key]');
      if (b) FE.toggleWork(b.dataset.key);
    });
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

  // ---- the goal line under the title: the next thing to do ----
  function goal(total) {
    const s = FE.state, n = s.owned.length;
    if (s.picking) return n ? `investigate a ${n === 1 ? 'second' : 'third'} element.` : 'investigate one of the elements.';
    if (s.enemy) return s.enemy.leader ? 'defeat the vagrant leader: conjure a spell, then cast it.' : 'a vagrant is here: cast a spell before it raids you.';
    if (n === 1) return total >= FE.CAP ? 'condense your stores.' : `fill your stores: ${FE.fmt(total)} / ${FE.fmt(FE.CAP)}.`;
    if (n === 2) {
      if (!s.forge) return `build the ${FE.FORGE_NAME}: ${FE.fmt(FE.FORGE_COST)} each of ${s.owned.join(' and ')}.`;
      if (s.leaderIn != null) return 'conjure a spell. something is coming.';
      if (!s.leaderBeaten) return 'the vagrant leader will be back. keep a spell ready.';
      return total >= FE.TIER2_AT ? 'condense into a tier 2 crystal.'
        : `build vaults and fill your stores for a tier 2 crystal: ${FE.fmt(total)} / ${FE.fmt(FE.TIER2_AT)}.`;
    }
    return 'explore Yetzirah: work the elements into materials, and keep the vagrants off.';
  }

  function renderStores() {
    const s = FE.state, play = inPlay();
    ids.forEach(id => {
      const show = play.includes(id);
      $('row-' + id).hidden = !show;
      if (!show) return;
      text('n-' + id, FE.fmt(s.counts[id]));
      text('per-' + id, perSec(FE.rate(id) + FE.convFlow(id)));
    });
    FE.MATERIALS.forEach(m => {
      const show = FE.makeable(m) || s.mats[m] > 0;
      $('row-' + m).hidden = !show;
      if (!show) return;
      text('n-' + m, FE.fmt(s.mats[m]));
      text('per-' + m, perSec(FE.convFlow(m)));
    });
    $('row-crystal').hidden = !s.crystals;
    text('n-crystal', FE.fmt(s.crystals));
    $('row-crystal2').hidden = !s.crystals2;
    text('n-crystal2', FE.fmt(s.crystals2));
    $('row-planet').hidden = !s.planets;
    text('n-planet', FE.fmt(s.planets));
    $('empty').hidden = s.owned.length > 0;
  }

  // ---- works: what runs by itself, each with an on/off switch. Rows are rebuilt only when the list changes, so a
  // switch never vanishes under the pointer. ----
  let worksSig = null;
  function renderWorks() {
    const s = FE.state;
    const keys = mine().filter(k => s.up[k].struct > 0).map(k => 'struct-' + k)
      .concat(FE.CONVERTERS.filter(c => s.conv[c.id] > 0).map(c => c.id));
    $('works-box').hidden = !keys.length;
    if (keys.join() !== worksSig) {
      worksSig = keys.join();
      $('works').replaceChildren(...keys.map(key => {
        const row = document.createElement('div');
        row.className = 'row work'; row.id = 'work-' + key;
        row.innerHTML = '<span></span><span class="n"></span><button class="link" type="button"></button>';
        row.lastChild.dataset.key = key;
        return row;
      }));
    }
    keys.forEach(key => {
      const [name, out, toggle] = $('work-' + key).children, off = !!s.off[key];
      if (key.startsWith('struct-')) {
        const k = key.slice('struct-'.length);
        put(name, `${FE.STRUCT_NAMES[k]} ×${s.up[k].struct}`);
        put(out, off ? '<span class="idle">—</span>' : `+${FE.fmt(FE.rate(k))} ${named(k)}/s`);
      } else {
        const st = FE.convState[key] || {};
        put(name, `${FE.converter(key).name} ×${s.conv[key]}`);
        put(out, st.make ? Object.entries(st.make).map(([r, v]) => `+${FE.fmt(v)} ${named(r)}/s`).join(' ')
          : off ? '<span class="idle">—</span>' : `<span class="blocked">${st.why || 'starting'}</span>`);
      }
      if (toggle.textContent !== (off ? 'off' : 'on')) toggle.textContent = off ? 'off' : 'on';
      toggle.setAttribute('aria-pressed', String(!off));
      toggle.title = off ? 'switch on' : 'switch off';
    });
  }

  // ---- builds, in pages (the target's arrows and dots). Page 0: each element's resonance and structure, then
  // condense, with locks for the ones not found yet. Pages 1 and 2 open with the 3rd element. ----
  const PAGES = ['elements', 'converters', 'upgrades'];
  // what each page lists. From the 3rd element on all of it is open; in Layer 2 only what your two elements can build
  const listFor = name => {
    const s = FE.state;
    if (name === 'converters') return FE.CONVERTERS.filter(c => FE.available(c)).map(c => 'conv-' + c.id);
    if (name === 'upgrades') return (FE.makeable('metal') ? mine().map(k => 'fit-' + k) : [])
      .concat(FE.makeable('glass') ? 'lenses' : [], FE.makeable('gold') ? 'gilding' : [], mine().includes('water') ? 'quench' : []);
    return mine().flatMap(k => ['res-' + k, 'struct-' + k])
      .concat(s.planets ? 'vault' : [], s.owned.length >= 2 ? 'forge' : [], s.owned.length ? 'cond' : []);
  };
  const open = () => PAGES.filter(n => n === 'elements' || (FE.crafting() && listFor(n).length > 0));   // pages with something on them
  const pages = () => open().length;
  let page = 0, buildSig = null, pagerSig = null;
  FE.showBuildsPage = function (n) {
    page = Math.max(0, Math.min(pages() - 1, n));
    FE.render();
  };

  function renderBuilds(total) {
    const s = FE.state, locked = total >= FE.CAP;
    mine().forEach(k => {
      if (s.counts[k] >= FE.RES_AT) s.seen['res-' + k] = true;
      if (s.counts[k] >= FE.STRUCT_AT) s.seen['struct-' + k] = true;
    });
    if (s.owned.length && locked) s.seen.cond = true;
    if (s.planets) s.seen.vault = true;
    if (s.owned.length >= 2) s.seen.forge = true;
    if (page >= pages()) page = 0;                             // after a restart
    const name = open()[page], list = listFor(name);
    const shown = b => name !== 'elements' || s.seen[b];
    const show = pages() > 1 || list.some(shown);
    $('builds-box').hidden = !show;
    if (!show) return;
    const sig = name + ':' + list.map(b => (shown(b) ? '+' : '-') + b).join();
    if (sig !== buildSig) {                                    // rebuilt only on a new page or a new find, never mid-click
      buildSig = sig;
      $('builds').replaceChildren(...list.map(b => shown(b) ? card(b) : lock(b)));
    }
    list.forEach(b => { if (shown(b)) fill(b, locked, total); });
    renderPager();
  }

  function renderPager() {
    const n = pages();
    $('pager').hidden = n < 2;
    if (n < 2 || pagerSig === n + ':' + page) return;
    pagerSig = n + ':' + page;
    $('pg-dots').replaceChildren(...open().map((name, i) => {
      const d = document.createElement('button');
      d.type = 'button'; d.className = 'dot' + (i === page ? ' on' : '');
      d.setAttribute('aria-label', name);
      if (i === page) d.setAttribute('aria-current', 'page');
      d.addEventListener('click', () => FE.showBuildsPage(i));
      return d;
    }));
    $('pg-name').textContent = open()[page];
    $('pg-prev').disabled = page === 0;
    $('pg-next').disabled = page === n - 1;
  }

  // one row per element on the first page (resonance | structure); condense and the flask take a row of their own
  function card(b) {
    const [kind, k] = b.split('-');
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'card' + (kind === 'cond' ? ' wide' : ''); el.id = 'build-' + b;
    // colour: the element it's about, or for a converter the element it makes or needs to lead the bar
    const c = kind === 'conv' && FE.converter(k);
    const tint = c ? (c.when ? c.when[0] : Object.keys(c.make)[0]) : kind === 'quench' ? 'water' : k;
    if (isElement(tint)) el.style.setProperty('--c', `var(--${tint}-ink)`);
    el.innerHTML = '<span class="card-title"></span><span class="card-cost"></span><span class="card-note"></span>';
    const act = {
      res: () => FE.buyRes(k), struct: () => FE.buyStruct(k), cond: () => FE.condense(), conv: () => FE.buyConverter(k),
      fit: () => FE.buyFittings(k), lenses: () => FE.buyLenses(), gilding: () => FE.buyGilding(), vault: () => FE.buyVault(), forge: () => FE.buyForge(), quench: () => FE.buyQuench()
    }[kind];
    el.addEventListener('click', act);
    return el;
  }
  function lock(b) {
    const el = document.createElement('div');
    el.className = 'card lock' + (b === 'cond' ? ' wide' : ''); el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'a build not found yet');
    el.innerHTML = svg(LOCK);
    return el;
  }
  // what you hold / what it costs, for each part. Only reads as affordable while buying is actually possible.
  const parts = (cost, ok) => Object.entries(cost).map(([r, v]) =>
    `<span class="${ok && FE.held(r) >= v ? 'have' : ''}">${FE.fmt(FE.held(r))} / ${FE.fmt(v)}</span> ${r}`).join(' · ');

  function fill(b, locked, total) {
    const s = FE.state, el = $('build-' + b), [kind, k] = b.split('-'), blocked = FE.buyBlocked();
    const [title, cost, note] = el.children;
    let can = false, done = false;
    if (kind === 'res') {
      const c = FE.resCost(k), maxed = FE.resMaxed(k), p = FE.clickPower(k);
      can = !blocked && !maxed && s.counts[k] >= c;
      put(title, `${k} resonance`);
      put(cost, maxed ? 'maxed' : parts({ [k]: c }, !blocked));
      put(note, maxed ? `click power ${FE.fmt(p)}` : `click power ${FE.fmt(p)} → ${FE.fmt(p * 2)}`);
    } else if (kind === 'struct') {
      const c = FE.structCost(k);
      can = !blocked && s.counts[k] >= c;
      put(title, FE.STRUCT_NAMES[k]);
      put(cost, parts({ [k]: c }, !blocked));
      put(note, `+${FE.STRUCT_RATE * (s.fit[k] ? FE.FITTINGS_BOOST : 1)} ${k}/s each`);
    } else if (kind === 'cond') {
      const t2 = total >= FE.TIER2_AT;
      can = locked;
      put(title, t2 ? 'condense: tier 2' : 'condense');
      put(cost, `<span class="${can ? 'have' : ''}">${FE.fmt(total)} / ${FE.fmt(t2 ? FE.TIER2_AT : FE.CAP)}</span> stored`);
      put(note, t2 ? 'a tier 2 crystal: opens the next world. resets everything.'
        : s.planets ? `a tier 1 crystal: +${FE.CRYSTAL_MAX_MULT} max multiplier. resets everything.`
        : 'a crystal and a planet: a new element. resets everything.');
    } else if (kind === 'conv') {
      const c = FE.converter(k), price = FE.convCost(k);
      can = FE.canBuy(price);
      put(title, c.name + (s.conv[k] ? ` ×${s.conv[k]}` : ''));
      put(cost, parts(price, true));
      put(note, (c.when && s.owned.includes(c.when[0]) ? `while ${condition(k)} (\u00d7${FE.FOCUS_BONUS}): ` : '') + `${amounts(c.use)} → ${amounts(c.make)}/s`);
    } else if (kind === 'quench') {
      done = !!s.quench;
      can = !done && FE.canBuy(FE.QUENCH_COST);
      put(title, 'quenching');
      put(cost, done ? 'done' : parts(FE.QUENCH_COST, true));
      put(note, `furnaces, kilns and crucibles use ${Math.round((1 - FE.QUENCH_FIRE) * 100)}% less fire`);
    } else if (kind === 'vault') {
      const price = FE.vaultCost(), maxed = price == null;
      can = !maxed && total >= price;
      put(title, 'vault' + (s.vault ? ` \u00d7${s.vault}` : ''));
      put(cost, maxed ? 'maxed' : `<span class="${can ? 'have' : ''}">${FE.fmt(total)} / ${FE.fmt(price)}</span> stored`);
      put(note, `storage ${FE.fmt(FE.capacity())}` + (maxed ? '' : ` \u2192 ${FE.fmt(FE.capacity() * 10)}`));
    } else if (kind === 'forge') {
      const ks = s.owned.slice(0, 2);
      done = s.forge;
      can = !done && !blocked && ks.length === 2 && ks.every(e => s.counts[e] >= FE.FORGE_COST);
      put(title, FE.FORGE_NAME);
      put(cost, done ? 'built' : ks.map(e => `<span class="${s.counts[e] >= FE.FORGE_COST ? 'have' : ''}">${FE.fmt(s.counts[e])} / ${FE.fmt(FE.FORGE_COST)}</span> ${named(e)}`).join(' \u00b7 '));
      put(note, 'spells and vagrants');
    } else if (kind === 'fit') {
      done = !!s.fit[k];
      can = !done && FE.canBuy(FE.FITTINGS_COST);
      put(title, `${k} fittings`);
      put(cost, done ? 'fitted' : parts(FE.FITTINGS_COST, true));
      put(note, `${FE.STRUCT_NAMES[k]}s make ×${FE.FITTINGS_BOOST}`);
    } else if (kind === 'lenses' || kind === 'gilding') {
      const lenses = kind === 'lenses', price = lenses ? FE.LENSES_COST : FE.GILDING_COST;
      done = s[kind];
      can = !done && FE.canBuy(price);
      put(title, kind);
      put(cost, done ? 'done' : parts(price, true));
      put(note, lenses ? `converters make ×${FE.LENSES_BOOST}` : 'works add half the threat');
    
    }
    el.disabled = !can;
    el.classList.toggle('done', done);
  }

  // ---- balance: each element's share of what you hold ----
  function renderBalance(total) {
    const s = FE.state;
    if (!s.balanceShown && total >= FE.BALANCE_AT) s.balanceShown = true;
    $('balance-box').hidden = !s.balanceShown;
    if (!s.balanceShown) return;
    text('total', FE.fmt(total));
    text('cap', '/ ' + FE.capacity().toLocaleString('en-US'));
    const ks = inPlay(), barW = $('bar').clientWidth;
    ids.forEach(id => { $('seg-' + id).hidden = $('leg-' + id).hidden = !ks.includes(id); });
    const shares = ks.map(k => ({ k, share: FE.share(k) }));
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
    const s = FE.state, total = FE.totalCount(), g = goal(total);
    put($('goal'), g);
    $('goal').hidden = !g;
    renderStores();
    renderWorks();
    renderBuilds(total);
    renderBalance(total);
    s.owned.forEach(k => { const b = $('btn-' + k); if (b) b.disabled = total >= FE.capacity(); });
    FE.renderCombat(total);
    FE.updateMult();
  };

  // ---- end of the prototype: shown once, when the Brewing Flask is built. The game keeps running behind it. ----
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
