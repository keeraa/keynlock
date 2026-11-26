import {reproductionFit} from './reproduction-fit.js';
import {paintingSize,frameTextureIndex,frameCornerCut,clippedFrameCorners} from './painting-geometry.js';
/** Three.js r187-compatible adapter, without an implicit dependency on a specific Three build. */
export class PaintingTexturePool {
  constructor({idleBytes=0, idleMs=30000}={}) {
    this.entries = new Map();
    this.idle = new Map();
    this.idleBytes = 0;
    this.limit = idleBytes;
    this.idleMs = idleMs;
  }
  takeIdle(url) {
    const cached=this.idle.get(url);
    if (!cached) return;
    clearTimeout(cached.timer);
    this.idle.delete(url);
    this.idleBytes-=cached.bytes;
    return cached.texture;
  }
  cacheDetail(url, texture) {
    const {width,height}=texture.image ?? {};
    // RGBA8 and the complete mip chain, including non-square levels.
    let w=width,h=height,bytes=0;
    if (!(w>0 && h>0)) return false;
    while (true) {
      bytes+=w*h*4;
      if (w===1 && h===1) break;
      w=Math.max(1,Math.floor(w/2));h=Math.max(1,Math.floor(h/2));
    }
    if (bytes>this.limit) return false;
    while (this.idleBytes+bytes>this.limit || this.idle.size>=4)
      this.takeIdle(this.idle.keys().next().value).dispose();
    const timer=setTimeout(()=>this.takeIdle(url)?.dispose(),this.idleMs);
    this.idle.set(url,{texture,bytes,timer});this.idleBytes+=bytes;
    return true;
  }
  async acquire(url, load) {
    let entry = this.entries.get(url);
    if (!entry) {
      const cached=this.takeIdle(url);
      entry = { refs: 0, promise: cached ? Promise.resolve(cached) : Promise.resolve().then(load) };
      this.entries.set(url, entry);
      entry.promise.catch(() => { if (this.entries.get(url) === entry) this.entries.delete(url); });
    }
    entry.refs++;
    return entry.promise;
  }
  release(url, reusableDetail=null) {
    const entry = this.entries.get(url);
    if (!entry) return;
    entry.refs--;
    if (entry.refs > 0) return;
    this.entries.delete(url);
    if (this.limit && reusableDetail && this.cacheDetail(url,reusableDetail)) return;
    entry.promise.then(texture => texture.dispose(), () => {});
  }
  disposeAll() {
    for(const url of this.idle.keys()) this.takeIdle(url).dispose();
    for (const [url, entry] of this.entries) {
      this.entries.delete(url);
      entry.promise.then(texture => texture.dispose(), () => {});
    }
  }
}

