import {BREAK_CUT,MAX_CUT,DIFFICULTIES,generateBlueprint,SLOT_TYPES,checkSocket} from './logic.js';
import {emptyWearProfile,normalizeWearProfile} from './key-wear.js';

// Keep the existing key so previously saved blanks and assembly progress load.
export const STORAGE_KEY='keynlock-workbench-v3';

function validBlueprint(stored,difficulty){
  return Array.isArray(stored.targets)&&stored.targets.length===difficulty&&
    stored.targets.every(value=>Number.isFinite(value)&&value>0&&value<BREAK_CUT)&&
    Array.isArray(stored.pinOrder)&&stored.pinOrder.length===4&&
    new Set(stored.pinOrder).size===4&&
    stored.pinOrder.every(code=>Number.isInteger(code)&&code>=0&&code<4);
}

export function restoreWorkbenchState(value={}){
  const stored=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const difficulty=DIFFICULTIES.includes(stored.difficulty)?stored.difficulty:4;
  const usesStoredBlueprint=validBlueprint(stored,difficulty);
  const blueprint=usesStoredBlueprint?
    {targets:stored.targets,pinOrder:stored.pinOrder,signature:stored.signature||''}:
    generateBlueprint(difficulty);
  const state={
    mode:'key',difficulty,
    targets:[...blueprint.targets],pinOrder:[...blueprint.pinOrder],signature:blueprint.signature,
    serial:Number.isInteger(stored.serial)&&stored.serial>0?stored.serial:1,
    cuts:usesStoredBlueprint&&Array.isArray(stored.cuts)&&stored.cuts.length===difficulty?
      stored.cuts.map(v=>Number.isFinite(v)?Math.min(MAX_CUT,Math.max(0,v)):0):
      Array(difficulty).fill(0),
    wear:usesStoredBlueprint?normalizeWearProfile(stored.wear):emptyWearProfile(),
    activeCut:0,installed:{},selectedPart:null,
    keyMethod:['imprint','soap'].includes(stored.keyMethod)?stored.keyMethod:'guided',
    keyInspection:null,
    fileOrientation:stored.fileOrientation==='top'?'top':'bottom',
    filing:false,spaceFiling:false,cameraDragging:false,
    lastPointerX:0,lastPointerY:0,drag:null,testing:false,
    blueprint:usesStoredBlueprint&&stored.blueprint===true,
    partGroup:0,warnedOvercut:Array(difficulty).fill(false)
  };
  const validParts=new Set(SLOT_TYPES);
  if(usesStoredBlueprint&&stored.installed&&typeof stored.installed==='object'&&
    !Array.isArray(stored.installed)){
    const used=new Set();
    for(const [socket,id] of Object.entries(stored.installed)){
      if(validParts.has(socket)&&validParts.has(id)&&checkSocket(id,socket)&&!used.has(id)){
        state.installed[socket]=id;used.add(id);
      }
    }
  }
  return state;
}

export function snapshotWorkbenchState(state){
  return {cuts:state.cuts,wear:state.wear,difficulty:state.difficulty,
    targets:state.targets,pinOrder:state.pinOrder,signature:state.signature,
    serial:state.serial,installed:state.installed,blueprint:state.blueprint,
    keyMethod:state.keyMethod,fileOrientation:state.fileOrientation};
}

export function loadWorkbenchState(storage){
  let saved={};
  try{saved=JSON.parse((storage??globalThis.localStorage)?.getItem(STORAGE_KEY)||'{}');}catch{}
  return restoreWorkbenchState(saved);
}

export function saveWorkbenchState(state,storage){
  try{(storage??globalThis.localStorage)?.setItem(STORAGE_KEY,
    JSON.stringify(snapshotWorkbenchState(state)));return true;}
  catch{return false;}
}

export function resetBlankState(state,difficulty=state.difficulty){
  const blueprint=generateBlueprint(difficulty,state.signature);
  state.difficulty=blueprint.difficulty;state.targets=blueprint.targets;
  state.pinOrder=blueprint.pinOrder;state.signature=blueprint.signature;
  state.serial++;state.cuts=Array(state.difficulty).fill(0);
  state.wear=emptyWearProfile();state.keyInspection=null;
  state.warnedOvercut=Array(state.difficulty).fill(false);
  state.installed={};state.blueprint=false;state.partGroup=0;
  state.activeCut=0;state.selectedPart=null;state.drag=null;
  return state;
}
