import { createRoundedPanelGeometry } from './rounded-panel.js';

// Oil can model and its isolated preview scene.
export function createOilCanPreview({THREE,document,rand,material,addMesh,cyl,box}) {
  // A real Three.js oil can, modelled after the supplied leather-and-iron flask.
  function makeOilLeatherTexture(){
    const c=document.createElement('canvas');c.width=256;c.height=512;
    const ctx=c.getContext('2d');ctx.fillStyle='#a36b3e';ctx.fillRect(0,0,256,512);
    for(let i=0;i<6200;i++){
      const x=rand()*256,y=rand()*512,w=.5+rand()*11,h=.4+rand()*6;
      ctx.fillStyle=rand()>.55?`rgba(56,30,16,${.02+rand()*.25})`:
        `rgba(241,190,117,${.02+rand()*.19})`;
      ctx.fillRect(x,y,w,h);
    }
    for(let i=0;i<150;i++){
      ctx.beginPath();ctx.strokeStyle=`rgba(51,33,21,${.06+rand()*.2})`;
      ctx.lineWidth=.4+rand()*.9;const x=rand()*256,y=rand()*512;
      ctx.moveTo(x,y);ctx.lineTo(x+(rand()-.5)*24,y+12+rand()*34);ctx.stroke();
    }
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=4;return tex;
  }
  const oilLeatherTexture=makeOilLeatherTexture();
  const oilLeather=new THREE.MeshStandardMaterial({color:0xb58a61,map:oilLeatherTexture,
    bumpMap:oilLeatherTexture,bumpScale:.017,roughness:.85,metalness:.03});
  const oilIron=material(0x343a39,.82,.39),oilDarkIron=material(0x1a2020,.79,.48);
  const oilBrass=material(0xb68a4e,.84,.30),oilStrap=material(0x774729,.14,.86);
  function buildOilCan3D(){
    const can=new THREE.Group();
    const silhouette=[
      [0,0],[.27,.02],[.39,.09],[.43,.21],[.445,.39],[.416,.57],
      [.374,.74],[.319,.94],[.265,1.095],[.231,1.19],[.215,1.27],[0,1.29]
    ];
    addMesh(can,new THREE.LatheGeometry(silhouette.map(([r,y])=>new THREE.Vector2(r,y)),48),oilLeather);
    function hoop(radius,y,tube,mt){
      const mesh=addMesh(can,new THREE.TorusGeometry(radius,tube,16,96),mt,[0,y,0]);
      mesh.rotation.x=Math.PI/2;return mesh;
    }
    function leatherRadius(y){
      for(let i=1;i<silhouette.length;i++){
        const [r0,y0]=silhouette[i-1],[r1,y1]=silhouette[i];
        if(y<=y1)return THREE.MathUtils.lerp(r0,r1,(y-y0)/(y1-y0));
      }
      return silhouette[silhouette.length-1][0];
    }
    function leatherHoop(y,tube,mt){
      // Keep the whole band outside the tapered leather rather than letting
      // its inner half intersect the surface and appear as dashed fragments.
      const mesh=hoop(leatherRadius(y)+tube*1.02,y,tube,mt);
      mesh.name='oil-leather-hoop';
      return mesh;
    }
    leatherHoop(.13,.022,oilIron);leatherHoop(.29,.020,oilDarkIron);
    leatherHoop(1.05,.020,oilIron);leatherHoop(1.245,.020,oilDarkIron);
    for(const angle of [-.59,.52]){
      const path=[];
      for(const [r,y] of [[.407,.14],[.432,.31],[.396,.55],[.346,.79],[.289,1.02],[.230,1.23]]){
        path.push(new THREE.Vector3(Math.sin(angle)*r,y,Math.cos(angle)*r));
      }
      addMesh(can,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path),48,.022,6,false),oilStrap);
    }
    for(const y of [.13,.29]){
      const r=leatherRadius(y)+.018;
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6;
        addMesh(can,new THREE.SphereGeometry(.012,12,9),oilBrass,[Math.sin(a)*r,y,Math.cos(a)*r]);
      }
    }
    // Neck, locking collar and a long tapered steel needle.
    cyl(can,.222,.13,0,1.30,0,oilIron,'y',32);
    cyl(can,.152,.125,0,1.405,0,oilDarkIron,'y',32);
    hoop(.149,1.456,.018,oilBrass);
    const needle=addMesh(can,new THREE.CylinderGeometry(.010,.041,.81,14),oilIron,[0,1.93,0]);
    needle.rotation.z=-.027;
    cyl(can,.019,.09,-.013,2.365,0,oilBrass,'y',12);
    // The thumb pump is offset to the right, as in the reference photograph.
    cyl(can,.039,.285,.294,1.465,0,oilIron,'y',18);
    cyl(can,.102,.060,.294,1.625,0,oilDarkIron,'y',24);
    cyl(can,.075,.030,.294,1.660,0,oilBrass,'y',24);
    box(can,.115,.15,.075,.277,1.31,.105,oilIron,.023);
    // A broad curved side handle, riveted into the leather body.
    const handlePath=new THREE.CatmullRomCurve3([
      new THREE.Vector3(.39,.94,.015),new THREE.Vector3(.60,.94,.015),
      new THREE.Vector3(.79,.70,.035),new THREE.Vector3(.80,.42,.035),
      new THREE.Vector3(.64,.23,.025),new THREE.Vector3(.43,.24,.020)
    ]);
    addMesh(can,new THREE.TubeGeometry(handlePath,46,.039,9,false),oilIron);
    for(const [x,y,z] of [[.39,.94,.015],[.43,.24,.02]]){
      addMesh(can,new THREE.SphereGeometry(.055,16,10),oilBrass,[x,y,z]);
    }
    return can;
  }
  const oilPreviewScene=new THREE.Scene();
  oilPreviewScene.add(new THREE.HemisphereLight(0xe1e2d4,0x463124,2.45));
  const oilPreviewKey=new THREE.DirectionalLight(0xffd9ac,3.1);
  oilPreviewKey.position.set(-2.5,4.5,4);oilPreviewScene.add(oilPreviewKey);
  const oilPreviewCamera=new THREE.PerspectiveCamera(36,1,.1,30);
  oilPreviewCamera.position.set(2.15,2.0,4.15);oilPreviewCamera.lookAt(0,1.14,0);
  // A single rounded backdrop, matching the tension-wrench tray. It belongs to
  // the preview's 3D pass so the flask stays in front of the opaque panel.
  const panelAspect=.70,panelDistance=7.1;
  const halfHeight=panelDistance*Math.tan(THREE.MathUtils.degToRad(oilPreviewCamera.fov/2))*.985;
  const halfWidth=halfHeight*panelAspect,r=halfHeight*.19;
  const panelGeometry=createRoundedPanelGeometry(THREE,{left:-halfWidth,bottom:-halfHeight,
    width:halfWidth*2,height:halfHeight*2,radius:r});
  const panel=new THREE.Mesh(panelGeometry,new THREE.MeshBasicMaterial({
    color:0x15262d,depthTest:false,depthWrite:false,toneMapped:false,
  }));
  panel.name='oil-preview-panel';panel.userData.baseAspect=panelAspect;panel.renderOrder=-100;
  panel.position.copy(oilPreviewCamera.position).addScaledVector(
    new THREE.Vector3(0,1.14,0).sub(oilPreviewCamera.position).normalize(),panelDistance);
  panel.quaternion.copy(oilPreviewCamera.quaternion);
  oilPreviewScene.add(panel);
  const oilPreviewCan=buildOilCan3D();oilPreviewCan.rotation.y=-.37;
  oilPreviewScene.add(oilPreviewCan);
  return {oilPreviewScene,oilPreviewCamera,oilPreviewCan};
}
