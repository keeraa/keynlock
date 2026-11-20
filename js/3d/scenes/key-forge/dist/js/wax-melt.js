import * as THREE from '../vendor/three.js';
import { KEY_TEMPLATES } from './key-data.js';
import { WAX_COLORS, waxBlobLayout, meltWaxBlobs, waxGeometry, getWaxMaterial } from './key-wax.js';
import { createShine } from './key-shine.js';

// Wax melting over a candle. The candle rises under the key, the coat nearest
// the flame softens first, runs stretch and drop beads that fall and splash
// out of sight. Reusable by any scene that holds a key model in a group.

export const MELT_SECONDS=3.4;
const CANDLE_IN=.45,CANDLE_OUT=.6;

function flameTexture() {
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d');
  const gradient=ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,236,170,.95)');
  gradient.addColorStop(.35,'rgba(255,170,70,.45)');
  gradient.addColorStop(1,'rgba(255,120,40,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

function createCandle() {
  const candle=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.15,.16,1.1,20),
    new THREE.MeshStandardMaterial({color:'#efe2bf',roughness:.6,metalness:0,emissive:'#4a2c0c',emissiveIntensity:.12}));
  body.position.y=-.55;
  body.userData.outlineable=true;
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.13,.035,8,20),body.material);
  rim.rotation.x=Math.PI/2;rim.userData.outlineable=true;
  const wick=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.09,6),
    new THREE.MeshBasicMaterial({color:'#2b2118'}));
  wick.position.y=.045;
  const flame=new THREE.Group();flame.position.y=.09;
  const outer=new THREE.Mesh(new THREE.SphereGeometry(.07,14,10),
    new THREE.MeshBasicMaterial({color:'#ff9327'}));
  outer.scale.set(1,2.3,1);outer.position.y=.12;
  const inner=new THREE.Mesh(new THREE.SphereGeometry(.04,12,8),
    new THREE.MeshBasicMaterial({color:'#fff1bf'}));
  inner.scale.set(1,2,1);inner.position.y=.09;
  // A camera-facing plane, not a Sprite: the outline pass only knows how to
  // skip meshes, and a sprite would get an inked square around it.
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({
    map:flameTexture(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
  glow.scale.set(.75,.95,1);glow.position.set(0,.14,.05);
  // Ink only the outer flame; the core and the glow are painted light.
  for(const part of [outer,inner,wick,glow])part.userData.exportable=false;
  outer.userData.outlineable=true;
  flame.add(outer,inner,glow);
  const light=new THREE.PointLight('#ffb15c',0,2.4,1.6);light.position.y=.3;
  candle.add(body,rim,wick,flame,light);
  candle.userData={flame,outer,inner,glow,light};
  return candle;
}

// The caller turns the key to lie flat over the flame; `settle` seconds let
// that turn finish before the candle rises. The candle follows the key.
export function createWaxMelt({scene,keyGroup,design,floorY=-1.3,settle=.55}) {
  const template=KEY_TEMPLATES[design.template];
  const blobs=waxBlobLayout(template,design);
  const waxMaterial=getWaxMaterial();
  let waxMesh=null;
  keyGroup.traverse(mesh=>{if(mesh.isMesh&&mesh.material===waxMaterial)waxMesh=mesh;});

  // Heat comes from below the middle of the coat.
  const minX=Math.min(...blobs.map(b=>b.x-b.rx)),maxX=Math.max(...blobs.map(b=>b.x+b.rx));
  const heatX=(minX+maxX)/2,reach=Math.max(.5,(maxX-minX)/2);
  const near=blobs.filter(b=>Math.abs(b.x-heatX)<reach*.6);
  const heatY=near.length?near.reduce((sum,b)=>sum+b.y,0)/near.length:0;
  const candle=createCandle();
  const hiddenY=floorY-.6;
  candle.position.set(heatX,hiddenY,0);
  scene.add(candle);
  // Flame tip sits just under the lowest point of the key and its wax.
  const FLAME_TIP=.37;
  const probe=new THREE.Vector3();
  function restPosition() {
    keyGroup.updateMatrixWorld(true);
    let lowest=Infinity;
    for(const [dx,dy] of [[0,0],[-.25,0],[.25,0],[0,-.2],[0,.2]]) {
      for(const z of [-.06,design.thickness/100+.06]) {
        probe.set(heatX+dx,heatY+dy,z);keyGroup.localToWorld(probe);
        lowest=Math.min(lowest,probe.y);
      }
    }
    probe.set(heatX,heatY,0);keyGroup.localToWorld(probe);
    return {x:probe.x,y:lowest-.1-FLAME_TIP,z:probe.z};
  }
  let restY=hiddenY;

  const drops=[];
  const dropGeometry=new THREE.SphereGeometry(.035,10,8);
  const dropMaterial=new THREE.MeshStandardMaterial({color:WAX_COLORS.base,roughness:.5,metalness:0});
  let lastDrop=0,elapsed=0,melted=false,shine=null;
  const progressAt=t=>blob=>{
    const distance=Math.abs(blob.x-heatX)/reach;
    // At t=1 even the farthest pool (distance 1) has fully melted.
    return Math.max(0,(t*1.9-.15)-.75*distance);
  };

  function rebuild(t) {
    if(!waxMesh)return [];
    const current=meltWaxBlobs(blobs,progressAt(t),{sag:false});
    const geometry=waxGeometry(template,design,{blobs:current,heightScale:1-.55*t});
    waxMesh.geometry.dispose();
    waxMesh.geometry=geometry;
    return current;
  }

  function spawnDrop(blob) {
    const drop=new THREE.Mesh(dropGeometry,dropMaterial);
    // Beads leave the underside of the coat, nearest the flame.
    const start=new THREE.Vector3(blob.x+(Math.random()-.5)*blob.rx,blob.y+(Math.random()-.5)*blob.ry,-.05);
    keyGroup.localToWorld(start);
    drop.position.copy(start);
    drop.scale.setScalar(.7+Math.random()*.5);
    drop.userData.velocity=0;
    scene.add(drop);drops.push(drop);
  }

  // Returns true once the whole effect, candle included, has finished.
  function update(dt) {
    elapsed+=dt;
    const time=Math.max(0,elapsed-settle);
    const rise=Math.min(1,time/CANDLE_IN);
    const meltTime=Math.max(0,time-CANDLE_IN*.6);
    const t=Math.min(1,meltTime/MELT_SECONDS);
    const fall=Math.max(0,(time-CANDLE_IN*.6-MELT_SECONDS)/CANDLE_OUT);
    const ease=x=>1-Math.pow(1-x,3);
    const rest=restPosition();restY=rest.y;
    candle.position.set(rest.x,hiddenY+(restY-hiddenY)*ease(rise)-(restY-hiddenY)*ease(Math.min(1,fall)),rest.z);
    const {flame,outer,inner,glow,light}=candle.userData;
    const flicker=1+.08*Math.sin(elapsed*31)+.05*Math.sin(elapsed*17.3);
    flame.scale.set(1/flicker,flicker*(.4+.6*rise),1/flicker);
    outer.rotation.z=.08*Math.sin(elapsed*9);
    glow.material.opacity=(.75+.25*Math.sin(elapsed*23))*rise*(1-Math.min(1,fall));
    light.intensity=2.2*rise*(1-Math.min(1,fall))*flicker;
    inner.visible=outer.visible=fall<1;

    if(!melted&&time>0) {
      const current=rebuild(t);
      // Runs and the coat right above the flame shed beads while melting.
      if(t>.08&&t<.92&&elapsed-lastDrop>.16) {
        const candidates=current.filter(b=>b.kind==='run'||Math.abs(b.x-heatX)<reach*.45);
        if(candidates.length) {
          spawnDrop(candidates[Math.floor(Math.random()*candidates.length)]);
          lastDrop=elapsed;
        }
      }
      if(t>=1)melted=true;
    }
    // The clean key glints while the candle goes away.
    if(melted&&!shine)shine=createShine({keyGroup,design});
    const shineDone=shine?shine.update(dt):false;
    for(let i=drops.length-1;i>=0;i--) {
      const drop=drops[i];
      drop.userData.velocity+=dt*5.5;
      drop.position.y-=drop.userData.velocity*dt;
      // Beads that reach the flame vanish in it.
      if(drop.position.y<restY+FLAME_TIP-.05&&Math.abs(drop.position.x-candle.position.x)<.25||drop.position.y<floorY-.3) {
        scene.remove(drop);drops.splice(i,1);
      }
    }
    return melted&&fall>=1&&shineDone&&!drops.length;
  }

  function dispose() {
    shine?.dispose();
    for(const drop of drops)scene.remove(drop);
    drops.length=0;
    scene.remove(candle);
    candle.traverse(object=>{
      object.geometry?.dispose();
      if(object.material){object.material.map?.dispose();object.material.dispose();}
    });
    dropGeometry.dispose();dropMaterial.dispose();
  }

  return {update,dispose,get melted(){return melted;}};
}
