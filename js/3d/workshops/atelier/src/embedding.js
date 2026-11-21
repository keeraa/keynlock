import markup from '../index.html?raw';
import styles from './style.css?inline';
import embeddedStyles from './styles/embedding.css?inline';
import feedbackStyles from './styles/restoration.css?inline';
import { createWorkshopStatus, getWorkshopApi, publishWorkshopApi } from '../../../core/host/workshop-host.js';

export function createAtelierEmbedding({ host, t, onPanelHeight }) {
  const { status, update } = createWorkshopStatus();
  let root;
  let feedback;
  let startTimer;
  let alert;

  function reportStatus(change) {
    if (change.ready || change.error) clearTimeout(startTimer);
    if (change.ready) {
      root.classList.add('controls-ready');
      alert?.remove();
      alert = null;
      update({ error: null, ...change });
    } else update(change);
    if (!change.error) return;
    if (!alert) {
      alert = document.createElement('div');
      alert.className = 'atelier-start-error';
      alert.setAttribute('role', 'alert');
      const message = document.createElement('span');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = t('ПОВТОРИТЬ ЗАПУСК');
      retry.addEventListener('click', () => window.location.reload());
      alert.append(message, retry);
      root.append(alert);
    }
    alert.firstElementChild.textContent = t('Реставрация не запустилась: {reason}', { reason: change.error });
  }

  function reportError(error) {
    reportStatus({ error: error?.message || String(error) });
  }

  function mount(container) {
    const source = new DOMParser().parseFromString(markup, 'text/html').querySelector('#app');
    root = source || document.createElement('div');
    root.id = 'atelier-embedded-app';
    root.classList.add('lair-embedded');
    root.inert = true;
    root.querySelectorAll('script').forEach(script => script.remove());

    feedback = document.createElement('div');
    feedback.id = 'atelier-scene-feedback';
    feedback.setAttribute('aria-hidden', 'true');
    for (const id of ['restoration-cursor', 'damage-hint']) {
      const element = root.querySelector(`#${id}`);
      if (element) feedback.append(element);
    }
    const style = document.createElement('style');
    style.textContent = `${embeddedStyles}\n@scope (#atelier-embedded-app) {\n${styles.replace(/@import\s+url\([^)]*\)\s*;/g, '')}\n}\n${feedbackStyles}`;
    document.head.append(style);
    container.append(root, feedback);
    Object.assign(host, { root, feedback, reportStatus });
    publishWorkshopApi('atelier', { status });

    const reportHeight = () => onPanelHeight(Math.round(root.getBoundingClientRect().height));
    new ResizeObserver(reportHeight).observe(root);
    reportHeight();
    if (!source) {
      reportError(new Error('Не найден оригинальный интерфейс Ателье цвета'));
      return;
    }
    startTimer = setTimeout(() => reportStatus({ error: t('превышено время ожидания') }), 12000);
    void import('./main.js').catch(reportError);
  }

  function setActive(active) {
    if (!root || root.classList.contains('is-active') === active) return;
    if (!active) getWorkshopApi('atelier')?.gallery?.closeCollection();
    root.classList.toggle('is-active', active);
    root.inert = !active;
    feedback.classList.toggle('is-active', active);
  }

  return { mount, setActive, status, reportError };
}
