// Layered, open-canopy trees for the painted KEYNLOCK city.
// Branches reach through irregular leaf sprays; the sprays have real holes and
// depth from crossed foliage cards. All parts remain batched as InstancedMesh.
import {LANDSCAPE_LIMITS,TREE_KINDS} from './landscape-model.js';

export const TREE_SPECIES=Object.freeze({
  oak:{name:'Зелёный дуб',base:'#477652',shades:['#264d3e','#365c43','#699565','#91ab73','#b1b978'],
    trunk:6.65,limbs:6,groves:[
      {x:-1.92,z:-.12,y:5.48,count:5,spread:.81,depth:.74,size:1.10},
      {x:1.89,z:.10,y:5.64,count:5,spread:.85,depth:.79,size:1.09},
      {x:.19,z:-2.00,y:5.66,count:5,spread:.80,depth:.87,size:1.07},
      {x:-.24,z:1.99,y:5.81,count:5,spread:.88,depth:.86,size:1.10},
      {x:-2.02,z:-.18,y:6.84,count:4,spread:.81,depth:.75,size:1.14},
      {x:2.00,z:.16,y:7.02,count:4,spread:.89,depth:.83,size:1.13},
      {x:.14,z:-1.87,y:7.06,count:4,spread:.80,depth:.76,size:1.14},
      {x:-.17,z:1.84,y:7.18,count:4,spread:.83,depth:.82,size:1.13},
      {x:-.79,z:-.21,y:8.15,count:4,spread:.65,depth:.75,size:1.17},
      {x:.74,z:.28,y:8.29,count:4,spread:.64,depth:.67,size:1.15},
    ]},
  linden:{name:'Жёлтая липа',base:'#d4b64d',shades:['#90773a','#b69840','#d8be60','#eed476','#f7e89b'],
    trunk:6.86,limbs:5,groves:[
      {x:-1.68,z:.03,y:5.40,count:5,spread:.80,depth:.79,size:1.03},
      {x:1.73,z:-.16,y:5.49,count:5,spread:.80,depth:.77,size:1.03},
      {x:-.10,z:-1.75,y:5.53,count:5,spread:.74,depth:.81,size:1.07},
      {x:.11,z:1.75,y:5.88,count:5,spread:.83,depth:.78,size:1.04},
      {x:-1.73,z:.11,y:6.87,count:4,spread:.79,depth:.77,size:1.09},
      {x:1.64,z:-.12,y:7.10,count:4,spread:.83,depth:.82,size:1.08},
      {x:-.18,z:-1.54,y:7.11,count:4,spread:.75,depth:.77,size:1.09},
      {x:.16,z:1.45,y:7.38,count:4,spread:.77,depth:.74,size:1.10},
      {x:-.61,z:-.09,y:8.28,count:4,spread:.68,depth:.76,size:1.08},
      {x:.55,z:.28,y:8.70,count:4,spread:.65,depth:.71,size:1.05},
    ]},
  maple:{name:'Красный клён',base:'#b54a3b',shades:['#7d342f','#a83e34','#cd6945','#e18a4e','#e7a463'],
    trunk:6.59,limbs:6,groves:[
      {x:-2.11,z:-.14,y:5.41,count:5,spread:.88,depth:.84,size:1.09},
      {x:2.07,z:.10,y:5.54,count:5,spread:.89,depth:.84,size:1.10},
      {x:.21,z:-2.08,y:5.62,count:5,spread:.83,depth:.85,size:1.12},
      {x:-.14,z:2.14,y:5.71,count:5,spread:.89,depth:.85,size:1.10},
      {x:-2.04,z:.12,y:6.89,count:4,spread:.85,depth:.82,size:1.14},
      {x:1.95,z:-.19,y:7.02,count:4,spread:.90,depth:.85,size:1.12},
      {x:.19,z:-1.92,y:7.11,count:4,spread:.86,depth:.83,size:1.13},
      {x:-.20,z:1.95,y:7.20,count:4,spread:.83,depth:.86,size:1.14},
      {x:-.77,z:-.21,y:8.17,count:4,spread:.66,depth:.76,size:1.16},
      {x:.77,z:.31,y:8.28,count:4,spread:.69,depth:.69,size:1.15},
    ]},
});

