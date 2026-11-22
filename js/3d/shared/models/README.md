# KEYNLOCK — общий реестр 3D-моделей

В репозитории Keynlock подтверждены **40 записей моделей и модельных семейств**:

| Раздел | Записей | Файл |
| --- | ---: | --- |
| Импортированные GLB/glTF из Архива ключей | 15 | [catalog.json](./catalog.json) |
| Новый шкаф Library Oak Bookcase, внешний GLB | 1 | [catalog.json](./catalog.json) |
| Процедурные ключи | 10 | [procedural-models.json](./procedural-models.json) |
| Процедурные городские здания (4 варианта домов, 6 особых зданий) | 10 | [procedural-models.json](./procedural-models.json) |
| Семейства процедурных замков | 4 | [procedural-models.json](./procedural-models.json) |

Каталог не подменяет исходники сцен и не переносит их. GLB/glTF остаются по прежним путям; у файлов glTF сохранены соседние `.bin` и текстуры. Процедурные модели описаны ссылками на реальные фабрики, конфигурации и источники.

**Важное ограничение:** 40 — количество подтверждённых каталогизированных записей, а не полный подсчёт всех нарисованных в коде предметов. Отдельные детали замков, рукояти инструментов, мебель логова, алхимические предметы, мосты, здания-экземпляры и прочие элементы сцен пока не проинвентаризированы как самостоятельные записи. Чужие коллекции (например, Village Engine) сюда не включены.

## Источники сторонних моделей

- **Quaternius Fantasy Props MegaKit**, CC0 1.0 — https://quaternius.com/packs/fantasypropsmegakit.html
- **Poly Haven**, CC0 1.0 — https://polyhaven.com
- **Library Oak Bookcase** — https://tevy.dev/models/library-oak-bookcase, CC0 1.0; v1, 1,62 × 3 × 0,48 м, LOD0: 1474 треугольника. Модель зарегистрирована, но в сценах не размещена.

Сведения о лицензиях исходных архивных файлов: [SOURCES.txt](../../scenes/key-archive/dist/assets/selected-archive-props/SOURCES.txt), [LICENSE.txt](../../scenes/key-archive/dist/assets/quaternius-fantasy-props/LICENSE.txt).

## Подключение GLB/glTF в Three.js

```js
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadModel} from './js/3d/shared/models/model-catalog.js';
const gltf=await loadModel('painted-wooden-table',{loader:new GLTFLoader()});
scene.add(gltf.scene);
```

Процедурные модели импортируются из указанных в `procedural-models.json` модулей и требуют своих фабрик (например, `createBuildingModel` и `createKeyModel`). Не передавайте идентификаторы процедурных моделей в `loadModel`: он рассчитан только на GLB/glTF.
