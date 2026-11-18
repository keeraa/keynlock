/** Shared metal casing, screw fasteners, shackle, latch and cylinder seats. */
import {createSymmetricShackleCurve,createRoundShackleGeometry,
  createRigidShackleTransform} from '../geometry/shackle.js';
import {createBallLatch} from './ball-latch.js';
import {createShacklePhysics} from '../physics/shackle.js';

export function createLockHardware({THREE,document,root,depthRatio,coreCenterY,coreCenterZ,
  mat,addMesh,tag,part,parts,raycastables,setDynamicBase,box,cyl,ring,rod,
  createRearCover,createSideShell,createFrontBezel,createAnnularAxialGeometry,
  createScrewThreadGeometry}) {
  const screwThreadGeometry=createScrewThreadGeometry(-1.39,.017,12);
  function makeScrew(parent,x,y,z,idx) {
    const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
    cyl(g,.055,1.52,0,0,-.69,mat.steel,'z',28);
    const turns=12,first=-1.39,last=.017;
    const thread=addMesh(g,screwThreadGeometry,mat.chromed);
    tag(thread,'Резьба стяжного винта','Непрерывная винтовая нарезка по металлическому стержню.');
    cyl(g,.104,.10,0,0,.095,mat.chromed,'z',24);
    box(g,.112,.022,.011,0,0,.153,mat.dark,.008);
    const angle=[.88,-.88,.88,-.88][idx%4];
    g.rotation.z=angle;
    g.userData.unscrew={baseAngle:angle,pitch:(last-first)/turns,
      threadedLength:1.48,delay:idx*.055};
    return part(g,[0,0,1],1.85,'Стяжной винт',
      'Реальная резьба; при разборке вращается и выходит из резьбового гнезда.');
  }
  function makeLabelTexture() {
    const canvas=document.createElement('canvas');canvas.width=850;canvas.height=160;
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,850,160);
    ctx.fillStyle='#d7c6aa';ctx.font='700 70px Arial';ctx.letterSpacing='13px';
    ctx.fillText('SIKISI',9,86);
    ctx.fillStyle='#8a9c9b';ctx.font='500 25px Arial';ctx.letterSpacing='6px';
    ctx.fillText('PRECISION LOCK WORKS    •    001',13,130);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    return texture;
  }

  // One rounded rear, side and front shell; separate fasteners and inspection.
  const rearCover=part(addMesh(root,createRearCover(),mat.case,[0,0,-.75]),[0,0,-1.6],1.2,
    'Задняя крышка','Литая задняя стенка со скруглёнными углами, утопленными в контур обечайки.');
  const sideShell=part(addMesh(root,createSideShell(),[mat.case,mat.edge],[0,0,-.685]),
    [0,-.45,-1.1],.95,'Цельная боковая обечайка',
    'Все четыре стенки и углы сформированы одним непрерывным скруглённым профилем.');
  const fastenerPosts=[],fastenerWashers=[];
  [-1,1].forEach(ix=>[-1,1].forEach(iy=>{
    const post=part(cyl(root,.108,1.25,ix*1.55,iy*1.08,0,mat.inner,'z',28),
      [0,0,1],.37,'Крепёжная стойка');
    post.userData.explodeDelay=.29;
    const washer=part(ring(root,.108,.018,ix*1.55,iy*1.08,.58,mat.brass),
      [0,0,1],.76,'Крепёжное кольцо','После винта выходит вдоль той же оси.');
    washer.userData.explodeDelay=.15;
    fastenerPosts.push(post);fastenerWashers.push(washer);
  }));
  const frontBezel=part(addMesh(root,createFrontBezel(),mat.case,[0,0,.59]),
    [0,0,1.4],1.16,'Цельная передняя рамка',
    'Одна непрерывная фрезерованная деталь с закруглённым прямоугольным проёмом.');
  const inspectionWindow=part(box(root,3.28,2.38,.045,0,0,.685,mat.glass,.06),
    [0,0,1.4],1.35,'Передняя стенка',
    'Плавно меняет прозрачность при осмотре и вращении.');
  inspectionWindow.castShadow=false;
  const nameplate=box(frontBezel,1.25,.19,.024,0,-1.313,.192,mat.dark,.018);
  const identity=addMesh(frontBezel,new THREE.PlaneGeometry(1.15,.17),
    new THREE.MeshBasicMaterial({map:makeLabelTexture(),transparent:true,depthWrite:false}),
    [0,-1.313,.209]);
  tag(nameplate,'Заводская табличка SIKISI','Шильдик закреплён на цельной нижней части корпуса.');
  identity.castShadow=false;
  [[-1.57,1.09],[1.57,1.09],[-1.57,-1.09],[1.57,-1.09]].forEach(([x,y],i)=>
    makeScrew(root,x,y,.72,i));
  part(box(root,3.22,.13,.13,-.03,-1.03,-.42,mat.inner,.035),
    [0,-1,-.8],.45,'Нижняя направляющая');
  part(box(root,3.22,.12,.12,-.03,1.03,-.44,mat.inner,.035),
    [0,1,-.8],.45,'Верхняя направляющая');

  // A single rigid U-shaped shackle with real bores and a shared ball latch.
  const shacklePivot=new THREE.Group();shacklePivot.position.set(1.52,-.64,.025);
  root.add(shacklePivot);
  const shackleCurve=createSymmetricShackleCurve(THREE);
  tag(addMesh(shacklePivot,createRoundShackleGeometry(THREE,shackleCurve),mat.chromed),
    'Закалённая дужка','Цельный круглый стальной прут с выточенными пазами для двух запирающих шариков.');
  shacklePivot.traverse(object=>{
    if(object.isMesh&&!raycastables.includes(object))tag(object,'Закалённая дужка',
      'Нажми, чтобы открыть замок или проверить защёлку.');
  });
  const shackleCollars=[];
  [-.64,.64].forEach(y=>{
    const collar=new THREE.Group();collar.position.set(1.79,y,.025);root.add(collar);
    collar.scale.z=1/depthRatio;
    const rim=addMesh(collar,createAnnularAxialGeometry(.215,.162,.17),mat.brass);
    tag(rim,'Открытый вход дужки','Настоящее сквозное круглое отверстие с латунной окантовкой.');
    const bore=addMesh(collar,new THREE.CylinderGeometry(.161,.161,.28,48,1,true),
      mat.dark.clone(),[-.01,0,0]);
    bore.rotation.z=Math.PI/2;
    bore.material.side=THREE.DoubleSide;
    ring(collar,.179,.015,.165,0,0,mat.chromed,'x');
    part(collar,[1,0,.35],.75,y<0?'Нижняя полая втулка':'Верхняя полая втулка',
      'Сквозной канал проходит через боковую стенку и принимает ножку дужки.');
    shackleCollars.push(collar);
  });
  shacklePivot.scale.z=1/depthRatio;
  const applyRigidShackleTransform=createRigidShackleTransform(THREE,shacklePivot);
  part(shacklePivot,[1.7,0,.3],1.32);
  const {restoreLockingBalls,updateLockingBalls}=createBallLatch({
    THREE,depthRatio,root,addMesh,mat,tag,part,parts,setDynamicBase});
  const {shackleBody,restoreShackle,releaseShackle,stepShacklePhysics}=
    createShacklePhysics({THREE,shackleCurve,shacklePivot,restoreLockingBalls});

  const lockCam=new THREE.Group();lockCam.position.set(.91,-.31,-.13);root.add(lockCam);
  lockCam.scale.z=1/depthRatio;
  cyl(lockCam,.32,.15,0,0,0,mat.brass,'x',48);
  cyl(lockCam,.11,.32,0,0,0,mat.chromed,'x',36);
  const camEccentric=cyl(lockCam,.09,.16,0,.23,.12,mat.copper,'x',24);
  part(lockCam,[1.2,-.7,.6],.9,'Поворотный кулачок',
    'От сердцевины приводит в действие запирающие шарики.');
  const linkage=new THREE.Group();linkage.position.set(0,.23,.12);lockCam.add(linkage);
  rod(linkage,[0,0,0],[.35,.78,-.02],.054,mat.steel);
  cyl(linkage,.105,.04,.095,0,0,mat.brass,'x',28);
  cyl(linkage,.095,.12,.35,.78,-.02,mat.brass,'x',28);
  part(linkage,[1.1,.4,-.55],.66,'Рычаг кулачка',
    'Рычаг посажен на эксцентриковый шарнир и поворачивается вместе с ним.');
  const driveShaft=new THREE.Group();driveShaft.position.set(.77,-.31,-.09);
  root.add(driveShaft);driveShaft.scale.z=1/depthRatio;
  cyl(driveShaft,.082,.29,0,0,0,mat.copper,'x',28);
  box(driveShaft,.23,.025,.033,0,.077,0,mat.brass,.008);
  part(driveShaft,[.95,-.4,-.65],.56,'Шлицевой приводной вал',
    'Соединяет торец сердцевины с поворотным кулачком запирания.');

  function makeHousing(parent,name) {
    const outer=new THREE.Group();parent.add(outer);
    const sleeve=addMesh(outer,new THREE.CylinderGeometry(.375,.375,2.23,64,1,true,
      Math.PI/2,Math.PI),mat.inner,[-.47,coreCenterY,coreCenterZ]);
    sleeve.rotation.z=Math.PI/2;
    // Existing retaining hoops are real removable fittings, not static ornaments.
    const retainingClips=[-1.54,.64].map((x,i)=>tag(
      ring(outer,.376,.018,x,coreCenterY,coreCenterZ,mat.steel,'x'),
      `Стопорная скоба цилиндра ${i+1}`,
      'Удерживает цилиндр на оси; после снятия освобождает сердцевину.'));
    outer.userData.retainingClips=retainingClips;
    const entrance=addMesh(outer,createAnnularAxialGeometry(.34,.282,.22),mat.edge,
      [-1.91,coreCenterY,coreCenterZ]);
    tag(entrance,'Круглое отверстие цилиндра',
      'Сквозная выточка открыта для ключа и отмычки.');
    const tunnel=addMesh(outer,new THREE.CylinderGeometry(.282,.282,.36,48,1,true),
      mat.dark.clone(),[-1.76,coreCenterY,coreCenterZ]);
    tunnel.rotation.z=Math.PI/2;
    tunnel.material.side=THREE.DoubleSide;
    ring(outer,.299,.020,-1.91,coreCenterY,coreCenterZ,mat.brass,'x');
    return part(outer,[-1.4,-.7,-.25],.52,name,
      'Неподвижный цилиндрический корпус с втулками и опорами.');
  }
  return {rearCover,sideShell,frontBezel,fastenerPosts,fastenerWashers,shackleCollars,
    inspectionWindow,shacklePivot,applyRigidShackleTransform,
    updateLockingBalls,shackleBody,restoreShackle,
    releaseShackle,stepShacklePhysics,lockCam,camEccentric,driveShaft,makeHousing};
}
