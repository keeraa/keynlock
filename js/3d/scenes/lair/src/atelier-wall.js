/**
 * Atelier de Couleur gallery inside the Keynlock lair.
 * The thirty-metre salon uses the original atelier's layout coordinates,
 * column captions and one-piece frame profile. Its data comes from the
 * origin-checked restoration bridge; nothing is silently replaced by a demo.
 */
const WALL_WIDTH = 30;
const WALL_TOP = 11.85;
const WALL_CAPACITY = 30;
const LOCAL_FEATURED = new Map([
  ['girl-pearl', '/restoration-paintings/vermeer-girl.jpg'],
  ['starry-night', '/restoration-paintings/vangogh-starry.jpg'],
  ['great-wave', '/restoration-paintings/hokusai-wave.jpg'],
  ['mona-lisa', '/restoration-paintings/leonardo-mona.jpg'],
  ['vangogh-self', '/restoration-paintings/vangogh-self.jpg'],
]);

const vertex = /* glsl */`
varying vec2 vUv;
void main() {
  vUv=uv;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;
// The identical HSV correction used on the original restoration easels.
const fragment = /* glsl */`
uniform sampler2D uPainting;
uniform float uHue;
uniform float uSaturation;
uniform float uBrightness;
varying vec2 vUv;
vec3 rgb2hsv(vec3 c) {
  vec4 K=vec4(0.,-1./3.,2./3.,-1.);
  vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
  vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
  float d=q.x-min(q.w,q.y);
  return vec3(abs(q.z+(q.w-q.y)/(6.*d+1.e-10)),d/(q.x+1.e-10),q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec3 p=abs(fract(c.xxx+vec3(0.,2./3.,1./3.))*6.-3.);
  return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);
}
void main() {
  vec3 hsv=rgb2hsv(texture2D(uPainting,vUv).rgb);
  hsv.x=fract(hsv.x+uHue/360.+1.);
  hsv.y=clamp(hsv.y*uSaturation,0.,1.);
  hsv.z=clamp(hsv.z*uBrightness,0.,1.);
  gl_FragColor=vec4(hsv2rgb(hsv),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function makeFrame(THREE, width, height, rim = .052, depth = .044) {
  const shape = new THREE.Shape();
  const w = width / 2 + rim, h = height / 2 + rim;
  shape.moveTo(-w,-h);shape.lineTo(w,-h);shape.lineTo(w,h);
  shape.lineTo(-w,h);shape.closePath();
  const aperture = new THREE.Path();
  aperture.moveTo(-width/2,-height/2);aperture.lineTo(-width/2,height/2);
  aperture.lineTo(width/2,height/2);aperture.lineTo(width/2,-height/2);
  aperture.closePath();shape.holes.push(aperture);
  return new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:false,curveSegments:1});
}

function tintMaterial(THREE, texture, correction = {}) {
  return new THREE.ShaderMaterial({
    uniforms:{
      uPainting:{value:texture},
      uHue:{value:correction.hue ?? 0},
      uSaturation:{value:(correction.saturation ?? 100)/100},
      uBrightness:{value:(correction.brightness ?? 100)/100},
    },
    vertexShader:vertex,fragmentShader:fragment,side:THREE.FrontSide,
  });
}

function updateTint(material, correction = {}) {
  material.uniforms.uHue.value=correction.hue ?? 0;
  material.uniforms.uSaturation.value=(correction.saturation ?? 100)/100;
  material.uniforms.uBrightness.value=(correction.brightness ?? 100)/100;
}

