# KEYNLOCK JavaScript architecture

v252 splits the former `app.js` into ordered classic scripts. Script order in `index.html` is significant.

- `core/state.js` — state, DOM references, mode registry and visual assets
- `core/audio.js` — audio and SFX
- `core/ui.js` — economy, skins and common UI
- `world/` — inventory, lair, map/navigation and shop
- `core/digital-helpers.js` — shared digital-puzzle helpers
- `modes/` — individual mechanics; `base-locks.js` serves Classic, Target, Another Line, Alternative 2 and Special locks
- `core/game.js` — shared solve flow and puzzle generation
- `core/init.js` — animation startup, input bindings and initialization
- `core/inventory-hit-testing.js` — expanded inventory hit testing

The outer v251 IIFE is removed so these classic scripts share one global lexical environment. The only intentional runtime fix is `cssUrl(uri)`, which resolves assets passed through CSS variables against the document.
