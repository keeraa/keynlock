# KEYNLOCK CSS architecture

v254 preserves the v253 cascade while splitting large stylesheets into contiguous chronological fragments. File order in index.html is significant.

- base.css — foundation, HUD and classic-lock base styles
- modes-01 … modes-06 — Hillsfar, Mass Effect, Gothic 1, Skyrim and Anachronox base sections
- world-01-shared.css — shared early imported-mode overrides
- overrides-* — later tools/shared, map, lair, universal-lock, inventory, digital and workbench sections
- mobile.css — final mobile layer and must remain last

All fragments stay directly in css/, so existing relative asset paths remain valid. Selectors are never regrouped across their original cascade positions.
