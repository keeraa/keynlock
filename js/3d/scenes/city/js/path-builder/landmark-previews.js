import * as THREE from 'three';
import {createLandmarkModel} from '../landmarks/landmark-model.js';
import {acquireLandmarkTextures} from '../landmarks/landmark-textures.js';
import {MODEL_TYPES} from './model-types.js';
import {landmarkTextureImagesReady} from './landmark-preview-ready.js';

const WIDTH=232,HEIGHT=146,ASPECT=WIDTH/HEIGHT;

// TextureLoader returns before its images have decoded. Capturing the canvas
// during that gap turned roof paintings black in the saved thumbnails.
async function awaitLandmarkPaints(maps,timeout=5500){
  const start=performance.now();
  while(!landmarkTextureImagesReady(maps)){
    if(performance.now()-start>=timeout)return false;
    await new Promise(resolve=>setTimeout(resolve,35));
  }
  return true;
}

// GPU-less browsers also receive real model miniatures. Project the low-LOD
// geometry into a small Canvas2D image and shade each triangle by its normal.
function drawOnCanvas(scene,camera,canvas){
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,WIDTH,HEIGHT);
  const faces=[],light=new THREE.Vector3(-.42,.85,.32).normalize();
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  const p0=new THREE.Vector3(),p1=new THREE.Vector3(),p2=new THREE.Vector3();
  const edge1=new THREE.Vector3(),edge2=new THREE.Vector3(),normal=new THREE.Vector3();
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  for(const mesh of scene.children.flatMap(child=>{
    const objects=[];child.traverse(o=>{if(o.isMesh)objects.push(o);});return objects;
  })){
    if(!mesh.visible||!mesh.geometry?.getAttribute('position'))continue;
    const positions=mesh.geometry.getAttribute('position'),indices=mesh.geometry.index;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    const groups=mesh.geometry.groups;
    const count=indices?.count??positions.count;
    for(let i=0;i<count-2;i+=3){
      const index0=indices?indices.getX(i):i,index1=indices?indices.getX(i+1):i+1;
      const index2=indices?indices.getX(i+2):i+2;
      const group=groups.find(g=>i>=g.start&&i<g.start+g.count);
      const material=materials[group?.materialIndex||0]||materials[0];
      if(!material?.color||material.opacity===0)continue;
      a.fromBufferAttribute(positions,index0).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(positions,index1).applyMatrix4(mesh.matrixWorld);
      c.fromBufferAttribute(positions,index2).applyMatrix4(mesh.matrixWorld);
      edge1.subVectors(b,a);edge2.subVectors(c,a);
      normal.crossVectors(edge1,edge2).normalize();
      const shade=.68+Math.max(0,normal.dot(light))*.46;
      p0.copy(a).project(camera);p1.copy(b).project(camera);p2.copy(c).project(camera);
      if([p0,p1,p2].some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)))continue;
      const color=material.color.clone().multiplyScalar(shade);
      faces.push({depth:(a.applyMatrix4(camera.matrixWorldInverse).z+
        b.applyMatrix4(camera.matrixWorldInverse).z+c.applyMatrix4(camera.matrixWorldInverse).z)/3,
        points:[[p0.x,p0.y],[p1.x,p1.y],[p2.x,p2.y]],
        fill:color.getStyle(),alpha:material.transparent?Math.max(.2,material.opacity):1});
    }
  }
  faces.sort((left,right)=>left.depth-right.depth);
  for(const face of faces){
    ctx.globalAlpha=face.alpha;ctx.fillStyle=face.fill;ctx.strokeStyle=face.fill;
    ctx.beginPath();for(const [i,p] of face.points.entries()){
      const x=(p[0]+1)*WIDTH/2,y=(1-p[1])*HEIGHT/2;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.closePath();ctx.fill();ctx.lineWidth=.7;ctx.stroke();
  }
  ctx.globalAlpha=1;
}

/** Render the six real landmark models to small, reusable catalogue pictures. */
export async function populateLandmarkPreviews(){
  const holders=[...document.querySelectorAll('[data-landmark-preview]')];
  if(!holders.length)return;
  let renderer;
  try{
    renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,
      powerPreference:'low-power'});
    renderer.setSize(WIDTH,HEIGHT,false);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.57;
  }catch(error){console.info('Using CPU model thumbnails:',error.message);}
  const fallbackCanvas=document.createElement('canvas');
  fallbackCanvas.width=WIDTH;fallbackCanvas.height=HEIGHT;
  const scene=new THREE.Scene();scene.background=null;
  scene.add(new THREE.HemisphereLight('#fff9e3','#899c95',3.1));
  const sun=new THREE.DirectionalLight('#fff1d3',3.8);sun.position.set(-24,39,48);scene.add(sun);
  const fill=new THREE.DirectionalLight('#c2d9d1',1.15);fill.position.set(24,22,-27);scene.add(fill);
  const camera=new THREE.OrthographicCamera(-10*ASPECT,10*ASPECT,10,-10,.1,1100);
  // Keep the shared paint atlas alive throughout all six previews, so
  // disposing one miniature cannot invalidate the next one's textures.
  const paintings=renderer?acquireLandmarkTextures(THREE):null;
  const paintingsReady=paintings?await awaitLandmarkPaints(paintings.maps):false;
  for(const holder of holders){
    const type=holder.dataset.landmarkPreview;
    if(MODEL_TYPES[type]?.kind!=='landmark')continue;
    let model;
    try{
      model=createLandmarkModel(THREE,type,{detail:'low'});
      model.group.scale.setScalar(MODEL_TYPES[type].scale);
      scene.add(model.group);model.group.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(model.group);
      const center=box.getCenter(new THREE.Vector3());
      const direction=new THREE.Vector3(1,.68,1.25).normalize();
      camera.position.copy(center).addScaledVector(direction,180);
      camera.lookAt(center);camera.updateMatrixWorld(true);
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])
        for(const z of [box.min.z,box.max.z]){
          const v=new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
          minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);
          minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);
        }
      const half=Math.max((maxX-minX)/ASPECT,maxY-minY)*.6;
      camera.left=-half*ASPECT;camera.right=half*ASPECT;
      camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();
      // A failed/slow texture request uses the fully lit CPU miniature.
      // It never produces a black screenshot of an unfinished GPU atlas.
      if(renderer&&paintingsReady)renderer.render(scene,camera);
      else drawOnCanvas(scene,camera,fallbackCanvas);
      const picture=document.createElement('img');
      picture.src=(renderer&&paintingsReady?renderer.domElement:fallbackCanvas).toDataURL('image/png');
      picture.alt=`Миниатюра модели «${MODEL_TYPES[type].label}»`;
      picture.width=WIDTH;picture.height=HEIGHT;picture.loading='lazy';
      holder.replaceChildren(picture);
    }catch(error){console.warn('Could not generate thumbnail for',type,error);}
    finally{if(model){scene.remove(model.group);model.dispose();}}
  }
  paintings?.release();renderer?.dispose();
}
