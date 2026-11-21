// @ts-check
import { t } from '../i18n.js';

/** @typedef {ReturnType<typeof import('../../../../core/host/workshop-host.js').createWorkshopStatus>['status']} Status */

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
 * @param {{ loading: HTMLElement, atelierStatus: Status, alchemyStatus: Status, onAtelierModelsReady: () => void,
 *   onAlchemyReady: () => void, precompileWorkshopLighting: () => Promise<void> }} options
 */
export function mountInitialLoading({ loading, atelierStatus, alchemyStatus,
  onAtelierModelsReady, onAlchemyReady, precompileWorkshopLighting }) {
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

  atelierStatus.subscribe((current, previous) => {
    if (current.modelsReady && !previous?.modelsReady) onAtelierModelsReady();
    const progress = current.galleryProgress;
    if (progress && progress !== previous?.galleryProgress) gate.progress(progress.loaded, progress.total);
    if (current.galleryReady && !previous?.galleryReady) {
      galleryLoaded = true;
      completeInitialLoad();
    }
    if (current.error) gate.finish('error');
  });
  alchemyStatus.subscribe((current, previous) => {
    if (current.ready && !previous?.ready) {
      onAlchemyReady();
      alchemyLoaded = true;
      completeInitialLoad();
    }
    if (current.error) gate.finish('error');
  });
}
