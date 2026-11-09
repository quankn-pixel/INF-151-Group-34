/* controls.js - footer controls (back, text size, restart), moving between the layers, and the keyboard. */
FE.module(function (FE) {
  const $ = FE.$;

  // ---- back: save, then return to the home page. The element goes in the address (?el=air) so the home page can show
  // it even when the browser keeps the two files' storage apart. ----
  $('back-btn').addEventListener('click', () => {
    FE.save();
    const first = FE.state.owned[0];
    window.location.href = 'index.html' + (first ? '?el=' + first : '');
  });

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

  // ---- layers: wheel, arrow keys, swipe. Layer 2 sits above layer 1. ----
  let lastNav = 0;
  function nav(dir) {                                    // -1 = up, 1 = down
    if (FE.busy() || performance.now() - lastNav < 900) return;
    if (dir < 0 && FE.view === 1 && FE.state.layer2) { lastNav = performance.now(); FE.goto(2); }
    else if (dir > 0 && FE.view === 2) { lastNav = performance.now(); FE.goto(1); }
  }
  addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) < 12 || e.target.closest('.scroll, .skill.open, .mg-stage')) return;
    nav(e.deltaY < 0 ? -1 : 1);
  }, { passive: true });
  let ty = null;
  addEventListener('touchstart', e => { ty = e.target.closest('.scroll, .skill.open, .mg-stage') ? null : e.touches[0].clientY; }, { passive: true });
  addEventListener('touchend', e => { if (ty == null) return; const d = e.changedTouches[0].clientY - ty; ty = null; if (Math.abs(d) > 70) nav(d > 0 ? -1 : 1); }, { passive: true });

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key === 'Escape') {
      if (!$('restart-confirm').hidden) showConfirm(false);
      else if ($('skill') && $('skill').classList.contains('open')) FE.closeSkills();
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { nav(-1); return; }
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { nav(1); return; }
    if (e.repeat) return;
    const k = e.key.toLowerCase(), el = FE.ELEMENTS.find(x => x.key === k);
    if (!el) return;
    if (!FE.state.owned.length) { e.preventDefault(); FE.discover(el.id); }
    else if (el.id === FE.el() && FE.view === 1) { e.preventDefault(); FE.gather(280, 280); }       // the element's own letter gathers
  });
});
