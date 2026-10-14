/* effects.js - the icons that leave the element button, and the multiplier they drive.
 *
 * Two separate things on purpose:
 *   - `live`   : the LOGICAL icons, each just { end: timestamp }. The multiplier reads only this, so it never
 *                depends on the DOM, on animation events, or on whether the tab was throttled.
 *   - the DOM  : purely cosmetic nodes that try to match each logical icon's lifetime.
 * There is no limit on icons. Nothing lives longer than ~18s.
 */
(function (FE) {
  const $ = FE.$;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const live = new Set();        // logical icons
  const hanging = new Set();     // water droplets still attached under the button
  const now = () => performance.now();
  const visuals = () => !reduceMotion.matches && !document.hidden;
  const fontPx = el => parseFloat(getComputedStyle(el).fontSize);
  const track = dur => { const icon = { end: now() + dur }; live.add(icon); return icon; };

  function prune() { const t = now(); live.forEach(i => { if (i.end <= t) live.delete(i); }); }
  FE.liveIcons = () => { prune(); return live.size; };
  // 1.0x with nothing on screen, +0.1 per icon (always in tenths) - but never above the max multiplier
  FE.multiplier = () => Math.min(FE.maxMultiplier(), FE.round1(1 + FE.liveIcons() * FE.MULT_PER_ICON));

  FE.clearIcons = function () {
    live.clear();
    hanging.forEach(g => clearTimeout(g.timer));
    hanging.clear();
    $('drops').replaceChildren();
  };

  function makeNode(k, px, parent) {
    const el = document.createElement('span');
    el.className = 'drop';
    el.style.color = `var(--${k})`;
    if (px) el.style.width = el.style.height = px + 'px';
    el.innerHTML = `<svg viewBox="0 0 24 24">${FE.ICONS[k]}</svg>`;
    (parent || $('drops')).appendChild(el);
    return el;
  }
  function run(el, frames, opts) {
    const a = el.animate(frames, Object.assign({ fill: 'forwards' }, opts));
    a.onfinish = a.oncancel = () => el.remove();
    return a;
  }
  const side = () => (Math.random() < 0.5 ? -1 : 1);

  // ---- earth: straight down, accelerating, off the bottom of the screen (shortest-lived) ----
  function earth(r, px) {
    const x0 = r.left + r.width / 2 - px / 2 + (Math.random() - 0.5) * r.width * 0.5;
    const y0 = r.bottom - px * 0.5;                              // emerges right at the bottom edge of the box
    const dist = Math.max(innerHeight - y0 + px, px * 2);
    const dur = 700 + Math.sqrt(dist) * 30;
    track(dur);
    if (!visuals()) return;
    const el = makeNode('earth', px);
    el.style.left = x0 + 'px'; el.style.top = y0 + 'px';
    const sway = (Math.random() - 0.5) * 24, spin = (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 60);
    run(el, [
      { transform: 'translate(0,0) rotate(0deg) scale(.7)', opacity: 0 },
      { transform: `translate(${sway * 0.05}px,${dist * 0.03}px) rotate(${spin * 0.05}deg) scale(1)`, opacity: 1, offset: 0.06 },
      { transform: `translate(${sway}px,${dist}px) rotate(${spin}deg) scale(1)`, opacity: 1 }
    ], { duration: dur, easing: 'cubic-bezier(.5,0,.9,.55)' });
  }

  // ---- air: constant speed to one side, a gentle wobble, slowly turning ----
  function air(r, px) {
    const x0 = r.left + r.width / 2 - px / 2, y0 = r.top + r.height * 0.4;
    const s = side();
    const dist = (s < 0 ? x0 + px : innerWidth - x0 + px);
    const dur = dist / (190 + Math.random() * 40) * 1000;      // px per second -> same pace on any screen width
    track(dur);
    if (!visuals()) return;
    const el = makeNode('air', px);
    el.style.left = x0 + 'px'; el.style.top = y0 + 'px';
    const ph = Math.random() * 6, N = 12, frames = [];
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      frames.push({ transform: `translate(${s * dist * f}px,${Math.sin(ph + f * 7) * 14}px) rotate(${s * f * 50}deg)`, opacity: i === 0 ? 0 : 1, offset: f });
    }
    run(el, frames, { duration: dur, easing: 'linear' });
  }

  // ---- fire: slow wandering embers drifting sideways across the page (longest-lived) ----
  function fire(r, px) {
    const x0 = r.left + 4 + Math.random() * Math.max(0, r.width - px - 8);   // always starts inside the box
    const y0 = r.top + (r.height - px) / 2;
    const s = side();
    const dist = (s < 0 ? x0 + px : innerWidth - x0 + px);
    const dur = Math.min(18000, Math.max(6000, dist / (70 + Math.random() * 20) * 1000));
    track(dur);
    if (!visuals()) return;
    const el = makeNode('fire', px);
    el.style.left = x0 + 'px'; el.style.top = y0 + 'px';
    const p1 = Math.random() * 6, p2 = Math.random() * 6, N = 36, frames = [];
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      const x = s * dist * f + (Math.sin(p1 + f * 9) - Math.sin(p1)) * 18;   // wander is zero at f=0
      const y = (Math.sin(p2 + f * 6) - Math.sin(p2)) * 38 - f * 30;
      frames.push({
        transform: `translate(${x}px,${y}px) rotate(${(Math.sin(p1 + f * 14) - Math.sin(p1)) * 10}deg) scale(${1 - 0.5 * f})`,
        opacity: i === 0 ? 0 : (i === N ? 0.4 : (i % 2 ? 0.65 : 1)),
        offset: f
      });
    }
    run(el, frames, { duration: dur, easing: 'linear' });
  }

  // ---- water: small droplets hang under the button, merge into bigger ones, then fall (bigger = faster) ----
  const scaleFor = mass => Math.min(1.6, 0.8 * (1 + 0.3 * (mass - 1)));
  const fallDur = g => (450 + Math.sqrt(innerHeight - g.y + g.s * 2) * 26) / (1 + 0.45 * (g.mass - 1));

  function schedule(g, delay) {
    clearTimeout(g.timer);
    g.fallAt = now() + delay;
    g.dur = fallDur(g);
    g.entries.forEach(e => { e.end = g.fallAt + g.dur; });    // logical lifetime follows the real fall
    g.timer = setTimeout(() => release(g), delay);
  }
  function release(g) {
    hanging.delete(g);
    const dist = innerHeight - g.btn.getBoundingClientRect().bottom + g.s * 2;
    g.el.style.transition = 'none';
    run(g.el, [
      { transform: `translateY(0) scale(${g.scale})` },
      { transform: `translateY(${dist}px) scale(${g.scale},${g.scale * 1.35})` }
    ], { duration: g.dur, easing: 'cubic-bezier(.55,0,1,.75)' });
  }
  function merge(g, entry) {
    g.mass++;
    g.entries.push(entry);
    g.scale = scaleFor(g.mass);
    g.el.style.transition = 'transform .4s cubic-bezier(.3,1.7,.5,1)';
    g.el.style.transform = `scale(${g.scale})`;
    // two drops let go soon; three or more go almost at once
    schedule(g, g.mass >= 3 ? 350 : Math.min(Math.max(0, g.fallAt - now()), 1100));
  }

  // Droplets are children of the button's .hang layer (just under its bottom edge), so they stay glued to the box
  // wherever it goes. x is measured in the box's own coordinates. The tip of the drop sits on the box's bottom border.
  function water(r, px, btn) {
    const s = px * 0.55;
    const hang = 2800 + Math.random() * 1800;
    const entry = track(hang + 1300);                           // refined by schedule()
    const layer = btn.querySelector('.hang');
    if (!visuals() || !layer) return;
    const left = btn.offsetWidth * 0.15, right = btn.offsetWidth * 0.85;
    const list = [...hanging];
    let x = left + Math.random() * (right - left);
    if (list.length && Math.random() < 0.6) {                   // often start next to an existing drop so they can join
      const g = list[Math.floor(Math.random() * list.length)];
      x = g.x + (Math.random() - 0.5) * s * 1.2;
    }
    x = Math.min(right, Math.max(left, x));
    const near = list.find(g => Math.abs(g.x - x) < s * 1.1);
    if (near) { merge(near, entry); return; }

    const el = makeNode('water', s, layer);
    const border = parseFloat(getComputedStyle(btn).borderBottomWidth) || 0;
    const g = { el, btn, x, y: r.bottom, s, mass: 1, scale: 0.8, entries: [entry], timer: 0, fallAt: 0, dur: 0 };
    el.style.left = (x - s / 2) + 'px'; el.style.top = (border - s * 0.125) + 'px';
    el.style.transformOrigin = '50% 12.5%';                     // grow from the tip, so it stays attached
    el.style.transform = 'scale(.3)'; el.style.opacity = '0';
    hanging.add(g);
    requestAnimationFrame(() => {
      el.style.transition = `transform ${hang}ms ease-out, opacity .3s ease`;
      el.style.transform = `scale(${g.scale})`; el.style.opacity = '1';
    });
    schedule(g, hang);
  }

  const SPAWN = { air, water, earth, fire };
  FE.spawnIcon = function (k) {
    const btn = $('btn-' + k);
    if (!btn) return;
    SPAWN[k](btn.getBoundingClientRect(), fontPx(btn) * 1.5, btn);
  };
})(window.FE);
