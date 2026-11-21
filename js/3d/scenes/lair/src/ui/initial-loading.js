// @ts-check
import { t } from '../i18n.js';

/** Keep the initial room veil up until its visible paintings are ready. */
export function createInitialLoadingGate({
  onProgress, onDone, minimumMs = 900, timeoutMs = 90000,
  now = () => performance.now(),
  setTimer = (callback, ms) => setTimeout(callback, ms),
  clearTimer = (id) => clearTimeout(id),
}) {
  const started = now();
  let finished = false;
  let lastLoaded = 0;
  const watchdog = setTimer(() => finish('timeout'), timeoutMs);

  function progress(loaded, total) {
    if (finished || !Number.isFinite(loaded) || !Number.isFinite(total)) return;
    const count = Math.max(0, Math.floor(total));
    lastLoaded = Math.max(lastLoaded, Math.min(count, Math.floor(loaded)));
    onProgress({ loaded: lastLoaded, total: count });
  }

  function finish(reason = 'ready') {
    if (finished) return;
    finished = true;
    clearTimer(watchdog);
    setTimer(() => onDone(reason), Math.max(0, minimumMs - (now() - started)));
  }

  return { progress, finish };
}

/**
 * @param {{ loading: HTMLElement, onAtelierModelsReady: () => void,
 *   onAlchemyReady: () => void, precompileWorkshopLighting: () => Promise<void> }} options
 */
export function mountInitialLoading({ loading, onAtelierModelsReady, onAlchemyReady, precompileWorkshopLighting }) {
  const bar = /** @type {HTMLElement} */ (loading.querySelector('.loading-line i'));
  const status = loading.querySelector('small');
  let galleryLoaded = false;
  let alchemyLoaded = false;
  const gate = createInitialLoadingGate({
    onProgress({ loaded, total }) {
      loading.classList.add('is-tracking');
      status.textContent = t('ЗАГРУЖАЕМ КАРТИНЫ · {loaded} / {total}', { loaded, total });
      bar.style.width = `${total ? loaded / total * 100 : 100}%`;
    },
    onDone(reason) {
      if (reason !== 'ready') console.warn('Начальная загрузка мастерских завершилась по таймауту или с ошибкой:', reason);
      loading.setAttribute('aria-busy', 'false');
      loading.classList.add('done');
    },
  });

  function completeInitialLoad() {
    if (!galleryLoaded) return;
    if (!alchemyLoaded) {
      status.textContent = t('ПОДГОТАВЛИВАЕМ АЛХИМИЧЕСКУЮ ЛАБОРАТОРИЮ');
      bar.style.width = '94%';
      return;
    }
    void precompileWorkshopLighting()
      .catch(error => console.warn('Shader warm-up failed:', error))
      .finally(() => gate.finish());
  }

  window.addEventListener('keynlock:atelier', (/** @type {CustomEvent} */ event) => {
    const { type, loaded, total } = event.detail || {};
    if (type === 'models-ready') onAtelierModelsReady();
    if (type === 'initial-gallery-progress') gate.progress(loaded, total);
    if (type === 'initial-gallery-ready') {
      galleryLoaded = true;
      completeInitialLoad();
    }
    if (type === 'error') gate.finish('error');
  });
  window.addEventListener('keynlock:alchemy:v1', (/** @type {CustomEvent} */ event) => {
    if (event.detail?.type === 'ready') {
      onAlchemyReady();
      alchemyLoaded = true;
      completeInitialLoad();
    }
    if (event.detail?.type === 'error') gate.finish('error');
  });
}
