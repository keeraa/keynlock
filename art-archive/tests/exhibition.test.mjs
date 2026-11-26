import {migrateExhibitionDestination} from '../catalog/hall-taxonomy.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {sceneCatalog} from '../catalog/load-catalog.js';
import {makeLayout} from '../src/architecture/layout.js';
import {arrangeExhibition} from '../src/paintings/exhibition.js';
const json=async path=>JSON.parse(await fs.readFile(new URL(path,import.meta.url)));
const manifestUrl=new URL('../catalog/manifest.json',import.meta.url);
const catalog=sceneCatalog(await json(manifestUrl),manifestUrl);
const seed=await json('../catalog/initial-selection.json');
const config=await json('../config/scene.json');
const arrange=state=>arrangeExhibition(catalog,state,makeLayout(config),config.paintings);

test('every selected non-reserve painting has a reachable page, local WebP and bounded placement',async()=>{
 const result=arrange(seed);
 assert.equal(result.selected,catalog.paintings.length);
 assert.equal(result.byId.size + result.reserve, result.selected);
 assert(result.byId.size > catalog.paintings.length * .85);
 const images=new Set(await fs.readdir(new URL('../catalog/images/',import.meta.url)));
 for(const p of catalog.paintings)assert(images.has(new URL(catalog.imageUrl(p.id)).pathname.split('/').at(-1)));
 for(const [id,slot] of result.byId){
  assert(result.slots(slot.page).includes(slot),id);
  if(slot.floorAngle!==undefined){
   const table=makeLayout(config).storageTables.find(t=>t.id===slot.supportId);
   assert.equal(slot.painting.collection,'keynlock');
   assert(table);
   assert.equal(slot.y,table.y+config.paintings.frameDepthM/2);
   continue;
  }
  const halfHeight=slot.height/2+config.paintings.frameWidthM;
  assert(slot.y+halfHeight<=config.paintings.maxTopM+1e-8);
  assert(slot.y-halfHeight>=config.paintings.minBottomM-1e-8);
  assert.equal(slot.height,slot.painting.physicalSizeM.height);
  assert.equal(slot.width,slot.painting.physicalSizeM.width+2*config.paintings.frameWidthM);
  assert(slot.width<=slot.wall.length);
 }
});
test('deselect, move and edit category by stable ID without mutating catalog',()=>{
 const id='ART-0001';
 assert.equal(arrange({included:{[id]:false}}).byId.has(id),false);
 const result=arrange({placements:{[id]:'center/master'},categories:{[id]:'Тест'}});
 assert.equal(result.byId.get(id).wall.hall,'center');
 assert.equal(result.byId.get(id).category,'Тест');
 assert.equal(catalog.get(id).placement.hall,'portraits');
 assert.equal(arrange({included:Object.fromEntries(catalog.paintings.map(p=>[p.id,false]))}).slots(0).length,0);
});
test('editor JSON import replaces the previous subset and keeps explicit placement and category',async()=>{
 const {runInNewContext}=await import('node:vm');
 const source=await fs.readFile(new URL('../catalog/editor/import-export.js',import.meta.url),'utf8');
 const state={included:{},placements:{},categories:{},subjects:{}};
 const context={migrateExhibitionDestination,data:catalog.paintings,validIds:new Set(catalog.paintings.map(p=>p.id)),state,
   gameWallLabels:new Set(['nature/water']),SUBJECTS:[],UNKNOWN_SUBJECT:'?',PAGE_SIZE:60,max:60,save(){},render(){}};
 const load=runInNewContext(source+'\nimportSelection',context);
 async function restore(payload){return load({text:async()=>JSON.stringify(payload)});}
 await restore({paintings:[{id:'ART-0001',category:'Тест',game_hall:'nature',game_wall:'water'}]});
 let exhibition=arrange(state);
 assert.equal(exhibition.selected,1);assert.equal(exhibition.byId.get('ART-0001').category,'Тест');
 assert.equal(exhibition.byId.get('ART-0001').destination,'nature/water');
 await assert.rejects(restore({paintings:[{id:'unknown'}]}));assert.equal(arrange(state).selected,1);
 await restore({selected_ids:['ART-0002']});exhibition=arrange(state);assert.equal(exhibition.selected,1);
 assert(!exhibition.byId.has('ART-0001'));assert.equal(Object.keys(state.categories).length,0);
 await restore({paintings:[]});assert.equal(arrange(state).selected,0);
});

