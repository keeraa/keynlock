import {getHouseDimensions,normalizeHouseConfig} from './house-config.js';
import {windowLayout} from './house-layout.js';
import {HOUSE_MOSS_TEXTURE} from './house-texture-assets.js';
import {gouacheAssetUrlByFile} from '../../keynlock-materials/index.js';

// One atmosphere vocabulary for ordinary houses, districts and landmarks.
export const BUILDING_ATMOSPHERE_DEFAULTS=Object.freeze({
  moss:true,mossDensity:62,mossHeight:85,
  glassGloss:74,glassReflection:46,
  smoke:true,smokeDensity:62,smokeOutline:true,
  night:false,windowGlow:67,
});
export const BUILDING_ATMOSPHERE_KEY='keynlock-building-atmosphere-v1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const resourcesByThree=new WeakMap();
// Long-lived, slowly rising plumes share their timing in the house editor,
// the landmark editor, street quarters and the instanced city renderer.
export const BUILDING_SMOKE_RISE=11.2;
export const BUILDING_SMOKE_RATE=.09;
export function buildingSmokeFade(age){
  const t=clamp(age,0,1);
  return t<=.56?1:Math.pow(Math.max(0,(1-t)/.44),.55);
}

export function loadBuildingAtmosphereSettings(){
  if(typeof localStorage==='undefined')return {...BUILDING_ATMOSPHERE_DEFAULTS};
  const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{return {};}};
  // Carry over the settings from the first, landmark-only implementation.
  return {...BUILDING_ATMOSPHERE_DEFAULTS,...read('keynlock-landmark-atmosphere-v1'),...read(BUILDING_ATMOSPHERE_KEY)};
}
export function saveBuildingAtmosphereSettings(settings){
  try{localStorage.setItem(BUILDING_ATMOSPHERE_KEY,JSON.stringify(settings));}catch{}
}

function smokeMap(T,outlined){
  if(typeof document==='undefined'){
    const map=new T.DataTexture(new Uint8Array([224,224,210,200]),1,1,T.RGBAFormat);
    map.needsUpdate=true;return map;
  }
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const c=canvas.getContext('2d');c.translate(64,64);
  c.beginPath();
  for(let i=0;i<=36;i++){
    const angle=i*Math.PI/18,radius=40+4*Math.sin(i*2.1)+3*Math.sin(i*4.9);
    const x=Math.cos(angle)*radius,y=Math.sin(angle)*radius;
    if(i)c.lineTo(x,y);else c.moveTo(x,y);
  }
  c.closePath();c.fillStyle='rgba(224,225,209,.8)';c.fill();
  if(outlined){c.strokeStyle='rgba(54,66,64,.65)';c.lineWidth=5;c.lineJoin='round';c.stroke();}
  let seed=91273;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<135;i++){
    const x=(rand()-.5)*78,y=(rand()-.5)*75;
    if(x*x+y*y>1510)continue;
    c.globalAlpha=.10+rand()*.22;c.fillStyle=rand()>.5?'#f6f3df':'#a1aea8';
    c.beginPath();c.ellipse(x,y,2+rand()*6,.7+rand()*3,rand()*3,0,Math.PI*2);c.fill();
  }
  c.globalAlpha=1;
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;return map;
}

function windowGlowMap(T){
  if(typeof document==='undefined'){
    const map=new T.DataTexture(new Uint8Array([255,206,131,175]),1,1,T.RGBAFormat);
    map.needsUpdate=true;return map;
  }
  const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
  const c=canvas.getContext('2d'),g=c.createRadialGradient(48,48,2,48,48,47);
  g.addColorStop(0,'rgba(255,227,161,.72)');g.addColorStop(.32,'rgba(255,188,105,.24)');
  g.addColorStop(1,'rgba(255,176,88,0)');
  c.fillStyle=g;c.fillRect(0,0,96,96);
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;return map;
}

export function acquireHouseAtmosphereResources(T){
  let resource=resourcesByThree.get(T);
  if(!resource){
    let mossMap=null;
    if(typeof document!=='undefined'){
      mossMap=new T.TextureLoader().load(gouacheAssetUrlByFile('house',HOUSE_MOSS_TEXTURE));
      mossMap.colorSpace=T.SRGBColorSpace;
      mossMap.wrapS=T.MirroredRepeatWrapping;mossMap.wrapT=T.ClampToEdgeWrapping;
      mossMap.anisotropy=4;
    }
    const smokeMaps=[smokeMap(T,false),smokeMap(T,true)];
    const glowMap=windowGlowMap(T);
    const mossMaterial=new T.MeshBasicMaterial({map:mossMap,transparent:true,opacity:.81,
      color:'#dce1ce',side:T.DoubleSide,depthWrite:false,
      polygonOffset:true,polygonOffsetFactor:-1});
    const glowMaterial=new T.SpriteMaterial({map:glowMap,color:'#ffd198',
      transparent:true,opacity:.14,blending:T.AdditiveBlending,depthWrite:false});
    resource={refs:0,mossMap,smokeMaps,glowMap,mossMaterial,glowMaterial};
    resourcesByThree.set(T,resource);
  }
  resource.refs++;
  let released=false;
  return {...resource,release(){
    if(released)return;
    released=true;
    if(--resource.refs)return;
    resource.mossMap?.dispose();resource.smokeMaps.forEach(map=>map.dispose());
    resource.glowMap.dispose();resource.mossMaterial.dispose();resource.glowMaterial.dispose();
    resourcesByThree.delete(T);
  }};
}

