// Reusable painterly effects for KEYNLOCK landmark models. Effects stay in a
// separate group so smoke and window halos never distort the LOD bounds.
import {BUILDING_ATMOSPHERE_DEFAULTS,acquireHouseAtmosphereResources} from '../../modules/house-builder/core/house-atmosphere.js';
import {createBuildingSmokeBatch} from '../../modules/house-builder/core/building-smoke-batch.js';
export const LANDMARK_ATMOSPHERE_DEFAULTS=BUILDING_ATMOSPHERE_DEFAULTS;

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const MOSS_TILE_METRES=3.7;

function excludedIntervals(openings,axis,face,base){
  const intervals=[];
  for(const opening of openings){
    if(opening.position.y>base+1.8)continue;
    const side=Math.abs(Math.sin(opening.rotation.y))>.5;
    if((axis==='x')!==side)continue;
    const facePosition=axis==='x'?opening.position.x:opening.position.z;
    if(Math.abs(facePosition-face)>.32)continue;
    const center=axis==='x'?opening.position.z:opening.position.x;
    const margin=opening.userData.landmarkOpeningWidth*.5+.2;
    intervals.push([center-margin,center+margin]);
  }
  return intervals.sort((a,b)=>a[0]-b[0]);
}

function uncoveredIntervals(min,max,excluded){
  const intervals=[];let start=min;
  for(const [a,b] of excluded){
    if(b<=start||a>=max)continue;
    if(a-start>.3)intervals.push([start,Math.min(a,max)]);
    start=Math.max(start,Math.min(max,b));
  }
  if(max-start>.3)intervals.push([start,max]);
  return intervals;
}

function addMossDecals(T,root,group,map,material){
  const openings=root.children.filter(o=>Number.isFinite(o.userData.landmarkOpeningWidth));
  const decals=[];
  for(const wall of root.children){
    if(!wall.isMesh||wall.geometry.type!=='BoxGeometry'||wall.material.userData.landmarkTexture!=='stone')continue;
    const {width:w,height:h,depth:d}=wall.geometry.parameters;
    const base=wall.position.y-h*.5;
    if(w<3||h<3.4||d<2.5||base>1.05||base<-.1)continue;
    const surfaces=[
      {axis:'z',sign:1,face:wall.position.z+d*.5,lo:wall.position.x-w*.5,hi:wall.position.x+w*.5,rotation:0},
      {axis:'z',sign:-1,face:wall.position.z-d*.5,lo:wall.position.x-w*.5,hi:wall.position.x+w*.5,rotation:Math.PI},
      {axis:'x',sign:1,face:wall.position.x+w*.5,lo:wall.position.z-d*.5,hi:wall.position.z+d*.5,rotation:Math.PI*.5},
      {axis:'x',sign:-1,face:wall.position.x-w*.5,lo:wall.position.z-d*.5,hi:wall.position.z+d*.5,rotation:-Math.PI*.5},
    ];
    for(const side of surfaces){
      const excluded=excludedIntervals(openings,side.axis,side.face,base);
      for(const [a,b] of uncoveredIntervals(side.lo,side.hi,excluded)){
        const length=b-a,geometry=new T.PlaneGeometry(length,1);
        const uv=geometry.getAttribute('uv'),pos=geometry.getAttribute('position');
        const centre=(a+b)*.5;
        for(let i=0;i<uv.count;i++){
          const direction=(side.axis==='z'?side.sign:-side.sign);
          // The painted lichen is concentrated in the bottom of the asset.
          uv.setXY(i,(centre+pos.getX(i)*direction)/MOSS_TILE_METRES,uv.getY(i)*.28);
        }
        uv.needsUpdate=true;
        const decal=new T.Mesh(geometry,material);
        decal.rotation.y=side.rotation;
        decal.position.set(
          side.axis==='x'?side.face+side.sign*.028:centre,
          base+.22+.5,
          side.axis==='z'?side.face+side.sign*.028:centre,
        );
        decal.userData.landmarkMossDecal=true;
        decal.userData.landmarkMossBase=base+.22;
        decal.userData.landmarkMossLength=length;
        decal.renderOrder=1;
        group.add(decal);decals.push(decal);
      }
    }
  }
  return decals;
}

