# KEYNLOCK CSS architecture

v254 preserves the v253 cascade while splitting large stylesheets into contiguous chronological fragments. File order in index.html is significant.

- base.css — foundation, HUD and classic-lock base styles
- modes-01 … modes-06 — Hillsfar, Gothic 1, Skyrim and Anachronox base sections
- world-01-shared.css — shared early imported-mode overrides
- overrides-* — later tools/shared, map, lair, universal-lock, inventory, digital and workbench sections
- alchemy-foundation.css — glassware, liquids and shared alchemy controls
- alchemy-workshop.css — alchemy window and responsive station layout
- alchemy-inventory.css — ingredient rack and bottle presentation
- mobile.css — shared mobile adaptations; later component files may add their own scoped responsive rules

All fragments stay directly in css/, so existing relative asset paths remain valid. Selectors are never regrouped across their original cascade positions.

`scripts/check.mjs` enforces the current specificity ceiling and rejects empty
media queries. Lower the ceiling whenever obsolete overrides are removed; do
not raise it for new UI.
