// Persistent editor state and one-time migrations live outside the UI layer.
// Keep the original keys and schema for existing localStorage saves.
import {PATH_BOUNDS} from '../navigation/path-layout.js';
import {normalizeHouseConfig,BUILDING_ATMOSPHERE_DEFAULTS} from '../../modules/house-builder/index.js';
import {MODEL_TYPES} from './model-types.js';
import {resolveGroundSettings} from './ground-art.js';
import {migrateSavedBuildings,migrateSavedLandscape} from './map-resize-migration.js';
import {normalizeLandscape,starterTrees,LANDSCAPE_BOUNDS} from './landscape-model.js';

const STORAGE='keynlock.path-builder.v1';
const PAVING_STORAGE='keynlock.path-builder.paving-mode';
const GROUND_STORAGE='keynlock.path-builder.ground.v1';
const LANDSCAPE_STORAGE='keynlock.path-builder.landscape.v1';
export const MAX_BUILDINGS=300;
const number=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const local=storage=>storage??globalThis.localStorage;
function read(storage,key){
  try{return JSON.parse(local(storage)?.getItem(key)||'null');}catch{return null;}
}
function write(storage,key,value){
  try{local(storage)?.setItem(key,JSON.stringify(value));}catch{}
}

export function normalizeHouseAtmosphere(value={}){
  const result={};
  for(const [key,defaultValue] of Object.entries(BUILDING_ATMOSPHERE_DEFAULTS)){
    const next=value?.[key];
    result[key]=typeof defaultValue==='boolean'?(typeof next==='boolean'?next:defaultValue):
      (Number.isFinite(next)?Math.max(0,Math.min(100,next)):defaultValue);
  }
  return result;
}

export function loadBuildings(fallback,storage){
  try{
    const saved=read(storage,STORAGE);
    if(saved?.version!==1||!Array.isArray(saved.buildings))return fallback();
    const candidates=saved.buildings.slice(0,MAX_BUILDINGS).filter(b=>b&&typeof b==='object');
    return migrateSavedBuildings({...saved,buildings:candidates}).filter(b=>
      typeof b?.id==='string'&&b.id.length<80&&MODEL_TYPES[b.type]&&
      Number.isFinite(b.x)&&Number.isFinite(b.z)&&
      Math.abs(b.x)<=PATH_BOUNDS.maxX&&Math.abs(b.z)<=PATH_BOUNDS.maxZ)
      .map(b=>({id:b.id,type:b.type,x:b.x,z:b.z,rotation:number(b.rotation),
        ...(b.type==='custom-house'?{config:normalizeHouseConfig(b.config),
          atmosphere:normalizeHouseAtmosphere(b.atmosphere)}:{})}));
  }catch{return fallback();}
}
export const saveBuildings=(buildings,storage)=>
  write(storage,STORAGE,{version:1,mapBounds:LANDSCAPE_BOUNDS,buildings});

export const loadGround=(storage)=>resolveGroundSettings(read(storage,GROUND_STORAGE)||{});
export const saveGround=(settings,storage)=>write(storage,GROUND_STORAGE,settings);

export function loadLandscape(storage){
  try{
    const saved=migrateSavedLandscape(read(storage,LANDSCAPE_STORAGE));
    // Existing city maps predate vegetation. An explicit trees:[] means that
    // the player cleared them, so only validate pre-vegetation seeded groves.
    const checkInitialGroves=!Array.isArray(saved?.trees);
    const oldGroves=checkInitialGroves?starterTrees():saved.trees;
    const trees=oldGroves.map(tree=>{
      if(tree.id==='starter-oak-5'&&tree.x===69&&tree.z===10)return {...tree,x:92};
      if(tree.id==='starter-linden-4'&&tree.x===-47&&tree.z===61)return {...tree,z:78};
      if(tree.id==='starter-oak-1'&&tree.x===-84&&tree.z===-27)return {...tree,x:-96};
      return tree;
    });
    return {landscape:normalizeLandscape({...saved,trees}),checkInitialGroves};
  }catch{return {landscape:normalizeLandscape({trees:starterTrees()}),checkInitialGroves:true};}
}
export const saveLandscape=(landscape,storage)=>
  write(storage,LANDSCAPE_STORAGE,{version:1,mapBounds:LANDSCAPE_BOUNDS,...landscape});

export function loadPavingMode(storage){
  try{
    const mode=local(storage)?.getItem(PAVING_STORAGE);
    return ['auto','walk','street'].includes(mode)?mode:null;
  }catch{return null;}
}
export function savePavingMode(mode,storage){
  try{local(storage)?.setItem(PAVING_STORAGE,mode);}catch{}
}
