import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import { generateQuarterPlan } from '../js/street/quarter-generator.js';
import { buildQuarterPaving } from '../js/street/quarter-paving.js';
import { QUARTER_ATLAS_PIXELS,QUARTER_ATLAS_METRES,QUARTER_ROAD_PALETTE } from '../js/street/quarter-road-atlas.js';

const linear=value=>{
  const s=value/255;
  return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;
};
const luminance=hex=>{
  const channels=[1,3,5].map(i=>linear(parseInt(hex.slice(i,i+2),16)));
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
};
for(const roadColor of [QUARTER_ROAD_PALETTE.cobbleRoad,QUARTER_ROAD_PALETTE.pavedRoad]){
  assert(luminance(QUARTER_ROAD_PALETTE.sidewalk)-luminance(roadColor)>.29,
    'A carriageway must be visibly darker than its adjoining sidewalk');
}

const strokes=[];
const contexts=[];
class FakeCanvasContext {
  constructor(){this.stack=[];this.globalCompositeOperation='source-over';this.strokeStyle='';this.lineWidth=0;contexts.push(this);}
  setTransform(){}
  save(){this.stack.push({globalCompositeOperation:this.globalCompositeOperation,
    strokeStyle:this.strokeStyle,lineWidth:this.lineWidth});}
  restore(){Object.assign(this,this.stack.pop());}
  beginPath(){this.points=0;}
  moveTo(){this.points++;}
  lineTo(){this.points++;}
  stroke(){strokes.push({context:contexts.indexOf(this),color:this.strokeStyle,
    width:this.lineWidth,points:this.points,composite:this.globalCompositeOperation});}
  fillRect(){}
  drawImage(){}
}
globalThis.document={createElement(tag){
  assert.equal(tag,'canvas');
  return {width:0,height:0,getContext(kind){assert.equal(kind,'2d');return new FakeCanvasContext();}};
}};

for(const district of ['old','port','arts','bohemian','industrial','upper','palace']){
  const plan=generateQuarterPlan(district,1130);
  for(const line of plan.roads.lines)for(const point of line.path){
    assert(Math.abs(point[0])<QUARTER_ATLAS_METRES/2-5);
    assert(Math.abs(point[1])<QUARTER_ATLAS_METRES/2-5);
  }
  const root=new THREE.Group();
  const start=strokes.length;
  buildQuarterPaving(THREE,root,plan);
  const surface=root.children.filter(o=>o.userData.surfaceAtlas);
  assert.equal(surface.length,1,'All intersecting roads must share one surface');
  assert.equal(surface[0].material.map.image.width,QUARTER_ATLAS_PIXELS);
  assert.equal(surface[0].material.map.image.height,QUARTER_ATLAS_PIXELS);
  assert(!root.children.some(o=>o.isInstancedMesh),'No rotated stone grids at intersections');
  const painted=strokes.slice(start);
  for(const color of [QUARTER_ROAD_PALETTE.sidewalk,QUARTER_ROAD_PALETTE.kerbShadow,
    QUARTER_ROAD_PALETTE.kerbFace]){
    assert(painted.filter(s=>s.color===color).length===plan.roads.lines.length);
  }
  const roadColor=plan.profile.surface==='cobble'?
    QUARTER_ROAD_PALETTE.cobbleRoad:QUARTER_ROAD_PALETTE.pavedRoad;
  assert(painted.filter(s=>s.color===roadColor).length===plan.roads.lines.length);
  assert(painted.some(s=>s.composite==='source-atop'&&s.width>=.058),
    'Road joints need a strong enough grout line to read from above');
  assert(painted.some(s=>s.composite==='source-atop'),'Paver grout is clipped inside its surfaces');
  assert(painted.some(s=>s.context%2===1),'Roads overpaint all the sidewalk joins');
  root.traverse(object=>{if(object.isMesh){object.geometry.dispose();object.material.dispose();
    if(object.userData.ownedTexture)object.userData.ownedTexture.dispose();}});
}
delete globalThis.document;
console.log('Road atlas: seven districts, seamless shared surface and kerb joins OK');
