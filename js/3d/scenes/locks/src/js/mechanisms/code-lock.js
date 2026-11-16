/** The buildCodeMechanism scene is built once; all meshes keep their original transforms. */
export function buildCodeMechanism({ THREE, root, modeGroups, raisedMechanism, depthRatio, coreCenterY, coreCenterZ, makeHousing, createNotchedDisc, createSpurGear, addMesh, cyl, part, box, rod, ring, mat }) {
  // COMBINATION: three pickup discs, drive cam, fence and two gears with
  // pitch-circle distance and opposite tooth-count ratio (no arbitrary overlap).
  const codeGroup=new THREE.Group();codeGroup.position.y=raisedMechanism;
  root.add(codeGroup);modeGroups.code=codeGroup;
  makeHousing(codeGroup,'Корпус кодового узла').scale.z=1/depthRatio;
  const codeDiscs=[];
  for(let i=0;i<3;i++){
    const g=new THREE.Group();g.position.set(-.94+i*.57,coreCenterY,coreCenterZ);codeGroup.add(g);
    addMesh(g,createNotchedDisc(.33,.12,.31,.16),i===1?mat.copper:mat.brass);
    ring(g,.245,.022,.085,0,0,mat.steel,'x');
    part(g,[(i-1)*.7,-.4,.42],1.05,`Кодовое колесо ${i+1}`,'Паз на колесе должен совпасть с положением запирающей гребёнки.');
    codeDiscs.push(g);
  }
  const drive = new THREE.Group();drive.position.set(.91,coreCenterY,coreCenterZ);codeGroup.add(drive);
  addMesh(drive,createNotchedDisc(.38,.12,.21,.15),mat.steel);
  cyl(drive,.11,.43,.17,0,0,mat.brass,'x');
  part(drive,[1.0,-.3,.7],.7,'Ведущий кулачок','Через выступы последовательно подхватывает кодовые диски.');
  const fence = part(box(codeGroup,2.23,.095,.12,-.26,-.02,.02,mat.steel,.025),[0,1,.28],.93,
    'Запирающая гребёнка','Опускается в три паза после набора верной комбинации.');
  const dialRig=new THREE.Group();dialRig.position.set(-1.78,coreCenterY,coreCenterZ);codeGroup.add(dialRig);
  cyl(dialRig,.41,.13,-.10,0,0,mat.edge,'x',56);
  ring(dialRig,.35,.035,-.205,0,0,mat.chromed,'x');
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    rod(dialRig,[-.186,Math.cos(a)*.31,Math.sin(a)*.31],[-.186,Math.cos(a)*.34,Math.sin(a)*.34],.012,mat.brass,8);
  }
  cyl(dialRig,.13,.17,-.17,0,0,mat.brass,'x',32);
  part(dialRig,[-1.2,0,.4],.72,'Наборный лимб','Вращающаяся рукоятка кодового механизма.');
  const gearA=new THREE.Group(),gearB=new THREE.Group();
  const teethA=12,teethB=16,pitchA=.255,pitchB=.34;
  // Tooth tip of one gear clears the other's root by 0.004 world units at contact.
  const gearDistance=pitchA+pitchB;
  gearA.position.set(-.28,.82,.22);gearB.position.set(-.28+gearDistance,.82,.22);
  codeGroup.add(gearA,gearB);
  gearA.add(createSpurGear(teethA,pitchA,.13,mat.brass));
  gearB.add(createSpurGear(teethB,pitchB,.13,mat.steel));
  cyl(gearA,.078,.48,0,0,-.12,mat.inner,'z',20);
  cyl(gearB,.078,.48,0,0,-.12,mat.inner,'z',20);
  ring(gearA,.10,.020,0,0,.16,mat.copper);
  ring(gearB,.10,.020,0,0,.16,mat.chromed);
  part(gearA,[-.4,1,1],.75,'Ведущая шестерня','12 зубьев. Шаг и межосевое расстояние согласованы с ведомой шестернёй.');
  part(gearB,[.65,1,1],.75,'Ведомая шестерня','16 зубьев, противоположное вращение с отношением 12:16.');
  const codeRod=part(rod(codeGroup,[gearB.position.x,.82,.03],[1.14,-.05,-.08],.055,mat.steel),[0,1,-.4],.5,
    'Кулисная тяга','Передаёт движение от пары зубчатых колёс к запирающему рычагу.');

  return { codeGroup, codeDiscs, drive, fence, dialRig, gearA, gearB, teethA, gearDistance, codeRod, teethB, pitchA, pitchB };
}
