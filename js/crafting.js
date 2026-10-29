/* crafting.js - converters, materials, upgrades and the Brewing Flask. They open with the 3rd element.
 *
 * Every tick each converter takes its inputs and makes its output, but only while its balance condition holds, and only
 * as much as its scarcest input allows. Materials live outside storage and the balance bar.
 */
FE.module(function (FE) {
  const isElement = r => FE.ELEMENTS.some(e => e.id === r);
  const held = r => isElement(r) ? FE.state.counts[r] : FE.state.mats[r];
  function take(r, v) {
    const s = FE.state;
    if (isElement(r)) s.counts[r] = FE.round1(s.counts[r] - v);
    else s.mats[r] = Math.max(0, s.mats[r] - v);
  }
  FE.held = held;
  FE.crafting = () => FE.state.owned.length >= 2;       // the works open with the 2nd element
  // Layer 2 (two elements): the material works are open to everyone, because any element can be transmuted; the elemental
  // converters wait for the 3rd element; a transmuter shows only for your own pair. With 3+ elements everything but the
  // transmuters is open.
  FE.available = function (c) {
    const s = FE.state;
    if (c.tm) return s.owned.length === 2 && c.tm.every(k => s.owned.includes(k));
    if (s.owned.length >= 3) return true;
    return !Object.keys(c.make).every(isElement);
  };
  FE.makeable = function (m) {
    if (FE.state.owned.length >= 3) return true;
    return FE.CONVERTERS.some(d => m in d.make && FE.available(d));
  };
  FE.converter = id => FE.CONVERTERS.find(c => c.id === id);
  FE.afford = cost => Object.entries(cost).every(([r, v]) => held(r) >= v);
  FE.canBuy = cost => FE.crafting() && FE.afford(cost);

  // one more of a converter: its base cost, plus CONVERTER_COST_STEP of it for every one already owned
  FE.convCost = function (id) {
    const c = FE.converter(id), n = FE.state.conv[id];
    return Object.fromEntries(Object.entries(c.cost).map(([r, v]) => [r, Math.round(v * (1 + FE.CONVERTER_COST_STEP * n))]));
  };

  function buy(cost, apply, line) {
    if (!FE.canBuy(cost)) return false;
    Object.entries(cost).forEach(([r, v]) => take(r, v));
    apply();
    if (line) FE.note(line, 'note');
    FE.render(); FE.save();
    return true;
  }
  FE.buyConverter = id => FE.available(FE.converter(id)) && buy(FE.convCost(id), () => { FE.state.conv[id]++; });
  FE.buyFittings = function (k) {
    if (FE.state.fit[k] || !FE.state.owned.includes(k)) return;
    buy(FE.FITTINGS_COST, () => { FE.state.fit[k] = true; }, `Metal fittings: your ${FE.STRUCT_NAMES[k]}s make twice as much ${k}.`);
  };
  FE.buyLenses = function () {
    if (!FE.state.lenses) buy(FE.LENSES_COST, () => { FE.state.lenses = true; }, 'Glass lenses: every converter makes half again as much.');
  };
  FE.buyQuench = function () {
    if (!FE.state.quench && FE.state.owned.includes('water')) buy(FE.QUENCH_COST, () => { FE.state.quench = true; }, 'Quenching tanks: furnaces, kilns and crucibles burn half as much fire.');
  };
  FE.buyGilding = function () {
    if (!FE.state.gilding) buy(FE.GILDING_COST, () => { FE.state.gilding = true; }, 'Gilding: your works draw half as much attention.');
  };

  // works: switch a structure ('struct-air') or a converter ('hearth') off and on
  FE.toggleWork = function (key) {
    const s = FE.state;
    if (s.off[key]) delete s.off[key]; else s.off[key] = true;
    FE.render(); FE.save();
  };

  // ---- running ----
  // what each converter did on the last tick, for works and stores: { make, use } per second while running, { why } when not
  FE.convState = {};
  FE.craftTick = function (dt) {
    const s = FE.state;
    let changed = false;
    FE.CONVERTERS.forEach(c => {
      if (!s.conv[c.id]) { delete FE.convState[c.id]; return; }
      FE.convState[c.id] = run(c, s.conv[c.id], dt);
      changed = true;
    });
    return changed;
  };

  function run(c, n, dt) {
    const s = FE.state;
    if (s.off[c.id]) return { why: 'off' };
    const focus = !!c.when && s.owned.includes(c.when[0]);       // no balance condition, and no bonus, for an element you don't own
    const cu = s.quench && c.heat ? Object.assign({}, c.use, { fire: c.use.fire * FE.QUENCH_FIRE }) : c.use;
    if (focus && FE.share(c.when[0]) <= c.when[1]) return { why: `needs ${c.when[0]} over ${Math.round(c.when[1] * 100)}%` };
    if (!(dt > 0)) return FE.convState[c.id] || { why: 'starting' };
    let f = 1, short = null;                                   // the share of a full run the scarcest input allows
    for (const [r, v] of Object.entries(cu)) {
      const can = Math.max(0, held(r)) / (v * n * dt);
      if (can < f) { f = can; short = r; }
    }
    if (f <= 0) return { why: 'needs ' + short };
    const per = (rates, boost) => Object.fromEntries(Object.entries(rates).map(([r, v]) => [r, v * n * f * boost]));
    const use = per(cu, 1), make = per(c.make, (s.lenses ? FE.LENSES_BOOST : 1) * (focus ? FE.FOCUS_BONUS : 1));
    Object.entries(use).forEach(([r, v]) => take(r, v * dt));
    Object.entries(make).forEach(([r, v]) => { if (isElement(r)) FE.addAmount(r, v * dt); else s.mats[r] += v * dt; });
    return { make, use };
  }

  // net change per second of an element or material from converters (structures are FE.rate)
  FE.convFlow = r => Object.values(FE.convState).reduce((t, st) => t + ((st.make && st.make[r]) || 0) - ((st.use && st.use[r]) || 0), 0);

  // works running right now, for the threat meter: structures not switched off, and converters that ran on the last tick
  FE.runningWorks = function () {
    const s = FE.state;
    const structs = s.owned.reduce((t, k) => t + (s.off['struct-' + k] ? 0 : s.up[k].struct), 0);
    return structs + FE.CONVERTERS.reduce((t, c) => t + (FE.convState[c.id] && FE.convState[c.id].make ? s.conv[c.id] : 0), 0);
  };
});
