// Parametric notched discs and meshing spur gears, shared by lock mechanisms.
export function createNotchedDisc(THREE, radius=.29,innerRadius=.13,notchAngle=.24,depth=.086) {
    const shape=new THREE.Shape();
    const count=84, start=Math.PI/2;
    for(let i=0;i<=count;i++){
      const a=2*Math.PI*i/count, delta=Math.atan2(Math.sin(a-start),Math.cos(a-start));
      const r=Math.abs(delta)<notchAngle ? radius-.072 : radius;
      const x=Math.cos(a)*r,y=Math.sin(a)*r;
      if(!i)shape.moveTo(x,y);else shape.lineTo(x,y);
    }
    shape.closePath();
    const hole=new THREE.Path();hole.absarc(0,0,innerRadius,0,Math.PI*2,true);shape.holes.push(hole);
    const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:36});
    g.rotateY(Math.PI/2);
    return g;
  }

export function createSpurGear(THREE, teeth,pitchRadius,thickness,mt) {
    const shape=new THREE.Shape(),step=2*Math.PI/teeth;
    const rootR=pitchRadius-.022,tipR=pitchRadius+.018;
    for(let i=0;i<teeth;i++) {
      const a=i*step;
      const pts=[[-.5,rootR],[-.30,rootR],[-.19,tipR],[.19,tipR],[.30,rootR],[.5,rootR]];
      for(let j=0;j<pts.length;j++){
        const ang=a+pts[j][0]*step,r=pts[j][1],x=Math.cos(ang)*r,y=Math.sin(ang)*r;
        if(i===0&&j===0)shape.moveTo(x,y);else shape.lineTo(x,y);
      }
    }
    shape.closePath();
    const hole=new THREE.Path();hole.absarc(0,0,.075,0,Math.PI*2,true);shape.holes.push(hole);
    const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1}),mt);
    mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
  }

