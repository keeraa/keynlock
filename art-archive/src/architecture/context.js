import {metricBox} from './materials.js';
import {createSignBuilder} from './signs.js';
export function createBuildingContext({THREE,config,layout,materials:m,translate=value=>value,loadModel,onFurnitureLoaded}) {
 const root=new THREE.Group();root.name='art-archive';root.position.y=config.building.floorElevation;
 const roofs=new THREE.Group();roofs.name='roofs';root.add(roofs);
 const upper=new THREE.Group();upper.name='upper-walls';root.add(upper);
 const labels=new THREE.Group();root.add(labels);
 const {radius:r,wingWidth:w,wingLength:len,height:ceilingHeight,vaultRise,wallBays,stair}=config.building;
 const height=ceilingHeight-vaultRise;
 const domeBase=config.building.domeBaseHeight;
 
 const disposable=new Set(),signUpdates=[];
 const mesh=(g,mat,parent=root)=>{disposable.add(g);const o=new THREE.Mesh(g,mat);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const box=(x,y,z,a,b,c,mat,parent=root)=>{const o=mesh(metricBox(THREE,a,b,c),mat,parent);o.position.set(x,y,z);return o;};
 const cylinder=(x,y,z,rt,rb,h,mat,parent=root,segments=12)=>{const o=mesh(new THREE.CylinderGeometry(rt,rb,h,segments),mat,parent);o.position.set(x,y,z);return o;};
 function tube(points, radius, material, parent = root) {
  const straight = points.length === 2;
  const path = straight ? new THREE.LineCurve3(...points) : new THREE.CatmullRomCurve3(points);
  const segments = straight ? 1 : points.length - 1;
  return mesh(new THREE.TubeGeometry(path, segments, radius, 6, false), material, parent);
 }
 const shapeMesh=(points,holes,y,depth,mat,parent=root)=>{
  const s=new THREE.Shape(points.map(p=>new THREE.Vector2(p.x,-p.z)));
  for(const hole of holes){const path=new THREE.Path(hole.map(p=>new THREE.Vector2(p.x,-p.z)));s.holes.push(path);}
  const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false});g.rotateX(-Math.PI/2);
  const o=mesh(g,mat,parent);o.position.y=y;return o;
 };
 const circle=(radius,n=64)=>Array.from({length:n},(_,i)=>({x:Math.sin(i/n*Math.PI*2)*radius,z:Math.cos(i/n*Math.PI*2)*radius}));
 const sector=(a,b,inner,outer,n=4)=>[...Array.from({length:n+1},(_,i)=>{const t=a+(b-a)*i/n;return {x:Math.sin(t)*outer,z:Math.cos(t)*outer};}),...Array.from({length:n+1},(_,i)=>{const t=b-(b-a)*i/n;return {x:Math.sin(t)*inner,z:Math.cos(t)*inner};})];
 const segment=(a,b,y,h,depth,mat,parent=root)=>{
  const o=box((a.x+b.x)/2,y,(a.z+b.z)/2,depth,h,Math.hypot(b.x-a.x,b.z-a.z),mat,parent);o.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);return o;
 };
 const sign=createSignBuilder({THREE,labels,mesh,disposable,signUpdates,translate});

 return {THREE, config, layout, m, root, roofs, upper, labels, r, w, len, ceilingHeight, vaultRise, wallBays, stair, height, domeBase, disposable, signUpdates, mesh, box, cylinder, tube, shapeMesh, circle, sector, segment, sign,loadModel,onFurnitureLoaded,dispose(){root.removeFromParent();for(const r of disposable)r.dispose();},refreshLanguage(){for(const draw of signUpdates)draw();}};
}
