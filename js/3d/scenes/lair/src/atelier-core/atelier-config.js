import { keynlockPaintings, paintingCategory, restorationTint } from './painting-catalog.js';

export const featuredPaintings = [
  {
    id: 'girl-pearl', category: 'baroque', title: 'Девушка с жемчужной серёжкой', short: 'Девушка с серьгой', artist: 'Ян Вермеер', year: 'около 1665',
    image: '/restoration-paintings/vermeer-girl.jpg', hue: 22, saturation: 0.73, brightness: 1.15,
  },
  {
    id: 'starry-night', category: 'impressionism', title: 'Звёздная ночь', short: 'Звёздная ночь', artist: 'Винсент ван Гог', year: '1889',
    image: '/restoration-paintings/vangogh-starry.jpg', hue: -26, saturation: 1.27, brightness: 0.78,
  },
  {
    id: 'vangogh-self', category: 'impressionism', title: 'Автопортрет', short: 'Автопортрет', artist: 'Винсент ван Гог', year: '1889',
    image: '/restoration-paintings/vangogh-self.jpg', hue: 29, saturation: 0.82, brightness: 0.84,
  },
  {
    id: 'great-wave', category: 'japan', title: 'Большая волна в Канагаве', short: 'Большая волна', artist: 'Кацусика Хокусай', year: 'около 1831',
    image: '/restoration-paintings/hokusai-wave.jpg', hue: -18, saturation: 0.68, brightness: 1.23,
  },
  {
    id: 'mona-lisa', category: 'renaissance', title: 'Мона Лиза', short: 'Мона Лиза', artist: 'Леонардо да Винчи', year: '1503–1519',
    image: '/restoration-paintings/leonardo-mona.jpg', hue: 14, saturation: 1.31, brightness: 0.79,
  },
];

const featuredIds = new Set(featuredPaintings.map((art) => art.id));
export const paintings = [
  ...featuredPaintings,
  ...keynlockPaintings.filter((art) => !featuredIds.has(art.id)).map((art) => ({
    ...art, short: art.title, category: paintingCategory(art), ...restorationTint(art.id),
  })),
];

export const woodVariants = [
  { name: 'Охра', image: '/textures/wood-oak-gouache-v2.webp', grade: { contrast: .94, saturation: .71, tint: [-8, -2, 14] } },
  { name: 'Орех', image: '/textures/wood-walnut-gouache-v2.webp', grade: { contrast: .72, saturation: .91, tint: [0, 2, 4] } },
  { name: 'Пепел', image: '/textures/wood-ash-gouache-v2.webp' },
];
