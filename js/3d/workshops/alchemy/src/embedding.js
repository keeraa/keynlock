import markup from '../index.html?raw';
import styles from './styles.css?inline';
import embeddedStyles from './embedding.css?inline';
import { createWorkshopStatus, publishWorkshopApi } from '../../../core/host/workshop-host.js';
import { t, translator } from './i18n.js';

export function createAlchemyEmbedding({ host }) {
  const { status, update } = createWorkshopStatus();
  let root;
  let inputPlane;
  let alert;

  function reportError(error) {
    const message = error?.message || String(error);
    if (!alert) {
      alert = document.createElement('div');
      alert.className = 'lair-alchemy-runtime-error';
      alert.setAttribute('role', 'alert');
      root.append(alert);
    }
    alert.textContent = t('Ошибка лаборатории: {reason}', { reason: message });
    update({ error: message });
  }

  function mount(container) {
    const source = new DOMParser().parseFromString(markup, 'text/html').querySelector('#experience');
    root = source || document.createElement('div');
    root.id = 'alchemy-embedded-app';
    root.classList.add('lair-alchemy-embedded');
    root.inert = true;
    root.querySelectorAll('script').forEach(script => script.remove());
    translator.translateTree(root);

    inputPlane = document.createElement('div');
    inputPlane.id = 'alchemy-input-plane';
    inputPlane.setAttribute('aria-hidden', 'true');
    // Leaving the lab is the Lair's one return button (#reset-camera).

    const style = document.createElement('style');
    style.textContent = `${embeddedStyles}\n@scope (#alchemy-embedded-app) {\n${styles}\n}`;
    document.head.append(style);
    container.append(inputPlane, root);
    Object.assign(host, { root, inputPlane, reportStatus: update });
    publishWorkshopApi('alchemy', { status });

    if (source) void import('./alchemy.js').catch(reportError);
    else reportError(new Error(t('Не найден оригинальный интерфейс алхимии')));
  }

  function setActive(active) {
    if (!root) return;
    root.classList.toggle('is-active', active);
    root.inert = !active;
    inputPlane.classList.toggle('is-active', active);
  }

  return { mount, setActive, status, reportError };
}
