export function windowLightPalette(night) {
  return night ? NIGHT : DAY;
}

const DAY = Object.freeze({
  sun: 0xffe5c4, glass: 0xe8d9bc, glow: 0xffdfab,
  air: 0xeacfa5, wash: 0xeecf9e, dust: 0xffedce,
  canvasGlass: 'rgba(232,217,188,.58)', canvasWash: '238,207,158',
});
const NIGHT = Object.freeze({
  sun: 0xc7ddff, glass: 0xb2cfec, glow: 0xc3dcff,
  air: 0xaac6e8, wash: 0xa7c5f1, dust: 0xe2eeff,
  canvasGlass: 'rgba(178,207,236,.46)', canvasWash: '159,193,240',
});
