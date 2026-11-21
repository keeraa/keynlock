# KEYNLOCK — реестр 3D-сцен

Ссылки на опубликованные интерактивные прототипы и состояние исходников в ветке `main`.
Публикации на `chatgpt.site` обновляются отдельно от GitHub: изменение кода в репозитории само по себе не обновляет сайт.

| Сцена | Опубликованный прототип | Исходники в `main` | Состояние |
| --- | --- | --- | --- |
| Замки | [Лаборатория замков](https://keynlock-pin-lab-1114.k1r11111.chatgpt.site/) | [`scenes/locks/`](scenes/locks/) | Модульная сцена и сохранённая версия лаборатории |
| Алхимия | [Алхимический стол](https://keynlock-alchemy-lab-1115.k1r11111.chatgpt.site/) | [`workshops/alchemy/`](workshops/alchemy/) | Единый пакет `@keynlock/alchemy`: отдельный сайт (`npm run build`) и встраивание в Логово |
| Реставрация | [Мастерская реставрации](https://atelier-restoration-1115.k1r11111.chatgpt.site/) | [`workshops/atelier/`](workshops/atelier/) | Единый пакет `@keynlock/atelier`: отдельный сайт (`npm run build`) и встраивание в Логово; 28 тестов |
| Верстак | [3D-мастерская](https://keynlock-workbench-1116.k1r11111.chatgpt.site/) | [`scenes/workbench/`](scenes/workbench/) | Версия от **17.11.2026**, исходники и 87 проверок: выпиливание ключа, штифтовый механизм, песочница и шестизначная кодовая шкатулка с гуашевым металлом; отложенный WebGL, остановка фоновой анимации, кеш текстур и разделённые модули. [Статус и план](../../docs/3d-workbench-roadmap.md) |
| Логово | [3D-Логово команды](https://keynlock-lair-1116.k1r11111.chatgpt.site/) | [`scenes/lair/`](scenes/lair/) | GitHub `main` — источник Логова и встроенных мастерских. [Порядок публикации в Sites](LAIR-RELEASE.md) |
| Игровой мир | [Редактор города](https://keynlock-world-map-1115.k1r11111.chatgpt.site/path-builder/) · [Особые здания](https://keynlock-world-map-1115.k1r11111.chatgpt.site/landmark-lab/) | [`scenes/city/`](scenes/city/) | GitHub `main` — источник для редактора карты, ландшафта, мостов, домов и кварталов. [Порядок публикации в Sites](WORLD-MAP-RELEASE.md) |

Общие 3D-модули: [`core/`](core/) и [`shared/`](shared/).

Словарь понятий (логово, комната, зона, мастерская, Ателье и реставрация) и устройство логова — в [`scenes/lair/README.md`](scenes/lair/README.md).

Мастерские, которые встраиваются в Логово, живут в [`workshops/`](workshops/) — по одному пакету на мастерскую. `js/3d` — npm-workspace: `npm install` в `js/3d` ставит зависимости Логова и мастерских один раз.

Проверки кода (в `js/3d`): `npm run lint` — ESLint для Логова, мастерских, `core/` и Архива ключей; `npm run typecheck` — проверка типов файлов с пометкой `// @ts-check` (типы three.js и DOM). Новые файлы начинайте с `// @ts-check`; в остальные пометку добавляйте по мере исправления. Обе проверки идут в CI (`.github/workflows/js3d-lint.yml`).

При переносе очередной сцены в репозиторий обновляйте путь и состояние в этой таблице.
