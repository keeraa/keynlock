# Публикация «Игрового мира»

Исходники «Игрового мира» хранятся в `js/3d/scenes/city/` ветки `main` репозитория `keeraa/keynlock`. Правки сначала проходят через GitHub. Репозиторий Sites хранит точную копию папки города для публикации. Редактируйте проект и принимайте PR в GitHub.

[Действующий редактор города](https://keynlock-world-map-1115.k1r11111.chatgpt.site/path-builder/)

## Выпуск в Sites

1. Откройте **существующий** проект KEYNLOCK — Игровой мир через Sites, узнайте коммит действующей версии и откройте его исходный репозиторий в отдельной чистой рабочей копии через `site-workflow.mjs`. Используйте `project_id` из `js/3d/scenes/city/.openai/hosting.json` в GitHub. Отдельная копия сохраняет историю Sites и текущие настройки доступа.
2. В корне полной локальной копии GitHub-репозитория выполните:

   ```sh
   node scripts/sync-world-map-sites.mjs prepare /absolute/path/to/sites-checkout
   ```

   Скрипт читает актуальный `main` с GitHub и готовит в рабочей копии Sites точное дерево `js/3d/scenes/city/`. Он останавливается при локальных правках или если коммит Sites содержит дерево, которого не было в истории GitHub `main`. При таком расхождении сначала разберите отличия и перенесите нужные изменения в GitHub через PR.
3. Сравните `source_tree` из результата с деревом коммита действующей версии Sites. Если они совпадают, новая публикация не требуется. Если отличаются, запустите обычную упаковку через Sites с таким порядком команд (замените пути на абсолютные):

   ```json
   [
     ["node", "/absolute/path/to/keynlock/scripts/sync-world-map-sites.mjs", "verify", "/absolute/path/to/sites-checkout"],
     ["npm", "run", "check"],
     ["npm", "run", "test:landscape"],
     ["npm", "run", "test:water"],
     ["npm", "run", "test:house-module"],
     ["npm", "run", "build"],
     ["node", "/absolute/path/to/keynlock/scripts/sync-world-map-sites.mjs", "verify", "/absolute/path/to/sites-checkout"]
   ]
   ```

   Sites выполняет команды в рабочей копии сайта и упаковывает `dist/`. Проверка в конце останавливает выпуск, если содержимое города в GitHub `main` изменилось во время сборки. Перед сохранением версии проверьте дерево коммита, который вернула упаковка Sites:

   ```sh
   git -C /absolute/path/to/sites-checkout rev-parse 'SITES_COMMIT^{tree}'
   ```

   Результат должен совпасть с `source_tree` из последнего `verify`. Передайте проверенный архив и коммит в Sites, сохранив текущие настройки доступа.
4. Зафиксируйте в сообщении о релизе SHA GitHub `main` на момент сборки, номер версии Sites и SHA коммита Sites. У этих репозиториев разная история коммитов. Для сверки сравнивайте деревья файлов, как в предыдущем шаге.

## Сверка без публикации

```sh
node scripts/sync-world-map-sites.mjs verify /absolute/path/to/sites-checkout
```

Команда сверяет подготовленную копию с текущим GitHub `main`. Для сверки действующего сайта сначала получите коммит опубликованной версии в Sites и используйте чистую копию этого коммита. Контрольная точка после первичного переноса — Sites 143 (`d3f3dcc`) и GitHub `main` (`dc210f8`).
