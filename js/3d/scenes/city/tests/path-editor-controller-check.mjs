import assert from 'node:assert/strict';
import {createMapEditor} from '../js/path-builder/editor-controller.js';
import {loadBuildings,loadGround,loadLandscape,loadPavingMode} from '../js/path-builder/editor-storage.js';

const values=new Map();
const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
const seen={};
const view={
  stats:stats=>{seen.status=stats.status;},
  paving:mode=>{seen.paving=mode;},
  history:history=>{seen.canUndo=history.canUndo;},
  download:data=>{seen.export=data;},
  tools(){},toast(){},ground(){},selection(){},
};
const scene={
  syncBuildings:buildings=>buildings.map(building=>({...building,width:8,depth:7})),
  setPavingStyle:mode=>{seen.scenePaving=mode;},
  setLandscapePlan(){},setGroundPlan(){},setPathPlan(){},setPathsVisible(){},
  setLandscapeTool(){},setSelected(){},setTrees(){},setTool(){},
  dispose(){seen.sceneDisposed=true;},
};
const layout={paths:[],plazas:[],network:{nodes:[],edges:[]}};
const planner={
  plan:async()=>layout,
  dispose(){seen.plannerDisposed=true;},
};
const editor=createMapEditor({view,storage,planner,
  requestFrame:()=>1,cancelFrame:id=>{seen.cancelledFrame=id;}});
const finishPlan=()=>new Promise(resolve=>setImmediate(resolve));

editor.start(scene);
await finishPlan();
assert.equal(seen.status,'ready');
assert.equal(editor.getState().length,5);

editor.clearMap();
assert.equal(editor.getState().length,0);
assert.deepEqual(loadBuildings(()=>null,storage),[]);
editor.undo();
assert.equal(editor.getState().length,5);
editor.redo();
assert.equal(editor.getState().length,0);

editor.landscapeAction('hill',{x:100,z:50},{hillRadius:8,hillHeight:5});
assert.equal(loadLandscape(storage).landscape.hills.length,1);
editor.undo();
assert.equal(editor.getLandscape().hills.length,0);
editor.redo();
assert.equal(editor.getLandscape().hills.length,1);

editor.setPaving('street');
assert.equal(loadPavingMode(storage),'street');
editor.undo();
assert.equal(seen.paving,'auto');
assert.equal(seen.scenePaving,'auto');
editor.redo();
assert.equal(loadPavingMode(storage),'street');
await finishPlan();
editor.download();
assert.equal(seen.export.landscape.hills.length,1);
assert.deepEqual(seen.export.buildings,[]);

editor.setGroundValue('grass',81,{begin:true});
assert.equal(seen.canUndo,true);
editor.dispose();
assert.equal(seen.cancelledFrame,1);
assert.equal(loadGround(storage).grass,81,'A pending slider edit is saved at teardown');
assert.equal(seen.sceneDisposed,true);
assert.equal(seen.plannerDisposed,true);
console.log('Map editing without a DOM: history, paving, terrain, persistence, export and teardown OK');
