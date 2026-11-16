/** Secondary gear train. It follows pin travel without owning the lock core. */
export function createPinDriveTrain({THREE,pinGroup,mat,part,box,createSpurGear,tag,cyl,ring}) {
  // An auxiliary pin-motion train sits behind the chambers. It visibly
  // follows the pin travel, while the primary plug shaft drives the latch.
  part(box(pinGroup,1.18,.75,.085,1.10,.56,-.51,mat.inner,.075),
    [0,1,-.95],.62,'Опорная плита передачи','Общая жёсткая плита с посадками для двух осей и линейной направляющей.');
  const pinGearDrive=new THREE.Group(),pinGearOutput=new THREE.Group();
  const pinDriveTeeth=12,pinOutputTeeth=16,pinDrivePitch=.23;
  const pinOutputPitch=pinDrivePitch*(pinOutputTeeth/pinDriveTeeth);
  pinGearDrive.position.set(.80,.56,-.38);
  pinGearOutput.position.set(.80+pinDrivePitch+pinOutputPitch,.56,-.38);
  pinGroup.add(pinGearDrive,pinGearOutput);
  const pinDriveWheel=createSpurGear(pinDriveTeeth,pinDrivePitch,.13,mat.brass);
  const pinOutputWheel=createSpurGear(pinOutputTeeth,pinOutputPitch,.13,mat.steel);
  pinGearDrive.add(pinDriveWheel);pinGearOutput.add(pinOutputWheel);
  tag(pinDriveWheel,'Латунная ведущая шестерня','Вспомогательная передача от подъёма штифтов и поворота сердцевины; 12 зубьев.');
  tag(pinOutputWheel,'Стальная ведомая шестерня','16 зубьев, вращается в обратную сторону с отношением 12:16.');
  for(const gear of [pinGearDrive,pinGearOutput]){
    cyl(gear,.072,.47,0,0,-.11,mat.steel,'z',24);
    ring(gear,.100,.018,0,0,.153,mat.brass);
  }
  const pinEccentricRadius=.145;
  // The eccentric journals pass through real open bearing eyes. The link
  // terminates at their outer rims instead of clipping through the pin faces.
  cyl(pinGearOutput,.052,.14,pinEccentricRadius,0,.196,mat.copper,'z',24);
  ring(pinGearOutput,.069,.016,pinEccentricRadius,0,.26,mat.steel,'z');
  part(pinGearDrive,[-.6,.9,.9],.72,'Ведущая шестерня штифтового механизма');
  part(pinGearOutput,[.75,1,.9],.82,'Ведомая шестерня штифтового механизма');
  const pinSliderGuide=part(box(pinGroup,.21,.63,.11,1.17,.10,-.49,mat.dark,.045),
    [.60,-.72,-.7],.50,'Направляющая ползуна','Жёсткий канал, по которому перемещается выходная тяга.');
  const pinSlider=part(box(pinGroup,.16,.19,.105,1.17,.13,-.29,mat.steel,.042),
    [1.1,-.75,.72],.65,'Ползун передачи','Подвижный блок соединён с эксцентриком ведомой шестерни.');
  cyl(pinSlider,.050,.14,0,0,.11,mat.copper,'z',24);
  ring(pinSlider,.069,.016,0,0,.17,mat.steel,'z');
  const pinGearConnectingRod=part(cyl(pinGroup,.038,1,1.17,.37,-.18,mat.steel,'y',18),
    [.65,0,1],.74,'Шатун эксцентрика','Соединяет вращающийся эксцентрик с поступательным ползуном.');
  const pinCamConnectingRod=new THREE.Group();
  pinCamConnectingRod.position.set(1.01,-.04,-.10);pinGroup.add(pinCamConnectingRod);
  pinCamConnectingRod.userData.outer=cyl(pinCamConnectingRod,.041,.38,0,-.14,0,mat.steel,'y',20);
  pinCamConnectingRod.userData.inner=cyl(pinCamConnectingRod,.028,.38,0,.14,0,mat.chromed,'y',20);
  pinCamConnectingRod.userData.collar=cyl(pinCamConnectingRod,.047,.055,0,0,0,mat.copper,'y',20);
  pinCamConnectingRod.userData.camJoint=cyl(pinCamConnectingRod,.064,.072,0,.14,0,mat.brass,'z',24);
  part(pinCamConnectingRod,[1.0,-.5,.75],.68,'Телескопический толкатель кулачка',
    'Два жёстких звена перемещаются внутри направляющей, сохраняя постоянную длину каждого звена.');
  return {pinGearDrive,pinGearOutput,pinDriveTeeth,pinOutputTeeth,pinDriveWheel,pinOutputWheel,
    pinEccentricRadius,pinSliderGuide,pinSlider,pinGearConnectingRod,pinCamConnectingRod};
}
