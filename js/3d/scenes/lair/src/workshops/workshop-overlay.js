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

export function mountWorkshopOverlay({onExit = () => {},onReady = () => {}, rendererHost, inRoomWorkshops} = {}) {
  const overlay = document.querySelector('#workshop-overlay');
  const firstFrame = document.querySelector('#workshop-frame');
  const title = document.querySelector('#workshop-title');
  const external = document.querySelector('#workshop-external');
  const returnButton = document.querySelector('#reset-camera');
  const loader = document.querySelector('#workshop-loading');
  const loadingTitle = document.querySelector('#workshop-loading-title');
  const warning = document.querySelector('#workshop-warning');
  const fallback = document.querySelector('#workshop-fallback');

  // The workbench opens in the frame. The packages manage the in-room workshops.
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
  let warningTimer = null;
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
  }

  function ensureFrame(id) {
    const frame = frames.get(id);
    if (frame && !frame.getAttribute('src')) frame.src = WORKSHOPS[id].url;
  }

  function showCurrentFrame() {
    for(const [id,frame] of frames) {
      const selected = opened && id === workshopId;
      frame.classList.toggle('is-active',selected);
      frame.inert = !selected;
    }
  }

  function setInRoomWorkshopId(id) {
    for (const [workshopId, workshop] of Object.entries(inRoomWorkshops)) {
      workshop.setActive(workshopId === id);
    }
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

  const unsubscribe = Object.entries(inRoomWorkshops).map(([id, workshop]) =>
    workshop.status.subscribe((current, previous) => {
      if (current.ready && !previous?.ready) markReady(id);
    }));
  const loadListeners = new Map();
  for (const [id,frame] of frames) {
    const listener = () => onLoad(id);
    frame.addEventListener('load',listener);
    loadListeners.set(id,listener);
  }
  return {
    preload, open, close, isOpen: () => opened,
    isReady: id => readyWorkshops.has(id),
    setInRoomWorkshopId,
    dispose() {
      clearTimers();
      for (const [id,frame] of frames) {
        frame.removeEventListener('load',loadListeners.get(id));
        frame.src='about:blank';
        if(frame!==firstFrame)frame.remove();
      }
      unsubscribe.forEach(stop => stop());
      opened = false;
      rendererHost?.deactivate(workshopId);
    },
  };
}
