# KEYNLOCK · общий 3D-рендеринг

`painted-texture.js` подготавливает одинаковые CanvasTexture для рисованных покрытий: 512px, sRGB, mirrored repeat, anisotropy 4. Он не меняет пигмент и не выбирает способ обводки.

Режимы остаются независимыми:

- **locks:** `scenes/locks/src/js/effects/painted-pigment.js`, `cartoon-filter.js` — исходный пигмент и экранный контур.
- **alchemy:** `workshops/alchemy/src/visuals.js` — собственные палитры, toon и контурная геометрия.

Сборки включают общий JS-модуль внутрь автономных пакетов сцен: locks — через esbuild, alchemy — через Vite. Это позволяет публиковать сцены отдельно, без сетевых импортов.

При последующей унификации алгоритмов обязательно сравнивать визуальный результат каждого режима.

## Размытие фона

`background-blur.js` содержит `ROOM_BLUR_GLSL` — девять выборок уже отрисованной комнаты в алхимии (`workshops/alchemy/src/background-effects.js`); кеш статического слоя сохранён, преломление колб выполняется отдельным проходом. Потребитель отвечает за WebGLRenderTarget, камеру и вызов прохода.

`depth-blur.js` — единое размытие фона по глубине (бывшее размытие Ателье): два гауссовых прохода в половинном разрешении, слой premultiplied по маске фона, без ореолов вокруг переднего плана. `createDepthBlur({ renderer })` владеет своими целями; сцена вызывает `render({ color, depth, camera, focus, radius, near, far })` после прохода сцены и смешивает результат в своём финальном шейдере через `DEPTH_BLUR_GLSL` (`keynlockBackgroundMask`, `keynlockDepthBlur`). Используют: фильтр Ателье (`workshops/atelier/src/effects/cartoon-filter.js`) и обводка Логова (`scenes/lair/src/rendering/scene-outline.js`) — размытие за открытой лабораторией, переключатель «Размытие фона» в её панели.
