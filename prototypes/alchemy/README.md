# Alchemy prototypes — cleaned

Staging copy of the single-file demo, split up and made safe to embed. Nothing
here is wired into the game yet: `check.mjs` only walks `js/` and `css/`, so
this folder is invisible to the build.

Source: `alchemy_mechanics_prototypes_optimized_v109_bottom_fill_hover_bubbles.html`

## What changed

**Images out of the stylesheet.** Five PNGs were inlined as base64, which is
265 KB of the 416 KB file. They are files now (202 KB — base64 inflates by a
third), so the browser caches them instead of re-parsing them with every load
of the stylesheet.

**Split into parts.** 12 KB html, 70 KB css, 69 KB js.

**The script is wrapped in a closure.** It declared 231 top-level names. The
game loads classic scripts that all share one lexical environment, where two of
those (`apply`, `shuffle`) already collide — and that environment has bitten us
twice already (`noise` against the audio generator, `gate` against the motion
permission). Wrapped, it contributes nothing to the global scope. Expose
through `window.Alchemy` when wiring it in.

Nothing was removed: checked for dead CSS and there is none. All 169 classes
are referenced, several only from template strings in the script.

## Before this goes in the game

**Lazy start.** 17 `requestAnimationFrame` loops and nine autostarts fire on
load. Fine for a demo page where everything is on screen; inside the game they
would run forever on top of the parallax, the noise decay and the bird watcher.
Each mechanic needs to start when opened and stop when closed.

**A home.** The lair already has a module system — a hotspot opens a window
with a panel, as with Dialogues and City analysis. Alchemy fits there as
another hotspot. The workbench beside it is still a static image with no logic.

**A purpose.** Decided: potions that carry into the next lock — less noise per
move, sturdier picks, guards arriving later.
