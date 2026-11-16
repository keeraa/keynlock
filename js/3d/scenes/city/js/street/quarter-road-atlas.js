// The entire street network is paved in one world-aligned atlas. Drawing all
// sidewalks, then all kerbs, then all roads creates exact unions at junctions:
// no rotated tile grids overlap and no corner requires a hand-made patch.
export const QUARTER_ATLAS_METRES=178;
export const QUARTER_ATLAS_PIXELS=3072;
// Keep road and pavement contrast high enough to survive the bright daytime
// lighting and filmic tone mapping used by the quarter scene.
export const QUARTER_ROAD_PALETTE=Object.freeze({
  sidewalk:'#d4c7ad',
  kerbShadow:'#80725f',
  kerbFace:'#e8d9be',
  cobbleRoad:'#776d60',
  pavedRoad:'#8d7c6c',
});

function trace(ctx,path) {
  if(path.length<2)return;
  ctx.beginPath();ctx.moveTo(path[0][0],path[0][1]);
  for(let i=1;i<path.length;i++)ctx.lineTo(path[i][0],path[i][1]);
  ctx.stroke();
}

function strokeNetwork(ctx,lines,width,color) {
  ctx.strokeStyle=color;
  ctx.lineJoin='round';ctx.lineCap='round';
  for(const line of lines){
    ctx.lineWidth=width(line);
    trace(ctx,line.path);
  }
}

function drawPaverGrout(ctx,{kind='sidewalk',seed=0}={}) {
  const half=QUARTER_ATLAS_METRES/2;
  const cobble=kind==='cobble',roadPaving=kind==='road-paving';
  const tileX=cobble?.76:roadPaving?1.3:1.05;
  const tileZ=cobble?.51:roadPaving?.79:1.12;
  ctx.save();ctx.globalCompositeOperation='source-atop';
  ctx.strokeStyle=cobble?'rgba(44,37,31,.63)':roadPaving?'rgba(56,45,36,.52)':'rgba(119,96,67,.25)';
  ctx.lineWidth=cobble?.068:roadPaving?.058:.042;ctx.beginPath();
  for(let z=-half;z<=half;z+=tileZ){ctx.moveTo(-half,z);ctx.lineTo(half,z);}
  if(cobble||roadPaving){
    for(let row=0,z=-half;z<half;row++,z+=tileZ){
      const stagger=row%2?tileX*.5:0;
      for(let x=-half+stagger;x<half;x+=tileX){ctx.moveTo(x,z);ctx.lineTo(x,z+tileZ);}
    }
  }else{
    for(let x=-half;x<=half;x+=tileX){ctx.moveTo(x,-half);ctx.lineTo(x,half);}
  }
  ctx.stroke();
  // A few colour flecks prevent machine-perfect repeated paving at street level.
  let state=(seed>>>0)^0x3f89b113;
  const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  ctx.fillStyle=kind==='sidewalk'?'rgba(255,249,227,.10)':'rgba(217,197,164,.14)';
  for(let i=0;i<(kind==='sidewalk'?900:4800);i++)ctx.fillRect((random()-.5)*QUARTER_ATLAS_METRES,
    (random()-.5)*QUARTER_ATLAS_METRES,.09+random()*.28,.07+random()*.2);
  ctx.restore();
}

export function drawQuarterRoadAtlas(plan,makeCanvas) {
  const create=()=>{
    const canvas=makeCanvas();
    canvas.width=canvas.height=QUARTER_ATLAS_PIXELS;
    const ctx=canvas.getContext('2d');
    if(!ctx)return null;
    const factor=QUARTER_ATLAS_PIXELS/QUARTER_ATLAS_METRES;
    ctx.setTransform(factor,0,0,factor,QUARTER_ATLAS_PIXELS/2,QUARTER_ATLAS_PIXELS/2);
    return {canvas,ctx};
  };
  const base=create();if(!base)return null;
  const {canvas,ctx}=base,lines=plan.roads.lines;
  strokeNetwork(ctx,lines,line=>line.width+line.walkWidth*2,QUARTER_ROAD_PALETTE.sidewalk);
  drawPaverGrout(ctx,{seed:plan.seed+30});
  // A two-tone kerbstone band remains continuous where branches meet.
  strokeNetwork(ctx,lines,line=>line.width+.45,QUARTER_ROAD_PALETTE.kerbShadow);
  strokeNetwork(ctx,lines,line=>line.width+.24,QUARTER_ROAD_PALETTE.kerbFace);

  const road=create();if(!road)return null;
  const cobble=plan.profile.surface==='cobble';
  strokeNetwork(road.ctx,lines,line=>line.width,
    cobble?QUARTER_ROAD_PALETTE.cobbleRoad:QUARTER_ROAD_PALETTE.pavedRoad);
  drawPaverGrout(road.ctx,{kind:cobble?'cobble':'road-paving',seed:plan.seed+91});
  // All road branches share one transparent layer. It erases any kerbstone
  // that would otherwise run straight across another branch's carriageway.
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  ctx.drawImage(road.canvas,0,0);ctx.restore();
  return canvas;
}

export function buildQuarterRoadAtlas(THREE,root,plan) {
  if(typeof document==='undefined'||typeof document.createElement!=='function')return false;
  const canvas=drawQuarterRoadAtlas(plan,()=>document.createElement('canvas'));
  if(!canvas)return false;
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=8;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;
  const material=new THREE.MeshStandardMaterial({map:texture,roughness:1,
    transparent:false,alphaTest:.15,side:THREE.DoubleSide});
  const geometry=new THREE.PlaneGeometry(QUARTER_ATLAS_METRES,QUARTER_ATLAS_METRES);
  geometry.rotateX(-Math.PI/2);
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.y=.115;mesh.receiveShadow=true;
  mesh.name='Непрерывная мостовая и тротуары квартала';
  mesh.userData.surfaceAtlas=true;mesh.userData.ownedTexture=texture;
  root.add(mesh);
  return true;
}
