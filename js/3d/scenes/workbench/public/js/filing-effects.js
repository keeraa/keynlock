// Procedural cross-cut steel and pooled brass filings for the key workbench.
// The tiny particles share one InstancedMesh draw call and allocate no meshes
// while the user is filing.
export const FILE_BODY_SCALE=.70;
export const FILE_STEEL_LENGTH=2.05;
// A narrow face fits inside even the smallest (8-notch) filing channel.
export const FILE_STEEL_HEIGHT=.065;
export const FILE_STEEL_WIDTH=.070;
// Keep the steel heel seated in the existing ferrule as the blade shortens.
export const FILE_STEEL_HEEL_X=-2.70;
export const FILE_STEEL_CENTER_X=FILE_STEEL_HEEL_X+FILE_STEEL_LENGTH/2;
export const FILE_MAX_STROKE=.20;
// Offset in the key blank's own coordinates. The point of the file comes to
// rest just below the actual edge, including worn and previously filed cuts.
export const FILE_CONTACT_CLEARANCE=.085;
// The vise and blank sit near the rear wall, with the camera framing the file.
export const FILE_KEYROOT_Z=-2.85;
export const FILE_CAMERA_POSITION=Object.freeze([-2.13,1.47,-.43]);
export const FILE_CAMERA_TARGET=Object.freeze([-.63,.17,-2.73]);

// The middle of the rough steel is the working point, with half the shaft
// entering the space behind the key and the handle remaining in the foreground.
export function fileWorkingAnchor(){return -FILE_STEEL_CENTER_X*FILE_BODY_SCALE;}

// Place the working centre at the rear edge of the key's thickness. Its broad
// side still contacts the brass while depth testing hides the far steel half.
export const FILE_CONTACT_DEPTH_FRONT=-.008;
export const FILE_CONTACT_DEPTH_BACK=.123;

export function fileStoppedAtContour(requestedY,edgeY){
  return edgeY===null?requestedY:Math.max(requestedY,edgeY+FILE_CONTACT_CLEARANCE);
}

export function fileTouchesContour(requestedY,edgeY){
  return edgeY!==null&&requestedY<=edgeY+FILE_CONTACT_CLEARANCE+.12;
}

// Only motion along the metal shaft contributes to the filing stroke. Moving
// sideways positions the tool without magically shaving a neighbouring tooth.
export function fileAxialStrokePixels(dx,dy,axisX,axisY){
  const length=Math.hypot(axisX,axisY);
  if(!Number.isFinite(length)||length<1e-7)return 0;
  return (dx*axisX+dy*axisY)/length;
}

// A real file narrows gently toward its nose; its other end enters the ferrule.
export function createFileSteelGeometry(THREE){
  const geometry=new THREE.BoxGeometry(FILE_STEEL_LENGTH,FILE_STEEL_HEIGHT,
    FILE_STEEL_WIDTH,18,1,1);
  const positions=geometry.getAttribute('position');
  const half=FILE_STEEL_LENGTH/2;
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i);
    const nose=Math.max(0,Math.min(1,(x-(half-.38))/.38));
    const tail=Math.max(0,Math.min(1,(-x-(half-.16))/.16));
    const taper=1-.27*nose*nose-.07*tail;
    positions.setY(i,positions.getY(i)*taper);
    positions.setZ(i,positions.getZ(i)*taper);
  }
  positions.needsUpdate=true;geometry.computeVertexNormals();
  return geometry;
}

// Turned hardwood handle, closed at both ends. Its nose fits inside a metal
// ferrule; there are no disconnected cylinders or oversized box-shaped grips.
export function createFileHandleGeometry(THREE){
  const outline=[
    [0,-.54],[.105,-.54],[.136,-.52],[.157,-.45],
    [.166,-.34],[.169,-.16],[.159,.05],[.141,.28],
    [.119,.43],[.108,.51],[0,.51]
  ];
  return new THREE.LatheGeometry(outline.map(([r,y])=>new THREE.Vector2(r,y)),32);
}

