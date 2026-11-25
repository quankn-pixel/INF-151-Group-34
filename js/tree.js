/* tree.js - layer 2, the Echoes tab: a small skill tree bought with echoes. One root at the bottom, branches above it.
 * Skills last for good. */
FE.module(function (FE) {
  const $ = FE.$, NS = 'http://www.w3.org/2000/svg';
  const by = id => FE.SKILLS.find(s => s.id === id);
  const text = (el, t) => { if (el.textContent !== t) el.textContent = t; };
  FE.skillAvail = s => !s.soon && !FE.has(s.id) && (!s.req || FE.has(s.req));

  FE.buySkill = function (id) {
    const s = by(id), st = FE.state;
    if (!s || !FE.skillAvail(s) || st.stardust < s.cost) return;
    st.stardust -= s.cost; st.skills[id] = true;
    FE.render(); FE.save();
  };

  FE.buildTree = function () {
    const box = $('tree'), svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    FE.SKILLS.forEach(s => {
      if (!s.req) return;
      const p = by(s.req), l = document.createElementNS(NS, 'line');
      l.id = 'tl-' + s.id;
      l.setAttribute('x1', p.x); l.setAttribute('y1', p.y); l.setAttribute('x2', s.x); l.setAttribute('y2', s.y);
      svg.appendChild(l);
    });
    box.appendChild(svg);
    FE.SKILLS.forEach(s => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'node'; b.id = 'node-' + s.id;
      b.style.left = s.x + '%'; b.style.top = s.y + '%';
      b.innerHTML = `<span class="n-name">${s.name}</span><span class="n-desc">${s.desc}</span><span class="n-cost"></span>`;
      b.addEventListener('click', () => FE.buySkill(s.id));
      box.appendChild(b);
    });
  };

  FE.renderTree = function () {
    const st = FE.state;
    FE.SKILLS.forEach(s => {
      const b = $('node-' + s.id), owned = FE.has(s.id), avail = FE.skillAvail(s), can = avail && st.stardust >= s.cost;
      b.classList.toggle('owned', owned); b.classList.toggle('avail', avail); b.classList.toggle('can', can);
      b.disabled = !can;
      text(b.querySelector('.n-cost'), owned ? 'condensed' : s.soon ? 'coming soon' : `${s.cost} ${FE.echoWord(s.cost)}`);
      if (s.req) $('tl-' + s.id).setAttribute('class', owned ? 'on' : FE.has(s.req) ? 'next' : '');
    });
  };
});
