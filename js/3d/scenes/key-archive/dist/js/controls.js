// Use physical key positions so WASD/E/R work on both Latin and Cyrillic layouts.
const BY_CODE = {
  KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e', KeyR: 'r',
  KeyP: 'p', KeyH: 'h', KeyM: 'm', KeyV: 'v', Digit1: '1', Digit2: '2',
  Digit3: '3', Digit4: '4', ShiftLeft: 'shift', ShiftRight: 'shift',
  Space: ' ', ArrowUp: 'arrowup', ArrowDown: 'arrowdown',
  ArrowLeft: 'arrowleft', ArrowRight: 'arrowright',
};
const BY_RUSSIAN_LETTER = {
  'ц': 'w', 'ф': 'a', 'ы': 's', 'в': 'd', 'у': 'e', 'к': 'r',
  'з': 'p', 'р': 'h', 'ь': 'm', 'м': 'v',
};

export function logicalKey(event) {
  const letter = event.key.toLowerCase();
  return BY_CODE[event.code] || BY_RUSSIAN_LETTER[letter] || letter;
}
