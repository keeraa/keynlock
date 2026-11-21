import { WORKSHOPS } from '../workshops/workshop-overlay.js';
import { t } from '../i18n.js';
import { ALCHEMY_Z, ATELIER_Z, WORKBENCH_Z } from '../room-layout.js';

export const ATELIER_EASELS = { position: [1.56, 3.22, ATELIER_Z], target: [-7.05, 2.48, ATELIER_Z] };

export const zoneDefinitions = {
  atelier: {
    number: '01', kicker: t('АТЕЛЬЕ САЙ'), title: t('Реставрация'),
    description: t('Оригинальное Ателье цвета размещено вдоль левой стены логова: 12 художественных направлений, 30 рам, действующие инструменты реставрации.'),
    status: t('Мольберты и картины находятся в общей 3D-сцене логова.'),
    link: WORKSHOPS.atelier.sourceUrl,
    camera: ATELIER_EASELS.position, target: ATELIER_EASELS.target,
  },
  planning: {
    number: '02', kicker: t('БАЗА КОМАНДЫ'), title: t('Карта и дела'),
    description: t('Карта каналов и кварталов Киенлока, заметки о заказах и стол, за которым Кай, Сай и Тик готовят очередную вылазку. Сюда команда возвращается с добычей.'),
    // A placeholder until the campaign has jobs and outings to show here.
    status: t('Скоро здесь: заказы, вылазки и выход в город. Раздел в разработке.'),
    link: null, camera: [.15, 3.32, 7.75], target: [0, 1.27, -.7],
  },
  workbench: {
    number: '03', kicker: t('МАСТЕРСКАЯ ТИКА'), title: t('Верстак'),
    description: t('Справа от алхимического стола, вдоль зелёной стены, стоит отдельный верстак с тисками, заготовками, замочными цилиндрами и инструментальной доской.'),
    status: t('Полная исходная мастерская: опиловка, сборка замка, песочница механизмов.'),
    link: WORKSHOPS.workbench.sourceUrl,
    camera: [1.22, 2.89, WORKBENCH_Z], target: [7.40, 1.42, WORKBENCH_Z],
  },
  alchemy: {
    number: '04', kicker: t('СОСТАВЫ И РЕАГЕНТЫ'), title: t('Алхимия'),
    description: t('Вся правая стена от пола до потолка покрыта зелёной гуашевой плиткой. У стены стоит алхимический стол с двумя ярусами, семью реагентами, пигментами, стеклом и свечами; над ним рецепт и часы.'),
    status: t('Исходная лаборатория: переливание, физика жидкостей, рецепты и все настройки.'),
    link: WORKSHOPS.alchemy.sourceUrl,
    // Fallback only. The loaded source laboratory supplies its actual orbit
    // position, pivot and 37° field of view when entering this workshop.
    camera: [3.08, 2.45, ALCHEMY_Z], target: [6.99, 1.45, ALCHEMY_Z],
  },
  gramophone: {
    number: '05', kicker: t('СКРЫТАЯ КОЛЛЕКЦИЯ'), title: t('Музыка в Логове'),
    description: t('Старый граммофон хранит запрещённые иностранные пластинки. Для будущего саундтрека отобраны три исполнения ноктюрнов Шопена: Op. 9 № 2 и два варианта Op. 9 № 1.'),
    status: t('Фонотека задумана; сами записи пока не включены в опубликованную сцену.'),
    link: null, camera: [1.95, 2.95, 3.60], target: [1.96, 1.83, -3.71],
  },
};

export const zoneOrder = ['atelier', 'planning', 'workbench', 'alchemy', 'gramophone'];
