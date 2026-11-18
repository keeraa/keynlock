import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import * as THREE from '../dist/vendor/three.js';
import { KEY_TEMPLATES, METALS, BROTHERHOOD_KEYS, brotherhoodBinding, RUST_TEXTURE,
  keyAssetUrl, defaultDesign, bowPoints, bladeProfile, bladeSections, keyBreakX,
  keyBreakAngle, keyBounds, shaftStartX, keyIconSvg, keyPreviewSvg, createKeyModel,
  updateKeyPaint, disposeKeyModel, createInstancedKeyCollection, disposeInstancedKeyCollection } from '../dist/js/key-model.js';
import { keyMarkings } from '../dist/js/key-markings.js';
import { KEY_ART } from '../dist/js/key-art.js';

function interpolateEdge(points,x) {
  for(let i=1;i<points.length;i++) {
    const [ax,ay]=points[i-1], [bx,by]=points[i];
    if(x<=bx+1e-8) return ay+(by-ay)*(x-ax)/(bx-ax);
  }
  return points[points.length-1][1];
}

function triangleCount(mesh) {
  return (mesh.geometry.index?.count??mesh.geometry.getAttribute('position').count)/3;
}

test('десять самостоятельных заготовок с разными силуэтами', () => {
  assert.equal(KEY_TEMPLATES.length,10);
  assert.equal(new Set(KEY_TEMPLATES.map(t=>t.id)).size,10);
  assert.equal(new Set(KEY_TEMPLATES.map(t=>t.bow)).size,10);
  for(const t of KEY_TEMPLATES) {
    const p=bowPoints(t.bow);
    assert.ok(p.length>=4);
    assert.ok(p.every(v=>v.length===2&&v.every(Number.isFinite)));
  }
});

test('семь шкатулок Братства привязаны к разным районам и алхимическим металлам', () => {
  assert.equal(BROTHERHOOD_KEYS.length,7);
  assert.equal(new Set(BROTHERHOOD_KEYS.map(b=>b.templateId)).size,7);
  assert.equal(new Set(BROTHERHOOD_KEYS.map(b=>b.district)).size,7);
  assert.equal(new Set(BROTHERHOOD_KEYS.map(b=>b.alchemicalMetal)).size,7);
  for(const b of BROTHERHOOD_KEYS) {
    const index=KEY_TEMPLATES.findIndex(t=>t.id===b.templateId);
    assert.ok(index>=0,b.district);
    assert.ok(METALS.some(m=>m.id===b.material),b.alchemicalMetal);
    assert.equal(defaultDesign(index).metal,b.material);
    assert.equal(brotherhoodBinding(b.templateId),b);
  }
  assert.equal(KEY_TEMPLATES.filter(t=>!brotherhoodBinding(t.id)).length,3);
});

test('все ключи создаются полностью при минимальной и максимальной длине стержня', () => {
  for(let i=0;i<KEY_TEMPLATES.length;i++) {
    for(const shaftLength of [1.65,3.05]) {
      const model=createKeyModel({...defaultDesign(i),shaftLength,rustAmount:100});
      const meshes=[];
      model.traverse(obj=>{if(obj.isMesh)meshes.push(obj);});
      assert.ok(meshes.length>0,KEY_TEMPLATES[i].id);
      assert.ok(meshes.every(mesh=>mesh.geometry.getAttribute('position').count>0));
      for(const mesh of meshes)mesh.geometry.dispose();
    }
  }
});

test('головка и стержень разделены по глубине и не мерцают на совпадающих плоскостях', () => {
  for(let i=0;i<KEY_TEMPLATES.length;i++) {
    for(const headSize of [75,100,135]) {
      const design={...defaultDesign(i),headSize,rustAmount:200};
      const model=createKeyModel(design);
      const metal=model.children.find(mesh=>mesh.isMesh&&mesh.userData.exportable!==false);
      assert.ok(metal,KEY_TEMPLATES[i].id);
      const positions=metal.geometry.getAttribute('position');
      const normals=metal.geometry.getAttribute('normal');
      const frontFaces=new Set(),backFaces=new Set();
      for(let vertex=0;vertex<positions.count;vertex++) {
        if(normals.getZ(vertex)>.99)frontFaces.add(positions.getZ(vertex).toFixed(3));
        if(normals.getZ(vertex)<-.99)backFaces.add(positions.getZ(vertex).toFixed(3));
      }
      assert.equal(frontFaces.size,2,`${KEY_TEMPLATES[i].id}: лишняя пересекающаяся поверхность`);
      assert.ok(frontFaces.has((design.thickness/100).toFixed(3)));
      assert.ok(frontFaces.has(((design.thickness/100)-.004).toFixed(3)));
      assert.deepEqual([...backFaces].sort(),['0.000','0.004']);
      assert.equal(metal.material.side,THREE.FrontSide);
      model.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.dispose();});
    }
  }
});

