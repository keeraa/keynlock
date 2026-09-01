# KEYNLOCK JavaScript architecture

v252 splits the former `app.js` into ordered classic scripts. Script order in `index.html` is significant.

- `core/game-catalog.js` — canonical game capabilities (including lock, noise sensor, guards and birds) and the shared action dispatcher
- `core/state.js` — runtime state, DOM references and visual assets
- `core/audio.js` — audio and SFX
- `core/ui.js` — economy, skins and common UI
- `world/` — inventory, lair, map/navigation and missions
- `world/game-settings.js` — in-game editor for catalogue capabilities and readiness, persisted as local overrides
- `core/digital-helpers.js` — shared digital-puzzle helpers
- `modes/` — individual mechanics; `base-locks.js` serves Classic, Target, Another Line, Alternative 2 and Special locks
- `core/game.js` — shared solve flow and puzzle generation
- `modes/base-locks.js` registers every native puzzle's open handler with `GameActions`; UI controls call `GameActions.attemptOpen()` instead of mode-specific functions
- `core/init.js` — animation startup, input bindings and initialization
- `core/inventory-hit-testing.js` — expanded inventory hit testing

The outer v251 IIFE is removed so these classic scripts share one global lexical environment. The only intentional runtime fix is `cssUrl(uri)`, which resolves assets passed through CSS variables against the document.
