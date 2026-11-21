import {validateBuildingPlacement} from '../navigation/path-layout.js';
import {createRoadRecalculation} from './road-recalculation.js';
import {simplifyRiverPoints} from './river-brush.js';
import {MODEL_TYPES} from './model-types.js';
import {normalizeHouseConfig} from '../../modules/house-builder/index.js';
import {resolveGroundSettings} from './ground-art.js';
import {MAX_BUILDINGS,normalizeHouseAtmosphere,loadBuildings,saveBuildings,loadGround,saveGround,
  loadLandscape,saveLandscape,loadPavingMode,savePavingMode} from './editor-storage.js';
import {normalizeLandscape,landscapePlacementCheck,riverIntersectsBuildings,
  riverIntersectsTrees,treePlacementCheck,starterTrees,TREE_KINDS,
  findRiverForBridge,bridgeProfiles,landscapeEraseTarget,exampleLandscape,
  LANDSCAPE_BOUNDS,LANDSCAPE_LIMITS} from './landscape-model.js';
import {createEditorHistory} from './editor-history.js';
import {addAutomaticRiverBridges} from './auto-bridges.js';
import {addAutomaticChannelBridges} from './auto-channel-bridges.js';

const demo=()=>[
  {id:'sample-a',type:'house',x:-33,z:-7,rotation:0},
  {id:'sample-b',type:'townhouse',x:-13,z:16,rotation:Math.PI},
  {id:'sample-c',type:'workshop',x:22,z:16,rotation:0},
  {id:'sample-d',type:'church',x:13,z:-19,rotation:0},
  {id:'sample-e',type:'house',x:-34,z:20,rotation:Math.PI/2},
];
const clone=items=>items.map(item=>({...item}));
// Owns map state and editing commands. The view and the 2D/3D scene are adapters.
export function createMapEditor({view,storage,planner,
  requestFrame=callback=>globalThis.requestAnimationFrame(callback),
  cancelFrame=id=>globalThis.cancelAnimationFrame(id),
}){
  let buildings=loadBuildings(demo,storage),selected=null,tool=null,terrainTool=null,layout=null,spatial=[];
  let {landscape,checkInitialGroves}=loadLandscape(storage);
  let groundSettings=loadGround(storage);
  let pavingMode=loadPavingMode(storage)||'auto',pathsVisible=true;
  let houseDraft=null,houseAtmosphereDraft=null;
  let scene=null,movingId=null,moveStart=null,counter=0,groundFrame=0;
  const history=createEditorHistory();
  const roads=createRoadRecalculation({
    planner,
    apply:applyRoadLayout,
    onStatusChange({error}){
      if(error)console.error('Path calculation failed:',error);
      renderStats();
    },
  });
  function persist(){
    saveBuildings(buildings,storage);
  }
  function persistGround(){
    saveGround(groundSettings,storage);
  }
  function persistLandscape(){
    saveLandscape(landscape,storage);
  }
  function refreshGround(){
    if(groundFrame){cancelFrame(groundFrame);groundFrame=0;}
    if(layout)scene?.setGroundPlan(spatial,layout,groundSettings,pavingMode,landscape);
    persistGround();
  }
  function scheduleGround(){
    if(!groundFrame)groundFrame=requestFrame(()=>{
      groundFrame=0;refreshGround();
    });
  }
  function snapshot(){
    return {buildings,landscape,groundSettings,pavingMode};
  }
  function refreshHistoryButtons(){
    view.history({canUndo:history.canUndo,canRedo:history.canRedo});
  }
  function checkpoint(){
    history.record(snapshot());refreshHistoryButtons();
  }
  const toast=message=>view.toast(message);
  function setSelected(id){
    selected=buildings.some(item=>item.id===id)?id:null;
    scene?.setSelected(selected);renderSelection();
  }
  function setTool(type){
    scene?.cancelInteraction?.();
    terrainTool=null;scene?.setLandscapeTool(null);
    tool=MODEL_TYPES[type]?type:null;
    scene?.setTool(tool,tool==='custom-house'?houseDraft:null,
      tool==='custom-house'?houseAtmosphereDraft:null);
    view.tools(tool,terrainTool);
  }
  function setTerrainTool(mode){
    scene?.cancelInteraction?.();
    tool=null;scene?.setTool(null);terrainTool=terrainTool===mode?null:mode;
    scene?.setLandscapeTool(terrainTool);
    view.tools(tool,terrainTool);
  }
  function renderSelection(){
    view.selection(buildings.find(item=>item.id===selected),spatial.find(item=>item.id===selected));
  }
  function renderStats(){
    view.stats({buildings,landscape,layout,status:roads.status});
    renderSelection();
  }
  function rebuild({animate=false,save=true,autoBridges=false}={}){
    if(!scene)return;
    spatial=scene.syncBuildings(buildings);
    if(autoBridges){
      landscape=addAutomaticRiverBridges(landscape,spatial,layout?.paths||[]);
      landscape=addAutomaticChannelBridges(landscape,spatial);
    }
    scene.setLandscapePlan(landscape,spatial);
    scene.setPavingStyle(pavingMode);
    if(save){persist();persistLandscape();}
    roads.recalculate(spatial,{landscape,animate,save});
  }
  function applyRoadLayout(next,{animate,save}){
    if(checkInitialGroves){
      const accepted=[];
      for(const candidate of landscape.trees)
        if(treePlacementCheck({...landscape,trees:accepted},candidate,spatial,next).valid)
          accepted.push(candidate);
      landscape=normalizeLandscape({...landscape,trees:accepted});
      scene.setTrees(landscape.trees);
      checkInitialGroves=false;
      if(save)persistLandscape();
    }
    scene.setGroundPlan(spatial,next,groundSettings,pavingMode,landscape);
    scene.setPathPlan(next,{animate,landscape});
    scene.setPathsVisible(pathsVisible);
    layout=next;
  }
  function updateTrees(){
    scene?.setTrees(landscape.trees);
    renderStats();persistLandscape();
  }
  function isValid(candidate){
    return validateBuildingPlacement(candidate,spatial).valid&&landscapePlacementCheck(landscape,candidate).valid;
  }
  function place(candidate){
    if(buildings.length>=MAX_BUILDINGS){toast(`На одном участке максимум ${MAX_BUILDINGS} зданий`);return;}
    const check=validateBuildingPlacement(candidate,spatial);
    if(!check.valid){toast(check.reason);return;}
    const site=landscapePlacementCheck(landscape,candidate);
    if(!site.valid){toast(site.reason);return;}
    checkpoint();
    const id=`object-${Date.now().toString(36)}-${(++counter).toString(36)}`;
    buildings.push({id,type:candidate.type,x:candidate.x,z:candidate.z,rotation:0,
      ...(candidate.type==='custom-house'?{config:normalizeHouseConfig(candidate.config||houseDraft),
        atmosphere:normalizeHouseAtmosphere(candidate.atmosphere||houseAtmosphereDraft)}:{})});
    rebuild({autoBridges:true});setSelected(id);
    toast('Здание добавлено — дорожки перестроены');
  }
  function move(id,x,z){
    const item=buildings.find(b=>b.id===id);
    if(!item||item.x===x&&item.z===z)return false;
    const descriptor=scene.describeExisting(id,{...item,x,z});
    if(!descriptor)return false;
    const result=validateBuildingPlacement(descriptor,spatial);
    if(!result.valid||!landscapePlacementCheck(landscape,descriptor).valid)return false;
    const firstMove=movingId!==id;
    if(firstMove){moveStart=structuredClone(snapshot());movingId=id;}
    item.x=x;item.z=z;
    // Only move the existing 3D transform during drag. A* and atlas painting
    // on every pointer event were freezing the large city map for seconds.
    scene.previewMove(id,item);
    return true;
  }
  function endMove(){
    if(!movingId)return;movingId=null;
    if(moveStart){history.record(moveStart);moveStart=null;refreshHistoryButtons();}
    rebuild({autoBridges:true});
  }
  function cancelMove(){
    if(!movingId)return;
    if(moveStart)buildings=moveStart.buildings;
    movingId=null;moveStart=null;rebuild({animate:false});
  }
  function rotate(){
    const item=buildings.find(b=>b.id===selected);if(!item)return;
    const next={...item,rotation:((Math.round(item.rotation/(Math.PI/2))+1)%4)*(Math.PI/2)};
    const descriptor=scene.describeExisting(item.id,next);
    const check=validateBuildingPlacement(descriptor,spatial);
    const site=landscapePlacementCheck(landscape,descriptor);
    if(!check.valid||!site.valid){toast(check.valid?site.reason:check.reason);return;}
    checkpoint();item.rotation=next.rotation;rebuild();toast('Поворот изменён — дорожки перестроены');
  }
  function remove(){
    if(!selected)return;
    checkpoint();buildings=buildings.filter(b=>b.id!==selected);selected=null;
    rebuild();scene.setSelected(null);toast('Здание удалено');
  }
  function restoreSnapshot(previous){
    if(!previous)return false;
    buildings=previous.buildings;landscape=previous.landscape;
    groundSettings=previous.groundSettings;
    pavingMode=previous.pavingMode;
    view.ground(groundSettings);view.paving(pavingMode);savePavingMode(pavingMode,storage);
    movingId=null;moveStart=null;setSelected(null);rebuild();persistGround();refreshHistoryButtons();
    return true;
  }
  function undo(){
    if(movingId){scene?.cancelInteraction?.();return;}
    scene?.cancelInteraction?.();
    if(restoreSnapshot(history.undo(snapshot())))toast('Действие отменено');
  }
  function redo(){
    scene?.cancelInteraction?.();
    if(restoreSnapshot(history.redo(snapshot())))toast('Действие повторено');
  }
  function replace(next){
    checkpoint();buildings=clone(next);selected=null;movingId=null;moveStart=null;
    setTool(null);rebuild({autoBridges:true});scene.setSelected(null);
  }
  function download(){
    const currentLayout=roads.status==='ready'?layout:null;
    const payload={schema:'keynlock.path-layout',version:2,
      mapBounds:LANDSCAPE_BOUNDS,
      buildings:clone(buildings),paths:currentLayout?.paths||[],
      forecourts:currentLayout?.plazas||[],ground:{...groundSettings},landscape:structuredClone(landscape),
      graph:{nodes:currentLayout?.network.nodes.length||0,edges:currentLayout?.network.edges.length||0}};
    view.download(payload);
  }

  const nextId=prefix=>`${prefix}-${Date.now().toString(36)}-${(++counter).toString(36)}`;
  function eraseBridge(id){
    const removed=landscape.bridges.find(bridge=>bridge.id===id)||
      landscape.channelBridges.find(bridge=>bridge.id===id);
    if(!removed)return;
    checkpoint();landscape=normalizeLandscape({...landscape,
      bridges:landscape.bridges.filter(bridge=>bridge.id!==id),
      channelBridges:landscape.channelBridges.filter(bridge=>bridge.id!==id),
      autoBridgeOptOut:removed.auto&&removed.riverId?
        [...landscape.autoBridgeOptOut,removed.riverId]:landscape.autoBridgeOptOut,
      autoChannelOptOut:removed.channel&&removed.auto?
        [...landscape.autoChannelOptOut,{x:removed.x,z:removed.z}]:landscape.autoChannelOptOut});
    rebuild({animate:false});toast('Мост удалён · русло сохранено');
  }
  function landscapeStroke(points,{riverWidth,riverDepth}){
    if(points.length<2||points.slice(1).reduce((length,p,i)=>length+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0)<7){
      toast('Проведи русло длиной хотя бы 7 метров');return;
    }
    if(landscape.rivers.length>=LANDSCAPE_LIMITS.rivers){toast('Достигнут лимит рек для одной карты');return;}
    // Preserve sharp turns and both endpoints, while removing brush jitter.
    const smoothPoints=simplifyRiverPoints(points,.55);
    const river={id:nextId('river'),width:riverWidth,depth:riverDepth,points:smoothPoints};
    if(riverIntersectsBuildings(landscape,river,spatial)){
      toast('Русло пересекает здание — проведи его в стороне');return;
    }
    if(riverIntersectsTrees(river,landscape.trees)){
      toast('Русло пересекает деревья — сначала освободи берег');return;
    }
    checkpoint();landscape=normalizeLandscape({...landscape,rivers:[...landscape.rivers,river]});
    const previousBridges=landscape.bridges.length+landscape.channelBridges.length;
    rebuild({animate:false,autoBridges:true});
    toast(landscape.bridges.length+landscape.channelBridges.length>previousBridges?
      'Река нарисована · мост добавлен автоматически':'Река нарисована');
  }
  function landscapeAction(mode,at,{hillRadius,hillHeight}){
    if(mode.startsWith('tree-')){
      const kind=mode.slice(5);
      if(!TREE_KINDS.includes(kind))return;
      if(landscape.trees.length>=LANDSCAPE_LIMITS.trees){toast('Достигнут лимит деревьев');return;}
      const tree={id:nextId('tree'),kind,x:at.x,z:at.z,
        size:.9+(Math.abs(Math.round(at.x*31+at.z*17))%25)/100};
      const check=treePlacementCheck(landscape,tree,spatial,layout);
      if(!check.valid){toast(check.reason);return;}
      checkpoint();landscape=normalizeLandscape({...landscape,trees:[...landscape.trees,tree]});
      updateTrees();toast('Дерево посажено');return;
    }
    if(mode==='hill'){
      if(landscape.hills.length>=LANDSCAPE_LIMITS.hills){toast('Достигнут лимит рельефа для одной карты');return;}
      checkpoint();landscape=normalizeLandscape({...landscape,hills:[...landscape.hills,
        {id:nextId('hill'),x:at.x,z:at.z,radius:hillRadius,height:hillHeight}]});
      rebuild({animate:false});toast('Возвышенность добавлена · дома и дорожки согласованы с рельефом');
      return;
    }
    if(mode==='bridge'){
      if(landscape.bridges.length>=LANDSCAPE_LIMITS.bridges){toast('Достигнут лимит мостов для одной карты');return;}
      const crossing=findRiverForBridge(landscape,at.x,at.z);
      if(!crossing){toast('Нажми на реку вдали от края карты');return;}
      const existing=bridgeProfiles(landscape).some(bridge=>bridge.riverId===crossing.riverId&&
        Math.hypot(bridge.x-at.x,bridge.z-at.z)<bridge.deckWidth+3);
      if(existing){toast('Здесь уже есть мост');return;}
      checkpoint();landscape=normalizeLandscape({...landscape,
        bridges:[...landscape.bridges,{id:nextId('bridge'),...crossing}]});
      rebuild({animate:false});toast('Каменный мост построен по ширине реки');return;
    }
    if(mode==='erase'){
      const target=landscapeEraseTarget(landscape,at.x,at.z);
      if(target?.type==='bridge'){eraseBridge(target.id);return;}
      if(target?.type==='tree'){
        checkpoint();landscape=normalizeLandscape({...landscape,
          trees:landscape.trees.filter(item=>item.id!==target.id)});
        updateTrees();toast('Дерево убрано');return;
      }
      if(target?.type==='hill'){checkpoint();landscape=normalizeLandscape({...landscape,
        hills:landscape.hills.filter(item=>item.id!==target.id)});
        rebuild({animate:false});toast('Возвышенность удалена');return;}
      if(target?.type==='river'){checkpoint();landscape=normalizeLandscape({...landscape,
        rivers:landscape.rivers.filter(item=>item.id!==target.id),
        bridges:landscape.bridges.filter(item=>item.riverId!==target.id)});
        rebuild({animate:false});toast('Река и её мосты удалены');return;}
      toast('Рядом нет объекта ландшафта');
    }
  }

  function loadLandscapeDemo(){
    const sample=exampleLandscape();
    if(riverIntersectsBuildings(sample,sample.rivers[0],spatial)){
      toast('Пример реки пересекает здания — освободи центральную полосу');return;
    }
    checkpoint();landscape=sample;rebuild({animate:false});
    toast('Река, холмы и каменный мост добавлены');
  }
  function clearLandscape(){
    if(!landscape.rivers.length&&!landscape.hills.length&&
      !landscape.bridges.length&&!landscape.channelBridges.length)return;
    checkpoint();landscape=normalizeLandscape({trees:landscape.trees,
      autoChannelOptOut:[...landscape.autoChannelOptOut,
        ...landscape.channelBridges.filter(bridge=>bridge.auto).map(({x,z})=>({x,z}))]});
    rebuild({animate:false});
    toast('Рельеф очищен · застройка сохранена');
  }
  function plantGrove(){
    let next=[...landscape.trees],added=0;
    for(const candidate of starterTrees()){
      if(next.length>=LANDSCAPE_LIMITS.trees)break;
      if(treePlacementCheck({...landscape,trees:next},candidate,spatial,layout).valid){
        next.push(candidate);added++;
      }
    }
    if(!added){toast('Все деревья рощи уже посажены');return;}
    checkpoint();landscape=normalizeLandscape({...landscape,trees:next});
    updateTrees();toast(`Посажено ${added} деревьев трёх видов`);
  }
  function clearTrees(){
    if(!landscape.trees.length)return;
    checkpoint();landscape=normalizeLandscape({...landscape,trees:[]});
    updateTrees();toast('Деревья убраны · здания и рельеф сохранены');
  }

  function setHouseDraft(blueprint,atmosphere){
    houseDraft=normalizeHouseConfig(blueprint?.params);
    houseAtmosphereDraft=normalizeHouseAtmosphere(atmosphere);
    setSelected(null);setTool('custom-house');
    toast('Дом готов · нажми на карте, чтобы поставить его');
  }
  function setPaving(next){
    checkpoint();
    pavingMode=next;
    scene?.setPavingStyle(pavingMode);
    refreshGround();
    savePavingMode(pavingMode,storage);
  }
  function setGroundDistrict(district){
    checkpoint();
    groundSettings=resolveGroundSettings({district});
    view.ground(groundSettings);refreshGround();
  }
  function setGroundValue(key,value,{begin}){
    if(begin)checkpoint();
    groundSettings=resolveGroundSettings({...groundSettings,[key]:value});
    scheduleGround();
  }
  return {
    start(nextScene,{pathsVisible:showPaths=true}={}){
      scene=nextScene;
      pathsVisible=showPaths;
      view.ground(groundSettings);view.paving(pavingMode);
      rebuild({autoBridges:true});
    },
    isValid,place,move,endMove,cancelMove,setSelected,landscapeStroke,landscapeAction,eraseBridge,
    loadLandscapeDemo,clearLandscape,plantGrove,clearTrees,rotate,remove,undo,redo,download,
    setPaving,setGroundDistrict,setGroundValue,setHouseDraft,
    toggleBuildingTool(type){setTool(tool===type?null:type);},
    setTerrainTool,
    loadDemo(){replace(demo());toast('Пример застройки загружен');},
    clearMap(){if(buildings.length){replace([]);toast('Участок очищен. Можно отменить действие.');}},
    exitTool(){setTool(null);},
    setPathsVisible(value){pathsVisible=value;scene?.setPathsVisible(value);},
    setGridVisible(value){scene?.setGridVisible(value);},
    setView(value){scene?.setView(value);},
    setActive(value){scene?.setActive(value);},
    dispose(){
      roads.dispose();
      if(groundFrame){
        cancelFrame(groundFrame);
        groundFrame=0;
        persistGround();
      }
      scene?.dispose();
      scene=null;
    },
    get selected(){return selected;},
    getState:()=>clone(buildings),
    getLandscape:()=>structuredClone(landscape),
    getLayout:()=>layout,
    getMetrics:()=>({buildings:buildings.length,connections:layout?.connected||0,
      junctions:layout?.junctions||0,length:layout?.length||0}),
    getMode:()=>scene?.mode||'unknown',
  };
}