test('у каждого ключа существует замкнутый профиль стержня без пересечения верхней и нижней кромок', () => {
  for(let i=0;i<KEY_TEMPLATES.length;i++) {
    const design=defaultDesign(i);
    const points=bladeProfile(KEY_TEMPLATES[i],design,110);
    assert.ok(points.length>=8&&points.length<222,`${KEY_TEMPLATES[i].id}: профиль не был упрощён`);
    const right=Math.max(...points.map(p=>p[0]));
    const split=points.findIndex(p=>p[0]===right);
    const top=points.slice(0,split+1);
    const bottom=points.slice(split+1).reverse();
    assert.ok(top.length>1&&bottom.length>1);
    assert.ok(points.every(p=>p.length===2&&p.every(Number.isFinite)));
    for(const edge of [top,bottom]) {
      for(let j=1;j<edge.length;j++) assert.ok(edge[j][0]>edge[j-1][0]);
    }
    for(let j=0;j<=50;j++) {
      const x=top[0][0]+(right-top[0][0])*j/50;
      assert.ok(interpolateEdge(top,x)>interpolateEdge(bottom,x),`${KEY_TEMPLATES[i].id}: кромки пересеклись при x=${x}`);
    }
  }
});

test('оптимизированная 3D-модель обходится одним-двумя вызовами отрисовки', () => {
  for(let i=0;i<KEY_TEMPLATES.length;i++) {
    for(const design of [defaultDesign(i),{...defaultDesign(i),teeth:7,cutDepth:45}]) {
      const key=createKeyModel(design);
      const meshes=[];
      key.traverse(obj=>{if(obj.isMesh) meshes.push(obj);});
      assert.ok(meshes.length>=1&&meshes.length<=2,`${KEY_TEMPLATES[i].id}: слишком много объектов`);
      const triangles=meshes.reduce((sum,m)=>sum+triangleCount(m),0);
      assert.ok(triangles<3000,`${KEY_TEMPLATES[i].id}: ${triangles} треугольников`);
      for(const mesh of meshes) {
        const geo=mesh.geometry;
        assert.equal(geo.getAttribute('position').count,geo.getAttribute('uv').count);
        assert.ok(geo.getAttribute('position').array.every(Number.isFinite));
        if(geo.index)assert.ok([...geo.index.array].every(i=>i<geo.getAttribute('position').count));
        geo.dispose();
      }
    }
  }
});

test('смена металла и ржавчины сохраняет геометрию и число полигонов без перестройки', () => {
  for(let i=0;i<KEY_TEMPLATES.length;i++) {
    const design=defaultDesign(i);
    const model=createKeyModel(design);
    const meshes=model.children.filter(child=>child.isMesh);
    const geometries=meshes.map(mesh=>mesh.geometry);
    const positions=meshes.map(mesh=>mesh.geometry.getAttribute('position').array);
    const newMetal=design.metal==='steel'?'copper':'steel';
    updateKeyPaint(model,{...design,metal:newMetal,rustAmount:180});
    assert.ok(meshes.every((mesh,j)=>mesh.geometry===geometries[j]),`${KEY_TEMPLATES[i].id}: геометрия пересоздана`);
    assert.ok(meshes.every((mesh,j)=>mesh.geometry.getAttribute('position').array===positions[j]));
    const metal=meshes.find(mesh=>mesh.userData.exportable!==false);
    assert.equal(metal.material.userData.dirtUniform.value,0);
    assert.equal(meshes.filter(mesh=>mesh.userData.exportable===false).length,0);
    for(const geometry of geometries)geometry.dispose();
  }
});

