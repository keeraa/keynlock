// @ts-check
import { keynlockPaintings, paintingCategory, restorationTint } from './painting-catalog.js';

// Bundled with the workshop, so it works on its own site and inside the Lair.
// Literal paths: Vite can follow only those into the build.

export const featuredPaintings = [
  {
    id: 'girl-pearl', category: 'baroque', title: 'Девушка с жемчужной серёжкой', short: 'Девушка с серьгой', artist: 'Ян Вермеер', year: 'около 1665',
    image: new URL('./assets/paintings/vermeer-girl.jpg', import.meta.url).href, hue: 22, saturation: 0.73, brightness: 1.15,
  },
  {
    id: 'starry-night', category: 'impressionism', title: 'Звёздная ночь', short: 'Звёздная ночь', artist: 'Винсент ван Гог', year: '1889',
    image: new URL('./assets/paintings/vangogh-starry.jpg', import.meta.url).href, hue: -26, saturation: 1.27, brightness: 0.78,
  },
  {
    id: 'vangogh-self', category: 'impressionism', title: 'Автопортрет', short: 'Автопортрет', artist: 'Винсент ван Гог', year: '1889',
    image: new URL('./assets/paintings/vangogh-self.jpg', import.meta.url).href, hue: 29, saturation: 0.82, brightness: 0.84,
  },
  {
    id: 'great-wave', category: 'japan', title: 'Большая волна в Канагаве', short: 'Большая волна', artist: 'Кацусика Хокусай', year: 'около 1831',
    image: new URL('./assets/paintings/hokusai-wave.jpg', import.meta.url).href, hue: -18, saturation: 0.68, brightness: 1.23,
  },
  {
    id: 'mona-lisa', category: 'renaissance', title: 'Мона Лиза', short: 'Мона Лиза', artist: 'Леонардо да Винчи', year: '1503–1519',
    image: new URL('./assets/paintings/leonardo-mona.jpg', import.meta.url).href, hue: 14, saturation: 1.31, brightness: 0.79,
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
  { name: 'Охра', image: new URL('./assets/textures/wood-oak-gouache-v2.webp', import.meta.url).href, grade: { contrast: .94, saturation: .71, tint: [-8, -2, 14] } },
  { name: 'Орех', image: new URL('./assets/textures/wood-walnut-gouache-v2.webp', import.meta.url).href, grade: { contrast: .72, saturation: .91, tint: [0, 2, 4] } },
  { name: 'Пепел', image: new URL('./assets/textures/wood-ash-gouache-v2.webp', import.meta.url).href },
];