export function houseChimneyOutlet(rawConfig){
  const c=normalizeHouseConfig(rawConfig);
  if(!c.chimney)return null;
  const wallTop=.32+getHouseDimensions(c).walls;
  const x=c.width*.22,z=-c.depth*.22;
  const roofBase=c.roofType==='flat'?wallTop+.3:wallTop+c.roofHeight*(1-Math.abs(x)/(c.width/2));
  const topY=Math.max(roofBase+.85,wallTop+(c.roofType==='flat'?.95:c.roofHeight+.56));
  return {x,y:topY+.13,z,roofBase,topY};
}

// The texture has pigment only in its bottom quarter. Map that painted band
// across the desired height, and project separate strips over the protruding
// foundation, stone course and plaster. They are one draw call per house.
export function createHouseMossGeometry(T,rawConfig,{height=.85}={}){
  const c=normalizeHouseConfig(rawConfig),positions=[],uvs=[],indices=[],segments=[];
  function quad(a,b,d,e,start,end){
    const n=positions.length/3;
    for(const p of [a,b,d,e]){positions.push(p[0],p[1],p[2]);uvs.push(p[3],p[4]);}
    indices.push(n,n+1,n+2,n+1,n+3,n+2);
    segments.push({index:n,start,end});
  }
  function face(axis,coord,min,max,sign){
    const intervals=axis==='z'&&sign>0?[[min,-1.18],[1.18,max]]:[[min,max]];
    const bands=[[0,.4,.183],[.4,.52,.096],[.52,1.6,.054]];
    for(const [lo,hi] of intervals){
      if(hi<=lo+.12)continue;
      for(const [bottom,top,offset] of bands){
        const plane=coord+sign*offset,uv0=lo/3.7,uv1=hi/3.7;
        const point=(t,y,u)=>axis==='z'?[t,y,plane,u,0]:[plane,y,t,u,0];
        quad(point(lo,bottom,uv0),point(hi,bottom,uv1),point(lo,top,uv0),point(hi,top,uv1),bottom,top);
      }
    }
  }
  face('z',c.depth/2,-c.width/2,c.width/2,1);
  face('z',-c.depth/2,-c.width/2,c.width/2,-1);
  face('x',c.width/2,-c.depth/2,c.depth/2,1);
  face('x',-c.width/2,-c.depth/2,c.depth/2,-1);
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  geometry.userData.mossSegments=segments;
  setHouseMossGeometryHeight(geometry,height);
  return geometry;
}

// The same vertex buffers serve every slider value. Lower bands retain their
// separate foundation offsets; upper bands simply collapse below their base.
export function setHouseMossGeometryHeight(geometry,height){
  const mossHeight=clamp(height,.15,1.6);
  const positions=geometry.getAttribute('position'),uvs=geometry.getAttribute('uv');
  for(const {index,start,end} of geometry.userData.mossSegments){
    const bottom=Math.min(start,mossHeight),top=Math.min(end,mossHeight);
    for(let i=0;i<4;i++){
      const y=i<2?bottom:top;
      positions.setY(index+i,y);
      uvs.setY(index+i,y/mossHeight*.28);
    }
  }
  positions.needsUpdate=true;uvs.needsUpdate=true;
  geometry.computeBoundingSphere();
}

