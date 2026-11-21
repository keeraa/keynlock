import {DISTRICTS} from '../world-data.js';
import {gouacheAssetUrl} from '../../modules/keynlock-materials/index.js';
import {GROUND_PALETTES} from '../../modules/keynlock-materials/ground-palettes.js';
import {LANDSCAPE_BOUNDS} from './landscape-model.js';
import {paintRiverUnion} from './river-art.js';
import {KEYNLOCK_WATER_MASK_URL,KEYNLOCK_SHORE_WASH_URL} from './keynlock-geography.js';

// One shared, world-aligned gouache canvas for both editors. Grass, dampness
// and wear are painted into this material, without any vegetation geometry.
// Preserve the approved GPU atlas resolution as the world dimensions change.
// Base pigments retain their gouache detail through the cropped source image.
export const GROUND_MAP=Object.freeze({...LANDSCAPE_BOUNDS,
  pixelsPerMetre:2112/LANDSCAPE_BOUNDS.width});
const {width:WORLD_W,depth:WORLD_D,pixelsPerMetre:PPM}=GROUND_MAP;
const WIDTH=WORLD_W*PPM,HEIGHT=WORLD_D*PPM;
// The actual hand-painted material is a single atlas-sized layer; its source
// is cropped to the map's aspect ratio, so no tiled seams cross the city.
export const GROUND_GOUACHE_URL=gouacheAssetUrl('ground','earth');
export const GROUND_GRASS_URL=gouacheAssetUrl('ground','grass');
const PALETTES=GROUND_PALETTES;
export const GROUND_DISTRICTS=Object.freeze(DISTRICTS.map(item=>({id:item.id,name:item.name})));
export const GROUND_PRESETS=Object.freeze(PALETTES);
export const DEFAULT_GROUND_SETTINGS=Object.freeze({district:'old',grass:35,grassSaturation:55,moisture:37,wear:48});
const clamp=(value)=>Math.max(0,Math.min(100,Math.round(Number(value)||0)));
const alphaHex=value=>Math.round(Math.max(0,Math.min(.99,value))*255).toString(16).padStart(2,'0');
export function resolveGroundSettings(value={}){
  const district=PALETTES[value.district]?value.district:'old';
  const defaults=PALETTES[district];
  return {district,grass:clamp(value.grass??defaults.grass),
    grassSaturation:clamp(value.grassSaturation??DEFAULT_GROUND_SETTINGS.grassSaturation),
    moisture:clamp(value.moisture??defaults.moisture),wear:clamp(value.wear??defaults.wear)};
}
function seeded(seed){
  let n=seed>>>0;
  return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
}
const toPixel=(x,z)=>[(x+WORLD_W/2)*PPM,(z+WORLD_D/2)*PPM];
const groundWidth=(path,mode='auto')=>
  Math.max((mode==='street'||(mode==='auto'&&path.pavingType==='street'))?2.72:1.66,
    path.width||0);

const smooth=t=>t*t*(3-2*t);
function fieldNoise(x,z){
  const hash=(i,j)=>{
    let n=(Math.imul(i,374761393)+Math.imul(j,668265263)+1442695041)>>>0;
    n=Math.imul(n^(n>>>13),1274126177);
    return ((n^(n>>>16))>>>0)/4294967295;
  };
  const i=Math.floor(x),j=Math.floor(z),u=smooth(x-i),v=smooth(z-j);
  const a=hash(i,j)*(1-u)+hash(i+1,j)*u;
  const b=hash(i,j+1)*(1-u)+hash(i+1,j+1)*u;
  return a*(1-v)+b*v;
}

// Soft, elongated, hand-painted stains preserve the source texture underneath.
function paintWash(ctx,x,y,radiusX,radiusY,rotation,color,intensity){
  ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.scale(radiusX,radiusY);
  const g=ctx.createRadialGradient(-.12,.08,.04,0,0,1);
  g.addColorStop(0,`${color}${alphaHex(intensity)}`);
  g.addColorStop(.55,`${color}${alphaHex(intensity*.48)}`);
  g.addColorStop(1,`${color}00`);
  ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();
}