test('original-size frames have guaranteed gaps on all three rows and every exhibition page',()=>{
 const result=arrange(seed), settings=config.paintings;
 assert.equal(settings.tiers,3);
 for(let i=0;i<result.pageCount;i++){
  const slots=result.slots(i).filter(slot=>!slot.supportId);
  assert(slots.every(slot=>slot.tier>=1 && slot.tier<=settings.tiers));
  for(let a=0;a<slots.length;a++)for(let b=a+1;b<slots.length;b++){
   const left=slots[a],right=slots[b];
   if(left.wall.hall!==right.wall.hall || left.normal.x!==right.normal.x || left.normal.z!==right.normal.z)continue;
   const horizontal=Math.hypot(left.x-right.x,left.z-right.z)-(left.width+right.width)/2;
   const vertical=Math.abs(left.y-right.y)-(left.height+right.height)/2-2*config.paintings.frameWidthM;
   assert(horizontal>=settings.horizontalGapM-1e-7 || vertical>=settings.verticalGapM-1e-7,left.painting.id+' '+right.painting.id);
  }
 }

 for(const [id,reason] of result.reserveReasons){
  const p=catalog.get(id);
  if(reason==='unmeasured')assert.equal(p.physicalSizeM,null);
  if(reason==='image')assert.equal(p.image.sizeMatch,'needs_review');
  assert(!result.byId.has(id));
 }
});

test('miniatures hang in low pairs and frames sit against the plaster face',()=>{
 const result=arrange(seed),s=config.paintings, page=result.slots(0);
 const small=page.filter(p=>!p.wall.centerComposition && Math.max(p.painting.physicalSizeM.width,p.height)<=s.smallCanvasM);
 assert(small.length>2);
 assert(small.every(p=>p.tier===1 && p.y+p.height/2+s.frameWidthM <= s.minBottomM+2*(s.smallCanvasM+2*s.frameWidthM)+s.verticalGapM+1e-8));
 assert(small.some(a=>small.some(b=>a!==b && a.x===b.x && a.z===b.z &&
   Math.abs(Math.abs(a.y-b.y)-(a.height+b.height)/2-2*s.frameWidthM-s.verticalGapM)<1e-8)));
 for(const slot of result.byId.values()){
  if(slot.floorAngle!==undefined)continue;
  const {normal:n,wall}=slot;
  const depth=(slot.x-wall.a.x)*n.x+(slot.z-wall.a.z)*n.z;
  assert(Math.abs(depth-s.frameDepthM/2-s.wallClearanceM)<1e-8);
 }
});

test('all paintings on the active page remain textured beyond the detailed view radius',async t=>{
 const THREE=await import('../vendor/three.js');
 const {createPaintingDisplay}=await import('../src/paintings/display.js');
 t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 camera.position.z=100;
 const display=createPaintingDisplay({THREE,world:{scene,camera},catalog,config,onAim(){}});
 const e=arrange(seed);
 for(const i of [0,e.pageCount-1]){
  const slots=e.slots(i);
  display.setSlots(slots);display.update(i*1000);
  const mesh=scene.getObjectByName('painting-overview');
  assert(mesh.material.map && mesh.visible);
  assert.equal(mesh.geometry.index.count,slots.length*90);
  assert.equal(new Set(slots.map(s=>s.painting.image.overviewCell)).size,slots.length);
 }
 display.dispose();
 assert.equal(scene.children.length,0);
});

