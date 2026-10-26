/* audio.js - sound effects, background music, and their on/off switches in the footer.
 *
 * Plain <audio> elements rather than Web Audio, because they also play when the game is opened straight from the file
 * system. Each file keeps up to COPIES of itself, so quick repeats (gathering) overlap instead of cutting each other off.
 */
FE.module(function (FE) {
  const $ = FE.$;
  const COPIES = 4;
  const pools = {};          // file -> its <audio> copies
  let on = true;
  try { on = localStorage.getItem(FE.SOUND_KEY) !== 'off'; } catch (e) {}

  Object.values(FE.SOUNDS).forEach(snd => snd.files.forEach(f => {
    const a = new Audio(`audio/${f}.wav`);
    a.preload = 'auto';
    pools[f] = [a];
  }));

  FE.sfx = function (name) {
    const snd = FE.SOUNDS[name];
    if (!on || !snd || document.hidden) return;
    const f = snd.files[Math.floor(Math.random() * snd.files.length)], pool = pools[f];
    let a = pool.find(x => x.paused);
    if (!a) {
      if (pool.length < COPIES) { a = pool[0].cloneNode(); pool.push(a); }
      else a = pool.reduce((x, y) => x.currentTime > y.currentTime ? x : y);   // restart the one furthest along
    }
    a.volume = snd.vol;
    a.currentTime = 0;
    const p = a.play();
    if (p) p.catch(() => {});   // before the first click on the page the browser may refuse: just stay quiet
  };

  // ---- background music: loops, fades in, and pauses while the tab is hidden. Browsers only allow it to start after
  // the player's first click or key press on the page, so it also tries again then. ----
  const music = new Audio(FE.MUSIC.file);
  music.loop = true;
  music.preload = 'auto';
  let musicOn = true, fade = 0;
  try { musicOn = localStorage.getItem(FE.MUSIC_KEY) !== 'off'; } catch (e) {}

  function playMusic() {
    if (!musicOn || document.hidden || !music.paused) return;
    clearInterval(fade);
    music.volume = 0;
    const p = music.play();
    if (p) p.catch(() => {});
    const step = FE.MUSIC.vol / (FE.MUSIC.fadeIn * 10);
    fade = setInterval(() => {
      music.volume = Math.min(FE.MUSIC.vol, music.volume + step);
      if (music.volume >= FE.MUSIC.vol) clearInterval(fade);
    }, 100);
  }
  function stopMusic() { clearInterval(fade); music.pause(); }
  ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, playMusic));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopMusic(); else playMusic(); });
  playMusic();

  // ---- sound and music on/off, remembered like the text size ----
  function label() {
    $('sound-btn').textContent = on ? 'sound on.' : 'sound off.';
    $('sound-btn').setAttribute('aria-pressed', String(on));
    $('music-btn').textContent = musicOn ? 'music on.' : 'music off.';
    $('music-btn').setAttribute('aria-pressed', String(musicOn));
  }
  $('sound-btn').addEventListener('click', () => {
    on = !on;
    try { localStorage.setItem(FE.SOUND_KEY, on ? 'on' : 'off'); } catch (e) {}
    label();
  });
  $('music-btn').addEventListener('click', () => {
    musicOn = !musicOn;
    try { localStorage.setItem(FE.MUSIC_KEY, musicOn ? 'on' : 'off'); } catch (e) {}
    if (musicOn) playMusic(); else stopMusic();
    label();
  });
  label();

  // footer links, the builds pager, works switches and the end message's buttons all tick
  document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('button.link, button.dot, .end-box button')) FE.sfx('ui');
  });
});
