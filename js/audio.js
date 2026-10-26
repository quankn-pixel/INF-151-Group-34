/* audio.js - sound effects and the sound on/off switch in the footer.
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

  // ---- sound on/off, remembered like the text size ----
  function label() {
    $('sound-btn').textContent = on ? 'sound on.' : 'sound off.';
    $('sound-btn').setAttribute('aria-pressed', String(on));
  }
  $('sound-btn').addEventListener('click', () => {
    on = !on;
    try { localStorage.setItem(FE.SOUND_KEY, on ? 'on' : 'off'); } catch (e) {}
    label();
  });
  label();

  // footer links, the builds pager, works switches and the end message's buttons all tick
  document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('button.link, button.dot, .end-box button')) FE.sfx('ui');
  });
});