test('each wing features its largest eligible work in the centre of its rear wall',()=>{
 const e=arrange(seed),slots=e.slots(0);
 for(const hall of config.halls){
  const works=[...e.byId.values()].filter(s=>s.wall.hall===hall.id&&s.painting.collection!=='keynlock');
  const hero=slots.find(s=>s.wall.id===hall.id+'/end'&&s.featured);
  assert(hero,hall.id);
  const wall=hero.wall,along=((hero.x-wall.a.x)*(wall.b.x-wall.a.x)+(hero.z-wall.a.z)*(wall.b.z-wall.a.z))/wall.length;
  assert(Math.abs(along-wall.length/2)<1e-7);
  const area=s=>s.painting.physicalSizeM.width*s.height;
  assert(works.every(s=>s.width>wall.length-2*config.paintings.edgeMarginM || area(s)<=area(hero)+1e-7));
 }
 assert(slots.filter(s=>s.wall.hall==='center').length>=20);
});

test('automatic hanging never places a smaller canvas directly above a larger canvas',()=>{
 const e=arrange(seed);
 const area=s=>s.painting.physicalSizeM.width*s.height;
 for(let i=0;i<e.pageCount;i++)for(const works of Map.groupBy(e.slots(i),s=>s.wall.id).values()){
  for(const lower of works)for(const upper of works){
   if(upper.y<=lower.y||Math.hypot(lower.x-upper.x,lower.z-upper.z)>=(lower.width+upper.width)/2-1e-7)continue;
   assert(area(upper)>=area(lower)-1e-7,lower.painting.id+' under '+upper.painting.id);
  }
 }
});

test('the lower pair beneath Barge Haulers shares the same vertical centre',()=>{
 const exhibition=arrange(seed);
 const kiss=exhibition.byId.get('ART-1803'),swing=exhibition.byId.get('ART-0541');
 assert.equal(kiss.wall.id,swing.wall.id);
 assert.notEqual(kiss.height,swing.height);
 assert(Math.abs(kiss.y-swing.y)<1e-7);
});

test('excluding a framed work promotes a fitting queued work and keeps every other ID reachable',()=>{
 const e=arrange(seed);
 const removed=e.byId.get('ART-1586'), page=removed.page, before=e.slots(page);
 const next=e.exclude(removed.painting.id,page);
 assert(next && !before.some(s=>s.painting.id===next.painting.id));
 assert.equal(next.destination,removed.destination);
 assert(Math.hypot(next.x-removed.x,next.z-removed.z)<1e-8);assert.equal(next.y,removed.y);
 assert(!e.byId.has(removed.painting.id));
 for(const [id,s] of e.byId)assert(e.slots(s.page).includes(s),id);
 assert.equal(e.selected,catalog.paintings.length-1);
});

