/* exotic.js - the things a star can become and the bodies around it: neutron stars and black holes (antimatter), strange stars
 * (strange matter and strange crystals), rogue stars that collide with yours, and planets, moons and comets caught in orbit.
 * The numbers are in config.js. Collapsing and finishing a star is in game.js (FE.finishStar); the drawing is in space.js. */
FE.module(function (FE) {
  const ids = FE.ELEMENTS.map(e => e.id);
  const busy = () => FE.collapsing || FE.modalOpen;

  // ---- neutron star / black hole: the player compresses a star of tier 3 or more ----
  FE.exoKind = e => e.tier >= FE.STABILIZED_TIER ? 'hole' : 'neutron';
  FE.canExo = () => { const e = FE.E(); return !FE.collapsing && !e.exo && !e.strange && e.tier >= FE.EXO_TIER; };
  FE.goExotic = function () {
    if (!FE.canExo()) return;
    const e = FE.E(), kind = FE.exoKind(e), d = FE.EXO[kind];
    e.exo = { kind, start: Date.now(), end: Date.now() + d.dur * 1000, boost: 1 };
    FE.collapseArmed = 0;
    FE.render(); FE.save();
    FE.toast(`Your ${FE.el()} star compresses into a ${d.name}. It makes antimatter now, not ${FE.el()}.`, 4800);
  };
  FE.exoPassive = e => e.exo ? FE.EXO[e.exo.kind].passive * e.exo.boost : 0;
  FE.exoClick = e => e.exo ? FE.EXO[e.exo.kind].click * e.exo.boost : 0;
  FE.exoLeft = e => e.exo ? Math.max(0, (e.exo.end - Date.now()) / 1000) : 0;
  // strange crystals only work on a black hole
  FE.extendHole = function () {
    const s = FE.state, e = FE.E();
    if (!e.exo || e.exo.kind !== 'hole' || s.strangeCrystals < 1) return;
    s.strangeCrystals--; e.exo.end += FE.EXO_EXTEND * 1000;
    FE.render(); FE.save();
  };
  FE.amplifyHole = function () {
    const s = FE.state, e = FE.E();
    if (!e.exo || e.exo.kind !== 'hole' || s.strangeCrystals < 1) return;
    s.strangeCrystals--; e.exo.boost *= FE.EXO_AMPLIFY;
    FE.render(); FE.save();
  };
  // antimatter buys a head start after a collapse: a star of tier t at once
  FE.reignite = function (t) {
    const s = FE.state, e = FE.E(), c = FE.REIGNITE[t];
    if (!c || busy() || e.exo || e.strange || e.tier >= t || s.antimatter < c) return;
    s.antimatter -= c; e.tier = t; e.count = 0;
    FE.core.condense(t);
    FE.render(); FE.save();
  };

  // ---- bodies caught in orbit (the orbit game) ----
  let dustAcc = 0;
  FE.addOrbiter = function (kind, el) {
    const s = FE.state, d = FE.ORBITERS[kind], now = Date.now();
    s.orbit = s.orbit.filter(o => o.end > now);
    if (s.orbit.length >= FE.MAX_ORBITERS) { s.orbit.sort((a, b) => a.end - b.end); s.orbit.shift(); }
    s.orbit.push({ kind, el, end: now + d.min * 60000, seed: Math.random() * 1000 });
    s.stardust += d.dustNow;
  };

  // ---- rogue stars: a free tier ----
  FE.rogueChance = () => FE.ROGUE.base * (1 + Math.min(FE.state.rogueLuck, FE.ROGUE.luckMax));
  FE.rogueStar = function () {
    const s = FE.state, ok = k => { const e = s.els[k]; return e.tier < FE.maxTier() && !e.exo && !e.strange; };
    const cur = FE.el(), pool = ok(cur) ? [cur] : ids.filter(ok);
    if (!pool.length || FE.rogueFlying) return;
    const k = pool[Math.floor(Math.random() * pool.length)];
    FE.rogueFlying = true;
    const hit = () => {
      FE.rogueFlying = false;
      const e = s.els[k];
      if (e.tier >= FE.maxTier() || e.exo || e.strange) return;
      e.tier++;
      if (k === FE.el()) FE.core.condense(e.tier);
      FE.render(); FE.save();
      FE.toast(`A rogue star collided with your ${k} star: a free tier (now tier ${e.tier}).`, 5200);
    };
    if (k === FE.el() && FE.view === 1 && FE.space) FE.space.rogue(hit); else hit();
  };

  // ---- every tick (called from game.js): antimatter, strange matter, orbiting bodies, rogue stars ----
  FE.tickSpecial = function (dt) {
    const s = FE.state, now = Date.now(), ST = FE.STRANGE;
    let strange = false;
    for (const k of ids) {
      const e = s.els[k];
      if (e.exo) { s.antimatter += FE.exoPassive(e) * dt; if (now >= e.exo.end) FE.finishStar(k, 'exo'); }
      else if (e.strange) { strange = true; if (now >= e.strange.end) FE.finishStar(k, 'strange'); }
    }
    for (const k of ids) { const n = s.els[k].up.siphon; if (n) s.antimatter += n * FE.SIPHON_RATE * dt; }   // siphons: no multiplier touches this
    if (strange) {                                         // every element's holdings drain into strange matter
      const f = 1 - Math.exp(-ST.rate * dt);
      for (const k of ids) { const d = s.els[k].count * f; s.els[k].count -= d; s.strangeMatter += d / ST.perMatter; }
    }
    if (s.orbit.length) {
      s.orbit = s.orbit.filter(o => o.end > now);
      dustAcc += s.orbit.reduce((a, o) => a + FE.ORBITERS[o.kind].dustMin / 60, 0) * dt;
      if (dustAcc >= 1) { const w = Math.floor(dustAcc); s.stardust += w; dustAcc -= w; }
    }
    if (!busy() && Math.random() < FE.rogueChance() * dt) FE.rogueStar();
  };
});