test('гуашевая грязь не пересчитывает пятна при смене ржавчины или металла', () => {
  for(let i=0;i<KEY_TEMPLATES.length;i++) {
    const base={...defaultDesign(i),dirtAmount:55};
    const coat=svg=>svg.match(/<g class="dirt-coat">[\s\S]*?<\/g>/)?.[0];
    const initial=coat(keyPreviewSvg(base));
    assert.ok(initial,KEY_TEMPLATES[i].id);
    assert.equal(coat(keyPreviewSvg({...base,rustAmount:180,metal:'copper'})),initial);
    assert.equal(coat(keyPreviewSvg({...base,rustAmount:40,metal:'steel'})),initial);
  }
});

test('грязевой налёт непрозрачно покрывает металл и обе стороны кромки, не загрязняя STL', () => {
  for(let i=0;i<KEY_TEMPLATES.length;i++) {
    const base=createKeyModel(defaultDesign(i));
    const dirty=createKeyModel({...defaultDesign(i),dirtAmount:100});
    const meshes=dirty.children.filter(mesh=>mesh.isMesh);
    const dirt=meshes.find(mesh=>mesh.userData.exportable===false&&mesh.geometry.hasAttribute('color'));
    assert.ok(dirt,KEY_TEMPLATES[i].id);
    assert.equal(dirt.userData.outlineable,true,`${KEY_TEMPLATES[i].id}: кромка отсутствует в экранной обводке`);
    assert.ok(meshes.length<=3,`${KEY_TEMPLATES[i].id}: дорогая отрисовка грязи`);
    const triangles=meshes.reduce((total,mesh)=>total+triangleCount(mesh),0);
    assert.ok(triangles<2000,`${KEY_TEMPLATES[i].id}: слишком много полигонов при максимальном налёте`);
    assert.ok(dirt.geometry.getAttribute('position').array.every(Number.isFinite));
    assert.equal(dirt.material.transparent,false);
    assert.equal(dirt.material.depthWrite,true);
    assert.equal(dirt.material.side,2); // DoubleSide: грязь видна с оборота
    const paintedMetal=meshes.find(mesh=>mesh.userData.exportable===true);
    assert.equal(paintedMetal.material.userData.dirtUniform.value,1);
    assert.equal(dirt.geometry.getAttribute('position').count,dirt.geometry.getAttribute('color').count);
    const outer=dirt.geometry.getAttribute('position');
    assert.ok(outer.count>100);
    const depth=defaultDesign(i).thickness/100;
    const dirtLevels=new Set(Array.from({length:outer.count},(_,j)=>outer.getZ(j).toFixed(3)));
    assert.deepEqual([...dirtLevels].sort(),[
      depth+.009,depth+.005,-.009,-.005,
    ].map(z=>z.toFixed(3)).sort(),`${KEY_TEMPLATES[i].id}: грязь оторвана от торцов`);
    assert.equal(base.children.some(mesh=>mesh.geometry.hasAttribute('color')),false);
    const flat=keyPreviewSvg({...defaultDesign(i),dirtAmount:100});
    assert.match(flat,/class="dirt-crust"/);
    assert.match(flat,/class="dirt-coat"/);
    assert.match(flat,/fill="#55412d"/); // при 100% есть непрозрачная основа
    const crustPosition=flat.indexOf('<g class="dirt-crust">');
    const metalPosition=flat.indexOf(`fill="url(#keypaint)"`);
    assert.ok(crustPosition>=0&&crustPosition<metalPosition,`${KEY_TEMPLATES[i].id}: налёт рисуется поверх металла`);
    assert.match(flat,/class="dirt-crust"[\s\S]*?stroke="#332a23"/);
    assert.doesNotMatch(flat,/fill="none" stroke="#332a23" stroke-width="\.035"/);
    assert.doesNotMatch(flat,/class="dirt-crust" opacity=/);
    assert.doesNotMatch(flat,/class="dirt-coat" opacity=/);
    assert.match(keyPreviewSvg({...defaultDesign(i),dirtAmount:45}),/class="dirt-coat"/);
    assert.doesNotMatch(keyPreviewSvg(defaultDesign(i)),/class="dirt-crust"/);
    assert.doesNotMatch(keyPreviewSvg(defaultDesign(i)),/class="dirt-coat"/);
    base.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.dispose();});
    dirty.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.dispose();});
  }
});

