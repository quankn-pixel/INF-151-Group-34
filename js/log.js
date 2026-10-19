/* log.js - the fading text log on the left, plus the timed opening lines. */
FE.module(function (FE) {
  function lineEl(l) { const p = document.createElement('p'); if (l.c) p.className = l.c; p.innerHTML = l.h; return p; }

  FE.drawLog = function () { FE.$('log').replaceChildren(...FE.state.log.map(lineEl)); };

  FE.note = function (h, c) {
    const logEl = FE.$('log'), log = FE.state.log;
    log.unshift({ h, c });
    if (log.length > 14) log.length = 14;
    logEl.prepend(lineEl({ h, c }));
    while (logEl.children.length > 14) logEl.lastChild.remove();
  };

  // Opening lines: 10s after load, then 10s later. They always show, whatever the player does in the meantime.
  let timers = [];
  FE.scheduleIntro = function (base) {
    timers.forEach(clearTimeout); timers = [];
    [[10000, 'Where am I?'], [20000, 'What... happened?']].forEach(([ms, text]) => {
      if (FE.state.log.some(l => l.h === text)) return;
      timers.push(setTimeout(() => {
        if (!FE.state.log.some(l => l.h === text)) { FE.note(text, 'dim'); FE.save(); }
      }, Math.max(0, ms - (performance.now() - base))));
    });
  };
});
