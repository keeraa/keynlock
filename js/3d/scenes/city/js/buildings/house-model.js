import { getHouseDimensions, normalizeHouseConfig } from './house-config.js';
import { windowLayout } from './house-layout.js';
import { acquireHouseTextures } from './house-textures.js';
import { acquireFixedHouseMaterials } from './house-materials.js';

// Geometry is generated in local coordinates. No city/renderer dependency:
// multiple house instances can later share one blueprint and material cache.
const BASE = .32;

// Both roof slopes run through the wall tops and meet at the ridge.
// The overhang descends below the top of the wall instead of floating above it.
export function gableRoofProfile(config, wallTop, eave = .42) {
  const halfWidth = config.width / 2;
  return {
    span: halfWidth + eave,
    ridgeY: wallTop + config.roofHeight,
    edgeY: wallTop - config.roofHeight * eave / halfWidth,
  };
}

// Facade-independent UV projection: tile courses follow the eaves, while the
// rows advance uphill. Triangular hip faces use real world coordinates too,
// avoiding the texture pinch produced by squeezing a square UV into a tip.
export function roofSurfaceUV(point, face, eaveY, verticalScale) {
  const horizontal = face === 'end' ? point[0] : point[2];
  return [horizontal * .26, (point[1] - eaveY) * verticalScale];
}

export function housePolygonCount(root) {
  let triangles=0;
  root.traverse(child=>{
    if(!child.isMesh)return;
    const geometry=child.geometry;
    const vertices=geometry.index?.count??geometry.getAttribute('position')?.count??0;
    triangles+=vertices/3;
  });
  return Math.round(triangles);
}

