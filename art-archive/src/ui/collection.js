import {paintingLocation} from '../player/painting-location.js';
import {createHangingSession} from '../paintings/hanging-session.js';
import {createPaintingInspector} from './painting-inspector.js';
import {createLifecycle} from '../app/lifecycle.js';
import {readJson,writeJson} from '../persistence/storage.js';
import {getLanguage} from '../localization/i18n.js';
import {arrangeExhibition} from '../paintings/exhibition.js';
import {createPaintingDisplay} from '../paintings/display.js';

const STORAGE_KEY = 'keynlock-painting-archive-1500-v1';
export function bindCollection({debugSelection=false,THREE, renderer, world, config, catalog, initialSelection, player, setMode, getMode, elements,notify}) {
  const life = createLifecycle(), dialog = elements('collection-dialog'), frame = elements('curator');
  const label = elements('painting-label'),controls=elements('painting-controls');
  let exhibitionFocus=null;
  const display = createPaintingDisplay({THREE, renderer, world, catalog, config, onAim(slot) {
    if (hanging.active) return;
    exhibitionFocus=slot;
    const en = getLanguage() === 'en';
    const dimensions = slot && [slot.painting.physicalSizeM.width,slot.height]
      .map(m => (m*100).toLocaleString(en ? 'en' : 'ru',{maximumFractionDigits:2})).join(' × ');
    const caption = slot ? [slot.painting.title, slot.painting.artist, dimensions + (en ? ' cm' : ' см'), slot.category, slot.painting.id,slot.destination.split('/')[0]==='center'?(en?'✦ Masterpiece · Central rotunda':'✦ Шедевр · Центральная ротонда'):null].filter(Boolean).join(' · ') : '';
    controls.textContent=slot?(en?'F — inspect · Q — exclude from selection':'F — рассмотреть · Q — исключить из подборки'):'';
    if (label.textContent !== caption) label.textContent = caption;
  }});
  const inspector=createPaintingInspector({elements,catalog,setMode});
  life.own(()=>inspector.dispose());
  const hanging=createHangingSession({debugSelection,THREE,world,config,display,label,controls,notify});
  let exhibition, page = 0, prior = 'intro';
  function refresh() {
    exhibition = arrangeExhibition(catalog, readJson(STORAGE_KEY,initialSelection), world.layout, config.paintings);
    showPage(Math.min(page, exhibition.pageCount - 1));
  }
  function exclude(){
    const slot=hanging.active?hanging.aimed():display.aimedSlot();
    if(!slot)return;
    const id=slot.painting.id,state=readJson(STORAGE_KEY,initialSelection);
    const next={...state,included:{...state.included,[id]:false}};
    const en=getLanguage()==='en';
    if(!writeJson(STORAGE_KEY,next)){notify(en?'Could not save the selection':'Не удалось сохранить отбор');return;}
    const replacement=hanging.active ? exhibition.exclude(id,page) : null;
    const fromWall=hanging.active && slot.floorAngle===undefined;
    const installed=fromWall ? hanging.fillVacancy(slot,replacement) : null;
    if(hanging.active)showPage(Math.min(page,exhibition.pageCount-1));
    else refresh();
    notify([slot.painting.title+(en?' · excluded':' · исключена'),installed && ((en?'On the wall: ':'На стене — ')+installed.painting.title)].filter(Boolean).join(' · '));
  }
  function showPage(value) {
    page = value;
    hanging.setPage(exhibition.slots(page));
    updatePageStatus();
  }
  function updatePageStatus(){
    const en = getLanguage() === 'en';
    elements('selection-status').textContent = en
      ? 'Catalog '+catalog.paintings.length+' · Selected '+exhibition.selected+' · This exhibition '+exhibition.slots(page).length+' · Reserve '+exhibition.reserve+' · Exhibition '+(page+1)+'/'+exhibition.pageCount
      : 'Каталог '+catalog.paintings.length+' · В отборе '+exhibition.selected+' · В этой экспозиции '+exhibition.slots(page).length+' · Резерв '+exhibition.reserve+' · Экспозиция '+(page+1)+'/'+exhibition.pageCount;
    elements('exhibition-prev').disabled = page === 0;
    elements('exhibition-next').disabled = page + 1 === exhibition.pageCount;
  }
  function openEditor() {
    elements('collection-notice').textContent = '';
    prior = getMode(); setMode('pause');
    if (!frame.hasAttribute('src')) frame.src = './catalog/editor/index.html';
    dialog.showModal();
  }
  function locate(id) {
    let slot = exhibition.byId.get(id);
    if (!slot) {
      if (exhibition.reserveReasons.get(id) === 'oversize') {
        const message = getLanguage() === 'en' ? 'The full-size work exceeds this wall. Choose a larger wall in the collection.' :
          'В натуральную величину картина не помещается на этой стене. Можно выбрать другую стену в подборке.';
        if (!dialog.open) openEditor();
        elements('collection-notice').textContent = message;
      }
      return;
    }
    showPage(slot.page);
    slot = hanging.find(id) ?? slot;
    player.reset();
    const view=paintingLocation(slot,world.layout,config,world.camera);
    world.camera.position.set(view.x,view.y,view.z);
    Object.assign(player.state,{floorY:view.floorY,yaw:view.yaw,pitch:view.pitch});
    prior = 'play';
    if (dialog.open) dialog.close();
    setMode('play');
  }
  function switchHanging(value) {
    hanging.setActive(value);
    elements('hanging-toggle').textContent = value ? (getLanguage()==='en'?'View exhibition':'Посмотреть экспозицию') :
      (getLanguage()==='en'?'Hang paintings':'Развешивать картины');
    setMode('play');
  }
  life.listen(elements('hanging-start'),'click',()=>switchHanging(true));
  life.listen(elements('hanging-toggle'),'click',()=>switchHanging(!hanging.active));
  life.listen(elements('collection-open'),'click',openEditor);
  life.listen(elements('collection-close'),'click',()=>dialog.close());
  life.listen(dialog,'close',()=>setMode(prior));
  life.listen(elements('exhibition-prev'),'click',()=>showPage(Math.max(0,page-1)));
  life.listen(elements('exhibition-next'),'click',()=>showPage(Math.min(exhibition.pageCount-1,page+1)));
  life.listen(window,'storage',event=>{if(event.key===STORAGE_KEY || event.key===null) refresh();});
  life.listen(window,'message',event=>{
    if(event.origin!==location.origin || event.source!==frame.contentWindow) return;
    if(event.data?.type==='archive:locate') { refresh(); locate(event.data.id); }
  });
  life.listen(elements('language-btn'),'click',()=>{
    elements('hanging-toggle').textContent=hanging.active ? (getLanguage()==='en'?'View exhibition':'Посмотреть экспозицию') :
      (getLanguage()==='en'?'Hang paintings':'Развешивать картины');
    // Changing interface language must keep the painting in the player's hands.
    updatePageStatus();
  });
  refresh();
  return {syncVisibility:display.syncVisibility,setStyle:display.gouache.setStyle,setEasyMode:display.gouache.setEasyMode,setPigment:display.gouache.setPigment,update(now){display.update(now,hanging.active?hanging.aimed:null);hanging.update(getMode()==='play',now,exhibitionFocus);},wallPick:hanging.wallPick,canRaise:hanging.canRaise,raise:hanging.raise,interact:hanging.interact,drop:hanging.drop,exclude,
    inspect(){inspector.open((hanging.active?hanging.inspectSlot():display.aimedSlot())?.painting);},
    switchHanging,locate,dispose(){life.dispose();hanging.dispose();display.dispose();}};
}
