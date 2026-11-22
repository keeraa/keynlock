# KEYNLOCK — общая библиотека 3D-моделей

Единый реестр внешних геометрических моделей. Каталог: [catalog.json](./catalog.json). В нём сейчас **16 файловых моделей** (GLB/glTF): 15 уже использовавшихся в Архиве ключей и 1 новая модель стеллажа.

## Состав

- **Книги:** 5 (Books Strapped, Book 7, Book Group Medium 1–3).
- **Мебель:** 4 (Peg Rack, Painted Wooden Stool, Painted Wooden Table, Wooden Table 02).
- **Освещение:** 4 (Candle 1–2, Chandelier, Wooden Candle Holder).
- **Прочее:** 2 (Scroll Red, Bottle 1).
- **Новый объект:** 1 (Library Oak Bookcase).

Пятнадцать существующих GLB/glTF хранятся в `js/3d/scenes/key-archive/dist/assets/` и подключаются из общего реестра по URL исходного файла с сохранением относительных ссылок на `.bin` и текстуры. Это **реестр существующих ассетов**, а не перенос или дублирование файлов. Авторство и условия использования указаны в `key-archive/dist/assets/selected-archive-props/SOURCES.txt` и `quaternius-fantasy-props/LICENSE.txt`. Модели Quaternius и Poly Haven: CC0 1.0.

**Library Oak Bookcase:** https://tevy.dev/models/library-oak-bookcase — CC0 1.0, версия v1. Габариты 1,62 × 3 × 0,48 м; LOD0 1 474 треугольника. Подключён к каталогу, но в сценах ещё не размещён. Его файлы загружаются с сайта источника, не сохранены в репозитории. Для всех внешних URL доступность и CORS следует проверить в целевой сцене.

## Использование

```js
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadModel} from './js/3d/shared/models/model-catalog.js';
const gltf=await loadModel('painted-wooden-table',{loader:new GLTFLoader()});
scene.add(gltf.scene);
```

Каталог описывает только импортированные GLB/glTF. **Процедурные модели** (дома, особые здания, механизмы замков, инструменты, десять семейств ключей) существуют в исходных JS-модулях соответствующих сцен и здесь пока не перечислены. Их необходимо индексировать отдельно по фабрикам и параметрам, чтобы не путать с файловыми ресурсами.
