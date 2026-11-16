# KEYNLOCK — 3D-механизмы замков

Исходники лаборатории Three.js r187 из версии **51** (2026-11-16).
Исходный коммит лаборатории: `5f679e5e03ea904b12112978257981390100625d`.

- `src/js/` — модульные механизмы, геометрия, физика, игровые правила, эффекты, UI и управление.
- `src/assets/` — специализированные исходные текстуры; пять общих металлических фактур берутся из `../../shared/materials/metals/` при сборке.
- `tests/` — модульные, механические, браузерные и визуальные проверки.
- `docs/` — архитектура, механики и требования к качеству.
- `art/` — оригинал росписи рукояти.
- `lab/` — точный снимок опубликованной собранной версии, запускаемый самостоятельно.
- `dist/` — генерируется при сборке, в Git не сохраняется.

Лаборатория: https://keynlock-pin-lab-1114.k1r11111.chatgpt.site

Команды из этого каталога:

```bash
npm ci
npm run release:check
npm run serve
```

Для локальной проверки исходников — `dist/index.html` через сервер. Существующая
2D-игра KEYNLOCK не импортирует лабораторию автоматически.
# Shared drawing infrastructure

`src/js/effects/painted-assets.js` uses `js/3d/core/rendering/painted-texture.js` for canvas texture preparation. Lock-specific pigment, pin finishes and screen-space outlines remain unchanged. The release bundle includes shared code through esbuild.