test('тонкие округлые контуры экономят треугольники и вершины на всех десяти ключах', () => {
  const maxDirtyTriangles=[706,544,604,940,812,280,866,604,528,1182];
  let indexedBatches=0,vertexReferences=0,uniqueVertices=0;
  for(let i=0;i<KEY_TEMPLATES.length;i++) {
    const model=createKeyModel({...defaultDesign(i),dirtAmount:100});
    let triangles=0;
    model.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const geometry=mesh.geometry;
      triangles+=triangleCount(mesh);
      const referenced=geometry.index?.count??geometry.getAttribute('position').count;
      vertexReferences+=referenced;
      uniqueVertices+=geometry.getAttribute('position').count;
      if(geometry.index)indexedBatches++;
      geometry.dispose();
    });
    assert.ok(triangles<=maxDirtyTriangles[i],`${KEY_TEMPLATES[i].id}: сетка стала плотнее (${triangles})`);
  }
  assert.ok(indexedBatches>=10,'сетки всех десяти ключей должны использовать общие вершины');
  assert.ok(uniqueVertices<vertexReferences*.7,'повторные вершины сократились менее чем на 30%');
});

test('зал из 1000 ключей использует инстансы и не пересоздаёт 1000 геометрий', () => {
  const placements=Array.from({length:1000},(_,i)=>({
    template:i%KEY_TEMPLATES.length,
    matrix:new THREE.Matrix4().makeTranslation(i%40,Math.floor(i/40),0),
  }));
  const hall=createInstancedKeyCollection(placements);
  assert.equal(hall.userData.keyCount,1000);
  assert.equal(hall.userData.uniqueDesigns,10);
  assert.ok(hall.userData.drawCalls<=10,`${hall.userData.drawCalls} вызовов отрисовки`);
  assert.equal(hall.userData.renderedTriangles,290800);
  assert.equal(hall.userData.uniqueTriangles,2908);
  assert.ok(hall.children.every(mesh=>mesh.isInstancedMesh));
  assert.ok(hall.children.every(mesh=>mesh.count===100));
  const metal=hall.children.find(mesh=>mesh.userData.templateId==='brotherhood'&&mesh.userData.exportable);
  assert.ok(metal);
  assert.equal(metal.geometry.getIndex().count/3,480);
  const got=new THREE.Matrix4();
  metal.getMatrixAt(2,got);
  assert.ok(got.equals(placements[29].matrix));
  disposeInstancedKeyCollection(hall);
  assert.equal(hall.children.length,0);
});

test('пакеты ключей одного металла сохраняют независимую ржавчину и грязь', () => {
  const hall=createInstancedKeyCollection([
    {design:{...defaultDesign(2),metal:'copper',rustAmount:120,dirtAmount:75}},
    {design:{...defaultDesign(8),metal:'copper',rustAmount:20,dirtAmount:10}},
  ]);
  const first=hall.children.find(mesh=>mesh.userData.templateId==='archive'&&mesh.userData.exportable);
  const second=hall.children.find(mesh=>mesh.userData.templateId==='alchemy'&&mesh.userData.exportable);
  assert.notEqual(first.material,second.material);
  assert.equal(first.material.userData.dirtUniform.value,1);
  assert.equal(second.material.userData.dirtUniform.value,1);
  assert.notEqual(first.material.userData.dirtSeedUniform.value,second.material.userData.dirtSeedUniform.value);
  // Rust uniforms only exist after TextureLoader is available in a browser.
  if(first.material.userData.rustUniform) {
    assert.equal(first.material.userData.rustUniform.value,1.2);
    assert.equal(second.material.userData.rustUniform.value,.2);
  }
  disposeInstancedKeyCollection(hall);
});

