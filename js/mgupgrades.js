/* mgupgrades.js - mini-game progress that carries over between sessions. Every game now pays out shards, which are kept in
 * state.mgMeta and spent in a Workshop drawer at the side of the screen (opened with the mini-game panel) on upgrades that change how the games play.
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

  // ---- a drawer at the side of the screen, used by the Workshop (here and in the forest) so upgrades never mix with the game list ----
  const dcss = document.createElement('style');
  dcss.textContent = `#fe-drawer{position:fixed;top:0;right:0;bottom:0;width:min(350px,92vw);z-index:80;box-sizing:border-box;padding:20px 18px;overflow:auto;background:rgba(5,8,22,.97);color:#e9eefc;
  border-left:1px solid rgba(190,205,255,.4);box-shadow:-14px 0 40px -18px rgba(150,175,255,.6);line-height:1.45}
#fe-drawer[hidden]{display:none}#fe-drawer h3{margin:0 0 4px;font-weight:normal;font-size:1.6em;letter-spacing:.06em}#fe-drawer .dim{color:#8d9bc4;margin:0 0 12px}
#fe-drawer .u{padding:10px 0;border-top:1px solid rgba(190,205,255,.16)}#fe-drawer .u b{font-weight:normal;font-size:1.08em}#fe-drawer .u small{display:block;color:#a9b5da;margin:2px 0 6px}
#fe-drawer .u button{font:inherit;color:#e9eefc;background:rgba(255,255,255,.05);border:1px solid rgba(190,205,255,.55);border-radius:6px;padding:3px 12px;cursor:pointer}
#fe-drawer .u button:disabled{color:#6c7799;border-color:rgba(190,205,255,.2);cursor:default}`;
  document.head.appendChild(dcss);
  const dr = document.createElement('div'); dr.id = 'fe-drawer'; dr.hidden = true; document.body.appendChild(dr);
  // list = [{name, lvl, max, game, desc, cost, buy()}]. Draws the whole drawer again; call it whenever shards change.
  FE.drawer = {
    show(title, shards, list, note) {
      dr.hidden = false; dr.innerHTML = `<h3>${title}</h3><p class="dim">${note || ''} You have <b>${FE.fmt(shards)}</b> shards.</p>`;
      list.forEach(u => {
        const row = document.createElement('div'); row.className = 'u';
        row.innerHTML = `<b>${u.name}</b> ${u.lvl}/${u.max}${u.game ? ` · ${u.game}` : ''}<small>${u.desc}</small>`;
        const b = document.createElement('button'); b.type = 'button'; const maxed = u.lvl >= u.max;
        b.textContent = maxed ? 'Maxed' : `${u.cost} shards`; b.disabled = maxed || shards < u.cost; b.addEventListener('click', u.buy);
        row.appendChild(b); dr.appendChild(row);
      });
    },
    hide() { dr.hidden = true; }
  };

  // the Workshop opens at the side of the screen when the mini-game panel does
  const osg = FE.showGames;
  FE.showGames = function () {
    osg();
    const p = FE.panel; if (!p || p.kind !== 'games') return;
    const sig = p.sig, bld = p.build, cl = p.close;
    p.sig = () => sig() + '|' + JSON.stringify(M());
    p.close = function () { FE.drawer.hide(); if (cl) cl.call(p); };
    p.build = function (box) {
      bld.call(p, box);
      FE.drawer.show('Workshop', M().shards, UPG.map(u => ({
        name: u.name, lvl: lv(u.id), max: u.max, game: G[u.game].title, desc: u.desc, cost: cost(u),
        buy() { if (M().shards < cost(u) || lv(u.id) >= u.max) return; M().shards -= cost(u); M().up[u.id] = lv(u.id) + 1; FE.save(); FE.renderPanel(); }
      })), 'Shards from any mini-game are kept for good.');
    };
    p.last = null; FE.renderPanel();
  };
});