/** Returns {object, widthM, heightM, dispose}. Await only for visible paintings. */
export async function createPaintingObject({
  THREE, painting, imageUrl, detailUrl = null, pool = null,
  loader = null, loadDetail = null, heightM = null, frameWidthM = 0.0675, frameDepthM = 0.05, gouache = null,
  frameColor = 0x594335, frameHallColor = frameColor, maxAnisotropy = 4,
} = {}) {
  if (!THREE || !painting || !imageUrl) throw new Error('THREE, painting, imageUrl required');
  const {width:w,height:h}=paintingSize(painting,heightM);
  if (![w, h, frameWidthM, frameDepthM].every(Number.isFinite)
    || w <= 0 || h <= 0 || frameWidthM < 0 || frameDepthM <= 0) {
    throw new Error('Invalid painting geometry');
  }
  const textureLoader = loader ?? new THREE.TextureLoader();
  const loadTexture = async url => {
    if(url===detailUrl && loadDetail)return loadDetail(url);
    const t = await textureLoader.loadAsync(url);
    // Finish decoding before the render loop first submits this image to WebGL.
    if (t.image?.decode) {
      try { await t.image.decode(); }
      catch (error) { t.dispose(); throw error; }
    }
    // Prepare HD pixels and their vertical orientation before the render thread uploads them.
    if(url===detailUrl && typeof HTMLImageElement!=='undefined' && t.image instanceof HTMLImageElement &&
        typeof createImageBitmap==='function'){
      try {
        const bitmap=await createImageBitmap(t.image,{imageOrientation:'flipY',premultiplyAlpha:'none'});
        t.image=bitmap;t.flipY=false;t.needsUpdate=true;
        t.addEventListener('dispose',()=>bitmap.close());
      }catch{/* The decoded HTML image is already available on older browsers. */}
    }
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.max(1, maxAnisotropy);
    return t;
  };
  const acquire = url => pool ? pool.acquire(url, () => loadTexture(url)) : loadTexture(url);
  const release = (url, map, reuse=false) => pool ? pool.release(url,reuse ? map : null) : map.dispose();
  const texture = await acquire(imageUrl);
  const object = new THREE.Group();
  object.name = `painting:${painting.id}`;
  object.userData.paintingId = painting.id;
  object.userData.hall = painting.placement.hall;
  object.userData.wall = painting.placement.wall;
  const canvasMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide });
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(w, h), canvasMaterial);
  function hallColor(geometry){
    const color=new THREE.Color(frameHallColor),values=[];
    for(let i=0;i<geometry.attributes.position.count;i++)values.push(color.r,color.g,color.b);
    geometry.setAttribute('archiveHallColor',new THREE.Float32BufferAttribute(values,3));
    geometry.setAttribute('archiveFrameStyle',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(frameTextureIndex(painting)),1));
  }
  hallColor(canvas.geometry);
  // Fill the measured canvas without stretching a slightly cropped or padded preview.
  const uv = canvas.geometry.attributes.uv;
  const originalUV = uv.clone();
  function showMap(map) {
    const pixels = map.image;
    const sourceAspect = pixels?.width && pixels?.height ? pixels.width / pixels.height :
      painting.image.widthPx / painting.image.heightPx;
    const fit = reproductionFit(painting.image, {width:w,height:h}, sourceAspect);
    const fitX = fit.u;
    const fitY = fit.v;
    canvas.scale.set(fit.width/w,fit.height/h,1);
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, .5 + (originalUV.getX(i) - .5) * fitX, .5 + (originalUV.getY(i) - .5) * fitY);
    }
    uv.needsUpdate = true;
    canvasMaterial.map = map;
  }
  showMap(texture);
  if (gouache) {
    const surface = [];
    const pos = canvas.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) surface.push(pos.getX(i) * 2, pos.getY(i) * 4, 0);
    canvas.geometry.setAttribute('archiveSurface', new THREE.Float32BufferAttribute(surface, 3));
    canvas.geometry.setAttribute('archiveFrameHall',new THREE.BufferAttribute(new Float32Array(pos.count),1));
    gouache.apply(canvasMaterial);
  }
  // Keep each reproduction's own crop while the preview dissolves into the HD image.
  canvas.geometry.setAttribute('previewUv',uv.clone());
  const blend={value:1}, previewMap={value:texture};
  let fadeStart=null;
  const compileSurface=canvasMaterial.onBeforeCompile.bind(canvasMaterial);
  const surfaceKey=canvasMaterial.customProgramCacheKey();
  canvasMaterial.customProgramCacheKey=()=>surfaceKey+'-detail-fade';
  canvasMaterial.onBeforeCompile=(shader,renderer)=>{
    compileSurface(shader,renderer);
    Object.assign(shader.uniforms,{previewMap,detailBlend:blend});
    shader.vertexShader='attribute vec2 previewUv; varying vec2 vPreviewUv;\n'+
      shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvPreviewUv=previewUv;');
    shader.fragmentShader='uniform sampler2D previewMap; uniform float detailBlend; varying vec2 vPreviewUv;\n'+
      shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        if(detailBlend<1.0) diffuseColor.rgb=mix(texture2D(previewMap,vPreviewUv).rgb,diffuseColor.rgb,detailBlend);`);
  };
  canvasMaterial.onBeforeRender=()=>{
    if(fadeStart===null)return;
    const t=Math.min(1,(performance.now()-fadeStart)/200);
    blend.value=t*t*(3-2*t);
    if(t===1)fadeStart=null;
  };
  canvas.name = `canvas:${painting.id}`;
  canvas.position.z = frameDepthM * 0.52;
  // A framed canvas is a solid object even when its front image is culled.
  const backing=new THREE.Mesh(new THREE.BoxGeometry(w,h,frameDepthM*.9),new THREE.MeshBasicMaterial({color:frameColor}));
  backing.name=`painting-back:${painting.id}`;
  object.add(backing);
  object.add(canvas);
  const frameMaterial = new THREE.MeshBasicMaterial({ color: frameColor });
  if (gouache) gouache.apply(frameMaterial);
  const frame = new THREE.Mesh(makeFrameGeometry(THREE,w,h,frameWidthM,frameDepthM,Boolean(gouache)),frameMaterial);
  hallColor(frame.geometry);
  frame.name = `frame:${painting.id}`;
  object.add(frame);
  const frameParts=[frame.geometry,backing.geometry];
  if(gouache){
    const surface=[],back=[],positions=backing.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i);
      surface.push(x*1.4,y*3,.72);
      back.push(.5+x/(w+2*frameWidthM),.5+y/(h+2*frameWidthM),Number(positions.getZ(i)<0));
    }
    backing.geometry.setAttribute('archiveSurface',new THREE.Float32BufferAttribute(surface,3));
    backing.geometry.setAttribute('archiveBack',new THREE.Float32BufferAttribute(back,3));
    hallColor(backing.geometry);gouache.apply(backing.material);
    for(const geometry of frameParts){
      geometry.setAttribute('archiveFrameHall',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count),1));
    }
    canvas.geometry.setAttribute('archiveBack',new THREE.BufferAttribute(new Float32Array(canvas.geometry.attributes.position.count*3),3));
  }
  let frameHall=0;
  function setFrameHall(index){
    if(!gouache||frameHall===index)return;
    frameHall=index;
    for(const geometry of frameParts){
      const attribute=geometry.attributes.archiveFrameHall;
      attribute.array.fill(index);attribute.needsUpdate=true;
    }
  }
  let disposed = false, wanted = false, pending = null, highMap = null, retryAfter = 0;
  function setDetail(enabled) {
    wanted = enabled;
    if (!enabled && highMap) {
      fadeStart=null;blend.value=1;showMap(texture);
      release(detailUrl, highMap,true);
      highMap = null;
    }
    if (!enabled || disposed || !detailUrl || highMap || pending || Date.now() < retryAfter) return pending;
    pending = acquire(detailUrl).then(map => {
      if (disposed || !wanted) { release(detailUrl, map); return; }
      highMap = map;
      blend.value=0;fadeStart=performance.now();showMap(map);
    }).catch(() => { retryAfter = Date.now() + 120000; }).finally(() => { pending = null; });
    return pending;
  }
  return {
    object, setDetail, setFrameHall, widthM: w + 2 * frameWidthM, heightM: h + 2 * frameWidthM,
    dispose() {
      if (disposed) return;
      disposed = true;
      setDetail(false);
      canvas.geometry.dispose();
      canvasMaterial.dispose();
      frame.geometry.dispose();
      frameMaterial.dispose();
      backing?.geometry.dispose();
      backing?.material.dispose();
      if (pool) pool.release(imageUrl); else texture.dispose();
    },
  };
}

// A closed, mitred profile keeps the measured outline and the canvas aperture.
function makeFrameGeometry(THREE,width,height,rim,depth,withGrain) {
  const x=width/2,y=height/2,z=depth/2,bevel=Math.min(.004,rim*.18,depth*.085);
  const profile=[
    [x+rim,y+rim,-z,.78],
    [x+rim,y+rim,z-bevel,.84],
    [x+rim-bevel,y+rim-bevel,z,1.20],
    [x+bevel,y+bevel,z,1],
    [x,y,z-bevel,1.12],
    [x,y,-z,.82],
  ];
  const cut=frameCornerCut(width+2*rim,height+2*rim,rim);
  const rings=profile.map(([w,h],index)=>clippedFrameCorners(w,h,index<3?Math.min(cut,w,h):0));
  const steps=rings[0].length;
  const positions=[],uvs=[],grain=[],back=[],indices=[];
  for(let face=0;face<profile.length;face++){
    const outer=profile[face],inner=profile[(face+1)%profile.length],rear=face===profile.length-1;
    const outerCorners=rings[face],innerCorners=rings[(face+1)%profile.length];
    for(let edge=0;edge<steps;edge++){
      const first=positions.length/3,next=(edge+1)%steps;
      const [ax,ay]=outerCorners[edge],[bx,by]=outerCorners[next];
      const vertical=Math.abs(by-ay)>Math.abs(bx-ax)+1e-6;
      for(const [[px,py],pz] of [[outerCorners[edge],outer[2]],[outerCorners[next],outer[2]],
        [innerCorners[next],inner[2]],[innerCorners[edge],inner[2]]]){
        positions.push(px,py,pz);
        const tu=(vertical?py:px)*1.4,tv=((vertical?px:py)+pz)*3;
        uvs.push(tu,tv);
        if(withGrain){
          grain.push(tu,tv,rear ? .72 : outer[3]);
          back.push(.5+px/(width+2*rim),.5+py/(height+2*rim),Number(rear));
        }
      }
      indices.push(first,first+1,first+2,first,first+2,first+3);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  if(withGrain){
    geometry.setAttribute('archiveSurface',new THREE.Float32BufferAttribute(grain,3));
    geometry.setAttribute('archiveBack',new THREE.Float32BufferAttribute(back,3));
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
