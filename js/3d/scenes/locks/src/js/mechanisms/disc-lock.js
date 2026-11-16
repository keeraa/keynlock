/** The buildDiscMechanism scene is built once; all meshes keep their original transforms. */
export function buildDiscMechanism({ THREE, root, modeGroups, raisedMechanism, depthRatio, coreCenterY, coreCenterZ, makeHousing, makeKey, createNotchedDisc, addMesh, cyl, part, box, makeSpring, mat }) {
  // DISC DETAINER: individually modelled notched rings with their own axis and spacing.
  const discGroup=new THREE.Group();discGroup.position.y=raisedMechanism;
  root.add(discGroup);modeGroups.disc=discGroup;
  makeHousing(discGroup,'Корпус дискового цилиндра').scale.z=1/depthRatio;
  const discKey=makeKey(discGroup);
  discKey.rig.scale.z=1/depthRatio;
  const detainerDiscs=[];
  for(let i=0;i<6;i++){
    const g=new THREE.Group();g.position.set(-1.17+i*.31,coreCenterY,coreCenterZ);discGroup.add(g);
    addMesh(g,createNotchedDisc(),i%2?mat.brass:mat.copper);
    cyl(g,.10,.12,0,0,0,mat.steel,'x');
    part(g,[(i-2.5)*.44,Math.sin(i*1.4)*.2,.35],.74,`Кодовый диск ${i+1}`,'Поворачивается вокруг продольной оси; паз освобождает запирающую планку.');
    detainerDiscs.push(g);
  }
  const sidebar = part(box(discGroup,1.96,.095,.10,-.42,-.055,.11,mat.steel,.028),[0,1,.55],1.05,
    'Блокирующая планка','Западает в совмещённые пазы дисков и позволяет сердцевине повернуться.');
  for(let i=0;i<2;i++){
    const g = new THREE.Group();g.position.set(-1.24+i*1.65,.30,-.08);discGroup.add(g);
    const s=makeSpring(g,.066,6);s.scale.y=.34;
    part(g,[0,1,-.45],.42,'Возвратная пружина планки');
  }

  return { discGroup, discKey, detainerDiscs, sidebar };
}
