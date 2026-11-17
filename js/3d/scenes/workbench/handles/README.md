# Рукояти — модуль Keynlock

Источник: отдельный эксперимент Three.js r187 [Формы рукоятей](https://handle-shapes-1116.k1r11111.chatgpt.site/), сохранённая версия 32.

## Содержимое

- `geometry.js` — 8 геометрических профилей, торцы, фаски/ободки, постаменты. Экспортирует `defs`, `HANDLE_HEIGHT`, `createClosedLathe()`, `createHandles()`.
- `painting.js` — нанесение рисунка по круговой UV-проекции, стыковка краёв, кеш до трёх исходных изображений и освобождение GPU-текстур.
- `app.js`, `index.html`, `style.css` — самостоятельный редактор/предпросмотр коллекции.
- `*.webp` — все 31 оптимизированных рисунка (японские, Decodance Black, Arabic).

## Интеграция с игрой

```js
import {createHandles, defs, HANDLE_HEIGHT} from './handles/geometry.js';
const handles = createHandles({clay, edge, base});
const selectedHandle = handles[0];
scene.add(selectedHandle);
```

`clay`, `edge`, `base` — материалы `THREE.Material`, создаваемые вызывающей сценой. Вызов `createHandles` создаёт отдельные `THREE.Group` в локальных координатах; стержень расположен по оси Y от 0 до `HANDLE_HEIGHT`. У группы есть подставка ниже Y=0; если рукоять вставляется в механизм, её можно удалить через `group.children` или адаптировать `createHandles`.

Для предпросмотра откройте `index.html` через HTTP-сервер; используется Three.js r187 через import map CDN.

`createPaintingSystem()` пока привязан к DOM редактора: для использования материала в игровой сцене следует выделить применение рисунка отдельно от выбора в UI. Сохранённый модуль не импортируется автоматически в действующую мастерскую и не меняет текущую механику Keynlock.

Удалённая ранее «Цветочная ваза» в коллекцию не входит.
