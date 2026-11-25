import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {createPaintingObject} from '../catalog/three-painting.js';
import {reproductionFit} from '../catalog/reproduction-fit.js';

test('gallery images fill their measured frames without wooden mats or stretching; archive contain remains explicit',async()=>{
  for(const aspect of [.4,1,2.5]){
    const image={widthPx:aspect*1000,heightPx:1000,fit:'contain'};
    const size={width:.8,height:1.2};
    const archive=reproductionFit(image,size,aspect,'contain');
    assert(Math.abs(archive.width/archive.height-aspect)<1e-9);
    assert.equal(archive.u,1);assert.equal(archive.v,1);
    const fit=reproductionFit(image,size);
    assert.equal(fit.width,size.width);assert.equal(fit.height,size.height);
    assert(Math.abs(aspect*fit.u/fit.v-size.width/size.height)<1e-9);
    assert(fit.width<=size.width+1e-9 && fit.height<=size.height+1e-9);
    assert(fit.u>0 && fit.u<=1);assert(fit.v>0 && fit.v<=1);
    const view=await createPaintingObject({THREE,painting:{id:'reviewed',image,physicalSizeM:size,placement:{hall:'test',wall:'test'}},imageUrl:'preview',loader:{loadAsync:async()=>new THREE.Texture({width:image.widthPx,height:image.heightPx})}});
    const face=view.object.getObjectByName('canvas:reviewed');
    assert.equal(view.widthM,size.width+.135);assert.equal(view.heightM,size.height+.135);
    assert(Math.abs(face.scale.x*size.width-fit.width)<1e-9);
    assert(Math.abs(face.scale.y*size.height-fit.height)<1e-9);
    const mat=view.object.getObjectByName('painting-back:reviewed');let disposed=0;
    mat.geometry.addEventListener('dispose',()=>disposed++);
    mat.material.addEventListener('dispose',()=>disposed++);
    view.dispose();view.dispose();assert.equal(disposed,2);
  }
});
