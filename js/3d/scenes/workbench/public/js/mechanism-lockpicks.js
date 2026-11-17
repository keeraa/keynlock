// Real KEYNLOCK pin-lab tool silhouettes, adapted from
// pin_lab/src/js/mechanisms/pin-tools.js. Shared curves, not generic props.
export const STANDARD_TENSION_TOOLS=[
  {name:'Прямой Г-образный',color:0x98968a,radius:.034,path:[[-3.16,-.61],[-2.90,-.61],[-2.79,-.61],[-2.75,-.65],[-2.75,-.80],[-2.75,-1.00],[-2.38,-.73],[-1.75,-.41],[-1.11,-.23],[-.84,-.23],[-.68,-.18],[-.59,-.054],[-.50,0],[-.23,0],[.10,0]]},
  {name:'Волнистый',color:0x9b845f,radius:.031,path:[[-2.84,-.83],[-2.64,-.76],[-2.39,-.59],[-2.18,-.71],[-1.92,-.50],[-1.70,-.63],[-1.42,-.38],[-1.18,-.47],[-.94,-.24],[-.72,-.11],[-.55,-.017],[-.31,0],[.10,0]]},
  {name:'Двойной изгиб',color:0x9b8669,radius:.033,path:[[-2.68,-.50],[-3.12,-.84],[-2.66,-1.13],[-2.22,-.65],[-1.60,-.50],[-1.13,-.36],[-.88,-.22],[-.73,-.23],[-.62,-.068],[-.50,0],[-.23,0],[.10,0]]},
  {name:'Крючковый',color:0x8f9188,radius:.031,path:[[-2.88,-1.00],[-3.02,-.94],[-3.06,-.82],[-3.02,-.68],[-2.92,-.57],[-2.77,-.53],[-2.60,-.56],[-2.35,-.58],[-1.69,-.47],[-1.08,-.37],[-.86,-.28],[-.74,-.16],[-.62,-.066],[-.50,0],[-.23,0],[.10,0]]},
  {name:'Прямой тонкий',color:0x9e8867,radius:.035,path:[[-2.85,-.76],[-2.26,-.57],[-1.51,-.32],[-.97,-.18],[-.69,-.061],[-.50,0],[-.23,0],[.10,0]]}
];

// The guard in the keyway touches the *bent shaft* at three depths. All five
// laboratory wrenches share a tip, so testing the tip alone cannot distinguish
// them. These positions follow the real metal curves, not a random tool ID.
export const TENSION_GUIDE_STATIONS=Object.freeze([-1.05,-1.80,-2.45]);
const TENSION_FIT_TOLERANCE=.034;
const smooth=t=>{const n=Math.min(1,Math.max(0,t));return n*n*(3-2*n);};

export function tensionProfileHeight(index,x){
  const path=STANDARD_TENSION_TOOLS[index]?.path;
  if(!path)return null;
  for(let i=0;i<path.length-1;i++){
    const [a,ay]=path[i],[b,by]=path[i+1];
    if(a!==b&&(x-a)*(x-b)<=0){
      const raw=ay+(by-ay)*(x-a)/(b-a);
      return raw-.085*(1-smooth((x+.95)/.70));
    }
  }
  return null;
}

export function checkTensionProfile(profileIndex,wrenchIndex){
  const profile=Number.isInteger(profileIndex)&&profileIndex>=0&&profileIndex<5?profileIndex:2;
  const tool=Number.isInteger(wrenchIndex)&&wrenchIndex>=0&&wrenchIndex<5?wrenchIndex:2;
  const mismatches=TENSION_GUIDE_STATIONS.map(x=>Math.abs(
    tensionProfileHeight(profile,x)-tensionProfileHeight(tool,x)));
  const worst=Math.max(...mismatches);
  return {fits:worst<=TENSION_FIT_TOLERANCE,clearance:worst,
    station:TENSION_GUIDE_STATIONS[mismatches.indexOf(worst)]};
}

// Thumbnail line uses the identical path as the 3D shaft.
export function tensionToolIcon(index){
  const spec=STANDARD_TENSION_TOOLS[index]||STANDARD_TENSION_TOOLS[2];
  const points=spec.path.map(([x,y])=>[
    ((x+3.3)/3.5*78+3).toFixed(1),
    (5+(y+1.2)/1.35*28).toFixed(1)
  ].join(',')).join(' ');
  return '<svg viewBox="0 0 86 40" fill="none" aria-hidden="true">'
    +'<polyline points="'+points+'" stroke="#d5d0c4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
    +'</svg>';
}

const PICK_POINTS=[
  [-3.32,-.19,.01],[-2.25,-.19,.01],[-1.33,-.19,.01],
  [-.52,-.19,.01],[-.21,-.19,.01],[-.07,-.19,.01],
  [.025,-.145,.01],[.12,.025,.01]
];

