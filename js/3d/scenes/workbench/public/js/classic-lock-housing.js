import * as THREE from '../vendor/three.js';

// The KEYNLOCK pin laboratory's continuous rounded casting, adapted to the
// larger mechanism sandbox. The side bores are real openings in the shell.
const X_SCALE=11.48/3.72;
const Y_SCALE=7.53/2.86;

function roundedRect(path,x,y,w,h,r,clockwise=false){
  if(!clockwise){
    path.moveTo(x+r,y);
    path.lineTo(x+w-r,y);path.quadraticCurveTo(x+w,y,x+w,y+r);
    path.lineTo(x+w,y+h-r);path.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    path.lineTo(x+r,y+h);path.quadraticCurveTo(x,y+h,x,y+h-r);
    path.lineTo(x,y+r);path.quadraticCurveTo(x,y,x+r,y);
  }else{
    path.moveTo(x+r,y);
    path.quadraticCurveTo(x,y,x,y+r);path.lineTo(x,y+h-r);
    path.quadraticCurveTo(x,y+h,x+r,y+h);path.lineTo(x+w-r,y+h);
    path.quadraticCurveTo(x+w,y+h,x+w,y+h-r);path.lineTo(x+w,y+r);
    path.quadraticCurveTo(x+w,y,x+w-r,y);path.lineTo(x+r,y);
  }
  path.closePath();return path;
}

function rimGeometry(){
  const shape=roundedRect(new THREE.Shape(),-3.73/2,-2.87/2,3.73,2.87,.175);
  shape.holes.push(roundedRect(new THREE.Path(),-3.30/2,-2.39/2,3.30,2.39,.086,true));
  return new THREE.ExtrudeGeometry(shape,{depth:.15,steps:1,bevelEnabled:true,
    bevelThickness:.015,bevelSize:.013,bevelSegments:3,curveSegments:14});
}

function rearGeometry(){
  const shape=roundedRect(new THREE.Shape(),-3.69/2,-2.83/2,3.69,2.83,.159);
  return new THREE.ExtrudeGeometry(shape,{depth:.12,steps:1,bevelEnabled:true,
    bevelThickness:.01,bevelSize:.008,bevelSegments:3,curveSegments:24});
}

function shellGeometry(){
  const outerW=3.72,outerH=2.86,innerW=3.39,innerH=2.57,depth=1.37;
  const shape=roundedRect(new THREE.Shape(),-outerW/2,-outerH/2,outerW,outerH,.175);
  shape.holes.push(roundedRect(new THREE.Path(),-innerW/2,-innerH/2,innerW,innerH,.082,true));
  const raw=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:false,curveSegments:16});
  const caps=[],sides=[];
  const pos=raw.getAttribute('position'),normal=raw.getAttribute('normal'),uv=raw.getAttribute('uv');
  const index=raw.getIndex();
  for(const group of raw.groups){
    const target=group.materialIndex===0?caps:sides;
    for(let k=group.start;k<group.start+group.count;k+=3){
      const triangle=[];
      for(let j=0;j<3;j++){
        const at=index?index.getX(k+j):k+j;
        triangle.push({p:[pos.getX(at),pos.getY(at),pos.getZ(at)],
          n:[normal.getX(at),normal.getY(at),normal.getZ(at)],
          uv:[uv.getX(at),uv.getY(at)]});
      }
      const x=Math.abs(triangle[0].p[0]);
      const flatSide=(Math.abs(x-outerW/2)<.0001||Math.abs(x-innerW/2)<.0001)&&
        triangle.every(v=>Math.abs(Math.abs(v.p[0])-x)<.0001);
      if(group.materialIndex===1&&flatSide)continue;
      target.push(...triangle);
    }
  }
  // The original pin lock has one side-mounted keyhole on the left and two
  // shackle sockets on the right. Keep their openings round after XY scaling.
  const rightHoles=[.92/Y_SCALE,-.92/Y_SCALE].map(y=>({y,z:.685+.025,
    ry:.325/Y_SCALE,rz:.325}));
  const leftHoles=[{y:0,z:.685+.04,ry:.49/Y_SCALE,rz:.49}];
  function piercedFace(x,minY,maxY,holes,normalSign){
    const face=new THREE.Shape();
    face.moveTo(minY,0);face.lineTo(maxY,0);
    face.lineTo(maxY,depth);face.lineTo(minY,depth);face.closePath();
    for(const h of holes){
      const hole=new THREE.Path();hole.absellipse(h.y,h.z,h.ry,h.rz,0,Math.PI*2,true);
      face.holes.push(hole);
    }
    const geometry=new THREE.ShapeGeometry(face,44);
    const points=geometry.getAttribute('position'),triangles=geometry.getIndex();
    const count=triangles?triangles.count:points.count;
    for(let k=0;k<count;k+=3){
      const indices=[k,k+1,k+2].map(i=>triangles?triangles.getX(i):i);
      if(normalSign<0)indices.reverse();
      for(const at of indices){
        const y=points.getX(at),z=points.getY(at);
        sides.push({p:[x,y,z],n:[normalSign,0,0],uv:[y/2+.5,z/depth]});
      }
    }
    geometry.dispose();
  }
  function boreTunnel(xMin,xMax,h){
    const n=48;
    const point=(x,a)=>({p:[x,h.y+h.ry*Math.cos(a),h.z+h.rz*Math.sin(a)],
      n:new THREE.Vector3(0,-Math.cos(a)/h.ry,-Math.sin(a)/h.rz).normalize().toArray(),
      uv:[a/(2*Math.PI),(x-xMin)/(xMax-xMin)]});
    for(let i=0;i<n;i++){
      const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n;
      const p0=point(xMin,a),p1=point(xMax,a),p2=point(xMax,b),p3=point(xMin,b);
      sides.push(p0,p1,p2,p0,p2,p3);
    }
  }
  piercedFace(outerW/2,-outerH/2+.175,outerH/2-.175,rightHoles,1);
  piercedFace(innerW/2,-innerH/2+.082,innerH/2-.082,rightHoles,-1);
  piercedFace(-outerW/2,-outerH/2+.175,outerH/2-.175,leftHoles,-1);
  piercedFace(-innerW/2,-innerH/2+.082,innerH/2-.082,leftHoles,1);
  for(const h of rightHoles)boreTunnel(innerW/2,outerW/2,h);
  for(const h of leftHoles)boreTunnel(-outerW/2,-innerW/2,h);
  const positions=[],normals=[],uvs=[];
  for(const v of [...caps,...sides]){positions.push(...v.p);normals.push(...v.n);uvs.push(...v.uv);}
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.addGroup(0,caps.length,0);geometry.addGroup(caps.length,sides.length,1);
  geometry.computeBoundingSphere();raw.dispose();
  return geometry;
}

export function createClassicLockHousing(root,materials){
  const housing=new THREE.Group();housing.name='pin-lab-classic-housing';
  housing.scale.set(X_SCALE,Y_SCALE,1);root.add(housing);
  const back=new THREE.Mesh(rearGeometry(),materials.case);
  back.position.z=-.75;housing.add(back);
  const shell=new THREE.Mesh(shellGeometry(),[materials.case,materials.edge]);
  shell.position.z=-.685;housing.add(shell);
  const bezel=new THREE.Mesh(rimGeometry(),materials.case);
  bezel.position.z=.59;housing.add(bezel);
  for(const piece of [back,shell,bezel]){piece.castShadow=true;piece.receiveShadow=true;}
  return {housing,back,shell,bezel};
}
