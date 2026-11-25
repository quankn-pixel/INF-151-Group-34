# Four Elements

A dark incremental game for the browser (INF 151, Group 34). Beta build.

**Play:** https://spectacular-faloodeh-e7aa54.netlify.app

Or open `index.html` in a browser. No build step and no server needed.

## How to play

1. **Layer 1, the forest.** Click the fire, pool, vent or stones to gather your element (hold the mouse or the space bar
   to keep going). Buy builds; eight of one build fuse into a stronger one. Grow the vessel, then extinguish it for
   crystals. Quests and mini-games open after a few builds.
2. **Layer 2, the army.** Crystals become units. Press Venture Forth to send them into battle.
3. **Combat.** Units fight on their own. The maps are Breach the Surface, The Surface 1/3 to 3/3, and Outpost.
    Units that die are lost, but they leave echoes for the skill tree.
4. **The star core.** Clear all four maps and choose: invade the galaxy, or light your own star and defend it.

Keys: `a`, `w`, `e`, `f` gather the element you are on or switch to another one. Arrow keys, the mouse wheel or the
links at the top and bottom of the screen move between layers. Progress saves to the browser automatically.

The footer has **settings.**: music and sound on/off with volume sliders, text size, and restart.

## For the team: developer mode

Open the settings menu and press **TESTING ONLY**. It opens layer 2, gives 100 of every crystal (press it again for more)
and turns on the map arrows under Venture Forth, so you can pick any map by hand. The arrows stay on in that save.
`game.html?dev` shows the map arrows from the start, without pressing the button.

A save only loads into the exact build that wrote it (see `FE.BUILD` in `js/state.js`), so every code change clears
old saves.

## Files

- `index.html`: title screen and opening sequence
- `game.html`: the game
- `js/`: game code. `config.js` holds most tuning numbers and text. `forest.js` is layer 1, `army.js` and `tree.js`
  are layer 2, `combat.js` is the battlefield, `endgame.js` is the star core and both endings, `audio.js` is sound,
  music and the settings dialog.
- `css/style.css`, `css/space.css`: styles
- `audio/`: music and sound effects

## Credits

Henry Bao, Jaden Nguyen, Quan Nguyen and Jerry Chen.

Music: ["Cathedral in the forest"](https://opengameart.org/content/cathedral-in-the-forest-ambient-loop)
by congusbongus, CC0.

Sound effects from Kenney's [Interface Sounds](https://kenney.nl/assets/interface-sounds) and
[Impact Sounds](https://kenney.nl/assets/impact-sounds), CC0.
