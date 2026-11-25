/* minigames.js - three small games in the panel, each with a lasting perk (the numbers are in config.js):
 *   meteor shower  -> a permanent production bonus
 *   orbit lock     -> planets, moons and comets caught in orbit around your star (a limited-time multiplier, and echoes)
 *   rogue signal   -> a bigger chance of a rogue star colliding with yours (a free tier)
 *   solar surge    -> a production boost for a few minutes
 *   collider       -> antimatter
 * A game can be played again FE.MINI.cooldown seconds after it was started. Quitting early gives nothing. */
FE.module(function (FE) {
  const $ = FE.$, ids = FE.ELEMENTS.map(e => e.id), W = 480, H = 320, TAU = Math.PI * 2;
  const rnd = (a, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const hexA = (c, a) => { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  // ---- the games: start(), step(dt), draw(ctx), click(x, y), and a result once over ----
  const GAMES = {
    meteor: {
      title: 'Meteor Shower', blurb: 'Click the falling meteors before they reach the ground. 20 seconds.',
      perk: () => `+1% production for every 3 caught, for good (now +${Math.round(FE.state.mgBoost * 100)}%)`,
      start() { return { t: 0, next: .3, rocks: [], got: 0, lost: 0, over: false, bursts: [] }; },
      step(g, dt) {
        g.t += dt;
        if (g.t < 20) { g.next -= dt; if (g.next <= 0) { g.next = rnd(.25, .6); g.rocks.push({ x: rnd(30, W - 30), y: -20, v: rnd(70, 150) + g.t * 4, r: rnd(11, 18), a: rnd(0, TAU) }); } }
        for (const r of g.rocks) { r.y += r.v * dt; r.a += dt * 2; if (r.y > H + 20) { r.dead = true; g.lost++; } }
        g.rocks = g.rocks.filter(r => !r.dead);
        g.bursts.forEach(b => b.t += dt); g.bursts = g.bursts.filter(b => b.t < .4);
        if (g.t >= 20 && !g.rocks.length) g.over = true;
      },
      click(g, x, y) {
        for (const r of g.rocks) if (Math.hypot(x - r.x, y - r.y) < r.r + 8) { r.dead = true; g.got++; g.bursts.push({ x: r.x, y: r.y, t: 0 }); return; }
      },
      draw(g, c) {
        for (const r of g.rocks) {
          const tail = c.createLinearGradient(r.x, r.y - 60, r.x, r.y); tail.addColorStop(0, 'rgba(255,170,90,0)'); tail.addColorStop(1, 'rgba(255,170,90,.6)');
          c.fillStyle = tail; c.fillRect(r.x - r.r * .5, r.y - 60, r.r, 60);
          c.save(); c.translate(r.x, r.y); c.rotate(r.a); c.fillStyle = '#9a8a7a'; c.strokeStyle = '#d9c6ae'; c.lineWidth = 1.5; c.beginPath();
          for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, k = .75 + .25 * Math.sin(i * 12.9 + r.r); c.lineTo(Math.cos(a) * r.r * k, Math.sin(a) * r.r * k); }
          c.closePath(); c.fill(); c.stroke(); c.restore();
        }
        for (const b of g.bursts) { c.strokeStyle = `rgba(255,230,160,${1 - b.t / .4})`; c.lineWidth = 3; c.beginPath(); c.arc(b.x, b.y, 8 + 40 * b.t, 0, TAU); c.stroke(); }
        c.fillStyle = '#cdd7f5'; c.font = '16px "Times New Roman", serif'; c.textAlign = 'left'; c.fillText(`caught ${g.got}`, 12, 22); c.textAlign = 'right'; c.fillText(`${Math.max(0, 20 - g.t).toFixed(0)} s`, W - 12, 22);
      },
      finish(g) {
        const s = FE.state, add = Math.min(Math.floor(g.got / 3) * .01, Math.max(0, FE.MINI_BOOST_MAX - s.mgBoost));
        s.mgBoost += add;
        return `Caught ${g.got}. ${add ? `Production +${Math.round(add * 100)}% for good (now +${Math.round(s.mgBoost * 100)}%).` : 'Catch at least 3 for a bonus.'}`;
      }
    },
    orbit: {
      title: 'Orbit Lock', blurb: 'A wandering body circles your star. Click as it crosses the mark to lock it into orbit. Five passes; each lock is a new body, but it speeds up and the mark narrows.',
      perk: () => `moons, planets and comets: a production multiplier and echoes, for a few minutes (${FE.state.orbit.filter(o => o.end > Date.now()).length} in orbit now)`,
      start() { return { a: rnd(0, TAU), v: 2.2, tries: 5, hit: 0, win: .42, flash: 0, over: false, msg: '', caught: [], el: pick(ids), wait: 0 }; },
      step(g, dt) {
        g.a = (g.a + g.v * dt) % TAU; g.flash = Math.max(0, g.flash - dt * 2);
        if (g.tries <= 0) { g.wait += dt; if (g.wait > .8) g.over = true; }
      },
      click(g) {
        if (g.tries <= 0) return;
        g.tries--;
        const d = Math.abs(((g.a + Math.PI * 1.5) % TAU) - Math.PI);   // distance (radians) from the mark at the top
        const off = Math.min(d, TAU - d);
        if (off < g.win) {
          const kind = pick(['moon', 'moon', 'planet', 'comet']); g.caught.push({ kind, el: pick(ids) }); g.hit++; g.flash = 1; g.v *= 1.18; g.win *= .85; g.msg = `locked: a ${kind}`;
        } else g.msg = 'missed';
        g.el = pick(ids);
      },
      draw(g, c) {
        const cx = W / 2, cy = H / 2 + 6, R = 104, p = FE.PAL[FE.el()];
        const sg = c.createRadialGradient(cx, cy, 0, cx, cy, 52); sg.addColorStop(0, p.core); sg.addColorStop(.6, p.mid); sg.addColorStop(1, hexA(p.glow, 0)); c.fillStyle = sg; c.beginPath(); c.arc(cx, cy, 52, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(190,205,255,.3)'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
        c.strokeStyle = `rgba(255,255,255,${.5 + .5 * g.flash})`; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, R, -Math.PI / 2 - g.win, -Math.PI / 2 + g.win); c.stroke();   // the mark
        c.fillStyle = '#fff'; c.beginPath(); c.moveTo(cx, cy - R - 16); c.lineTo(cx - 6, cy - R - 26); c.lineTo(cx + 6, cy - R - 26); c.closePath(); c.fill();
        const x = cx + Math.cos(g.a - Math.PI / 2 + Math.PI / 2) * R, y = cy + Math.sin(g.a) * R;
        const q = FE.PAL[g.el]; c.fillStyle = hexA(q.glow, .35); c.beginPath(); c.arc(x, y, 18, 0, TAU); c.fill(); c.fillStyle = q.mid; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill();
        c.fillStyle = '#cdd7f5'; c.font = '16px "Times New Roman", serif'; c.textAlign = 'left'; c.fillText(`passes left ${g.tries}`, 12, 22); c.textAlign = 'right'; c.fillText(`locked ${g.hit}`, W - 12, 22);
        c.textAlign = 'center'; c.fillText(g.msg, cx, H - 14);
      },
      finish(g) {
        g.caught.forEach(b => FE.addOrbiter(b.kind, b.el));
        return g.caught.length ? `Locked ${g.caught.map(b => `a ${b.el} ${b.kind}`).join(', ')} into orbit.` : 'Nothing locked this time.';
      }
    },
    surge: {
      title: 'Solar Surge', blurb: 'Elemental flares wink on in a grid of nine. Click each one before it fades. 15 seconds; they get quicker.',
      perk: () => 'a production boost that grows with your score, for 5 minutes (it never replaces a bigger one)',
      cell(i) { return { x: 108 + (i % 3) * 92, y: 36 + Math.floor(i / 3) * 92, w: 80, h: 80 }; },
      start() { return { t: 0, cell: -1, life: 0, next: .4, got: 0, miss: 0, el: 'fire', over: false }; },
      step(g, dt) {
        g.t += dt;
        if (g.cell >= 0) { g.life -= dt; if (g.life <= 0) { g.cell = -1; g.miss++; g.next = .15; } }
        else if (g.t < 15) { g.next -= dt; if (g.next <= 0) { g.cell = Math.floor(rnd(0, 9)); g.life = Math.max(.45, 1.05 - g.t * .035); g.el = pick(ids); } }
        else g.over = true;
      },
      click(g, x, y) {
        if (g.cell < 0) return;
        const c = GAMES.surge.cell(g.cell);
        if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) { g.got++; g.cell = -1; g.next = .18; }
      },
      draw(g, c) {
        for (let i = 0; i < 9; i++) {
          const b = GAMES.surge.cell(i), on = i === g.cell, q = FE.PAL[g.el];
          c.fillStyle = on ? hexA(q.glow, .35 + .5 * (g.life / 1.05)) : 'rgba(255,255,255,.04)'; c.strokeStyle = on ? q.glow : 'rgba(190,205,255,.25)'; c.lineWidth = on ? 3 : 1;
          c.fillRect(b.x, b.y, b.w, b.h); c.strokeRect(b.x, b.y, b.w, b.h);
          if (on) { c.fillStyle = hexA(q.core, .9); c.beginPath(); c.arc(b.x + b.w / 2, b.y + b.h / 2, 16, 0, TAU); c.fill(); }
        }
        c.fillStyle = '#cdd7f5'; c.font = '16px "Times New Roman", serif'; c.textAlign = 'left'; c.fillText(`flares ${g.got}`, 12, 22); c.textAlign = 'right'; c.fillText(`${Math.max(0, 15 - g.t).toFixed(0)} s`, W - 12, 22);
      },
      finish(g) {
        const s = FE.state, m = +(1 + Math.min(2, g.got * .08)).toFixed(2);
        if (g.got && (!FE.buffOn() || s.buff.mult < m)) s.buff = { mult: m, end: Date.now() + 300000 };
        return g.got ? `${g.got} flares. All production ×${m} for 5 minutes${FE.buffOn() && s.buff.mult > m ? ' (a bigger boost was already running)' : ''}.` : 'No flares caught this time.';
      }
    },
    collider: {
      title: 'Antimatter Collider', blurb: 'A bead sweeps the track. Stop it dead in the middle. Three shots, each one faster; the closer, the more antimatter.',
      perk: () => 'up to 120 antimatter at once, for relighting stars after a collapse',
      start() { return { pos: 0, dir: 1, speed: 1.1, shots: [], over: false, wait: 0 }; },
      step(g, dt) {
        if (g.shots.length >= 3) { g.wait += dt; if (g.wait > 1) g.over = true; return; }
        g.pos += g.dir * g.speed * dt; if (g.pos > 1) { g.pos = 1; g.dir = -1; } if (g.pos < 0) { g.pos = 0; g.dir = 1; }
      },
      click(g) { if (g.shots.length >= 3) return; g.shots.push(Math.max(0, 1 - Math.abs(g.pos - .5) * 2)); g.speed *= 1.3; },
      draw(g, c) {
        const x0 = 50, x1 = W - 50, y = 150;
        c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(x0, y - 14, x1 - x0, 28);
        c.fillStyle = 'rgba(127,214,255,.25)'; c.fillRect(W / 2 - 18, y - 14, 36, 28); c.strokeStyle = '#7fd6ff'; c.lineWidth = 2; c.strokeRect(W / 2 - 18, y - 14, 36, 28);
        const bx = x0 + g.pos * (x1 - x0), gl = c.createRadialGradient(bx, y, 0, bx, y, 22); gl.addColorStop(0, '#fff'); gl.addColorStop(.4, 'rgba(160,220,255,.8)'); gl.addColorStop(1, 'rgba(160,220,255,0)'); c.fillStyle = gl; c.fillRect(bx - 22, y - 22, 44, 44);
        c.fillStyle = '#cdd7f5'; c.font = '16px "Times New Roman", serif'; c.textAlign = 'center';
        g.shots.forEach((a, i) => c.fillText(`shot ${i + 1}: ${Math.round(a * 40)} antimatter`, W / 2, 210 + i * 26));
        c.textAlign = 'left'; c.fillText(`shots left ${3 - g.shots.length}`, 12, 22);
      },
      finish(g) {
        const n = g.shots.reduce((a, v) => a + Math.round(v * 40), 0);
        FE.state.antimatter += n;
        return `${n} antimatter collected.`;
      }
    },
    signal: {
      title: 'Rogue Signal', blurb: 'The four elements flash in a pattern. Repeat it by clicking them in the same order. Each round adds one. A mistake ends it.',
      perk: () => `each round makes a rogue star a little more likely to find you (luck ${FE.state.rogueLuck.toFixed(1)} of ${FE.ROGUE.luckMax})`,
      start() { return { seq: [pick(ids)], show: 0, phase: 'show', inp: 0, lit: null, t: 0, round: 0, over: false, bad: false, wait: 0 }; },
      step(g, dt) {
        g.t += dt;
        if (g.phase === 'show') {
          const i = Math.floor(g.t / .7 - .6), on = (g.t / .7 - .6) - i < .6;
          g.lit = i >= 0 && i < g.seq.length && on ? g.seq[i] : null;
          if (i >= g.seq.length) { g.phase = 'input'; g.inp = 0; g.lit = null; }
        } else if (g.lit && g.t > g.litUntil) g.lit = null;
        if (g.phase === 'done') { g.wait += dt; if (g.wait > .9) g.over = true; }
      },
      pad(i) { const col = i % 2, row = Math.floor(i / 2); return { x: 90 + col * 160, y: 50 + row * 120, w: 140, h: 100, id: ids[i] }; },
      click(g, x, y) {
        if (g.phase !== 'input') return;
        for (let i = 0; i < 4; i++) {
          const p = GAMES.signal.pad(i);
          if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
            g.lit = p.id; g.litUntil = g.t + .25;
            if (p.id !== g.seq[g.inp]) { g.phase = 'done'; g.bad = true; return; }
            if (++g.inp >= g.seq.length) {
              g.round++;
              if (g.round >= 8) { g.phase = 'done'; return; }
              g.seq.push(pick(ids)); g.phase = 'show'; g.t = 0;
            }
            return;
          }
        }
      },
      draw(g, c) {
        for (let i = 0; i < 4; i++) {
          const p = GAMES.signal.pad(i), q = FE.PAL[p.id], on = g.lit === p.id;
          c.fillStyle = on ? hexA(q.glow, .85) : hexA(q.dk, .35); c.strokeStyle = hexA(q.glow, on ? 1 : .5); c.lineWidth = on ? 3 : 1.5;
          c.fillRect(p.x, p.y, p.w, p.h); c.strokeRect(p.x, p.y, p.w, p.h);
          c.fillStyle = on ? '#fff' : hexA(q.core, .7); c.font = '18px "Times New Roman", serif'; c.textAlign = 'center'; c.fillText(p.id, p.x + p.w / 2, p.y + p.h / 2 + 6);
        }
        c.fillStyle = '#cdd7f5'; c.font = '16px "Times New Roman", serif'; c.textAlign = 'left'; c.fillText(g.phase === 'show' ? 'watch...' : g.phase === 'input' ? 'now you' : g.bad ? 'wrong' : 'perfect', 12, 22);
        c.textAlign = 'right'; c.fillText(`round ${g.round + (g.phase === 'done' ? 0 : 1)}`, W - 12, 22);
      },
      finish(g) {
        const s = FE.state, add = Math.min(g.round * .5, Math.max(0, FE.ROGUE.luckMax - s.rogueLuck));
        s.rogueLuck += add;
        return g.round ? `${g.round} round${g.round === 1 ? '' : 's'} right. Rogue star luck +${add.toFixed(1)} (now ${s.rogueLuck.toFixed(1)}).` : 'No rounds this time.';
      }
    }
  };
  FE.MINIGAMES = GAMES;

  // ---- the panel: a menu, then the game ----
  let mode = 'menu', run = null, raf = 0, last = 0, cv = null, ctx = null, resultText = '';
  const ready = id => (FE.state.mgReady[id] || 0) - Date.now();

  function stop() { cancelAnimationFrame(raf); raf = 0; run = null; cv = null; }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!run || !ctx) return;
    const G = GAMES[mode.slice(5)];
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#04060f'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,255,255,${.2 + .5 * ((i * 37) % 10) / 10})`; ctx.fillRect((i * 97) % W, (i * 53) % H, 1.5, 1.5); }
    if (!run.over) { G.step(run, dt); G.draw(run, ctx); if (run.over) { resultText = G.finish(run); FE.save(); FE.render(); mode = 'result'; FE.renderPanel(); stop(); } }
  }
  function play(id) {
    if (ready(id) > 0) return;
    FE.state.mgReady[id] = Date.now() + FE.MINI.cooldown * 1000;
    mode = 'play:' + id; run = GAMES[id].start(); resultText = '';
    FE.renderPanel();
    last = performance.now(); raf = requestAnimationFrame(frame);
  }

  FE.showGames = function () {
    mode = 'menu'; stop();
    FE.openPanel({
      kind: 'games', noBackdrop: false,
      sig: () => mode + (mode === 'result' ? resultText : ''),
      close() { stop(); mode = 'menu'; },
      build(box) {
        const H3 = FE.h;
        if (mode === 'menu') {
          box.appendChild(H3('h3', '', 'Mini-games'));
          box.appendChild(H3('p', 'dim', 'Small games with lasting perks. Each can be played again a couple of minutes after it starts.'));
          for (const id of Object.keys(GAMES)) {
            const g = GAMES[id], c = H3('div', 'qcard', `<div class="q-task">${g.title}</div><div class="q-line">${g.blurb}</div><div class="q-line good">Perk: ${g.perk()}</div>`);
            const b = FE.panelButton('Play', () => play(id)); b.id = 'mg-' + id; c.appendChild(b); box.appendChild(c);
          }
          box.appendChild(H3('div', 'btns')).appendChild(FE.panelButton('Close', FE.closePanel));
        } else if (mode === 'result') {
          box.appendChild(H3('h3', '', 'Done'));
          box.appendChild(H3('p', '', resultText));
          const row = H3('div', 'btns'); row.appendChild(FE.panelButton('Back', () => { mode = 'menu'; FE.renderPanel(); })); row.appendChild(FE.panelButton('Close', FE.closePanel)); box.appendChild(row);
        } else {
          const G = GAMES[mode.slice(5)];
          box.appendChild(H3('h3', '', G.title));
          cv = H3('canvas', 'mg-cv'); cv.width = W; cv.height = H; ctx = cv.getContext('2d');
          cv.addEventListener('pointerdown', e => {
            if (!run || run.over) return;
            const r = cv.getBoundingClientRect(); G.click(run, (e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height);
          });
          box.appendChild(cv);
          box.appendChild(H3('div', 'btns')).appendChild(FE.panelButton('Quit (no reward)', () => { stop(); mode = 'menu'; FE.renderPanel(); }, 'danger'));
        }
      },
      update() {
        if (mode !== 'menu') return;
        for (const id of Object.keys(GAMES)) {
          const b = $('mg-' + id); if (!b) continue;
          const left = ready(id), t = left > 0 ? `Again in ${FE.clock(Math.ceil(left / 1000))}` : 'Play';
          if (b.textContent !== t) b.textContent = t;
          b.disabled = left > 0;
        }
      }
    });
  };
  FE.buildMinigames = function () { $('hud-games').addEventListener('click', FE.showGames); };
});
