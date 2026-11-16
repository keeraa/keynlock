// Oil interactions and GPU-efficient wet-film simulation.
import {createOilTextures} from '../effects/oil-textures.js';
import {createOilMaterialPalettes} from '../effects/oil-materials.js';
import {createOilToolPreview} from '../ui/oil-tool-preview.js';
import {createOilToolInput} from '../ui/oil-tool-input.js';

export function createOilTool({THREE,scene,root,canvas,camera,renderer,document,window,$,
  mat,pointer,raycaster,isVisibleTree,inspectionWindow,plugSurface,plugSideReveal,
  plugCutStart,plugCutEnd,rand,updateRustMaterial,status,tooltip,cancelPointerClick,dispatch,
  oilPreviewScene,oilPreviewCamera,oilPreviewCan}) {
  // OILING: each press is anchored to the hit triangle in local coordinates.
  // Liquid and wet films continue to follow parts while the lock is exploded.
  const { makeOilBlotTexture, makeOilRunTexture } = createOilTextures(THREE);
  const oilBlotTexture=makeOilBlotTexture();
  const oilRunTexture=makeOilRunTexture();
  const oilBlotGeometry=new THREE.PlaneGeometry(1,1);
  const oilRunGeometry=new THREE.PlaneGeometry(1,1);
  const oilMaterials=createOilMaterialPalettes(THREE,oilBlotTexture,oilRunTexture);
  const oilDropGeometry=new THREE.SphereGeometry(.019,12,10);
  const oilDropMaterial=new THREE.MeshPhysicalMaterial({color:0x80663d,metalness:0,
    roughness:.13,clearcoat:1,clearcoatRoughness:.07,transparent:true,opacity:.88,
    depthWrite:false});
  const oilDrops=[],oilMarks=[],oilRuns=[];
  const oilDropInstances=new THREE.InstancedMesh(oilDropGeometry,oilDropMaterial,16);
  oilDropInstances.count=0;
  oilDropInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  oilDropInstances.frustumCulled=false;
  oilDropInstances.userData.oilVisual=true;
  oilDropInstances.castShadow=false;
  oilDropInstances.renderOrder=6;
  scene.add(oilDropInstances);
  const oilDropMatrix=new THREE.Matrix4(),oilDropPosition=new THREE.Vector3();
  const oilDropScale=new THREE.Vector3(),oilDropRotation=new THREE.Quaternion();
  let oilContact=null,oilDripTimer=0;
  let oilImpactCount=0;
  let oilTransformFrame=0;
  const oilTransformCache=new WeakMap();
  const oilWorldNormal=new THREE.Vector3(),oilWorldPoint=new THREE.Vector3();
  const oilUp=new THREE.Vector3(0,1,0);
  const oilLocalGravity=new THREE.Vector3(),oilLocalUp=new THREE.Vector3();
  const oilLocalRight=new THREE.Vector3();
  const oilOrientation=new THREE.Matrix4();
  const oilDecalFront=new THREE.Vector3(0,0,1);
  function oilMeshTransform(mesh){
    let t=oilTransformCache.get(mesh);
    if(!t){
      t={frame:-1,inverse:new THREE.Matrix4(),normal:new THREE.Matrix3()};
      oilTransformCache.set(mesh,t);
    }
    if(t.frame!==oilTransformFrame){
      mesh.updateWorldMatrix(true,false);
      t.inverse.copy(mesh.matrixWorld).invert();
      t.normal.getNormalMatrix(mesh.matrixWorld);
      t.frame=oilTransformFrame;
    }
    return t;
  }
  function findOilSurface(event){
    const rect=canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,
      -(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    // Pick actual triangles rather than only named groups, so screws, springs,
    // shafts and isolated exploded parts can all receive oil.
    const hits=raycaster.intersectObject(root,true);
    for(const hit of hits){
      const obj=hit.object;
      if(!obj.isMesh||!hit.face||!isVisibleTree(obj)||obj.userData.oilVisual)continue;
      if(obj===inspectionWindow&&mat.glass.opacity<.80)continue;
      if(obj===plugSurface&&plugSideReveal.value>.75){
        const x=plugSurface.worldToLocal(hit.point.clone()).x;
        if(x>plugCutStart.value&&x<plugCutEnd.value)continue;
      }
      const m=Array.isArray(obj.material)?obj.material[0]:obj.material;
      if(m?.transparent&&m.opacity<.25)continue;
      return hit;
    }
    return null;
  }
  function getOilTargetWorld(touch){
    const t=oilMeshTransform(touch.mesh);
    oilWorldPoint.copy(touch.localPoint).applyMatrix4(touch.mesh.matrixWorld);
    oilWorldNormal.copy(touch.localNormal).applyMatrix3(t.normal).normalize();
    return oilWorldPoint;
  }
  function makeOilMark(touch){
    const spot=new THREE.Mesh(oilBlotGeometry,oilMaterials.blot(.78));
    spot.userData.oilVisual=true;spot.renderOrder=5;
    spot.position.copy(touch.localPoint).addScaledVector(touch.localNormal,.014);
    spot.quaternion.setFromUnitVectors(oilDecalFront,touch.localNormal);
    spot.scale.set(.044,.037,1);
    touch.mesh.add(spot);
    const entry={spot,touch,growth:0,age:0,angle:(rand()-.5)*.40,
      spreadX:.80+rand()*.38,spreadY:.74+rand()*.48};
    spot.rotateZ(entry.angle);
    oilMarks.push(entry);
    if(oilMarks.length>52){
      const oldest=oilMarks.shift();oldest.spot.parent?.remove(oldest.spot);
    }
    return entry;
  }
  function findRustyMesh(mesh){
    if(mesh.userData.rustState)return mesh;
    const group=mesh.parent;
    return group?.children.find(child=>child.isMesh&&child.userData.rustState)||null;
  }
  function newOilContact(mesh,localPoint,localNormal){
    const touch={mesh,localPoint:localPoint.clone(),
      localNormal:localNormal.clone(),strokeAnchor:localPoint.clone(),
      elapsed:0,rusty:findRustyMesh(mesh)};
    touch.mark=makeOilMark(touch);
    return touch;
  }
  function followOilPointer(hit){
    const mesh=hit.object;
    const nextPoint=mesh.worldToLocal(hit.point.clone());
    const nextNormal=hit.face.normal.clone().normalize();
    const old=oilContact;
    if(old&&old.mesh===mesh&&old.localNormal.dot(nextNormal)>.90){
      const distance=old.strokeAnchor.distanceTo(nextPoint);
      if(distance>.075){
        // Deposit a continuous soft trail on fast mouse movement, retaining
        // separate local anchors so it works on exploded/rotating parts too.
        const steps=Math.min(4,Math.ceil(distance/.095));
        for(let i=1;i<=steps;i++){
          const sample=old.strokeAnchor.clone().lerp(nextPoint,i/steps);
          oilContact=newOilContact(mesh,sample,nextNormal);
          if(i<steps){
            oilContact.mark.growth=.42;
            oilContact.mark.spot.scale.set(.082*oilContact.mark.spreadX,
              .072*oilContact.mark.spreadY,1);
          }
        }
      }else{
        // Within one dab the pool itself tracks the nozzle precisely.
        old.localPoint.copy(nextPoint);
        old.localNormal.copy(nextNormal);
        old.mark.spot.position.copy(nextPoint).addScaledVector(nextNormal,.014);
        old.mark.spot.quaternion.setFromUnitVectors(oilDecalFront,nextNormal);
        old.mark.spot.rotateZ(old.mark.angle);
      }
    }else{
      oilContact=newOilContact(mesh,nextPoint,nextNormal);
    }
  }
  function spawnOilDrop(touch){
    if(oilDrops.length>=16)return;
    // A falling drop keeps its impact coordinate while the cursor moves on.
    const impact={mesh:touch.mesh,localPoint:touch.localPoint.clone(),
      localNormal:touch.localNormal.clone()};
    oilDrops.push({touch:impact,progress:0,duration:.27+rand()*.11,
      drift:(rand()-.5)*.024});
  }
  function orientOilRun(mesh,normal,film){
    const t=oilMeshTransform(mesh);
    oilLocalGravity.set(0,-1,0).transformDirection(t.inverse);
    oilLocalGravity.addScaledVector(normal,-oilLocalGravity.dot(normal));
    if(oilLocalGravity.lengthSq()<.07)return false; // On top surfaces oil pools.
    oilLocalGravity.normalize();
    oilLocalUp.copy(oilLocalGravity).negate();
    oilLocalRight.crossVectors(oilLocalUp,normal).normalize();
    oilOrientation.makeBasis(oilLocalRight,oilLocalUp,normal);
    film.quaternion.setFromRotationMatrix(oilOrientation);
    return true;
  }
  function spawnOilRun(touch){
    const film=new THREE.Mesh(oilRunGeometry,oilMaterials.run(.64));
    film.userData.oilVisual=true;film.renderOrder=5;
    if(!orientOilRun(touch.mesh,touch.localNormal,film))return;
    const sideways=(rand()-.5)*.025;
    const base=touch.localPoint.clone().addScaledVector(oilLocalRight,sideways);
    film.position.copy(base).addScaledVector(touch.localNormal,.018);
    film.scale.set(.026+rand()*.013,.001,1);
    touch.mesh.add(film);
    oilRuns.push({mesh:film,base,normal:touch.localNormal.clone(),down:oilLocalGravity.clone(),
      length:.085+rand()*.095,age:0,speed:.45+rand()*.4});
    if(oilRuns.length>24){
      const oldest=oilRuns.shift();oldest.mesh.parent?.remove(oldest.mesh);
    }
  }
  const {toggleOilTool,dispose:disposeInput}=createOilToolInput({canvas,document,window,
    button:$('oilToolButton'),tooltip,status,dispatch,cancelPointerClick,
    findOilSurface,beginContact:hit=>{followOilPointer(hit);oilDripTimer=.10;},
    moveContact:followOilPointer,loseContact:()=>{oilContact=null;},
    endContact:()=>{oilContact=null;oilDripTimer=0;},
  });
  function tickOil(dt){
    if(disposed)return;
    oilTransformFrame++;
    if(oilContact){
      oilContact.elapsed+=dt;
      oilDripTimer+=dt;
      // A steady visible stream, with a fixed point on the part even as it moves.
      while(oilDripTimer>=.14){spawnOilDrop(oilContact);oilDripTimer-=.14;}
      const mark=oilContact.mark;
      mark.growth=Math.min(1,mark.growth+dt*.55);
      mark.spot.scale.set((.059+.092*mark.growth)*mark.spreadX,
        (.053+.084*mark.growth)*mark.spreadY,1);
      if(oilContact.rusty){
        const rust=oilContact.rusty.userData.rustState;
        rust.level=Math.max(0,rust.level-dt*.37);
        updateRustMaterial(oilContact.rusty);
      }
    }
    for(let i=oilDrops.length-1;i>=0;i--){
      const drop=oilDrops[i];drop.progress+=dt/drop.duration;
      if(drop.progress>=1){
        oilDrops.splice(i,1);
        if(++oilImpactCount%3===0)spawnOilRun(drop.touch);
      }
    }
    // A single draw call renders every active drop. The impact remains fixed
    // in its source part's coordinates even while the lock is disassembled.
    for(let i=0;i<oilDrops.length;i++){
      const drop=oilDrops[i];
      const p=getOilTargetWorld(drop.touch);
      const t=Math.min(1,drop.progress);
      const normalGap=.19*(1-t);
      const fallingGap=.15*(1-t*t);
      oilDropPosition.copy(p).addScaledVector(oilWorldNormal,normalGap)
        .addScaledVector(oilUp,fallingGap);
      oilDropPosition.x+=drop.drift*Math.sin(t*Math.PI);
      oilDropScale.set(.77,1.08+.48*t,.77);
      oilDropMatrix.compose(oilDropPosition,oilDropRotation,oilDropScale);
      oilDropInstances.setMatrixAt(i,oilDropMatrix);
    }
    oilDropInstances.count=oilDrops.length;
    if(oilDrops.length)oilDropInstances.instanceMatrix.needsUpdate=true;
    for(const run of oilRuns){
      run.age+=dt;
      // A turning gear changes the downhill direction of the oil continuously.
      if(run.mesh.parent&&orientOilRun(run.mesh.parent,run.normal,run.mesh)){
        run.down.copy(oilLocalGravity);
      }
      const length=run.length*Math.min(1,run.age*run.speed);
      run.mesh.scale.y=Math.max(.001,length);
      run.mesh.position.copy(run.base).addScaledVector(run.normal,.018)
        .addScaledVector(run.down,length*.5);
      if(run.age>28)run.mesh.material=oilMaterials.run(Math.max(.18,.64-(run.age-28)*.012));
    }
    for(const mark of oilMarks){
      if(mark.touch!==oilContact)mark.age+=dt;
      // The glistening wet patch remains on the part after releasing the mouse.
      if(mark.age>35)mark.spot.material=oilMaterials.blot(Math.max(.24,.78-(mark.age-35)*.012));
    }
  }
  // Preview is an independent UI renderer; oil simulation never reads DOM
  // rectangles or changes the main WebGL viewport.
  const preview=createOilToolPreview({canvas,renderer,window,
    button:$('oilToolButton'),oilPreviewScene,oilPreviewCamera,oilPreviewCan});
  let disposed=false;
  function dispose(){
    if(disposed)return;
    disposed=true;
    disposeInput();
    preview.dispose();
    scene.remove(oilDropInstances);
    for(const {spot} of oilMarks)spot.parent?.remove(spot);
    for(const {mesh} of oilRuns)mesh.parent?.remove(mesh);
    oilMarks.length=0;oilRuns.length=0;oilDrops.length=0;
    oilBlotGeometry.dispose();oilRunGeometry.dispose();oilDropGeometry.dispose();
    oilDropMaterial.dispose();oilBlotTexture.dispose();oilRunTexture.dispose();
    for(const material of [...oilMaterials.blotMaterials,...oilMaterials.runMaterials])
      material.dispose();
  }
  return {tickOil,toggleOilTool,...preview,dispose};
}
