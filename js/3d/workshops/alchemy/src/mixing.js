// Four pigment channels: red, yellow, blue, and opaque white.
// A trilinear RYB cube produces familiar paint mixtures instead of grey RGB averages.
export const REAGENTS = [
  { id: 'red', name: 'Красная', short: 'КРАСНЫЙ', parts: [1, 0, 0, 0], amount: 100, dose: 25, kind: 'tube' },
  { id: 'blue', name: 'Синяя', short: 'СИНИЙ', parts: [0, 0, 1, 0], amount: 100, dose: 25, kind: 'tube' },
  { id: 'yellow', name: 'Жёлтая', short: 'ЖЁЛТЫЙ', parts: [0, 1, 0, 0], amount: 100, dose: 25, kind: 'tube' },
  { id: 'white', name: 'Белая', short: 'БЕЛЫЙ', parts: [0, 0, 0, 1], amount: 100, dose: 25, kind: 'tube' },
  { id: 'stannum', name: 'Олово', latin: 'Stannum', symbol: 'Sn', short: 'Stannum', hex: '#cbbba6', darkHex: '#77746b', lightHex: '#f5efdf', parts: [.08, .09, .09, .90], metalness: .43, amount: 91, dose: 20, kind: 'bottle' },
  { id: 'plumbum', name: 'Свинец', latin: 'Plumbum', symbol: 'Pb', short: 'Plumbum', hex: '#626c86', darkHex: '#252e43', lightHex: '#acb5c6', parts: [.17, .18, .35, .10], metalness: .32, amount: 91, dose: 20, kind: 'bottle' },
  { id: 'aurum', name: 'Золото', latin: 'Aurum', symbol: 'Au', short: 'Aurum', hex: '#e5b54c', darkHex: '#90602c', lightHex: '#fff0a0', parts: [.25, 1, 0, .04], metalness: .64, amount: 91, dose: 20, kind: 'bottle' },
  { id: 'cuprum', name: 'Медь', latin: 'Cuprum', symbol: 'Cu', short: 'Cuprum', hex: '#bf6e4f', darkHex: '#65322d', lightHex: '#efb57b', parts: [1, .24, .05, .05], metalness: .51, amount: 91, dose: 20, kind: 'bottle' },
  { id: 'hydrargyrum', name: 'Ртуть', latin: 'Hydrargyrum', symbol: 'Hg', short: 'Hydrargyrum', hex: '#d5e0e3', darkHex: '#18242d', lightHex: '#fbffff', parts: [0, .07, .15, .83], metalness: .81, amount: 91, dose: 20, kind: 'bottle' },
  { id: 'argentum', name: 'Серебро', latin: 'Argentum', symbol: 'Ag', short: 'Argentum', hex: '#dae9f0', darkHex: '#7490a5', lightHex: '#ffffff', parts: [0, 0, .04, 1], metalness: .69, amount: 91, dose: 20, kind: 'bottle' },
  { id: 'ferrum', name: 'Железо', latin: 'Ferrum', symbol: 'Fe', short: 'Ferrum', hex: '#66615b', darkHex: '#272e32', lightHex: '#af977a', parts: [.29, .21, .32, .06], metalness: .35, amount: 91, dose: 20, kind: 'bottle' },
];

const rybCube = {
  '000': [242, 237, 220], '100': [214, 47, 65],
  '010': [247, 197, 57], '001': [60, 111, 204],
  '110': [239, 120, 35], '101': [138, 69, 175],
  '011': [47, 154, 95], '111': [103, 85, 69],
};

const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const mix = (a, b, t) => a + (b - a) * t;
const byteHex = n => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');

export function rgbToHex(rgb) {
  return `#${rgb.map(byteHex).join('')}`;
}

export function emptyMixture() {
  return { volume: 0, capacity: 160, pigment: [0, 0, 0, 0], additions: [] };
}

