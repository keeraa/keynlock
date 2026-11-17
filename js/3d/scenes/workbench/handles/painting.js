import * as THREE from 'three';

export function createPaintingSystem({renderer,groups,defs,clay,artSelector,artworkList,onChange}){
let artwork='none';
const imageLoader=new THREE.ImageLoader();
const imageCache=new Map();const imageRequests=new Map();const MAX_CACHED_IMAGES=3;
let flatMaterial=null,rectangleBacking=null,curvedBacking=null,geishaSidePainting=null;
let selectionToken=0;
function loadImage(id,url){
 if(imageCache.has(id))return Promise.resolve(imageCache.get(id));
 if(imageRequests.has(id))return imageRequests.get(id);
 const request=new Promise((resolve,reject)=>imageLoader.load(url,resolve,undefined,reject)).then(image=>{
   imageCache.set(id,image);
   while(imageCache.size>MAX_CACHED_IMAGES)imageCache.delete(imageCache.keys().next().value);
   return image;
 }).finally(()=>imageRequests.delete(id));
 imageRequests.set(id,request);return request;
}
function makeWraparoundArtwork(image,id){
 // Keep the original painting exactly once in the center, extending both edges
 // with mirrored ornamental strokes. The outer edge uses a shared backdrop to
 // make a truly continuous 360-degree wrap with no visible UV seam.
 const scale=Math.min(1,Math.sqrt(2500000/(image.width*2.7*image.height)),2048/image.height);
 const w=Math.max(1,Math.round(image.width*scale)),h=Math.max(1,Math.round(image.height*scale));
 const wide=Math.round(w*2.7),margin=Math.floor((wide-w)/2);
 const canvas=document.createElement('canvas');canvas.width=wide;canvas.height=h;
 const ctx=canvas.getContext('2d');
 const extension=(left)=>{
   const sx=left?0:Math.round(image.width*.65),sw=Math.round(image.width*.35);
   const temp=document.createElement('canvas');temp.width=sw;temp.height=h;
   const t=temp.getContext('2d');t.translate(left?sw:0,0);t.scale(left?-1:1,1);t.drawImage(image,sx,0,sw,image.height,0,0,sw,h);
   const start=left?0:margin+w;
   ctx.drawImage(temp,0,0,sw,h,start,0,margin,h);
 };
 extension(true);extension(false);
 if(id==='geisha'&&geishaSidePainting){
   // Painted outpanels: floral branches/waves extend the original unaltered portrait.
   const side=geishaSidePainting,sideWidth=Math.round(side.width*.35);
   ctx.drawImage(side,0,0,sideWidth,side.height,0,0,margin,h);
   ctx.drawImage(side,side.width-sideWidth,0,sideWidth,side.height,margin+w,0,margin,h);
 }
 ctx.drawImage(image,margin,0,w,h);
 // Symmetrically blend the first and last pixels of the wrap texture.
 // The boundary is identical on both sides and needs just one GPU sample.
 const feather=Math.max(1,Math.round(wide*.07));
 const left=ctx.getImageData(0,0,feather,h),right=ctx.getImageData(wide-feather,0,feather,h);
 const leftData=left.data,rightData=right.data;
 for(let y=0;y<h;y++)for(let x=0;x<feather;x++){
   const a=(y*feather+x)*4,b=(y*feather+feather-1-x)*4;
   const t=(1-x/feather)*.5;
   for(let c=0;c<3;c++){
     const l=leftData[a+c],r=rightData[b+c];
     leftData[a+c]=l+(r-l)*t;
     rightData[b+c]=r+(l-r)*t;
   }
 }
 ctx.putImageData(left,0,0);ctx.putImageData(right,wide-feather,0);
 return canvas;
}
function projectArtworkInShader(material,artworkMap){
 material.onBeforeCompile=shader=>{
   shader.uniforms.projectedArtwork={value:artworkMap};
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHandlePosition;');
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHandlePosition = position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vHandlePosition;\nuniform sampler2D projectedArtwork;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
     // One uninterrupted painting follows the cylindrical circumference.
     float circumference = atan(vHandlePosition.x, vHandlePosition.z);
     vec2 artUv = vec2(.5 + circumference / 6.28318530718, clamp(vHandlePosition.y / 5.4, 0.0, 1.0));
     vec3 artColor = texture2D(projectedArtwork, artUv).rgb;
     diffuseColor.rgb = artColor;
   `);
 };
 material.customProgramCacheKey=()=> 'handle-wraparound-seamless-v4';
 material.needsUpdate=true;
}
function createShapeMaterial(image){
 // The same planar artwork dimensions as the rectangular reference model.
 // Projection uses real X/Y coordinates, so handle circumference never rescales the motif.
 const map=new THREE.Texture(image);map.needsUpdate=true;map.colorSpace=THREE.SRGBColorSpace;
 map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 return new THREE.MeshStandardMaterial({map,roughness:.65,metalness:.08});
}
function disposePainting(){
 flatMaterial?.map?.dispose();flatMaterial?.dispose();flatMaterial=null;
 rectangleBacking?.dispose();rectangleBacking=null;
 curvedBacking?.userData.artworkMap?.dispose();curvedBacking?.dispose();curvedBacking=null;
}
function applyPainting(image,id){
 // Detach old materials before releasing their GPU resources.
 groups.forEach(g=>g.traverse(o=>{if(o.userData.handleBody)o.material=clay}));
 disposePainting();
 if(image){
     flatMaterial=createShapeMaterial(image);
     const extendedCanvas=makeWraparoundArtwork(image,id);
     const extendedMap=new THREE.CanvasTexture(extendedCanvas);
     extendedMap.colorSpace=THREE.SRGBColorSpace;
     extendedMap.wrapS=THREE.RepeatWrapping;
     extendedMap.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
     curvedBacking=new THREE.MeshStandardMaterial({roughness:.7,metalness:.06});
     curvedBacking.userData.artworkMap=extendedMap;
     projectArtworkInShader(curvedBacking,extendedMap);
     const pixelCanvas=document.createElement('canvas');pixelCanvas.width=pixelCanvas.height=1;
     const pixelContext=pixelCanvas.getContext('2d');
     pixelContext.drawImage(image,4,Math.floor(image.height/2),1,1,0,0,1,1);
     const p=pixelContext.getImageData(0,0,1,1).data;
     rectangleBacking=new THREE.MeshStandardMaterial({color:new THREE.Color(`rgb(${p[0]},${p[1]},${p[2]})`),roughness:.7});
 }
 groups.forEach((g,i)=>g.traverse(o=>{
   if(o.userData.handleBody)o.material=image?(defs[i][3]==='rect'?[rectangleBacking,rectangleBacking,rectangleBacking,rectangleBacking,flatMaterial,flatMaterial]:curvedBacking):clay;
 }));
 onChange();
}
async function setArtwork(id){
 artwork=id;artSelector.value=id;const decodance=id.startsWith('decodance'),arabic=id.startsWith('arabic');
 const token=++selectionToken;
 const art=artworkList.find(a=>a[0]===id);
 if(id==='none')applyPainting(null,id);
 else {
   document.getElementById('materialTag').textContent='ЗАГРУЗКА РИСУНКА…';
   try {
     const image=await loadImage(id,art[2]);
     if(token!==selectionToken)return;
     if(id==='geisha'&&!geishaSidePainting){
       geishaSidePainting=await loadImage('geisha-sides','geisha-wide-sides.webp');
       if(token!==selectionToken)return;
     }
     applyPainting(image,id);
   } catch(error){if(token!==selectionToken)return;console.error('Artwork loading failed:',id,error);applyPainting(null,id);document.getElementById('materialTag').textContent='ОШИБКА ЗАГРУЗКИ';return;}
 }
 document.getElementById('materialTag').textContent=decodance?'DECODANCE BLACK':arabic?'ARABIC / ORNAMENT':id==='none'?'CLAY / MATTE':id.toUpperCase()+' / ART';
 document.querySelector('aside img').src=art?.[2]||'geisha-red-fan.webp';
}
return {setArtwork};
}