test('scene exclusion updates the same selection used by the open catalog editor and JSON export',async t=>{
 const THREE=await import('../vendor/three.js');
 const {bindCollection}=await import('../src/ui/collection.js');
 const {runInNewContext}=await import('node:vm');
 const {logicalKey}=await import('../src/player/keys.js');
 assert.equal(logicalKey({code:'KeyF',key:'а'}),'f');
 const state=new Map(),editor=new EventTarget(),browser=new EventTarget();
 globalThis.window=browser;
 globalThis.document=Object.assign(new EventTarget(),{body:{append(){}},createElement(){return {setAttribute(){},append(){},remove(){},style:{},dataset:{}};}});
 globalThis.localStorage={getItem:k=>state.get(k),setItem:(key,newValue)=>{
   state.set(key,newValue);editor.dispatchEvent(Object.assign(new Event('storage'),{key,newValue}));
 }};
 t.after(()=>{delete globalThis.window;delete globalThis.localStorage;delete globalThis.document;});
 t.mock.method(THREE.TextureLoader.prototype,'load',()=>new THREE.Texture());
 const editorData=catalog.paintings.map(p=>({...p,rights:p.rights.status,gamePlacement:p.placement}));
 editor.editorCatalog=editorData;
 const context={window:editor,localStorage,initialSelection:seed,document:{querySelector:()=>null},render(){},GAME_HALLS:catalog.halls.map(h=>({...h,walls:h.walls.map(w=>[w.id,w.title])}))};
 const script=await fs.readFile(new URL('../catalog/editor/core.js',import.meta.url),'utf8');
 const exporter=await fs.readFile(new URL('../catalog/editor/import-export.js',import.meta.url),'utf8');
 const selectedIds=runInNewContext(script+'\n'+exporter+'\n()=>exportSelection().paintings.map(p=>p.id)',context);
 const slot=arrange(seed).byId.get('ART-1586'),camera=new THREE.PerspectiveCamera();
 const y=config.building.floorElevation+slot.y;
 camera.position.set(slot.x+slot.normal.x*3,y,slot.z+slot.normal.z*3);camera.lookAt(slot.x,y,slot.z);
 const nodes=new Map(),elements=id=>{if(!nodes.has(id))nodes.set(id,new EventTarget());return nodes.get(id);};
 const mount=debugSelection=>bindCollection({debugSelection,THREE,world:{camera,scene:new THREE.Scene(),layout:makeLayout(config)},config,catalog,
   initialSelection:seed,elements,notify(){},getMode:()=>'play'});
 const collection=mount(false);
 collection.switchHanging(false,false);
 t.after(()=>collection.dispose());
 assert(selectedIds().includes(slot.painting.id));
 for (let i=0;i<slot.page;i++) elements('exhibition-next').dispatchEvent(new Event('click'));
 collection.exclude();
 assert(!selectedIds().includes(slot.painting.id));
 const result=JSON.parse([...state.values()][0]);
 assert.equal(result.included[slot.painting.id],false);assert.deepEqual(result.placements,seed.placements);
});

test('every wing end wall starts at the side-wall baseline on every exhibition page',()=>{
 const e=arrange(seed),s=config.paintings;
 for(let i=0;i<e.pageCount;i++){
  const groups=Map.groupBy(e.slots(i).filter(slot=>slot.wall.theme==='end'),slot=>slot.wall.id);
  assert.equal(groups.size,config.halls.length);
  for(const [wall,slots] of groups){
   const base=Math.min(...slots.map(slot=>slot.y-slot.height/2-s.frameWidthM));
   assert(Math.abs(base-s.minBottomM)<1e-7,wall);
  }
 }
});
test('thematic assignments of the screenshot works reach the scene and the catalog index',()=>{
 for(const [id,hall,wall] of [['ART-1586','world','history'],['ART-0577','world','leisure']]){
  assert(catalog.onWall(hall,wall).some(p=>p.id===id));
  const arranged=arrange(seed);
  if(arranged.byId.has(id))assert.equal(arranged.byId.get(id).destination,hall+'/'+wall);
  else assert.equal(arranged.reserveReasons.get(id),'oversize');
 }
});

test('old raft assignment migrates once while exclusions and later curator edits survive',async()=>{
 const {migrateSelection}=await import('../catalog/selection-migrations.js');
 const id='ART-1539';
 let state={included:{[id]:false},placements:{[id]:'nature/water','ART-0577':'portraits/men'}};
 const hangingKey='keynlock-art-hanging-v1';
 let hanging={[id]:{kind:'floor',floorRoom:'nature',x:4}};
 const storage={getItem:k=>JSON.stringify(k===hangingKey?hanging:state),setItem:(k,v)=>{
   if(k===hangingKey)hanging=JSON.parse(v);else state=JSON.parse(v);
 }};

 migrateSelection(storage,seed);
 assert.equal(state.placements[id],'world/history');
 assert.deepEqual(hanging[id],{kind:'floor',floorRoom:'nature',x:4,destination:'nature/water'});
 assert.equal(state.placements['ART-0577'],'portraits/men');
 assert.equal(state.included[id],false);
 state.placements[id]='nature/water';
 migrateSelection(storage,seed);
 assert.equal(state.placements[id],'nature/water');
});