function paintPaper(ctx,config,gouache){
  const colors=PALETTES[config.district],rand=seeded(87133);
  ctx.fillStyle=colors.base;ctx.fillRect(0,0,WIDTH,HEIGHT);
  if(gouache){
    const sourceWidth=gouache.naturalWidth||gouache.width;
    const sourceHeight=gouache.naturalHeight||gouache.height;
    const cropWidth=Math.min(sourceWidth,sourceHeight*WIDTH/HEIGHT);
    const cropHeight=cropWidth*HEIGHT/WIDTH;
    ctx.save();
    // Palette-tinted gouache retains each district's identity and lets the
    // existing moisture / grass / wear washes sit naturally over the paint.
    ctx.globalAlpha=.61;
    ctx.drawImage(gouache,(sourceWidth-cropWidth)/2,(sourceHeight-cropHeight)/2,
      cropWidth,cropHeight,0,0,WIDTH,HEIGHT);
    ctx.restore();
  }
  // Paper stippling and the original painting are fixed until the district or
  // source image changes. Sliders should never regenerate thousands of flecks.
  for(let i=0;i<(gouache?5500:24000);i++){
    ctx.fillStyle=rand()>.51?'rgba(245,234,203,.085)':'rgba(82,91,73,.063)';
    ctx.fillRect(rand()*WIDTH,rand()*HEIGHT,.5+rand()*1.6,.5+rand()*1.1);
  }
}

