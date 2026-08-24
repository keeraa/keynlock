# KEYNLOCK — v253

Browser lockpicking puzzle game. v253 adds a repeatable local verification workflow and static-hosting configuration on top of the v252 modular JavaScript structure.

- `index.html` — KEYNLOCK entry point
- `css/` — modular CSS
- `js/core/` — shared runtime
- `js/world/` — inventory, lair, map/navigation and shop
- `js/modes/` — puzzle mechanics
- `assets/` — active artwork
- `scripts/serve.mjs` — dependency-free local static server
- `scripts/check.mjs` — JS syntax, entry-resource, asset-path, ID and mode checks
- `scripts/smoke.mjs` — HTTP smoke plus headless Chrome initialization check when Chrome/Chromium is installed
- `vercel.json` — static Vercel configuration; no build step required

Local commands:

```bash
npm run check
npm run smoke
npm run dev
```

For automatic web previews, import `keeraa/keynlock` into Vercel once and keep `main` as the production branch. After the Git integration is connected, pushes to `main` deploy automatically and other branches get preview deployments.

Stable checkpoints: `v250-stable`, `v251-stable`, `v252-stable`.