export function createAtelierWall({ THREE, parent, materials, canvases }) {
  const root = new THREE.Group();
  root.name = 'atelier-original-salon-wall';
  // Rotation maps the 30m original gallery X axis onto the extended left Z wall.
  root.position.set(-8.28,0,9.64);
  root.rotation.y=Math.PI/2;
  parent.add(root);
  const paintingsRoot = new THREE.Group();
  paintingsRoot.name='atelier-restored-frames';
  root.add(paintingsRoot);
  const headings = new THREE.Group();
  headings.name='atelier-twelve-columns';
  root.add(headings);
  const captions = document.createElement('canvas');
  captions.width=4096;captions.height=192;
  const ctx=captions.getContext('2d');
  const captionTexture=new THREE.CanvasTexture(captions);
  captionTexture.colorSpace=THREE.SRGBColorSpace;
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(WALL_WIDTH,.81),
    new THREE.MeshBasicMaterial({map:captionTexture,transparent:true,depthWrite:false,toneMapped:false})
  );
  strip.name='twelve-art-history-column-headings';
  strip.userData.excludeFromInk=true;
  strip.position.set(0,WALL_TOP-.42,.035);
  headings.add(strip);

  const items=new Map();
  const originalFrameMaterial=new THREE.MeshStandardMaterial({color:'#b7b3ab',roughness:1});
  const previewCache=new Map();
  const backingMaterial=new THREE.MeshStandardMaterial({color:'#b29e7d',roughness:1});
  const imageLoader=new THREE.TextureLoader();
  let request=0;
  let easelRequest=0;
  let lastLayoutSignature='';
  let activeId=null;
  let activeAspect=null;
  let layerMeshes=[];
  let snapshotRequest=0;
  let currentSettings={};

  function drawColumns(columns=[]) {
    ctx.clearRect(0,0,captions.width,captions.height);
    const step=captions.width/Math.max(columns.length,1);
    for (const [index,column] of columns.entries()) {
      const center=(index+.5)*step;
      const [name,subtitle]=(column.label||'').toUpperCase().split(' · ');
      ctx.fillStyle='#f0dcb6';
      ctx.font='600 37px Manrope,sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(name,center,subtitle?73:90,step-26);
      if(subtitle){ctx.font='500 26px Manrope,sans-serif';ctx.fillText(subtitle,center,116,step-26);}
      ctx.fillStyle='rgba(240,220,182,.45)';
      ctx.fillRect(center-step*.38,157,step*.76,2);
    }
    captionTexture.needsUpdate=true;
  }

  function localArtworkURL(art) {
    return LOCAL_FEATURED.get(art.id)||art.image;
  }

  async function previewFor(art) {
    const url=localArtworkURL(art);
    if(previewCache.has(url))return previewCache.get(url);
    const pending=new Promise(resolve=>{
      // A neutral canvas is retained when a remote painting is unreachable.
      const image=new Image();
      image.crossOrigin='anonymous';
      const timer=setTimeout(()=>{image.onload=image.onerror=null;resolve(null);},13000);
      image.onload=()=>{
        clearTimeout(timer);
        const aspect=image.naturalWidth/image.naturalHeight;
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(Math.min(480,480*aspect)));
        canvas.height=Math.max(1,Math.round(Math.min(480,480/aspect)));
        canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
        const texture=new THREE.CanvasTexture(canvas);
        texture.colorSpace=THREE.SRGBColorSpace;
        resolve(texture);
      };
      image.onerror=()=>{clearTimeout(timer);resolve(null);};
      image.src=url;
    });
    previewCache.set(url,pending);
    return pending;
  }

  function clearPaintings() {
    for (const item of items.values()) {
      paintingsRoot.remove(item.mount);
      item.backing.geometry.dispose();
      item.image.geometry.dispose();
      item.image.material.dispose();
      item.frame.geometry.dispose();
    }
    items.clear();
  }

  async function setState(data) {
    if(!data || !Array.isArray(data.placements) || !Array.isArray(data.paintings))return;
    const next=++request;
    currentSettings=data.settings||{};
    drawColumns(data.columns);
    const byId=new Map(data.paintings.map(art=>[art.id,art]));
    const placements=data.placements.slice(0,WALL_CAPACITY);
    const newSignature=placements.map(p=>[p.id,p.x,p.y,p.width,p.height].join(':')).join('|');
    if(lastLayoutSignature!==newSignature)clearPaintings();
    lastLayoutSignature=newSignature;
    for(const placement of placements) {
      const art=byId.get(placement.id);
      if(!art)continue;
      let item=items.get(art.id);
      if(!item) {
        const mount=new THREE.Group();
        mount.name=`restored-${art.id}`;
        mount.position.set(placement.x,placement.y,0);
        paintingsRoot.add(mount);
        const backing=new THREE.Mesh(
          new THREE.BoxGeometry(placement.outerWidth,placement.outerHeight,.022),backingMaterial);
        backing.position.z=.012;
        backing.castShadow=backing.receiveShadow=true;
        mount.add(backing);
        const image=new THREE.Mesh(
          new THREE.PlaneGeometry(placement.width,placement.height),
          tintMaterial(THREE,null,currentSettings[art.id]));
        image.position.z=.058;
        image.visible=false;
        image.userData.galleryId=art.id;
        mount.add(image);
        const frame=new THREE.Mesh(
          makeFrame(THREE,placement.width,placement.height,placement.frameWidth,.044),
          originalFrameMaterial);
        frame.position.z=.028;
        frame.castShadow=frame.receiveShadow=true;
        mount.add(frame);
        item={mount,backing,image,frame,art};
        items.set(art.id,item);
      }
      updateTint(item.image.material,currentSettings[art.id]);
      item.art=art;
      void previewFor(art).then(texture=>{
        if(request!==next || !items.has(art.id))return;
        item.image.material.uniforms.uPainting.value=texture;
        item.image.visible=Boolean(texture);
      });
    }
    const previousActive=activeId;
    activeId=data.selectedId||null;
    if(previousActive!==activeId){clearSnapshot();canvases.work.patina.visible=true;}
    const current=byId.get(activeId)||data.activePainting;
    if(current){
      const player=currentSettings[activeId]||{};
      const restoredTint={
        hue:(current.hue??0)+(player.hue??0),
        saturation:100*(current.saturation??1)*(player.saturation??100)/100,
        brightness:100*(current.brightness??1)*(player.brightness??100)/100,
      };
      if(previousActive===activeId&&Math.abs((activeAspect??0)-(current.aspect??1))<.001
        &&canvases.work.artwork.material.isShaderMaterial){
        updateTint(canvases.work.artwork.material,restoredTint);
      }else void updateEasels(current,restoredTint);
    }
  }

  async function updateEasels(art,correction={}) {
    const current=art.id;
    const task=++easelRequest;
    const texture=await previewFor(art);
    if(task!==easelRequest || !texture)return;
    const aspect=art.aspect||texture.image.width/Math.max(1,texture.image.height);
    const height=Math.min(2.28,2.17/Math.max(.1,aspect));
    const width=height*aspect;
    activeAspect=aspect;
    // Source art on the reference, corrected art and real retouching on the work.
    for(const [type,canvas] of Object.entries(canvases)) {
      canvas.group.scale.set(width/2.17,height/1.74,1);
      canvas.group.position.y=1.45+height/2;
      const old=canvas.artwork.material;
      canvas.artwork.material=tintMaterial(THREE,texture,type==='work'?correction:{});
      old.dispose();
      canvas.artwork.visible=true;
      if(canvas.patina)canvas.patina.visible=type==='work'&&layerMeshes.length===0;
    }
    activeId=current;
  }

  function clearSnapshot() {
    for(const mesh of layerMeshes) {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.map?.dispose();
      mesh.material.dispose();
    }
    layerMeshes=[];
  }

  async function setSnapshot({id,snapshot}) {
    const next=++snapshotRequest;
    if(id!==activeId || !snapshot?.layers)return;
    const keys=['varnish','cracks','loss','dirt','dust'];
    const decoded=await Promise.all(keys.map(async key=>{
      const blob=snapshot.layers[key];
      return blob instanceof Blob?createImageBitmap(blob).catch(()=>null):null;
    }));
    if(next!==snapshotRequest || id!==activeId) {
      decoded.forEach(image=>image?.close?.());
      return;
    }
    clearSnapshot();
    const canvas=canvases.work;
    canvas.patina && (canvas.patina.visible=false);
    decoded.forEach((image,index)=>{
      if(!image)return;
      const el=document.createElement('canvas');
      el.width=image.width;el.height=image.height;
      el.getContext('2d').drawImage(image,0,0);
      image.close?.();
      const texture=new THREE.CanvasTexture(el);
      texture.colorSpace=THREE.SRGBColorSpace;
      const mat=new THREE.MeshBasicMaterial({map:texture,transparent:true,
        opacity:.999,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2.08,1.65),mat);
      mesh.position.z=.075+index*.004;
      mesh.renderOrder=4+index;
      mesh.userData.excludeFromInk=true;
      canvas.group.add(mesh);
      layerMeshes.push(mesh);
    });
  }

  return {
    root,paintingsRoot,
    setState,
    setSnapshot,
    getArtCount:()=>items.size,
    getArtIds:()=>[...items.keys()],
    getActivePaintingId:()=>activeId,
    dispose(){clearPaintings();clearSnapshot();captionTexture.dispose();},
  };
}
