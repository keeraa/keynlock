/** One-piece pick, wooden handle and interchangeable tension wrenches. */
export const TENSION_TOOL_CLEARANCE = Object.freeze({ y: -.235, z: -.05, tipRadius: .017 });

export function createPinPickingTools({THREE,pinGroup,pinXs,makeKey,depthRatio,
  coreCenterY,coreCenterZ,mat,grainMap,addMesh,tag,part,rand,document}) {
  // The first key is built before main.js receives this module's pinXs.
  const pinKey=makeKey(pinGroup,pinXs);
  pinKey.rig.scale.z=1/depthRatio;
  // A single tapered steel shaft and its continuous hooked end enter the keyway.
  // The pointed tip advances from chamber to chamber; pins are set individually.
  const pickRig=new THREE.Group();pickRig.position.set(-3.25,coreCenterY,coreCenterZ);pinGroup.add(pickRig);
  pickRig.scale.z=1/depthRatio;
  // A single swept mesh means no visual seam, detached tip or offset joint.
  const pickShaftRatio=1.15*.70; // Shorter by 30% versus the previous rod.
  const pickReferencePoints=[
    // The tang reaches into the shortened neck beneath its brass collar.
    new THREE.Vector3(-3.32,-.19,.01),new THREE.Vector3(-2.25,-.19,.01),
    new THREE.Vector3(-1.33,-.19,.01),new THREE.Vector3(-.52,-.19,.01),
    new THREE.Vector3(-.21,-.19,.01),new THREE.Vector3(-.07,-.19,.01),
    new THREE.Vector3(.025,-.145,.01),new THREE.Vector3(.12,.025,.01)
  ];
  // Extend the exposed steel by 15% while preserving the picking tip's
  // exact position inside every pin chamber.
  const pickCurve=new THREE.CatmullRomCurve3(pickReferencePoints.map(point=>
    new THREE.Vector3(.12+(point.x-.12)*pickShaftRatio,point.y,point.z)),false,'centripetal');
  const pickTubeSegments=112,pickRadialSegments=12;
  const onePieceSteel=new THREE.TubeGeometry(pickCurve,pickTubeSegments,1,pickRadialSegments,false);
  const sweepPositions=onePieceSteel.getAttribute('position');
  for(let i=0;i<=pickTubeSegments;i++){
    const t=i/pickTubeSegments,center=pickCurve.getPointAt(t);
    const radius=.047-.024*smoothstep01(t/.88)-.016*smoothstep01((t-.88)/.12);
    for(let j=0;j<=pickRadialSegments;j++){
      const k=i*(pickRadialSegments+1)+j;
      sweepPositions.setXYZ(k,
        center.x+(sweepPositions.getX(k)-center.x)*radius,
        center.y+(sweepPositions.getY(k)-center.y)*radius,
        center.z+(sweepPositions.getZ(k)-center.z)*radius);
    }
  }
  onePieceSteel.computeVertexNormals();onePieceSteel.computeBoundingSphere();
  const pickTip=addMesh(pickRig,onePieceSteel,mat.chromed);
  tag(pickTip,'Отмычка','Крючок проходит по ключевому каналу и поднимает штифты по одному.');
  function smoothstep01(v){const t=THREE.MathUtils.clamp(v,0,1);return t*t*(3-2*t);}
  // Shared sculpted handle; its lacquer painting is catalogued independently
  // so other Japanese handles can use the same collection later.
  const handlePaintingData='./assets/handles/japanese/geisha-red-fan.webp';
  const handlePaintingMap=new THREE.TextureLoader().load(handlePaintingData);
  handlePaintingMap.colorSpace=THREE.SRGBColorSpace;
  handlePaintingMap.anisotropy=8;
  handlePaintingMap.wrapS=THREE.RepeatWrapping;
  const paintedLacquer=new THREE.MeshStandardMaterial({
    color:0xffffff,map:handlePaintingMap,metalness:0,roughness:.50,
    side:THREE.DoubleSide
  });
  const handleRig=new THREE.Group();
  handleRig.position.set(-4.27-(3.18*(pickShaftRatio-1)),-.19,.01);
  handleRig.scale.setScalar(2); // Keep the doubled length; refine the silhouette's diameter separately.
  pickRig.add(handleRig);
  // The painted body and neck form a single surface. Start the taper where the
  // main body still has its full curvature; a cubic Hermite segment matches its
  // tangent and reaches the brass collar without the old abrupt red shoulder.
  const handleBodyProfile=new THREE.SplineCurve([
    new THREE.Vector2(0,-.669),new THREE.Vector2(.044,-.654),
    new THREE.Vector2(.075,-.630),new THREE.Vector2(.087,-.589),
    new THREE.Vector2(.092,-.530),new THREE.Vector2(.095,-.380),
    new THREE.Vector2(.095,-.240),new THREE.Vector2(.095,-.100),
    new THREE.Vector2(.091,.050),new THREE.Vector2(.086,.200)
  ]);
  const handleProfilePoints=handleBodyProfile.getPoints(64);
  const taperStart=.200,taperEnd=.568,taperLength=taperEnd-taperStart;
  const startRadius=.086,endRadius=.029;
  const startSlope=-.035,endSlope=-.12;
  for(let step=1;step<=40;step++){
    const t=step/40,t2=t*t,t3=t2*t;
    const radius=(2*t3-3*t2+1)*startRadius
      +(t3-2*t2+t)*startSlope*taperLength
      +(-2*t3+3*t2)*endRadius
      +(t3-t2)*endSlope*taperLength;
    handleProfilePoints.push(new THREE.Vector2(radius,taperStart+t*taperLength));
  }
  // A single continuous, painted lathe replaces the mismatched wood core and
  // offset overlay. Those two surfaces caused the brown disk and jagged rim
  // at the rounded butt. Every point now belongs to the *same* painted skin.
  const gripSurface=new THREE.LatheGeometry(handleProfilePoints,64);
  const gripUV=gripSurface.getAttribute('uv');
  const gripPosition=gripSurface.getAttribute('position');
  for(let i=0;i<gripUV.count;i++){
    const around=gripUV.getX(i);
    const along=THREE.MathUtils.clamp((gripPosition.getY(i)+.669)/1.237,0,1);
    gripUV.setXY(i,2.5-2*around,along);
  }
  gripUV.needsUpdate=true;
  const paintedGrip=addMesh(handleRig,gripSurface,paintedLacquer);
  paintedGrip.rotation.z=-Math.PI/2;
  tag(paintedGrip,'Роспись на рукоятке','Единая лакированная поверхность без швов и выступающих накладок; два японских сюжета по окружности.');
  // The circular face at the shaft also samples the same red lacquer map.
  // Its UVs stay in the red background instead of shrinking a portrait onto
  // the tiny annulus. The metal ferrule finishes the wood-to-steel junction.
  const endFaceGeometry=new THREE.RingGeometry(.016,.033,48);
  const endUV=endFaceGeometry.getAttribute('uv');
  for(let i=0;i<endUV.count;i++)
    endUV.setXY(i,.04+endUV.getX(i)*.04,.96+endUV.getY(i)*.025);
  const gripEnd=addMesh(handleRig,endFaceGeometry,paintedLacquer,[.571,0,0]);
  gripEnd.rotation.y=Math.PI/2;
  tag(gripEnd,'Лакированный передний торец','Торец перед кольцом покрыт той же японской росписью.');
  const ferrule=addMesh(handleRig,new THREE.TorusGeometry(.032,.0055,12,48),mat.brass,[.568,0,0]);
  ferrule.rotation.y=Math.PI/2;
  tag(ferrule,'Металлическое кольцо рукоятки','Кольцо закрывает переход лакированной шейки в стальное шило.');
  part(pickRig,[-1.45,.2,.58],1.0);

  // Lower the exposed wrench a little, blending the displacement to zero
  // before the working tip so its clearance inside the keyway stays unchanged.
  const exposedTensionDrop=.085;
  // Five round steel tools. The two leading choices mirror their button glyphs
  // at the free left end; their tips still share the original keyway.
  function makeTensionCurve(path){
    return new THREE.CatmullRomCurve3(path.map(([x,y])=>{
      const visiblePart=1-THREE.MathUtils.smoothstep(x,-.95,-.25);
      return new THREE.Vector3(x,y-exposedTensionDrop*visiblePart,0);
    }),false,'centripetal');
  }
  function makeTensionTube(curve,radius){
    // The narrow working tip fits below the pick in the same real keyway.
    // The visible outer shaft retains the original thicker round profile.
    const segments=112,radial=12;
    const geometry=new THREE.TubeGeometry(curve,segments,1,radial,false);
    const positions=geometry.getAttribute('position');
    for(let i=0;i<=segments;i++){
      const center=curve.getPointAt(i/segments);
      const t=THREE.MathUtils.smoothstep(center.x,-.78,-.30);
      const r=THREE.MathUtils.lerp(radius,TENSION_TOOL_CLEARANCE.tipRadius,t);
      for(let j=0;j<=radial;j++){
        const vertex=i*(radial+1)+j;
        positions.setXYZ(vertex,
          center.x+(positions.getX(vertex)-center.x)*r,
          center.y+(positions.getY(vertex)-center.y)*r,
          center.z+(positions.getZ(vertex)-center.z)*r);
      }
    }
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    return geometry;
  }
  function makeStampedPatina(){
    const c=document.createElement('canvas');c.width=128;c.height=512;
    const ctx=c.getContext('2d');ctx.fillStyle='#bcb9af';ctx.fillRect(0,0,128,512);
    for(let i=0;i<2600;i++){
      const x=rand()*128,y=rand()*512,r=.4+rand()*3;
      ctx.fillStyle=rand()>.56?`rgba(38,36,30,${.035+rand()*.23})`:`rgba(248,236,210,${.04+rand()*.14})`;
      ctx.fillRect(x,y,r,r*(.5+rand()*1.6));
    }
    for(let i=0;i<140;i++){
      const x=rand()*128,y=rand()*512;
      ctx.strokeStyle=`rgba(249,241,225,${.05+rand()*.17})`;
      ctx.lineWidth=.4+rand()*.6;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rand()-.5)*4,y+2+rand()*40);ctx.stroke();
    }
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1.2,2);
    texture.anisotropy=4;
    return texture;
  }
  const tensionPatina=makeStampedPatina();
  const tensionSpecs=[
    {name:'Прямой Г-образный',color:0x98968a,radius:.034,path:[[-3.16,-.61],[-2.90,-.61],[-2.79,-.61],[-2.75,-.65],[-2.75,-.80],[-2.75,-1.00],[-2.38,-.73],[-1.75,-.41],[-1.11,-.23],[-.84,-.23],[-.68,-.18],[-.59,-.054],[-.50,0],[-.23,0],[.10,0]]},
    {name:'Волнистый',color:0x9b845f,radius:.031,path:[[-2.84,-.83],[-2.64,-.76],[-2.39,-.59],[-2.18,-.71],[-1.92,-.50],[-1.70,-.63],[-1.42,-.38],[-1.18,-.47],[-.94,-.24],[-.72,-.11],[-.55,-.017],[-.31,0],[.10,0]]},
    {name:'Двойной изгиб',color:0x9b8669,radius:.033,path:[[-2.68,-.50],[-3.12,-.84],[-2.66,-1.13],[-2.22,-.65],[-1.60,-.50],[-1.13,-.36],[-.88,-.22],[-.73,-.23],[-.62,-.068],[-.50,0],[-.23,0],[.10,0]]},
    {name:'Крючковый',color:0x8f9188,radius:.031,path:[[-2.88,-1.00],[-3.02,-.94],[-3.06,-.82],[-3.02,-.68],[-2.92,-.57],[-2.77,-.53],[-2.60,-.56],[-2.35,-.58],[-1.69,-.47],[-1.08,-.37],[-.86,-.28],[-.74,-.16],[-.62,-.066],[-.50,0],[-.23,0],[.10,0]]},
    {name:'Прямой тонкий',color:0x9e8867,radius:.035,path:[[-2.85,-.76],[-2.26,-.57],[-1.51,-.32],[-.97,-.18],[-.69,-.061],[-.50,0],[-.23,0],[.10,0]]}
  ];
  const tensionRig=new THREE.Group();
  tensionRig.position.set(-3.75,coreCenterY+TENSION_TOOL_CLEARANCE.y,
    coreCenterZ+TENSION_TOOL_CLEARANCE.z);
  tensionRig.scale.z=1/depthRatio;
  pinGroup.add(tensionRig);
  const tensionModels=tensionSpecs.map((spec,i)=>{
    const finish=new THREE.MeshStandardMaterial({color:spec.color,map:tensionPatina,
      roughnessMap:grainMap,bumpMap:grainMap,bumpScale:.003,metalness:.73,roughness:.49});
    const curve=makeTensionCurve(spec.path);
    const model=new THREE.Group();tensionRig.add(model);
    const main=addMesh(model,makeTensionTube(curve,spec.radius),finish);
    tag(main,spec.name,'Круглый натяжной инструмент. Кончик и отмычка входят в одну скважину.');
    for(const [end,radius] of [[curve.getPoint(0),spec.radius],
      [curve.getPoint(1),TENSION_TOOL_CLEARANCE.tipRadius]]){
      const cap=addMesh(model,new THREE.SphereGeometry(radius,12,8),finish,end.toArray());
      tag(cap,spec.name,'Закруглённый торец металлического стержня.');
    }
    model.visible=i===2;
    return model;
  });
  let selectedTension=2;
  tensionRig.visible=false;
  part(tensionRig,[-.8,-.8,.6],.85,'Натяжной инструмент','Обеспечивает натяжение сердцевины параллельно отмычке.');
  return {pinKey,pickRig,pickTip,handleRig,tensionSpecs,tensionRig,tensionModels,selectedTension};
}
