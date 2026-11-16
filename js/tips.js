/* tips.js - the tutorial: a short tip the first time each thing appears, and the "how to play." guide in the footer.
 *
 * Tips come from playtest 2 (confusing start, unclear upgrades, combat with no help). One shows at a time, in the corner,
 * and outlines the part of the screen it is about. A tip is marked seen (and joins the guide) when you click "got it."
 * or do what it says (`done`). If its moment passes first (`when` stops holding) it just closes, and comes back next
 * time. An `urgent` tip (something you must act on now) pushes an ordinary one aside; that one comes back later.
 * Seen tips are kept in the save (state.tips); tips on/off is a browser setting like text size.
 */
FE.module(function (FE) {
  const $ = FE.$;
  const ink = k => `<span class="ink-${k}">${k}</span>`;
  const first = () => FE.state.owned[0];
  const shown = id => { const el = $(id); return !!el && !el.hidden; };
  const anyOwned = f => FE.state.owned.some(f);
  const firstOwned = f => FE.state.owned.find(f);
  const beats = () => FE.ELEMENTS.map(e => e.id).map(k => `${ink(k)} beats ${ink(FE.BEATS[k])}`).join(', ');

  // In order: the first unseen tip whose `when` holds is the one shown.
  // when/done/target/text all read the state at call time. target is an element id (or a function returning one).
  const TIPS = [
    { id: 'pick', title: 'choosing an element', urgent: true,
      when: s => s.picking && !s.owned.length,
      target: 'gather',
      text: () => 'Pick an element to begin. Investigating is free, and every element plays the same way at the start.' },
    { id: 'gather', title: 'gathering',
      when: s => s.owned.length > 0 && !s.picking,
      done: () => FE.totalCount() >= 50,
      target: () => 'btn-' + first(),
      text: () => {
        const k = first(), key = FE.ELEMENTS.find(e => e.id === k).key;
        return `Click ${ink(k)}, or press <b>${key}</b>, to gather it. Your stores are on the right. The italic line under the title always says what to do next.`;
      } },
    { id: 'mult', title: 'the multiplier',
      when: s => s.owned.length > 0 && FE.totalCount() >= 50,
      target: 'mult',
      text: () => `This is your multiplier. Every icon still falling adds ×${FE.MULT_PER_ICON}, so clicking quickly raises it, up to ×${FE.maxMultiplier()}. Everything you gather is multiplied by it.` },
    { id: 'res', title: 'resonance',
      when: s => anyOwned(k => s.seen['res-' + k]),
      done: () => anyOwned(k => FE.state.up[k].res > 0),
      target: () => 'build-res-' + firstOwned(k => FE.state.seen['res-' + k]),
      text: () => 'Resonance doubles what each click gathers. Builds are paid for with the element they improve, so buying one takes from your stores.' },
    { id: 'balance', title: 'the balance bar',
      when: s => s.balanceShown,
      target: 'balance-box',
      text: () => `The balance bar shows how much of each element you hold, out of ${FE.fmt(FE.CAP)} storage. Once you have two elements, an uneven bar draws enemies.` },
    { id: 'struct', title: 'structures',
      when: s => anyOwned(k => s.seen['struct-' + k]),
      done: () => FE.structures() > 0,
      target: () => 'build-struct-' + firstOwned(k => FE.state.seen['struct-' + k]),
      text: () => {
        const k = firstOwned(k => FE.state.seen['struct-' + k]);
        return `A ${FE.STRUCT_NAMES[k]} gathers ${FE.STRUCT_RATE} ${ink(k)} a second for you, times your multiplier. Each one costs more than the last.`;
      } },
    { id: 'works', title: 'works',
      when: () => shown('works-box'),
      target: 'works-box',
      text: () => 'Works lists everything that runs by itself. Switch one off to pause it, for example to keep your elements even.' },
    { id: 'surge', title: 'surges',
      when: () => shown('surge-btn'),
      target: 'surge-btn',
      text: () => `A surge is a short mini-game. Play it for a lump of ${ink(first())} and a ${FE.SURGE.buffSec} second production boost, or ignore it. Skipping costs nothing.` },
    { id: 'condense', title: 'condensing', urgent: true,
      when: s => FE.locked() && !s.planets && s.owned.length > 0,
      done: () => FE.state.planets > 0,
      target: 'build-cond',
      text: () => `Storage is full, so gathering and buying stop. Condense: you lose your stores and builds, but keep a crystal that raises your max multiplier by ${FE.CRYSTAL_MAX_MULT}. The first crystal also forms a planet and a new element.` },
    { id: 'second', title: 'a new element', urgent: true,
      when: s => s.picking && s.owned.length > 0,
      target: 'gather',
      text: () => 'Choose another element. You keep the ones you have, and investigating is not a gamble: nothing is lost.' },
    { id: 'star', title: 'your star',
      when: () => shown('star-box'),
      target: 'star-box',
      text: () => 'Every crystal you hold feeds this star, and it grows on its own. Crystals are never lost when you condense.' },
    { id: 'spells', title: 'spells', urgent: true,
      when: s => s.owned.length >= 2 && !s.enemy,
      done: () => FE.state.conjured > 0,
      target: 'spells-box',
      text: () => `Conjure folds everything you hold into one spell. Its element is whatever you hold most of, and its power is how much you held. You can keep ${FE.SPELL_SLOTS}.`
        + (FE.state.leaderIn != null ? ' Something is coming, so have one ready.' : ' Cast them at vagrants.') },
    { id: 'vagrant', title: 'vagrants', urgent: true,
      when: s => !!s.enemy,
      done: () => FE.state.kills > 0,
      target: 'enc-box',
      text: () => `Click a spell in the spells box to cast it before the timer runs out, or the vagrant raids your stores and a structure. The right element does double damage: ${beats()}.` },
    { id: 'threat', title: 'the threat meter',
      when: s => s.threatOn && !s.enemy,
      target: 'threat-row',
      text: () => 'When the threat meter fills, a vagrant comes. It fills faster when one element dominates your stores and as your works grow.' },
    { id: 'crafting', title: 'crafting',
      when: () => FE.crafting && FE.crafting(),
      target: 'pager',
      text: () => 'Builds now has three pages: use the arrows. Converters turn elements into materials, but only while one element leads the bar by enough. Materials do not take up storage.' }
  ];

  // ---- tips on or off (a browser setting, like text size) ----
  let on = true;
  try { on = localStorage.getItem(FE.TIPS_KEY) !== 'off'; } catch (e) {}
  function setOn(v) {
    on = v;
    try { localStorage.setItem(FE.TIPS_KEY, v ? 'on' : 'off'); } catch (e) {}
    if (!v) hide();
    renderGuide();
  }

  // ---- the tip card ----
  let current = null, targetEl = null, quietUntil = 0;   // a short pause between one tip and the next
  const seen = () => FE.state.tips || (FE.state.tips = {});
  const resolve = t => typeof t.target === 'function' ? t.target() : t.target;

  function outline(id) {
    const el = id ? $(id) : null;
    if (el === targetEl) return;
    if (targetEl) targetEl.classList.remove('tip-on');
    targetEl = el;
    if (el) el.classList.add('tip-on');
  }
  function show(t) {
    current = t;
    $('tip-title').textContent = t.title;
    $('tip-text').innerHTML = t.text();
    $('tip').hidden = false;
    outline(resolve(t));
    FE.sfx('ui');
  }
  function hide() {
    current = null;
    $('tip').hidden = true;
    outline(null);
  }
  function finish() {           // mark the open tip seen and close it
    if (!current) return;
    seen()[current.id] = true;
    hide();
    quietUntil = performance.now() + 1500;
    FE.save();
  }

  // Polled, not hooked into render: several boxes (surge, star) show or hide on their own timers.
  function check() {
    if (document.hidden || FE.surgeOpen) return;
    const s = FE.state;
    if (current) {
      if (current.done && current.done()) { finish(); return; }
      if (!current.when(s)) { hide(); return; }               // its moment passed: not seen, so it can come back
    }
    if (!on) return;
    // tips already done (you bought the structure before its tip came up) are marked seen without showing
    const ready = TIPS.filter(t => {
      if (seen()[t.id] || !t.when(s)) return false;
      if (t.done && t.done()) { seen()[t.id] = true; return false; }
      return true;
    });
    const urgent = ready.find(t => t.urgent);
    if (current) {
      if (urgent && !current.urgent) show(urgent);             // the ordinary tip waits its turn again
      else outline(resolve(current));
      return;
    }
    if (performance.now() < quietUntil) return;
    if (urgent || ready[0]) show(urgent || ready[0]);
  }
  setInterval(check, 250);
  $('tip-ok').addEventListener('click', finish);

  // ---- the guide: the basics, then every tip seen so far ----
  function renderGuide() {
    const done = TIPS.filter(t => seen()[t.id] || t === current);
    $('guide-tips').innerHTML = done.length
      ? done.map(t => `<div class="guide-tip"><b>${t.title}</b><p>${t.text()}</p></div>`).join('')
      : '<p class="empty">more appears here as you find new things.</p>';
    $('tips-btn').textContent = on ? 'tips on.' : 'tips off.';
    $('tips-btn').setAttribute('aria-pressed', String(on));
  }
  const guide = $('guide-overlay');
  FE.openGuide = () => { renderGuide(); guide.hidden = false; $('guide-close').focus(); };
  FE.closeGuide = () => { if (guide.hidden) return; guide.hidden = true; $('guide-btn').focus(); };
  $('guide-btn').addEventListener('click', FE.openGuide);
  $('guide-close').addEventListener('click', FE.closeGuide);
  guide.addEventListener('click', e => { if (e.target === guide) FE.closeGuide(); });
  $('tips-btn').addEventListener('click', () => setOn(!on));
  $('tips-replay').addEventListener('click', () => {
    FE.state.tips = {};
    hide();
    setOn(true);
    FE.save();
    FE.closeGuide();
    check();
  });
});
