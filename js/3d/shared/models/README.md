# KEYNLOCK — общий каталог 3D-моделей

**[Открыть HTML-каталог](./catalog.html)** · [Список файловых моделей](./catalog.json) · [Процедурные модели и объекты сцен](./procedural-models.json)

На 22 ноября 2026 в реестре **82 записи**:

| Группа | Количество |
| --- | ---: |
| Импортированные GLB/glTF в Архиве ключей | 15 |
| Модели Tevy: Library Oak Bookcase, Pine Kitchen Table, Coffee Table (внешние GLB) | 3 |
| 10 видов ключей, 10 городских зданий и 4 семейства замков | 24 |
| Мебель логова, алхимическое оборудование, детали замков, механизм верстака и мосты | 40 |
| **Всего** | **82** |

HTML-каталог поддерживает поиск по названию, сцене, категории, фильтры и просмотр GLB/glTF в браузере. На карточках всех 18 файловых моделей видны проверенные числа треугольников (LOD0); для 64 параметрических моделей указано, что число полигонов зависит от настроек сцены. Для геометрии, собранной кодом, показывает источник и фабрику; извлечение в автономный GLB не выполнялось.

Оставшиеся ограничения: каталог охватывает подтверждённые типы и компоненты, а не каждый уникальный Mesh (или каждый параметрический вариант) во всех сценах. Ранее существовавший `js/3d/shared/materials/catalog.html` — это **каталог гуашевых материалов**, он сохранён без изменений. Внешние GLB по URL требуют доступности источника и CORS.

## Источники сторонних моделей

- **Quaternius Fantasy Props MegaKit**, CC0 1.0 — https://quaternius.com/packs/fantasypropsmegakit.html
- **Poly Haven**, CC0 1.0 — https://polyhaven.com
- **Library Oak Bookcase** — https://tevy.dev/models/library-oak-bookcase, CC0 1.0, LOD0 1474 треугольника.
- **Pine Kitchen Table** — https://tevy.dev/models/kitchen-table, CC0 1.0, LOD0 2220 треугольников.
- **Coffee Table** — https://tevy.dev/models/coffee-table, CC0 1.0, LOD0 2208 треугольников.

Все три модели Tevy добавлены в каталог со ссылками на версию v1 и тремя LOD; в сцены не размещались. Исходные файлы остаются на tevy.dev.

Сведения о лицензиях исходных архивных файлов: [SOURCES.txt](../../scenes/key-archive/dist/assets/selected-archive-props/SOURCES.txt), [LICENSE.txt](../../scenes/key-archive/dist/assets/quaternius-fantasy-props/LICENSE.txt).

## Подключение GLB/glTF в Three.js

```js
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadModel} from './js/3d/shared/models/model-catalog.js';
const gltf=await loadModel('painted-wooden-table',{loader:new GLTFLoader()});
scene.add(gltf.scene);
```

Процедурные модели импортируются из указанных в `procedural-models.json` модулей и требуют своих фабрик (например, `createBuildingModel` и `createKeyModel`). Не передавайте идентификаторы процедурных моделей в `loadModel`: он рассчитан только на GLB/glTF.
