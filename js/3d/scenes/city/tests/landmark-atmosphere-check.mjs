import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../vendor/three.js';
import {createLandmarkModel,LANDMARK_CATALOG} from '../js/landmarks/landmark-model.js';
import {createLandmarkAtmosphere,LANDMARK_ATMOSPHERE_DEFAULTS} from '../js/landmarks/landmark-atmosphere.js';

for(const {id} of LANDMARK_CATALOG)for(const detail of ['high','medium','low']){
  const model=createLandmarkModel(T,id,{detail});
  const originalTriangles=model.stats.triangles;
  const effects=createLandmarkAtmosphere(T,model);
  assert(effects.group.isGroup&&effects.mossGroup.isGroup&&effects.smokeGroup.isGroup);
  assert(effects.decals.length>0,`${id}/${detail} must have moss at the wall foot`);
  assert(effects.decals.every(node=>node.userData.landmarkMossDecal&&node.geometry.type==='PlaneGeometry'));
  assert(effects.decals.every(node=>{
    const uv=node.geometry.getAttribute('uv');
    return [...Array(uv.count).keys()].every(i=>uv.getY(i)<=.28001);
  }), 'Landmark moss decals must show the painted lichen rather than the transparent texture');
  assert(effects.decals.every(node=>node.userData.landmarkMossBase<1.1),
    'Moss may grow only from the first metre of masonry');
  assert.equal(effects.particles.length,(id==='tower'?0:id==='palace'?2:1)*6,
    `${id}/${detail} must emit smoke only from actual stone chimneys`);
  assert.equal(effects.smokeGroup.children.length,id==='tower'?0:1,
    'Landmark smoke must render as one point batch regardless of chimney count');
  if(effects.smokeBatch)assert(effects.smokeBatch.points.isPoints,
    'Landmark smoke should use a single draw rather than independent sprites');
  assert(effects.halos.length<=16,'Window halo sprites must have a bounded render cost');
  effects.setSettings({night:true,windowGlow:84,moss:true,mossHeight:130,mossDensity:90,
    smoke:true,smokeOutline:false,smokeDensity:70});
  assert.equal(effects.glowGroup.visible,true);
  assert.equal(effects.mossGroup.visible,true);
  assert.equal(effects.smokeGroup.visible,id!=='tower');
  assert(effects.decals.every(node=>Math.abs(node.scale.y-1.3)<.001));
  effects.update(0);
  const cloud=effects.smokeBatch?.points.geometry;
  const previous=cloud?.getAttribute('position').getY(0);
  const smallScale=cloud?.getAttribute('puffSize').getX(0);
  if(effects.particles.length)assert(cloud.getAttribute('color').getW(0)>.8,
    'Landmark smoke must be visible immediately above the outlet');
  effects.update(5);
  if(effects.particles.length){
    assert(previous<effects.particles[0].origin.y,'Landmark smoke begins within the chimney');
    assert(cloud.getAttribute('position').getY(0)>previous+3,'Smoke must rise high');
    assert(cloud.getAttribute('puffSize').getX(0)>smallScale*3,'Smoke must expand as it rises');
  }
  effects.setSettings({night:false,moss:false,smoke:false});
  assert.equal(effects.glowGroup.visible,false);
  assert.equal(effects.mossGroup.visible,false);
  assert.equal(effects.smokeGroup.visible,false);
  assert.equal(model.stats.triangles,originalTriangles,'Effects must not alter building LOD statistics');
  effects.dispose();model.dispose();
}

assert(LANDMARK_ATMOSPHERE_DEFAULTS.moss&&LANDMARK_ATMOSPHERE_DEFAULTS.smoke);
const html=await readFile(new URL('../landmark-lab/index.html',import.meta.url),'utf8');
for(const key of Object.keys(LANDMARK_ATMOSPHERE_DEFAULTS)){
  assert(html.includes('data-atmo="'+key+'"'),`No editor control for ${key}`);
}
console.log('Landmark atmosphere: moss, reflective glass, smoke outlines, night glow, controls and disposal OK');
