import * as THREE from '../vendor/three-core.js';
import {createSpurGear} from './lock-profiles.js';

// One IKEA-style exploded drawing. Every outline is projected from an actual
// 3D primitive or gear; there are no shaded meshes or stage-by-stage images.
export function manualIllustration(pinOrder=[2,0,3,1],{ratio='12:16',hardware=false}={}){
  const root=new THREE.Group(),meshes=[],curves=[],labels=[];
  const mesh=(geometry,x,y,z,rotationZ=0)=>{
    const obj=new THREE.Mesh(geometry);
    obj.position.set(x,y,z);obj.rotation.z=rotationZ;
    root.add(obj);meshes.push(obj);return obj;
  };
  const box=(x,y,z,w,h,d)=>mesh(new THREE.BoxGeometry(w,h,d),x,y,z);
  const cylinder=(x,y,z,r,h,axis='y')=>mesh(
    new THREE.CylinderGeometry(r,r,h,14),x,y,z,axis==='x'?Math.PI/2:0);
  const curve=(points)=>curves.push(points.map(p=>new THREE.Vector3(...p)));
  const arrow=(x,from,to,z=.52)=>{
    curve([[x,from,z],[x,to,z]]);
    const direction=Math.sign(to-from);
    curve([[x-.08,to-direction*.12,z],[x,to,z],[x+.08,to-direction*.12,z]]);
  };

  // Fixed housing and an exploded core beneath it.
  box(-1.18,-.36,-.03,3.28,.66,.67);
  cylinder(-1.18,-1.15,.14,.26,2.85,'x');
  cylinder(-2.61,-1.15,.14,.12,.08,'x');
  arrow(-1.18,-.94,-.72);
  // Individual pins and springs above their four actual channels.
  const xs=[-2.24,-1.51,-.78,-.05];
  xs.forEach((x,i)=>{
    cylinder(x,.36,.02,.09,.35+pinOrder[i]*.045);
    cylinder(x,-.10,.37,.12,.16);
    arrow(x,.13,-.02);
    const spring=Array.from({length:45},(_,j)=>{
      const t=j/44,theta=t*Math.PI*10;
      return [x+Math.cos(theta)*.082,.69+t*.42,Math.sin(theta)*.082];
    });
    curve(spring);arrow(x,.65,.56);
    labels.push({text:['I','II','III','IV'][pinOrder[i]],at:[x,.51,.22]});
  });
  box(-1.18,1.40,-.06,3.38,.13,.65);
  arrow(-1.18,1.25,1.10);
  // The actual gears follow the chosen transmission rather than a preset icon.
  const inkMaterial=new THREE.MeshBasicMaterial();
  const gearTeeth=ratio==='16:12'?[16,12]:[12,16];
  const gearA=createSpurGear(THREE,gearTeeth[0],gearTeeth[0]===12?.32:.43,.13,inkMaterial);
  gearA.position.set(1.08,-.46,.19);root.add(gearA);meshes.push(gearA);
  const gearB=createSpurGear(THREE,gearTeeth[1],gearTeeth[1]===12?.32:.43,.13,inkMaterial);
  gearB.position.set(1.87,-.46,.19);root.add(gearB);meshes.push(gearB);
  cylinder(1.87,.38,.19,.19,.17,'y');
  arrow(1.87,.17,-.04,.42);
  labels.push({text:String(gearTeeth[0]),at:[1.08,-1.08,.22]},
    {text:String(gearTeeth[1]),at:[1.87,-1.08,.22]});
  if(hardware){
    // The five add-on parts are shown in the same projected exploded view.
    mesh(new THREE.RingGeometry(.085,.21,28),1.08,.16,.46);
    mesh(new THREE.RingGeometry(.085,.21,28),1.87,.16,.46);
    mesh(new THREE.TorusGeometry(.16,.027,8,30,Math.PI*1.76),1.87,.59,.48,.38);
    box(2.46,-.18,.49,.66,.09,.12);
    box(2.72,-.52,.42,.63,.20,.20);
    arrow(1.08,.02,-.23,.50);arrow(1.87,.43,.26,.50);
    labels.push({text:'×2',at:[1.48,.28,.58]},
      {text:'СТ',at:[2.18,.69,.50]},{text:'Т',at:[2.48,.01,.52]},
      {text:'З',at:[2.99,-.63,.46]});
  }

  root.updateMatrixWorld(true);
  const camera=new THREE.OrthographicCamera(-4,4,2.4,-2.4,.1,50);
  camera.position.set(5.2,4.4,12);camera.lookAt(-.08,.08,0);
  camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
  const projected=[];
  const project=p=>p.clone().project(camera);
  for(const item of meshes){
    const edges=new THREE.EdgesGeometry(item.geometry,27);
    const positions=edges.getAttribute('position');
    for(let i=0;i<positions.count;i+=2){
      const a=project(new THREE.Vector3().fromBufferAttribute(positions,i)
        .applyMatrix4(item.matrixWorld));
      const b=project(new THREE.Vector3().fromBufferAttribute(positions,i+1)
        .applyMatrix4(item.matrixWorld));
      projected.push([a,b]);
    }
    edges.dispose();item.geometry.dispose();
  }
  inkMaterial.dispose();
  for(const points of curves)for(let i=1;i<points.length;i++)
    projected.push([project(points[i-1]),project(points[i])]);
  const allPoints=projected.flat();
  const xs2=allPoints.map(p=>p.x),ys2=allPoints.map(p=>p.y);
  const minX=Math.min(...xs2),maxX=Math.max(...xs2);
  const minY=Math.min(...ys2),maxY=Math.max(...ys2);
  const scale=Math.min(494/(maxX-minX),216/(maxY-minY));
  const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
  const xy=p=>[280+(p.x-centerX)*scale,165-(p.y-centerY)*scale];
  const paths=projected.map(([a,b])=>{
    const [ax,ay]=xy(a),[bx,by]=xy(b);
    return `M${ax.toFixed(1)} ${ay.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`;
  }).join('');
  const texts=labels.map(({text,at})=>{
    const [x,y]=xy(project(new THREE.Vector3(...at)));
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="#293434">${text}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 310" role="img" aria-label="Единая объёмная контурная схема сборки замка">
    <rect width="560" height="310" fill="#f7f7f1"/>
    <rect x="9" y="9" width="542" height="292" fill="none" stroke="#c8cfca" stroke-width="1.5"/>
    <text x="24" y="29" fill="#36443e" font-family="Arial,sans-serif" font-size="12" font-weight="700">KEYNLOCK · СБОРОЧНЫЙ ЛИСТ</text>
    <text x="536" y="29" text-anchor="end" fill="#52605a" font-family="Arial,sans-serif" font-size="11">01 / 01</text>
    <path d="${paths}" fill="none" stroke="#273532" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>
    ${texts}
    <line x1="24" y1="279" x2="536" y2="279" stroke="#a7b4ac"/>
    <text x="24" y="295" fill="#53605a" font-family="Arial,sans-serif" font-size="11">${hardware?18:13} ДЕТАЛЕЙ · ПЕРЕДАЧА ${ratio} · РАЗНЕСЁННЫЕ ЭЛЕМЕНТЫ</text>
  </svg>`;
}
