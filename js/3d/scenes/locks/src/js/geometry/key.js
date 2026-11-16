// A real, profiled key with teeth aligned to the current cylinder chambers.
export function createKeyGeometry({ THREE, getPinXs, coreCenterY, coreCenterZ,
  addMesh, mat, tag, rod, parts }) {
  const keyCutHeights=[.01,-.06,.03,-.03,.005,-.05];

  function keyCutHeight(index,wrong=false){
    // The wrong third cut leaves that key pin short of the shear line.
    return keyCutHeights[index]-(wrong&&index===2?.12:0);
  }
  function keyToothHalfWidth(xs=getPinXs()){
    return xs.length>1?Math.min(.19,(xs[1]-xs[0])*.40):.19;
  }
  function keySurfaceAt(x,wrong=false){
    // The sliding pin follows the actual blade profile and sloped shoulders.
    if(x< -2.12||x>.72)return null;
    const xs=getPinXs();
    const half=keyToothHalfWidth(xs),flat=half*.53;
    for(let i=0;i<xs.length;i++){
      const distance=Math.abs(x-xs[i]);
      if(distance>half)continue;
      const cut=keyCutHeight(i,wrong);
      return distance<=flat?cut:
        THREE.MathUtils.lerp(cut,-.03,(distance-flat)/(half-flat));
    }
    const first=xs[0]-half,last=xs[xs.length-1]+half;
    if(x<first)return THREE.MathUtils.lerp(-.04,-.03,(x+2.12)/(first+2.12));
    if(x>last)return THREE.MathUtils.lerp(-.03,-.09,(x-last)/(.72-last));
    return -.03;
  }
  function makeKeyProfile(wrong=false,xs=getPinXs()){
    const s=new THREE.Shape();
    const cuts=xs.map((_,i)=>keyCutHeight(i,wrong));
    const halfTooth=keyToothHalfWidth(xs);
    s.moveTo(-2.12,-.255);s.lineTo(.62,-.255);
    s.lineTo(.72,-.13);s.lineTo(.72,-.09);
    for(let i=xs.length-1;i>=0;i--){
      const x=xs[i],y=cuts[i];
      s.lineTo(x+halfTooth,-.03);s.lineTo(x+halfTooth*.53,y);
      s.lineTo(x-halfTooth*.53,y);s.lineTo(x-halfTooth,-.03);
    }
    s.lineTo(-2.12,-.04);s.closePath();
    return new THREE.ExtrudeGeometry(s,{depth:.082,bevelEnabled:true,
      bevelThickness:.015,bevelSize:.012,bevelSegments:2,steps:1});
  }
  function makeKey(parent,xs=getPinXs()){
    const rig=new THREE.Group();rig.position.set(-2.45,coreCenterY,coreCenterZ);parent.add(rig);
    // Cylinder construction passes its own positions here, before the main
    // scene has received the mechanism's mutable chamber array.
    const blade=addMesh(rig,makeKeyProfile(false,xs),mat.key,[0,0,-.041]);
    tag(blade,'Ключ с нарезкой','Профиль ключа поднимает каждый цельный штифт на заданную высоту.');
    const bow=new THREE.Group();bow.position.set(-2.45,-.10,0);rig.add(bow);
    const handle=addMesh(bow,new THREE.TorusGeometry(.285,.10,12,52),mat.key);
    handle.scale.set(1.35,.85,1);
    rod(bow,[.25,-.02,0],[.52,-.01,0],.10,mat.key);
    tag(handle,'Головка ключа','Цельный металл с отверстием под кольцо.');
    parts.push({obj:rig,base:rig.position.clone(),
      dir:new THREE.Vector3(-1.45,0,.7).normalize(),distance:1.2});
    return {rig,blade};
  }
  return { keyCutHeight, keySurfaceAt, makeKeyProfile, makeKey };
}
