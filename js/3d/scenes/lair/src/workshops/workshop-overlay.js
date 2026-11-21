import { t } from '../i18n.js';
/**
 * Coordinate the original KEYNLOCK workshops from the Lair.
 *
 * Atelier and alchemy mount their original interfaces inside this document;
 * the workbench opens in an embedded page.
 */
export const WORKSHOPS = Object.freeze({
  atelier: {
    title: t('Реставрация'),
    sourceUrl: 'https://atelier-restoration-1115.k1r11111.chatgpt.site/',
  },
  workbench: {
    title: t('Верстак'),
    url: '/stations/workbench/',
    sourceUrl: 'https://keynlock-workbench-1116.k1r11111.chatgpt.site/',
  },
  alchemy: {
    title: t('Алхимия'),
    sourceUrl: 'https://keynlock-alchemy-lab-1115.k1r11111.chatgpt.site/',
  },
});

export function mountWorkshopOverlay({onExit = () => {},onReady = () => {},rendererHost} = {}) {
  const overlay = document.querySelector('#workshop-overlay');
  const firstFrame = document.querySelector('#workshop-frame');
  const title = document.querySelector('#workshop-title');
  const external = document.querySelector('#workshop-external');
  const returnButton = document.querySelector('#workshop-return');
  const loader = document.querySelector('#workshop-loading');
  const loadingTitle = document.querySelector('#workshop-loading-title');
  const warning = document.querySelector('#workshop-warning');
  const fallback = document.querySelector('#workshop-fallback');

  // The Atelier and the laboratory are mounted directly in the room
  // (atelier-in-room.js, alchemy-in-room.js); only the workbench, which is
  // still developed separately, opens as an embedded page.
  const frames = new Map();
  const readyWorkshops = new Set();
  const names = ['workbench'];
  for (const [index,id] of names.entries()) {
    const frame = index === 0 ? firstFrame : firstFrame.cloneNode(false);
    if (index) {
      frame.removeAttribute('id');
      firstFrame.parentElement.insertBefore(frame,firstFrame.nextSibling);
    }
    frame.classList.add('workshop-frame');
    frame.dataset.workshop = id;
    frame.title = t('KEYNLOCK — оригинальная мастерская «{title}»', { title: WORKSHOPS[id].title });
    frame.inert = true;
    frames.set(id,frame);
  }
  let workshopId = null;
  let opened = false;
  let inRoomWorkshop = null;
  let warningTimer = null;
  let atelierStartTimer = null;
  let atelierFailure = null;

  // Loading artwork is independent of using the correction panel. A failed
  // dynamic import must also be visible instead of leaving a permanent veil.
  function showAtelierFailure(message) {
    if (readyWorkshops.has('atelier')) return;
    atelierFailure = message || t('Редактор не завершил запуск');
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
      reload.textContent = t('ПОВТОРИТЬ ЗАПУСК');
      reload.addEventListener('click', () => window.location.reload());
      status.append(description,reload);
      atelier.appendChild(status);
    }
    status.firstElementChild.textContent = t('Реставрация не запустилась: {reason}', { reason: atelierFailure });
    showCurrentFrame();
  }

  function clearTimers() {
    clearTimeout(warningTimer);
    warningTimer = null;
  }

  function markReady(id) {
    const wasReady = readyWorkshops.has(id);
    readyWorkshops.add(id);
    if (opened && workshopId === id) {
      overlay.classList.add('workshop-ready');
      loader.setAttribute('aria-busy', 'false');
      warning.hidden = true;
      fallback.hidden = true;
      clearTimeout(warningTimer);
    }
    if (!wasReady) onReady(id);
    if (id === 'atelier') {
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
    if (frame && !frame.getAttribute('src')) frame.src = WORKSHOPS[id].url;
  }

  function showCurrentFrame() {
    const atelierInRoom = inRoomWorkshop === 'atelier';
    const alchemyInRoom = inRoomWorkshop === 'alchemy';
    for(const [id,frame] of frames) {
      const selected = opened && id === workshopId;
      frame.classList.toggle('is-active',selected);
      frame.inert = !selected;
    }
    const atelier = document.querySelector('#atelier-embedded-app');
    if (atelier) {
      atelier.classList.toggle('is-active',atelierInRoom);
      const controlsReady = readyWorkshops.has('atelier');
      atelier.classList.toggle('controls-ready',controlsReady);
      // The original range inputs respond while images/materials stream. They
      // must remain available if optional startup work fails.
      atelier.inert = !atelierInRoom;
    }
    const alchemy = document.querySelector('#alchemy-embedded-app');
    if (alchemy) {
      alchemy.classList.toggle('is-active',alchemyInRoom);
      alchemy.inert = !alchemyInRoom;
    }
    document.querySelector('#alchemy-input-plane')?.classList.toggle('is-active',alchemyInRoom);
  }

  function setInRoomWorkshopId(id) {
    if (inRoomWorkshop === 'atelier' && id !== 'atelier') {
      const atelier = document.querySelector('#atelier-embedded-app');
      atelier?.querySelector('#collection-modal:not([hidden]) #collection-close')?.click();
      atelier?.classList.remove('collection-expanded');
    }
    inRoomWorkshop = id;
    showCurrentFrame();
  }

  function preload(id) {
    const next = WORKSHOPS[id];
    if (!next) return;
    if (id === 'atelier' || id === 'alchemy') return;
    clearTimers();
    workshopId = id;
    overlay.classList.remove('workshop-ready');
    loader.setAttribute('aria-busy', 'true');
    title.textContent = next.title.toUpperCase();
    loadingTitle.textContent = t('ЗАГРУЖАЕМ ОРИГИНАЛЬНУЮ МАСТЕРСКУЮ');
    external.href = next.sourceUrl;
    external.hidden = id === 'atelier';
    fallback.href = next.sourceUrl;
    warning.hidden = true;
    fallback.hidden = true;
    ensureFrame(id);
  }

  function open(id) {
    if (!WORKSHOPS[id]) return;
    if (id === 'atelier' || id === 'alchemy') return;
    if (workshopId !== id) preload(id);
    opened = true;
    overlay.dataset.workshop = id;
    if (id !== 'alchemy') rendererHost?.activate(id);
    overlay.classList.add('workshop-open');
    overlay.setAttribute('aria-hidden', 'false');
    showCurrentFrame();
    ensureFrame(id);
    if (readyWorkshops.has(id)) markReady(id);
    warningTimer = setTimeout(() => {
      if (!opened || readyWorkshops.has(id) || workshopId!==id) return;
      warning.hidden = false;
      fallback.hidden = false;
    }, 11000);
    returnButton.focus({preventScroll: true});
  }

  function close() {
    if (!opened) return;
    opened = false;
    overlay.classList.remove('workshop-open');
    overlay.setAttribute('aria-hidden', 'true');
    showCurrentFrame();
    clearTimers();
    rendererHost?.deactivate(workshopId);
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
    if (type === 'ready') markReady('atelier');
    if (type === 'mounted') {
      clearTimeout(atelierStartTimer);
      atelierStartTimer = setTimeout(() => {
        if (!readyWorkshops.has('atelier')) showAtelierFailure(t('превышено время ожидания'));
      }, 12000);
    }
    if (type === 'collection-open') {
      document.querySelector('#atelier-embedded-app')?.classList.toggle('collection-expanded',Boolean(open));
    }
    if (type === 'error') {
      console.error('Исходное ателье не готово:',event.detail?.message || 'Неизвестная ошибка');
      showAtelierFailure(event.detail?.message || t('ошибка запуска'));
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
        failure.textContent = t('Ошибка лаборатории: {reason}', { reason: event.detail.message || t('неизвестная ошибка') });
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
    isReady: id => readyWorkshops.has(id),
    setInRoomWorkshopId,
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
      rendererHost?.deactivate(workshopId);
    },
  };
}
