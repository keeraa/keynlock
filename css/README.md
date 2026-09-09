# KEYNLOCK CSS architecture

v254 preserves the v253 cascade while splitting large stylesheets into contiguous chronological fragments. File order in index.html is significant.

- base.css — foundation, HUD and classic-lock base styles
- modes-01 … modes-06 — keyprofile, turnmemory, workingangle and signalbalance base sections
- world-01-shared.css — shared early imported-mode overrides
- `tools-shared.css`, `map.css`, `lair.css`, `universal-lock.css`,
  `inventory.css`, `digital.css` and `workbench.css` — thematic interaction
  layers retained in their original cascade order
- alchemy-foundation.css — glassware, liquids and shared alchemy controls
- alchemy-workshop.css — alchemy window and responsive station layout
- alchemy-inventory.css — ingredient rack and bottle presentation
- mobile.css — shared mobile adaptations; later component files may add their own scoped responsive rules

All fragments stay directly in css/, so existing relative asset paths remain valid. Selectors are never regrouped across their original cascade positions.

`scripts/check.mjs` enforces the current specificity and source-size ceilings
and rejects empty media queries. Comment text is excluded from the specificity
count. Lower the ceilings whenever obsolete CSS is removed; do not raise them
for new UI.

## Reusable interface elements

Use `tokens.css` for shared visual values and `components.css` for reusable
classes. The campaign, story dialogs, onboarding and restoration guide now use:

- `uiButton`: secondary button, including focus, hover and disabled states.
- `uiButton uiButton--primary`: terracotta primary action.
- `uiButton uiButton--gold`: gold primary action in story dialogs.
- `uiPanel`: olive panel with shared border, text and corner radius.
- `uiActions`: horizontal action group; screen CSS controls wrapping/alignment.
- `uiClose`: minimal close control. Always provide an `aria-label`.

Example:

```html
<aside class="uiPanel myPanel">
  <p>Описание задания</p>
  <div class="uiActions">
    <button class="uiButton" type="button">Отмена</button>
    <button class="uiButton uiButton--primary" type="button">Продолжить</button>
  </div>
</aside>
```

Change `--ui-primary`, `--ui-panel`, `--ui-ink`, `--ui-line`,
`--ui-control-radius` and `--ui-focus` in tokens.css for all consumers.
For local variation, set `--button-padding`, `--button-size`,
`--button-border`, `--button-bg`, `--button-ink` or `--actions-gap` on a
component/container. Variant classes set their own button colors.
Feature styles own widths, placement, responsive layout and illustrations;
do not copy button borders, backgrounds or interaction states into them.
Add classes directly to HTML or JavaScript templates; retain existing IDs
for behavior and accessibility. Do not infer styling from IDs in new code.

Standard game controls and surfaces use the shared rules listed in
`docs/ui-coverage.json`. Legacy class names are aliases in components.css,
including dynamic markup. The check script rejects duplicated base decoration
for these selectors. Mechanical controls are not ordinary menu buttons. Existing load order remains significant. Shared primitives
are accounted together with story styles in the existing 5 KB budget,
without increasing the combined CSS allowance.

All three equipment inventories use `KeynlockEquipmentDrawers.create` in
`js/world/inventory.js` and the classes `uiInventory`, `uiInventoryToggle`,
`uiInventoryItem`. The controller owns open/close, outside clicks, hover,
keyboard focus, touch toggle gestures and pointer approach (180 px / 42 px).
`--inventory-item-lift` controls item hover lift. Per-inventory adapters retain
artwork-aware hit testing, item actions and alchemy drag/drop; they must not
add a second pointer-approach controller.
