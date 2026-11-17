import * as THREE from '../vendor/three.js';
import {PARTS,makePart} from './mechanism-engine.js';

// Capture the installed 3D part geometry with the mechanism's existing WebGL
// renderer. No extra canvas contexts or duplicate material textures are made.
export function captureMechanismThumbnails(types,{renderer,makeModel,pickTargets,disposeObject}){
  if(!renderer.setRenderTarget||!renderer.readRenderTargetPixels)return {};
  const width=128,preview=new THREE.Scene();
  preview.add(new THREE.HemisphereLight(0xf3e6d2,0x36434a,2.7));
  const lamp=new THREE.DirectionalLight(0xffdaaa,3.4);
  lamp.position.set(-2,4,7);preview.add(lamp);
  const fill=new THREE.DirectionalLight(0xa6d6e0,1.5);
  fill.position.set(3,-1,4);preview.add(fill);
  const lens=new THREE.PerspectiveCamera(34,1,.02,40);
  const target=new THREE.WebGLRenderTarget(width,width,{depthBuffer:true,
    format:THREE.RGBAFormat,colorSpace:THREE.SRGBColorSpace});
  const previous=renderer.getRenderTarget();
  const clear=renderer.getClearColor(new THREE.Color()).clone();
  const alpha=renderer.getClearAlpha();
  const pixels=new Uint8Array(width*width*4);
  const surface=document.createElement('canvas');surface.width=surface.height=width;
  const ctx=surface.getContext('2d');
  const out={};
  try{
    renderer.setRenderTarget(target);renderer.setClearColor(0x101a1c,0);
    for(const type of types){
      if(!PARTS[type])continue;
      const part=makePart(type,`thumbnail-${type}`,0,0);
      const model=makeModel(part);
      const pickerIndex=pickTargets.indexOf(model.picker);
      if(pickerIndex>=0)pickTargets.splice(pickerIndex,1);
      model.picker.visible=false;
      model.portsRoot.visible=false;
      preview.add(model.group);
      const box=new THREE.Box3().setFromObject(model.mount)
        .union(new THREE.Box3().setFromObject(model.dynamic));
      const center=box.getCenter(new THREE.Vector3());
      const bounds=box.getSize(new THREE.Vector3());
      const extent=Math.max(bounds.x,bounds.y,bounds.z*.9,.65);
      const distance=Math.max(2.0,extent*1.92);
      lens.position.copy(center).add(new THREE.Vector3(distance*.25,distance*.18,distance));
      lens.lookAt(center);lens.updateProjectionMatrix();
      renderer.clear();renderer.render(preview,lens);
      renderer.readRenderTargetPixels(target,0,0,width,width,pixels);
      const image=ctx.createImageData(width,width);
      for(let y=0;y<width;y++){
        const start=(width-1-y)*width*4;
        image.data.set(pixels.subarray(start,start+width*4),y*width*4);
      }
      ctx.putImageData(image,0,0);
      out[type]=surface.toDataURL('image/png');
      disposeObject(model.group);
    }
  }catch(error){console.warn('3D component thumbnails:',error);}
  finally{
    renderer.setRenderTarget(previous);renderer.setClearColor(clear,alpha);
    target.dispose();
  }
  return out;
}
