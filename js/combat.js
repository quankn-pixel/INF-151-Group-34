/* combat.js - spells, vagrants and the threat meter: the rules, and the boxes that show them.
 *
 * With two elements you can conjure: everything you hold folds into one spell, of the element you hold most of, with
 * power equal to the amount. Vagrants come when the threat meter fills (imbalance and works fill it). The first one,
 * the leader, is scripted: it arrives LEADER_DELAY seconds after the 2nd element, and beating it opens the 3rd.
 */
FE.module(function (FE) {
  const $ = FE.$;
  const ids = FE.ELEMENTS.map(e => e.id);
  const ink = k => `<span class="ink-${k}">${k}</span>`;
  const spellHTML = k => `<span class="ink-${k}">${FE.SPELLS[k]}</span>`;
  const weakTo = foe => ids.find(k => FE.BEATS[k] === foe);          // the element whose spells hit this vagrant twice as hard
  // most of this runs ten times a second, so only touch the DOM when something actually changed
  const last = new WeakMap();
  const put = (el, html) => { if (last.get(el) !== html) { last.set(el, html); el.innerHTML = html; } };

  // damage multiplier of a spell of element `spell` against a vagrant attuned to `foe`
  FE.effect = (spell, foe) => FE.BEATS[spell] === foe ? FE.STRONG : FE.BEATS[foe] === spell ? FE.WEAK : 1;

  // what fills the threat meter right now, per second
  FE.threatRate = function () {
    const s = FE.state;
    const imbalance = FE.THREAT_IMBALANCE * FE.imbalance();
    const works = FE.THREAT_PER_WORK * FE.works() + FE.THREAT_PER_RATE * s.owned.reduce((t, k) => t + FE.rate(k), 0);
    const leader = s.leaderBeaten ? 0 : FE.THREAT_LEADER;
    return { imbalance, works, leader, total: imbalance + works + leader };
  };

  // dt in seconds. Returns true when something on screen changed.
  FE.combatTick = function (dt) {
    const s = FE.state;
    if (s.leaderIn != null) {
      const before = s.leaderIn;
      s.leaderIn = Math.max(0, before - dt);
      FE.LEADER_LINES.forEach(([at, line]) => { if (before > at && s.leaderIn <= at) FE.note(line, 'dim'); });
      if (s.leaderIn > 0) return false;
      s.leaderIn = null;
      arrive(true);
      return true;
    }
    if (s.enemy) {
      s.enemy.left = Math.max(0, s.enemy.left - dt);
      if (s.enemy.left <= 0) raid();
      return true;
    }
    if (!s.threatOn) return false;
    s.threat = Math.min(100, s.threat + FE.threatRate().total * dt);
    if (s.threat >= 100) { s.threat = 0; arrive(!s.leaderBeaten); }   // until it is beaten, the leader is who comes back
    return true;
  };

  function arrive(leader) {
    const s = FE.state, first = !s.threatOn;
    // the leader is attuned to the element your first one beats, so your oldest element is the lesson
    const el = leader ? FE.BEATS[s.owned[0]] : ids[Math.floor(Math.random() * ids.length)];
    const max = leader ? FE.LEADER_HP
      : Math.min(FE.CAP, Math.round(FE.CAP * (FE.VAGRANT_HP_BASE + FE.VAGRANT_HP_STEP * s.kills)));
    s.enemy = { el, hp: max, max, left: FE.VAGRANT_TIME, time: FE.VAGRANT_TIME, leader };
    s.threatOn = true;
    const weak = weakTo(el);
    if (leader && first) FE.note('A leader steps out of the vagrant crowd. It is not here to talk.', 'dim');
    FE.note(leader
      ? `The vagrant leader ${first ? 'attacks' : 'is back'}. It is attuned to ${ink(el)}: ${spellHTML(weak)} hits it twice as hard.`
      : `A vagrant attuned to ${ink(el)} closes in. ${spellHTML(weak)} hits it twice as hard.`, 'warn');
    if (!s.spells.length) FE.note('Conjure a spell from everything you hold, then click the spell to cast it.', 'note');
    FE.save();
  }

  // the vagrant's time ran out: it takes RAID_TAKE of every element and one structure at random, then leaves
  function raid() {
    const s = FE.state, e = s.enemy;
    s.enemy = null;
    s.raids++;
    let took = 0;
    s.owned.forEach(k => {
      const t = FE.round1(Math.max(0, s.counts[k]) * FE.RAID_TAKE);
      s.counts[k] = FE.round1(s.counts[k] - t);
      took += t;
    });
    let lost = null, r = Math.floor(Math.random() * FE.works());
    for (const k of s.owned) {
      if (r < s.up[k].struct) { lost = k; break; }
      r -= s.up[k].struct;
    }
    if (lost) s.up[lost].struct--;
    const what = [took > 0 && `takes ${FE.fmt(took)} from your stores`, lost && `tears down a ${FE.STRUCT_NAMES[lost]}`].filter(Boolean);
    FE.note(`${e.leader ? 'The vagrant leader' : 'The vagrant'} ${what.length ? what.join(' and ') : 'finds nothing to take'}, then slips away.`, 'warn');
    if (e.leader) FE.note('It will be back.', 'dim');
    explainThreat();
    FE.save();
  }

  function defeat() {
    const s = FE.state, e = s.enemy;
    s.enemy = null;
    s.kills++;
    if (e.leader) {
      s.leaderBeaten = true;
      s.picking = true;
      FE.note('The leader falls, and the crowd scatters.', 'dim');
      FE.note('Something else stirs. Investigate it.', 'note');
      FE.renderChoices();
    } else {
      FE.note('The vagrant falls.', 'note');
    }
    explainThreat();
  }

  // once, when the first fight ends and the meter starts to fill
  function explainThreat() {
    const s = FE.state;
    if (s.kills + s.raids === 1) FE.note('More vagrants will come while your elements are out of balance, and as your works grow.', 'note');
  }

  // Everything you hold folds into one spell of the element you hold most of. Works even when storage is full.
  FE.conjure = function () {
    const s = FE.state, total = FE.totalCount();
    if (s.owned.length < 2 || total < 1) return;
    const el = FE.majority(), power = Math.round(total);
    s.spells.push({ el, power });
    FE.ELEMENTS.forEach(({ id }) => { s.counts[id] = 0; });
    s.conjured++;
    FE.note(`Everything you held folds into one ${spellHTML(el)}, power ${FE.fmt(power)}.`, 'note');
    FE.render(); FE.save();
  };

  FE.cast = function (i) {
    const s = FE.state, e = s.enemy, sp = s.spells[i];
    if (!e || !sp) return;
    const m = FE.effect(sp.el, e.el), dmg = FE.round1(sp.power * m);
    s.spells.splice(i, 1);
    e.hp = FE.round1(Math.max(0, e.hp - dmg));
    FE.note(`${spellHTML(sp.el)} hits for ${FE.fmt(dmg)}.${m > 1 ? ' It is weak to that.' : m < 1 ? ' It shrugs off half.' : ''}`, 'note');
    if (e.hp <= 0) defeat();
    FE.render(); FE.save();
  };

  // ---- drawing: spells box (right), vagrant box (left), threat row (in the balance box) ----
  let listSig = null;
  FE.renderCombat = function (total) {
    const s = FE.state, e = s.enemy;
    $('spells-box').hidden = s.owned.length < 2;
    if (s.owned.length >= 2) {
      const top = FE.majority(), btn = $('btn-conjure');
      btn.style.setProperty('--c', `var(--${top}-ink)`);
      put(btn, `conjure ${FE.SPELLS[top]}`);
      btn.disabled = total < 1;
      put($('conjure-note'), total < 1 ? 'hold something to conjure from.'
        : `uses all ${FE.fmt(total)} you hold · power ${FE.fmt(Math.round(total))}`);
      // the list is rebuilt only when the spells or the target change, so a button never vanishes mid-click
      const sig = s.spells.map(sp => sp.el + sp.power).join() + '|' + (e ? e.el : '');
      if (sig !== listSig) {
        listSig = sig;
        $('spell-list').replaceChildren(...s.spells.map((sp, i) => spellButton(sp, i, e)));
      }
      $('spells-empty').hidden = s.spells.length > 0;
    }
    renderFoe(e);
    renderThreat();
  };

  function spellButton(sp, i, e) {
    const b = document.createElement('button');
    const m = e ? FE.effect(sp.el, e.el) : 1;
    b.type = 'button';
    b.className = 'spell' + (m > 1 ? ' strong' : m < 1 ? ' weak' : '');
    b.disabled = !e;
    b.innerHTML = `${spellHTML(sp.el)}<span class="n">${FE.fmt(sp.power)}${m !== 1 ? ` <b>×${m}</b>` : ''}</span>`;
    b.title = e ? `cast: ${FE.fmt(sp.power * m)} damage` : 'nothing to cast at yet';
    b.addEventListener('click', () => FE.cast(i));
    return b;
  }

  function renderFoe(e) {
    $('enc-box').hidden = !e;
    if (!e) return;
    $('enc-box').style.setProperty('--c', `var(--${e.el}-ink)`);
    put($('foe-name'), `${e.leader ? 'the vagrant leader' : 'a vagrant'}, attuned to ${ink(e.el)}`);
    put($('foe-hint'), `weak to ${spellHTML(weakTo(e.el))} · shrugs off ${spellHTML(FE.BEATS[e.el])}`);
    $('foe-hp-fill').style.width = (100 * e.hp / e.max).toFixed(1) + '%';
    put($('foe-hp'), `${FE.fmt(e.hp)} / ${FE.fmt(e.max)}`);
    $('foe-time-fill').style.width = (100 * e.left / e.time).toFixed(1) + '%';
    put($('foe-time'), Math.ceil(e.left) + 's');
  }

  function renderThreat() {
    const s = FE.state;
    $('threat-row').hidden = !s.threatOn;
    $('threat-note').hidden = !s.threatOn;
    if (!s.threatOn) return;
    $('threat-fill').style.width = s.threat.toFixed(1) + '%';
    put($('threat-pct'), Math.floor(s.threat) + '%');
    if (s.enemy) { put($('threat-note'), 'paused while a vagrant is here.'); return; }
    const r = FE.threatRate();
    put($('threat-note'), `rising ${r.total.toFixed(1)}/s: imbalance ${r.imbalance.toFixed(1)} · works ${r.works.toFixed(1)}`
      + (r.leader ? ` · the leader is looking for you ${r.leader.toFixed(1)}` : ''));
  }
});
