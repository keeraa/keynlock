# Зафиксированная рисовка Кийенлока

Этот эталон принят для мастерской ключей. При переносе ключей в зал коллекции не менять его автоматически.

## Фон мастерской

- Исходная гуашевая бумага: `dist/assets/gouache-parchment.webp`.
- CSS: `dist/styles.css` → `.viewer-panel`, `::before`, `::after`, `.viewer-grain`.
- Фоновый цвет `#dbbf91`, `center/cover`, зернистость с непрозрачностью `.22`, тёплая радиальная подсветка. Эти правила сохранены дословно.
- Фон принадлежит **редактору**, не входит в экспортируемые модели и не переносится в другие сцены без явного запроса.

## Металл и освещение

- Константы вынесены в `dist/js/key-art.js` (`KEY_ART`): освещение, тени, экспозиция, цветопередача, экранный контур и PBR-шероховатость металлов.
- Гуашевая текстура запекается в `MeshStandardMaterial`. Ржавчина, сплошные овальные метки и грязь смешиваются в одном шейдере до расчёта света.
- Овалы не создают отдельные плоскости и не добавляют треугольников; свет и тени обрабатывают их как пигмент на поверхности ключа.
- Текущая обводка: `ScreenSpaceOutlinePass` по нормалям/глубине с сохранёнными радиусом `1.55 px`, непрозрачностью `.91` и цветом `#332a23`.
- В новой сцене освещение и бумага могут быть своими: `createKeyModel` и инстансы их не создают.

## Перенос ключей

Достаточно импортировать `dist/js/key-model.js` и оставить соседние `key-*.js`, `vendor/three.js` и `assets/` в тех же относительных каталогах. `keyAssetUrl()` определяет адрес фактур по расположению **модуля**, не страницы, поэтому вложенная сцена зала может переиспользовать мастерскую без перенастройки URL.

```js
import { defaultDesign, createKeyModel, disposeKeyModel,
  createInstancedKeyCollection, disposeInstancedKeyCollection } from '../js/key-model.js';

const single=createKeyModel({...defaultDesign(9),broken:true,breakAngle:70,dirtAmount:100});
scene.add(single);
// Позже: scene.remove(single); disposeKeyModel(single);

const hall=createInstancedKeyCollection([{template:9,position:[0,0,0]}]);
scene.add(hall);
// Позже: scene.remove(hall); disposeInstancedKeyCollection(hall);
```

В JSON и экспорте доступны `broken`, `breakAngle` (60–80°) и `dirtAmount` (0/100). Старые сохранения с частичной грязью при чтении преобразуются в 100% покрытие. Зал должен группировать одинаковые дизайны через `createInstancedKeyCollection`.
