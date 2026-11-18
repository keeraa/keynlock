# Удаление неиспользуемых текстур — 18.11.2026

Проверены основные загрузчики сцен и их ссылки на материалы.

Удалены 7 вариантов из канонической библиотеки и 10 копий из сцен (итого 17 файлов):

- `js/3d/shared/materials/architecture/gouache-vault-ceiling-v1.webp`
- `js/3d/shared/materials/glass/glass-antique.png`
- `js/3d/shared/materials/glass/glass-frosted.png`
- `js/3d/shared/materials/glass/glass-watercolor.png`
- `js/3d/shared/materials/wood/wood-ash-gouache.webp`
- `js/3d/shared/materials/wood/wood-oak-gouache.webp`
- `js/3d/shared/materials/wood/wood-walnut-gouache.webp`

В рабочем коде используются `gouache-vault-ceiling-v2.webp`, древесина `wood-*-gouache-v2.webp` и стекло `glass-*.webp`.

Удаление обратимо через историю Git. В библиотеке остаётся 50 материалов. Проверка относится к исходникам в Git; опубликованные сайты могут содержать отдельные сборки.