function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function paintedTexture(THREE, kind) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const rand = random(kind === 'roof' ? 23456 : kind === 'wood' ? 39188 : 85612);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 512);
  if (kind === 'roof') {
    // Slightly uneven painted clay tiles, arranged in staggered courses.
    for (let row = -1; row < 15; row++) {
      for (let col = -1; col < 13; col++) {
        const x = col * 48 + (row % 2 ? 24 : 0);
        const y = row * 39;
        const shade = 1 - rand() * .15;
        ctx.fillStyle = `rgba(53,40,35,${(1 - shade) * .7})`;
        ctx.fillRect(x + 2, y + 4, 46, 35);
        ctx.strokeStyle = `rgba(45,31,24,${.18 + rand() * .16})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x + 1, y + 37); ctx.quadraticCurveTo(x + 23, y + 44, x + 47, y + 37);
        ctx.moveTo(x + 2, y + 3); ctx.lineTo(x + 2, y + 36);
        ctx.stroke();
        if (rand() > .45) {
          ctx.strokeStyle = `rgba(255,255,255,${.14 + rand() * .12})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x + 7, y + 9); ctx.lineTo(x + 28, y + 11); ctx.stroke();
        }
      }
    }
  } else if (kind === 'wood') {
    for (let i = 0; i < 550; i++) {
      const y = rand() * 512;
      ctx.strokeStyle = `rgba(45,25,12,${.04 + rand() * .12})`;
      ctx.lineWidth = .5 + rand() * 2;
      ctx.beginPath(); ctx.moveTo(rand() * 512, y);
      ctx.bezierCurveTo(180, y - 4, 320, y + 4, 512, y); ctx.stroke();
    }
  } else {
    for (let i = 0; i < 5200; i++) {
      const x = rand() * 512, y = rand() * 512;
      const tone = rand() > .4 ? '40,28,19' : '255,255,255';
      ctx.fillStyle = `rgba(${tone},${.016 + rand() * .058})`;
      ctx.fillRect(x, y, 1.5 + rand() * 14, .8 + rand() * 3);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.repeat.set(kind === 'roof' ? 1 : kind === 'wood' ? 1 : 1.6, kind === 'roof' ? 1 : 1.6);
  return tex;
}

export function createHouseModel(THREE, initialConfig, {detail='high'}={}) {
  if(!['high','medium','low'].includes(detail))throw new Error(`Неизвестный уровень детализации дома: ${detail}`);
  const simplified=detail!=='high', minimal=detail==='low';
  const group = new THREE.Group();
  group.name = 'KEYNLOCK — параметрический дом';
  const sharedTextures = acquireHouseTextures(THREE, paintedTexture);
  const sharedMaterials = acquireFixedHouseMaterials(THREE);
  const mats = {
    plaster: new THREE.MeshStandardMaterial({color:'#dec8a4', roughness:.98}),
    roof: new THREE.MeshStandardMaterial({color:'#a8604b', roughness:.94, side:THREE.DoubleSide}),
    roofEdge: new THREE.MeshStandardMaterial({color:'#693d39', roughness:1}),
    wood: new THREE.MeshStandardMaterial({color:'#675340', roughness:.95}),
    ...sharedMaterials.materials,
  };
  let disposed = false;
  sharedTextures.attach(mats);

  function box(parent, size, pos, mat, extra={}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    mesh.position.set(...pos);
    mesh.castShadow = extra.cast !== false;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function cylinder(parent, radius, height, pos, mat, sides=12) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,sides),mat);
    mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
    return mesh;
  }

  function beam(parent, start, end, thickness, material) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const mid = a.clone().add(b).multiplyScalar(.5);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, a.distanceTo(b), thickness), material);
    mesh.position.copy(mid); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), b.clone().sub(a).normalize());
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
    return mesh;
  }

  function triangle(parent, points, mat) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
    geom.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,.5,1],2));
    geom.computeVertexNormals();
    const mesh=new THREE.Mesh(geom,mat);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }

  function roofSurface(parent, corners, face, eaveY, verticalScale) {
    const geom = new THREE.BufferGeometry();
    const coords=[],uv=[];
    for(let i=1;i<corners.length-1;i++){
      for(const vertex of [corners[0],corners[i],corners[i+1]]){
        coords.push(...vertex);
        uv.push(...roofSurfaceUV(vertex,face,eaveY,verticalScale));
      }
    }
    geom.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
    geom.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom,mats.roof);
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.roofSurface=face;parent.add(mesh);
    return mesh;
  }

  function createRoof(root, c, top) {
    const eave = .42;
    const halfW = c.width/2, halfD=c.depth/2;
    if(c.roofType==='flat') {
      box(root,[c.width+.55,.27,c.depth+.55],[0,top+.14,0],mats.roofTop);
      box(root,[c.width+.62,.36,.16],[0,top+.31,halfD+.24],mats.stoneLight);
      box(root,[c.width+.62,.36,.16],[0,top+.31,-halfD-.24],mats.stoneLight);
      box(root,[.16,.36,c.depth+.55],[-halfW-.24,top+.31,0],mats.stoneLight);
      box(root,[.16,.36,c.depth+.55],[halfW+.24,top+.31,0],mats.stoneLight);
      return;
    }
    if (c.roofType==='gable') {
      const {span,ridgeY,edgeY} = gableRoofProfile(c,top,eave);
      const rise = ridgeY - edgeY;
      const verticalScale=Math.hypot(span,rise)/rise*.24;
      const outerD=halfD+eave;
      for(const side of [-1,1]) {
        const corners=side===1?
          [[span,edgeY,outerD],[span,edgeY,-outerD],[0,ridgeY,-outerD],[0,ridgeY,outerD]]:
          [[-span,edgeY,-outerD],[-span,edgeY,outerD],[0,ridgeY,outerD],[0,ridgeY,-outerD]];
        roofSurface(root,corners,'side',edgeY,verticalScale);
        box(root,[.18,.22,c.depth+eave*2],[side*span,edgeY-.03,0],mats.roofEdge);
        for(const z of [-outerD,outerD])beam(root,[0,ridgeY,z],[side*span,edgeY,z],.14,mats.roofEdge);
      }
      for(const z of [-halfD-.01,halfD+.01]) {
        triangle(root,z>0?[[-halfW,top,z],[halfW,top,z],[0,top+c.roofHeight,z]]:
          [[halfW,top,z],[-halfW,top,z],[0,top+c.roofHeight,z]],mats.plaster);
        // The dark outer fascia already traces this edge. Extra light-coloured
        // beams here pierced the roof planes as bright white diagonal stripes.
      }
      box(root,[.21,.22,c.depth+.9],[0,ridgeY+.025,0],mats.roofEdge);
      return;
    }
    const ridgeHalf = Math.max(.5,halfD - halfW*.75);
    const y = top+c.roofHeight;
    const bw=halfW+eave, bd=halfD+eave;
    const eaveY=top-c.roofHeight*eave/halfW;
    const verticalScale=Math.hypot(bw,y-eaveY)/(y-eaveY)*.24;
    roofSurface(root, [[bw,eaveY,-bd],[-bw,eaveY,-bd],[0,y,-ridgeHalf]],'end',eaveY,verticalScale);
    roofSurface(root, [[-bw,eaveY,bd],[bw,eaveY,bd],[0,y,ridgeHalf]],'end',eaveY,verticalScale);
    roofSurface(root, [[-bw,eaveY,-bd],[-bw,eaveY,bd],[0,y,ridgeHalf],[0,y,-ridgeHalf]],'side',eaveY,verticalScale);
    roofSurface(root, [[bw,eaveY,bd],[bw,eaveY,-bd],[0,y,-ridgeHalf],[0,y,ridgeHalf]],'side',eaveY,verticalScale);
    box(root,[.2,.17,ridgeHalf*2+.2],[0,y+.02,0],mats.roofEdge);
    for(const x of [-bw,bw])box(root,[.12,.15,c.depth+.8],[x,eaveY,0],mats.roofEdge);
    for(const z of [-bd,bd])box(root,[c.width+.8,.15,.12],[0,eaveY,z],mats.roofEdge);
    for(const x of [-bw,bw])for(const z of [-bd,bd]) {
      beam(root,[x,eaveY,z],[0,y,Math.sign(z)*ridgeHalf],.085,mats.roofEdge);
    }
  }

  function addPlasterDamage(root,c,top) {
    if(!c.plasterDamage||c.damageAmount===0)return;
    const rng=random(58210);
    const wallHeight=top-BASE;
    const amount=Math.round(c.damageAmount/20);
    const faces=[
      {width:c.width,depth:c.depth/2+.018,rotation:0,axis:'front'},
      {width:c.width,depth:-c.depth/2-.018,rotation:Math.PI,axis:'back'},
      {width:c.depth,depth:c.width/2+.018,rotation:Math.PI/2,axis:'right'},
      {width:c.depth,depth:-c.width/2-.018,rotation:-Math.PI/2,axis:'left'},
    ];
    for(const face of faces) {
      const count=face.axis==='back'?Math.max(0,amount-1):amount;
      for(let i=0;i<count;i++) {
        const width=Math.min(face.width-.5, (.9+rng()*.75)*c.damageScale);
        const height=Math.min(wallHeight-.55,(.85+rng()*.7)*c.damageScale);
        const xRange=Math.max(0,face.width-width-.36);
        const yRange=Math.max(0,wallHeight-height-.45);
        const offset=-xRange/2+rng()*xRange;
        const y=BASE+.2+height/2+rng()*yRange;
        const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),mats.damage);
        const layer=0.02+i*.0002;
        if(face.axis==='front'||face.axis==='back'){
          mesh.position.set(offset,y,face.depth+Math.sign(face.depth)*layer);
        }else{
          mesh.position.set(face.depth+Math.sign(face.depth)*layer,y,offset);
        }
        mesh.rotation.y=face.rotation;
        // Keep large decals on the wall even when scaling toward ×5.
        const horizontalClearance=face.width/2-Math.abs(offset)-width/2;
        const verticalClearance=Math.min(y-BASE-height/2,top-y-height/2);
        const maxTilt=Math.max(0,Math.min(.115,horizontalClearance/(height/2),verticalClearance/(width/2)));
        mesh.rotation.z=(rng()-.5)*maxTilt*2;
        mesh.receiveShadow=true;
        mesh.userData.plasterDamage=true;
        root.add(mesh);
      }
    }
  }

  function addWindow(parent, width, style, shutters) {
    const h=1.33;
    parent.userData.windowStyle=style;
    parent.userData.windowWidth=width;
    if(simplified) {
      // At block scale, a handful of flat panes reads like the same window.
      // The complete arched frame and shutters return as the camera approaches.
      const pane=(w,bottom,spring,rise,z,material)=>{
        if(style==='straight'){
          box(parent,[w,spring-bottom,.025],[0,(spring+bottom)/2,z],material,{cast:false});
          return;
        }
        const shape=new THREE.Shape();
        shape.moveTo(-w/2,bottom);shape.lineTo(w/2,bottom);shape.lineTo(w/2,spring);
        for(let i=1;i<=10;i++){
          const a=Math.PI*i/10;
          shape.lineTo(Math.cos(a)*w/2,spring+Math.sin(a)*rise);
        }
        shape.closePath();
        const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),material);
        mesh.position.z=z;mesh.receiveShadow=true;parent.add(mesh);
      };
      const spring=h/2-.025, rise=width*.35;
      pane(width+.20,-h/2-.06,spring,rise+.09,.038,mats.stoneLight);
      pane(width-.10,-h/2+.05,spring-.04,Math.max(.08,rise-.045),.091,mats.glass);
      box(parent,[.055,h+rise-.08,.042],[0,rise/2-.025,.12],mats.highlight,{cast:false});
      if(!minimal){
        box(parent,[width+.03,.052,.05],[0,.08,.12],mats.highlight,{cast:false});
        box(parent,[width+.29,.12,.17],[0,-h/2-.03,.065],mats.highlight,{cast:false});
        if(shutters)for(const side of [-1,1]){
          const shutter=box(parent,[width*.37,h+.03,.075],[side*width*.69,0,.09],mats.wood);
          shutter.rotation.y=side*.23;
        }
      }
      return;
    }
    if(style==='arched') {
      // The masonry outline, recessed opening and glazing all share the same
      // arch profile. A continuous moulding runs from one jamb over the crown
      // to the other, so the top is part of the window frame (not a cap).
      const springY=h/2-.025, rise=width*.35;
      const panel=(w,bottom,spring,curveRise,z,material)=>{
        const outline=new THREE.Shape();
        outline.moveTo(-w/2,bottom);
        outline.lineTo(w/2,bottom);
        outline.lineTo(w/2,spring);
        for(let i=1;i<=32;i++){
          const angle=Math.PI*i/32;
          outline.lineTo(Math.cos(angle)*w/2,spring+Math.sin(angle)*curveRise);
        }
        outline.closePath();
        const mesh=new THREE.Mesh(new THREE.ShapeGeometry(outline),material);
        mesh.position.z=z;
        mesh.receiveShadow=true;
        parent.add(mesh);
      };
      panel(width+.28,-h/2-.095,springY,rise+.12,.028,mats.stoneLight);
      panel(width+.065,-h/2-.018,springY,rise+.025,.071,mats.woodDark);
      panel(width-.10,-h/2+.065,springY-.012,rise-.035,.089,mats.glass);

      const rimRadius=(width+.28)/2, rimRise=rise+.12;
      const outlinePoints=[new THREE.Vector3(-rimRadius,-h/2-.06,.115),
        new THREE.Vector3(-rimRadius,springY,.115)];
      for(let i=1;i<=24;i++){
        const angle=Math.PI-i*Math.PI/24;
        outlinePoints.push(new THREE.Vector3(Math.cos(angle)*rimRadius,springY+Math.sin(angle)*rimRise,.115));
      }
      outlinePoints.push(new THREE.Vector3(rimRadius,-h/2-.06,.115));
      const moulding=new THREE.Mesh(new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(outlinePoints,false,'centripetal'),24,.052,5,false),mats.highlight);
      moulding.userData.windowFrame=true;
      parent.add(moulding);
      const vertical=box(parent,[.057,h+rise-.06,.055],[0,rise/2-.005,.128],mats.highlight,{cast:false});
      vertical.userData.windowMullion='vertical';
      const horizontal=box(parent,[width+.03,.052,.055],[0,.08,.128],mats.highlight,{cast:false});
      horizontal.userData.windowMullion='horizontal';
    } else {
      const surface=box(parent,[width+.2,h+.16,.09],[0,0,.055],mats.stoneLight);
      surface.castShadow=false;
      box(parent,[width,h,.045],[0,0,.114],mats.woodDark,{cast:false});
      box(parent,[width-.12,h-.12,.035],[0,0,.148],mats.glass,{cast:false});
      box(parent,[.047,h-.06,.1],[0,0,.17],mats.highlight,{cast:false});
      box(parent,[width-.04,.047,.1],[0,.08,.17],mats.highlight,{cast:false});
      box(parent,[width+.15,.11,.16],[0,h/2+.035,.1],mats.highlight);
      for(const side of [-1,1])box(parent,[.09,h+.11,.2],[side*(width/2+.06),0,.12],mats.highlight);
      box(parent,[width+.28,.16,.23],[0,h/2+.12,.13],mats.stoneLight);
    }
    box(parent,[width+.34,.14,.24],[0,-h/2-.02,.1],mats.highlight);
    if(shutters) {
      for(const side of [-1,1]) {
        const shutter=box(parent,[width*.38,h+.06,.095],[side*(width*.5+width*.2),0,.13],mats.wood);
        shutter.rotation.y=side*.3;
        for(let i=-2;i<=2;i++)box(shutter,[width*.27,.055,.015],[0,i*h*.15,.063],mats.woodDark,{cast:false});
        box(parent,[.06,h+.12,.09],[side*(width*.5+.03),0,.23],mats.brass);
      }
    }
  }

  function addDoor(parent, c, bottomY, z, asBalcony=false) {
    const door=new THREE.Group();door.position.set(0,bottomY,z);parent.add(door);
    const w=asBalcony?1.10:1.35;
    const arched=c.doorStyle==='arched';
    door.userData.doorStyle=c.doorStyle;
    const h=arched?(asBalcony?1.74:1.84):(asBalcony?1.92:2.1);
    const archRise=asBalcony?.28:.33;
    if(simplified) {
      const panel=(w,spring,rise,zOffset,material)=>{
        if(!arched){
          box(door,[w,spring,.06],[0,spring/2,zOffset],material);return;
        }
        const shape=new THREE.Shape();
        shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(w/2,spring);
        for(let i=1;i<=10;i++){
          const a=Math.PI*i/10;
          shape.lineTo(Math.cos(a)*w/2,spring+Math.sin(a)*rise);
        }
        shape.closePath();
        const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),material);
        mesh.position.z=zOffset;mesh.castShadow=true;door.add(mesh);
      };
      panel(w+.27,h,archRise+.08,.07,mats.stoneLight);
      panel(w,h,archRise,.15,asBalcony?mats.glass:mats.wood);
      if(!minimal){
        box(door,[.055,h+archRise-.12,.08],[0,(h+archRise-.12)/2,.19],mats.highlight);
        for(const side of [-1,1])box(door,[.08,h,.10],[side*(w/2+.05),h/2,.18],mats.highlight);
      }
      box(door,[w+.35,.13,.27],[0,-.025,.12],mats.stone);
      return;
    }
    if(arched) {
      // One continuous arched silhouette for each layer; the glazing and door
      // infill follow the actual outline instead of an unrelated semicircle.
      const panel=(width,springY,rise,depth,material)=>{
        const shape=new THREE.Shape();
        shape.moveTo(-width/2,0);
        shape.lineTo(width/2,0);
        shape.lineTo(width/2,springY);
        for(let i=1;i<=28;i++) {
          const angle=Math.PI*i/28;
          shape.lineTo(Math.cos(angle)*width/2,springY+Math.sin(angle)*rise);
        }
        shape.closePath();
        const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),material);
        mesh.position.z=depth;
        mesh.castShadow=true;mesh.receiveShadow=true;
        door.add(mesh);
      };
      panel(w+.28,h,archRise+.075,.06,mats.stoneLight);
      panel(w,h,archRise,.135,asBalcony?mats.glass:mats.wood);
      // The jambs and the crown share one curve. The previous free-standing
      // semicircle ended outside the side rails and appeared detached.
      const archRadius=(w+.28)/2;
      const jamb=[new THREE.Vector3(-archRadius,.06,.165),
        new THREE.Vector3(-archRadius,h,.165)];
      for(let i=1;i<=28;i++){
        const angle=Math.PI-i*Math.PI/28;
        jamb.push(new THREE.Vector3(Math.cos(angle)*archRadius,
          h+Math.sin(angle)*(archRise+.075),.165));
      }
      jamb.push(new THREE.Vector3(archRadius,.06,.165));
      const trim=new THREE.Mesh(new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(jamb,false,'centripetal'),36,.053,5,false),mats.highlight);
      trim.userData.continuousDoorFrame=true;
      door.add(trim);
      // Vertical centre stile meets the arched head with no visible gap.
      const stileHeight=h+archRise+.04;
      const stile=box(door,[.055,stileHeight,.075],[0,stileHeight/2,.188],mats.woodDark);
      stile.userData.doorStile=true;
    } else {
      box(door,[w+.32,h+.19,.11],[0,h/2,.06],mats.stoneLight);
      box(door,[w,h,.07],[0,h/2,.14],asBalcony?mats.glass:mats.wood);
      box(door,[.06,h-.2,.11],[0,h/2,.22],mats.woodDark);
    }
    for(const s of [-1,1]) {
      if(!arched)box(door,[.09,h,.15],[s*(w/2+.045),h/2,.18],mats.highlight);
      if(!asBalcony) {
        box(door,[w*.32,h*.31,.02],[s*w*.25,h*.32,.19],mats.woodDark);
        box(door,[w*.32,h*.24,.02],[s*w*.25,h*.72,.19],mats.woodDark);
        cylinder(door,.045,.07,[s*.13,h*.53,.24],mats.brass,10).rotation.x=Math.PI/2;
      } else {
        box(door,[.05,h-.16,.06],[s*w*.25,h/2,.21],mats.highlight);
        box(door,[w*.46,.055,.08],[s*w*.25,h*.52,.22],mats.highlight);
      }
    }
    box(door,[w+.42,.13,.35],[0,-.02,.1],mats.stone);
    if(!arched) {
      box(door,[w+.48,.19,.35],[0,h+.095,.12],mats.highlight);
    }
  }

  function addBalcony(parent,c,layout) {
    if(!c.balcony||c.floors<2)return;
    const z=c.depth/2+.62;
    const y=BASE+c.floorHeight+.23;
    const nearestWindow = layout.front.filter(win=>win.floor===1)
      .reduce((closest,win)=>Math.min(closest,Math.abs(win.x)-win.width/2),Infinity);
    const halfWidth = Math.min(1.275,nearestWindow-.34);
    const width = halfWidth*2;
    box(parent,[width,.18,1.35],[0,y,z],mats.stoneLight);
    if(minimal) {
      box(parent,[width,.14,.11],[0,y+1.04,z+.57],mats.wood);
      addDoor(parent,c,BASE+c.floorHeight+.29,c.depth/2+.18,true);
      return;
    }
    const railX=halfWidth-.10,frontZ=z+.57,rearZ=z-.48;
    const railBox=(size,pos,part)=>{
      const mesh=box(parent,size,pos,mats.wood);
      mesh.userData.balconyPart=part;
      return mesh;
    };
    for(const x of [-railX,railX]) {
      railBox([.1,1.0,.1],[x,y+.59,frontZ],'post');
      railBox([.1,1.0,.1],[x,y+.59,rearZ],'post');
      // Return the handrail all the way to the facade on both edges.
      railBox([.115,.11,frontZ-rearZ+.14],[x,y+1.055,(frontZ+rearZ)/2],'side-rail');
      for(let i=1;i<=3;i++){
        const zz=rearZ+(frontZ-rearZ)*i/4;
        railBox([.055,.94,.055],[x,y+.57,zz],'side-baluster');
      }
    }
    for(let i=-2;i<=2;i++){
      const x=i*(width-.2)/5;
      railBox([.055,.94,.055],[x,y+.57,frontZ],'front-baluster');
    }
    railBox([width,.11,.12],[0,y+1.055,frontZ],'front-rail');
    addDoor(parent,c,BASE+c.floorHeight+.29,c.depth/2+.18,true);
  }

  function addTimberFrame(root,c,top) {
    if(!c.timberFrame) return;
    // The top course was pierced by the roof slope along the eaves.
    // It is fully hidden by the roof anyway, so omit it.
    for(let i=0;i<c.floors;i++) {
      const y=BASE+i*c.floorHeight-.035;
      box(root,[c.width+.16,.15,.16],[0,y,c.depth/2+.09],mats.wood);
      box(root,[.15,.15,c.depth+.16],[c.width/2+.09,y,0],mats.wood);
      box(root,[.15,.15,c.depth+.16],[-c.width/2-.09,y,0],mats.wood);
    }
    const frameTop=top-(c.roofType==='flat'?.16:.35);
    for(const x of [-c.width/2+.1,c.width/2-.1]) {
      box(root,[.21,frameTop-BASE,.23],[x,(frameTop+BASE)/2,c.depth/2+.12],mats.wood);
      box(root,[.21,frameTop-BASE,.23],[x,(frameTop+BASE)/2,-c.depth/2-.12],mats.wood);
    }
    for(const z of [-c.depth/2+.12,c.depth/2-.12]) {
      box(root,[.22,frameTop-BASE,.22],[c.width/2+.1,(frameTop+BASE)/2,z],mats.wood);
      box(root,[.22,frameTop-BASE,.22],[-c.width/2-.1,(frameTop+BASE)/2,z],mats.wood);
    }
  }

  function addChimney(root,c,top) {
    if(!c.chimney) return;
    const x=c.width*.22, z=-c.depth*.22;
    const roofBase=c.roofType==='flat'?top+.3:top+c.roofHeight*(1-Math.abs(x)/(c.width/2));
    const topY=Math.max(roofBase+.85,top+(c.roofType==='flat'?.95:c.roofHeight+.56));
    const chimneyHeight=topY-(roofBase-.45);
    box(root,[.75,chimneyHeight,.72],[x,(topY+roofBase-.45)/2,z],mats.chimney);
    box(root,[.95,.16,.91],[x,topY+.015,z],mats.stoneLight);
    box(root,[.57,.025,.53],[x,topY+.104,z],mats.woodDark);
    for(let i=1;i<=3;i++)box(root,[.8,.07,.76],[x,roofBase-.15+i*chimneyHeight/4,z],mats.stoneLight);
  }

  function update(rawConfig) {
    const c=normalizeHouseConfig(rawConfig);
    const dims=getHouseDimensions(c);
    const layout=windowLayout(c);
    // Geometries belong to each generated house. Paint maps/materials are shared
    // across rebuilds so color and window adjustments avoid texture churn.
    group.traverse(object => {if(object.isMesh)object.geometry.dispose();});
    group.clear();
    mats.plaster.color.set(c.plasterColor);
    mats.roof.color.set(c.roofColor);
    mats.wood.color.set(c.woodColor);
    mats.roofEdge.color.set(c.roofColor).multiplyScalar(.56);

    const top=BASE+dims.walls;
    const permanent=mesh=>{mesh.userData.houseInvariant=true;return mesh;};
    permanent(box(group,[c.width+.32,.4,c.depth+.32],[0,.2,0],mats.stone));
    permanent(box(group,[c.width+.15,.12,c.depth+.15],[0,.46,0],mats.stoneLight));
    box(group,[c.width,dims.walls,c.depth],[0,BASE+dims.walls/2,0],mats.plaster);
    // Corner stones, foundation courses and restrained window cornices.
    if(!minimal)for(const x of [-1,1])for(const z of [-1,1]) {
      for(let i=0;i<Math.ceil(dims.walls/.54);i+=simplified?3:1) {
        const y=BASE+.23+i*.53;
        if(y>top-.1)continue;
        box(group,[.25,.23,.31],[x*(c.width/2-.03),y,z*(c.depth/2-.03)],i%2?mats.stoneLight:mats.highlight);
      }
    }
    for(let floor=1;floor<c.floors;floor++) {
      const y=BASE+floor*c.floorHeight;
      permanent(box(group,[c.width+.24,.14,c.depth+.24],[0,y,0],mats.highlight));
      if(!minimal)box(group,[c.width+.28,.052,c.depth+.28],[0,y-.09,0],mats.stoneLight);
    }
    for(let i=0;!simplified&&i<Math.floor(c.width/.84);i++) {
      const x=-c.width/2+.43+i*.84;
      box(group,[.06,.08,.08],[x,.12,c.depth/2+.18],mats.stoneLight,{cast:false});
    }
    for(const win of layout.front) {
      const windowGroup=new THREE.Group();
      windowGroup.position.set(win.x,win.y,c.depth/2+.04);
      group.add(windowGroup);
      addWindow(windowGroup,win.width,c.windowStyle,c.shutters);
    }
    for(const win of layout.sides)for(const side of [-1,1]) {
      const windowGroup=new THREE.Group();
      windowGroup.position.set(side*(c.width/2+.04),win.y,win.z);
      windowGroup.rotation.y=side*Math.PI/2;
      group.add(windowGroup);
      addWindow(windowGroup,win.width,c.windowStyle,c.shutters);
    }
    addDoor(group,c,BASE+.02,c.depth/2+.11);
    addBalcony(group,c,layout);
    const permanentStart=group.children.length;
    addTimberFrame(group,c,top);
    if(!minimal)addPlasterDamage(group,c,top);
    createRoof(group,c,top);
    addChimney(group,c,top);
    for(const child of group.children.slice(permanentStart)){
      // Damage decals change with LOD. The roof, timber and chimney do not.
      if(child.userData.plasterDamage)continue;
      child.traverse(mesh=>{if(mesh.isMesh)mesh.userData.houseInvariant=true;});
    }
    // These surfaces keep the same silhouette and paint across all LODs.
    // During a detail transition they must never be drawn twice as transparent
    // meshes: overlapping plaster/roof faces caused conspicuous zoom flicker.
    group.userData={config:c,detail,shellMaterials:[mats.plaster,mats.roof,mats.roofEdge,mats.roofTop],
      metrics:{...dims,windows:layout.totalWindows,frontWindows:layout.front.length,sideWindows:layout.sides.length*2,polygons:housePolygonCount(group)}};
    return group.userData.metrics;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    group.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
    group.clear();
    for(const kind of ['plaster','roof','roofEdge','wood'])mats[kind].dispose();
    sharedTextures.release();
    sharedMaterials.release();
  }

  update(initialConfig);
  return {group,update,dispose};
}
