import {createLifecycle} from '../app/lifecycle.js';
import {t} from '../localization/i18n.js';

export function createPaintingInspector({elements,catalog,setMode}) {
  const life = createLifecycle();
  const dialog = elements('art-inspector'), image = elements('inspect-image');
  const viewport = elements('inspect-viewport'), zoom = elements('inspect-zoom'), status = elements('inspect-resolution');
  let generation = 0;
  function setZoom(full) {
    viewport.classList.toggle('full-size',full);
    zoom.setAttribute('aria-pressed',String(full));
    zoom.textContent = full ? t('Вписать целиком') : '1:1';
    viewport.scrollTo(0,0);
  }
  function toggleZoom() { setZoom(!viewport.classList.contains('full-size')); }
  life.listen(zoom,'click',toggleZoom);
  life.listen(image,'click',toggleZoom);
  life.listen(elements('inspect-close'),'click',()=>dialog.close());
  life.listen(dialog,'close',()=>{
    generation++;
    image.removeAttribute('src');
    setMode('play');
  });
  function open(painting) {
    if (!painting || dialog.open) return;
    const request = ++generation;
    const high = catalog.detailUrl(painting.id);
    const preview = catalog.imageUrl(painting.id);
    elements('inspect-title').textContent = [painting.title,painting.artist].filter(Boolean).join(' · ');
    elements('inspect-original').href = painting.image.detail?.originalUrl || painting.image.hdUrl || high || preview;
    const previewSize = painting.image.widthPx + ' × ' + painting.image.heightPx;
    status.textContent = high ? t('Загрузка репродукции…') : t('Эскиз')+' · '+previewSize+' px';
    image.alt = painting.title;
    image.src = preview;
    setMode('pause');
    dialog.showModal();
    setZoom(false);
    if (!high) return;
    const source = new Image();
    source.onload = ()=>{
      if (request !== generation) return;
      image.src = high;
      status.textContent = source.naturalWidth+' × '+source.naturalHeight+' px';
    };
    source.onerror = ()=>{
      if (request === generation) status.textContent = t('Доступен эскиз')+' · '+previewSize+' px';
    };
    source.src = high;
  }
  return {open,dispose(){generation++;life.dispose();}};
}