export function createFileSurfaceMaterials(THREE){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#9ba8a6';ctx.fillRect(0,0,256,256);
  let seed=79321;
  const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<2900;i++){
    const shade=Math.floor(65+noise()*145);
    ctx.fillStyle=`rgba(${shade},${shade+5},${shade+5},.14)`;
    ctx.fillRect(noise()*256,noise()*256,1+noise()*3.5,1+noise()*3.5);
  }
  // Coarse, legible cross-cut teeth with one dominant and one fine diagonal.
  for(let n=-256;n<=512;n+=30){
    ctx.beginPath();ctx.moveTo(n,0);ctx.lineTo(n+256,256);
    ctx.strokeStyle='rgba(28,48,51,.74)';ctx.lineWidth=3.4;ctx.stroke();
    ctx.beginPath();ctx.moveTo(n+4,0);ctx.lineTo(n+260,256);
    ctx.strokeStyle='rgba(223,231,224,.53)';ctx.lineWidth=1.6;ctx.stroke();
    ctx.beginPath();ctx.moveTo(n,0);ctx.lineTo(n-256,256);
    ctx.strokeStyle='rgba(39,54,57,.50)';ctx.lineWidth=2.1;ctx.stroke();
  }
  const source=new THREE.CanvasTexture(canvas);source.wrapS=source.wrapT=THREE.RepeatWrapping;
  source.colorSpace=THREE.SRGBColorSpace;source.anisotropy=4;
  const textures=[source],materials=[];
  function createFace(repeatX,repeatY){
    const color=source.clone();color.repeat.set(repeatX,repeatY);
    color.needsUpdate=true;textures.push(color);
    const relief=source.clone();relief.repeat.set(repeatX,repeatY);
    relief.colorSpace=THREE.NoColorSpace;relief.needsUpdate=true;textures.push(relief);
    const material=new THREE.MeshStandardMaterial({color:0xd5dcd7,map:color,
      bumpMap:relief,bumpScale:.024,metalness:.68,roughness:.56});
    materials.push(material);return material;
  }
  // Larger, readable cross-cut teeth on the smaller physical file.
  const end=createFace(1,1),flat=createFace(1.50,1),side=createFace(1.50,1);
  return {materials:[end,end,flat,flat,side,side],
    dispose(){materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}

export function createMetalShavings(THREE,parent,{tableY=-1.58}={}){
  // One instanced draw call holds both flying and settled flakes. Only flying
  // instances update each frame; those landing on the bench stay in place.
  const CAPACITY=3200;
  const geometry=new THREE.BoxGeometry(.034,.004,.009);
  const material=new THREE.MeshStandardMaterial({color:0xffe4b5,metalness:.80,
    roughness:.37,side:THREE.DoubleSide});
  const mesh=new THREE.InstancedMesh(geometry,material,CAPACITY);
  mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);parent.add(mesh);
  mesh.count=0;
  const dummy=new THREE.Object3D(),color=new THREE.Color();
  const flakes=[],flying=new Set();
  function setFlakeMatrix(index,flake){
    dummy.position.set(flake.x,flake.y,flake.z);
    dummy.rotation.set(flake.flying?flake.angle+flake.rx*flake.age:0,
      flake.flying?flake.ry*flake.age:flake.angle,
      flake.flying?flake.rz*flake.age:0);
    dummy.scale.setScalar(flake.scale);
    dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
  }

  function emit(origin,strength,width){
    if(!Number.isFinite(strength)||strength<=.025)return;
    const amount=Math.min(9,Math.max(2,Math.round(strength*9)));
    for(let n=0;n<amount&&flakes.length<CAPACITY;n++){
      const index=flakes.length;
      const flake={
        x:origin.x+(Math.random()-.5)*Math.min(.35,width*.6),
        y:origin.y+Math.random()*.055,
        z:origin.z+Math.random()*.085,
        vx:(Math.random()-.5)*1.15,
        vy:.12+Math.random()*.56,
        vz:.20+Math.random()*.62,
        rx:(Math.random()-.5)*17,ry:(Math.random()-.5)*15,
        rz:(Math.random()-.5)*19,
        angle:Math.random()*Math.PI*2,
        scale:.5+Math.random()*1.12,
        age:0,flying:true
      };
      flakes.push(flake);flying.add(index);
      color.setHSL(Math.random()<.14?.49:.115,.38,.52+Math.random()*.17);
      mesh.setColorAt(index,color);
      setFlakeMatrix(index,flake);
    }
    mesh.count=flakes.length;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.instanceMatrix.needsUpdate=true;
  }

  function update(dt){
    const step=Math.min(.05,Math.max(0,dt));
    if(!step||!flying.size)return;
    for(const i of flying){
      const flake=flakes[i];flake.age+=step;
      flake.x+=flake.vx*step;flake.y+=flake.vy*step;flake.z+=flake.vz*step;
      flake.vy-=3.5*step;flake.vx*=.994;flake.vz*=.992;
      if(flake.y<=tableY+.005){
        // Lie flat on the actual table surface and remain visible permanently.
        flake.y=tableY+.005;flake.flying=false;flying.delete(i);
      }
      setFlakeMatrix(i,flake);
    }
    mesh.instanceMatrix.needsUpdate=true;
  }

  function clear(){
    flakes.length=0;flying.clear();mesh.count=0;
    mesh.instanceMatrix.needsUpdate=true;
  }
  function dispose(){parent.remove(mesh);geometry.dispose();material.dispose();}
  return {emit,update,clear,dispose};
}
