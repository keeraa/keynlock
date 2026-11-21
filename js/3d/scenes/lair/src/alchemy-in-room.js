/** Run the original alchemy application in the Lair DOM and 3D world. */
import alchemyHTML from '@keynlock/alchemy/index.html?raw';
import alchemyCSS from '@keynlock/alchemy/src/styles.css?inline';

export function mountAlchemyInRoom() {
  const source = new DOMParser().parseFromString(alchemyHTML, 'text/html');
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
  exit.textContent = '← В ЛОГОВО';
  exit.setAttribute('aria-label', 'Выйти из алхимии в логово');
  root.appendChild(exit);
  root.querySelectorAll('script').forEach(script => script.remove());
  const style = document.createElement('style');
  style.dataset.alchemyStyle = 'original';
  style.textContent = `@scope (#alchemy-embedded-app) {\n${alchemyCSS}\n}`;
  document.head.appendChild(style);
  document.querySelector('#app').append(inputPlane, root);
  window.__keynlockAlchemyEmbedRoot = root;
  window.__keynlockAlchemyInputPlane = inputPlane;
  void import('@keynlock/alchemy/src/alchemy.js').catch(error => {
    console.error('Не удалось встроить исходную алхимию:', error);
    root.dataset.error = error.message;
    window.dispatchEvent(new CustomEvent('keynlock:alchemy:v1', {
      detail: {type:'error', message:error.message},
    }));
  });
  return root;
}
