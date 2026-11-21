# Алхимический стол · `@keynlock/alchemy`

Единственный источник алхимической лаборатории KEYNLOCK (Three.js r187). Из этого пакета собираются:

- отдельный сайт — [опубликованная лаборатория](https://keynlock-alchemy-lab-1115.k1r11111.chatgpt.site/): `npm run build` → `dist/`, относительный `base`, без сетевых импортов;
- лаборатория внутри Логова — `js/3d/scenes/lair/src/alchemy-in-room.js` берёт разметку из `index.html` и запускает `src/alchemy.js` в общей 3D-сцене и общем рендерере комнаты.

Код ведёт происхождение от опубликованной версии 28 (исходник `0f727db541e1eb4fe508129956dcf15018e81180`), дальше развивался в Логове. Прежние снимки `js/3d/scenes/alchemy/src` и `lab/` удалены: эта версия новее и содержит всё, что было в них.

## Устройство

- `src/alchemy.js` — сцена, реагенты, переливание, нагрев и рецепты.
- `src/runtime-host.js` — где запущена лаборатория: свой рендерер на отдельном сайте или общий рендерер Логова (`host.createRenderer('alchemy', canvas)`).
- `src/look/` — свет (`alchemy-look.js`, `ALCHEMY_LOOK`) и гуашевые фильтры (`alchemy-filters.js`); панель настроек — `src/ui/visual-panel.js`.
- `src/mixing.js`, `src/recipes.js` — логика смешивания и рецептов без графики.
- `src/fluid-physics.js`, `src/liquid-*.js`, `src/pouring.js` — жидкости и переливание.
- `src/wall-tiles.js` — гуашевая плитка стены; Логово использует тот же генератор для своей правой стены.
- `src/assets/` — гуашевые текстуры, этикетки и стекло. Общие материалы сверяются с `js/3d/shared/materials` (`node js/3d/shared/materials/sync.mjs --check`).

Общие модули рисовки берутся из `js/3d/core/rendering`: размытие комнаты (`ROOM_BLUR_GLSL`) и подготовка гуашевых текстур (`createPaintedTextureSurface`).

## Запуск

Зависимости ставятся один раз для всего `js/3d` (npm-workspace): `npm install` в `js/3d`. Затем здесь: `npm run dev`, сборка — `npm run build`. Поведение лаборатории внутри Логова проверяют тесты Логова (`npm run check` и `npm run test:browser` в `js/3d/scenes/lair`).

## Связь с Логовом

Внутри Логова мастерская получает общий рендерер, камеру и обработчики через `getWorkshopHost()` из `js/3d/core/host/workshop-host.js` и публикует своё API через `publishWorkshopApi()`. На отдельном сайте хоста нет, и мастерская работает со своим рендерером. Глобальные `window.__*` для этого не используются.
