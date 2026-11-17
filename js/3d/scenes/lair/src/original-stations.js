/**
 * Coordinate the original KEYNLOCK workshops from the Lair.
 *
 * The original Atelier source runs in this document, including its UI and
 * input handling. Alchemy currently uses its isolated standalone runtime.
 */
export const ORIGINAL_STATIONS = Object.freeze({
  restoration: {
    title: 'Реставрация',
    url: '/stations/atelier/',
    sourceUrl: 'https://atelier-restoration-1115.k1r11111.chatgpt.site/',
  },
  workbench: {
    title: 'Верстак',
    url: '/stations/workbench/',
    sourceUrl: 'https://keynlock-workbench-1116.k1r11111.chatgpt.site/',
  },
  alchemy: {
    title: 'Алхимия',
    url: '/integrations/alchemy/src/index.html?standalone=1',
    sourceUrl: 'https://keynlock-alchemy-lab-1115.k1r11111.chatgpt.site/',
  },
});

export function mountOriginalStations({onExit = () => {},onReady = () => {},rendererHost} = {}) {
  const overlay = document.querySelector('#original-station-overlay');
  const firstFrame = document.querySelector('#original-station-frame');
  const title = document.querySelector('#original-station-title');
  const external = document.querySelector('#original-station-external');
  const returnButton = document.querySelector('#original-station-return');
  const loader = document.querySelector('#original-station-loading');
  const loadingTitle = document.querySelector('#original-station-loading-title');
  const warning = document.querySelector('#original-station-warning');
  const fallback = document.querySelector('#original-station-fallback');

  // Restoration is mounted directly by atelier-in-room.js; no restoration
  // iframe, second workshop page or detached menu exists.
  const frames = new Map();
  const readyStations = new Set();
  const names = ['workbench','alchemy'];
  for (const [index,id] of names.entries()) {
    const frame = index === 0 ? firstFrame : firstFrame.cloneNode(false);
    if (index) {
      frame.removeAttribute('id');
      firstFrame.parentElement.insertBefore(frame,firstFrame.nextSibling);
    }
    frame.classList.add('original-station-frame');
    frame.dataset.station = id;
    frame.title = `KEYNLOCK — оригинальная мастерская «${ORIGINAL_STATIONS[id].title}»`;
    frame.inert = true;
    frames.set(id,frame);
  }
  let station = null;
  let opened = false;
  let restorationInRoom = false;
  let alchemyInRoom = false;
  let warningTimer = null;
  let atelierStartTimer = null;
  let atelierFailure = null;

  // Loading artwork is independent of using the correction panel. A failed
  // dynamic import must also be visible instead of leaving a permanent veil.
  function showAtelierFailure(message) {
    if (readyStations.has('restoration')) return;
    atelierFailure = message || 'Редактор не завершил запуск';
    const atelier = document.querySelector('#atelier-embedded-app');
    if (!atelier) return;
    atelier.classList.add('load-error');
    let status = atelier.querySelector('.atelier-start-error');
    if (!status) {
      status = document.createElement('div');
      status.className = 'atelier-start-error';
      status.setAttribute('role','alert');
      const description = document.createElement('span');
      const reload = document.createElement('button');
      reload.type = 'button';
      reload.textContent = 'ПОВТОРИТЬ ЗАПУСК';
      reload.addEventListener('click', () => window.location.reload());
      status.append(description,reload);
      atelier.appendChild(status);
    }
    status.firstElementChild.textContent = `Реставрация не запустилась: ${atelierFailure}`;
    showCurrentFrame();
  }

  function clearTimers() {
    clearTimeout(warningTimer);
    warningTimer = null;
  }

  function markReady(id) {
    const wasReady = readyStations.has(id);
    readyStations.add(id);
    if (opened && station === id) {
      overlay.classList.add('station-ready');
      loader.setAttribute('aria-busy', 'false');
      warning.hidden = true;
      fallback.hidden = true;
      clearTimeout(warningTimer);
    }
    if (!wasReady) onReady(id);
    if (id === 'restoration') {
      clearTimeout(atelierStartTimer);
      atelierStartTimer = null;
      atelierFailure = null;
      document.querySelector('#atelier-embedded-app')?.classList.remove('load-error');
      document.querySelector('#atelier-embedded-app .atelier-start-error')?.remove();
      showCurrentFrame();
    }
  }

  function ensureFrame(id) {
    const frame = frames.get(id);
    if (frame && !frame.getAttribute('src')) frame.src = ORIGINAL_STATIONS[id].url;
  }

  function showCurrentFrame() {
    for(const [id,frame] of frames) {
      const selected = opened && id === station;
      frame.classList.toggle('is-active',selected);
      frame.inert = !selected;
    }
    const atelier = document.querySelector('#atelier-embedded-app');
    if (atelier) {
      atelier.classList.toggle('is-active',restorationInRoom);
      const controlsReady = readyStations.has('restoration');
      atelier.classList.toggle('controls-ready',controlsReady);
      // The original range inputs respond while images/materials stream. They
      // must remain available if optional startup work fails.
      atelier.inert = !restorationInRoom;
    }
    const alchemy = document.querySelector('#alchemy-embedded-app');
    if (alchemy) {
      alchemy.classList.toggle('is-active',alchemyInRoom);
      alchemy.inert = !alchemyInRoom;
    }
    document.querySelector('#alchemy-input-plane')?.classList.toggle('is-active',alchemyInRoom);
  }

  function showRestorationInRoom() {
    restorationInRoom = true;
    showCurrentFrame();
  }

  function hideRestorationInRoom() {
    restorationInRoom = false;
    const atelier = document.querySelector('#atelier-embedded-app');
    atelier?.querySelector('#collection-modal:not([hidden]) #collection-close')?.click();
    atelier?.classList.remove('collection-expanded');
    void window.__keynlockAtelierFlush?.();
    showCurrentFrame();
  }

  function hideAlchemyInRoom() {
    alchemyInRoom = false;
    rendererHost?.setWorldRuntimeActive('alchemy',false);
    window.__alchemy?.lifecycle?.setActive(false);
    if (window.__keynlockLairControls) window.__keynlockLairControls.enabled = true;
    showCurrentFrame();
  }

  function showAlchemyInRoom() {
    alchemyInRoom = true;
    if (window.__keynlockLairControls) window.__keynlockLairControls.enabled = false;
    rendererHost?.setWorldRuntimeActive('alchemy', true);
    window.__alchemy?.lifecycle?.setActive(true);
    showCurrentFrame();
  }

  function preload(id) {
    const next = ORIGINAL_STATIONS[id];
    if (!next) return;
    if (id === 'restoration' || id === 'alchemy') return;
    clearTimers();
    station = id;
    overlay.classList.remove('station-ready');
    loader.setAttribute('aria-busy', 'true');
    title.textContent = next.title.toUpperCase();
    loadingTitle.textContent = 'ЗАГРУЖАЕМ ОРИГИНАЛЬНУЮ МАСТЕРСКУЮ';
    external.href = next.sourceUrl;
    external.hidden = id === 'restoration';
    fallback.href = next.sourceUrl;
    warning.hidden = true;
    fallback.hidden = true;
    ensureFrame(id);
  }

  function open(id) {
    if (!ORIGINAL_STATIONS[id]) return;
    if (id === 'restoration') {showRestorationInRoom();return;}
    if (id === 'alchemy') {showAlchemyInRoom();return;}
    if (station !== id) preload(id);
    opened = true;
    overlay.dataset.station = id;
    if (id !== 'alchemy') rendererHost?.activate(id);
    overlay.classList.add('station-open');
    overlay.setAttribute('aria-hidden', 'false');
    showCurrentFrame();
    ensureFrame(id);
    if (readyStations.has(id)) markReady(id);
    warningTimer = setTimeout(() => {
      if (!opened || readyStations.has(id) || station!==id) return;
      warning.hidden = false;
      fallback.hidden = false;
    }, 11000);
    returnButton.focus({preventScroll: true});
  }

  function close() {
    if (!opened) return;
    opened = false;
    overlay.classList.remove('station-open');
    overlay.setAttribute('aria-hidden', 'true');
    showCurrentFrame();
    clearTimers();
    rendererHost?.deactivate(station);
    onExit();
  }

  function onLoad(id) {
    if (id !== 'alchemy' && !rendererHost?.hasWorldScene(id)) return;
    markReady(id);
  }

  function onAtelierEvent(event) {
    const {type,open} = event.detail || {};
    // Model geometry is registered before texture decoding and control setup.
    // Only the final ready event unlocks the visible editing panel.
    if (type === 'ready') markReady('restoration');
    if (type === 'mounted') {
      clearTimeout(atelierStartTimer);
      atelierStartTimer = setTimeout(() => {
        if (!readyStations.has('restoration')) showAtelierFailure('превышено время ожидания');
      }, 12000);
    }
    if (type === 'collection-open') {
      document.querySelector('#atelier-embedded-app')?.classList.toggle('collection-expanded',Boolean(open));
    }
    if (type === 'error') {
      console.error('Исходное ателье не готово:',event.detail?.message || 'Неизвестная ошибка');
      showAtelierFailure(event.detail?.message || 'ошибка запуска');
    }
  }

  function onAlchemyEvent(event) {
    if (event.detail?.type === 'ready') markReady('alchemy');
    if (event.detail?.type === 'error') {
      console.error('Алхимия:',event.detail.message);
      const root = document.querySelector('#alchemy-embedded-app');
      if (root) {
        let failure = root.querySelector('.lair-alchemy-runtime-error');
        if (!failure) {
          failure = document.createElement('div');
          failure.className = 'lair-alchemy-runtime-error';
          failure.setAttribute('role','alert');
          root.appendChild(failure);
        }
        failure.textContent = `Ошибка лаборатории: ${event.detail.message || 'неизвестная ошибка'}`;
      }
    }
  }

  const loadListeners = new Map();
  for (const [id,frame] of frames) {
    const listener = () => onLoad(id);
    frame.addEventListener('load',listener);
    loadListeners.set(id,listener);
  }
  window.addEventListener('keynlock:atelier', onAtelierEvent);
  window.addEventListener('keynlock:alchemy:v1', onAlchemyEvent);
  returnButton.addEventListener('click', close);
  return {
    preload, open, close, isOpen: () => opened,
    isReady: id => readyStations.has(id),
    showRestorationInRoom, hideRestorationInRoom, showAlchemyInRoom, hideAlchemyInRoom,
    dispose() {
      clearTimers();
      clearTimeout(atelierStartTimer);
      for (const [id,frame] of frames) {
        frame.removeEventListener('load',loadListeners.get(id));
        frame.src='about:blank';
        if(frame!==firstFrame)frame.remove();
      }
      window.removeEventListener('keynlock:atelier', onAtelierEvent);
      window.removeEventListener('keynlock:alchemy:v1', onAlchemyEvent);
      returnButton.removeEventListener('click', close);
      opened = false;
      rendererHost?.deactivate(station);
    },
  };
}
