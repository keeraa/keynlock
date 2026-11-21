# Публикация Логова

Источник Логова и встроенных мастерских — ветка `main` репозитория `keeraa/keynlock`. Правки сначала вносятся через PR в GitHub. Репозиторий [Логова в Sites](https://keynlock-lair-1116.k1r11111.chatgpt.site/) хранит копию исходников для выпуска и настройки хостинга.

## Выпуск в Sites

1. Откройте исходный репозиторий существующего Логова через `site-workflow.mjs` в отдельной чистой рабочей копии. Сохраните действующие настройки доступа. Идентификатор проекта находится в `.openai/hosting.json` в репозитории Sites.
2. В корне локальной копии GitHub-репозитория запустите подготовку:

   ```sh
   node scripts/sync-lair-sites.mjs prepare /absolute/path/to/sites-checkout
   ```

   Скрипт получает актуальный SHA `main` напрямую с GitHub и переносит точный снимок `js/3d/scenes/lair`, `js/3d/core`, `js/3d/workshops`, манифеста и lock-файла npm workspace. Если в Sites есть самостоятельные изменения, сначала разберите их и перенесите нужные через PR в GitHub. Скрипт останавливается при таком расхождении и при локальных изменениях в копии Sites.
3. Сравните `source_tree` с деревом коммита действующей версии Sites. При совпадении повторный выпуск не нужен. Для выпуска передайте в `commands` помощника Sites следующие команды с абсолютными путями:

   ```json
   [
     ["node", "/absolute/path/to/keynlock/scripts/sync-lair-sites.mjs", "build", "/absolute/path/to/sites-checkout"],
     ["node", "/absolute/path/to/keynlock/scripts/sync-lair-sites.mjs", "verify", "/absolute/path/to/sites-checkout"]
   ]
   ```

   `build` проверяет исходники, собирает их из чистой копии через `npm ci`, `npm run check -w keynlock-lair`, `npm run check:sources -w keynlock-lair` и `npm run build -w keynlock-lair`. Он переносит в корневую `dist/` только успешную сборку с обоими входами, Логовом и `stations/workbench/`. Финальный `verify` сверяет копию с `main` перед упаковкой.
4. Сверьте дерево коммита, возвращённого помощником Sites, с `source_tree` финального `verify`:

   ```sh
   git -C /absolute/path/to/sites-checkout rev-parse 'SITES_COMMIT^{tree}'
   ```

   При совпадении опубликуйте проверенный архив и коммит в существующий Site с текущими настройками доступа. В отчёте о выпуске укажите SHA GitHub `main` из результата `build`, коммит Sites и номер версии.

## Сверка действующей версии

Получите SHA исходников опубликованной версии в Sites. В отдельной чистой копии этого коммита выполните:

```sh
node scripts/sync-lair-sites.mjs verify /absolute/path/to/sites-checkout
```

Версия Sites 85 (`129d82e`) совпадает по исходникам с GitHub `main` после вливания PR #27 (`2b5ab43`).
