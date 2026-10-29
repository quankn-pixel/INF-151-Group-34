/* story.js - the storyboard, told through the log.
 *
 * Every beat is { id, when(state), lines: [[html, class], ...] }. A beat fires once, the first tick its `when` is true
 * (a beat with no `when` fires only from FE.tell(id)). Its lines go into a queue and drip into the log one at a time,
 * FE.STORY_GAP seconds apart, so a beat reads like a thought instead of a wall of text. 'dim' is the story's voice;
 * 'note' and 'warn' stay reserved for the game's own instructions and alarms.
 *
 * Which beats have fired lives in state.story.told, so it is saved with everything else and cleared on restart.
 * Beats are listed in story order: when several fire on the same tick they queue in this order.
 *
 * Layers follow ideas.md: layer number = number of elements owned. Layers 4 and 5 have no mechanics yet, so their
 * beats wait on flags (assiahNear, assiahDone, keter, keterWon, keterEnd) that those mechanics will set later.
 */
FE.module(function (FE) {
  FE.STORY_GAP = 4;       // seconds between story lines

  const total = () => FE.totalCount();
  const madeAnything = s => FE.MATERIALS.some(m => s.mats[m] > 0);
  const hasConverter = s => FE.CONVERTERS.some(c => s.conv[c.id] > 0);

  FE.STORY = [
    // ---- Layer 1: Atziluth. One element, a small dark room, and no memory ----
    { id: 'l1-answer', when: s => s.owned.length >= 1 && total() >= 10, lines: [
      ['It answers when you reach for it. Reaching feels older than thinking.', 'dim']] },
    { id: 'l1-hands', when: s => s.owned.length >= 1 && total() >= FE.RES_AT, lines: [
      ['Your hands know this work better than you do.', 'dim']] },
    { id: 'l1-bounds', when: s => s.owned.length === 1 && total() >= FE.STRUCT_AT, lines: [
      ['You test the edges of this place. They give a little, then hold.', 'dim'],
      ['There are other worlds past them. Something in you says you are not yet enough to enter.', 'dim'],
      ['You can carry only one element for now. Whatever you were, you are less than that.', 'dim']] },
    { id: 'l1-artifact', when: s => s.full && !s.planets, lines: [
      ['Beneath everything you have gathered, something that is not an element. It was here before you woke.', 'dim'],
      ['It is warm, and it feels like yours. Condense your stores, and it will take them.', 'dim']] },
    { id: 'l1-war', when: s => s.planets >= 1, lines: [
      ['You touched it, and it touched back.', 'dim'],
      ['A war between gods, burning across a sky with no edges. Your banner. Your voice, giving orders.', 'dim'],
      ['Then the end of it: chains, and a silence with a floor and a ceiling. This place.', 'dim'],
      ['You lost. You remember that much, and nothing more.', 'dim'],
      ['Your standing shifts. You could carry another element now, and a second world, Beri\u2019ah, has opened.', 'dim']] },

    // ---- Layer 2: Beri'ah. Two elements, machines, stars, and a sleeping will ----
    { id: 'l2-enter', when: s => s.owned.length >= 2, lines: [
      ['Beri\u2019ah is larger than the first world, and quieter.', 'dim'],
      ['Two elements lean on each other here. Machines could keep them moving while you rest.', 'dim']] },
    { id: 'l2-forge', when: s => s.forge, lines: [
      ['The forge is warm. The elements bend toward it, wanting a shape.', 'dim']] },
    { id: 'l2-vault', when: s => s.vault >= 1, lines: [
      ['You hollow out more room. The space was always bigger than you thought.', 'dim']] },
    { id: 'l2-vault3', when: s => s.vault >= 3, lines: [
      ['You can hold a small sea of it now. Something is waiting for you to fill it.', 'dim']] },
    { id: 'l2-borrow', when: s => s.owned.length === 2 && FE.CONVERTERS.some(c => c.tm && s.conv[c.id] > 0), lines: [
      ['Something thin and strange comes through, drawn out of what you already hold. It does not answer to you the way your own do.', 'dim']] },
    { id: 'l2-work', when: s => s.owned.length >= 2 && FE.structures() > 0, lines: [
      ['The first work turns by itself. You are not the only thing moving in this world.', 'dim']] },
    { id: 'l2-stars', when: s => s.owned.length >= 2 && s.crystals >= 2, lines: [
      ['Pressed hard enough, the crystals ignite. A star.', 'dim'],
      ['Its light shows how large the dark was.', 'dim']] },
    { id: 'l2-clusters', when: s => s.owned.length >= 2 && s.crystals >= 3, lines: [
      ['Stars gather into clusters, and clusters into galaxies. The dark has a shape now.', 'dim']] },
    { id: 'l2-dense', when: s => s.owned.length >= 2 && s.crystals >= 5, lines: [
      ['Some of them collapse: black holes, neutron stars, dense and patient. You made all of this out of so little.', 'dim']] },
    { id: 'l2-aware', when: s => s.owned.length >= 2 && total() >= FE.BALANCE_AT && FE.imbalance() < 0.15, lines: [
      ['When your elements sit even, they hold very still, like something listening.', 'dim'],
      ['A will sleeps in them, folded small. Wake it.', 'dim']] },
    { id: 'l2-wake', when: s => s.crystals2 >= 1, lines: [
      ['The tier 2 crystal rings through the elements like a struck bell.', 'dim'],
      ['The sleeping wills in them wake. All of them, all at once.', 'dim'],
      ['Yetzirah opens, and your station rises with it.', 'dim']] },

    // ---- Layer 3: Yetzirah. Three elements, spirits, life, and fears given shape ----
    { id: 'l3-enter', when: s => s.owned.length >= 3, lines: [
      ['The elements in Yetzirah no longer feel like tools.', 'dim'],
      ['You sense it plainly: once all four worlds are yours, you will learn who you were. Only three have opened.', 'dim']] },
    { id: 'l3-spirits', when: s => s.owned.length >= 3 && hasConverter(s), lines: [
      ['Where the elements are worked, shapes gather. A wind with a face. A flame that kneels.', 'dim'],
      ['They call themselves your servants. You do not remember earning that.', 'dim']] },
    { id: 'l3-life', when: s => s.owned.length >= 3 && madeAnything(s), lines: [
      ['These are things only life leaves behind. Somewhere among the stars, something has begun to breathe.', 'dim']] },
    { id: 'l3-rare', when: s => s.owned.length >= 3 && (s.mats.glass > 0 || s.mats.gold > 0), lines: [
      ['Glass and gold. Rarer things for rarer spells, and the spirits seem to know what they are for.', 'dim']] },
    { id: 'l3-fear', when: s => s.owned.length >= 3 && !!s.enemy && !s.enemy.leader, lines: [
      ['You know that shape. It did not come from outside. It came from you: a fear you once locked away, grown teeth.', 'dim'],
      ['They eat stars, and they wear down your works. Your spells are the only thing they respect.', 'dim']] },
    // waits for the Layer 3 final milestone, which has no mechanics yet: set state.yetzirahDone when it exists
    { id: 'l3-flask', when: s => !!s.yetzirahDone, lines: [
      ['The spirits gather at your last work and lean toward it, all at once.', 'dim'],
      ['They bring you scraps they found in the steam: a corridor, a door, a verdict. The war\u2019s end, seen from the winners\u2019 side.', 'dim'],
      ['This universe is a prison. They built it for you.', 'dim'],
      ['Others of your kind are caged elsewhere. You count them, and you resolve to break out.', 'dim']] },

    // ---- Layer 4: Assiah. Not playable yet; the flags are for the Layer 4 mechanics to set ----
    { id: 'l4-enter', when: s => s.owned.length >= 4, lines: [
      ['Assiah, the last world, and the last element. The world feels like it is watching.', 'dim']] },
    { id: 'l4-surge', when: s => !!s.assiahNear, lines: [
      ['They come in greater numbers now, and closer together. The nearer you get, the harder they push.', 'dim']] },
    { id: 'l4-scheme', when: s => !!s.assiahDone, lines: [
      ['The spirits have gone quiet. They are gathering your lost memories, piece by piece.', 'dim'],
      ['They bring them to you, and then they bring themselves.', 'dim']] },

    // ---- Layer 5: Keter. Also not playable yet ----
    { id: 'l5-evil', when: s => !!s.keter, lines: [
      ['The spirits fold into you, and you are one. A thing that was waiting in the elements wakes with you.', 'dim'],
      ['It was never in the stars or in the vagrants. It was in the elements, and now it is in you.', 'dim']] },
    { id: 'l5-truth', when: s => !!s.keterWon, lines: [
      ['You hold on, barely, and the last of your memories come home.', 'dim'],
      ['The prison was your own mind. It was built to keep you in, and to keep the evil in with you.', 'dim'],
      ['It cannot be beaten, only starved at the source. This is a fight you cannot win.', 'dim'],
      ['And this is not the first time. It is one of uncountable cycles.', 'dim']] },
    { id: 'l5-cycle', when: s => !!s.keterEnd, lines: [
      ['You know what waits outside if it keeps growing.', 'dim'],
      ['So you unmake it all: every star, every spirit, every memory you just won back.', 'dim'],
      ['The dark space stirs.', 'dim']] }
  ];

  // ---- the queue ----
  let queue = [], gap = 0;
  const told = () => FE.state.story.told;

  function enqueue(beat) {
    told()[beat.id] = true;
    if (!queue.length && gap < 1.5) gap = 1.5;      // a short pause, so the game's own line lands first
    beat.lines.forEach(([h, c]) => queue.push({ h, c }));
  }

  // fire a beat by hand (for beats with no `when`)
  FE.tell = function (id) {
    const beat = FE.STORY.find(b => b.id === id);
    if (beat && !told()[id]) enqueue(beat);
  };
  // run fn once every queued line has been shown (immediately if none are waiting)
  FE.storyThen = function (fn) { if (!queue.length) fn(); else queue.push({ fn }); };
  FE.storyReset = function () { queue = []; gap = 0; };

  // dt in seconds, only while the tab is visible
  FE.storyTick = function (dt) {
    FE.STORY.forEach(b => { if (b.when && !told()[b.id] && b.when(FE.state)) enqueue(b); });
    gap -= dt;
    if (gap > 0 || !queue.length) return;
    const q = queue.shift();
    if (q.fn) { q.fn(); return; }
    FE.note(q.h, q.c);
    gap = FE.STORY_GAP;
    FE.save();
  };
});
