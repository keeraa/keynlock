/** Run the original alchemy application in the Lair DOM and 3D world. */
import { markup, styles, startAlchemy } from '@keynlock/alchemy/embedding';
import { t } from '../i18n.js';

export function mountAlchemyInRoom(host) {
  const source = new DOMParser().parseFromString(markup, 'text/html');
  const root = source.querySelector('#experience');
  if (!root) throw new Error('Не найден оригинальный интерфейс алхимии');
  root.id = 'alchemy-embedded-app';
  root.classList.add('lair-alchemy-embedded');
  // A dedicated hit surface occupies the same viewport as the shared camera.
  // It sits above the Lair's navigation and hotspots but below alchemy's UI.
  const inputPlane = document.createElement('div');
  inputPlane.id = 'alchemy-input-plane';
  inputPlane.setAttribute('aria-hidden', 'true');
  // The input surface sits above the Lair navigation; always retain a
  // clickable way back even when the original laboratory is busy rendering.
  const exit = document.createElement('button');
  exit.type = 'button';
  exit.className = 'lair-alchemy-exit';
  exit.textContent = t('← В ЛОГОВО');
  exit.setAttribute('aria-label', t('Выйти из алхимии в логово'));
  root.appendChild(exit);
  root.querySelectorAll('script').forEach(script => script.remove());
  const style = document.createElement('style');
  style.dataset.alchemyStyle = 'original';
  style.textContent = `@scope (#alchemy-embedded-app) {\n${styles}\n}`;
  document.head.appendChild(style);
  document.querySelector('#app').append(inputPlane, root);
  host.alchemy.root = root;
  host.alchemy.inputPlane = inputPlane;
  void startAlchemy().catch(error => {
    console.error('Не удалось встроить исходную алхимию:', error);
    root.dataset.error = error.message;
    window.dispatchEvent(new CustomEvent('keynlock:alchemy:v1', {
      detail: {type:'error', message:error.message},
    }));
  });
  return root;
}
