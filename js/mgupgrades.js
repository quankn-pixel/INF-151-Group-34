/* mgupgrades.js - mini-game progress that carries over between sessions. Every game now pays out shards, which are kept in
 * state.mgMeta and spent in a Workshop at the bottom of the mini-game panel on upgrades that change how the games play.
 * Load after minigames.js. */
FE.module(function (FE) {
  const oldFresh = FE.freshState;
  FE.freshState = () => Object.assign(oldFresh(), { mgMeta: { shards: 0, up: {}, plays: 0 } });
  if (!FE.state.mgMeta) FE.state.mgMeta = { shards: 0, up: {}, plays: 0 };

  const M = () => FE.state.mgMeta, lv = id => M().up[id] || 0, G = FE.MINIGAMES;
  const UPG = [
    { id: 'meteor_mag', game: 'meteor', name: 'Magnet', max: 5, cost: 3, desc: 'meteors can be hit from farther away' },
    { id: 'meteor_yield', game: 'meteor', name: 'Rich ore', max: 5, cost: 4, desc: '+15% to your catch count for the bonus' },
    { id: 'orbit_passes', game: 'orbit', name: 'Extra pass', max: 3, cost: 5, desc: '+1 pass round the star' },
    { id: 'orbit_mark', game: 'orbit', name: 'Wide mark', max: 5, cost: 4, desc: 'the lock mark is 12% wider' },
    { id: 'surge_slow', game: 'surge', name: 'Lingering flares', max: 5, cost: 4, desc: 'flares last 18% longer' },
    { id: 'surge_yield', game: 'surge', name: 'Hot streak', max: 5, cost: 4, desc: '+10% flares counted toward the boost' },
    { id: 'collider_steady', game: 'collider', name: 'Steady hand', max: 5, cost: 4, desc: 'the bead moves 10% slower' },
    { id: 'collider_focus', game: 'collider', name: 'Focus lens', max: 5, cost: 5, desc: 'every shot scores 8% higher' },
    { id: 'signal_second', game: 'signal', name: 'Second chance', max: 3, cost: 6, desc: 'forgive one mistake, the pattern replays' }
  ];
  const cost = u => Math.round(u.cost * Math.pow(1.7, lv(u.id)));
  const award = n => { n = Math.max(0, Math.round(n)); M().shards += n; M().plays++; return n ? ` +${n} shard${n === 1 ? '' : 's'} for the workshop.` : ''; };

  // meteor
  { const g = G.meteor, oc = g.click, of = g.finish;
    g.click = function (st, x, y) {
      const m = lv('meteor_mag'); if (!m) return oc.call(g, st, x, y);
      for (const r of st.rocks) if (!r.dead && Math.hypot(x - r.x, y - r.y) < r.r + 8 + 6 * m) { r.dead = true; st.got++; st.bursts.push({ x: r.x, y: r.y, t: 0 }); return; }
    };
    g.finish = function (st) { const raw = st.got; st.got = Math.round(raw * (1 + .15 * lv('meteor_yield'))); return of.call(g, st) + award(raw / 2); }; }
  // orbit
  { const g = G.orbit, os = g.start, of = g.finish;
    g.start = function () { const st = os.call(g); st.tries += lv('orbit_passes'); st.win *= 1 + .12 * lv('orbit_mark'); return st; };
    g.finish = function (st) { return of.call(g, st) + award(st.hit * 3); }; }
  // surge
  { const g = G.surge, ostep = g.step, of = g.finish;
    g.step = function (st, dt) { const prev = st.cell; ostep.call(g, st, dt); if (st.cell >= 0 && prev < 0) st.life *= 1 + .18 * lv('surge_slow'); };
    g.finish = function (st) { const raw = st.got; st.got = Math.round(raw * (1 + .1 * lv('surge_yield'))); return of.call(g, st) + award(raw / 2); }; }
  // collider
  { const g = G.collider, os = g.start, oc = g.click, of = g.finish;
    g.start = function () { const st = os.call(g); st.speed *= Math.pow(.9, lv('collider_steady')); return st; };
    g.click = function (st) { const n = st.shots.length; oc.call(g, st); if (st.shots.length > n) st.shots[n] = Math.min(1.4, st.shots[n] * (1 + .08 * lv('collider_focus'))); };
    g.finish = function (st) { const t = of.call(g, st); return t + award(st.shots.reduce((a, v) => a + v, 0) * 2); }; }
  // signal
  { const g = G.signal, os = g.start, oc = g.click, of = g.finish;
    g.start = function () { const st = os.call(g); st.lives = lv('signal_second'); return st; };
    g.click = function (st, x, y) { oc.call(g, st, x, y); if (st.bad && st.lives > 0 && st.phase === 'done') { st.lives--; st.bad = false; st.phase = 'show'; st.t = 0; st.lit = null; } };
    g.finish = function (st) { return of.call(g, st) + award(st.round * 2); }; }

  // the Workshop, added to the menu of the mini-game panel
  const osg = FE.showGames;
  FE.showGames = function () {
    osg();
    const p = FE.panel; if (!p || p.kind !== 'games') return;
    const sig = p.sig, bld = p.build;
    p.sig = () => sig() + '|' + JSON.stringify(M());
    p.build = function (box) {
      bld.call(p, box);
      if (!box.querySelector('#mg-meteor')) return;
      const shop = FE.h('div', 'qcard');
      shop.appendChild(FE.h('div', 'q-task', 'Workshop'));
      shop.appendChild(FE.h('div', 'q-line', `Shards earned in any mini-game are kept for good. You have <b>${FE.fmt(M().shards)}</b>.`));
      UPG.forEach(u => {
        const n = lv(u.id), maxed = n >= u.max, c = cost(u);
        const row = FE.h('div', 'q-line', `<b>${u.name}</b> ${n}/${u.max} (${G[u.game].title}): ${u.desc}`);
        const b = FE.panelButton(maxed ? 'Maxed' : `${c} shards`, () => { if (M().shards < c || lv(u.id) >= u.max) return; M().shards -= c; M().up[u.id] = lv(u.id) + 1; FE.save(); FE.renderPanel(); });
        b.disabled = maxed || M().shards < c; row.appendChild(document.createTextNode(' ')); row.appendChild(b); shop.appendChild(row);
      });
      box.insertBefore(shop, box.lastElementChild);
    };
    p.last = null; FE.renderPanel();
  };
});
