import assert from 'node:assert/strict';
import {DEFAULT_GROUND_SETTINGS,GROUND_DISTRICTS,GROUND_GOUACHE_URL,GROUND_GRASS_URL,GROUND_MAP,GROUND_PRESETS,
  resolveGroundSettings,createGroundSurface} from '../js/path-builder/ground-art.js';
import {planBuildingPaths} from '../js/navigation/path-layout.js';

const buildings=[
  {id:'house',kind:'house',type:'house',x:-15,z:4,width:7.5,depth:6.5,rotation:0,pathAccess:{x:0,z:4.5}},
  {id:'church',kind:'landmark',type:'church',x:18,z:-9,width:11,depth:14,rotation:0,pathAccess:{x:0,z:8}},
];
const plan=planBuildingPaths(buildings);
assert.equal(plan.connected,2);
assert.equal(plan.plazas.length,1);
assert.equal(GROUND_DISTRICTS.length,7);
for(const district of GROUND_DISTRICTS)assert.ok(GROUND_PRESETS[district.id]);
const settings=resolveGroundSettings({district:'upper',grass:85,grassSaturation:72,moisture:20,wear:15});
assert.deepEqual(resolveGroundSettings({district:'missing',grass:-8,grassSaturation:140,moisture:140,wear:50}),
  {...DEFAULT_GROUND_SETTINGS,grass:0,grassSaturation:100,moisture:100,wear:50});

