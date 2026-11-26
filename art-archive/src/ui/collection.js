import {createPaintingLabel} from './painting-label.js';
import {showPaintingControls} from './painting-controls.js';
import {createHangingTutorial} from './hanging-tutorial.js';
import {createTutorialGuide} from './tutorial-guide.js';
import {playableSelection} from '../paintings/playable-selection.js';
import {mountedFrame} from '../../catalog/painting-geometry.js';
import {disposalIds,isApprovedKeynlock} from '../paintings/disposal-state.js';
import {paintingLocation} from '../player/painting-location.js';
import {createHangingSession} from '../paintings/hanging-session.js';
import {createLifecycle} from '../app/lifecycle.js';
import {readJson,writeJson} from '../persistence/storage.js';
import {preserveAuthorExclusion} from '../persistence/author-exclusions.js';
import {getLanguage,paintingTitle} from '../localization/i18n.js';
import {arrangeExhibition} from '../paintings/exhibition.js';
import {createPaintingDisplay} from '../paintings/display.js';

const STORAGE_KEY = 'keynlock-painting-archive-1500-v1';
export function bindCollection({debugSelection=false,THREE, renderer, world, config, catalog, initialSelection, player, setMode, getMode, elements,notify,loadingManager,playSound,setSoundMotion,initialHanging=true,onEvent=()=>{}}) {
  const life = createLifecycle(), dialog = elements('collection-dialog'), frame = elements('curator');
  const label = elements('painting-label'),controls=elements('painting-controls');
  const showLabel=createPaintingLabel(label,catalog.paintings);
  const approvedIds=catalog.paintings.filter(isApprovedKeynlock).map(painting=>painting.id);
  let disposalDirty=false,inspectionStart=null;
  const display = createPaintingDisplay({THREE, renderer, world, catalog, config, loadingManager, onAim(slot) {
    if (hanging.active) return;
    const en = getLanguage() === 'en';
    showLabel(slot);
    showPaintingControls(controls,slot?(en?'Hold RMB — inspect':'Удерживайте ПКМ — рассмотреть'):'');
  }});
  const tutorial=createHangingTutorial(elements('tutorial-task'),elements('archive-task'),world.layout,config.paintings,debugSelection,onEvent);
  const guide=createTutorialGuide({THREE,scene:world.scene,settings:config.paintings,camera:world.camera,layout:world.layout,floorElevation:config.building.floorElevation});
  life.own(()=>guide.dispose());
  const hanging=createHangingSession({debugSelection,THREE,world,config,display,renderer,label,showLabel,controls,notify,playSound,setSoundMotion,onMount:tutorial.mounted,onThrow:tutorial.thrown,onEvent,disposalTotal:approvedIds.length,onDisposed(ids){onEvent('painting_disposed',{count:ids.length,paintingIds:ids.slice(0,10).join(',')});disposalDirty=true;if(frame.hasAttribute?.('src'))frame.removeAttribute('src');}});
  let exhibition, currentSlots=[], page = 0, prior = 'intro';
  function refreshTutorial(){tutorial.setPage(hanging.active&&!hanging.freePlacement?currentSlots:[],hanging.find);}
  function refresh(hangingMode=hanging.active) {
    const removed=disposalIds(debugSelection);
    exhibition = arrangeExhibition({...catalog,paintings:catalog.paintings.filter(p=>!removed.has(p.id))}, readJson(STORAGE_KEY,initialSelection), world.layout, config.paintings);
    showPage(Math.min(page, exhibition.pageCount - 1),hangingMode);
  }
  function exclude(){
    const slot=hanging.active?hanging.aimed():display.aimedSlot();
    if(!slot)return;
    const id=slot.painting.id,state=readJson(STORAGE_KEY,initialSelection);
    const next={...state,included:{...state.included,[id]:false}};
    const en=getLanguage()==='en';
    if(!writeJson(STORAGE_KEY,next)){notify(en?'Could not save the selection':'Не удалось сохранить отбор');return;}
    void preserveAuthorExclusion(id).then(saved=>{
      if(saved===false)notify(en?'Excluded in this browser; could not save the project copy':'Исключена в браузере, но не удалось сохранить копию в проекте');
    });
    onEvent('painting_excluded',{paintingId:id});
    const replacement=hanging.active ? exhibition.exclude(id,page) : null;
    const fromWall=hanging.active && mountedFrame(slot);
    const installed=fromWall ? hanging.fillVacancy(slot,replacement) : null;
    if(hanging.active)showPage(Math.min(page,exhibition.pageCount-1));
    else refresh();
    notify([paintingTitle(slot.painting)+(en?' · excluded':' · исключена'),installed && ((en?'On the wall: ':'На стене — ')+paintingTitle(installed.painting))].filter(Boolean).join(' · '));
  }
  function showPage(value,hangingMode=hanging.active) {
    page = value;
    const all=[...exhibition.byId.values()];
    const slots=hangingMode?playableSelection(exhibition.slots(page),all):exhibition.slots(page);
    currentSlots=slots;
    hanging.setPage(slots,all,hangingMode);
    refreshTutorial();
    updateExhibitionControls();
  }
  function updateExhibitionControls(){
    const previous=elements('exhibition-prev'),next=elements('exhibition-next');
    previous.disabled=page===0;next.disabled=page+1===exhibition.pageCount;
    elements('exhibition-controls').hidden=hanging.active||exhibition.pageCount<=1;
    elements('collection-open').hidden=hanging.active;
    elements('hanging-toggle').textContent=hanging.active
      ? (getLanguage()==='en'?'View exhibition':'Посмотреть экспозицию')
      : (getLanguage()==='en'?'Hang paintings':'Развешивать картины');
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
  function switchHanging(value,enter=true) {
    showPage(page,value);
    if(enter)setMode('play');
  }
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
  life.listen(elements('language-select'),'change',()=>{updateExhibitionControls();tutorial.refresh();});
  refresh(initialHanging);
  function update(now){
    const playing=getMode()==='play';
    display.update(now,hanging.active?hanging.aimed:null,playing);
    hanging.update(playing,now);
    tutorial.update(hanging.carriedId,hanging.phase);
    guide.update(tutorial.target(),playing);
    if(disposalDirty){disposalDirty=false;refresh();}
  }
  return {
    carriedId:()=>hanging.carriedId,beginPlaytest:tutorial.beginPlaytest,playtestSnapshot:()=>({...hanging.playtestSnapshot(),tutorial:tutorial.stage,catalogSelected:exhibition.selected}),
    warmUp:display.warmUp,syncVisibility:display.syncVisibility,
    setStyle:display.gouache.setStyle,setEasyMode:display.gouache.setEasyMode,setPigment:display.gouache.setPigment,
    update,wallPick:hanging.wallPick,setPlacementEffect:hanging.setPlacementEffect,
    canSprint:hanging.canSprint,canRaise:hanging.canRaise,raise:hanging.raise,interact:hanging.interact,exclude,
    constrainMovement:hanging.constrainMovement,
    setFreePlacement(value){hanging.setFreePlacement(value);refreshTutorial();},
    aimedId:()=>(hanging.active?hanging.aimed():display.aimedSlot())?.painting.id,
    inspect(value){
      if(!value){
        hanging.setInspecting(false);player.zoom?.(false);
        if(inspectionStart&&performance.now()-inspectionStart.time>=350&&hanging.carriedId===inspectionStart.slot.painting.id)tutorial.inspected(inspectionStart.slot);
        inspectionStart=null;return true;
      }
      const slot=hanging.active?hanging.inspectSlot():display.aimedSlot();
      if(!slot){hanging.setInspecting(false);player.zoom?.(false);inspectionStart=null;return false;}
      hanging.setInspecting(true);player.zoom?.(!hanging.carriedId);
      inspectionStart=hanging.carriedId===slot.painting.id?{slot,time:performance.now()}:null;
      onEvent('painting_inspect',{paintingId:slot.painting.id});return true;
    },
    switchHanging,locate,dispose(){life.dispose();hanging.dispose();display.dispose();}};
}