function paintBase(ctx,config,paper,grassArtwork){
  const colors=PALETTES[config.district],rand=seeded(87133);
  ctx.drawImage(paper,0,0);
  // Broad translucent gouache washes, uneven earth, and distant moss.
  for(let i=0;i<390;i++){
    const x=rand()*WIDTH,y=rand()*HEIGHT;
    const radius=(2.1+rand()*11.1)*PPM*(i%5===0?1.4:1);
    const tint=i%5===0?colors.earth:i%3===0?colors.wash:colors.grassColor;
    const density=i%3===0?config.moisture:config.grass;
    const alpha=(.055+density*.0010)*(i%4===0?1.6:1);
    const gradient=ctx.createRadialGradient(x,y,0,x,y,radius);
    gradient.addColorStop(0,`${tint}${Math.round(alpha*255).toString(16).padStart(2,'0')}`);
    gradient.addColorStop(1,`${tint}00`);
    ctx.fillStyle=gradient;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  paintOpenGround(ctx,config,grassArtwork);
  paintWear(ctx,config);
  paintMoisture(ctx,config);
}

function paintOpenGround(ctx,config,grassArtwork){
  if(!config.grass)return;
  const rand=seeded(327491),palette=PALETTES[config.district];
  const coverage=config.grass/100,saturation=config.grassSaturation/100;
  // At 100% the earth becomes a visibly painted, varied lawn. The muted base
  // wash and differently sized patches keep the original gouache granulation.
  ctx.fillStyle=`${palette.grassColor}${alphaHex(.26*coverage)}`;
  ctx.fillRect(0,0,WIDTH,HEIGHT);
  const patches=Math.round(24+coverage*135);
  for(let i=0;i<patches;i++){
    const radius=(2.1+rand()*7.3)*PPM;
    paintWash(ctx,rand()*WIDTH,rand()*HEIGHT,radius,radius*(.45+rand()*.9),
      rand()*Math.PI*2,palette.grassColor,(.20+.46*coverage)*(.72+rand()*.28));
  }
  // One hand-painted gouache texture supplies real brush bristles and strokes.
  // It fills the complete ground atlas without repeated-tile seams or geometry.
  if(grassArtwork){
    const sourceWidth=grassArtwork.naturalWidth||grassArtwork.width;
    const sourceHeight=grassArtwork.naturalHeight||grassArtwork.height;
    const cropWidth=Math.min(sourceWidth,sourceHeight*WIDTH/HEIGHT);
    const cropHeight=cropWidth*HEIGHT/WIDTH;
    ctx.save();
    ctx.globalAlpha=(.14+.62*saturation)*coverage;
    ctx.filter=`saturate(${Math.round(60+135*saturation)}%)`;
    ctx.drawImage(grassArtwork,(sourceWidth-cropWidth)/2,(sourceHeight-cropHeight)/2,
      cropWidth,cropHeight,0,0,WIDTH,HEIGHT);
    ctx.restore();
  }
  // Keep the saturation control effective even before the artwork loads.
  ctx.fillStyle=`rgba(47,124,53,${(.17*saturation*coverage).toFixed(3)})`;
  ctx.fillRect(0,0,WIDTH,HEIGHT);
  // Broad, horizontal dry-brush flecks are part of the ground texture rather
  // than upright grass needles. The field mask clusters the pigment naturally.
  ctx.save();ctx.lineCap='round';
  for(let layer=0;layer<3;layer++){
    ctx.strokeStyle=layer===0?`rgba(58,111,57,${(.12+.20*coverage).toFixed(3)})`:
      layer===1?`rgba(167,191,126,${(.11+.19*coverage).toFixed(3)})`:
      `rgba(104,149,86,${(.10+.18*coverage).toFixed(3)})`;
    ctx.lineWidth=1.25+layer*.85;ctx.beginPath();
    for(let i=0;i<Math.round(grassArtwork?160+coverage*430:260+coverage*1250);i++){
      const x=rand()*WIDTH,y=rand()*HEIGHT;
      if(fieldNoise(x/125+1.7,y/110+4.1)<.59-.27*coverage)continue;
      const length=4+rand()*13;
      ctx.moveTo(x,y);ctx.lineTo(x+length,y+(rand()-.5)*length*.35);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function paintWear(ctx,config){
  const wear=config.wear/100;
  if(!wear)return;
  const rand=seeded(84722);
  // Wear exposes ochre-brown ground through the painted grass and adds scuffs.
  ctx.fillStyle=`rgba(147,108,76,${(.29*wear).toFixed(3)})`;
  ctx.fillRect(0,0,WIDTH,HEIGHT);
  for(let i=0;i<Math.round(15+wear*145);i++){
    const radius=(1.9+rand()*8.8)*PPM;
    paintWash(ctx,rand()*WIDTH,rand()*HEIGHT,radius,radius*(.38+rand()*.85),
      rand()*Math.PI*2,PALETTES[config.district].earth,(.17+.43*wear)*(.65+rand()*.35));
  }
  ctx.save();ctx.strokeStyle=`rgba(107,88,66,${(.19*wear).toFixed(3)})`;
  ctx.lineWidth=1.1+wear;ctx.lineCap='round';ctx.beginPath();
  for(let i=0;i<Math.round(750*wear);i++){
    const x=rand()*WIDTH,y=rand()*HEIGHT,length=4+rand()*12;
    ctx.moveTo(x,y);ctx.lineTo(x+length,y+(rand()-.5)*4);
  }
  ctx.stroke();ctx.restore();
}

function paintMoisture(ctx,config){
  const wet=config.moisture/100;
  if(!wet)return;
  const rand=seeded(67322);
  // Cool olive-gray pigment visibly darkens damp earth across the entire map;
  // irregular translucent stains create a soaked-watercolor effect at 100%.
  ctx.fillStyle=`rgba(65,84,82,${(.34*wet).toFixed(3)})`;
  ctx.fillRect(0,0,WIDTH,HEIGHT);
  for(let i=0;i<Math.round(18+wet*108);i++){
    const radius=(2.8+rand()*8.9)*PPM;
    paintWash(ctx,rand()*WIDTH,rand()*HEIGHT,radius,radius*(.4+rand()*.95),
      rand()*Math.PI*2,'#4b6d68',(.10+.34*wet)*(.75+rand()*.25));
  }
}

function paintedLot(ctx,building){
  const [x,y]=toPixel(building.x,building.z);
  const halfW=building.width*PPM/2,halfD=building.depth*PPM/2;
  const industrial=building.type==='workshop';
  ctx.save();ctx.translate(x,y);ctx.rotate(-(building.rotation||0));
  // Rectangular foundation shadow with continuous fading on EVERY side.
  // The central rectangle is hidden below the building; only feathered
  // pigment extends into grass. No hard dark border or canvas shadow cut-off.
  const feather=2.7*PPM,inset=.4*PPM;
  const shade=industrial?'rgba(55,57,39,':'rgba(31,59,36,';
  const opacity=industrial?.36:.39;
  const color=a=>`${shade}${a.toFixed(3)})`;
  ctx.fillStyle=color(opacity);
  ctx.fillRect(-halfW+inset,-halfD+inset,2*(halfW-inset),2*(halfD-inset));
  const sides=[
    [-halfW+feather,-halfD-feather,2*(halfW-feather),feather+inset,0,-halfD-feather,0,-halfD+inset],
    [-halfW+feather,halfD-inset,2*(halfW-feather),feather+inset,0,halfD+feather,0,halfD-inset],
    [-halfW-feather,-halfD+feather,feather+inset,2*(halfD-feather),-halfW-feather,0,-halfW+inset,0],
    [halfW-inset,-halfD+feather,feather+inset,2*(halfD-feather),halfW+feather,0,halfW-inset,0],
  ];
  for(const [sx,sy,sw,sh,x0,y0,x1,y1] of sides){
    if(sw<=0||sh<=0)continue;
    const gradient=ctx.createLinearGradient(x0,y0,x1,y1);
    gradient.addColorStop(0,color(0));gradient.addColorStop(.58,color(opacity*.45));
    gradient.addColorStop(1,color(opacity));
    ctx.fillStyle=gradient;ctx.fillRect(sx,sy,sw,sh);
  }
  for(const cx of [-halfW+feather,halfW-feather])for(const cy of [-halfD+feather,halfD-feather]){
    const grad=ctx.createRadialGradient(cx,cy,Math.max(0,feather*.06),cx,cy,feather*1.85);
    grad.addColorStop(0,color(opacity));grad.addColorStop(.42,color(opacity*.68));
    grad.addColorStop(1,color(0));
    ctx.fillStyle=grad;ctx.fillRect(cx-feather*1.85,cy-feather*1.85,feather*3.7,feather*3.7);
  }
  // A diffuse, watercolor-green wash softens the transition at the perimeter.
  paintWash(ctx,0,0,halfW+2.7*PPM,halfD+2.7*PPM,0,
    industrial?'#4b503b':'#35513a',industrial?.20:.26);
  ctx.restore();
}

function paintedRoadMargins(ctx,layout,config,pavingMode){
  for(const path of layout.paths||[]){
    if(path.p.length<2)continue;
    ctx.lineJoin='round';ctx.lineCap='round';
    for(const layer of [2.9,1.9,.9]){
      ctx.beginPath();ctx.moveTo(...toPixel(...path.p[0]));
      for(const point of path.p.slice(1))ctx.lineTo(...toPixel(...point));
      ctx.lineWidth=(groundWidth(path,pavingMode)+layer)*PPM;
      ctx.strokeStyle=layer===2.9?'rgba(105,91,66,.062)':
        layer===1.9?`rgba(153,131,96,${.10+config.wear*.0012})`:
        `rgba(175,153,115,${.08+config.wear*.0008})`;
      ctx.stroke();
    }
  }
}

// Hill washes live in the shared gouache atlas. All river water and banks are
// composited as one union in river-art.js, independent of stroke overlap.
function paintedLandscape(ctx,landscape){
  for(const hill of landscape.hills||[]){
    const [x,y]=toPixel(hill.x,hill.z),r=hill.radius*PPM;
    paintWash(ctx,x-r*.12,y-r*.15,r*1.15,r*.92,-.18,'#5b7451',Math.min(.28,.10+hill.height*.025));
    paintWash(ctx,x+r*.18,y+r*.26,r*.85,r*.78,.24,'#bdad75',Math.min(.28,.11+hill.height*.027));
    paintWash(ctx,x-r*.27,y-r*.25,r*.75,r*.54,-.38,'#d9d3a1',Math.min(.21,.075+hill.height*.012));
  }
}

export function createGroundSurface({onUpdate,composeFor2D=true}={}){
  const canvas=composeFor2D?document.createElement('canvas'):null;
  if(canvas){canvas.width=WIDTH;canvas.height=HEIGHT;}
  const ctx=canvas?.getContext('2d',{alpha:false});
  const paper=document.createElement('canvas');paper.width=WIDTH;paper.height=HEIGHT;
  const paperCtx=paper.getContext('2d',{alpha:false});
  const base=document.createElement('canvas');base.width=WIDTH;base.height=HEIGHT;
  const bctx=base.getContext('2d',{alpha:false});
  const decals=document.createElement('canvas');decals.width=WIDTH;decals.height=HEIGHT;
  const dctx=decals.getContext('2d',{alpha:true});
  const water=document.createElement('canvas');water.width=WIDTH;water.height=HEIGHT;
  const waterCtx=water.getContext('2d',{alpha:true});
  const shore=document.createElement('canvas');shore.width=WIDTH;shore.height=HEIGHT;
  const shoreCtx=shore.getContext('2d',{alpha:true});
  const mask=document.createElement('canvas');mask.width=WIDTH;mask.height=HEIGHT;
  const maskCtx=mask.getContext('2d',{alpha:true});
  let paperKey='',baseKey='',decalsKey='',waterKey='',lastPlan={paths:[],plazas:[]},lastBuildings=[],lastSettings=DEFAULT_GROUND_SETTINGS;
  let lastPavingMode='auto',lastLandscape={rivers:[],hills:[]},gouache=null,grassArtwork=null,disposed=false;
  let referenceWater=null,referenceShore=null;
  const images=[];
  function setPlan(buildings=[],layout={paths:[],plazas:[]},settings=DEFAULT_GROUND_SETTINGS,pavingMode='auto',landscape={rivers:[],hills:[]}){
    lastPlan=layout;lastBuildings=buildings;lastSettings=resolveGroundSettings(settings);lastPavingMode=pavingMode;lastLandscape=landscape;
    const nextPaperKey=JSON.stringify([lastSettings.district,Boolean(gouache)]);
    if(nextPaperKey!==paperKey){paintPaper(paperCtx,lastSettings,gouache);paperKey=nextPaperKey;baseKey='';}
    const nextBaseKey=JSON.stringify([lastSettings,Boolean(grassArtwork)]);
    const baseChanged=nextBaseKey!==baseKey;
    if(baseChanged){paintBase(bctx,lastSettings,paper,grassArtwork);baseKey=nextBaseKey;}
    const nextWaterKey=JSON.stringify([Boolean(referenceWater),Boolean(referenceShore),landscape.rivers||[]]);
    const waterChanged=nextWaterKey!==waterKey;
    if(waterChanged){
      paintRiverUnion({rivers:landscape.rivers||[],water:waterCtx,shore:shoreCtx,
        mask:maskCtx,width:WIDTH,height:HEIGHT,ppm:PPM,worldWidth:WORLD_W,worldDepth:WORLD_D,
        referenceWater,referenceShore});
      waterKey=nextWaterKey;
    }
    // Layout decals are independent of grass/saturation/moisture. Moving a
    // building updates only this transparent atlas in WebGL.
    const nextDecalsKey=JSON.stringify([buildings.map(b=>[b.type,b.x,b.z,b.width,b.depth,b.rotation]),
      (layout.paths||[]).map(p=>[p.p,p.pavingType,p.width]),lastSettings.wear,pavingMode,
      landscape.hills||[],landscape.rivers||[],
      Boolean(referenceWater),Boolean(referenceShore)]);
    const decalsChanged=nextDecalsKey!==decalsKey;
    if(decalsChanged){
      dctx.clearRect(0,0,WIDTH,HEIGHT);
      paintedLandscape(dctx,{hills:landscape.hills||[]});
      for(const building of buildings)paintedLot(dctx,building);
      paintedRoadMargins(dctx,layout,lastSettings,pavingMode);
      // Bank pigment belongs to the terrain, while Three.js draws water at
      // its own fixed level. Only the 2D fallback needs the water in decals.
      dctx.drawImage(shore,0,0);
      if(composeFor2D)dctx.drawImage(water,0,0);
      decalsKey=nextDecalsKey;
    }
    if(ctx&&(baseChanged||decalsChanged)){
      ctx.drawImage(base,0,0);ctx.drawImage(decals,0,0);
    }
    return {baseChanged,decalsChanged,waterChanged};
  }
  setPlan();
  if(typeof Image!=='undefined'){
    for(const [key,url] of [['earth',GROUND_GOUACHE_URL],['grass',GROUND_GRASS_URL],
      ['coast',KEYNLOCK_WATER_MASK_URL],['shore',KEYNLOCK_SHORE_WASH_URL]]){
      const image=new Image();image.decoding='async';images.push(image);
      image.onload=()=>{
        if(disposed)return;
        if(key==='earth'){gouache=image;paperKey='';}
        else if(key==='grass'){grassArtwork=image;baseKey='';}
        else if(key==='coast')referenceWater=image;
        else referenceShore=image;
        onUpdate?.(setPlan(lastBuildings,lastPlan,lastSettings,lastPavingMode,lastLandscape));
      };
      // Failed image loads preserve the deterministic canvas-drawn fallback.
      image.src=url;
    }
  }
  return {canvas,baseCanvas:base,decalsCanvas:decals,waterCanvas:water,
    setPlan,getSettings:()=>lastSettings,
    dispose(){
      disposed=true;
      for(const image of images){image.onload=null;image.onerror=null;}
      images.length=0;
      gouache=null;grassArtwork=null;referenceWater=null;referenceShore=null;
      // These atlases occupy tens of MB; release backing stores when the
      // editor scene is closed, even if an old scene reference remains.
      for(const surface of [canvas,paper,base,decals,water,shore,mask]){
        if(surface){surface.width=0;surface.height=0;}
      }
    }};
}
