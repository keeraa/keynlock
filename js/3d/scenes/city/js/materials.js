import * as THREE from 'three';

const COLORS = Object.freeze({
  land: '#8fa482', beach: '#d3c39f', wetSand: '#b2ad91',
  cobble: '#a9a292', quay: '#aaa697', road: '#b5b0a0', paving: '#c5bdab',
  stonePath: '#b3ab99', lawn: '#83977b', meadow: '#9caa8a',
  soil: '#b6a28a', crops: '#71885d', grain: '#b5aa6a', hedge: '#4b6d57',
  stone: '#c9bba2', pale: '#e0d3ba', plaster: '#cfb99a', timber: '#876d58',
  darkTimber: '#5d5149', brick: '#9b6656', darkBrick: '#79544d',
  industrial: '#a47867', ochre: '#c69a70', rose: '#bd8b83',
  palaceWall: '#d8ccb8', palaceBase: '#8b897d', iron: '#555d5b',
  roofSlate: '#566a70', roofSlateLight: '#6c7b7a', roofRed: '#a76655',
  roofOchre: '#ad8564', roofJade: '#557d75', roofBlue: '#647f8e',
  roofDark: '#4d5b60', roofCopper: '#63796f',
  roofPalace: '#6b827b', roofTile: '#8f5848', windows: '#454f4f',
  litWindow: '#bba478', greenery: '#647b66', greenDark: '#455f58',
  sea: '#668f96', river: '#68959b', seabed: '#b6bba1', foam: '#bdd1c3', sail: '#e2d3b4',
  flowers: '#af8c84', paths: '#d1bca0',
});
const ROOFS = {slate:'#566a70',terracotta:'#a76655',jade:'#557d75'};
const WALLS = {warm:'#c9bba2',cool:'#9daeb0'};

function seeded(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(1664525,state) + 1013904223) >>> 0) / 4294967296);
}

