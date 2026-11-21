// Factories, fields and rotating windmill; effects are owned by this system.
export function createCityIndustry(ctx) {
  const {T,random,TAU,part,factorySites,heightAt,foundationDepth,geometries,effectMaterials,smokePuffs,scene,groundPatch,ribbon,pavedRoadHeight,fieldPlots,farmAccess,upperFarmAccess,materials,walkingPaths=[],walkingAnchors=[]}=ctx;
  const register=(id,p,kind='service')=>walkingPaths.push({id,kind,p});
  let smokeBatch=null,windmillRotor=null;
  function factoryComplex() {
    const smokeMaterial=new T.MeshBasicMaterial({color:'#adb0a2',transparent:true,opacity:.17,depthWrite:false});
    effectMaterials.push(smokeMaterial);
    for(const [x,z,w,d,h] of factorySites) {
      const factoryGround=heightAt(x,z);
      // Foundations extend into the sloping west-bank terrain at every corner.
      const depth=foundationDepth(x,z,w/2,d/2);
      part('stone','box',x,.08-depth/2,z,w+.34,depth+.16,d+.34);
      part('brick','box',x,h/2,z,w,h,d);
      // Three complete adjoining roof bays, joined at even ridges and eaves.
      for(let i=0;i<3;i++) {
        const bay=w/3,xx=x-w/2+(i+.5)*bay,rise=.78;
        const angle=Math.atan2(rise,bay/2),panel=Math.hypot(bay/2,rise)+.2;
        part('roofDark','box',xx-bay/4,h+rise/2,z,panel,.19,d+.35,0,angle,0,factoryGround);
        part('roofDark','box',xx+bay/4,h+rise/2,z,panel,.19,d+.35,0,-angle,0,factoryGround);
        part('iron','box',xx,h+rise+.045,z,.105,.11,d+.4,0,0,0,factoryGround);
      }
      for(let i=-2;i<=2;i++)part('windows','box',x+i*w*.13,h*.52,z+d/2+.07,.55,1.1,.1,0,0,0,factoryGround);
      part('darkTimber','box',x-w*.3,1.65,z+d/2+.11,1.9,2.75,.12);
      part('roofDark','box',x-w*.3,3.12,z+d/2+.59,2.45,.16,1.13,0,0,0,factoryGround);
      for(const xx of [x-w*.3-.98,x-w*.3+.98])
        part('timber','box',xx,1.37,z+d/2+1.03,.13,2.73,.13,0,0,0,factoryGround);
      for(let i=-1;i<=1;i++)part('iron','box',x+i*w*.22,h*.73,z-d/2-.06,.18,1.3,.19,0,0,0,factoryGround);
    }
    for(const [x,z,r,h] of [[-98,-41,.62,11],[-93,-41,.53,14],[-105,-22,.48,9]]) {
      part('darkBrick','cylinder',x,h/2,z,r,h,r);
      part('stone','cylinder',x,h-.12,z,r*1.16,.3,r*1.16);
      part('iron','cylinder',x,h+.13,z,r*.9,.35,r*.9);
      for(let i=0;i<5;i++) {
        smokePuffs.push({x,z,height:heightAt(x,z)+h+.4,phase:i/5+random()*.1,drift:random()*TAU});
      }
    }
    smokeBatch=new T.InstancedMesh(geometries.dome,smokeMaterial,smokePuffs.length);
    smokeBatch.name='factory-smoke';smokeBatch.frustumCulled=false;
    smokeBatch.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(smokeBatch);
    // Cargo and an uninterrupted yard stay on the same west bank as the works;
    // the former railway viaduct ended in a hillside and has been removed.
    groundPatch(-95,-48,8.3,1.65,'road',.048);
    groundPatch(-88.7,-33,3.8,2.1,'road',.048);
    for(const [x,z] of [[-101,-47],[-98,-47]]) {
      part('iron','cylinder',x,1.5,z,1.25,2.8,1.25);
      part('quay','cylinder',x,3.03,z,1.32,.15,1.32);
    }
    for(const [x,z] of [[-93,-47],[-90,-35],[-87,-37]]) {
      part('timber','box',x,.68,z,1.1,1.15,1.1);
      part('iron','box',x,1.29,z,1.17,.08,1.16);
    }
    // Working yards: timber stacks, utility tanks and handcarts rather than
    // further identical factory roofs and dozens of narrow chimneys.
    for(const [x,z] of [[-100,-49],[-89,-34],[-102,-31]]){
      for(let i=0;i<4;i++)part('timber','box',x+(i%2)*.8,.31+(i>>1)*.28,z,.73,.29,2.15);
      part('iron','cylinder',x+1.8,1.02,z-.6,.62,2.05,.62);
      part('quay','cylinder',x+1.8,2.08,z-.6,.7,.14,.7);
    }
    // Short stone access walks end at a factory gate or an existing main road.
    for(const [index,[from,to]] of [
      [[-95,-36.95],[-95,-28.7]],
      [[-104,-18.95],[-104,-12.1]],
      [[-91,-18.95],[-91,-12.1]],
      [[-89.4,-40],[-86,-40]],
    ].entries()){
      ribbon([from,to],1.15,'road',.046,{elevation:(x,z)=>pavedRoadHeight(x,z,.046)});
      register(`factory-access-${index}`,[from,to]);
      walkingAnchors.push({id:`factory-${index}`,kind:'factory',x:from[0],z:from[1]});
    }
  }
  function agriculturalFields() {
    // Fields occupy the distant northeastern countryside. Soil beds, furrows,
    // crops and low field borders all sample the actual rolling terrain.
    for(const [x,z,w,d,plant] of fieldPlots){
      ribbon([[x-w/2,z],[x+w/2,z]],d,'soil',.035,{rough:.015});
      const border=[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],
        [x-w/2,z+d/2],[x-w/2,z-d/2]];
      ribbon(border,.22,'paths',.065);
      let row=0;
      for(let zz=z-d/2+1.15;zz<z+d/2-.65;zz+=1.13){
        const inset=.68+(row%3)*.13;
        ribbon([[x-w/2+inset,zz],[x+w/2-inset,zz]],.46,plant,.095,{rough:.08});
        for(let xx=x-w/2+1.15;xx<x+w/2-.7;xx+=3.2){
          if((row+Math.round(xx*3))%3===0)continue;
          part(plant,'crown',xx,.3,zz,.25,.32,.29);
        }
        row++;
      }
      for(const xx of [x-w/2,x+w/2])for(const zz of [z-d/2,z+d/2]){
        part('timber','box',xx,.31,zz,.11,.62,.11);
      }
      // Every field has a short paved entrance from the shared rural lane.
      const laneZ=z> -54?-54:-74;
      const fieldGate=z>laneZ?z-d/2:z+d/2;
      ribbon([[x,laneZ],[x,fieldGate]],.72,'road',.046);
      register(`field-access-${x}-${z}`,[[x,laneZ],[x,fieldGate]],'rural');
      walkingAnchors.push({id:`field-${x}-${z}`,kind:'field',x,z:fieldGate});
    }
    ribbon(farmAccess,1.05,'road',.05);
    register('lower-farm-road',farmAccess,'rural');
    ribbon([[52,-74],[52,-54]],1.05,'road',.05);
    register('farm-road-link',[[52,-74],[52,-54]],'rural');
    ribbon(upperFarmAccess,1.05,'road',.05);
    register('upper-farm-road',upperFarmAccess,'rural');
  }
  function countrysideWindmill() {
    const x=93,z=-33,base=heightAt(x,z);
    // Stone-and-plaster tower on the upper farmland's skyline.
    part('stone','cylinder',x,3.55,z,2.12,7.1,2.12);
    part('plaster','cylinder',x,7.4,z,1.64,.85,1.64);
    part('roofDark','cone',x,8.32,z,2.65,1.75,2.65);
    part('darkTimber','box',x,1.3,z-2.15,.92,2.24,.15);
    part('iron','dome',x+.26,1.3,z-2.24,.085,.085,.085);
    part('darkTimber','box',x,4.8,z+2.15,.57,.86,.14);
    part('litWindow','box',x,4.8,z+2.23,.39,.66,.09);
    ribbon([[x,-54],[x,-35.5]],1.05,'road',.053,
      {elevation:(px,pz)=>pavedRoadHeight(px,pz,.053)});
    register('windmill-access',[[x,-54],[x,-35.5]],'rural');
    walkingAnchors.push({id:'windmill',kind:'windmill',x,z:-35.5});
    windmillRotor=new T.Group();windmillRotor.name='windmill-rotor';
    windmillRotor.position.set(x,base+6.1,z+2.45);
    const blades=[];
    const bladeMesh=(mat,w,h,depth,yy,zz=0)=>{
      const geo=new T.BoxGeometry(w,h,depth);
      const mesh=new T.Mesh(geo,materials.get(mat));mesh.position.set(0,yy,zz);
      blades.push(geo);return mesh;
    };
    for(let i=0;i<4;i++){
      const blade=new T.Group();blade.rotation.z=i*Math.PI/2;
      blade.add(bladeMesh('darkTimber',.2,4.3,.23,2.25));
      blade.add(bladeMesh('pale',1.08,2.6,.12,3.12,.11));
      for(let j=0;j<6;j++)blade.add(bladeMesh('timber',1.22,.085,.15,1.95+j*.46,.21));
      windmillRotor.add(blade);
    }
    windmillRotor.userData.bladeGeometries=blades;
    const hubGeo=new T.CylinderGeometry(.49,.49,.48,12);hubGeo.rotateX(Math.PI/2);
    const hub=new T.Mesh(hubGeo,materials.get('iron'));
    hub.position.z=.21;windmillRotor.add(hub);
    blades.push(hubGeo);
    scene.add(windmillRotor);
  }
  return {factoryComplex,agriculturalFields,countrysideWindmill,
    get smokeBatch(){return smokeBatch;},get windmillRotor(){return windmillRotor;}};
}
