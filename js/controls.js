/* controls.js - footer controls (text size, restart) and the keyboard. */
(function (FE) {
  const $ = FE.$;

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

  // ---- restart ----
  function showConfirm(on) {
    $('restart-wrap').hidden = on;
    $('restart-confirm').hidden = !on;
    (on ? $('restart-no') : $('restart-btn')).focus();
  }
  $('restart-btn').addEventListener('click', () => showConfirm(true));
  $('restart-no').addEventListener('click', () => showConfirm(false));
  $('restart-yes').addEventListener('click', () => {
    try { localStorage.removeItem(FE.SAVE_KEY); } catch (e) {}
    FE.state = FE.freshState();
    FE.clearIcons();
    FE.drawLog(); FE.renderChoices(); FE.scheduleIntro(performance.now());
    FE.render();
    $('save-status').textContent = 'not saved yet.';
    showConfirm(false);
  });

  // ---- keyboard: 1-4 pick an option; afterwards only 1 (the chosen element) does anything ----
  document.addEventListener('keydown', e => {
    // a held Enter re-clicks the focused element button on every repeat; like the 1 key, one press is one gather
    if (e.repeat && e.key === 'Enter' && e.target.closest && e.target.closest('button.pick')) { e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.target.closest && e.target.closest('input, textarea')) return;
    const chosen = FE.state.chosen;
    const el = chosen ? (e.key === '1' ? { id: chosen } : null) : FE.ELEMENTS.find(x => x.key === e.key);
    if (el) { e.preventDefault(); FE.act(el.id); }
    if (e.key === 'Escape' && !$('restart-confirm').hidden) showConfirm(false);
  });
})(window.FE);