export function createHouseAtmosphere(T,rawConfig,{detail='high',settings={},editorLight=false,smokeParticles=true}={}){
  const config=normalizeHouseConfig(rawConfig);
  const resources=acquireHouseAtmosphereResources(T);
  const group=new T.Group(),mossGroup=new T.Group(),smokeGroup=new T.Group(),glowGroup=new T.Group();
  group.name='KEYNLOCK · атмосфера городского дома';
  group.add(mossGroup,smokeGroup,glowGroup);
  let renderedMossHeight=clamp(settings.mossHeight??BUILDING_ATMOSPHERE_DEFAULTS.mossHeight,15,160)*.01;
  const moss=new T.Mesh(createHouseMossGeometry(T,config,{height:renderedMossHeight}),resources.mossMaterial);
  moss.renderOrder=2;
  moss.userData.houseMoss=true;mossGroup.add(moss);
  const particles=[];
  const chimney=houseChimneyOutlet(config);
  if(chimney&&smokeParticles)for(let i=0;i<(detail==='low'?2:detail==='medium'?3:4);i++){
    const material=new T.SpriteMaterial({map:resources.smokeMaps[1],transparent:true,
      color:'#dbe0d5',opacity:.2,depthWrite:false,fog:true});
    const sprite=new T.Sprite(material);sprite.userData.houseSmoke=true;
    smokeGroup.add(sprite);particles.push({sprite,phase:i/(detail==='low'?2:detail==='medium'?3:4),seed:i*1.47});
  }
  const windows=windowLayout(config),halos=[];
  const stride=Math.max(1,Math.ceil(windows.front.length/(detail==='low'?2:4)));
  for(let i=0;i<windows.front.length;i+=stride){
    const window=windows.front[i];
    const sprite=new T.Sprite(resources.glowMaterial);
    sprite.position.set(window.x,window.y+.08,config.depth/2+.24);
    sprite.scale.set(window.width*1.8,2.2,1);
    sprite.userData.houseWindowHalo=true;
    glowGroup.add(sprite);halos.push(sprite);
  }
  const lights=[];
  if(editorLight&&windows.front.length){
    const window=windows.front[Math.floor(windows.front.length/2)];
    const light=new T.PointLight('#ffbd79',0,7,2);
    light.position.set(window.x,window.y+.1,config.depth/2+.75);
    glowGroup.add(light);lights.push(light);
  }
  let options={...BUILDING_ATMOSPHERE_DEFAULTS,...settings};
  let near=true;
  function setSettings(patch={}){
    options={...options,...patch};
    mossGroup.visible=Boolean(options.moss)&&options.mossDensity>0;
    resources.mossMaterial.opacity=Math.min(1,clamp(options.mossDensity,0,100)*.013);
    const height=clamp(options.mossHeight,15,160)*.01;
    if(height!==renderedMossHeight){
      setHouseMossGeometryHeight(moss.geometry,height);
      renderedMossHeight=height;
    }
    smokeGroup.visible=Boolean(options.smoke)&&options.smokeDensity>0&&particles.length>0&&near;
    for(const particle of particles){
      const map=resources.smokeMaps[options.smokeOutline?1:0];
      if(particle.sprite.material.map!==map){particle.sprite.material.map=map;particle.sprite.material.needsUpdate=true;}
    }
    glowGroup.visible=Boolean(options.night)&&options.windowGlow>0&&near;
    resources.glowMaterial.opacity=.23*clamp(options.windowGlow,0,100)/100;
    for(const light of lights)light.intensity=1.7*clamp(options.windowGlow,0,100)/100;
  }
  function setNear(value){
    const next=Boolean(value);
    if(near!==next){near=next;setSettings();}
  }
  function update(seconds=0){
    if(!smokeGroup.visible||!chimney)return;
    const density=clamp(options.smokeDensity,0,100)/100;
    for(const {sprite,phase,seed} of particles){
      const age=(seconds*BUILDING_SMOKE_RATE+phase)%1;
      sprite.position.set(chimney.x+Math.sin(age*6+seed)*age*.65,
        chimney.y-.16+age*BUILDING_SMOKE_RISE,chimney.z+Math.cos(age*5+seed)*age*.7);
      const size=.56+age*2.9;sprite.scale.set(size,size,1);
      sprite.material.opacity=.52*buildingSmokeFade(age)*density;
    }
  }
  function dispose(){
    moss.geometry.dispose();particles.forEach(({sprite})=>sprite.material.dispose());
    group.clear();resources.release();
  }
  setSettings();
  update(0);
  return {group,mossGroup,smokeGroup,glowGroup,moss,particles,halos,lights,
    setSettings,setNear,update,dispose,get settings(){return {...options}}};
}

export function makePaintedGlassEnvironment(T,renderer){
  if(!renderer||typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const c=canvas.getContext('2d');const gradient=c.createLinearGradient(0,0,0,256);
  for(const [p,color] of [[0,'#8da5ac'],[.45,'#dce5dc'],[.53,'#eed9bb'],[1,'#72817a']])gradient.addColorStop(p,color);
  c.fillStyle=gradient;c.fillRect(0,0,512,256);
  for(const [x,w,a] of [[73,61,.44],[206,26,.32],[358,82,.42]]){
    const shine=c.createLinearGradient(x,0,x+w,0);
    shine.addColorStop(0,'rgba(255,248,224,0)');shine.addColorStop(.5,`rgba(255,248,224,${a})`);
    shine.addColorStop(1,'rgba(255,248,224,0)');c.fillStyle=shine;c.fillRect(x,15,w,225);
  }
  const source=new T.CanvasTexture(canvas);source.mapping=T.EquirectangularReflectionMapping;
  source.colorSpace=T.SRGBColorSpace;
  try{
    const generator=new T.PMREMGenerator(renderer),target=generator.fromEquirectangular(source);
    generator.dispose();source.dispose();return target;
  }catch(error){console.warn('Недоступно отражение стекла',error);source.dispose();return null;}
}
