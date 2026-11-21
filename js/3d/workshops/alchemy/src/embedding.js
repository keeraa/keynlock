export { default as markup } from '../index.html?raw';
export { default as styles } from './styles.css?inline';

export function startAlchemy() {
  return import('./alchemy.js');
}
