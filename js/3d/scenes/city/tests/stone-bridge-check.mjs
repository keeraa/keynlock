import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {stoneBridgeDimensions,createStoneBridge} from '../js/path-builder/stone-bridge.js';
import {bridgeProfiles,normalizeLandscape} from '../js/path-builder/landscape-model.js';

assert.equal(stoneBridgeDimensions(4).span,10.4);
assert.equal(stoneBridgeDimensions(18).span,24.4);
assert.equal(stoneBridgeDimensions(48).span,54.4);
const landscape=normalizeLandscape({rivers:[{id:'wide',width:18,points:[[0,-42],[0,42]]}],
  bridges:[{id:'span',riverId:'wide',t:.5}]});
const profile=bridgeProfiles(landscape)[0];
const bridge=createStoneBridge(THREE,profile);
assert.match(bridge.group.name,/каменный арочный мост/);
assert.ok(bridge.group.children.length>=5,'Bridge includes barrel vault, deck and parapets');
const walls=bridge.group.children.filter(item=>item.geometry.type==='ExtrudeGeometry');
assert.equal(walls.filter(w=>w.name==='Цельный каменный арочный свод').length,1,
  'One continuous stone barrel vault spans the full width');
const vault=walls.find(w=>w.name==='Цельный каменный арочный свод');
const slab=walls.find(w=>w.name==='Цельная каменная плита под мостовой');
assert.ok(slab,'Bridge deck has a sealed solid backing under every paving stone');
assert.ok(slab.geometry.parameters.options.depth>profile.deckWidth-.2,
  'Backing spans the complete masonry width');
assert.ok(vault.geometry.parameters.options.depth>=profile.deckWidth-.2,
  'Vault remains joined across the deck with no floating side walls');
const underside= new THREE.Raycaster(new THREE.Vector3(0,-.75,-10),new THREE.Vector3(0,0,1));
assert.equal(underside.intersectObject(vault,false).length,0,
  'The stone vault has a real opening below its arch, not a painted dark hole');
const aboveArch=new THREE.Raycaster(new THREE.Vector3(0,1.8,-10),new THREE.Vector3(0,0,1));
assert.ok(aboveArch.intersectObject(vault,false).length>0,
  'Bridge spandrel is one continuous wall above the arch opening');
const deck=bridge.group.children.find(item=>item.geometry.type==='BufferGeometry'&&item.geometry.attributes.uv);
assert.ok(deck,'Continuous curved stone deck exists');
const pos=deck.geometry.attributes.position;
assert.ok(pos.getX(0)<=-profile.span/2+.001&&
  pos.getX(pos.count-1)>=profile.span/2-.001,'Deck spans the complete river plus bank approaches');
bridge.group.updateMatrixWorld(true);
for(const x of [-profile.span/3,0,profile.span/3]){
  const worldPoint=new THREE.Vector3(x,4,0).applyMatrix4(bridge.group.matrixWorld);
  const ray=new THREE.Raycaster(worldPoint,new THREE.Vector3(0,-1,0));
  assert.ok(ray.intersectObject(slab,false).length>0,
    'Sealed backing stays present through the entire curved crossing');
}
bridge.dispose();
const roadMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
const pavedBridge=createStoneBridge(THREE,profile,null,roadMaterial);
const road=pavedBridge.group.children.find(child=>child.name==='Брусчатка дороги на мосту');
assert.ok(road?.geometry.attributes.uv,'The city road continues across the physical bridge deck');
assert.equal(pavedBridge.group.children.some(child=>child.isInstancedMesh),false,
  'Old raised decorative pavers do not intersect the continuous cobblestone road');
assert.ok(Math.abs(road.geometry.attributes.position.getX(0)+profile.span/2)<.0001);
assert.ok(road.geometry.attributes.uv.getX(0)>0,
  'Bridge paving uses the same world-anchored stone UVs as the city roads');
pavedBridge.dispose();roadMaterial.dispose();
console.log('Stone bridge: reusable arched geometry scales with river width');
