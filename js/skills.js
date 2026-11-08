/* skills.js - the skill tree on layer 2: permanent effects bought with stardust. Drawn as one SVG constellation. When the
 * tree is closed, that same drawing is the small glittering icon; when it is open it fills the left half of layer 2. */
FE.module(function (FE) {
  const $ = FE.$, NS = 'http://www.w3.org/2000/svg';
  // x, y in a 100 x 100 box; req = any one of these must be bought first
  FE.SKILLS = [
    { id: 'seed',      name: 'seed of light',   x: 50, y: 88, cost: 1,  req: [],                  desc: 'Every run begins with 250 of your element.' },
    { id: 'memory',    name: 'stellar memory',  x: 28, y: 69, cost: 2,  req: ['seed'],            desc: 'All production x1.5, for good.' },
    { id: 'core',      name: 'dense core',      x: 72, y: 69, cost: 2,  req: ['seed'],            desc: 'Click power x2.' },
    { id: 'autonomy',  name: 'self-winding',    x: 14, y: 46, cost: 4,  req: ['memory'],          desc: 'Windmill-type builds make twice as much.' },
    { id: 'accretion', name: 'accretion',       x: 86, y: 46, cost: 4,  req: ['core'],            desc: 'Every build costs 15% less.' },
    { id: 'radiance',  name: 'radiance',        x: 40, y: 38, cost: 6,  req: ['memory'],          desc: 'Each star tier multiplies production by 2.2 instead of 1.8.' },
    { id: 'sieve',     name: 'dust sieve',      x: 78, y: 24, cost: 8,  req: ['accretion'],       desc: 'Collapsing a star pays 25% more stardust.' },
    { id: 'gravity',   name: 'gravity well',    x: 20, y: 22, cost: 10, req: ['autonomy'],        desc: 'Cyclone-type builds (the big ones) make twice as much.' },
    { id: 'echo',      name: 'echo chamber',    x: 56, y: 12, cost: 12, req: ['radiance', 'sieve'], desc: 'Mini-games pay double stardust and their buffs last 50% longer.' }
  ];
  const by = id => FE.SKILLS.find(s => s.id === id);
  FE.skillAvailable = s => !FE.has(s.id) && (!s.req.length || s.req.some(r => FE.has(r)));
  let selected = null;

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  FE.buildSkills = function () {
    const svg = $('skill-svg');
    const defs = el('defs', {}, svg);
    const rg = el('radialGradient', { id: 'sk-glow' }, defs);
    el('stop', { offset: '0', 'stop-color': '#fff', 'stop-opacity': '.9' }, rg); el('stop', { offset: '1', 'stop-color': '#9fb4ff', 'stop-opacity': '0' }, rg);
    for (let i = 0; i < 26; i++) {                                    // loose glitter around the tree
      const x = 4 + ((i * 37) % 93), y = 4 + ((i * 53) % 90);
      el('circle', { class: 'tw', cx: x, cy: y, r: .35 + (i % 3) * .2, style: `animation-delay:${(i % 7) * .45}s;animation-duration:${2 + (i % 5) * .6}s` }, svg);
    }
    for (const s of FE.SKILLS) for (const r of s.req) {
      const p = by(r); el('line', { class: 'edge', 'data-a': r, 'data-b': s.id, x1: p.x, y1: p.y, x2: s.x, y2: s.y }, svg);
    }
    for (const s of FE.SKILLS) {
      const g = el('g', { class: 'node', 'data-id': s.id, transform: `translate(${s.x} ${s.y})` }, svg);
      el('circle', { class: 'halo', r: 6, fill: 'url(#sk-glow)' }, g);
      el('circle', { class: 'dot', r: 2.2 }, g);
      el('circle', { class: 'hit', r: 5, fill: 'transparent' }, g);
      const t = el('text', { class: 'lbl', y: 6.6, 'text-anchor': 'middle' }, g); t.textContent = s.name;
    }
    $('si-buy').addEventListener('click', e => { e.stopPropagation(); if (selected) FE.buySkill(selected); });
  };

  FE.selectSkill = function (id) { selected = id; FE.renderSkills(); };
  FE.buySkill = function (id) {
    const s = by(id), st = FE.state;
    if (!s || !FE.skillAvailable(s) || st.stardust < s.cost) return;
    st.stardust -= s.cost; st.skills[id] = true;
    FE.save(); FE.render();
  };

  FE.renderSkills = function () {
    const st = FE.state;
    document.querySelectorAll('#skill-svg .node').forEach(g => {
      const s = by(g.dataset.id), owned = FE.has(s.id), avail = FE.skillAvailable(s);
      g.setAttribute('class', 'node ' + (owned ? 'owned' : avail ? 'avail' : 'locked') + (selected === s.id ? ' sel' : ''));
    });
    document.querySelectorAll('#skill-svg .edge').forEach(l => l.setAttribute('class', 'edge' + (FE.has(l.dataset.a) && FE.has(l.dataset.b) ? ' on' : FE.has(l.dataset.a) ? ' next' : '')));
    const s = selected && by(selected);
    $('si-name').textContent = s ? s.name : 'the constellation';
    $('si-desc').textContent = s ? s.desc : 'Pick a star to read what it does. Skills last through every collapse.';
    $('si-cost').textContent = s ? (FE.has(s.id) ? 'condensed' : `${s.cost} stardust`) : '';
    const buy = $('si-buy');
    buy.hidden = !s || FE.has(s.id);
    if (s) { buy.disabled = !FE.skillAvailable(s) || st.stardust < s.cost; buy.textContent = !FE.skillAvailable(s) ? 'locked' : 'condense'; }
  };
});
