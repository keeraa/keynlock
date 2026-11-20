import * as THREE from '../vendor/three.js';
import { KEY_TEMPLATES } from './key-data.js';
import { keyBounds } from './key-shapes.js';
import { metalTest } from './key-coat.js';

// "Freshly cleaned" glint: the metal flashes warm-white for a moment while a
// few four-point stars twinkle on it, one after another.

export const SHINE_SECONDS=1.15;

let starTexture=null;
function getStarTexture() {
  if(starTexture||typeof document==='undefined')return starTexture;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d');
  const glow=ctx.createRadialGradient(32,32,0,32,32,20);
  glow.addColorStop(0,'rgba(255,255,255,1)');glow.addColorStop(1,'rgba(255,248,220,0)');
  ctx.fillStyle=glow;ctx.fillRect(0,0,64,64);
  ctx.fillStyle='#fff';
  ctx.beginPath();
  // Four long thin rays.
  for(const [dx,dy] of [[0,-30],[30,0],[0,30],[-30,0]]) {
    ctx.moveTo(32,32);ctx.lineTo(32+dx+dy*.08,32+dy-dx*.08);ctx.lineTo(32+dx-dy*.08,32+dy+dx*.08);
  }
  ctx.fill();
  starTexture=new THREE.CanvasTexture(canvas);
  starTexture.colorSpace=THREE.SRGBColorSpace;
  return starTexture;
}

export function createShine({keyGroup,design,stars=6}) {
  const template=KEY_TEMPLATES[design.template];
  const bounds=keyBounds(template,design),onMetal=metalTest(template,design);
  const depth=design.thickness/100;
  const metals=[];
  keyGroup.traverse(mesh=>{if(mesh.isMesh&&mesh.userData.exportable!==false&&mesh.material.emissive)metals.push(mesh.material);});
  const originals=metals.map(m=>({color:m.emissive.clone(),intensity:m.emissiveIntensity}));
  const flash=new THREE.Color('#fff1cf');

  // Stars sit on the metal, spread from the head towards the tip.
  const points=[];
  for(let attempt=0;points.length<stars&&attempt<400;attempt++) {
    const slot=points.length/stars;
    const x=bounds.minX+(bounds.maxX-bounds.minX)*(slot+Math.random()/stars);
    const y=bounds.minY+(bounds.maxY-bounds.minY)*Math.random();
    if(onMetal(x,y))points.push([x,y]);
  }
  const material=new THREE.MeshBasicMaterial({map:getStarTexture(),transparent:true,depthWrite:false,
    blending:THREE.AdditiveBlending,color:'#fff6dc'});
  const geometry=new THREE.PlaneGeometry(1,1);
  const sparkles=points.map(([x,y],i)=>{
    const star=new THREE.Mesh(geometry,material.clone());
    star.position.set(x,y,depth+.03);
    star.userData={exportable:false,delay:.08+i*.14,spin:(Math.random()-.5)*2};
    star.scale.setScalar(0);
    keyGroup.add(star);
    return star;
  });

  let elapsed=0;
  function update(dt) {
    elapsed+=dt;
    const k=Math.min(1,elapsed/SHINE_SECONDS);
    // A quick rise and a slower fade of the warm flash.
    const pulse=k<.25?k/.25:Math.max(0,1-(k-.25)/.75);
    metals.forEach((m,i)=>{
      // A gentle warm lift: the emissive colour itself sets the strength.
      m.emissive.copy(originals[i].color).lerp(flash,.22*pulse);
    });
    // Stars face the viewer even when the key is tilted.
    const facing=keyGroup.quaternion.clone().invert();
    for(const star of sparkles) {
      star.quaternion.copy(facing);
      const life=(elapsed-star.userData.delay)/.5;
      const s=life<=0||life>=1?0:Math.sin(Math.PI*life);
      star.scale.setScalar(.55*s);
      star.rotateZ(star.userData.spin*life);
      star.material.opacity=s;
    }
    return elapsed>=SHINE_SECONDS+.1;
  }

  function dispose() {
    metals.forEach((m,i)=>{m.emissive.copy(originals[i].color);m.emissiveIntensity=originals[i].intensity;});
    for(const star of sparkles){keyGroup.remove(star);star.material.dispose();}
    geometry.dispose();material.dispose();
  }
  return {update,dispose};
}
