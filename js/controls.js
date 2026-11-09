/* controls.js - footer controls (back, text size, restart), the end message's return to title, and the keyboard. */
FE.module(function (FE) {
  const $ = FE.$;

  // ---- back, and return to title on the end message: save, then go to the home page. The element goes in the address
  // (?el=air) so the home page can show it even when the browser keeps the two files' storage apart. ----
  const toTitle = () => {
    FE.save();
    const first = FE.state.owned[0];
    window.location.href = 'index.html' + (first ? '?el=' + first : '');
  };
  $('back-btn').addEventListener('click', toTitle);
  $('end-home').addEventListener('click', toTitle);

  // ---- text size ----
  const SIZES = [12, 14, 16, 18, 20, 24, 28];
  let sizeIdx = 2;
  function applySize() {
    document.documentElement.style.setProperty('--fs', SIZES[sizeIdx] + 'px');
    $('size-down').disabled = sizeIdx === 0;
    $('size-up').disabled = sizeIdx === SIZES.length - 1;
    try { localStorage.setItem(FE.SIZE_KEY, String(sizeIdx)); } catch (e) {}
  }
  try {
    const v = parseInt(localStorage.getItem(FE.SIZE_KEY), 10);
    if (v >= 0 && v < SIZES.length) sizeIdx = v;
  } catch (e) {}
  $('size-down').addEventListener('click', () => { if (sizeIdx > 0) { sizeIdx--; applySize(); } });
  $('size-up').addEventListener('click', () => { if (sizeIdx < SIZES.length - 1) { sizeIdx++; applySize(); } });
  applySize();

  // ---- restart: erase the save and go back to the home page, which starts over with its opening sequence ----
  function showConfirm(on) {
    $('restart-wrap').hidden = on;
    $('restart-confirm').hidden = !on;
    (on ? $('restart-no') : $('restart-btn')).focus();
  }
  $('restart-btn').addEventListener('click', () => showConfirm(true));
  $('restart-no').addEventListener('click', () => showConfirm(false));
  $('restart-yes').addEventListener('click', () => {
    try { localStorage.removeItem(FE.SAVE_KEY); } catch (e) {}
    FE.BUILD = null;          // FE.save does nothing from here, so leaving the page cannot write the old game back
    window.location.href = 'index.html?reset=1';
  });

  // ---- keyboard: a / w / e / f investigate or gather that element. Escape closes the end message or the restart question. ----
  document.addEventListener('keydown', e => {
    // a held Enter re-clicks the focused element button on every repeat; like the letter keys, one press is one gather
    if (e.repeat && e.key === 'Enter' && e.target.closest && e.target.closest('button.pick')) { e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key === 'Escape') {
      if (!$('end-overlay').hidden) FE.hideEnd();
      else if (!$('restart-confirm').hidden) showConfirm(false);
      return;
    }
    if (!$('end-overlay').hidden) return;                     // while the end message is up, keys only close it
    const el = FE.ELEMENTS.find(x => x.key === e.key.toLowerCase());
    if (el && (FE.state.owned.includes(el.id) || FE.state.picking)) { e.preventDefault(); FE.act(el.id); }
  });
});