const TAU=Math.PI*2;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const treeTuftCount=spec=>spec.groves.reduce((sum,grove)=>sum+grove.count,0);
function random(seed){
  let n=seed>>>0;
  return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
}
const seedTree=tree=>{
  let h=2166136261;
  for(const ch of `${tree.id}:${tree.kind}`){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return h>>>0;
};

// Paint a cutout cluster instead of putting a texture on a closed ball.
// Three variations of each hue stop neighbouring twigs from looking cloned.
function paintedFoliage(spec,variant){
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;
  const ctx=canvas.getContext('2d'),rnd=random(seedTree({id:`spray-${variant}`,kind:spec.name}));
  const colors=spec.shades;
  const islands=[
    [93,110,67,44],[162,92,78,57],[224,111,62,45],
    [127,151,70,41],[202,151,65,43],[167,55,48,37],
  ];
  function brushIsland(x,y,w,h,color){
    const segments=34;
    ctx.beginPath();
    for(let i=0;i<=segments;i++){
      const a=i/segments*TAU;
      const edge=.90+.085*Math.sin(5*a+variant*1.3)+.07*Math.sin(9*a-variant)+
        (rnd()-.5)*.15;
      const px=x+Math.cos(a)*w*edge,py=y+Math.sin(a)*h*edge;
      if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    }
    ctx.closePath();ctx.fillStyle=color;ctx.fill();
  }
  // Loose, interlocking foliage shapes, dark at their lower edge.
  for(const [x,y,w,h] of islands){
    const ox=(rnd()-.5)*20,oy=(rnd()-.5)*16;
    ctx.globalAlpha=.92;
    brushIsland(x+ox,y+oy,w*(.87+rnd()*.2),h*(.86+rnd()*.2),colors[0]);
    ctx.globalAlpha=.66;
    brushIsland(x+ox-5,y+oy-10,w*.82,h*.67,spec.base);
  }
  // The photograph-like light and dark blocks remain irregular and painterly.
  ctx.globalCompositeOperation='source-atop';
  for(let i=0;i<780;i++){
    const x=rnd()*320,y=rnd()*240;
    ctx.save();ctx.translate(x,y);ctx.rotate((rnd()-.5)*1.5);
    ctx.globalAlpha=.15+rnd()*.49;
    ctx.fillStyle=colors[Math.floor(rnd()*colors.length)];
    ctx.beginPath();ctx.ellipse(0,0,2+rnd()*12,1+rnd()*5,0,0,TAU);ctx.fill();
    ctx.restore();
  }
  for(let i=0;i<320;i++){
    const x=rnd()*320,y=rnd()*240;
    ctx.strokeStyle=rnd()>.55?'rgba(250,231,161,.38)':'rgba(25,49,38,.35)';
    ctx.lineWidth=.9+rnd()*2.2;ctx.beginPath();ctx.moveTo(x,y);
    ctx.lineTo(x+2+rnd()*13,y-1-rnd()*6);ctx.stroke();
  }
  // Cutouts reveal inner woody branches and sky between foliage masses.
  ctx.globalCompositeOperation='destination-out';ctx.globalAlpha=1;
  const openings=[[115,163,19,11],[186,161,18,10],[154,119,11,8],
    [65,136,9,8],[256,138,12,8]];
  for(const [x,y,w,h] of openings){
    ctx.save();ctx.translate(x+(rnd()-.5)*16,y+(rnd()-.5)*12);
    ctx.rotate((rnd()-.5)*.8);ctx.beginPath();
    ctx.ellipse(0,0,w*(.7+rnd()*.5),h*(.7+rnd()*.5),0,0,TAU);
    ctx.fill();ctx.restore();
  }
  ctx.globalCompositeOperation='source-over';
  // Dry-brush sprigs break up the silhouette without adding floating spheres.
  for(let i=0;i<110;i++){
    const x=(rnd()<.5?30+rnd()*65:222+rnd()*67),y=48+rnd()*135;
    ctx.globalAlpha=.22+rnd()*.35;ctx.fillStyle=colors[2+Math.floor(rnd()*3)];
    ctx.beginPath();ctx.ellipse(x,y,1.3+rnd()*5,.7+rnd()*2.2,(rnd()-.5),0,TAU);ctx.fill();
  }
  ctx.globalAlpha=1;
  return canvas;
}

function paintedBark(){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=256;
  const ctx=canvas.getContext('2d'),rnd=random(92411);
  ctx.fillStyle='#84694b';ctx.fillRect(0,0,128,256);
  for(let i=0;i<225;i++){
    const x=rnd()*128,y=rnd()*256;
    ctx.strokeStyle=rnd()>.45?'rgba(219,177,116,.27)':'rgba(40,57,47,.28)';
    ctx.lineWidth=.6+rnd()*2.4;ctx.beginPath();ctx.moveTo(x,y);
    ctx.quadraticCurveTo(x+(rnd()-.5)*5,y+9,x+(rnd()-.5)*4,y+12+rnd()*45);ctx.stroke();
  }
  return canvas;
}

function texture(THREE,canvas,repeat=false){
  const value=new THREE.CanvasTexture(canvas);
  value.colorSpace=THREE.SRGBColorSpace;value.anisotropy=4;
  value.wrapS=value.wrapT=repeat?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;
  return value;
}

// Three orthogonal, slightly inclined silhouettes supply depth from both the
// isometric camera and a close frontal view. Alpha-cutout cards cost 6 tris.
function foliageCardGeometry(THREE){
  const positions=[],uvs=[],indices=[];
  const corners=[[-1,-.68],[1,-.68],[1,.68],[-1,.68]];
  const orientations=[[0,0],[Math.PI/2,0],[Math.PI/4,-.88]];
  for(const [yaw,pitch] of orientations){
    const vertexStart=positions.length/3;
    for(const [x,y] of corners){
      const swungY=y*Math.cos(pitch),swungZ=y*Math.sin(pitch);
      positions.push(x*Math.cos(yaw)+swungZ*Math.sin(yaw),
        swungY,x*-Math.sin(yaw)+swungZ*Math.cos(yaw));
      uvs.push((x+1)/2,(y+.68)/1.36);
    }
    indices.push(vertexStart,vertexStart+1,vertexStart+2,
      vertexStart,vertexStart+2,vertexStart+3);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geo.setIndex(indices);geo.computeVertexNormals();
  return geo;
}

function curvedTrunkGeometry(THREE){
  // Eight vertical rows still resolve the painted S-curve at city zoom.
  // The underside is buried in terrain; the top is hidden in foliage.
  const geo=new THREE.CylinderGeometry(.085,.33,1,10,8,true);
  const attr=geo.getAttribute('position');
  for(let i=0;i<attr.count;i++){
    const t=clamp(attr.getY(i)+.5,0,1);
    attr.setXYZ(i,attr.getX(i)+.12*Math.sin(t*5.7)*t+.43*t*t,
      attr.getY(i),attr.getZ(i)+.10*Math.sin(t*4.8)*t+.17*t*t);
  }
  attr.needsUpdate=true;geo.computeVertexNormals();
  return geo;
}

function buildTufts(spec,rnd){
  const tufts=[];
  // Uneven painterly masses, staggered in height and depth; no circular band
  // of identical ellipsoids around a single central stalk.
  for(const grove of spec.groves){
    const offset=rnd()*TAU,lean=(rnd()-.5)*.30;
    for(let i=0;i<grove.count;i++){
      const angle=offset+(i+(rnd()-.5)*.55)*TAU/grove.count;
      const radius=.31+rnd()*.93;
      tufts.push({x:grove.x+Math.cos(angle)*grove.spread*radius,
        z:grove.z+Math.sin(angle)*grove.depth*radius,
        y:grove.y+Math.sin(angle+lean)*.31+(rnd()-.5)*.44,
        sx:grove.size*(.83+rnd()*.39),sy:grove.size*(.76+rnd()*.41),
        sz:grove.size*(.83+rnd()*.39)});
    }
  }
  return tufts;
}

export function createCityTrees(THREE,scene){
  const foliageGeometry=foliageCardGeometry(THREE);
  const trunkGeometry=curvedTrunkGeometry(THREE);
  // Branch endpoints overlap the trunk or leaf sprays. Capping each short
  // segment doubles its triangle count without adding visible surfaces.
  const branchGeometry=new THREE.CylinderGeometry(.065,.13,1,7,1,true);
  const barkTexture=texture(THREE,paintedBark(),true);
  const barkMaterial=new THREE.MeshLambertMaterial({map:barkTexture,color:'#f2e6ce'});
  const yAxis=new THREE.Vector3(0,1,0),dummy=new THREE.Object3D();
  const direction=new THREE.Vector3(),color=new THREE.Color(),pools={};
  const makePool=(geometry,material,max,leaves=false)=>{
    const mesh=new THREE.InstancedMesh(geometry,material,max);
    mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow=true;mesh.receiveShadow=!leaves;
    mesh.userData.cityTrees=true;mesh.userData.cityLeaves=leaves;
    if(leaves)mesh.userData.noOutline=true;
    scene.add(mesh);return mesh;
  };
  for(const kind of TREE_KINDS){
    const spec=TREE_SPECIES[kind],tuftCount=treeTuftCount(spec);
    const foliage=Array.from({length:3},(_,variant)=>{
      const leafTexture=texture(THREE,paintedFoliage(spec,variant));
      const leafMaterial=new THREE.MeshLambertMaterial({map:leafTexture,
        color:'#ffffff',side:THREE.DoubleSide,alphaTest:.14,alphaToCoverage:true,depthWrite:true});
      return {leafTexture,leafMaterial,mesh:makePool(foliageGeometry,leafMaterial,
        LANDSCAPE_LIMITS.trees*Math.ceil(tuftCount/3),true)};
    });
    pools[kind]={spec,foliage,
      trunks:makePool(trunkGeometry,barkMaterial,LANDSCAPE_LIMITS.trees),
      branches:makePool(branchGeometry,barkMaterial,
        LANDSCAPE_LIMITS.trees*(spec.limbs*3+2+Math.ceil(tuftCount/3)))};
  }
  const place=(mesh,index,position,scale,angle=0,tilt=null,tint=null)=>{
    dummy.position.set(...position);dummy.scale.set(...scale);
    dummy.quaternion.identity();
    if(tilt)dummy.quaternion.setFromUnitVectors(yAxis,tilt);
    else dummy.rotation.y=angle;
    dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
    if(tint)mesh.setColorAt(index,tint);
  };
  function setTrees(trees,heightAt){
    const counts=Object.fromEntries(TREE_KINDS.map(kind=>[kind,
      {trunks:0,branches:0,foliage:[0,0,0]}]));
    for(const tree of trees.slice(0,LANDSCAPE_LIMITS.trees)){
      const pool=pools[tree.kind];if(!pool)continue;
      const spec=pool.spec,idx=counts[tree.kind],rnd=random(seedTree(tree));
      const s=tree.size||1,rotation=rnd()*TAU,
        c=Math.cos(rotation),sn=Math.sin(rotation),y=heightAt(tree.x,tree.z);
      const at=(x,h,z)=>[tree.x+(x*c-z*sn)*s,y+h*s,tree.z+(x*sn+z*c)*s];
      place(pool.trunks,idx.trunks++,at(0,spec.trunk/2,0),
        [s,spec.trunk*s,s],rotation);
      const addBranch=(from,to,thickness)=>{
        direction.set(to[0]-from[0],to[1]-from[1],to[2]-from[2]);
        const length=direction.length();if(length<.08)return;
        direction.multiplyScalar(1/length);
        place(pool.branches,idx.branches++,[(from[0]+to[0])/2,
          (from[1]+to[1])/2,(from[2]+to[2])/2],
          [s*thickness,length,s*thickness],0,direction);
      };
      // A secondary twisted stem comes out low, like the fork in a grown tree.
      const fork=at(-.53,3.73,.21);
      addBranch(at(-.04,1.98,0),fork,.96);
      addBranch(fork,at(-.96,5.52,.38),.59);
      // Main boughs start at different heights; two bends create natural
      // climbing branches, rather than a symmetrical umbrella of sticks.
      const limbEnds=[];
      for(let i=0;i<spec.limbs;i++){
        const grove=spec.groves[i],reach=.83+rnd()*.18;
        const startY=3.08+(i%3)*.47+rnd()*.45;
        const end={x:grove.x*reach,z:grove.z*reach,
          y:grove.y-.33+rnd()*.40};
        limbEnds.push(end);
        const joint1={x:end.x*.28+(rnd()-.5)*.21,z:end.z*.28,
          y:startY+.72+rnd()*.37};
        const joint2={x:end.x*.64+(rnd()-.5)*.27,z:end.z*.62,
          y:end.y-.61-rnd()*.30};
        addBranch(at(.15,startY,.05),at(joint1.x,joint1.y,joint1.z),.82);
        addBranch(at(joint1.x,joint1.y,joint1.z),at(joint2.x,joint2.y,joint2.z),.65);
        addBranch(at(joint2.x,joint2.y,joint2.z),at(end.x,end.y,end.z),.43);
      }
      const tufts=buildTufts(spec,rnd),phase=Math.floor(rnd()*3);
      for(let i=0;i<tufts.length;i++){
        const tuft=tufts[i],variant=(i+phase)%3,mesh=pool.foliage[variant].mesh;
        const tint=.88+rnd()*.17;color.setRGB(tint,tint,tint*.98);
        place(mesh,idx.foliage[variant]++,at(tuft.x,tuft.y,tuft.z),
          [tuft.sx*s,tuft.sy*s,tuft.sz*s],rotation+(rnd()-.5)*.75,null,color);
        if(i%3===0){
          let near=limbEnds[0],distance=Infinity;
          for(const point of limbEnds){
            const d=(tuft.x-point.x)**2+(tuft.z-point.z)**2;
            if(d<distance){near=point;distance=d;}
          }
          addBranch(at(near.x,near.y,near.z),at(tuft.x*.88,tuft.y-.28,tuft.z*.88),.51);
        }
      }
    }
    for(const kind of TREE_KINDS){
      const pool=pools[kind],count=counts[kind];
      const entries=[[pool.trunks,count.trunks],[pool.branches,count.branches],
        ...pool.foliage.map((foliage,i)=>[foliage.mesh,count.foliage[i]])];
      for(const [mesh,n] of entries){
        mesh.count=n;mesh.instanceMatrix.needsUpdate=true;
        if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
        if(n)mesh.computeBoundingSphere();
      }
    }
  }
  function dispose(){
    for(const pool of Object.values(pools)){
      for(const mesh of [pool.trunks,pool.branches,...pool.foliage.map(f=>f.mesh)]){
        scene.remove(mesh);mesh.dispose();
      }
      for(const {leafTexture,leafMaterial} of pool.foliage){
        leafMaterial.dispose();leafTexture.dispose();
      }
    }
    foliageGeometry.dispose();trunkGeometry.dispose();branchGeometry.dispose();
    barkTexture.dispose();barkMaterial.dispose();
  }
  return {setTrees,dispose};
}