function onePieceTube(THREE,curve,radiusAt){
  const segments=112,radial=12;
  const geometry=new THREE.TubeGeometry(curve,segments,1,radial,false);
  const positions=geometry.getAttribute('position');
  for(let i=0;i<=segments;i++){
    const center=curve.getPointAt(i/segments),radius=radiusAt(i/segments,center);
    for(let j=0;j<=radial;j++){
      const k=i*(radial+1)+j;
      positions.setXYZ(k,
        center.x+(positions.getX(k)-center.x)*radius,
        center.y+(positions.getY(k)-center.y)*radius,
        center.z+(positions.getZ(k)-center.z)*radius);
    }
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function attachMesh(THREE,parent,geometry,material,name){
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}

export function createStandardPickingTools({THREE,board,finishes,keySideX}){
  const pickRig=new THREE.Group();
  pickRig.name='standard-pin-lab-hook';
  pickRig.scale.setScalar(.42);
  board.add(pickRig);
  const shaftRatio=.805; // Same 15% longer steel and shortened neck as the pin laboratory.
  const pickCurve=new THREE.CatmullRomCurve3(PICK_POINTS.map(([x,y,z])=>
    new THREE.Vector3(.12+(x-.12)*shaftRatio,y,z)),false,'centripetal');
  attachMesh(THREE,pickRig,onePieceTube(THREE,pickCurve,t=>
    .047-.024*smooth(t/.88)-.016*smooth((t-.88)/.12)),
    finishes.chrome,'one-piece-hook-and-tip');

  const handleRig=new THREE.Group();
  handleRig.position.set(-4.27-(3.18*(shaftRatio-1)),-.19,.01);
  handleRig.scale.setScalar(2);
  pickRig.add(handleRig);
  const profile=new THREE.SplineCurve([
    new THREE.Vector2(0,-.669),new THREE.Vector2(.044,-.654),
    new THREE.Vector2(.075,-.630),new THREE.Vector2(.087,-.589),
    new THREE.Vector2(.092,-.530),new THREE.Vector2(.095,-.380),
    new THREE.Vector2(.095,-.240),new THREE.Vector2(.095,-.100),
    new THREE.Vector2(.091,.050),new THREE.Vector2(.086,.200)
  ]).getPoints(64);
  const start=.200,end=.568,length=end-start;
  for(let i=1;i<=40;i++){
    const t=i/40,a=t*t,b=a*t;
    const radius=(2*b-3*a+1)*.086+(b-2*a+t)*(-.035)*length+
      (-2*b+3*a)*.029+(b-a)*(-.12)*length;
    profile.push(new THREE.Vector2(radius,start+t*length));
  }
  const gripGeometry=new THREE.LatheGeometry(profile,64);
  const uvs=gripGeometry.getAttribute('uv'),positions=gripGeometry.getAttribute('position');
  for(let i=0;i<uvs.count;i++){
    const around=uvs.getX(i);
    const along=Math.min(1,Math.max(0,(positions.getY(i)+.669)/1.237));
    uvs.setXY(i,2.5-2*around,along);
  }
  uvs.needsUpdate=true;
  const grip=attachMesh(THREE,handleRig,gripGeometry,finishes.lacquer,'pin-lab-painted-lacquer-handle');
  grip.rotation.z=-Math.PI/2;
  const ferrule=attachMesh(THREE,handleRig,new THREE.TorusGeometry(.032,.0055,12,48),
    finishes.brass,'hook-handle-ferrule');
  ferrule.position.set(.568,0,0);
  ferrule.rotation.y=Math.PI/2;

  const tensionRig=new THREE.Group();
  tensionRig.name='standard-pin-lab-tension-wrench';
  tensionRig.scale.setScalar(.65);
  board.add(tensionRig);
  const wrenchModels=STANDARD_TENSION_TOOLS.map((spec,index)=>{
    const curve=new THREE.CatmullRomCurve3(spec.path.map(([x,y])=>{
      const drop=.085*(1-smooth((x+.95)/.70));
      return new THREE.Vector3(x,y-drop,0);
    }),false,'centripetal');
    const group=new THREE.Group();
    group.name='standard-tension-wrench-'+index;
    tensionRig.add(group);
    const finish=finishes.steel.clone();
    finish.color.setHex(spec.color);
    const tube=onePieceTube(THREE,curve,(_t,point)=>
      THREE.MathUtils.lerp(spec.radius,.017,smooth((point.x+.78)/.48)));
    attachMesh(THREE,group,tube,finish,'continuous-steel-tension-shaft');
    group.visible=index===2;
    return group;
  });
  function update({mode,tension,wrenchIndex=2,wrenchAttemptUntil=0,
    activePin=0,pickId,pickUntil},now){
    const attacking=mode==='attack',stroking=Boolean(pickId&&now<pickUntil);
    const rejected=attacking&&!tension&&now<wrenchAttemptUntil;
    pickRig.visible=attacking;
    tensionRig.visible=attacking&&(tension||rejected);
    wrenchModels.forEach((group,i)=>{group.visible=i===wrenchIndex;});
    // Both working tips enter the *same* left keyway at different heights.
    // A rejected shaft touches the outer metal guide then springs back.
    const trial=rejected?Math.sin((wrenchAttemptUntil-now)/900*Math.PI)*.19:0;
    tensionRig.position.set(keySideX+.14+(tension?0:-.32+trial),-.20,.04);
    tensionRig.rotation.x=tension?-.045:0;
    const insertion=attacking&&tension?0:-.37;
    pickRig.position.set(keySideX+.14+insertion+(activePin*.115),.085,.115);
    // Pivot at the tip: pressing the handle raises one physical pin.
    pickRig.rotation.z=stroking?.035*Math.sin((pickUntil-now)/330*Math.PI):0;
  }
  return {update,pickRig,tensionRig,wrenchModels};
}
