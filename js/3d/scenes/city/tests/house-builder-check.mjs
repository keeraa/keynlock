import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import * as THREE from '../vendor/three.js';
import { HOUSE_DEFAULTS, HOUSE_SCHEMA_VERSION, normalizeHouseConfig, getHouseDimensions, createHouseBlueprint, maxFrontWindows, maxSideWindows } from '../js/buildings/house-config.js';
import { windowLayout } from '../js/buildings/house-layout.js';
import { createHouseModel, gableRoofProfile, housePolygonCount, roofSurfaceUV } from '../js/buildings/house-model.js';

const defaults=normalizeHouseConfig({});
assert.deepEqual(defaults, HOUSE_DEFAULTS,'Defaults must be usable as-is');
assert.deepEqual(normalizeHouseConfig({floors:99,width:2,roofType:'unknown',roofColor:'green'}),{
  ...HOUSE_DEFAULTS,floors:4,width:6,
});
assert.equal(normalizeHouseConfig({frontWindows:'3'}).frontWindows,3);
assert.equal(normalizeHouseConfig({frontWindows:-100}).frontWindows,1);
assert.equal(normalizeHouseConfig({plasterColor:'#ABCDEF'}).plasterColor,'#abcdef');
assert.equal(normalizeHouseConfig({floors:'invalid'}).floors,HOUSE_DEFAULTS.floors);
assert.equal(normalizeHouseConfig({damageAmount:150}).damageAmount,100);
assert.equal(normalizeHouseConfig({damageAmount:-10}).damageAmount,0);
assert.equal(normalizeHouseConfig({damageScale:9}).damageScale,5);
assert.equal(normalizeHouseConfig({damageScale:4.9}).damageScale,4.9);
assert.equal(normalizeHouseConfig({plasterDamage:true}).plasterDamage,true);

assert.equal(maxFrontWindows(6,true),3);
assert.equal(maxFrontWindows(8,true),3);
assert.equal(maxFrontWindows(10,true),5);
assert.equal(maxSideWindows(5,true),2);

for(const width of [6,8,10,12]) {
  for(const depth of [5,6.5,10]) {
    for(const shutters of [true,false]) {
      for(const floors of [1,2,4]) {
        for(const balcony of [true,false]) {
          const c=normalizeHouseConfig({width,depth,shutters,floors,balcony,frontWindows:5,sideWindows:4});
          const layout=windowLayout(c);
          assert.ok(c.frontWindows<=maxFrontWindows(width,shutters));
          assert.ok(c.sideWindows<=maxSideWindows(depth,shutters));
          for(let floor=0;floor<floors;floor++) {
            const windows=layout.front.filter(w=>w.floor===floor).sort((a,b)=>a.x-b.x);
            const centerOccupied=floor===0||(floor===1&&balcony);
            const expected=c.frontWindows - (centerOccupied && c.frontWindows%2===1 ? 1 : 0);
            assert.equal(windows.length,expected,'Entrance/balcony must replace their bay');
            for(let i=0;i<windows.length;i++) {
              const w=windows[i];
              const envelope=shutters?w.width*.89:w.width/2+.17;
              assert.ok(Math.abs(w.x)+envelope<c.width/2-.15,'Window and shutters must fit inside facade');
              if(centerOccupied)assert.ok(Math.abs(w.x)-envelope>.91,'Windows must clear the entrance and balcony doors');
              if(i>0){
                const previous=windows[i-1];
                const previousEnvelope=shutters?previous.width*.89:previous.width/2+.17;
                assert.ok(w.x-envelope-(previous.x+previousEnvelope)>.12,'Neighbor windows must not crowd');
              }
            }
          }
          assert.equal(layout.sides.length,c.sideWindows*floors);
          assert.equal(layout.totalWindows,layout.front.length+2*layout.sides.length);
          for(const w of layout.sides) assert.ok(Math.abs(w.z)+w.width/2<=c.depth/2,'Window must fit inside side wall');
          const firstSideRow=layout.sides.filter(w=>w.floor===0).sort((a,b)=>a.z-b.z);
          for(let i=1;i<firstSideRow.length;i++){
            const a=firstSideRow[i-1], b=firstSideRow[i];
            const envelopeA=shutters?a.width*.89:a.width/2+.17;
            const envelopeB=shutters?b.width*.89:b.width/2+.17;
            assert.ok(b.z-a.z-envelopeA-envelopeB>.13,'Side windows must keep visible spacing');
          }
        }
      }
    }
  }
}

