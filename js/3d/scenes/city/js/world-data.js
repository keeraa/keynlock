// Identifiers match js/data/world.js in keeraa/keynlock.
export const DISTRICTS = Object.freeze([
  { id: 'port', name: 'Порт', index: '02', color: '#d5823b', anchor: [-2, 0, 19],
    description: 'Каменные причалы, склады, рыбацкие лодки и торговые суда. Отсюда начинается путь в город.',
    kind: 'Причалы и рынки' },
  { id: 'old', name: 'Старый квартал', index: '01', color: '#b94a42', anchor: [-43, 0, -1],
    description: 'Узкие улочки, тесные дома и лавки старых мастеров. Здесь находится первое убежище команды.',
    kind: 'Жилые улицы' },
  { id: 'bohemian', name: 'Богемный квартал', index: '04', color: '#57945b', anchor: [0, 0, -5],
    description: 'Внутренние дворы, мастерские художников, маленькие театры и неожиданно красивые фасады.',
    kind: 'Мастерские и театры' },
  { id: 'arts', name: 'Район искусств', index: '03', color: '#d8b34b', anchor: [32, 0, 2],
    description: 'Галереи, антикварные салоны, музей и богатые частные собрания.',
    kind: 'Галереи и музей' },
  { id: 'industrial', name: 'Промышленный район', index: '05', color: '#4d9da4', anchor: [-93, 0, -38],
    description: 'Краснокирпичные фабрики, высокие трубы, жилые кварталы рабочих и механические мастерские.',
    kind: 'Фабрики и цеха' },
  { id: 'upper', name: 'Верхний город', index: '06', color: '#4c6ea9', anchor: [43, 0, -39],
    description: 'Каменные особняки, сады за оградами и тихие улицы состоятельных семей.',
    kind: 'Особняки и сады' },
  { id: 'palace', name: 'Дворцовый район', index: '07', color: '#7656a5', anchor: [5, 0, -57],
    description: 'Замок над всем городом. К его воротам поднимаются две дороги — с севера и с юга.',
    kind: 'Замок и резиденции' },
]);

// Future connections to the main game can use these anchors without changing the artwork.
export const LOCATIONS = Object.freeze([
  { id: 'lair', name: 'Логово', district: 'old', x: -28, z: 6, kind: 'lair' },
  { id: 'locksmith-shop', name: 'Лавка отмычек', district: 'old', x: -19, z: 11, kind: 'shop' },
  { id: 'restoration-workshop', name: 'Мастерская реставрации', district: 'arts', x: 32, z: -1, kind: 'workshop' },
  { id: 'port-warehouse', name: 'Портовый склад', district: 'port', x: 23, z: 17, kind: 'mission' },
]);
