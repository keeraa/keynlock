import {createLifecycle} from '../app/lifecycle.js';
import {t,paintingTitle,paintingArtist} from '../localization/i18n.js';
import {logicalKey} from '../player/keys.js';

export function createPaintingInspector({elements,catalog,setMode}) {
  const life = createLifecycle();
  const dialog = elements('art-inspector'), image = elements('inspect-image');
  const viewport = elements('inspect-viewport'), zoom = elements('inspect-zoom'), fit = elements('inspect-fit');
  const defaultView='fit';
  let generation=0,mode=defaultView,layout=defaultView;
  function setView(next) {
    mode = next;
    if(mode!=='actual')layout=mode;
    viewport.classList.toggle('fit-image',mode==='fit');
    viewport.classList.toggle('full-size',mode==='actual');
    fit.setAttribute('aria-pressed',String(mode==='fit'));
    fit.textContent=t(mode==='fit'?'Заполнить экран':'Вписать целиком');
    zoom.setAttribute('aria-pressed',String(mode==='actual'));
    viewport.scrollTo(0,0);
  }
  life.listen(fit,'click',()=>setView(mode==='fit'?'cover':'fit'));
  life.listen(zoom,'click',()=>setView(mode==='actual'?layout:'actual'));
  life.listen(image,'click',()=>setView(mode==='cover'?'fit':'cover'));
  life.listen(elements('inspect-close'),'click',()=>dialog.close());
  life.listen(dialog,'contextmenu',event=>event.preventDefault());
  // Consume the dismissal before the game handles Escape as its pause shortcut.
  life.listen(document,'keydown',event=>{
    if(!dialog.open || !['escape','f'].includes(logicalKey(event)))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(!event.repeat)dialog.close();
  },{capture:true});
  life.listen(dialog,'cancel',event=>{event.preventDefault();dialog.close();});
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
    elements('inspect-title').textContent = [paintingTitle(painting),paintingArtist(painting)].filter(Boolean).join(' · ');
    elements('inspect-original').href = painting.image.detail?.originalUrl || painting.image.hdUrl || high || preview;
    image.alt = paintingTitle(painting);
    image.src = preview;
    setMode('pause');
    setView(defaultView);
    dialog.showModal();
    if (!high) return;
    const source = new Image();
    source.onload = ()=>{
      if (request !== generation) return;
      image.src = high;
    };
    source.src = high;
  }
  return {open,dispose(){generation++;life.dispose();}};
}