function hash(s) { let n=2166136261; for(const c of s) n=Math.imul(n^c.charCodeAt(0),16777619); return n>>>0; }
/** Deterministic, tileable-looking gouache albedo used on real 3D surfaces. */
function paintTexture(hex,key,opts) {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d',{alpha:false});
  ctx.fillStyle=hex;ctx.fillRect(0,0,256,256);
  const random=seeded(hash(key));
  const color=new THREE.Color(hex);
  const channel=(v,multiply)=>Math.max(0,Math.min(255,Math.round(v*255*multiply)));
  const strength=opts.paintStrength/100;
  const detail=opts.paintDetail/100;
  const strokeCount=Math.round(125+detail*390);
  for(let i=0;i<strokeCount;i++) {
    const x=random()*278-11,y=random()*276-10;
    const broad=(1-detail*.7),landscape=['land','meadow','lawn'].includes(key);
    const width=(landscape?5+random()*19:9+random()*35)*broad;
    const height=(landscape?1.2+random()*2.6:1.5+random()*4.4)*broad;
    const change=.82+random()*.37;
    const r=channel(color.r,change),g=channel(color.g,change),b=channel(color.b,change);
    ctx.save();ctx.translate(x,y);ctx.rotate((random()-.5)*.65);
    ctx.fillStyle=`rgba(${r},${g},${b},${(.045+random()*(landscape?.15:.26))*strength})`;
    ctx.beginPath();ctx.ellipse(0,0,width,height,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  if(['road','cobble','paving','quay','stonePath'].includes(key)) {
    // Offset courses of individual, slightly imperfect stone setts. Drawing the
    // seams into one tile avoids a second transparent road mesh (and z-fighting).
    // The same mortar pitch is used across boulevards, lanes, doorsteps and plazas.
    const columns=9,rows=13;
    const cw=256/columns,ch=256/rows;
    ctx.fillStyle='rgba(52,56,52,.15)';ctx.fillRect(0,0,256,256);
    for(let row=0;row<rows;row++)for(let col=-1;col<=columns;col++) {
      const offset=(row%2)*cw*.5;
      const x=col*cw+offset,y=row*ch;
      const gap=1.15+random()*.8;
      const variation=.88+random()*.19;
      const r=channel(color.r,variation),g=channel(color.g,variation),b=channel(color.b,variation);
      ctx.fillStyle=`rgb(${r},${g},${b})`;
      ctx.beginPath();ctx.roundRect(x+gap,y+gap*.85,cw-gap*2,ch-gap*1.7,1.7+random()*1.7);ctx.fill();
      ctx.strokeStyle=`rgba(247,242,225,${.05+random()*.12})`;
      ctx.lineWidth=.5+random()*.55;
      ctx.beginPath();ctx.moveTo(x+gap+2,y+gap+2);ctx.lineTo(x+cw-gap-2,y+gap+2);ctx.stroke();
      if(random()>.48){
        ctx.strokeStyle='rgba(66,72,67,.075)';ctx.lineWidth=.7;
        ctx.beginPath();ctx.moveTo(x+5,y+ch*.62);ctx.lineTo(x+cw*.47,y+ch*.58+random()*3);ctx.stroke();
      }
    }
  }
  for(let i=0;i<1300;i++) {
    const value=random()>.51?248:39;
    ctx.fillStyle=`rgba(${value},${value},${value},${(.012+random()*.025)*strength})`;
    ctx.fillRect(random()*256,random()*256,random()*1.8+.35,random()*1.4+.35);
  }
  if(key==='land'||key==='meadow') {
    // Tiny transparent gouache blades add readable grass grain in an isometric view.
    for(let i=0;i<1750;i++){
      const x=random()*256,y=random()*256;
      const length=1.3+random()*5.3;
      ctx.strokeStyle=random()>.46?'rgba(51,83,55,.10)':'rgba(231,221,158,.095)';
      ctx.lineWidth=.32+random()*.78;
      ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+.65,y-length*.6,x+(random()-.5)*2.7,y-length);ctx.stroke();
    }
  }
  if(key==='seabed') {
    // Sandy underwater ridges, softly scattered rather than striped.
    for(let i=0;i<440;i++) {
      const x=random()*280-12,y=random()*264-4,length=5+random()*23;
      ctx.strokeStyle=random()>.52?'rgba(56,74,66,.055)':'rgba(248,234,179,.075)';
      ctx.lineWidth=.35+random()*.95;
      ctx.beginPath();ctx.moveTo(x,y);
      ctx.quadraticCurveTo(x+length*.52,y-1.5-random()*2,x+length,y+random()*3);
      ctx.stroke();
    }
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.RepeatWrapping;
  texture.anisotropy=4;
  return texture;
}
export class CityMaterials {
  constructor() {
    this.options={paint:true,paintStrength:95,paintMaterial:90,paintDetail:2,roof:'slate',wall:'warm'};
    this.materials=new Map();this.textures=new Map();
  }
  color(key) {
    if(key==='roofNeutral')return ROOFS[this.options.roof];
    if(key==='stone')return WALLS[this.options.wall];
    if(key==='plaster')return this.options.wall==='cool'?'#b4bcba':COLORS.plaster;
    return COLORS[key]||'#a5a398';
  }
  get(key) {
    if(this.materials.has(key))return this.materials.get(key);
    const material=new THREE.MeshStandardMaterial({color:this.color(key),roughness:.91,metalness:0,flatShading:false});
    this.materials.set(key,material);
    this.applyOne(key,material);
    return material;
  }
  applyOne(key,material) {
    const hex=this.color(key);
    if(this.options.paint) {
      const previous=this.textures.get(key);if(previous)previous.dispose();
      const texture=paintTexture(hex,key,this.options);
      if(['land','lawn','meadow','soil'].includes(key))texture.repeat.set(.09,.09);
      else if(key==='seabed')texture.repeat.set(.065,.065);
      else if(['beach','wetSand'].includes(key))texture.repeat.set(.13,.13);
      else if(['cobble','road','stonePath','paving','quay'].includes(key))texture.repeat.set(.95,.95);
      this.textures.set(key,texture);
      material.map=texture;material.color.set('#ffffff');
    } else {
      material.map=null;material.color.set(hex);
      const old=this.textures.get(key);if(old){old.dispose();this.textures.delete(key);}
    }
    this.applyFinish(key,material);
    material.needsUpdate=true;
  }
  applyFinish(key,material) {
    const paintAmount=this.options.paint ? this.options.paintMaterial/100 : 0;
    material.roughness=.77+paintAmount*.19;
    material.metalness=(key==='iron'? .25 : .04)*(1-paintAmount*.65);
  }
  configure(next) {
    const changed=new Set(Object.keys(next).filter(key=>key in this.options && this.options[key]!==next[key]));
    if(!changed.size)return;
    Object.assign(this.options,next);
    const allTexturesChanged=changed.has('paint') || (this.options.paint &&
      (changed.has('paintStrength')||changed.has('paintDetail')));
    for(const [key,material] of this.materials) {
      const roofChanged=changed.has('roof') && key==='roofNeutral';
      const wallChanged=changed.has('wall') && (key==='stone'||key==='plaster');
      if(allTexturesChanged||roofChanged||wallChanged)this.applyOne(key,material);
      else if(changed.has('paintMaterial'))this.applyFinish(key,material);
    }
  }
  dispose() {for(const mat of this.materials.values())mat.dispose();for(const tex of this.textures.values())tex.dispose();}
}