for(const width of [6,8,12]) for(const roofHeight of [.7,2.4,4]) {
  const top=7.37;
  const {span,ridgeY,edgeY}=gableRoofProfile({width,roofHeight},top);
  const wallX=width/2;
  const roofAtWall=ridgeY + (edgeY-ridgeY)*wallX/span;
  assert.ok(Math.abs(roofAtWall-top)<1e-9,'Sloping roof must touch the wall at the eave');
  assert.equal(ridgeY,top+roofHeight);
}

const html=await readFile(new URL('../house-builder/index.html',import.meta.url),'utf8');
assert.ok(html.indexOf('aria-labelledby="roof-title"')<html.indexOf('aria-labelledby="dimensions-title"'),'Roof settings should come first');
for(const id of ['fpsValue','polygonValue','plasterDamage','damageAmount','damageScale']) {
  assert.ok(html.includes(`id="${id}"`),`House builder must expose ${id}`);
}
assert.ok(html.includes('name="damageScale" type="range" min=".6" max="5"'), 'Damage scaling slider must reach five times');
assert.equal((html.match(/data-floors="/g)||[]).length,4,'Floor selection uses four buttons');
assert.equal((html.match(/data-house-option="/g)||[]).length,4,'Window and door shapes have pictogram buttons');
assert.ok(!html.includes('Один дом — множество вариантов.'),'Removed description stays removed');
for(const file of ['gouache-plaster.webp','gouache-roof-tiles-dense-v3.webp','gouache-plaster-chipped-v3.webp',
  'gouache-shutters-oak-louver-v5.webp','gouache-entry-door-carved-v1.webp',
  'gouache-window-glass-v2.webp','gouache-window-sill-v2.webp','gouache-stone-band.webp']) {
  const texture=await stat(new URL(`../assets/house-textures/${file}`,import.meta.url));
  assert.ok(texture.size>3000,'Painted textures should be saved with the builder');
}

assert.ok(getHouseDimensions({floors:4}).totalHeight>getHouseDimensions({floors:1}).totalHeight);
for(const floors of [1,2,3,4]) {
  const dims=getHouseDimensions({floors});
  assert.ok(Math.abs(dims.walls - (floors+.2)*HOUSE_DEFAULTS.floorHeight)<1e-9,
    'Only the final storey gains 20% of floor height under the roof');
}
assert.equal(getHouseDimensions({roofType:'flat'}).roof,.3);
const payload=createHouseBlueprint({floors:3,chimney:false});
assert.equal(payload.schema,'keynlock.house');
assert.equal(payload.version,HOUSE_SCHEMA_VERSION);
assert.equal(payload.params.floors,3);
assert.equal(payload.params.chimney,false);
const roofBounds={minHorizontal:0,maxHorizontal:8,minY:3,maxY:11};
assert.equal(roofSurfaceUV([4,7,2],'side',roofBounds)[0],.25);
assert.equal(roofSurfaceUV([4,7,2],'end',roofBounds)[0],.5);
assert.equal(roofSurfaceUV([4,7,2],'end',roofBounds)[1],.5);
const sharedRoofBounds={...roofBounds,referenceHorizontalSpan:12};
assert.equal(roofSurfaceUV([4,7,2],'end',sharedRoofBounds)[0],.5);
assert.ok(Math.abs(roofSurfaceUV([4,7,2],'side',sharedRoofBounds)[0]-1/3)<1e-9,
  'Shorter hip slopes must crop the sheet at the same physical tile size');
const slopeRoofBounds={...sharedRoofBounds,slopeLength:3,referenceSlopeLength:5};
assert.ok(Math.abs(roofSurfaceUV([4,7,2],'end',slopeRoofBounds)[1]-.3)<1e-9,
  'Hip slopes of different lengths must keep their painted tile heights consistent');

// Model generation smoke tests don't need WebGL. All 3 roof types and option
// combinations must produce valid triangle geometry that can be rebuilt.
const model=createHouseModel(THREE,HOUSE_DEFAULTS);
assert.ok(model.group.children.length>20);
for(const roofType of ['gable','hip','flat']) {
  for(const floors of [1,4]) {
    const config={...HOUSE_DEFAULTS,roofType,floors,frontWindows:5,sideWindows:4,balcony:true,timberFrame:true};
    const metrics=model.update(config);
    assert.equal(metrics.windows,windowLayout(config).totalWindows);
    let triangles=0,meshes=0;
    const hipTileDensities=[],hipCourseDensities=[],hipEaveFascias=[];
    model.group.traverse(child=>{
      if(!child.isMesh)return;
      if(child.userData.roofEaveFascia)hipEaveFascias.push(child);
      meshes++;
      const geometry=child.geometry;
      const positions=geometry.getAttribute('position');
      assert.ok(positions?.count>0,'Every mesh has geometry');
      assert.ok(geometry.boundingSphere===null||Number.isFinite(geometry.boundingSphere.radius));
      triangles+=(geometry.index ? geometry.index.count : positions.count)/3;
      if(child.userData.roofSurface){
        const normals=geometry.getAttribute('normal');
        const uv=geometry.getAttribute('uv');
        for(let i=0;i<normals.count;i++) assert.ok(normals.getY(i)>.55,'All pitched roof faces must point outward and upward');
        for(let i=0;i<uv.count;i++){
          assert(uv.getX(i)>=0&&uv.getX(i)<=1&&uv.getY(i)>=0&&uv.getY(i)<=1,
            'Each roof slope must sample a full tile sheet without wrapping seams');
        }
        for(let i=0;i<positions.count;i+=3){
          const u0=uv.getX(i),v0=uv.getY(i),u1=uv.getX(i+1),v1=uv.getY(i+1),u2=uv.getX(i+2),v2=uv.getY(i+2);
          assert.ok(Math.abs((u1-u0)*(v2-v0)-(u2-u0)*(v1-v0))>.001,'Roof UV cannot collapse or stretch into a point');
        }
        if(roofType==='hip'){
          const axis=child.userData.roofSurface==='end'?'x':'z';
          const horizontal=[],horizontalUvs=[],vertical=[],verticalUvs=[];
          for(let i=0;i<positions.count;i++){
            horizontal.push(axis==='x'?positions.getX(i):positions.getZ(i));
            horizontalUvs.push(uv.getX(i));
            vertical.push(positions.getY(i));
            verticalUvs.push(uv.getY(i));
          }
          const physicalSpan=Math.max(...horizontal)-Math.min(...horizontal);
          const textureSpan=Math.max(...horizontalUvs)-Math.min(...horizontalUvs);
          hipTileDensities.push(textureSpan/physicalSpan);
          const minY=Math.min(...vertical),maxY=Math.max(...vertical);
          const eaveIndex=vertical.findIndex(y=>y===minY);
          const ridgeIndex=vertical.findIndex(y=>y===maxY);
          const eaveRun=axis==='x'
            ? positions.getZ(eaveIndex)-positions.getZ(ridgeIndex)
            : positions.getX(eaveIndex)-positions.getX(ridgeIndex);
          const slopeLength=Math.hypot(eaveRun,maxY-minY);
          hipCourseDensities.push((Math.max(...verticalUvs)-Math.min(...verticalUvs))/slopeLength);
        }
      }
    });
    if(roofType==='hip'){
      assert.equal(hipTileDensities.length,4);
      assert.ok(Math.max(...hipTileDensities)-Math.min(...hipTileDensities)<1e-7,
        'Each hip-roof face should use the same tiles per metre along the eaves');
      assert.ok(Math.max(...hipCourseDensities)-Math.min(...hipCourseDensities)<1e-7,
        'Each hip-roof face should use the same rows of tiles per metre up the slope');
      assert.equal(hipEaveFascias.length,4,'All four hip eaves need clean fascia strips');
      const endFascia=hipEaveFascias.find(mesh=>mesh.userData.roofEaveFascia==='end');
      const sideFascia=hipEaveFascias.find(mesh=>mesh.userData.roofEaveFascia==='side');
      assert.ok(Math.abs((Math.abs(endFascia.position.z)-endFascia.geometry.parameters.depth/2)
        -sideFascia.geometry.parameters.depth/2)<1e-7,
        'Fascia corners must butt together with no protruding end');
      assert.ok(Math.abs(endFascia.geometry.parameters.width/2
        -(Math.abs(sideFascia.position.x)+sideFascia.geometry.parameters.width/2))<1e-7,
        'Both fascia strips must end at the same outside corner');
    }
    assert.ok(meshes>80,`Generated house needs actual components (${roofType}, ${floors})`);
    assert.ok(Number.isFinite(triangles)&&triangles>0);
    assert.equal(metrics.polygons,Math.round(triangles));
    assert.equal(metrics.polygons,housePolygonCount(model.group));
  }
}
const clean=model.update({...HOUSE_DEFAULTS,plasterDamage:false});
const sameMesh=model.group.children.find(child=>child.isMesh);
const sameGeometry=sameMesh.geometry;
const sameCount=clean.polygons;
const colorChanged=model.update({...HOUSE_DEFAULTS,woodColor:'#5d444b'});
assert.equal(colorChanged.polygons,sameCount,'Recoloring should keep all house triangles');
assert.equal(sameMesh.geometry,sameGeometry,'Palette changes should preserve geometry objects');
assert.equal(model.group.children.find(child=>child.isMesh),sameMesh,
  'Recoloring should not rebuild the scene hierarchy');
assert.equal(model.group.userData.config.woodColor,'#5d444b');
model.update(HOUSE_DEFAULTS);
const foundationDots=model.group.children.filter(o=>o.isMesh&&
  o.geometry.parameters?.width===.06&&o.geometry.parameters?.height===.08&&o.position.y===.12);
assert.equal(foundationDots.length,0,'No floating decorative dots along the front foundation');
const shutters=[];
model.group.traverse(child=>{if(child.userData.shutterPanel)shutters.push(child);});
assert.ok(shutters.length>0,'Shutters should be separate identifiable painted panels');
for(const panel of shutters){
  assert.equal(panel.children.length,0,'No raised horizontal stripe blocks on shutters');
  assert.equal(panel.material.color.getHexString(),HOUSE_DEFAULTS.woodColor.slice(1),'Shutters inherit wood tint');
  assert.ok(panel.position.y>.05,'Shutters are raised relative to window centre');
  const uv=panel.geometry.getAttribute('uv');
  let minV=Infinity,maxV=-Infinity;
  for(let i=0;i<uv.count;i++){
    assert(uv.getX(i)>=0&&uv.getX(i)<=1&&uv.getY(i)>=0&&uv.getY(i)<=1,
      'Shutter paint must use one unmirrored sheet per leaf');
    minV=Math.min(minV,uv.getY(i));maxV=Math.max(maxV,uv.getY(i));
  }
  assert(maxV-minV>.95,'Every shutter leaf should show a complete course of horizontal slats');
}
const gableFascias=[];
model.group.traverse(child=>{if(child.userData.roofFascia)gableFascias.push(child);});
assert.equal(gableFascias.length,4,'Each gable roof needs four diagonal edge beams');
const gableEaves=model.group.children.filter(child=>Number.isFinite(child.userData.gableEaveBeam));
assert.equal(gableEaves.length,2);
for(const fascia of gableFascias){
  assert(Math.abs(Math.abs(fascia.position.z)-(HOUSE_DEFAULTS.depth/2+.42-.055))<1e-6,
    'Roof fascia should lie alongside the exposed edge, just inside the tiles');
  const support=gableEaves.find(e=>e.userData.gableEaveBeam===fascia.userData.roofFasciaSide);
  assert(new THREE.Box3().setFromObject(fascia).intersectsBox(new THREE.Box3().setFromObject(support)),
    'Sloped roof fascia must physically meet the continuous lower eave beam');
}
for(const [width,depth,roofHeight] of [[6,5,4],[8,10,.7],[12,10,4]]){
  const pitched=createHouseModel(THREE,{...HOUSE_DEFAULTS,width,depth,roofHeight,roofType:'gable'});
  const eaves=pitched.group.children.filter(child=>Number.isFinite(child.userData.gableEaveBeam));
  const beams=pitched.group.children.filter(child=>child.userData.roofFascia);
  assert.equal(beams.length,4);
  for(const fascia of beams){
    const support=eaves.find(e=>e.userData.gableEaveBeam===fascia.userData.roofFasciaSide);
    assert(new THREE.Box3().setFromObject(fascia).intersectsBox(new THREE.Box3().setFromObject(support)),
      `Roof fascia ends before the corner at ${width} × ${depth}, pitch ${roofHeight}`);
  }
  pitched.dispose();
}
const hingePins=[],hingeStraps=[];
model.group.traverse(child=>{
  if(child.userData.shutterHingePin)hingePins.push(child);
  if(child.userData.shutterHingeStrap)hingeStraps.push(child);
});
assert.equal(hingePins.length,hingeStraps.length,'Every shutter hinge needs one fastening plate');
assert.ok(hingePins.length>0);
for(const pin of hingePins){
  assert.equal(pin.geometry.parameters.radialSegments,4,'Small brass hinges use four-sided pins');
  assert.equal(pin.castShadow,false,'Tiny hinge pins do not cast expensive shadows');
}
for(const strap of hingeStraps){
  assert.equal(strap.geometry.type,'PlaneGeometry','Fastening plates are painterly flat details');
  assert.equal(strap.castShadow,false,'Tiny fastening plates do not cast shadows');
}
assert.equal(model.group.children.filter(child=>child.userData.plasterDamage).length,0);
// Curved and straight windows must retain correct leaf silhouettes, hinge
// attachment and compact stone sills at all three LODs.
for(const windowStyle of ['arched','straight'])for(const detail of ['high','medium','low']){
  const sample=createHouseModel(THREE,{...HOUSE_DEFAULTS,windowStyle,shutters:true},{detail});
  const opening=sample.group.children.find(child=>child.userData.windowStyle===windowStyle);
  assert(opening,`${windowStyle}/${detail} must produce visible windows`);
  const leaves=[];
  opening.traverse(child=>{if(child.userData.shutterPanel)leaves.push(child);});
  if(detail==='low'){
    assert.equal(leaves.length,0,'Low LOD omits shutter detail');
  }else{
    assert.equal(leaves.length,2,'Each window retains a pair of hinged shutter leaves');
    for(const leaf of leaves){
      assert.equal(leaf.geometry.type,'ExtrudeGeometry','Shutter must have physical thickness');
      assert.ok(Math.abs(leaf.parent.rotation.y)>2,'Open shutter must pivot outwards at the jamb');
      leaf.geometry.computeBoundingBox();
      const leafHeight=leaf.geometry.boundingBox.max.y-leaf.geometry.boundingBox.min.y;
      assert.ok(windowStyle==='arched'?leafHeight>1.5:leafHeight<1.45,
        'Shutter silhouette must match the window shape');
    }
    const sill=opening.children.find(child=>child.userData.windowSill);
    assert(sill,'Detailed windows must have a stone sill');
    assert.ok(sill.geometry.parameters.height<=.105,'Stone sill must remain slender');
    assert.ok(sill.geometry.parameters.width<=opening.userData.windowWidth+.16,
      'Stone sill may only extend slightly beyond the frame');
  }
  sample.dispose();
}
const worn=model.update({...HOUSE_DEFAULTS,plasterDamage:true,damageAmount:100,damageScale:1.8});
const damageMeshes=model.group.children.filter(child=>child.userData.plasterDamage);
assert.ok(damageMeshes.length>=16);
const verifyDamageCutouts=decals=>{
  for(const decal of decals){
    const positions=decal.geometry.getAttribute('position');
    const cutouts=decal.userData.plasterCutouts;
    assert(Array.isArray(cutouts),'Damage decals must track protected opening envelopes');
    if(decal.geometry.type==='PlaneGeometry')continue;
    assert.equal(positions.count%3,0,'Masked plaster must be triangle geometry');
    for(let i=0;i<positions.count;i+=3){
      const px=[0,1,2].map(k=>positions.getX(i+k));
      const py=[0,1,2].map(k=>positions.getY(i+k));
      for(const cut of cutouts){
        const intersectionX=Math.min(Math.max(...px),cut.x1)-Math.max(Math.min(...px),cut.x0);
        const intersectionY=Math.min(Math.max(...py),cut.y1)-Math.max(Math.min(...py),cut.y0);
        assert(intersectionX<=1e-5||intersectionY<=1e-5,
          'Damaged plaster must never cover the protected glass or carved entrance');
      }
    }
  }
};
verifyDamageCutouts(damageMeshes);
for(const decal of damageMeshes) {
  assert.equal(decal.material.transparent,false,'Plaster cutouts must not switch transparent draw order on rotation');
  assert.equal(decal.material.depthWrite,true,'Damage patches must use the depth buffer');
  assert.ok(decal.material.alphaTest>0,'Empty decal pixels must be discarded');
  assert.equal(decal.material.side,THREE.FrontSide,'Plaster decals only face outward');
  assert.equal(decal.material.alphaToCoverage,false,'Cut plaster must not glow at half-covered pixels');
  assert.ok(decal.material.alphaTest>=.6,'Thin partially transparent decal fringe must be discarded');
}
assert.ok(worn.polygons>clean.polygons,'Damaged plaster must contribute actual decal geometry');
const normalPatch=model.group.children.find(child=>child.userData.plasterDamage);
const normalWidth=normalPatch.geometry.parameters.width;
model.update({...HOUSE_DEFAULTS,plasterDamage:true,damageAmount:100,damageScale:5});
const giantPatch=model.group.children.find(child=>child.userData.plasterDamage);
assert.ok(giantPatch.geometry.parameters.width>normalWidth,'×5 creates larger damage patches');
verifyDamageCutouts(model.group.children.filter(child=>child.userData.plasterDamage));
model.update({...HOUSE_DEFAULTS,plasterDamage:true,damageAmount:0});
assert.equal(model.group.children.filter(child=>child.userData.plasterDamage).length,0);

for(const detail of ['high','medium']){
  const straight=createHouseModel(THREE,{...HOUSE_DEFAULTS,windowStyle:'straight',
    doorStyle:'straight',balcony:true},{detail});
  const squareWindows=straight.group.children.filter(item=>item.userData.windowStyle==='straight');
  assert(squareWindows.length>0);
  for(const window of squareWindows){
    const bar=window.children.find(child=>child.userData.windowMullion==='horizontal');
    assert(bar&&Math.abs(bar.position.y+.12)<1e-6,
      `Rectangular windows must have a lowered continuous crossbar at ${detail} LOD`);
  }
  const balcony=straight.group.children.find(child=>child.userData.balconyDoor);
  const vertical=balcony.children.find(child=>child.userData.doorStile);
  assert(vertical,'Straight balcony entrance needs a full-height central stile');
  assert(vertical.position.y+vertical.geometry.parameters.height/2>=1.92,
    'Straight entrance stile must meet the underside of the lintel');
  straight.dispose();
}

// Close-range regressions: inset arched window, complete balcony rails,
// continuous door arch and timber framing hidden below the eaves.
const inspected=createHouseModel(THREE,{floors:4,width:10,depth:8,roofType:'gable',
  balcony:true,timberFrame:true,windowStyle:'arched',doorStyle:'arched',shutters:false});
const archedWindow=inspected.group.children.find(o=>o.userData.windowStyle==='arched');
assert(archedWindow,'Arched windows must remain individually inspectable before batching');
const assertPaintedGlassUV=(pane,label)=>{
  assert(pane,`${label} must have a painted glass panel`);
  const uv=pane.geometry.getAttribute('uv');
  const us=[];
  for(let i=0;i<uv.count;i++){
    const u=uv.getX(i),v=uv.getY(i);
    assert(u>=0&&u<=1&&v>=0&&v<=1,`${label} cannot mirror or tile glass UVs`);
    us.push(u);
  }
  assert(Math.max(...us)-Math.min(...us)>.75,`${label} should sample one broad area of glass paint`);
};
assertPaintedGlassUV(archedWindow.children.find(o=>o.userData.glassPane),'Arched window');
const windowFrame=archedWindow.children.find(o=>o.userData.windowFrame);
const horizontalBar=archedWindow.children.find(o=>o.userData.windowMullion==='horizontal');
const verticalBar=archedWindow.children.find(o=>o.userData.windowMullion==='vertical');
assert(windowFrame&&horizontalBar&&verticalBar,'Arched window needs frame and both mullions');
assert.equal(windowFrame.geometry.type,'BufferGeometry','Arched rim should use an efficient shallow bevel');
assert.ok(windowFrame.geometry.index.count/3<=72,'Arch rim must stay under 72 triangles per window');
assert(!Array.isArray(windowFrame.material),
  'A joined arch must retain one batchable, unbroken painted material');
assert.equal(windowFrame.geometry.groups.length,0,
  'A continuous arch should not have separate frame sections');
const rimNormals=windowFrame.geometry.getAttribute('normal');
for(let i=0;i<rimNormals.count;i++){
  assert.ok(rimNormals.getZ(i)>.5,'Painted stone bevel must face outward');
}
windowFrame.geometry.computeBoundingBox();
assert(windowFrame.geometry.boundingBox.max.z<.18,'Window frame should be recessed toward the wall');
assert(horizontalBar.position.z+horizontalBar.geometry.parameters.depth/2<.105,
  'Painted mullions must sit inside the arched stone rim, almost flush with glass');
assert(verticalBar.position.z+verticalBar.geometry.parameters.depth/2<.105,
  'Vertical window crosspiece must be recessed with the horizontal one');
assert(horizontalBar.geometry.parameters.width>=archedWindow.userData.windowWidth,
  'Crossbar must meet both window borders');
const innerApex=1.33/2-.025-.012+archedWindow.userData.windowWidth*.35-.035;
const mullionTop=verticalBar.position.y+verticalBar.geometry.parameters.height/2;
assert(mullionTop>=innerApex-.025,'Vertical mullion must reach the glazed arch apex');
const balcony=inspected.group.children.filter(o=>o.userData.balconyPart);
const sides=balcony.filter(o=>o.userData.balconyPart==='side-rail');
const balusters=balcony.filter(o=>o.userData.balconyPart?.endsWith('baluster'));
assert.equal(sides.length,2,'Balcony must have both side handrails');
assert.equal(balcony.filter(o=>o.userData.balconyPart==='post').length,4);
assert.equal(balusters.length,11,'Balcony must have front and side balusters');
const balconyDoor=inspected.group.children.find(o=>o.userData.balconyDoor);
assert(balconyDoor,'Balcony should include an independent glazed door');
assertPaintedGlassUV(balconyDoor.children.find(o=>o.userData.glassPane),'Balcony door');
assert(balconyDoor.children.some(o=>o.userData.balconyMullion),
  'Balcony door should have one continuous timber crossbar');
assert.equal(balconyDoor.children.filter(o=>o.userData.balconySideRail).length,2,
  'Glazing side rails must connect at the edges instead of floating inside');
assert(balconyDoor.children.some(o=>o.userData.balconyKickplate),
  'Glazed balcony door should have a lower wooden kickplate');
const innerBalconyFrame=balconyDoor.children.find(o=>o.userData.balconyInnerFrame);
assert.equal(innerBalconyFrame.geometry.type,'BufferGeometry',
  'Balcony door frame must be a single joined bevel, including both jambs');
assert.equal(balconyDoor.children.find(o=>o.userData.continuousDoorFrame).geometry.type,
  'BufferGeometry','Outer balcony arch must also have an unbroken contour');
const balconyDeckY=.32+inspected.group.userData.config.floorHeight+.23+.09;
for(const bar of balusters){
  const bottom=bar.position.y-bar.geometry.parameters.height/2;
  assert(bottom<=balconyDeckY+.025,'Balusters must touch the balcony floor');
}
const frontDoor=inspected.group.children.find(o=>o.userData.doorStyle==='arched');
const fullDoorFrame=frontDoor.children.find(o=>o.userData.continuousDoorFrame);
const doorPainting=frontDoor.children.find(o=>o.userData.paintedDoorPanel);
assert(fullDoorFrame&&doorPainting,'Front door keeps its arched surround and one painted panel');
assert(!frontDoor.children.some(o=>o.userData.doorStile),
  'Carved door joinery is now artwork rather than a projecting central bar');
assert.equal(frontDoor.children.filter(o=>o.userData.doorHandle).length,2,
  'Only two physical brass handles project from the painted entrance');
const doorUV=doorPainting.geometry.getAttribute('uv');
for(let i=0;i<doorUV.count;i++){
  assert(doorUV.getX(i)>=0&&doorUV.getX(i)<=1&&doorUV.getY(i)>=0&&doorUV.getY(i)<=1,
    'The ornamental door painting must use one unmapped, unmirrored UV sheet');
}
const doorDepth=doorPainting.position.z;
for(const handle of frontDoor.children.filter(o=>o.userData.doorHandle)){
  assert(handle.position.z>doorDepth,'Brass handles must be visibly in front of the door surface');
}
const roofLineTop=.32+inspected.group.userData.config.floors*inspected.group.userData.config.floorHeight;
const topBand=inspected.group.children.find(o=>o.isMesh&&
  Math.abs(o.geometry.parameters?.width-(inspected.group.userData.config.width+.16))<.0001&&
  o.position.y>roofLineTop-.20);
assert.equal(topBand,undefined,'Timber frame must not protrude through the roof slope');
inspected.dispose();

const squareFrameSample=createHouseModel(THREE,{...HOUSE_DEFAULTS,floors:3,
  windowStyle:'straight',shutters:false});
const squareOpening=squareFrameSample.group.children.find(o=>o.userData.windowStyle==='straight');
const surround=squareOpening.children.find(o=>o.userData.rectangularWindowFrame);
assert(surround,'Square windows require one joint-free head and side frame');
assert.equal(surround.geometry.type,'ExtrudeGeometry',
  'Window corners must be connected in a single solid U-shaped mesh');
surround.geometry.computeBoundingBox();
assert(Math.abs((surround.geometry.boundingBox.max.x-surround.geometry.boundingBox.min.x)-
  (squareOpening.userData.windowWidth+.17))<.001,
  'Top lintel must be exactly as wide as the outside edges of both jambs');
const cornices=squareFrameSample.group.children.filter(o=>o.userData.continuousCorniceProfile);
assert.equal(cornices.length,2,'Each floor gap should have one continuous perimeter cornice');
assert.equal(squareFrameSample.group.children.filter(o=>o.userData.continuousCorniceRule).length,0,
  'Near-coplanar overlay rules must not reintroduce dashed render artifacts');
for(const cornice of cornices){
  assert.equal(cornice.geometry.type,'BufferGeometry');
  assert.equal(cornice.geometry.groups.length,0);
  assert.equal(cornice.geometry.getAttribute('position').count/3,48,
    'Single bevelled cornice should contain six joined profile strips and no overlapping boxes');
  assert(cornice.userData.houseInvariant&&cornice.castShadow===false,
    'Cornice must survive LOD transitions without duplicate shadow geometry');
  cornice.geometry.computeBoundingBox();
  assert(Math.abs(cornice.geometry.boundingBox.max.x-(squareFrameSample.group.userData.config.width/2+.138))<1e-5);
}
squareFrameSample.dispose();

for(const doorStyle of ['arched','straight']) for(const detail of ['high','medium','low']){
  const sample=createHouseModel(THREE,{...HOUSE_DEFAULTS,doorStyle},{detail});
  const door=sample.group.children.find(o=>o.userData.doorStyle===doorStyle&&!o.userData.balconyDoor);
  assert(door,`Main ${doorStyle} door must exist at ${detail} detail`);
  assert.equal(door.children.filter(o=>o.userData.paintedDoorPanel).length,1,
    'Front door should have a single flat textured leaf surface at every LOD');
  assert.equal(door.children.filter(o=>o.userData.doorHandle).length,2,
    'Both door handles remain physical at every LOD');
  assert(!door.children.some(o=>o.geometry?.type==='BoxGeometry'&&o.geometry.parameters.depth===.02),
    'Old raised black door inset blocks should be removed');
  sample.dispose();
}

// A 4-storey maximum-sized house used to triple its triangle count when
// straight windows were replaced with arched ones (mostly from 320-triangle
// tubes on every arch). Keep the high-LOD savings even with shutters enabled.
for(const shutters of [false,true]){
  const base={...HOUSE_DEFAULTS,floors:4,width:12,depth:10,frontWindows:5,
    sideWindows:4,shutters,balcony:true,doorStyle:'straight',plasterDamage:false};
  const straight=createHouseModel(THREE,{...base,windowStyle:'straight'});
  const arched=createHouseModel(THREE,{...base,windowStyle:'arched'});
  assert.equal(arched.group.userData.metrics.windows,50);
  assert.ok(arched.group.userData.metrics.polygons-straight.group.userData.metrics.polygons<5000,
    'Arched windows must add fewer than 5k triangles to a maximum house');
  if(!shutters)assert.ok(arched.group.userData.metrics.polygons<10000,
    'A four-storey arched-window house without shutters should remain below 10k triangles');
  straight.dispose();arched.dispose();
}
model.dispose();
assert.equal(model.group.children.length,0);
console.log('House builder config, facade layout and Three.js geometry: passed');
