import {houseChimneyOutlet} from '../house-atmosphere.js';

export function createHouseDetails({THREE,mats,BASE,box,addDoor,minimal,random}) {
  function addCornice(root,c,y) {
    // A single closed perimeter profile replaces three intersecting boxes and
    // four 12 mm rules. Their nearly coincident faces produced dashed lines
    // under the depth/normal cartoon outline and soft house shadows.
    const halfWidth=c.width/2,halfDepth=c.depth/2;
    const profile=[
      [-.114,-.016],[-.114,.138],[-.086,.138],[-.060,.12],
      [.060,.12],[.078,.100],[.078,-.016],
    ];
    const perimeter=2*(c.width+c.depth+.48);
    const sideLengths=[c.width+.24,c.depth+.24,c.width+.24,c.depth+.24];
    const corners=offset=>[
      [-halfWidth-offset,halfDepth+offset],
      [halfWidth+offset,halfDepth+offset],
      [halfWidth+offset,-halfDepth-offset],
      [-halfWidth-offset,-halfDepth-offset],
    ];
    const vertices=[],uvs=[];
    const push=(point,u,v)=>{
      vertices.push(...point);
      uvs.push(u,v);
    };
    let distance=0;
    for(let side=0;side<4;side++){
      const u0=distance/perimeter,u1=(distance+sideLengths[side])/perimeter;
      distance+=sideLengths[side];
      for(let i=0;i<profile.length-1;i++){
        const [lowerY,lowerOffset]=profile[i];
        const [upperY,upperOffset]=profile[i+1];
        const lower=corners(lowerOffset),upper=corners(upperOffset);
        const next=(side+1)%4;
        const a=[lower[side][0],y+lowerY,lower[side][1]];
        const b=[lower[next][0],y+lowerY,lower[next][1]];
        const d=[upper[side][0],y+upperY,upper[side][1]];
        const e=[upper[next][0],y+upperY,upper[next][1]];
        const v0=(lowerY+.114)/.192,v1=(upperY+.114)/.192;
        push(a,u0,v0);push(b,u1,v0);push(d,u0,v1);
        push(b,u1,v0);push(e,u1,v1);push(d,u0,v1);
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,mats.sill);
    mesh.castShadow=false;mesh.receiveShadow=true;
    mesh.userData.continuousCorniceProfile=true;
    mesh.userData.houseInvariant=true;
    root.add(mesh);
    return mesh;
  }

  function clippedDamagePlane(width,height,cutouts) {
    // Subtract the full window/door envelopes from a plaster decal. Drawing
    // the damage on top of the glass caused dark broken-plaster stains across
    // carved entrance panels, even when the frame was correctly recessed.
    let pieces=[{x0:-width/2,x1:width/2,y0:-height/2,y1:height/2}];
    for(const cut of cutouts){
      const next=[];
      for(const p of pieces){
        const x0=Math.max(p.x0,cut.x0),x1=Math.min(p.x1,cut.x1);
        const y0=Math.max(p.y0,cut.y0),y1=Math.min(p.y1,cut.y1);
        if(x0>=x1||y0>=y1){next.push(p);continue;}
        if(p.x0<x0)next.push({x0:p.x0,x1:x0,y0:p.y0,y1:p.y1});
        if(x1<p.x1)next.push({x0:x1,x1:p.x1,y0:p.y0,y1:p.y1});
        if(p.y0<y0)next.push({x0,x1,y0:p.y0,y1:y0});
        if(y1<p.y1)next.push({x0,x1,y0:y1,y1:p.y1});
      }
      pieces=next;
    }
    if(!pieces.length)return null;
    if(pieces.length===1&&pieces[0].x0===-width/2&&pieces[0].x1===width/2&&
      pieces[0].y0===-height/2&&pieces[0].y1===height/2)return new THREE.PlaneGeometry(width,height);
    const positions=[],uvs=[];
    for(const p of pieces){
      if(p.x1-p.x0<.005||p.y1-p.y0<.005)continue;
      for(const [x,y] of [[p.x0,p.y0],[p.x1,p.y0],[p.x0,p.y1],
        [p.x1,p.y0],[p.x1,p.y1],[p.x0,p.y1]]){
        positions.push(x,y,0);
        uvs.push(x/width+.5,y/height+.5);
      }
    }
    if(!positions.length)return null;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.computeVertexNormals();
    // Retain the original patch dimensions for tuning and diagnostics.
    geometry.parameters={width,height};
    return geometry;
  }

  function addPlasterDamage(root,c,top,layout) {
    if(!c.plasterDamage||c.damageAmount===0)return;
    const rng=random(58210);
    const wallHeight=top-BASE;
    const amount=Math.round(c.damageAmount/20);
    const clearance=.065;
    const fullWindow=(center,width,y)=>({
      x0:center-width/2-.14-clearance,x1:center+width/2+.14+clearance,
      y0:y-1.33/2-.12-clearance,
      y1:y+1.33/2+(c.windowStyle==='arched'?width*.35+.085:.11)+clearance,
    });
    const frontCuts=layout.front.map(win=>fullWindow(win.x,win.width,win.y));
    const entranceTop=BASE+.02+(c.doorStyle==='arched'?1.84+.405:2.1+.19);
    frontCuts.push({x0:-.96,x1:.96,y0:BASE-.12,y1:entranceTop+.08});
    if(c.balcony&&c.floors>1){
      const balconyBottom=BASE+c.floorHeight+.29;
      frontCuts.push({x0:-.79,x1:.79,y0:balconyBottom-.10,
        y1:balconyBottom+(c.doorStyle==='arched'?1.74+.33:1.92+.19)+.10});
    }
    const sideCuts=layout.sides.map(win=>fullWindow(win.z,win.width,win.y));
    const faces=[
      {width:c.width,depth:c.depth/2+.002,rotation:0,axis:'front',cuts:frontCuts,invertX:false},
      {width:c.width,depth:-c.depth/2-.002,rotation:Math.PI,axis:'back',cuts:[],invertX:true},
      {width:c.depth,depth:c.width/2+.002,rotation:Math.PI/2,axis:'right',cuts:sideCuts,invertX:true},
      {width:c.depth,depth:-c.width/2-.002,rotation:-Math.PI/2,axis:'left',cuts:sideCuts,invertX:false},
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
        const localCuts=face.cuts.map(cut=>({
          x0:face.invertX?offset-cut.x1:cut.x0-offset,
          x1:face.invertX?offset-cut.x0:cut.x1-offset,
          y0:cut.y0-y,y1:cut.y1-y,
        }));
        const geometry=clippedDamagePlane(width,height,localCuts);
        if(!geometry)continue;
        const mesh=new THREE.Mesh(geometry,mats.damage);
        const layer=.001+i*.00015;
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
        // Rotating a clipped decal could move its corners back across a
        // protected opening. Keep those on-axis; undisturbed wall patches
        // retain a little painterly rotation.
        mesh.rotation.z=face.cuts.length?0:(rng()-.5)*maxTilt*2;
        mesh.receiveShadow=true;
        mesh.userData.plasterDamage=true;
        mesh.userData.plasterCutouts=localCuts;
        root.add(mesh);
      }
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
      for(const side of [-1,1]){
        const post=box(parent,[.11,.98,.12],[side*(halfWidth-.09),y+.54,z+.57],mats.wood);
        post.userData.balconyPart='post';
      }
      box(parent,[width,.14,.11],[0,y+1.04,z+.57],mats.wood);
      addDoor(parent,c,BASE+c.floorHeight+.29,c.depth/2-.135,true);
      return;
    }
    // Both rear posts enter the plaster surface, anchoring the side railings.
    const railX=halfWidth-.10,frontZ=z+.57,rearZ=c.depth/2+.015;
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
    addDoor(parent,c,BASE+c.floorHeight+.29,c.depth/2-.135,true);
  }

  function addEntranceSteps(parent,c){
    // Three shallow stone risers lead from the plaza to the original entrance.
    // The first intersects the foundation and threshold; adjacent risers
    // overlap by 9 cm so their geometry forms one continuous staircase.
    const face=c.depth/2;
    const steps=[
      {height:.34,width:1.84,offset:.27},
      {height:.24,width:2.07,offset:.65},
      {height:.13,width:2.30,offset:1.03},
    ];
    steps.forEach(({height,width,offset},index)=>{
      const step=box(parent,[width,height,.47],[0,height/2,face+offset],mats.stoneLight);
      if(minimal){
        // The underside and rear wall are permanently hidden in distant LOD.
        // Keep the three visible stair silhouettes without the extra 12 tris.
        const indices=Array.from(step.geometry.getIndex().array);
        step.geometry.setIndex(indices.filter((_,i)=>![3,5].includes(Math.floor(i/6))));
        step.geometry.clearGroups();
      }
      step.userData.entranceStep=index;
      step.userData.houseInvariant=true;
    });
  }

  function addTimberFrame(root,c,top) {
    if(!c.timberFrame) return;
    // The top course was pierced by the roof slope along the eaves.
    // It is fully hidden by the roof anyway, so omit it.
    for(let i=0;i<c.floors;i++) {
      const y=BASE+i*c.floorHeight-.035;
      box(root,[c.width+.16,.15,.16],[0,y,c.depth/2+.065],mats.wood);
      box(root,[.15,.15,c.depth+.16],[c.width/2+.065,y,0],mats.wood);
      box(root,[.15,.15,c.depth+.16],[-c.width/2-.065,y,0],mats.wood);
    }
    const frameTop=top-(c.roofType==='flat'?.16:.35);
    for(const x of [-c.width/2+.1,c.width/2-.1]) {
      box(root,[.21,frameTop-BASE,.23],[x,(frameTop+BASE)/2,c.depth/2+.105],mats.wood);
      box(root,[.21,frameTop-BASE,.23],[x,(frameTop+BASE)/2,-c.depth/2-.105],mats.wood);
    }
    for(const z of [-c.depth/2+.12,c.depth/2-.12]) {
      box(root,[.22,frameTop-BASE,.22],[c.width/2+.1,(frameTop+BASE)/2,z],mats.wood);
      box(root,[.22,frameTop-BASE,.22],[-c.width/2-.1,(frameTop+BASE)/2,z],mats.wood);
    }
  }

  function addChimney(root,c,top) {
    if(!c.chimney) return;
    const {x,z,roofBase,topY}=houseChimneyOutlet(c);
    const chimneyHeight=topY-(roofBase-.45);
    box(root,[.75,chimneyHeight,.72],[x,(topY+roofBase-.45)/2,z],mats.chimney);
    box(root,[.95,.16,.91],[x,topY+.015,z],mats.stoneLight);
    box(root,[.57,.025,.53],[x,topY+.104,z],mats.woodDark);
    for(let i=1;i<=3;i++)box(root,[.8,.07,.76],[x,roofBase-.15+i*chimneyHeight/4,z],mats.stoneLight);
  }

  return {addCornice,addPlasterDamage,addBalcony,addEntranceSteps,addTimberFrame,addChimney};
}
