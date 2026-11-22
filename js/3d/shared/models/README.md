# KEYNLOCK — общая библиотека 3D-моделей

Единый каталог моделей для будущих сцен. Файлы моделей не дублируются между сценами: загрузка через закреплённые URL, указанные в `catalog.json`.

## Library Oak Bookcase

- Источник: https://tevy.dev/models/library-oak-bookcase
- Лицензия: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) — разрешено коммерческое использование и изменение.
- Версия: **v1**, закреплена в URL.
- Габариты: 1,62 × 3,00 × 0,48 м.
- LOD0: 1 474 треугольника / ~235 КБ; LOD1: 1 192 / ~84 КБ; LOD2: 136 / ~20 КБ.
- Статус: **в каталоге; в сценах пока не размещена**.
- Оригинальная модель; адаптация материалов под гуашевую стилистику KEYNLOCK выполняется отдельно.

### Подключение к Three.js

```js
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {loadModel} from './js/3d/shared/models/model-catalog.js';
const gltf=await loadModel('library-oak-bookcase',{loader:new GLTFLoader(),lod:0});
scene.add(gltf.scene);
```

Для подключения через прямой браузерный import можно также читать `catalog.json` обычным fetch и использовать `lods[0].url`. Сеть требуется при первом открытии; для офлайн-сборки надо самостоятельно скопировать закреплённые GLB локально.
