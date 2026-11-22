/* audio.js - sound effects, background music and the settings dialog (music, sound, their volumes; text size and restart
 * are wired in controls.js).
 *
 * Plain <audio> elements rather than Web Audio, because they also play when the game is opened straight from the file
 * system. Each file keeps up to COPIES of itself, so quick repeats (gathering) overlap instead of cutting each other off.
 *
 * This file only listens: it wraps a few FE functions and hooks after the other files have loaded, and plays a sound when
 * they do something. No other file calls it, so the game runs the same without it. Load it after forestplay.js and before
 * controls.js. */
FE.module(function (FE) {
  const $ = FE.$;

  // ---- the sounds: Kenney's Interface Sounds and Impact Sounds (CC0), as audio/<file>.wav. vol is 0-1. A sound with
  // several files plays one of them at random. gap: the shortest time between two plays, in seconds (holding the mouse
  // gathers ten times a second). ----
  const SOUNDS = {
    gather:   { files: ['gather1', 'gather2', 'gather3'], vol: 0.2, gap: 0.06 },
    build:    { files: ['build1', 'build2'], vol: 0.55 },   // any build, unit or upgrade
    discover: { files: ['discover'], vol: 0.5 },            // a fusion, a skill, a quest done
    condense: { files: ['condense'], vol: 0.6 },            // a vessel grows, a star condenses
    conjure:  { files: ['conjure'], vol: 0.5 },             // crystals
    arrive:   { files: ['arrive'], vol: 0.45 },             // Venture Forth, an invasion
    defeat:   { files: ['defeat'], vol: 0.35 },             // a battle won
    raid:     { files: ['raid'], vol: 0.55 },               // a battle or a quest lost
    end:      { files: ['end'], vol: 0.7 },                 // the star core, the ending
    ui:       { files: ['ui'], vol: 0.25 }                  // links, tabs, panel buttons
  };
  // background music: "Cathedral in the forest" by congusbongus (OpenGameArt, CC0), a seamless loop
  const MUSIC = { file: 'audio/music.mp3', vol: 0.3, fadeIn: 3 };   // fadeIn in seconds
  const SOUND_KEY = 'four-elements-sound-v1', MUSIC_KEY = 'four-elements-music-v1', VOL_KEY = 'four-elements-volume-v1';
  const COPIES = 4;

  const pools = {}, lastPlay = {};
  let on = true;
  try { on = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (e) {}
  const vol = { sound: 1, music: 1 };      // the player's volume sliders, 0-1, on top of each sound's own volume
  try {
    const v = JSON.parse(localStorage.getItem(VOL_KEY));
    if (v) ['sound', 'music'].forEach(k => { if (typeof v[k] === 'number' && v[k] >= 0 && v[k] <= 1) vol[k] = v[k]; });
  } catch (e) {}

  Object.values(SOUNDS).forEach(snd => snd.files.forEach(f => {
    const a = new Audio(`audio/${f}.wav`);
    a.preload = 'auto';
    pools[f] = [a];
  }));

  FE.sfx = function (name) {
    const snd = SOUNDS[name], now = performance.now();
    if (!on || !snd || document.hidden || !vol.sound) return;
    if (snd.gap && now - (lastPlay[name] || 0) < snd.gap * 1000) return;
    lastPlay[name] = now;
    const f = snd.files[Math.floor(Math.random() * snd.files.length)], pool = pools[f];
    let a = pool.find(x => x.paused);
    if (!a) {
      if (pool.length < COPIES) { a = pool[0].cloneNode(); pool.push(a); }
      else a = pool.reduce((x, y) => x.currentTime > y.currentTime ? x : y);   // restart the one furthest along
    }
    a.volume = snd.vol * vol.sound;
    a.currentTime = 0;
    const p = a.play();
    if (p) p.catch(() => {});   // before the first click on the page the browser may refuse: just stay quiet
  };

  // ---- background music: loops, fades in, and pauses while the tab is hidden. Browsers only let it start after the
  // player's first click or key press on the page, so it also tries again then. ----
  const music = new Audio(MUSIC.file);
  music.loop = true;
  music.preload = 'auto';
  let musicOn = true, fade = 0;
  const musicTop = () => MUSIC.vol * vol.music;
  try { musicOn = localStorage.getItem(MUSIC_KEY) !== 'off'; } catch (e) {}
  function playMusic() {
    if (!musicOn || document.hidden || !music.paused) return;
    clearInterval(fade);
    music.volume = 0;
    const p = music.play();
    if (p) p.catch(() => {});
    const step = MUSIC.vol / (MUSIC.fadeIn * 10);
    fade = setInterval(() => {
      music.volume = Math.min(musicTop(), music.volume + step);
      if (music.volume >= musicTop()) clearInterval(fade);
    }, 100);
  }
  function stopMusic() { clearInterval(fade); music.pause(); }
  ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, playMusic));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopMusic(); else playMusic(); });
  playMusic();

  // ---- the settings dialog ----
  // While it is open the game counts it as a panel (FE.modalOpen), so clicks, keys and the wheel do nothing behind it.
  const box = $('settings');
  let wasModal = false;
  FE.settingsOpen = false;
  function openSettings() {
    if (FE.settingsOpen) return;
    FE.settingsOpen = true; wasModal = FE.modalOpen; FE.modalOpen = true;
    $('restart-wrap').hidden = false; $('restart-confirm').hidden = true;
    box.hidden = false;
    $('settings-close').focus({ preventScroll: true });
  }
  function closeSettings() {
    if (!FE.settingsOpen) return;
    FE.settingsOpen = false; FE.modalOpen = wasModal;
    box.hidden = true;
    $('settings-btn').focus({ preventScroll: true });
  }
  $('settings-btn').addEventListener('click', openSettings);
  $('settings-close').addEventListener('click', closeSettings);
  box.addEventListener('pointerdown', e => { if (e.target === box) closeSettings(); });
  // Escape closes the restart question first, then the dialog. This listener is added before the panel's (quests.js), so it
  // runs first and nothing behind the dialog hears the keys.
  addEventListener('keydown', e => {
    if (!FE.settingsOpen || e.key === 'Tab' || e.key === 'Enter') return;   // Tab and Enter work the dialog's own controls
    e.stopImmediatePropagation();          // no other key reaches the game (space still presses a focused button, arrows move a slider)
    if (e.key === 'Escape') { if (!$('restart-confirm').hidden) $('restart-no').click(); else closeSettings(); }
  }, true);

  function label() {
    $('sound-btn').textContent = on ? 'sound on.' : 'sound off.';
    $('sound-btn').setAttribute('aria-pressed', String(on));
    $('music-btn').textContent = musicOn ? 'music on.' : 'music off.';
    $('music-btn').setAttribute('aria-pressed', String(musicOn));
    $('sound-vol').disabled = !on; $('music-vol').disabled = !musicOn;
  }
  $('sound-btn').addEventListener('click', () => {
    on = !on;
    try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch (e) {}
    label();
  });
  $('music-btn').addEventListener('click', () => {
    musicOn = !musicOn;
    try { localStorage.setItem(MUSIC_KEY, musicOn ? 'on' : 'off'); } catch (e) {}
    if (musicOn) playMusic(); else stopMusic();
    label();
  });
  function showVol() {
    ['sound', 'music'].forEach(k => {
      $(k + '-vol').value = Math.round(vol[k] * 100);
      $(k + '-val').textContent = Math.round(vol[k] * 100) + '%';
    });
  }
  ['sound', 'music'].forEach(k => $(k + '-vol').addEventListener('input', () => {
    vol[k] = $(k + '-vol').value / 100;
    $(k + '-val').textContent = $(k + '-vol').value + '%';
    if (k === 'music' && !music.paused && music.volume > 0) music.volume = musicTop();
    try { localStorage.setItem(VOL_KEY, JSON.stringify(vol)); } catch (e) {}
  }));
  $('sound-vol').addEventListener('change', () => FE.sfx('ui'));   // a sample of the new level
  showVol();
  label();

  // ================================================================ when to play what
  // A wrapped function plays its sound only when it really did something, which is checked from the state. The wrapping waits
  // until every script has loaded, because some of these functions are only defined in game.js, which loads last.
  function hookAll() {
    const wrap = (obj, name, after) => {
      const fn = obj[name];
      if (typeof fn !== 'function') return;
      obj[name] = function () { const before = after.before ? after.before() : null; const r = fn.apply(this, arguments); after(before); return r; };
    };
    const sum = o => Object.values(o || {}).reduce((a, n) => a + (+n || 0), 0);

    // the forest (forest.js calls these hooks, which forestplay.js has filled in)
    const M = FE.forest && FE.forest.mods;
    if (M) {
      const hook = (k, name) => { const fn = M[k]; M[k] = function () { const r = fn.apply(this, arguments); FE.sfx(name); return r; }; };
      hook('onClick', 'gather'); hook('onBuy', 'build'); hook('onFuse', 'discover'); hook('onGrow', 'condense');
    }
    // the star layer: a click on the star; builds; condensing
    { const c = FE.ev.click; FE.ev.click = function () { c.apply(this, arguments); FE.sfx('gather'); }; }
    const buys = () => FE.state.buys;
    const sfxIf = (name, get) => { const f = b => { if (get() !== b) FE.sfx(name); }; f.before = get; return f; };
    wrap(FE, 'buy', sfxIf('build', buys));
    wrap(FE, 'buyAffinity', sfxIf('build', buys));
    wrap(FE, 'condense', sfxIf('condense', () => FE.E().tier));
    wrap(FE, 'reignite', sfxIf('condense', () => FE.E().tier));
    // layer 2: units, skills, Venture Forth
    wrap(FE, 'buyUnit', sfxIf('build', () => sum(FE.state.units)));
    wrap(FE, 'buySkill', sfxIf('discover', () => FE.state.stardust));
    wrap(FE, 'venture', sfxIf('arrive', () => !!(FE.combat && FE.combat.active)));
    // the end of a battle: a cleared map is a win
    const cm = $('c-modal');
    if (cm) new MutationObserver(() => {
      if (cm.hidden) return;
      const h = $('c-panel').querySelector('h3'), t = h ? h.textContent : '';
      if (/Retreat\?/.test(t)) return;
      FE.sfx(/fell/.test(t) ? 'raid' : 'defeat');
    }).observe(cm, { attributes: true, attributeFilter: ['hidden'] });
    // notices that come from deep inside other files
    wrap(FE, 'toast', () => {
      const t = $('toast').textContent;
      if (/^Quest complete/.test(t)) FE.sfx('discover');
      else if (/^Quest failed|^The invasion succeeded/.test(t)) FE.sfx('raid');
      else if (/^The invasion is beaten/.test(t)) FE.sfx('defeat');
      else if (/^Invasion \d/.test(t)) FE.sfx('arrive');
    });
    // crystals from any source (a vessel put out, a star collapsed, a reward), the star core, the ending
    let crys = null, coreGot = null, ended = null;
    setInterval(() => {
      if (!FE.BUILD) return;
      const s = FE.state, c = sum(s.crystals), g = !!(s.core && s.core.got), e = !!(s.core && s.core.ended);
      if (crys != null && c > crys) FE.sfx('conjure');
      if ((coreGot === false && g) || (ended === false && e)) FE.sfx('end');
      crys = c; coreGot = g; ended = e;
    }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hookAll); else hookAll();

  // a quiet tick for links, tabs and panel buttons
  document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('button.link, .nav, .tab, .l2-tab, .hud-btn, .fp-b, .panel button, #eg button, #sc-btn')) FE.sfx('ui');
  });
});
