# Зафиксированная рисовка Кийенлока

Этот эталон принят для мастерской ключей. При переносе ключей в зал коллекции не менять его автоматически.

## Фон мастерской

- Исходная гуашевая бумага: `dist/assets/gouache-parchment.webp`.
- CSS: `dist/styles.css` → `.viewer-panel`, `::before`, `::after`, `.viewer-grain`.
- Фоновый цвет `#dbbf91`, `center/cover`, зернистость с непрозрачностью `.22`, тёплая радиальная подсветка. Эти правила сохранены дословно.
- Фон принадлежит **редактору**, не входит в экспортируемые модели и не переносится в другие сцены без явного запроса.

## Металл и освещение

- Константы вынесены в `dist/js/key-art.js` (`KEY_ART`): освещение, тени, экспозиция, цветопередача, экранный контур и PBR-шероховатость металлов.
- Гуашевая текстура запекается в `MeshStandardMaterial`. Ржавчина и грязь смешиваются в одном шейдере до расчёта света. Декоративных овальных меток на поверхности ключей нет.
- Текущая обводка: `ScreenSpaceOutlinePass` по нормалям/глубине с сохранёнными радиусом `1.55 px`, непрозрачностью `.91` и цветом `#332a23`.
- В новой сцене освещение и бумага могут быть своими: `createKeyModel` и инстансы их не создают.

## Перенос ключей

Достаточно импортировать `dist/js/key-model.js` и оставить соседние `key-*.js`, `vendor/three.js` и `assets/` в тех же относительных каталогах. `keyAssetUrl()` определяет адрес фактур по расположению **модуля**, не страницы, поэтому вложенная сцена зала может переиспользовать мастерскую без перенастройки URL.

```js
import { defaultDesign, createKeyModel, disposeKeyModel, preloadKeyTextures,
  getKeyAnchors, createKeyPlacementMatrix, createInstancedKeyCollection,
  keyInstanceFromIntersection, moveKeyInstance, removeKeyInstance,
  disposeInstancedKeyCollection } from '../js/key-model.js';

const single=createKeyModel({...defaultDesign(9),broken:true,breakAngle:70,dirtAmount:100});
scene.add(single);
// Позже: scene.remove(single); disposeKeyModel(single);

await preloadKeyTextures();
const keyDesign=defaultDesign(9);
const anchors=getKeyAnchors(keyDesign); // hang / holeCenter / floor / center
const hall=createInstancedKeyCollection([
  {id:'brotherhood-001',design:keyDesign,
    placement:{mode:'hang',position:[0,2.1,0],yaw:0}},
  {id:'brotherhood-002',design:{...keyDesign,rustAmount:140},
    placement:{mode:'floor',position:[2,0,1],yaw:1.4}},
],{castShadow:false}); // для большого зала; свет по-прежнему действует на металл
scene.add(hall);
// const selected=keyInstanceFromIntersection(raycaster.intersectObjects(hall.children)[0]);
moveKeyInstance(hall,'brotherhood-002',[4,0,1]);
removeKeyInstance(hall,'brotherhood-001');
// Позже: scene.remove(hall); disposeInstancedKeyCollection(hall);
```

В JSON и экспорте доступны `broken`, `breakAngle` (60–80°) и `dirtAmount` (0/100). Старые сохранения с частичной грязью при чтении преобразуются в 100% покрытие. Инстансирование объединяет разные степени ржавчины, сохраняя геометрические варианты отдельно. Не переносить настройки фоновой бумаги мастерской в зал: они зафиксированы выше как стиль редактора.
