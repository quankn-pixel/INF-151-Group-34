/* quests.js - the panel in the middle of the screen (shared with the mini-games), quests, and the strip of notices under the
 * goal line. A quest is a risky task you pick: do it for a big reward, fail it and you take a punishment that is shown first.
 * Offers appear after FE.QUEST.unlock upgrades have been bought. */
FE.module(function (FE) {
  const $ = FE.$, ids = FE.ELEMENTS.map(e => e.id);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const nice = n => { const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, n))) - 1)); return Math.round(n / p) * p; };   // two significant figures
  const mmss = ms => FE.clock(Math.max(0, Math.ceil(ms / 1000)));
  const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  // ---- the panel ----
  // FE.panel = {kind, sig(), build(box), update()}. build runs again only when sig() changes (so a button is never replaced
  // between the mouse going down on it and coming up); update() refreshes numbers in place.
  FE.panel = null; FE.modalOpen = false;
  FE.openPanel = function (p) {
    FE.panel = p; p.last = null;
    $('modal').hidden = false; FE.modalOpen = true;
    FE.renderPanel();
    const f = $('panel').querySelector('button'); if (f) f.focus({ preventScroll: true });
  };
  FE.closePanel = function () {
    const p = FE.panel;
    FE.panel = null; FE.modalOpen = false; $('modal').hidden = true; $('panel').innerHTML = '';
    if (p && p.close) p.close();
  };
  FE.renderPanel = function () {
    const p = FE.panel; if (!p) return;
    const sig = p.sig();
    if (sig !== p.last) { p.last = sig; const b = $('panel'); b.innerHTML = ''; p.build(b); }
    if (p.update) p.update();
  };
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  FE.h = h;
  const btn = (label, fn, cls) => { const b = h('button', 'el ' + (cls || ''), label); b.type = 'button'; b.addEventListener('click', fn); return b; };
  FE.panelButton = btn;

  // ---- quests: describing them ----
  const taskText = q => q.kind === 'gen' ? `Generate <b>${FE.fmt(q.x)}</b> in <b>${FE.minutes(q.secs)}</b>`
    : q.kind === 'collapse' ? `Collapse a star <b>${q.x} times</b> within <b>${FE.minutes(q.secs)}</b>`
    : q.kind === 'nobuy' ? `Buy <b>no upgrades</b> for the next <b>${FE.minutes(q.secs)}</b>`
    : q.kind === 'star' ? `Condense a <b>new star</b> within <b>${FE.minutes(q.secs)}</b>`
    : q.kind === 'frenzy' ? `Click the star <b>${q.x} times</b> within <b>${FE.minutes(q.secs)}</b>`
    : `Click <b>no more than ${q.x} times</b> in the next <b>${FE.minutes(q.secs)}</b>`;
  const rewardText = q => q.reward.type === 'buff' ? `all production ×${q.reward.mult} for ${FE.minutes(q.reward.secs)}`
    : q.reward.type === 'crystals' ? `${q.reward.n} crystals of every element`
    : q.reward.type === 'am' ? `${q.reward.n} antimatter`
    : `a free star tier on your ${q.reward.el} star`;
  const punishText = q => q.punish === 'scramble' ? `for ${FE.minutes(FE.QUEST.scrambleSec)}, what you make lands in random elements`
    : q.punish === 'shuffle' ? `for ${FE.minutes(FE.QUEST.shuffleSec)}, your build levels are shuffled between builds`
    : 'your current star is torn apart, and gives no crystal';

  // ---- offers ----
  function makeOffers() {
    const s = FE.state, rate = ids.reduce((a, k) => a + FE.rate(k), 0), cur = FE.E();
    const kinds = ['gen', 'nobuy', 'noclick', 'frenzy'];
    const cost0 = FE.nextStarCost();
    if (cost0 != null && !cur.exo && !cur.strange && cur.count >= cost0 * .2) kinds.push('star');     // only when a star is within reach
    if (s.layer2 || ids.some(k => s.els[k].tier >= 2)) kinds.push('collapse');
    const punish = () => pick(cur.tier >= 1 && !cur.strange ? ['scramble', 'shuffle', 'collapse'] : ['scramble', 'shuffle']);
    const out = [];
    for (const kind of kinds.sort(() => Math.random() - .5).slice(0, FE.QUEST.offers)) {
      const q = { kind, punish: punish() };
      if (kind === 'gen') { q.secs = pick([180, 300]); q.x = nice(Math.max(1500, 2.2 * (rate + FE.clickGain() * 4) * q.secs)); q.reward = { type: 'buff', mult: 3, secs: 600 }; }
      else if (kind === 'collapse') { q.secs = 1500; q.x = 2; q.reward = { type: 'crystals', n: 2 }; }
      else if (kind === 'star') { q.secs = 480; q.reward = { type: 'buff', mult: 3, secs: 600 }; }
      else if (kind === 'frenzy') { q.secs = 60; q.x = 450; q.reward = { type: 'am', n: 40 }; }
      else if (kind === 'nobuy') { q.secs = pick([300, 480]); q.reward = { type: 'buff', mult: 2.5, secs: 900 }; }
      else { q.secs = 240; q.x = 20; q.reward = cur.tier < FE.maxTier() && !cur.exo && !cur.strange ? { type: 'tier', el: FE.el() } : { type: 'buff', mult: 3, secs: 600 }; }
      out.push(q);
    }
    return out;
  }

  // ---- taking a quest, and how it ends ----
  FE.acceptQuest = function (i) {
    const Q = FE.state.quests, o = Q.offers[i];
    if (!o || Q.active) return;
    Q.active = Object.assign({}, o, { t0: Date.now(), end: Date.now() + o.secs * 1000, got: 0 });
    Q.offers = [];
    FE.render(); FE.save();
  };
  function finish(won) {
    const s = FE.state, Q = s.quests, q = Q.active;
    if (!q) return;
    Q.active = null; Q.offers = []; Q.readyAt = Date.now() + FE.QUEST.cooldown * 1000;
    if (won) {
      Q.done++;
      const r = q.reward;
      if (r.type === 'buff') s.buff = { mult: r.mult, end: Date.now() + r.secs * 1000 };
      else if (r.type === 'am') s.antimatter += r.n;
      else if (r.type === 'crystals') { ids.forEach(k => { s.crystals[k] += r.n; }); s.layer2 = true; }
      else { const e = s.els[r.el]; if (e.tier < FE.maxTier() && !e.exo && !e.strange) { e.tier++; if (r.el === FE.el()) FE.core.condense(e.tier); } }
      FE.toast(`Quest complete: ${rewardText(q)}.`, 5200);
    } else {
      Q.failed++;
      let p = q.punish;
      if (p === 'collapse' && !FE.forceCollapse()) p = 'shuffle';
      if (p === 'scramble') s.curse = { kind: 'scramble', end: Date.now() + FE.QUEST.scrambleSec * 1000 };
      if (p === 'shuffle') s.curse = { kind: 'shuffle', end: Date.now() + FE.QUEST.shuffleSec * 1000, map: FE.shuffleMap() };
      FE.toast(`Quest failed: ${p === 'collapse' ? 'your star is torn apart' : p === 'scramble' ? 'production is scrambled' : 'your builds are shuffled'}.`, 5200);
    }
    FE.render(); FE.save();
  }
  FE.abandonQuest = () => finish(false);
  FE.rewardText = rewardText;

  FE.ev.gain = a => { const q = FE.state.quests.active; if (q && q.kind === 'gen') q.got += a; };
  FE.ev.collapse = () => { const q = FE.state.quests.active; if (q && q.kind === 'collapse') q.got++; };
  FE.ev.buy = () => { const q = FE.state.quests.active; if (q && q.kind === 'nobuy') finish(false); };
  FE.ev.click = () => { const q = FE.state.quests.active; if (!q) return; if (q.kind === 'noclick' && ++q.got > q.x) finish(false); else if (q.kind === 'frenzy') q.got++; };
  FE.ev.star = () => { const q = FE.state.quests.active; if (q && q.kind === 'star') q.got++; };

  FE.tickQuests = function () {
    const s = FE.state, Q = s.quests, now = Date.now(), q = Q.active;
    if (s.buff && now >= s.buff.end) s.buff = null;
    if (s.curse && now >= s.curse.end) s.curse = null;
    if (q) {
      if ((q.kind === 'gen' || q.kind === 'collapse' || q.kind === 'frenzy') && q.got >= q.x || (q.kind === 'star' && q.got >= 1)) finish(true);
      else if (now >= q.end) finish(q.kind === 'nobuy' || q.kind === 'noclick');
    } else if (!Q.offers.length && s.buys >= FE.QUEST.unlock && now >= Q.readyAt) { Q.offers = makeOffers(); FE.render(); }
  };

  // ---- the quest panel ----
  FE.showQuests = function () {
    const Q = () => FE.state.quests;
    FE.openPanel({
      kind: 'quests',
      sig: () => JSON.stringify([Q().active ? 1 : 0, Q().offers, Q().offers.length ? 0 : Date.now() >= Q().readyAt ? 1 : 2]),
      build(box) {
        box.appendChild(h('h3', '', 'Quests'));
        box.appendChild(h('p', 'dim', 'Risky tasks with big rewards. Fail one and you pay the price shown. One quest at a time.'));
        const a = Q().active;
        if (a) {
          box.appendChild(h('div', 'qcard act', `<div class="q-task">${taskText(a)}</div><div class="q-line" id="q-prog"></div><div class="q-line good">Reward: ${rewardText(a)}</div><div class="q-line bad">If you fail: ${punishText(a)}</div>`));
          box.appendChild(h('div', 'btns')).appendChild(btn('Give up (you take the punishment)', () => { FE.abandonQuest(); }, 'danger'));
        } else if (Q().offers.length) {
          Q().offers.forEach((q, i) => {
            const c = h('div', 'qcard', `<div class="q-task">${taskText(q)}</div><div class="q-line good">Reward: ${rewardText(q)}</div><div class="q-line bad">If you fail: ${punishText(q)}</div>`);
            c.appendChild(btn('Accept', () => FE.acceptQuest(i)));
            box.appendChild(c);
          });
          box.appendChild(h('div', 'btns')).appendChild(btn('Ask for other quests', () => { Q().offers = makeOffers(); FE.save(); }));
        } else if (FE.state.buys < FE.QUEST.unlock) box.appendChild(h('p', '', `Buy ${FE.QUEST.unlock - FE.state.buys} more upgrades.`));
        else box.appendChild(h('p', '', 'New quests in <span id="q-cd"></span>.'));
        box.appendChild(h('div', 'btns')).appendChild(btn('Close', FE.closePanel));
      },
      update() {
        const a = Q().active, now = Date.now();
        const pg = $('q-prog'); if (a && pg) {
          const left = mmss(a.end - now);
          const t = a.kind === 'gen' ? `${FE.fmt(a.got)} / ${FE.fmt(a.x)} made` : a.kind === 'collapse' ? `${a.got} / ${a.x} collapses` : a.kind === 'frenzy' ? `${a.got} / ${a.x} clicks` : a.kind === 'star' ? 'no new star yet' : a.kind === 'noclick' ? `${a.got} / ${a.x} clicks used` : 'nothing bought so far';
          if (pg.textContent !== `${t} · ${left} left`) pg.textContent = `${t} · ${left} left`;
        }
        const cd = $('q-cd'); if (cd) cd.textContent = mmss(Q().readyAt - now);
      }
    });
  };

  // ---- the strip under the goal line: buttons and notices ----
  let lastChips = '';
  FE.renderHud = function () {
    const s = FE.state, Q = s.quests, now = Date.now(), c = [];
    const q = $('hud-quests'), g = $('hud-games');
    q.hidden = !(s.buys >= FE.QUEST.unlock || Q.active || Q.done || Q.failed);
    g.hidden = !(s.buys >= FE.MINI.unlock);
    q.classList.toggle('ping', !q.hidden && !Q.active && Q.offers.length > 0);
    const chip = (t, cls) => c.push(`<span class="chip ${cls || ''}">${t}</span>`);
    const a = Q.active;
    if (a) chip(`quest: ${a.kind === 'gen' ? `make ${FE.fmt(a.x)}` : a.kind === 'collapse' ? `collapse ×${a.x}` : a.kind === 'frenzy' ? `click ×${a.x}` : a.kind === 'star' ? 'condense a star' : a.kind === 'nobuy' ? 'buy nothing' : 'few clicks'} · ${mmss(a.end - now)}`, 'quest');
    if (FE.buffOn()) chip(`production ×${s.buff.mult} · ${mmss(s.buff.end - now)}`, 'good');
    if (FE.cursed('scramble')) chip(`production scrambled · ${mmss(s.curse.end - now)}`, 'bad');
    if (FE.cursed('shuffle')) chip(`builds shuffled · ${mmss(s.curse.end - now)}`, 'bad');
    const live = s.orbit.filter(o => o.end > now);
    if (live.length) chip(`${live.length} in orbit · ×${FE.orbitMult().toFixed(2)}`, 'good');
    if (s.mgBoost) chip(`meteor bonus +${Math.round(s.mgBoost * 100)}%`, 'dim');
    if (s.antimatter > 0 || ids.some(k => s.els[k].exo)) chip(`antimatter ${FE.fmt(s.antimatter)}`, 'am');
    if (s.strangeMatter > 0) chip(`strange matter ${FE.fmt(s.strangeMatter)}`, 'sm');
    if (s.strangeCrystals > 0) chip(`strange crystals ${s.strangeCrystals}`, 'sm');
    const html = c.join('');
    if (html !== lastChips) { lastChips = html; $('chips').innerHTML = html; }
  };

  FE.buildQuests = function () {
    $('hud-quests').addEventListener('click', FE.showQuests);
    $('modal').addEventListener('pointerdown', e => { if (e.target === $('modal') && !(FE.panel && FE.panel.noBackdrop)) FE.closePanel(); });
    // while a panel is open nothing behind it hears the keyboard or the wheel (the panel's own keys are Escape and Tab)
    addEventListener('keydown', e => {
      if (!FE.modalOpen) return;
      if (e.key === 'Escape') { e.stopPropagation(); FE.closePanel(); return; }
      if (e.key !== 'Tab' && e.key !== 'Enter') e.stopPropagation();
    }, true);
    addEventListener('wheel', e => { if (FE.modalOpen) e.stopPropagation(); }, true);
    addEventListener('touchstart', e => { if (FE.modalOpen) e.stopPropagation(); }, true);
  };
});