test('без рисованных меток на ключе остаётся только цельная металлическая сетка', () => {
  for(let i=0;i<KEY_TEMPLATES.length;i++) {
    const decorated=createKeyModel(defaultDesign(i));
    const key=createKeyModel({...defaultDesign(i),engraving:false,rustAmount:100});
    const meshes=[];
    key.traverse(obj=>{if(obj.isMesh)meshes.push(obj);});
    assert.equal(meshes.length,1,KEY_TEMPLATES[i].id);
    assert.equal(meshes[0].userData.exportable,true);
    assert.equal(triangleCount(meshes[0]),triangleCount(decorated.children[0]),'овалы увеличивают геометрию');
    assert.equal(key.children[0].material.userData.markCountUniform.value,0);
    assert.equal(decorated.children[0].material.userData.markCountUniform.value,keyMarkings(KEY_TEMPLATES[i],defaultDesign(i)).length);
    disposeKeyModel(decorated);
    meshes[0].geometry.dispose();
  }
});

test('управление меняет физическую геометрию зубцов', () => {
  const t=KEY_TEMPLATES[9];
  const a=bladeProfile(t,{...defaultDesign(9),teeth:2,cutDepth:10});
  const b=bladeProfile(t,{...defaultDesign(9),teeth:7,cutDepth:45});
  assert.notDeepEqual(a,b);
  assert.ok(Math.max(...b.map(p=>p[1]))>Math.max(...a.map(p=>p[1])));
});

test('стержень начинается на наружном ободе и не закрывает отверстие во всех 10 формах', () => {
  for(let i=0;i<KEY_TEMPLATES.length;i++) {
    const t=KEY_TEMPLATES[i];
    for(const headSize of [75,100,135]) {
      const design={...defaultDesign(i),headSize};
      const neck=shaftStartX(t,design);
      const outermost=-1.21+Math.max(...bowPoints(t.bow).map(p=>p[0]))*headSize/100;
      const conservativeHoleRight=-1.21+.22*headSize/100;
      assert.ok(neck>conservativeHoleRight,`${t.id}: стержень перекрыл отверстие`);
      assert.ok(neck<outermost,`${t.id}: стержень отсоединился от головки`);
      assert.ok(Math.abs(bladeProfile(t,design,50)[0][0]-neck)<1e-7);
    }
  }
});

