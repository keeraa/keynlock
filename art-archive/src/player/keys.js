// Use physical key positions so WASD/E/F work on both Latin and Cyrillic layouts.
const BY_CODE = {
  KeyQ: 'q', KeyF: 'f', KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e',
  KeyP: 'p', KeyH: 'h', KeyM: 'm', KeyV: 'v', Digit1: '1', Digit2: '2',
  Digit3: '3', Digit4: '4', ShiftLeft: 'shift', ShiftRight: 'shift',
  Space: ' ', ArrowUp: 'arrowup', ArrowDown: 'arrowdown',
  ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
};
const BY_RUSSIAN_LETTER = {
  'й': 'q', 'а': 'f', 'ц': 'w', 'ф': 'a', 'ы': 's', 'в': 'd', 'у': 'e',
  'з': 'p', 'р': 'h', 'ь': 'm', 'м': 'v',
};

export function createInventoryWheel() {
  const threshold = 34;
  const cooldown = 175;
  let accumulated = 0;
  let lastEvent = -Infinity;
  let lastStep = -Infinity;

  return function wheelStep(event, now = performance.now()) {
    const { deltaMode, deltaX, deltaY } = event;
    if (!deltaY || Math.abs(deltaX) > Math.abs(deltaY) || now - lastStep < cooldown) return 0;
    if (now - lastEvent > 200 || Math.sign(accumulated) !== Math.sign(deltaY)) accumulated = 0;
    lastEvent = now;
    const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? threshold : 1;
    accumulated += deltaY * unit;
    if (Math.abs(accumulated) < threshold) return 0;
    const step = Math.sign(accumulated);
    accumulated = 0;
    lastStep = now;
    return step;
  };
}

export function logicalKey(event) {
  const letter = event.key.toLowerCase();
  return BY_CODE[event.code] || BY_RUSSIAN_LETTER[letter] || letter;
}
