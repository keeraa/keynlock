import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import * as T from '../vendor/three.js';
import {createLandmarkModel,landmarkTriangleCount,LANDMARK_CATALOG,LANDMARK_CHIMNEY_DEFAULTS} from '../js/landmarks/landmark-model.js';
import {LANDMARK_TEXTURE_ASSETS,landmarkTextureCacheStats} from '../js/landmarks/landmark-textures.js';

assert.equal(LANDMARK_CATALOG.length,6,'All six signature buildings must have a catalogue entry');
assert.deepEqual(LANDMARK_CATALOG.map(entry=>entry.id),['church','theater','museum','townhall','palace','tower']);

for(const item of LANDMARK_CATALOG){
  const counts=[],bounds=[];
  for(const detail of ['high','medium','low']){
    const model=createLandmarkModel(T,item.id,{detail});
    assert.equal(model.group.isGroup,true);
    assert.ok(model.entranceCount>0,`${item.id}/${detail} has no front entrance`);
    const meshes=[];model.group.traverse(node=>{if(node.isMesh)meshes.push(node);});
    const architecturalStone=meshes.filter(node=>node.material.userData.landmarkSurface==='architecturalStone');
    assert.ok(architecturalStone.length>0,`${item.id}/${detail} must retain its stone architecture`);
    for(const node of architecturalStone)assert.equal(node.material.userData.landmarkTexture,'stone',
      `${item.id}/${detail} needs the unified gouache limestone on its masonry`);
    if(item.id==='church'){
      const aisleWindows=[],buttresses=[],cornices=[],towerOpenings=[];
      model.group.traverse(node=>{
        if(node.userData.landmarkChurchAisleWindow)aisleWindows.push(node);
        if(node.userData.landmarkChurchButtress)buttresses.push(node);
        if(node.userData.landmarkChurchTowerBand)cornices.push(node);
        if(node.userData.landmarkChurchTowerOpening)towerOpenings.push(node);
      });
      assert.equal(aisleWindows.length,2*(detail==='high'?5:detail==='medium'?4:3));
      for(const window of aisleWindows){
        assert.equal(window.children[0].material.userData.landmarkTexture,'glass',
          'Church side window must be painted consistently with the other windows');
        assert.equal(window.children[0].material.color.getHexString(),'f0f2e9');
      }
      assert.equal(towerOpenings.length,2);
      assert.equal(towerOpenings[1].children[0].material.userData.landmarkTexture,'glass',
        'The middle tower window should use the same green stained-glass palette');
      assert.equal(cornices.length,3);
      for(const cornice of cornices)for(const opening of towerOpenings)assert.equal(
        new T.Box3().setFromObject(cornice).intersectsBox(new T.Box3().setFromObject(opening)),false,
        `The church tower cornice cuts through ${opening.userData.entrance?'the carved door':'the arched window'}`);
      for(const buttress of buttresses)for(const window of aisleWindows)assert.equal(
        new T.Box3().setFromObject(buttress).intersectsBox(new T.Box3().setFromObject(window)),false,
        'A church buttress blocks a side window');
    }
    assert.equal(landmarkTextureCacheStats(T).landmarks,1,`${item.id}/${detail} has no texture lease`);
    const entrances=[];model.group.traverse(node=>{if(node.userData.entrance)entrances.push(node);});
    assert.equal(entrances.length,model.entranceCount);
    for(const entrance of entrances){
      const doors=entrance.children.filter(child=>child.userData.landmarkPaintedDoor);
      assert.equal(doors.length,1,`${item.id}/${detail} must use the painted carved door`);
      assert.equal(doors[0].material.userData.landmarkTexture,'door');
      assert.equal(entrance.children.filter(child=>child.userData.landmarkDoorHandle).length,2,
        `${item.id}/${detail} needs a matching pair of door handles`);
    }
    const facadeOpenings=[];
    model.group.traverse(node=>{if(Number.isFinite(node.userData.landmarkOpeningWidth))facadeOpenings.push(node);});
    for(const opening of facadeOpenings){
      const surrounds=opening.children.filter(child=>child.userData.landmarkOpeningSurround);
      assert.equal(surrounds.length,1,`${item.id}/${detail} opening must have one complete frame`);
      const frame=surrounds[0];
      assert.equal(frame.geometry.type,'BufferGeometry');
      assert.equal(frame.geometry.groups.length,0,'A single arch must not split at the shoulders');
      frame.geometry.computeBoundingBox();
      const bounds=frame.geometry.boundingBox;
      const w=opening.userData.landmarkOpeningWidth,h=opening.userData.landmarkOpeningHeight;
      assert(bounds.min.x< -w/2-.1&&bounds.max.x>w/2+.1&&bounds.max.y>h+.1,
        `${item.id}/${detail} arch frame must extend around both jambs and the apex`);
      const mullions=opening.children.filter(child=>child.userData.landmarkWindowMullion);
      if(mullions.length){
        assert.equal(mullions.length,2,'Every window cross must have two rectangular members');
        for(const member of mullions)assert.equal(member.geometry.type,'BoxGeometry',
          'Window crosses must be rectangular to avoid rounded six-sided cylinders');
      }
    }
    const chimneyCaps=meshes.filter(node=>node.userData.landmarkSmokeEmitter);
    assert.equal(chimneyCaps.length,LANDMARK_CHIMNEY_DEFAULTS[item.id]?(item.id==='palace'?2:1):0,
      `${item.id}/${detail} should contain only requested chimneys`);
    const originalMap=facadeOpenings.flatMap(o=>o.children)
      .find(mesh=>mesh.userData.landmarkPaintedGlass)?.material.map;
    model.setWindowAppearance({gloss:100,reflection:100,night:true,glow:85});
    const glassMaterial=facadeOpenings.flatMap(o=>o.children)
      .find(mesh=>mesh.userData.landmarkPaintedGlass)?.material;
    if(glassMaterial){
      assert.equal(glassMaterial.isMeshPhysicalMaterial,true,'Painted glass should support clearcoat');
      assert(glassMaterial.roughness<.08&&glassMaterial.clearcoat>.9,
        'Polished glass should have a visible smooth reflective coating');
      assert(glassMaterial.emissiveIntensity>1,'Night windows should illuminate their painted surfaces');
      assert.equal(glassMaterial.map,originalMap,'Reflection settings must preserve painted glass');
    }
    model.setWindowAppearance({gloss:15,reflection:0,night:false,glow:0});
    if(glassMaterial)assert.equal(glassMaterial.emissiveIntensity,0,
      'Switching back to daytime must remove the luminous window emission');
    const stairs=meshes.filter(node=>Number.isInteger(node.userData.landmarkStairStep))
      .sort((a,b)=>a.userData.landmarkStairStep-b.userData.landmarkStairStep);
    assert(stairs.length>=4,`${item.id}/${detail} needs an entrance staircase`);
    for(let i=1;i<stairs.length;i++){
      const previous=new T.Box3().setFromObject(stairs[i-1]);
      const current=new T.Box3().setFromObject(stairs[i]);
      assert(Math.abs(previous.min.z-current.max.z)<1e-5,
        `${item.id}/${detail} stairs must touch with no overlapping painted treads`);
    }
    if(item.id==='theater'){
      const foundation=meshes.find(node=>node.userData.landmarkTheaterFoundation);
      assert(foundation,'Theater needs a single full-size foundation under the rear stage');
      const span=new T.Box3().setFromObject(foundation);
      assert(span.max.x-span.min.x>=21.2-.001&&span.min.z<=-14.34);
      const podium=meshes.find(node=>node.userData.landmarkColumnSupport);
      assert(podium.geometry.parameters.width>=21.2-.001,
        'Theater portico foundation must span the entire building width');
      const gables=meshes.filter(node=>node.userData.landmarkRoofGable);
      assert.equal(gables.length,4,'Both theater roofs need front and rear sealed gables');
      assert.equal(meshes.filter(node=>node.userData.landmarkRoofSoffit).length,2,
        'Both theater roofs need solid eaves and an opaque underside');
      for(const cap of gables){
        assert.equal(cap.geometry.getAttribute('uv').count,6,'Gable painting needs real UV coordinates');
        const normals=cap.geometry.getAttribute('normal');
        assert(normals.getZ(0)*normals.getZ(3)<0,
          'Rear gable should be visible from both sides without an open triangle');
      }
      const pilasters=meshes.filter(node=>node.userData.landmarkTheaterPilaster);
      assert.equal(pilasters.length,detail==='low'?0:2);
      for(const pillar of pilasters){
        const b=new T.Box3().setFromObject(pillar);
        assert(Math.abs(b.min.y-1.24)<.01&&Math.abs(b.max.y-9.44)<.01,
          'Theater pilaster should touch the podium and upper entablature');
      }
      const entries=facadeOpenings.filter(node=>node.userData.entrance);
      assert.deepEqual(entries.map(node=>Math.round(node.position.x*100)/100),[-5.32,0,5.32],
        'Theater doors must occupy clear bays between the six columns');
      for(const entrance of entries){
        assert.equal(entrance.userData.landmarkOpeningWidth,1.125);
        assert.equal(entrance.userData.landmarkOpeningHeight,2.125);
        assert(entrance.position.z<7,'Theater entrance must be recessed behind the colonnade');
      }
      const triangle=meshes.find(node=>node.userData.landmarkSolidPediment);
      assert(triangle?.geometry.type==='ExtrudeGeometry',
        'Theater pediment needs a closed triangular solid rather than a transparent face');
      assert(new T.Box3().setFromObject(triangle).max.z>10.5,
        'Theater pediment must reach the front of the cornice');
    }
    if(item.id==='museum'){
      const door=entrances[0];
      assert.equal(door.userData.landmarkOpeningWidth,1.425);
      assert.equal(door.userData.landmarkOpeningHeight,2.3);
      const triangle=meshes.find(node=>node.userData.landmarkSolidPediment);
      assert(triangle?.geometry.type==='ExtrudeGeometry'&&new T.Box3().setFromObject(triangle).max.z>11,
        'Museum pediment must be solid and seated at the front of the portico');
    }
    if(item.id==='townhall'){
      const arches=model.group.children.filter(node=>Number.isFinite(node.userData.landmarkOpeningWidth)&&node.position.y<5&&node.position.z>5);
      assert.equal(arches.length,detail==='low'?3:5);
      assert(arches.every(node=>node.position.y>=1.1),
        'Town hall ground floor openings must clear the stone base');
      const dial=meshes.find(node=>node.userData.landmarkClockFace);
      const bezel=meshes.find(node=>node.userData.landmarkClockBezel);
      assert(dial.position.y>22&&bezel.position.y>22,
        'The municipal tower and clock need to be raised');
      assert(Math.abs(dial.position.y-bezel.position.y)<.1,
        'The clock outline should be concentric with the dial');
    }
    if(item.id==='palace'){
      const foundation=meshes.find(node=>node.userData.landmarkPalaceFoundation);
      const towers=meshes.filter(node=>node.userData.landmarkPalaceCornerTower);
      assert(foundation,'Palace must have a full-footprint stone foundation');
      assert.equal(towers.length,4,'Palace must have four supported corner towers');
      const footprint=new T.Box3().setFromObject(foundation);
      for(const tower of towers){
        const bounds=new T.Box3().setFromObject(tower);
        assert(bounds.min.x>=footprint.min.x+.05&&bounds.max.x<=footprint.max.x-.05,
          'Palace corner tower overhangs the foundation');
        assert(bounds.min.z>=footprint.min.z+.05&&bounds.max.z<=footprint.max.z-.05,
          'Palace corner tower extends beyond the foundation depth');
        assert(Math.abs(bounds.min.y-footprint.max.y)<.02,
          'Palace corner tower is suspended above the stone foundation');
      }
      const roofs=meshes.filter(node=>node.userData.landmarkPalaceRoof);
      assert.equal(roofs.length,3,'Palace needs joined roof planes on both wings and central block');
      assert(roofs.every(node=>{
        const bottom=new T.Box3().setFromObject(node).min.y;
        return Math.abs(bottom-11.86)<.01||Math.abs(bottom-14.06)<.01;
      }), 'Palace roof eaves should meet their cornices');
      const pediment=meshes.find(node=>node.userData.landmarkPalacePediment);
      assert(pediment&&Math.abs(pediment.position.z-10.78)<.01,
        'Palace sun pediment must be part of the facade, not a floating group');
      const front=new T.Box3().setFromObject(pediment);
      assert(front.max.z>=10.7&&front.max.z<=11.14,
        'Palace pediment must stand near the front edge of the entablature');
      assert(pediment.geometry.getAttribute('uv')?.count>=6,
        'Palace stone pediment must have gouache UVs');
    }
    const paintedWindows=meshes.filter(node=>node.userData.landmarkPaintedGlass);
    // The low-LOD tower intentionally retains dark lancet openings only.
    if(item.id!=='tower'||detail!=='low')assert.ok(paintedWindows.length>0,
      `${item.id}/${detail} has no gouache window glass`);
    for(const window of paintedWindows)assert.equal(window.material.userData.landmarkTexture,'glass');
    const roofFaces=meshes.filter(node=>node.userData.landmarkRoofSurface);
    assert.ok(roofFaces.length>0,`${item.id}/${detail} has no painted roof faces`);
    for(const face of roofFaces)assert.equal(face.material.userData.landmarkTexture,'roof');
    // Square spires must sit squarely on their masonry towers, rather than
    // presenting a diamond footprint that cuts across the cornice.
    const squareSpires=meshes.filter(node=>node.geometry.type==='ConeGeometry'&&node.geometry.parameters.radialSegments===4);
    for(const spire of squareSpires){
      assert.ok(Math.abs(spire.rotation.y-Math.PI/4)<1e-6,`${item.id}/${detail} square spire is misaligned`);
    }
    assert.ok(meshes.length>12,`${item.id}/${detail} is missing architectural masses`);
    const feet=meshes.filter(node=>node.userData.landmarkColumnFoot);
    const supports=meshes.filter(node=>node.userData.landmarkColumnSupport);
    if(['theater','museum','palace'].includes(item.id)){
      assert.ok(feet.length>=4,`${item.id}/${detail} has too few portico columns`);
      assert.ok(supports.length,`${item.id}/${detail} has no solid portico foundation`);
      const surfaces=supports.map(node=>new T.Box3().setFromObject(node));
      for(const foot of feet){
        const bounds=new T.Box3().setFromObject(foot);
        const center=bounds.getCenter(new T.Vector3());
        const touches=surfaces.some(b=>
          center.x>b.min.x&&center.x<b.max.x&&center.z>b.min.z&&center.z<b.max.z&&
          Math.abs(bounds.min.y-b.max.y)<.07);
        assert.ok(touches,`${item.id}/${detail} has an unsupported floating column at ${center.x}, ${center.z}`);
      }
      const openings=[];
      model.group.traverse(node=>{if(Number.isFinite(node.userData.landmarkWallFaceZ))openings.push(node);});
      assert.ok(openings.length>=3);
      for(const opening of openings)assert.ok(
        Math.abs(opening.position.z-opening.userData.landmarkWallFaceZ)<=.2,
        `${item.id}/${detail} has a facade opening floating away from its wall`);
    }
    for(const node of meshes){
      const geometry=node.geometry;
      const positions=geometry.getAttribute('position');
      assert.ok(positions?.count>=3,`Invalid vertices in ${item.id}/${detail}`);
      for(const coordinate of positions.array)assert.ok(Number.isFinite(coordinate),`NaN in ${item.id}/${detail}`);
      if(node.userData.landmarkPaintedDoor||node.userData.landmarkPaintedGlass){
        const uv=geometry.getAttribute('uv');
        assert.equal(uv.count,positions.count,`${item.id}/${detail} missing opening UVs`);
        for(const coordinate of uv.array)assert.ok(coordinate>=-1e-5&&coordinate<=1+1e-5,
          `${item.id}/${detail} opening image is cropped or stretched`);
      }
      if(node.userData.landmarkRoofSurface){
        const uv=geometry.getAttribute('uv');
        assert.equal(uv.count,positions.count,`${item.id}/${detail} missing roof UVs`);
        for(const coordinate of uv.array)assert.ok(Number.isFinite(coordinate),`${item.id}/${detail} has invalid roof UVs`);
      }
    }
    const check=landmarkTriangleCount(model.group);
    assert.equal(check.triangles,model.stats.triangles);
    counts.push(model.stats.triangles);
    const bounds3=new T.Box3().setFromObject(model.group);
    bounds.push(bounds3.getSize(new T.Vector3()));
    assert.ok(bounds3.min.y>=-.1&&bounds3.max.y>13,`${item.id}/${detail} has bad vertical extents`);
    model.dispose();
    assert.equal(landmarkTextureCacheStats(T).landmarks,0,`${item.id}/${detail} leaked painted textures`);
  }
  assert.ok(counts[0]>counts[1]&&counts[1]>counts[2],`${item.id} must reduce geometry across LOD`);
  for(let n=1;n<3;n++){
    assert.ok(Math.abs(bounds[0].x-bounds[n].x)<2.5,`${item.id} LOD width must be stable`);
    assert.ok(Math.abs(bounds[0].y-bounds[n].y)<1.3,`${item.id} LOD height must be stable`);
    assert.ok(Math.abs(bounds[0].z-bounds[n].z)<2.5,`${item.id} LOD depth must be stable`);
  }
  console.log(`${item.id}: ${counts.join(' / ')} triangles (High / Medium / Low)`);
}
for(const id of ['church','theater','museum','townhall','palace']){
  const model=createLandmarkModel(T,id,{chimneys:true});
  const emitters=[];model.group.traverse(node=>{if(node.userData.landmarkSmokeEmitter)emitters.push(node);});
  assert.equal(emitters.length,id==='palace'?2:1,`${id} should permit adding and removing chimneys`);
  model.dispose();
}
// Preview switching and city instances must share one lease bucket.
const a=createLandmarkModel(T,'church'),b=createLandmarkModel(T,'theater');
assert.equal(landmarkTextureCacheStats(T).landmarks,2);
a.dispose();assert.equal(landmarkTextureCacheStats(T).landmarks,1);
b.dispose();assert.equal(landmarkTextureCacheStats(T).landmarks,0);
assert.deepEqual({door:LANDMARK_TEXTURE_ASSETS.door,roof:LANDMARK_TEXTURE_ASSETS.roof},
  {door:'gouache-entry-door-carved-v1.webp',roof:'gouache-roof-tiles-dense-v3.webp'});
assert.equal(LANDMARK_TEXTURE_ASSETS.stone,'gouache-landmark-stone-v1.webp');
assert.equal(LANDMARK_TEXTURE_ASSETS.moss,'gouache-landmark-moss-v1.webp');
assert.ok(!Object.values(LANDMARK_TEXTURE_ASSETS).includes('gouache-stone-band.webp'),
  'Decorative house band texture must never cover monumental stonework');
for(const filename of Object.values(LANDMARK_TEXTURE_ASSETS))assert.ok(
  (await stat(new URL(`../assets/house-textures/${filename}`,import.meta.url))).size>10000,
  `Missing gouache material: ${filename}`);
for(const bad of ['unknown',''])assert.throws(()=>createLandmarkModel(T,bad),/Неизвестный/);
assert.throws(()=>createLandmarkModel(T,'church',{detail:'ultra'}),/Неизвестный/);
assert.match(await readFile(new URL('../landmark-lab/index.html',import.meta.url),'utf8'),/landmark-editor/);
assert.ok((await stat(new URL('../landmark-lab/style.css',import.meta.url))).size>1000);
console.log('Landmark catalogue, shared paintings, roof UVs, carved entrances, geometry and LOD contracts OK');