export function createLandmarkAtmosphere(T,model,{settings={},mossMap=null}={}){
  const root=model.group??model;
  const resources=acquireHouseAtmosphereResources(T);
  const group=new T.Group();group.name='KEYNLOCK · гуашевая атмосфера';
  const mossGroup=new T.Group(),smokeGroup=new T.Group(),glowGroup=new T.Group();
  group.add(mossGroup,smokeGroup,glowGroup);
  const mossMaterial=new T.MeshBasicMaterial({
    map:mossMap,transparent:true,opacity:.7,color:'#dce1ce',depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-1,side:T.DoubleSide,
  });
  const decals=addMossDecals(T,root,mossGroup,mossMap,mossMaterial);
  const particles=[];
  const emitters=root.children.filter(o=>o.userData.landmarkSmokeEmitter)
    .map(o=>o.userData.landmarkSmokeEmitter);
  emitters.forEach((origin,emitterIndex)=>{
    for(let i=0;i<6;i++){
      particles.push({x:origin.x,y:origin.y,z:origin.z,origin,
        phase:i/6,seed:emitterIndex*1.97+i*.83});
    }
  });
  const smokeBatch=particles.length?createBuildingSmokeBatch(T,particles,{
    resources,settings,name:'landmark-gouache-smoke',pointScale:880,
  }):null;
  if(smokeBatch)smokeGroup.add(smokeBatch.points);
  const windowOpenings=root.children.filter(o=>
    Number.isFinite(o.userData.landmarkOpeningWidth)&&
    o.children.some(child=>child.userData.landmarkPaintedGlass));
  const stride=Math.max(1,Math.ceil(windowOpenings.length/16));
  const halos=[];
  const glowMaterial=new T.SpriteMaterial({
    map:resources.glowMap,transparent:true,opacity:.18,color:'#ffca81',
    blending:T.AdditiveBlending,depthWrite:false,depthTest:true,
  });
  for(let i=0;i<windowOpenings.length;i+=stride){
    const opening=windowOpenings[i];
    const angle=opening.rotation.y,h=opening.userData.landmarkOpeningHeight,w=opening.userData.landmarkOpeningWidth;
    const glow=new T.Sprite(glowMaterial);
    glow.position.set(
      opening.position.x+Math.sin(angle)*.3,
      opening.position.y+h*.53,
      opening.position.z+Math.cos(angle)*.3,
    );
    glow.scale.set(w*1.75,h*1.3,1);
    glow.userData.landmarkWindowHalo=true;
    glowGroup.add(glow);halos.push(glow);
  }
  const lights=[];
  const candidates=windowOpenings.filter(o=>Math.abs(o.rotation.y)<.15&&o.position.z>0);
  for(const opening of [candidates[0],candidates.at(-1)]){
    if(!opening||lights.length&&opening===candidates[0])continue;
    const light=new T.PointLight('#ffc078',1.1,9,2);
    light.position.set(opening.position.x,opening.position.y+opening.userData.landmarkOpeningHeight*.5,opening.position.z+.75);
    glowGroup.add(light);lights.push(light);
  }
  let options={...LANDMARK_ATMOSPHERE_DEFAULTS,...settings};
  const setSettings=(patch={})=>{
    options={...options,...patch};
    mossGroup.visible=Boolean(options.moss)&&options.mossDensity>0;
    mossMaterial.opacity=Math.min(1,clamp(options.mossDensity,0,100)*.013);
    const height=clamp(options.mossHeight,15,160)/100;
    for(const decal of decals){
      decal.scale.y=height;
      decal.position.y=decal.userData.landmarkMossBase+height*.5;
    }
    smokeGroup.visible=Boolean(options.smoke)&&options.smokeDensity>0&&particles.length>0;
    smokeBatch?.setSettings(options);
    glowGroup.visible=Boolean(options.night)&&options.windowGlow>0;
    const intensity=clamp(options.windowGlow,0,100)/100;
    glowMaterial.opacity=.2*intensity;
    for(const light of lights)light.intensity=1.75*intensity;
    return options;
  };
  const update=(elapsed=0)=>{
    if(smokeGroup.visible)smokeBatch?.update(elapsed);
  };
  setSettings();
  update(0);
  const dispose=()=>{
    for(const decal of decals)decal.geometry.dispose();
    mossMaterial.dispose();glowMaterial.dispose();smokeBatch?.dispose();
    resources.release();group.clear();
    // The gouache moss map belongs to the model's shared texture lease.
  };
  return {group,mossGroup,smokeGroup,glowGroup,decals,particles,smokeBatch,halos,lights,
    setSettings,update,dispose,get settings(){return {...options};}};
}
