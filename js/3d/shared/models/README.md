# KEYNLOCK — общий каталог 3D-моделей

**[Открыть HTML-каталог](./catalog.html)** · [Список файловых моделей](./catalog.json) · [Процедурные модели и объекты сцен](./procedural-models.json)

На 22 ноября 2026 в реестре **85 записей**:

| Группа | Количество |
| --- | ---: |
| Импортированные GLB/glTF в Архиве ключей | 15 |
| Модели Tevy (внешние GLB) | 3 |
| Poly Haven: Shelf 01, Arm Chair 01, Painted Wooden Cabinet 02 (glTF 2K) | 3 |
| 10 видов ключей, 10 городских зданий и 4 семейства замков | 24 |
| Мебель логова, алхимическое оборудование, детали замков, механизм верстака и мосты | 40 |
| **Всего** | **85** |

HTML-каталог поддерживает поиск по названию, сцене, категории, фильтры и просмотр GLB/glTF в браузере. На карточках всех 21 файловых моделей видны проверенные числа треугольников (LOD0); для 64 параметрических моделей указано, что число полигонов зависит от настроек сцены. Для геометрии, собранной кодом, показывает источник и фабрику; извлечение в автономный GLB не выполнялось.

Оставшиеся ограничения: каталог охватывает подтверждённые типы и компоненты, а не каждый уникальный Mesh (или каждый параметрический вариант) во всех сценах. Ранее существовавший `js/3d/shared/materials/catalog.html` — это **каталог гуашевых материалов**, он сохранён без изменений. Внешние GLB по URL требуют доступности источника и CORS.

## Проверка загруженных архивов (22.11.2026)

| ZIP пользователя | Результат | Треугольников |
| --- | --- | ---: |
| `Shelf_01_2k.gltf.zip` | Зарегистрирована новая Shelf 01 | 182 |
| `ArmChair_01_2k.gltf.zip` | Зарегистрирована новая Arm Chair 01 | 5 626 |
| `painted_wooden_cabinet_02_2k.gltf.zip` | Зарегистрирована новая Painted Wooden Cabinet 02 | 966 |
| `wooden_table_02_2k.gltf.zip` | Уже имеется `wooden-table-02`; геометрия 196 треугольников | 196 |

Новые модели входят в каталог; двоичные файлы и текстуры импортируются из исходной библиотеки Poly Haven скриптом `scripts/import-approved-polyhaven-models.mjs` через GitHub Actions `import-polyhaven-furniture.yml`. Если импорт не завершён, ссылки на внутренний glTF пока недоступны — карточка показывает источник. Оригиналы ZIP сохранены в файлах текущего разговора; в репозиторий не дублируются.

## Источники сторонних моделей

- **Shelf 01** — https://polyhaven.com/a/Shelf_01, 182 треугольника (2K).
- **Arm Chair 01** — https://polyhaven.com/a/ArmChair_01, 5 626 треугольников (2K).
- **Painted Wooden Cabinet 02** — https://polyhaven.com/a/painted_wooden_cabinet_02, 966 треугольников (2K).
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