test('every catalog item has a detail source and the Repin reproduction is bundled for offline inspection',async()=>{
 const files=new Set(await fs.readdir(new URL('../catalog/detail/',import.meta.url)));
 for(const p of catalog.paintings){
   const source=catalog.detailUrl(p.id);
   assert(source,p.id);
   if(p.image.detail.path.startsWith('detail/')){
     assert(files.has(p.image.detail.path.slice('detail/'.length)),p.id);
     assert(Math.max(p.image.detail.widthPx,p.image.detail.heightPx)>Math.max(p.image.widthPx,p.image.heightPx),p.id);
   } else assert.equal(new URL(source).protocol,'https:');
 }
 const repin=catalog.get('ART-1501');
 assert.equal(repin.image.detail.widthPx,1920);
 assert.equal(repin.image.detail.heightPx,899);
});

test('Last Supper fits at full size with 1.1m below and half a metre below the vault, at the minimum centimetre height',()=>{
 const slot=arrange(seed).byId.get('ART-1826');assert(slot,'Last Supper must be exhibited, not reserved');
 const framedHeight=slot.height+2*config.paintings.frameWidthM;
 assert.equal(slot.painting.physicalSizeM.height,4.6);assert.equal(slot.painting.physicalSizeM.width,8.8);
 const bottom=slot.y-framedHeight/2,top=slot.y+framedHeight/2;
 assert(bottom>=1.1-1e-7);
 assert(config.building.height-config.building.vaultRise-top>=.5-1e-7);
 const minimum=1.1+framedHeight+.5+config.building.vaultRise;
 assert(config.building.height>=minimum);assert(config.building.height-minimum<.01);
 assert(slot.width<=slot.wall.length-2*config.paintings.edgeMarginM);
});

test('Composition VII and the pair below share the rotunda panel’s vertical axis',()=>{
 const exhibition=arrange(seed), upper=exhibition.byId.get('ART-1537'), wall=upper.wall;
 const lower=exhibition.slots(upper.page).filter(slot=>slot.wall===wall && slot.tier<upper.tier);
 assert.equal(lower.length,2);
 const along=slot=>((slot.x-wall.a.x)*(wall.b.x-wall.a.x)+(slot.z-wall.a.z)*(wall.b.z-wall.a.z))/wall.length;
 const left=Math.min(...lower.map(slot=>along(slot)-slot.width/2));
 const right=Math.max(...lower.map(slot=>along(slot)+slot.width/2));
 assert(Math.abs((left+right)/2-along(upper))<1e-7);
 assert(Math.abs(along(upper)-wall.length/2)<1e-7);
 assert(Math.abs(lower[0].y-lower[1].y)<1e-7);
});

test('wing rows grow by canvas area from the viewer’s left to right, with only the largest eligible work on the rear wall',()=>{
 const e=arrange(seed),area=s=>s.painting.physicalSizeM.width*s.height;
 for(let i=0;i<e.pageCount;i++){
  const slots=e.slots(i).filter(s=>s.wall.hall!=='center'&&!s.supportId);
  for(const row of Map.groupBy(slots,s=>s.wall.id+'/'+s.tier).values()){
   const right=s=>(s.x-s.wall.a.x)*s.wall.normal.z-(s.z-s.wall.a.z)*s.wall.normal.x;
   for(const a of row)for(const b of row)if(right(b)-right(a)>1e-6)
    assert(area(a)<=area(b)+1e-7,a.painting.id+' is larger than its right neighbour '+b.painting.id);
  }
  for(const h of config.halls){
   const end=slots.filter(s=>s.wall.id===h.id+'/end');
   assert.equal(end.length,1);assert.equal(end[0].featured,true);
  }
 }
});
