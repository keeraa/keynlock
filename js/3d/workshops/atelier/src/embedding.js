export { default as markup } from '../index.html?raw';
export { default as styles } from './style.css?inline';
export { default as restorationFeedbackStyles } from './styles/restoration.css?inline';

export function startAtelier() {
  return import('./main.js');
}
