import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.js';
import {createArchiveClouds,cloudSettings} from '../src/environment/clouds.js';
const config=JSON.parse(await fs.readFile(new URL('../config/scene.json',import.meta.url)));
test('original Village Engine package matches its immutable manifest',async()=>{
 const root=new URL('../vendor/village-cumulus/',import.meta.url),manifest=JSON.parse(await fs.readFile(new URL('manifest.json',root)));
 for(const [file,expected]of Object.entries(manifest.integrity)){const bytes=await fs.readFile(new URL(file,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),expected);}
});
test('clouds move on the host clock, stay above the dome and release GPU resources when disabled',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.y=9.78;
 const clouds=createArchiveClouds({THREE,scene,camera,config,settings:{count:8,quality:'low',height:18,scale:2}});
 clouds.update(0);const before=clouds.snapshot();clouds.update(1);const after=clouds.snapshot();assert.equal(after.time,before.time+1);assert.notDeepEqual(after.positions,before.positions);
 scene.updateMatrixWorld(true);let disposed=0,count=0;
 scene.traverse(o=>{if(!o.isMesh)return;count++;assert(new THREE.Box3().setFromObject(o).min.y>after.domeTop);for(const resource of [o.geometry,o.material,o.material.uniforms.field.value])resource.addEventListener('dispose',()=>disposed++);});
 assert.equal(count,8);clouds.configure({enabled:false});assert.equal(clouds.snapshot().count,0);assert.equal(disposed,24);assert.equal(scene.children.length,0);
 clouds.configure({enabled:true});assert.equal(clouds.snapshot().count,8);clouds.setVisible(false);assert.equal(scene.children[0].visible,false);clouds.setVisible(true);assert.equal(scene.children[0].visible,true);
 clouds.dispose();clouds.dispose();assert.equal(scene.children.length,0);
});
test('cloud settings reject invalid values and preserve a disabled choice',()=>{
 const c=cloudSettings({enabled:false,count:999,quality:'invalid',coverage:-1,sunColor:'not a color'});
 assert.equal(c.enabled,false);assert.equal(c.count,96);assert.equal(c.coverage,0);assert.equal(c.quality,'high');assert.equal(c.sunColor,'#fffaf2');
});
test('overlapping sky volumes keep a distinct compositing order across camera turns and wind motion',()=>{
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
 const clouds=createArchiveClouds({THREE,scene,camera,config,settings:{count:8,quality:'low'}});
 const meshes=[];scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
 const order=()=>meshes.slice().sort((a,b)=>a.renderOrder-b.renderOrder).map(m=>m.id);
 const original=order();
 assert.equal(new Set(meshes.map(m=>m.renderOrder)).size,8);
 assert(meshes.every(m=>m.renderOrder<0 && m.material.depthWrite===false));
 for(let i=0;i<60;i++){
  camera.rotation.set(1.1,i*.1,0);camera.position.x=Math.sin(i)*4;
  clouds.update(.05);assert.deepEqual(order(),original);
 }
 clouds.configure({count:12});const rebuilt=[];scene.traverse(o=>{if(o.isMesh)rebuilt.push(o);});
 assert.equal(new Set(rebuilt.map(m=>m.renderOrder)).size,12);
 clouds.dispose();
});