export function addDose(mixture, reagent, requestedAmount = reagent.dose, { mergeLast = false } = {}) {
  const amount = Math.min(Math.max(0, requestedAmount), Math.max(0, mixture.capacity - mixture.volume));
  if (amount <= 0) return 0;
  mixture.volume += amount;
  for (let c = 0; c < 4; c++) mixture.pigment[c] += reagent.parts[c] * amount;
  const last = mixture.additions.at(-1);
  if (mergeLast && last?.id === reagent.id) last.amount += amount;
  else mixture.additions.push({ id: reagent.id, name: reagent.name, symbol: reagent.symbol, metal: reagent.kind === 'bottle', hex: reagent.hex, amount });
  return amount;
}

export function pigmentColor(pigment) {
  const [red, yellow, blue, white] = pigment;
  const peak = Math.max(red, yellow, blue);
  if (peak < 0.0001) return { hex: '#e9e8df', rgb: [233, 232, 223], name: 'Белый' };
  const r = clamp(red / peak), y = clamp(yellow / peak), b = clamp(blue / peak);
  const rgb = [0, 0, 0];
  for (let ir = 0; ir < 2; ir++) for (let iy = 0; iy < 2; iy++) for (let ib = 0; ib < 2; ib++) {
    const weight = (ir ? r : 1 - r) * (iy ? y : 1 - y) * (ib ? b : 1 - b);
    const corner = rybCube[`${ir}${iy}${ib}`];
    for (let c = 0; c < 3; c++) rgb[c] += weight * corner[c];
  }
  const brighten = clamp(white / (peak + white)) * .85;
  for (let c = 0; c < 3; c++) rgb[c] = Math.round(mix(rgb[c], [246, 245, 235][c], brighten));
  const name = namePigment(r, y, b, brighten);
  return { hex: rgbToHex(rgb), rgb, name };
}

function namePigment(r, y, b, white) {
  if (white > .52) return 'Пастельный';
  const count = [r, y, b].filter(v => v > .5).length;
  if (count === 3) return 'Тёмная охра';
  if (r > .65 && b > .65) return 'Фиолетовый';
  if (y > .65 && b > .65) return 'Зелёный';
  if (r > .65 && y > .65) return 'Оранжевый';
  if (r >= y && r >= b) return white > .22 ? 'Розовый' : 'Красный';
  if (y >= r && y >= b) return white > .22 ? 'Кремовый' : 'Жёлтый';
  return white > .22 ? 'Голубой' : 'Синий';
}

export function mixtureInfo(mixture) {
  if (mixture.volume === 0) return { hex: '#344446', name: 'Пустой', formula: 'Ожидает эссенцию' };
  const color = pigmentColor(mixture.pigment);
  const names = [...new Set(mixture.additions.map(a => a.symbol || a.name.toLowerCase().replace(/ая$/, 'ый').replace(/яя$/, 'ий')))];
  const formula = names.slice(-3).join(' + ');
  const visibleFormula = formula.length > 31 ? formula.slice(0, 29) + '…' : formula;
  const metals = mixture.additions.filter(a => a.metal);
  if (!metals.length) {
    const pigmentId = mixture.additions.every(a => a.id === mixture.additions[0].id)
      ? mixture.additions[0].id : null;
    return { ...color, formula: visibleFormula, metalId: null, pigmentId };
  }
  const metalVolume = metals.reduce((sum, a) => sum + a.amount, 0);
  const metalRgb = [0, 0, 0];
  for (const a of metals) {
    const rgb = [1, 3, 5].map(i => parseInt(a.hex.slice(i, i + 2), 16));
    for (let c = 0; c < 3; c++) metalRgb[c] += rgb[c] * a.amount / metalVolume;
  }
  const allMetal = metalVolume >= mixture.volume - 1e-5;
  const rgb = allMetal ? metalRgb : color.rgb.map((value, i) => mix(value, metalRgb[i], metalVolume / mixture.volume));
  const metalId = allMetal && metals.every(a => a.id === metals[0].id) ? metals[0].id : null;
  return {
    hex: rgbToHex(rgb), rgb, name: metalId ? metals[0].name : allMetal ? 'Сплав' : 'Смесь',
    formula: visibleFormula, metalId
  };
}