test('гуашевые поверхности и миниатюры доступны всем формам', () => {
  assert.ok(METALS.length>=5);
  assert.ok(statSync(new URL(`../dist/assets/${RUST_TEXTURE}`,import.meta.url)).size>20000);
  assert.match(keyAssetUrl('painted-steel.webp'),/\/assets\/painted-steel\.webp$/);
  assert.equal(KEY_ART.paper,'gouache-parchment.webp');
  for(let i=0;i<KEY_TEMPLATES.length;i++) {
    assert.match(keyIconSvg(i),/<svg/);
    assert.match(keyPreviewSvg(defaultDesign(i)),/painted-.*\.webp/);
    const withEtching=keyPreviewSvg(defaultDesign(i));
    const withoutEtching=keyPreviewSvg({...defaultDesign(i),engraving:false});
    assert.match(withEtching,/<ellipse cx=/);
    assert.doesNotMatch(withoutEtching,/<ellipse cx=/);
    assert.doesNotMatch(withEtching,/gouache-rivet-circle\.png/);
    assert.match(withoutEtching,/stroke="#332a23"/);
    assert.equal(defaultDesign(i).rustAmount,0);
    const rusty=keyPreviewSvg({...defaultDesign(i),rustAmount:70});
    assert.match(rusty,/gouache-rust-overlay\.webp/);
    assert.match(rusty,/<g opacity="0\.70">/);
    const heavyRust=keyPreviewSvg({...defaultDesign(i),rustAmount:200});
    assert.match(heavyRust,/mix-blend-mode:multiply/);
    assert.match(heavyRust,/patternTransform="rotate\(/);
  }
});

test('все 10 ключей сгибаются вниз на 60–80° в гладкой части стержня', () => {
  for(let i=0;i<KEY_TEMPLATES.length;i++) {
    const template=KEY_TEMPLATES[i];
    const whole=bladeSections(template,defaultDesign(i));
    assert.equal(whole.length,1);
    for(const angle of [60,70,80]) {
      const design={...defaultDesign(i),broken:true,breakAngle:angle};
      const pieces=bladeSections(template,design);
      assert.equal(keyBreakAngle(design),angle);
      assert.equal(pieces.length,1,'надлом должен оставаться одним замкнутым телом');
      assert.ok(pieces.every(part=>part.length>=4&&part.every(p=>p.every(Number.isFinite))));
      assert.ok(pieces[0].some(p=>p[0]>keyBreakX(template,design)));
      const bounds=keyBounds(template,design);
      assert.ok(bounds.minY<-.85,`${template.id}: надлом не уходит вниз`);
      assert.match(keyPreviewSvg(design),/<svg/);
      assert.match(keyIconSvg(i,{design}),/<svg/);
      const model=createKeyModel(design);
      assert.ok(model.children.every(mesh=>mesh.geometry.getAttribute('position').array.every(Number.isFinite)));
      assert.ok(model.children.length<=2);
      disposeKeyModel(model);
    }
  }
});

test('контуры надлома не пересекают сами себя и не создают двойной торец',()=>{
  const cross=(a,b,c)=> (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(let i=0;i<KEY_TEMPLATES.length;i++)for(const angle of [60,70,80]) {
    const design={...defaultDesign(i),broken:true,breakAngle:angle};
    const polygon=bladeSections(KEY_TEMPLATES[i],design)[0];
    for(let a=0;a<polygon.length;a++) {
      const b=(a+1)%polygon.length;
      for(let c=a+2;c<polygon.length;c++) {
        const d=(c+1)%polygon.length;
        if(a===d)continue; // adjacent edges share a legitimate vertex
        const ab1=cross(polygon[a],polygon[b],polygon[c]);
        const ab2=cross(polygon[a],polygon[b],polygon[d]);
        const cd1=cross(polygon[c],polygon[d],polygon[a]);
        const cd2=cross(polygon[c],polygon[d],polygon[b]);
        assert.ok(!(ab1*ab2< -1e-10&&cd1*cd2< -1e-10),
          `${KEY_TEMPLATES[i].id}: самопересечение при ${angle}°`);
      }
    }
    const metal=createKeyModel(design).children.find(mesh=>mesh.userData.exportable);
    assert.ok(metal.geometry.getAttribute('position').array.every(Number.isFinite));
    metal.geometry.dispose();
  }
});

test('грязь закрывает согнутый ключ, а инстансы разделяют целые и сломанные заготовки', () => {
  const base=defaultDesign(9),broken={...base,broken:true,breakAngle:80,dirtAmount:100};
  const model=createKeyModel(broken);
  assert.equal(model.children.length,2,'металл и непрозрачная грязевая кромка');
  assert.equal(model.children.find(m=>m.userData.exportable).material.userData.dirtUniform.value,1);
  assert.match(keyPreviewSvg(broken),/class="dirt-coat"/);
  disposeKeyModel(model);
  const hall=createInstancedKeyCollection([{design:base},{design:broken},{design:{...broken,breakAngle:60}}]);
  assert.equal(hall.userData.uniqueDesigns,3);
  assert.equal(hall.userData.keyCount,3);
  disposeInstancedKeyCollection(hall);
});

test('при переносе в другую сцену ключи не делят изменяемую окраску', () => {
  const clean=createKeyModel(defaultDesign(9));
  const aged=createKeyModel({...defaultDesign(9),rustAmount:180,dirtAmount:100,
    engraving:false,broken:true});
  const cleanMetal=clean.children.find(mesh=>mesh.userData.exportable).material;
  const agedMetal=aged.children.find(mesh=>mesh.userData.exportable).material;
  assert.notEqual(cleanMetal,agedMetal);
  assert.equal(cleanMetal.userData.dirtUniform.value,0);
  assert.equal(agedMetal.userData.dirtUniform.value,1);
  assert.equal(cleanMetal.userData.markCountUniform.value,4);
  assert.equal(agedMetal.userData.markCountUniform.value,0);
  updateKeyPaint(clean,{...defaultDesign(9),rustAmount:90});
  assert.equal(agedMetal.userData.dirtUniform.value,1);
  disposeKeyModel(clean);
  assert.equal(agedMetal.userData.dirtUniform.value,1,'очистка другого ключа изменила материал');
  disposeKeyModel(aged);
});
