/* forestplay.js - quests and mini-games for the forest (layer 1). Load after forest.js.
 *
 * Quests: risky tasks with a reward shown up front, and a punishment if you fail.
 * Mini-games: four games that fill the whole screen (firefly catch, stoke the fire, dowsing, cairn stacking). Every game pays out
 * shards, which are kept for good and spent in the Workshop on upgrades that change how the games play. Your best scores,
 * shards, upgrades and cooldowns are all saved with the game.
 *
 * Rewards are things that happen, not a flat production bonus: wisps to catch, free builds (which feed fusion), an echo that makes
 * your next clicks count six times, a rich vein that fills the vessel, a warm spell, and now and then a crystal. The better
 * the quest or game result, the stronger the reward. */
FE.module(function (FE) {
  const $ = FE.$, TAU = Math.PI * 2, IDS = FE.ELEMENTS.map(e => e.id), FOR = FE.forest, M = FOR.mods;
  const rand = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const hs = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
  const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
  const nice = n => { const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, n))) - 1)); return Math.round(n / p) * p; };
  const mmss = ms => FE.clock(Math.max(0, Math.ceil(ms / 1000)));

  // ---------------------------------------------------------------- state (saved with the game)
  const blank = () => ({ shards: 0, up: {}, plays: 0, best: {}, cd: {}, echo: 0, buff: null, curse: null, q: { done: 0, failed: 0, offers: [], active: null, readyAt: 0 } });
  const oldFresh = FE.freshState;
  FE.freshState = () => Object.assign(oldFresh(), { fplay: blank() });
  if (!FE.state.fplay) FE.state.fplay = blank();
  const P = () => FE.state.fplay, F = () => FOR.state(), Q = () => P().q;
  const CFG = { questAt: 6, gamesAt: 3, gameCd: 90, questCd: 60, frostSec: 150, dampSec: 150 };
  const buffOn = () => !!P().buff && Date.now() < P().buff.end;
  const cursed = k => !!P().curse && P().curse.kind === k && Date.now() < P().curse.end;

  // what the rewards and punishments do to the numbers in forest.js
  M.prod = () => (buffOn() ? P().buff.mult : 1) * (cursed('frost') ? .4 : 1);
  M.click = () => (P().echo > 0 ? 6 : 1) * (cursed('damp') ? .25 : 1);
  M.onClick = () => { if (P().echo > 0) P().echo--; const q = Q().active; if (q && q.kind === 'frenzy') q.got++; };
  M.onGain = a => { const q = Q().active; if (q && q.kind === 'gen') q.got += a; };
  M.onBuy = () => { const q = Q().active; if (q && q.kind === 'nobuy') finishQuest(false); };
  M.onFuse = () => { const q = Q().active; if (q && q.kind === 'fuse') q.got++; };
  M.onGrow = () => { const q = Q().active; if (q && q.kind === 'grow') q.got++; };

  // ---------------------------------------------------------------- styles and page parts
  const css = document.createElement('style');
  css.textContent = `
.fp-hud{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px 10px;margin-top:8px;min-height:1.9em}
.fp-b{width:auto!important;padding:3px 14px!important;font-size:.9em;border-color:rgba(190,205,255,.55)!important;background:rgba(8,12,30,.6)!important;border-radius:6px}
.fp-b.ping{animation:readyglow 1.6s ease-in-out infinite;--c:#aebcff}
@keyframes readyglow{0%,100%{box-shadow:0 0 6px -2px var(--c)}50%{box-shadow:0 0 22px 2px var(--c)}}
.fp-wisp{position:absolute;z-index:8;width:46px;height:46px;margin:-23px 0 0 -23px;padding:0;border:0;border-radius:50%;cursor:pointer;transition:opacity .6s ease;
  background:radial-gradient(circle,#fff 0,var(--w) 22%,transparent 68%);box-shadow:0 0 26px 6px var(--w)}
.fp-pop{position:absolute;z-index:9;pointer-events:none;color:#fff;font:600 20px "Times New Roman",serif;text-shadow:0 0 8px #000;animation:fppop 1.1s ease-out forwards}
@keyframes fppop{from{opacity:1;transform:translate(-50%,0)}to{opacity:0;transform:translate(-50%,-60px)}}
#fp-g{position:fixed;inset:0;z-index:65;background:#02030a;color:#e9eefc;display:flex;flex-direction:column;font-family:"Times New Roman",Times,serif}
#fp-g[hidden]{display:none}
.fp-top{display:flex;align-items:center;gap:20px;padding:12px 22px;border-bottom:1px solid rgba(170,190,255,.2)}
.fp-top b{font-size:1.6em;font-weight:normal;letter-spacing:.08em}.fp-top span{margin-left:auto;color:#aab4d8;font-variant-numeric:tabular-nums;font-size:1.1em}
.fp-top button{font:inherit;color:#e9eefc;background:rgba(255,255,255,.05);border:1px solid rgba(190,205,255,.55);border-radius:6px;padding:5px 16px;cursor:pointer}
.fp-stage{flex:1;min-height:0;position:relative}#fp-cv{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;touch-action:none}
#fp-res{position:absolute;inset:0;display:grid;place-items:center;background:rgba(2,3,10,.82)}#fp-res[hidden]{display:none}
.fp-box{width:min(32em,90vw);padding:26px 30px;text-align:center;line-height:1.5;border:1px solid rgba(190,205,255,.5);border-radius:12px;background:#05081a;box-shadow:0 0 44px -10px rgba(150,175,255,.75)}
.fp-box h3{margin:0 0 8px;font-weight:normal;font-size:2em;letter-spacing:.06em}.fp-box p{margin:6px 0}.fp-box .dim{color:#8d9bc4}.fp-box .good{color:#9fe8c0}
.fp-box button{font:inherit;color:#e9eefc;background:rgba(255,255,255,.05);border:1px solid rgba(190,205,255,.55);border-radius:6px;padding:6px 20px;margin-top:14px;cursor:pointer}`;
  document.head.appendChild(css);

  const hud = document.createElement('div');
  hud.className = 'fp-hud';
  hud.innerHTML = '<button class="el fp-b" id="fp-qb" type="button" hidden>Quests</button><button class="el fp-b" id="fp-gb" type="button" hidden>Mini-games</button><div class="chips" id="fp-chips"></div>';
  $('fz-goal').parentNode.appendChild(hud);
  const g = document.createElement('div');
  g.id = 'fp-g'; g.hidden = true;
  g.innerHTML = '<div class="fp-top"><b id="fp-title"></b><span id="fp-info"></span><button type="button" id="fp-quit">Leave</button></div><div class="fp-stage"><canvas id="fp-cv"></canvas><div id="fp-res" hidden></div></div>';
  document.body.appendChild(g);

  // ---------------------------------------------------------------- rewards
  const wisps = [];
  const pageF = $('pageF');
  function pop(x, y, text) { const d = document.createElement('div'); d.className = 'fp-pop'; d.textContent = text; d.style.left = x + 'px'; d.style.top = y + 'px'; pageF.appendChild(d); setTimeout(() => d.remove(), 1200); }
  function spawnWisps(n) {
    const W = pageF.clientWidth || 1000, H = pageF.clientHeight || 700;
    for (let i = 0; i < n; i++) {
      const el = pick(IDS), node = document.createElement('button');
      node.type = 'button'; node.className = 'fp-wisp'; node.setAttribute('aria-label', 'wisp'); node.style.setProperty('--w', FE.PAL[el].glow);
      const w = { el, node, x: rand(W * .2, W * .8), y: rand(H * .25, H * .75), a: rand(TAU), sp: rand(50, 100), ph: rand(TAU), life: 26 };
      node.addEventListener('click', () => catchWisp(w));
      pageF.appendChild(node); wisps.push(w);
    }
  }
  function dropWisp(w) { const i = wisps.indexOf(w); if (i >= 0) wisps.splice(i, 1); w.node.style.opacity = 0; setTimeout(() => w.node.remove(), 600); }
  function catchWisp(w) {
    if (wisps.indexOf(w) < 0 || FE.modalOpen) return;
    const e = F().els[w.el], cost = FOR.tierCost(e.tier) || 1500, gain = Math.max(40 * FOR.rate(w.el), .05 * cost);
    e.count += gain; pop(w.x, w.y - 20, `+${FE.fmt(gain)} ${w.el}`); dropWisp(w); FOR.burst(w.el, 10); FOR.render(); FE.save();
  }
  setInterval(() => {                                                                        // wisps drift, wander and fade
    if (!wisps.length) return;
    const dt = .05, W = pageF.clientWidth, H = pageF.clientHeight, now = performance.now() / 1000;
    for (const w of wisps.slice()) {
      w.life -= dt; if (w.life <= 0) { dropWisp(w); continue; }
      w.a += Math.sin(now * 1.1 + w.ph) * 1.4 * dt; w.x += Math.cos(w.a) * w.sp * dt; w.y += Math.sin(w.a) * w.sp * dt * .7;
      if (w.x < 40 || w.x > W - 40) { w.a = Math.PI - w.a; w.x = clamp(w.x, 40, W - 40); }
      if (w.y < H * .18 || w.y > H * .86) { w.a = -w.a; w.y = clamp(w.y, H * .18, H * .86); }
      w.node.style.left = w.x + 'px'; w.node.style.top = w.y + 'px'; w.node.style.opacity = w.life < 3 ? (w.life / 3).toFixed(2) : 1;
    }
  }, 50);

  const REWARDS = ['wisps', 'gift', 'echo', 'warmth', 'vein'];
  function rollReward(p) {
    const pool = REWARDS.slice(); if (p >= 2) pool.push('crystal'); if (p >= 3) pool.push('crystal');
    let id = pick(pool);
    if (id === 'vein' && FOR.tierCost(F().els[F().cur].tier) == null) id = 'warmth';
    return { id, p, b: pick(FOR.BUILDS) };
  }
  const rewardText = r => ({
    wisps: `${3 + 2 * r.p} wisps drift out of the dark: catch them for bursts of production`,
    gift: `${2 + 2 * r.p} free units of a random build (they count toward fusion)`,
    echo: `your next ${15 + 10 * r.p} clicks count six times`,
    warmth: `a warm spell: all production ×${2 + .5 * r.p} for ${60 + 30 * r.p} s`,
    vein: `a rich vein: the vessel fills by ${15 + 10 * r.p}% of what its next tier costs`,
    crystal: 'a crystal of your current element'
  }[r.id]);
  function applyReward(r) {
    const f = F(), el = f.cur, e = f.els[el], p = r.p;
    let id = r.id;
    if (id === 'wisps' && FE.view !== 0) id = 'echo';
    if (id === 'wisps') { spawnWisps(3 + 2 * p); return `${3 + 2 * p} wisps drift out of the dark. Catch them.`; }
    if (id === 'gift') { const n = 2 + 2 * p, hi = FOR.gift(r.b, n); return `The forest gives you ${n} ${FOR.nm(r.b, el, 0)}${hi ? `, and they fused into a ${FOR.nm(r.b, el, hi)}` : ''}.`; }
    if (id === 'echo') { const n = 15 + 10 * p; P().echo += n; return `Your next ${n} clicks gather six times as much.`; }
    if (id === 'vein') { const add = FOR.tierCost(e.tier) * (.15 + .1 * p); e.count += add; FOR.burst(el, 24); return `A rich vein: +${FE.fmt(add)} ${el}.`; }
    if (id === 'crystal') { FE.state.crystals[el]++; FE.state.layer2 = true; FOR.burst(el, 30); return `A crystal of ${el} glints in the dirt.`; }
    const mu = 2 + .5 * p, secs = 60 + 30 * p;                                               // warmth
    if (!buffOn() || P().buff.mult <= mu) P().buff = { mult: mu, end: Date.now() + secs * 1000 };
    return `A warm spell: all production ×${mu} for ${secs} s.`;
  }

  // ---------------------------------------------------------------- quests
  const taskText = q => q.kind === 'gen' ? `Gather <b>${FE.fmt(q.x)}</b> in <b>${FE.minutes(q.secs)}</b>`
    : q.kind === 'frenzy' ? `Click the vessel <b>${q.x} times</b> within <b>${FE.minutes(q.secs)}</b>`
    : q.kind === 'fuse' ? `<b>Fuse</b> a build within <b>${FE.minutes(q.secs)}</b>`
    : q.kind === 'grow' ? `Grow a <b>vessel</b> within <b>${FE.minutes(q.secs)}</b>`
    : `Buy <b>no builds</b> for the next <b>${FE.minutes(q.secs)}</b>`;
  const punishText = k => k === 'frost' ? `a frost: production ×0.4 for ${FE.minutes(CFG.frostSec)}` : k === 'damp' ? `damp wood: click power ×0.25 for ${FE.minutes(CFG.dampSec)}` : 'an ash fall: you lose 30% of your current element';
  function makeOffers() {
    const f = F(), e = f.els[f.cur], rate = IDS.reduce((a, k) => a + FOR.rate(k), 0), kinds = ['gen', 'frenzy', 'nobuy'], cost = FOR.tierCost(e.tier);
    if (FOR.BUILDS.some(b => e.up[b][0] >= 4)) kinds.push('fuse');
    if (cost != null && e.count >= cost * .2) kinds.push('grow');
    return kinds.sort(() => Math.random() - .5).slice(0, 3).map(kind => {
      const q = { kind, punish: pick(['frost', 'damp', 'ash']) };
      if (kind === 'gen') { q.secs = pick([120, 240]); q.x = nice(Math.max(600, 2.2 * (rate + FOR.clickGain() * 4) * q.secs)); q.p = 1; }
      else if (kind === 'frenzy') { q.secs = 45; q.x = 250; q.p = 1; }
      else if (kind === 'nobuy') { q.secs = pick([180, 300]); q.p = 1; }
      else { q.secs = 300; q.p = 2; }
      q.reward = rollReward(q.p);
      return q;
    });
  }
  function acceptQuest(i) {
    const o = Q().offers[i]; if (!o || Q().active) return;
    Q().active = Object.assign({}, o, { end: Date.now() + o.secs * 1000, got: 0 }); Q().offers = [];
    FE.save(); FOR.render(); FE.renderPanel();
  }
  function finishQuest(won) {
    const q = Q().active; if (!q) return;
    Q().active = null; Q().offers = []; Q().readyAt = Date.now() + CFG.questCd * 1000;
    if (won) { Q().done++; FE.toast('Quest complete. ' + applyReward(q.reward), 6200); }
    else {
      Q().failed++;
      const el = F().cur, e = F().els[el];
      if (q.punish === 'frost') P().curse = { kind: 'frost', end: Date.now() + CFG.frostSec * 1000 };
      else if (q.punish === 'damp') P().curse = { kind: 'damp', end: Date.now() + CFG.dampSec * 1000 };
      else e.count *= .7;
      FE.toast(`Quest failed: ${punishText(q.punish)}.`, 5600);
    }
    FE.save(); FOR.render(); FE.renderPanel();
  }
  function showQuests() {
    FE.openPanel({
      kind: 'fquests',
      sig: () => JSON.stringify([Q().active ? 1 : 0, Q().offers, Q().offers.length ? 0 : Date.now() >= Q().readyAt ? 1 : 2]),
      build(box) {
        box.appendChild(FE.h('h3', '', 'Quests'));
        box.appendChild(FE.h('p', 'dim', 'Risky tasks for real rewards. Fail one and you pay the price shown. One at a time.'));
        const a = Q().active;
        if (a) {
          box.appendChild(FE.h('div', 'qcard act', `<div class="q-task">${taskText(a)}</div><div class="q-line" id="fq-prog"></div><div class="q-line good">Reward: ${rewardText(a.reward)}</div><div class="q-line bad">If you fail: ${punishText(a.punish)}</div>`));
          box.appendChild(FE.h('div', 'btns')).appendChild(FE.panelButton('Give up (you take the punishment)', () => finishQuest(false), 'danger'));
        } else if (Q().offers.length) {
          Q().offers.forEach((q, i) => {
            const c = FE.h('div', 'qcard', `<div class="q-task">${taskText(q)}</div><div class="q-line good">Reward: ${rewardText(q.reward)}</div><div class="q-line bad">If you fail: ${punishText(q.punish)}</div>`);
            c.appendChild(FE.panelButton('Accept', () => acceptQuest(i))); box.appendChild(c);
          });
          box.appendChild(FE.h('div', 'btns')).appendChild(FE.panelButton('Ask for other quests', () => { Q().offers = makeOffers(); FE.save(); }));
        } else if (F().buys < CFG.questAt) box.appendChild(FE.h('p', '', `Buy ${CFG.questAt - F().buys} more builds.`));
        else box.appendChild(FE.h('p', '', 'New quests in <span id="fq-cd"></span>.'));
        box.appendChild(FE.h('div', 'btns')).appendChild(FE.panelButton('Close', FE.closePanel));
      },
      update() {
        const a = Q().active, now = Date.now(), pg = $('fq-prog');
        if (a && pg) {
          const t = a.kind === 'gen' ? `${FE.fmt(a.got)} / ${FE.fmt(a.x)} gathered` : a.kind === 'frenzy' ? `${a.got} / ${a.x} clicks` : a.kind === 'nobuy' ? 'nothing bought so far' : a.kind === 'fuse' ? 'nothing fused yet' : 'no vessel grown yet';
          const s = `${t} · ${mmss(a.end - now)} left`; if (pg.textContent !== s) pg.textContent = s;
        }
        const cd = $('fq-cd'); if (cd) cd.textContent = mmss(Q().readyAt - now);
      }
    });
  }
  setInterval(() => {                                                                        // quest timers, buffs, new offers
    const p = P(), q = Q(), now = Date.now(), a = q.active;
    if (p.buff && now >= p.buff.end) p.buff = null;
    if (p.curse && now >= p.curse.end) p.curse = null;
    if (a) {
      if ((a.kind === 'gen' || a.kind === 'frenzy') && a.got >= a.x || (a.kind === 'fuse' || a.kind === 'grow') && a.got >= 1) finishQuest(true);
      else if (now >= a.end) finishQuest(a.kind === 'nobuy');
    } else if (!q.offers.length && F().buys >= CFG.questAt && now >= q.readyAt) { q.offers = makeOffers(); FOR.render(); }
  }, 250);

  // ---------------------------------------------------------------- the games
  const UPG = [
    { id: 'jar', game: 'fireflies', name: 'Wider jar', max: 5, cost: 3, desc: 'the catch radius is 9 px larger' },
    { id: 'lantern', game: 'fireflies', name: 'Dim lantern', max: 5, cost: 4, desc: 'fireflies drift 8% slower' },
    { id: 'night', game: 'fireflies', name: 'Long night', max: 5, cost: 4, desc: '+4 seconds of night' },
    { id: 'dry', game: 'stoke', name: 'Dry kindling', max: 5, cost: 3, desc: 'every click adds more heat' },
    { id: 'hearth', game: 'stoke', name: 'Wide hearth', max: 5, cost: 4, desc: 'the golden band is wider' },
    { id: 'banked', game: 'stoke', name: 'Banked embers', max: 5, cost: 4, desc: 'the fire cools 8% slower' },
    { id: 'rod', game: 'dowse', name: 'Extra probe', max: 4, cost: 5, desc: '+1 probe' },
    { id: 'sense', game: 'dowse', name: 'Sensitive rod', max: 5, cost: 4, desc: 'springs are found from 8 px farther' },
    { id: 'flat', game: 'cairn', name: 'Flat stones', max: 5, cost: 3, desc: 'the base stone is 16 px wider' },
    { id: 'steady', game: 'cairn', name: 'Steady hands', max: 5, cost: 4, desc: 'the stone swings 7% slower' },
    { id: 'omen', game: '', name: 'Forest omen', max: 3, cost: 8, desc: 'every game has a 12% better chance of a stronger reward' }
  ];
  const lv = id => P().up[id] || 0, ucost = u => Math.round(u.cost * Math.pow(1.7, lv(u.id)));
  let W = 0, H = 0, DPR = 1, cv, cx, scene = null, run = null, G = null, gid = '', raf = 0, last = 0, mx = 0, my = 0;

  function sceneBg() {                                                                        // a dark forest, drawn once per size
    scene = document.createElement('canvas'); scene.width = Math.round(W * DPR); scene.height = Math.round(H * DPR);
    const c = scene.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0);
    const g1 = c.createLinearGradient(0, 0, 0, H); g1.addColorStop(0, '#01020a'); g1.addColorStop(.6, '#08122a'); g1.addColorStop(1, '#050a10'); c.fillStyle = g1; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 120; i++) { c.fillStyle = `rgba(255,255,255,${.2 + .5 * hs(i, 3)})`; c.fillRect(hs(i, 1) * W, hs(i, 2) * H * .6, 1.5, 1.5); }
    c.fillStyle = '#04080f';
    for (let x = -20, i = 0; x < W + 40; x += 26 + 30 * hs(i, 5), i++) { const h = H * (.16 + .2 * hs(i, 6)), w = h * .4; c.beginPath(); c.moveTo(x, H * .82); c.lineTo(x + w / 2, H * .82); c.lineTo(x, H * .82 - h); c.lineTo(x - w / 2, H * .82); c.closePath(); c.fill(); }
    c.fillStyle = '#03060a'; c.fillRect(0, H * .82, W, H * .18);
  }
  function fit() {
    DPR = Math.min(1.5, devicePixelRatio || 1);
    const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return false;
    if (w !== W || h !== H) { W = w; H = h; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); sceneBg(); }
    return true;
  }
  function glow(c, x, y, r, col, a) { const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); }
  const label = (c, t, x, y, al) => { c.fillStyle = '#cdd7f5'; c.font = '20px "Times New Roman", serif'; c.textAlign = al || 'left'; c.fillText(t, x, y); };

  const GAMES = {
    fireflies: {
      title: 'Firefly Catch', th: [10, 24, 40], el: 'air',
      blurb: 'Fireflies drift through the dark forest. Click to sweep your jar over them; quick catches in a row build a combo. Thirty seconds.',
      mk() { return { x: rand(40, W - 40), y: rand(H * .2, H * .8), a: rand(TAU), sp: rand(60, 120) * Math.pow(.92, lv('lantern')), ph: rand(TAU) }; },
      start() { return { t: 0, dur: 30 + 4 * lv('night'), score: 0, caught: 0, combo: 0, lastC: -9, ff: Array.from({ length: 16 }, () => GAMES.fireflies.mk()), fx: [], over: false }; },
      step(s, dt) {
        s.t += dt;
        for (const f of s.ff) {
          f.a += Math.sin(s.t * 1.3 + f.ph) * 1.7 * dt; f.x += Math.cos(f.a) * f.sp * dt; f.y += Math.sin(f.a) * f.sp * dt * .7;
          if (f.x < 20 || f.x > W - 20) { f.a = Math.PI - f.a; f.x = clamp(f.x, 20, W - 20); }
          if (f.y < H * .12 || f.y > H * .86) { f.a = -f.a; f.y = clamp(f.y, H * .12, H * .86); }
        }
        s.fx.forEach(q => q.t += dt); s.fx = s.fx.filter(q => q.t < .5);
        if (s.t >= s.dur) s.over = true;
      },
      click(s, x, y) {
        const R = 32 + 9 * lv('jar'); let best = -1, bd = R;
        s.ff.forEach((f, i) => { const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = i; } });
        if (best < 0) { s.combo = 0; return; }
        const f = s.ff[best]; s.combo = s.t - s.lastC < 1.5 ? s.combo + 1 : 1; s.lastC = s.t;
        s.caught++; s.score += 1 + Math.floor(s.combo / 3); s.fx.push({ x: f.x, y: f.y, t: 0 }); s.ff[best] = GAMES.fireflies.mk();
      },
      draw(s, c) {
        c.globalCompositeOperation = 'lighter';
        for (const f of s.ff) glow(c, f.x, f.y, 22, '#d8ff8a', .55 + .4 * Math.sin(s.t * 3 + f.ph));
        for (const q of s.fx) { c.strokeStyle = `rgba(216,255,138,${1 - q.t / .5})`; c.lineWidth = 3; c.beginPath(); c.arc(q.x, q.y, 10 + 60 * q.t, 0, TAU); c.stroke(); }
        c.globalCompositeOperation = 'source-over';
        c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2; c.beginPath(); c.arc(s.mx, s.my, 32 + 9 * lv('jar'), 0, TAU); c.stroke();
        label(c, `caught ${s.caught}`, 22, 34); label(c, s.combo > 1 ? `combo ×${s.combo}` : '', W / 2, 34, 'center');
      },
      info: s => `${Math.max(0, s.dur - s.t).toFixed(0)} s · score ${s.score}`, score: s => s.score, shards: s => Math.round(s.score / 3)
    },
    stoke: {
      title: 'Stoke the Fire', th: [15, 40, 80], el: 'fire',
      blurb: 'The fire cools all the time, and gusts of wind knock it down. Click to add heat and hold it in the golden band: the longer you stay in it, the more each second is worth. Do not let it flare. Twenty-five seconds.',
      start() { return { t: 0, dur: 25, h: .35, score: 0, streak: 0, gust: 0, nextG: 4, flare: 0, over: false }; },
      step(s, dt) {
        s.t += dt; s.flare = Math.max(0, s.flare - dt * 2);
        s.h -= .2 * Math.pow(.92, lv('banked')) * dt; s.nextG -= dt;
        if (s.nextG <= 0) { s.nextG = rand(4, 7); s.gust = .4; }
        if (s.gust > 0) { s.h -= .6 * dt; s.gust -= dt; }
        s.h = Math.max(0, s.h);
        const half = .1 + .025 * lv('hearth');
        if (Math.abs(s.h - .65) < half) { s.streak += dt; s.score += dt * (2 + s.streak * .4); } else s.streak = 0;
        if (s.h > 1) { s.h = .55; s.flare = 1; s.score = Math.max(0, s.score - 3); s.streak = 0; }
        if (s.t >= s.dur) s.over = true;
      },
      click(s) { s.h += .07 + .014 * lv('dry'); },
      draw(s, c) {
        const x = W * .42, y = H * .78, k = Math.min(W, H) / 700;
        glow(c, x, y - 60 * k, 340 * k * (.5 + s.h), '#ff8a3d', .35 + .15 * s.h);
        c.fillStyle = '#4a2f1a'; for (const d of [-1, 1]) { c.save(); c.translate(x, y); c.rotate(d * .38); c.fillRect(-90 * k, -12 * k, 180 * k, 24 * k); c.restore(); }
        c.globalCompositeOperation = 'lighter';
        [['#f2683a', 1], ['#ffb347', .7], ['#fff6c0', .4]].forEach(([col, kk]) => {
          c.fillStyle = rgba(col, .85);
          for (let i = 0; i < 9; i++) {
            const fx = x + (i / 8 - .5) * 150 * k * (.4 + s.h), h = (60 + 150 * hs(i, 1)) * k * (.2 + 1.1 * s.h) * kk * (.8 + .2 * Math.sin(s.t * (5 + 4 * hs(i, 2)) + i)), w = 26 * k * kk;
            c.beginPath(); c.moveTo(fx - w, y); c.quadraticCurveTo(fx - w * .6, y - h * .5, fx + Math.sin(s.t * 3 + i) * 10 * k, y - h); c.quadraticCurveTo(fx + w * .6, y - h * .5, fx + w, y); c.fill();
          }
        });
        c.globalCompositeOperation = 'source-over';
        const mxp = W * .8, top = H * .2, bot = H * .82, hh = bot - top, half = .1 + .025 * lv('hearth');
        c.strokeStyle = 'rgba(190,205,255,.5)'; c.lineWidth = 2; c.strokeRect(mxp - 22, top, 44, hh);
        c.fillStyle = 'rgba(255,211,107,.28)'; c.fillRect(mxp - 22, bot - (.65 + half) * hh, 44, 2 * half * hh);
        c.fillStyle = s.flare > 0 ? '#ff6a5a' : '#ffd36b'; const my2 = bot - clamp(s.h, 0, 1.05) * hh; c.fillRect(mxp - 30, my2 - 3, 60, 6);
        label(c, `score ${Math.round(s.score)}`, 22, 34); label(c, s.streak > 1 ? `steady ${s.streak.toFixed(1)} s` : '', W / 2, 34, 'center');
        if (s.gust > 0) label(c, 'a gust of wind!', x, H * .2, 'center'); if (s.flare > 0) label(c, 'it flared!', x, H * .26, 'center');
      },
      info: s => `${Math.max(0, s.dur - s.t).toFixed(0)} s · score ${Math.round(s.score)}`, score: s => Math.round(s.score), shards: s => Math.round(s.score / 12)
    },
    dowse: {
      title: 'Dowsing', th: [5, 10, 15], el: 'water',
      blurb: 'Three springs lie hidden under the forest floor. Click to probe: a ring shows how far the nearest unfound spring is from that spot, so it lies somewhere on the ring. Find them all with as few probes as you can.',
      start() {
        const sp = [];
        while (sp.length < 3) { const p = { x: rand(W * .12, W * .88), y: rand(H * .22, H * .86), f: false }; if (sp.every(q => Math.hypot(q.x - p.x, q.y - p.y) > W * .12)) sp.push(p); }
        return { t: 0, probes: 8 + lv('rod'), sp, marks: [], found: 0, wait: 0, over: false };
      },
      step(s, dt) { s.t += dt; if (s.probes <= 0 || s.found >= 3) { s.wait += dt; if (s.wait > 1.4) s.over = true; } },
      click(s, x, y) {
        if (s.probes <= 0 || s.found >= 3) return;
        const un = s.sp.filter(q => !q.f); let near = null, d = Infinity;
        un.forEach(q => { const e = Math.hypot(q.x - x, q.y - y); if (e < d) { d = e; near = q; } });
        s.probes--;
        if (d < 34 + 8 * lv('sense')) { near.f = true; s.found++; s.marks.push({ x: near.x, y: near.y, ok: true, t: 0 }); } else s.marks.push({ x, y, d, t: 0 });
      },
      draw(s, c) {
        for (const m of s.marks) {
          m.t += 1 / 60;
          if (m.ok) {
            glow(c, m.x, m.y, 90, '#3fa0ff', .35); c.fillStyle = '#4a97e8'; c.beginPath(); c.ellipse(m.x, m.y, 40, 17, 0, 0, TAU); c.fill();
            c.strokeStyle = 'rgba(217,241,255,.7)'; c.lineWidth = 2; c.beginPath(); c.ellipse(m.x, m.y, 40 + 8 * Math.sin(m.t * 3), 17 + 3 * Math.sin(m.t * 3), 0, 0, TAU); c.stroke();
          } else {
            c.strokeStyle = 'rgba(190,205,255,.55)'; c.lineWidth = 2; c.beginPath(); c.arc(m.x, m.y, m.d, 0, TAU); c.stroke();
            c.fillStyle = '#fff'; c.beginPath(); c.arc(m.x, m.y, 4, 0, TAU); c.fill();
          }
        }
        label(c, `probes left ${s.probes}`, 22, 34); label(c, `springs found ${s.found} / 3`, W - 22, 34, 'right');
      },
      info: s => `probes ${s.probes} · found ${s.found}/3`, score: s => s.found * 5 + s.probes, shards: s => s.found * 2 + Math.floor(s.probes / 2)
    },
    cairn: {
      title: 'Cairn', th: [4, 8, 12], el: 'earth',
      blurb: 'A stone swings above your cairn. Click to drop it: only the part that lands on the stone below stays, so the stack narrows. A perfect drop keeps the full width. Stack fourteen.',
      start() {
        const bw = 190 + 16 * lv('flat');
        return { t: 0, blocks: [{ x: W / 2, w: bw }], cur: { x: rand(bw, W - bw), w: bw, dir: 1 }, speed: 190 * Math.pow(.93, lv('steady')), n: 0, perfect: 0, chips: [], end: 0, over: false };
      },
      step(s, dt) {
        s.t += dt;
        if (!s.end) { const c = s.cur; c.x += c.dir * s.speed * dt; if (c.x < c.w / 2 + 20) { c.x = c.w / 2 + 20; c.dir = 1; } if (c.x > W - c.w / 2 - 20) { c.x = W - c.w / 2 - 20; c.dir = -1; } }
        for (const q of s.chips) { q.vy += 900 * dt; q.y += q.vy * dt; } s.chips = s.chips.filter(q => q.y < H + 60);
        if (s.end) { s.end += dt; if (s.end > 1.4) s.over = true; }
      },
      click(s) {
        if (s.end) return;
        const top = s.blocks[s.blocks.length - 1], c = s.cur, l = Math.max(c.x - c.w / 2, top.x - top.w / 2), r = Math.min(c.x + c.w / 2, top.x + top.w / 2), BH = 30, gy = H - 70;
        const ty = gy - (s.blocks.length + 1) * BH;
        if (r - l < 6) { s.chips.push({ x: c.x, w: c.w, y: ty, vy: 0 }); s.end = .001; return; }
        let nb;
        if (Math.abs(c.x - top.x) < 7) { nb = { x: top.x, w: top.w }; s.perfect++; } else { nb = { x: (l + r) / 2, w: r - l }; s.chips.push({ x: c.x < top.x ? l - (c.w - (r - l)) / 2 : r + (c.w - (r - l)) / 2, w: c.w - (r - l), y: ty, vy: 0 }); }
        s.blocks.push(nb); s.n++; s.speed *= 1.06; s.cur = { x: c.x, w: nb.w, dir: c.dir };
        if (s.n >= 14) s.end = .001;
      },
      draw(s, c) {
        const BH = 30, gy = H - 70, shift = Math.max(0, (s.blocks.length + 1) * BH - H * .55);
        c.save(); c.translate(0, shift);
        c.fillStyle = '#1a140d'; c.fillRect(0, gy, W, H);
        s.blocks.forEach((b, i) => { const y = gy - (i + 1) * BH; c.fillStyle = i % 2 ? '#8a6a4f' : '#a58157'; c.strokeStyle = '#3a2614'; c.lineWidth = 2; c.fillRect(b.x - b.w / 2, y, b.w, BH - 2); c.strokeRect(b.x - b.w / 2, y, b.w, BH - 2); });
        if (!s.end) { const y = gy - (s.blocks.length + 1) * BH; c.fillStyle = '#b9884f'; c.strokeStyle = '#3a2614'; c.fillRect(s.cur.x - s.cur.w / 2, y, s.cur.w, BH - 2); c.strokeRect(s.cur.x - s.cur.w / 2, y, s.cur.w, BH - 2); }
        c.fillStyle = '#7a5f45'; for (const q of s.chips) c.fillRect(q.x - q.w / 2, q.y, q.w, BH - 2);
        c.restore();
        label(c, `stones ${s.n} / 14`, 22, 34); label(c, s.perfect ? `perfect ×${s.perfect}` : '', W - 22, 34, 'right');
      },
      info: s => `stones ${s.n} / 14`, score: s => s.n, shards: s => s.n + s.perfect
    }
  };
  const TIERS = ['A quiet night', 'A good night', 'A great night', 'A wondrous night'];
  const ready = id => (P().cd[id] || 0) - Date.now();

  function showRes(html) { const r = $('fp-res'); r.innerHTML = `<div class="fp-box">${html}</div>`; r.hidden = false; r.querySelector('button').onclick = leave; }
  function finishGame() {
    const sc = G.score(run); let tier = G.th.filter(t => sc >= t).length;
    if (tier < 3 && Math.random() < .12 * lv('omen')) tier++;
    const sh = G.shards(run) + tier, p = P();
    p.shards += sh; p.plays++; if (sc > (p.best[gid] || 0)) p.best[gid] = sc;
    const text = applyReward(rollReward(tier));
    FE.save();
    showRes(`<h3>${TIERS[tier]}</h3><p>Score <b>${sc}</b>${sc >= (p.best[gid] || 0) ? ' (your best)' : ''}</p><p class="good">${text}</p><p class="dim">+${sh} shard${sh === 1 ? '' : 's'} for the workshop (you have ${p.shards}).</p><button type="button">Back to the forest</button>`);
    run.done = true;
  }
  function leave() {
    cancelAnimationFrame(raf); raf = 0; run = null; g.hidden = true; $('fp-res').hidden = true; FE.modalOpen = false; FOR.render();
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!run || !fit()) return;
    run.mx = mx; run.my = my;
    if (!run.over && !run.done) { G.step(run, dt); if (run.over) finishGame(); }
    cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.clearRect(0, 0, W, H); cx.drawImage(scene, 0, 0, W, H);
    if (!run.done) G.draw(run, cx);
    $('fp-info').textContent = G.info(run);
  }
  function play(id) {
    if (ready(id) > 0 || run) return;
    FE.closePanel(); P().cd[id] = Date.now() + CFG.gameCd * 1000; FE.save();
    gid = id; G = GAMES[id]; g.hidden = false; FE.modalOpen = true; $('fp-res').hidden = true; $('fp-title').textContent = G.title;
    cv = $('fp-cv'); cx = cv.getContext('2d'); W = H = 0; fit(); run = G.start(); run.mx = mx = W / 2; run.my = my = H / 2;
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  $('fp-cv').addEventListener('pointerdown', e => { if (!run || run.over || run.done) return; const r = $('fp-cv').getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; G.click(run, mx, my); });
  $('fp-cv').addEventListener('pointermove', e => { const r = $('fp-cv').getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
  $('fp-quit').addEventListener('click', leave);

  // ---------------------------------------------------------------- the menu and the workshop
  function showGames() {
    FE.openPanel({
      kind: 'fgames',
      sig: () => JSON.stringify([P().shards, P().up, P().best]),
      build(box) {
        box.appendChild(FE.h('h3', '', 'Mini-games'));
        box.appendChild(FE.h('p', 'dim', 'Played full screen. Every game pays shards, kept for good, and a reward that gets stronger with your score.'));
        for (const id of Object.keys(GAMES)) {
          const d = GAMES[id], c = FE.h('div', 'qcard', `<div class="q-task">${d.title}</div><div class="q-line">${d.blurb}</div><div class="q-line good">Best: ${P().best[id] || 0} · reward tiers at ${d.th.join(', ')}</div>`);
          const b = FE.panelButton('Play', () => play(id)); b.id = 'fg-' + id; c.appendChild(b); box.appendChild(c);
        }
        const shop = FE.h('div', 'qcard'); shop.appendChild(FE.h('div', 'q-task', 'Workshop'));
        shop.appendChild(FE.h('div', 'q-line', `Shards are kept for good. You have <b>${FE.fmt(P().shards)}</b>.`));
        UPG.forEach(u => {
          const n = lv(u.id), maxed = n >= u.max, cst = ucost(u);
          const row = FE.h('div', 'q-line', `<b>${u.name}</b> ${n}/${u.max}${u.game ? ` (${GAMES[u.game].title})` : ''}: ${u.desc}`);
          const b = FE.panelButton(maxed ? 'Maxed' : `${cst} shards`, () => { if (P().shards < cst || lv(u.id) >= u.max) return; P().shards -= cst; P().up[u.id] = lv(u.id) + 1; FE.save(); FE.renderPanel(); });
          b.disabled = maxed || P().shards < cst; row.appendChild(document.createTextNode(' ')); row.appendChild(b); shop.appendChild(row);
        });
        box.appendChild(shop);
        box.appendChild(FE.h('div', 'btns')).appendChild(FE.panelButton('Close', FE.closePanel));
      },
      update() {
        for (const id of Object.keys(GAMES)) {
          const b = $('fg-' + id); if (!b) continue;
          const left = ready(id), t = left > 0 ? `Again in ${FE.clock(Math.ceil(left / 1000))}` : 'Play';
          if (b.textContent !== t) b.textContent = t; b.disabled = left > 0;
        }
      }
    });
  }
  FOR.games = GAMES; FOR.play = play; FOR.showGames = showGames; FOR.showQuests = showQuests; FOR.reward = applyReward; FOR.rollReward = rollReward;
  $('fp-qb').addEventListener('click', showQuests); $('fp-gb').addEventListener('click', showGames);

  // ---------------------------------------------------------------- the strip under the goal line
  let lastChips = '';
  function renderHud() {
    const p = P(), q = Q(), now = Date.now(), c = [], chip = (t, cls) => c.push(`<span class="chip ${cls || ''}">${t}</span>`);
    const qb = $('fp-qb'), gb = $('fp-gb'), b = F().buys;
    qb.hidden = !(b >= CFG.questAt || q.active || q.done || q.failed); gb.hidden = b < CFG.gamesAt;
    qb.classList.toggle('ping', !qb.hidden && !q.active && q.offers.length > 0);
    if (q.active) chip(`quest: ${q.active.kind === 'gen' ? `gather ${FE.fmt(q.active.x)}` : q.active.kind === 'frenzy' ? `click ×${q.active.x}` : q.active.kind === 'fuse' ? 'fuse a build' : q.active.kind === 'grow' ? 'grow a vessel' : 'buy nothing'} · ${mmss(q.active.end - now)}`, 'quest');
    if (buffOn()) chip(`warm spell ×${p.buff.mult} · ${mmss(p.buff.end - now)}`, 'good');
    if (p.echo > 0) chip(`echo: ${p.echo} clicks ×6`, 'good');
    if (cursed('frost')) chip(`frost · ${mmss(p.curse.end - now)}`, 'bad');
    if (cursed('damp')) chip(`damp wood · ${mmss(p.curse.end - now)}`, 'bad');
    if (wisps.length) chip(`${wisps.length} wisp${wisps.length === 1 ? '' : 's'}`, 'good');
    if (p.shards) chip(`${FE.fmt(p.shards)} shards`, 'dim');
    const html = c.join(''); if (html !== lastChips) { lastChips = html; $('fp-chips').innerHTML = html; }
  }
  const oldRender = FE.render;
  FE.render = function () { oldRender(); renderHud(); };
});
