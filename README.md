# KEYNLOCK — v372

Browser lockpicking puzzle game. v372 expands the journal to every supported mission, ordered by difficulty (27 / 21 / 21), with configurable multi-puzzle jobs and recovery of three starter picks. See [campaign notes](docs/first-chapter.md) for configuration, saves and validation.

Release planning: [first episode roadmap and acceptance criteria](docs/release-roadmap.md).
Latest audit: [release readiness, reproduced defects and all 70 mission launches](docs/qa/release-readiness-2026-09-09.md).
Current implemented story: [«Чужие подписи»](docs/narrative/chapter-one-proposal.md).
Worldbuilding: [официальный флаг Киенлока и его символика](docs/lore/flag.md).
Логово и музыка: [мастерские, галерея и саундтрек Шопена](docs/lore/lair-and-soundtrack.md).
Сюжетные печати: [семь районов, алхимических металлов и планет](docs/lore/seven-seals.md).
Игровой дизайн: [три способа взлома, награды, дневная мастерская и свободное строительство](docs/gameplay-core-three-approaches.md).

- `index.html` — KEYNLOCK entry point
- `css/` — modular CSS
- `js/core/` — shared runtime
- `js/world/` — inventory, lair, map/navigation and missions
- `js/modes/` — puzzle mechanics
- `js/3d/scenes/locks/lab/` — standalone Three.js lock-mechanism laboratory (Sites v51 snapshot)
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
