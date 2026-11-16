// Parametric housing geometry, shared by the three mechanisms.
export function createHousingGeometries({THREE,depthRatio}) {
  function roundedRectPath(path,x,y,w,h,r,clockwise=false) {
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
    path.closePath();
    return path;
  }
  function createFrontBezel() {
    const outerWidth=3.73,outerHeight=2.87,innerWidth=3.30,innerHeight=2.39;
    const outline=roundedRectPath(new THREE.Shape(),-outerWidth/2,-outerHeight/2,outerWidth,outerHeight,.175);
    const aperture=roundedRectPath(new THREE.Path(),-innerWidth/2,-innerHeight/2,innerWidth,innerHeight,.086,true);
    outline.holes.push(aperture);
    return new THREE.ExtrudeGeometry(outline,{
      depth:.15,steps:1,bevelEnabled:true,bevelThickness:.015,bevelSize:.013,bevelSegments:3,curveSegments:14
    });
  }
  function createRearCover() {
    // The thin rear wall needs rounded corners in XY, independent of its Z
    // thickness. RoundedBoxGeometry clamps its radius to half the thickness
    // and leaves four square-looking lobes beyond the perimeter shell.
    // Keep the contour 0.007 units inside the shell at the sides and corners.
    const width=3.69,height=2.83,radius=.159;
    const outline=roundedRectPath(new THREE.Shape(),-width/2,-height/2,width,height,radius);
    return new THREE.ExtrudeGeometry(outline,{
      depth:.12,steps:1,bevelEnabled:true,
      bevelThickness:.01,bevelSize:.008,bevelSegments:3,curveSegments:24
    });
  }
  function createSideShell() {
    // A continuous rounded frame with REAL through-bores on both sidewalls.
    // The two straight side faces are rebuilt as perforated planar surfaces;
    // each bore receives an internal tunnel, so it is open from every angle.
    const outerW=3.72,outerH=2.86,innerW=3.39,innerH=2.57;
    const profile=roundedRectPath(new THREE.Shape(),-outerW/2,-outerH/2,outerW,outerH,.175);
    profile.holes.push(roundedRectPath(new THREE.Path(),-innerW/2,-innerH/2,innerW,innerH,.082,true));
    const depth=1.37,raw=new THREE.ExtrudeGeometry(profile,{
      depth,steps:1,bevelEnabled:false,curveSegments:16
    });
    const shellCaps=[],shellSides=[];
    const pos=raw.getAttribute('position'),normal=raw.getAttribute('normal'),uv=raw.getAttribute('uv');
    const indexed=raw.getIndex();
    let removedFaces=0;
    for(const group of raw.groups){
      const dest=group.materialIndex===0?shellCaps:shellSides;
      for(let k=group.start;k<group.start+group.count;k+=3){
        const verts=[];
        for(let j=0;j<3;j++){
          const at=indexed?indexed.getX(k+j):k+j;
          verts.push({p:[pos.getX(at),pos.getY(at),pos.getZ(at)],
            n:[normal.getX(at),normal.getY(at),normal.getZ(at)],
            uv:[uv.getX(at),uv.getY(at)]});
        }
        const sideX=Math.abs(verts[0].p[0]);
        const straightSide=(Math.abs(sideX-outerW/2)<.0001||Math.abs(sideX-innerW/2)<.0001)&&
          verts.every(v=>Math.abs(Math.abs(v.p[0])-sideX)<.0001);
        if(group.materialIndex===1&&straightSide){removedFaces++;continue;}
        dest.push(...verts);
      }
    }
    const rightHoles=[.64,-.64].map(y=>({y,z:.025+.685,ry:.166,rz:.166/depthRatio}));
    // The left-side through-hole follows the entire raised lock cylinder.
    const leftHoles=[{y:-.31,z:-.05+.685,ry:.298,rz:.298/depthRatio}];
    function piercedFace(x,minY,maxY,holes,nSign){
      const s=new THREE.Shape();
      s.moveTo(minY,0);s.lineTo(maxY,0);s.lineTo(maxY,depth);s.lineTo(minY,depth);s.closePath();
      for(const h of holes){
        const aperture=new THREE.Path();
        aperture.absellipse(h.y,h.z,h.ry,h.rz,0,Math.PI*2,true);
        s.holes.push(aperture);
      }
      const flat=new THREE.ShapeGeometry(s,44);
      const vertex=flat.getAttribute('position'),triangles=flat.getIndex();
      const count=triangles?triangles.count:vertex.count;
      for(let i=0;i<count;i+=3){
        const indices=[i,i+1,i+2].map(k=>triangles?triangles.getX(k):k);
        if(nSign<0)indices.reverse();
        for(const at of indices){
          const y=vertex.getX(at),z=vertex.getY(at);
          shellSides.push({p:[x,y,z],n:[nSign,0,0],uv:[y/2+.5,z/depth]});
        }
      }
      flat.dispose();
    }
    function boreTunnel(xMin,xMax,h){
      const segments=48;
      const point=(x,a)=>({p:[x,h.y+h.ry*Math.cos(a),h.z+h.rz*Math.sin(a)],
        n:new THREE.Vector3(0,-Math.cos(a)/h.ry,-Math.sin(a)/h.rz).normalize().toArray(),
        uv:[a/(2*Math.PI),(x-xMin)/(xMax-xMin)]});
      for(let i=0;i<segments;i++){
        const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;
        const p0=point(xMin,a),p1=point(xMax,a),p2=point(xMax,b),p3=point(xMin,b);
        shellSides.push(p0,p1,p2,p0,p2,p3);
      }
    }
    piercedFace( outerW/2,-outerH/2+.175,outerH/2-.175,rightHoles, 1);
    piercedFace( innerW/2,-innerH/2+.082,innerH/2-.082,rightHoles,-1);
    piercedFace(-outerW/2,-outerH/2+.175,outerH/2-.175,leftHoles,-1);
    piercedFace(-innerW/2,-innerH/2+.082,innerH/2-.082,leftHoles, 1);
    rightHoles.forEach(h=>boreTunnel(innerW/2,outerW/2,h));
    leftHoles.forEach(h=>boreTunnel(-outerW/2,-innerW/2,h));
    const positions=[],normals=[],uvs=[];
    for(const v of [...shellCaps,...shellSides]){
      positions.push(...v.p);normals.push(...v.n);uvs.push(...v.uv);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.addGroup(0,shellCaps.length,0);
    geometry.addGroup(shellCaps.length,shellSides.length,1);
    geometry.computeBoundingSphere();
    geometry.userData.bores={right:2,left:1,removedFaces};
    raw.dispose();
    return geometry;
  }
  function createAnnularAxialGeometry(outerR,innerR,depth) {
    const shape=new THREE.Shape();shape.absarc(0,0,outerR,0,Math.PI*2,false);
    const inner=new THREE.Path();inner.absarc(0,0,innerR,0,Math.PI*2,true);shape.holes.push(inner);
    const g=new THREE.ExtrudeGeometry(shape,{depth,steps:1,bevelEnabled:false,curveSegments:48});
    g.rotateY(Math.PI/2);
    return g;
  }
  function createKeywayPlugGeometry(radius,length) {
    const s=new THREE.Shape();s.absarc(0,0,radius,0,2*Math.PI,false);
    // Tall rounded opening fits the actual bitted blade and hooked pick.
    s.holes.push(roundedRectPath(new THREE.Path(),-.085,-.265,.17,.35,.052,true));
    const g=new THREE.ExtrudeGeometry(s,{depth:length,steps:1,bevelEnabled:false,curveSegments:48});
    g.rotateY(Math.PI/2);
    return g;
  }
  function createScrewThreadGeometry(first,last,turns){
    const profile=[[-.043,.0556],[-.009,.071],[.009,.071],[.043,.0556]];
    const segments=turns*32,positions=[],indices=[];
    for(let i=0;i<=segments;i++){
      const t=i/segments,a=t*turns*Math.PI*2,z=first+(last-first)*t;
      for(const [offset,r] of profile){
        positions.push(Math.cos(a)*r,Math.sin(a)*r,z+offset);
      }
    }
    for(let i=0;i<segments;i++)for(let j=0;j<profile.length-1;j++){
      const a=i*profile.length+j,b=a+1,c=a+profile.length,d=c+1;
      indices.push(a,c,b,b,c,d);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setIndex(indices);g.computeVertexNormals();
    return g;
  }
  return {createFrontBezel,createRearCover,createSideShell,createAnnularAxialGeometry,
    createKeywayPlugGeometry,createScrewThreadGeometry};
}
