# CSS audit

Snapshot: 2026-08-30, version 0.370.0.

## Scope

- 39 production stylesheets loaded by `index.html`.
- 7,639 production CSS lines.
- 1,287 `!important` declarations.
- Largest files: `alchemy.css` (2,637 lines), `overrides-06-digital.css` (412), `overrides-04-universal-lock.css` (394), `collection.css` (385), `mobile.css` (332).

## Findings

1. The primary risk is cascade layering, not file count. `overrides-03-lair.css`, `overrides-04-universal-lock.css`, `overrides-06-digital.css`, and `mobile.css` repeatedly redefine the same layout selectors.
2. The HUD is distributed across `base.css`, `global-top-hud.css`, `overrides-03-lair.css`, `overrides-04-universal-lock.css`, `overrides-05-inventory.css`, and `mobile.css`. `.topRightHud` has 12 definitions and `.topRightHud .economyHud` has 10.
3. Hillsfar has the densest mode-specific cascade. Several selectors are defined 10–20 times across its mode file and shared override files.
4. Universal lock sizing is spread between three root-variable blocks plus mobile overrides. These are intentional breakpoint values, but ownership is unclear.
5. Alchemy contains its own internal design system and responsive layout. It should remain isolated until its visual regression coverage exists.
6. Repeated gold, parchment, dark-surface, radius, shadow, font, and motion values are suitable for safe tokenization.
7. No unused selector was deleted in this pass. Runtime classes and state selectors are created from JavaScript, so text-only HTML matching is not sufficient evidence of dead CSS.

## Changes in this pass

- Added `tokens.css` as the canonical palette, typography, radius, shadow, and motion layer.
- Added `components.css` with low-specificity behavior shared by close buttons, compact controls, focus states, and disabled controls.
- Preserved compatibility aliases such as `--paper`, `--title-font`, `--ui-font`, and `--accent-font`.
- Kept feature and breakpoint overrides intact to avoid visual changes.

## Recommended next targets

1. Consolidate HUD ownership into `global-top-hud.css`.
2. Consolidate universal-lock geometry into one file with explicit desktop/tablet/mobile sections.
3. Fold Hillsfar corrections back into `modes-01-hillsfar.css`.
4. Audit Alchemy independently, with screenshots for each station and breakpoint.
