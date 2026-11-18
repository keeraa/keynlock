import {createPinDriveTrain} from './pin-drive.js';
import {createPinPickingTools} from './pin-tools.js';
import {createPinBoreDetails, configurePlugBoreShader} from '../geometry/pin-bores.js';

/** The buildPinMechanism scene is built once; all meshes keep their original transforms. */
export function buildPinMechanism({THREE,document,rand,grainMap,material,mat,root,depthRatio,
  tag,part,addMesh,box,cyl,ring,makeSpring,capsulePin,driverPin,createSpurGear,
  createKeywayPlugGeometry,makeHousing,keyCutHeight,makeKey,modeGroups,coreCenterY,coreCenterZ}) {
  // PIN-TUMBLER STUDY: each visible stack uses one continuous pill-shaped pin.
  const raisedMechanism=.12;
  const pinGroup=new THREE.Group();pinGroup.position.y=raisedMechanism;
  root.add(pinGroup);modeGroups.pin=pinGroup;
  const pinHousing=makeHousing(pinGroup,'Штифтовый цилиндр');
  pinHousing.scale.z=1/depthRatio;
  const pinPlug=new THREE.Group();pinPlug.position.set(0,coreCenterY,coreCenterZ);pinGroup.add(pinPlug);
  pinPlug.scale.z=1/depthRatio;
  const plugMaterial=material(0xc59c63,.76,.46,{transparent:true,opacity:.38,depthWrite:false});
  // Circular cutouts in the barrel reveal physical bores beneath each pin.
  // Positions are uniforms because switching from four to six pins must also
  // move the holes without creating a new material or shader program.
  const plugBorePositions={value:new Float32Array(6).fill(100)};
  // Only the section directly behind the pin stacks disappears when the
  // cylinder is viewed broadside. The solid ends and keyway stay legible.
  const plugCutStart={value:.20},plugCutEnd={value:1.95},plugSideReveal={value:0};
  configurePlugBoreShader(plugMaterial,{plugCutStart,plugCutEnd,plugSideReveal,plugBorePositions});
  const plugSurface=tag(addMesh(pinPlug,createKeywayPlugGeometry(.286,2.05),plugMaterial,[-1.525,0,0]),
    'Сердцевина со сквозной скважиной','Вращающийся цилиндр с настоящим длинным пазом под ключ и отмычку.');
  const plugBores=createPinBoreDetails({THREE,pinPlug,mat,addMesh,tag});
  // Keep the existing brass-ring texture intact. The opaque recessed face
  // carries the same real through-slot and overlaps the rotating plug behind.
  // A tiny radial overlap with the bored entrance hides the old side seams,
  // while staying inside the original plug's 0.286 outer radius.
  const keywayInsert=tag(addMesh(pinPlug,createKeywayPlugGeometry(.284,.335),mat.inner,[-1.82,0,0]),
    'Вкладыш замочной скважины','Непрозрачная металлическая вставка с вертикальным сквозным пазом в круглом входе.');
  cyl(pinPlug,.13,.28,.69,0,0,mat.brass,'x');
  part(pinPlug,[.7,-.6,.5],.38);
  // Five user-provided metal finishes compressed to self-contained WebP maps.
  const pinFinishNames=['Патинированная медь','Чёрная сталь','Матовая сталь','Старая латунь','Золотистая латунь'];
  const pinTextureImages=[
    './assets/pin-patina.webp',
    './assets/pin-black-steel.webp',
    './assets/pin-matte-steel.webp',
    './assets/pin-old-brass.webp',
    './assets/pin-gold-brass.webp'
  ];
  const pinTextureLoader=new THREE.TextureLoader();
  const pinTextures=pinTextureImages.map(uri=>{
    const texture=pinTextureLoader.load(uri);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=8;
    texture.wrapS=THREE.RepeatWrapping;
    return texture;
  });
  const pinStacks=[];
  function makePinPositions(count){
    const n=THREE.MathUtils.clamp(Math.round(Number(count)),4,6);
    const width=n<=4?(n-1)*.48:1.50;
    return Array.from({length:n},(_,i)=>-.44-width/2+i*width/(n-1));
  }
  let pinXs=makePinPositions(4);
  function updatePlugCutawaySpan(positions){
    plugCutStart.value=positions[0]+1.525-.145;
    plugCutEnd.value=positions[positions.length-1]+1.525+.145;
    plugBores.setPositions(positions);
    for(let i=0;i<6;i++)plugBorePositions.value[i]=i<positions.length?
      positions[i]+1.525:100;
  }
  updatePlugCutawaySpan(pinXs);
  const pinLengths=[.72,.76,.70,.74,.75,.71];
  const pinStackRise=.075;
  // Lower the parked key/driver joint to give the pick a longer genuine stroke.
  // The joint still lands exactly at the same shear line when the pin is set.
  const pinExtraTravel=.13;
  const pinShearY=coreCenterY+.286;
  // Small, permanent manufacturing offsets determine the binding order under
  // the selected tension wrench. They do not change with each reset.
  const pinClearances=[.009,.002,.013,.005,.011,.007];
  for(let i=0;i<6;i++){
    const x=pinXs[i]??0, L=pinLengths[i];
    const stack=new THREE.Group();stack.position.set(x,pinStackRise,0);pinGroup.add(stack);
    stack.visible=i<pinXs.length;
    stack.scale.z=1/depthRatio;
    // Rear half only, with open ends: transparent tube caps must never draw
    // across the pin photograph and look like broken material boundaries.
    const tube=addMesh(stack,new THREE.CylinderGeometry(.113,.113,.88,28,1,true,Math.PI/2,Math.PI),
      mat.ghost,[0,.27,coreCenterZ]);
    tube.castShadow=false;tube.receiveShadow=false;
    // A blind drilled cavity extends ABOVE the spring instead of a flat cap.
    const wellWall=addMesh(stack,new THREE.CylinderGeometry(.146,.146,.46,36,1,true,Math.PI/2,Math.PI),
      mat.inner,[0,.83,coreCenterZ]);
    tag(wellWall,`Гнездо пружины ${i+1}`,'Полый расточенный канал, в который пружина входит при сжатии.');
    const boreLining=addMesh(stack,new THREE.CylinderGeometry(.116,.116,.45,36,1,true,Math.PI/2,Math.PI),
      mat.dark,[0,.83,coreCenterZ]);
    boreLining.castShadow=false;
    const socketMouth=ring(stack,.123,.010,0,.590,coreCenterZ,mat.brass,'y');
    tag(socketMouth,`Кромка полости ${i+1}`,'Вход в расточенное гнездо: верхние витки пружины уходят внутрь блока.');
    const pinMaterial=new THREE.MeshStandardMaterial({
      color:0xffffff,map:pinTextures[3],roughness:.57,metalness:.37,roughnessMap:grainMap,
      emissive:0x000000,emissiveIntensity:.65
    });
    // The upper head stays at its original rest height while the lower joint
    // starts deeper, so both parts and the spring travel farther on a real pick.
    const restBottom=pinStackRise+.145-L-pinExtraTravel;
    const keyLength=pinShearY-(coreCenterY+keyCutHeight(i));
    const driverLength=L+pinExtraTravel-keyLength;
    const lowerCenter=restBottom+keyLength*.5-pinStackRise;
    const upperCenter=restBottom+keyLength+driverLength*.5-pinStackRise;
    const pin=capsulePin(stack,keyLength,.088,0,lowerCenter,coreCenterZ,pinMaterial,i);
    const driver=driverPin(stack,driverLength,.088,0,upperCenter,coreCenterZ,
      pinMaterial.clone(),i);
    tag(pin,`Кодовый штифт ${i+1}`,'Нижний штифт повторяет нарезку ключа и вращается с сердцевиной после выравнивания.');
    tag(driver,`Запирающий штифт ${i+1}`,'Верхний штифт удерживается пружиной в неподвижном корпусе до линии среза.');
    // The spring presses on the flat upper driver, never on the key pin.
    const spring=makeSpring(stack,.058,8);
    spring.position.z=coreCenterZ;
    tag(spring,`Пружина ${i+1}`,'Пружина опирается на верхний запирающий штифт и сжимается при его подъёме.');
    part(stack,[(i-2.5)*.29,1,.45],.9,`Канал ${i+1}`,
      'Нижний и верхний штифты смыкаются на линии среза, сохраняя общий медный силуэт.');
    pinStacks.push({stack,pin,driver,spring,L,i,keyLength,driverLength,restBottom,
      requiredLift:coreCenterY+keyCutHeight(i)-restBottom,lift:0});
  }
  // Only the symbol-pin puzzle reveals these delicate alignment grooves and
  // its light guide. They share the existing pin transforms; the copper heads
  // and the free physical inspection mode remain unchanged.
  const symbolGrooveGeometry=new THREE.TorusGeometry(.090,.006,5,32);
  const symbolGrooveMaterial=new THREE.MeshBasicMaterial({color:0xe5c38b,
    transparent:true,opacity:.85,depthWrite:false});
  const symbolGrooves=pinStacks.map(st=>{
    const groove=new THREE.Mesh(symbolGrooveGeometry,symbolGrooveMaterial);
    groove.rotation.x=Math.PI/2;groove.visible=false;groove.castShadow=false;
    groove.position.y=st.keyLength*.5-.045;
    st.pin.add(groove);return groove;
  });
  const symbolBeam=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,2.02,8),
    new THREE.MeshBasicMaterial({color:0xffd58b,transparent:true,opacity:.56,
      depthWrite:false}));
  symbolBeam.rotation.z=Math.PI/2;
  symbolBeam.position.set(-.53,pinShearY-.045,coreCenterZ+.13);
  symbolBeam.visible=false;symbolBeam.castShadow=false;pinGroup.add(symbolBeam);
  // A drilled common block is re-bored when the number of pins changes.
  // Its lower mouth is at y=.59, so the upper coils disappear into the metal.
  const springManifoldGroup=new THREE.Group();
  springManifoldGroup.position.set(-.44,.59+pinStackRise,coreCenterZ/depthRatio);
  springManifoldGroup.scale.z=1/depthRatio; // Keep each drilled bore truly round.
  pinGroup.add(springManifoldGroup);
  function makeManifoldGeometry(pinPositions){
    const section=new THREE.Shape();
    // Leave a genuine clearance to the first gear's maximum tooth radius.
    // All six bores retain a closed outer wall near the drive gear.
    section.moveTo(-1.19,-.265);section.lineTo(.97,-.265);
    section.lineTo(.97,.265);section.lineTo(-1.19,.265);
    section.closePath();
    for(const x of pinPositions){
      const springBore=new THREE.Path();
      springBore.absarc(x+.44,0,.123,0,Math.PI*2,true);
      section.holes.push(springBore);
    }
    return new THREE.ExtrudeGeometry(section,{depth:.52,steps:1,bevelEnabled:false,curveSegments:30});
  }
  const manifoldWalls=addMesh(springManifoldGroup,
    makeManifoldGeometry(pinXs),mat.inner);
  manifoldWalls.rotation.x=-Math.PI/2; // Drilled holes run upward, parallel to the springs.
  const manifoldCap=box(springManifoldGroup,2.11,.12,.53,-.135,.55,0,
    mat.pinManifoldTop,.035); // Solid bar; its hover outline follows the perimeter.
  part(springManifoldGroup,[0,.9,-.55],.67,
    'Опорный блок пружин','Общий стальной блок с расточенными отверстиями и закрытыми сверху полостями.');
  const drive=createPinDriveTrain({THREE,pinGroup,mat,part,box,createSpurGear,tag,cyl,ring});
  const tools=createPinPickingTools({THREE,pinGroup,pinXs,makeKey,depthRatio,
    coreCenterY,coreCenterZ,mat,grainMap,addMesh,tag,part,rand,document});

  return {raisedMechanism,pinGroup,pinHousing,pinPlug,plugCutStart,plugCutEnd,plugSideReveal,plugSurface,keywayInsert,
    plugBores,plugBorePositions,pinFinishNames,pinTextureImages,pinTextures,pinStacks,makePinPositions,pinXs,
    updatePlugCutawaySpan,pinStackRise,pinShearY,pinClearances,symbolGrooves,symbolBeam,
    makeManifoldGeometry,manifoldWalls,manifoldCap,...drive,...tools};
}