class TestContext{
  paint=0;draws=0;gradient=0;linear=0;fills=[];grassComposites=[];clear=0;
  strokes=[];composites=[];
  fillRect(){this.paint++;if(typeof this.fillStyle==='string')this.fills.push(this.fillStyle);}
  clearRect(){this.clear++;}
  drawImage(source){this.draws++;
    if(this.globalCompositeOperation)this.composites.push(this.globalCompositeOperation);
    if(source?.url?.includes('grass-brush'))this.grassComposites.push({alpha:this.globalAlpha,filter:this.filter});}
  createRadialGradient(){this.gradient++;return {addColorStop(){}};}
  createLinearGradient(){this.linear++;return {addColorStop(){}};}
  save(){}
  restore(){}
  translate(){}
  scale(){}
  rotate(){}
  beginPath(){}
  moveTo(){}
  lineTo(){}
  stroke(){this.strokes.push({width:this.lineWidth,color:this.strokeStyle});}
}
const canvases=[];const previousDocument=globalThis.document;
const previousImage=globalThis.Image;
globalThis.document={createElement(tag){
  assert.equal(tag,'canvas');const context=new TestContext();
  const canvas={width:0,height:0,context,getContext(type){assert.equal(type,'2d');return context;}};
  context.canvas=canvas;
  canvases.push(canvas);return canvas;
}};
try{
  const ground=createGroundSurface();
  assert.equal(ground.getDetails,undefined,'3D vegetation and scattered surface objects are removed');
  assert.equal(canvases.length,7,'Keep one shared river-water, bank and union-mask atlas');
  assert.equal(ground.canvas.width,GROUND_MAP.width*GROUND_MAP.pixelsPerMetre);
  assert.equal(ground.canvas.height,GROUND_MAP.depth*GROUND_MAP.pixelsPerMetre);
  const paper=canvases[1].context,base=canvases[2].context,decals=canvases[3].context;
  const previousPaperPaint=paper.paint,previousBasePaint=base.paint;
  assert.deepEqual(ground.setPlan(buildings,plan,DEFAULT_GROUND_SETTINGS),
    {baseChanged:false,decalsChanged:true,waterChanged:false},'Only the shadow/road overlay changes on a layout update');
  assert.ok(decals.linear>=4&&decals.gradient>=4,
    'Contact shading must fade along all four sides and round every corner');
  assert.ok(!decals.fills.includes('rgba(37,60,37,.38)'),
    'The old hard-edged rectangular shadow must be removed');
  assert.equal(paper.paint,previousPaperPaint,'Moving buildings must not regenerate paper stippling');
  assert.equal(base.paint,previousBasePaint,'Moving buildings must not regenerate ground pigment');
  const unchangedDraws=canvases[0].context.draws;
  assert.deepEqual(ground.setPlan(buildings,plan,DEFAULT_GROUND_SETTINGS),
    {baseChanged:false,decalsChanged:false,waterChanged:false},'Identical layout is a no-op');
  assert.deepEqual(ground.setPlan(buildings,plan,DEFAULT_GROUND_SETTINGS,'auto',
    {rivers:[],hills:[],trees:[{id:'new-oak',x:17,z:12}]}),
  {baseChanged:false,decalsChanged:false,waterChanged:false},
  'Tree-only edits are handled by 3D instances and must not upload ground decals');
  assert.equal(canvases[0].context.draws,unchangedDraws,'An unchanged ground avoids recomposition');
  assert.ok(canvases[0].context.draws>=2,'The painted ground must be reused across layout updates');
  assert.deepEqual(ground.setPlan(buildings,plan,settings),{baseChanged:true,decalsChanged:true,waterChanged:false});
  assert.ok(paper.paint>previousPaperPaint,'Changing district settings repaints the shared substrate');
  const baseContext=base;
  const bare={district:'old',grass:0,grassSaturation:0,moisture:0,wear:0};
  baseContext.fills=[];ground.setPlan(buildings,plan,bare);
  assert.ok(!baseContext.fills.some(style=>style.startsWith('rgba(65,84,82,')||
    style.startsWith('rgba(147,108,76,')),
  'Dry, pristine ground should have no moisture or abrasion overlays');
  const beforeGrassGradients=baseContext.gradient;
  baseContext.fills=[];ground.setPlan(buildings,plan,{...bare,grass:100});
  assert.ok(baseContext.fills.includes('#8da27a42'),'100% painted grass must tint the terrain');
  assert.ok(baseContext.gradient>beforeGrassGradients+100,
    'Painted lawns must create numerous large gouache washes without blade meshes');
  baseContext.fills=[];ground.setPlan(buildings,plan,{...bare,grass:100,grassSaturation:100});
  assert.ok(baseContext.fills.includes('rgba(47,124,53,0.170)'),
    'The saturation slider must visibly strengthen the green even without an image');
  baseContext.fills=[];ground.setPlan(buildings,plan,{...bare,moisture:100});
  assert.ok(baseContext.fills.includes('rgba(65,84,82,0.340)'),
    '100% moisture should produce a strong, visible cool-dark overlay');
  baseContext.fills=[];ground.setPlan(buildings,plan,{...bare,wear:100});
  assert.ok(baseContext.fills.includes('rgba(147,108,76,0.290)'),
    '100% wear should expose a visibly warmer, worn-earth overlay');
  const paintBeforeColorChange=paper.paint;
  assert.deepEqual(ground.setPlan(buildings,plan,{...bare,grass:100,grassSaturation:40}),
    {baseChanged:true,decalsChanged:true,waterChanged:false},'Wear change also changes road margin opacity');
  assert.equal(paper.paint,paintBeforeColorChange,'Grass tuning keeps the original paper cached');
  assert.deepEqual(ground.setPlan(buildings,plan,{...bare,grass:100,grassSaturation:60}),
    {baseChanged:true,decalsChanged:false,waterChanged:false},'Saturation updates only the color atlas');
  const joiningRivers={rivers:[
    {id:'north',width:10,points:[[-26,0],[26,0]]},
    {id:'south',width:12,points:[[0,-24],[0,24]]}],hills:[],bridges:[]};
  const joined=ground.setPlan(buildings,plan,bare,'auto',joiningRivers);
  assert.deepEqual(joined,{baseChanged:true,decalsChanged:true,waterChanged:true});
  const maskContext=canvases[6].context,shoreContext=canvases[5].context;
  assert.equal(maskContext.strokes.length,2,'All intersecting channels join into the SAME alpha mask');
  assert.ok(shoreContext.composites.includes('destination-out'),
    'Remove inner bank outlines wherever another river joins the channel');
  assert.equal(ground.setPlan(buildings,plan,bare,'auto',joiningRivers).waterChanged,false,
    'Unchanged rivers must reuse the water texture');
  assert.equal(ground.setPlan(buildings,plan,bare,'auto',{rivers:[],hills:[],bridges:[]}).waterChanged,true,
    'Removing rivers must clear the shared mask');
  const gpuCount=canvases.length;
  const gpuSurface=createGroundSurface({composeFor2D:false});
  assert.equal(gpuSurface.canvas,null,'GPU needs no full-resolution composite canvas');
  assert.equal(canvases.length,gpuCount+6,'GPU reuses one water atlas and two temporary river-paint layers');
  assert.deepEqual(gpuSurface.setPlan(buildings,plan,bare),
    {baseChanged:true,decalsChanged:true,waterChanged:false});
  gpuSurface.dispose();
  // An asynchronously decoded gouache image must repaint the shared atlas and
  // notify both the WebGL texture and the Canvas fallback without extra polling.
  const loadedImages=[];
  globalThis.Image=class{
    naturalWidth=1254;naturalHeight=1254;
    set src(value){this.url=value;loadedImages.push(this);}
  };
  let updates=0;
  const texturedStart=canvases.length;
  const textured=createGroundSurface({onUpdate:()=>updates++});
  assert.equal(loadedImages.length,4,'Load painted ground, grass, Neva water and shoreline separately');
  assert.ok(loadedImages[0].url.endsWith('keynlock-earth-gouache-v1.webp'));
  assert.ok(loadedImages[1].url.endsWith('keynlock-grass-brush-v1.webp'));
  assert.ok(loadedImages[2].url.endsWith('/assets/map/spb-water-mask.png'));
  assert.ok(loadedImages[3].url.endsWith('/assets/map/spb-shore-wash.png'));
  assert.ok(GROUND_GOUACHE_URL.includes('/assets/ground/'));
  assert.ok(GROUND_GRASS_URL.includes('/assets/ground/'));
  assert.equal(canvases[texturedStart+1].context.draws,0,'First frame may use the painted fallback');
  loadedImages[0].onload();
  assert.equal(canvases[texturedStart+1].context.draws,1,'Loaded gouache must paint the cached paper substrate');
  assert.equal(updates,1,'Texture upload and 2D repaint must be requested once');
  loadedImages[1].onload();
  assert.equal(updates,2,'Grass brush image must refresh both 3D and fallback atlases');
  loadedImages[2].onload();
  loadedImages[3].onload();
  assert.equal(updates,4,'The reference water and bank washes refresh both renderers');
  const texturedBase=canvases[texturedStart+2].context;
  textured.setPlan(buildings,plan,{...bare,grass:100,grassSaturation:0});
  const lowSaturation=texturedBase.grassComposites.at(-1);
  textured.setPlan(buildings,plan,{...bare,grass:100,grassSaturation:100});
  const highSaturation=texturedBase.grassComposites.at(-1);
  assert.ok(highSaturation.alpha>lowSaturation.alpha,'High saturation must reveal more hand-painted pigment');
  assert.notEqual(highSaturation.filter,lowSaturation.filter,'High saturation must alter pigment color');
  textured.dispose();
  assert.ok(loadedImages.every(image=>image.onload===null),'Disposed scenes must detach image handlers');
}finally{
  if(previousDocument===undefined)delete globalThis.document;
  else globalThis.document=previousDocument;
  if(previousImage===undefined)delete globalThis.Image;
  else globalThis.Image=previousImage;
}
console.log(`KEYNLOCK gouache ground: ${GROUND_DISTRICTS.length} districts, zero vegetation meshes, distinct grass / damp / wear washes OK`);
