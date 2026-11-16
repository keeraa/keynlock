import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import * as THREE from '../src/vendor/three-core.js';
import { createPaintedMaterials, paintTexturePixels, PIN_FINISH_TINTS,
  PIN_PAINT_CONTRAST,
  pinPaintBrightness } from '../src/js/effects/painted-materials.js';

test('all eight hand-painted source textures are bundled as real image assets', () => {
  for (const name of [
    'painted-steel.webp', 'painted-brass.webp',
    'painted-graphite.webp', 'painted-copper.webp', 'painted-enamel.webp',
    'painted-gear.webp', 'painted-pin.webp', 'painted-manifold.webp',
  ]) {
    const file = ['painted-steel.webp', 'painted-brass.webp',
      'painted-graphite.webp', 'painted-copper.webp', 'painted-enamel.webp'].includes(name)
      ? new URL(`../../../shared/materials/metals/${name}`, import.meta.url)
      : new URL(`../src/assets/${name}`, import.meta.url);
    assert.ok(statSync(file).size > 10_000, `${name} must contain the finished artwork`);
  }
});

test('painted pigment keeps the selected finish while retaining hand-drawn tonal variation', () => {
  const original = new Uint8ClampedArray([
    95, 118, 127, 255, 184, 193, 208, 255,
    155, 168, 175, 255, 190, 182, 167, 255,
  ]);
  const plain = paintTexturePixels(original, 0);
  assert.deepEqual([...plain], Array.from({ length: 4 }, () => [255, 255, 255, 255]).flat());
  const painted = paintTexturePixels(original, .82);
  assert.equal(painted[3], 255);
  assert.ok(painted[0] < painted[4], 'darker paint clusters remain darker after tinting');
  assert.ok(painted[0] < 245 && painted[4] > 220);
  const tinted = paintTexturePixels(original, .82, [.78, 1.09, 1.11]);
  assert.ok(tinted[0] < painted[0], 'enamel changes pigment tone');
  assert.ok(tinted[2] > painted[2], 'enamel preserves a blue accent');
});

test('pin gouache uses muted pigment density and five distinguishable metal hues', () => {
  const source = new Uint8ClampedArray([
    110, 98, 83, 255, 169, 149, 125, 255, 210, 193, 164, 255,
  ]);
  const agedBrass = paintTexturePixels(source, .95, PIN_FINISH_TINTS[3], pinPaintBrightness(.95));
  const softerBrass = paintTexturePixels(source, .95, PIN_FINISH_TINTS[3],
    pinPaintBrightness(.95), PIN_PAINT_CONTRAST);
  assert.ok(softerBrass[8] - softerBrass[0] <
    (agedBrass[8] - agedBrass[0]) * .65,
    'gouache on narrow pins has at least 35% lower light-dark variation');
  const brightWhite = paintTexturePixels(source, .95);
  assert.ok(agedBrass[8] < brightWhite[8] - 35, 'light pin ends no longer wash out white');
  assert.ok(agedBrass[4] > agedBrass[5] && agedBrass[5] > agedBrass[6],
    'old brass remains warm and readable');
  const blackSteel = paintTexturePixels(source, .95, PIN_FINISH_TINTS[1], pinPaintBrightness(.95));
  assert.ok(blackSteel[4] < agedBrass[4], 'black steel is visibly darker than brass');
  assert.notDeepEqual([...blackSteel], [...agedBrass]);
  assert.equal(pinPaintBrightness(0), 1, 'darkening fades out smoothly with paint strength');
});

test('painted material layer lazily switches palettes, updates three controls and restores metals', () => {
  const pending = new Map();
  const loader = { load(url, onLoad) { pending.set(url, onLoad); return new THREE.Texture(); } };
  let paintedPixels = null;
  const document = { createElement(name) {
    assert.equal(name, 'canvas');
    const canvas = { width: 0, height: 0 };
    canvas.getContext = () => ({
      drawImage() {},
      getImageData() {
        const data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
        for (let i = 0; i < data.length; i += 4) {
          const light = (i / 4) % 3 === 0 ? 70 : 190;
          data.set([light, light, light, 255], i);
        }
        return { data };
      },
      createImageData(width, height) {
        return { data: new Uint8ClampedArray(width * height * 4) };
      },
      putImageData(image) { paintedPixels = image.data; },
    });
    return canvas;
  } };
  const mat = {
    case: new THREE.MeshStandardMaterial({ color: 0x75898c, metalness: .78, roughness: .49 }),
    spring: new THREE.MeshStandardMaterial({ color: 0xc0d3d3, metalness: .83, roughness: .33 }),
    key: new THREE.MeshStandardMaterial({ color: 0xe7c687, metalness: .84, roughness: .32 }),
    glass: new THREE.MeshStandardMaterial({ transparent: true, opacity: .24 }),
  };
  const original = { roughness: mat.case.roughness, metalness: mat.case.metalness };
  const surface = createPaintedMaterials({ THREE, mat, document, textureLoader: loader });
  assert.equal(pending.size, 0, 'source artwork is lazy until enabled');
  surface.setOptions({ enabled: true, textureStrength: .95, materialStrength: .90, detail: .02 });
  assert.equal(pending.size, 2);
  assert.ok(mat.case.roughness > original.roughness);
  assert.ok(mat.case.metalness < original.metalness);
  for (const callback of pending.values()) {
    const loaded = new THREE.Texture();
    loaded.image = { width: 512, height: 512 };
    callback(loaded);
  }
  assert.ok(mat.case.map?.isCanvasTexture);
  assert.ok(mat.spring.map?.isCanvasTexture);
  assert.ok(mat.key.map?.isCanvasTexture);
  assert.notEqual(mat.case.map, mat.key.map, 'steel and brass retain separate painted textures');
  assert.equal(mat.glass.map, null, 'transparent inspection shell remains legible');
  assert.ok(paintedPixels[0] < paintedPixels[4]);
  const firstMap = mat.case.map;
  surface.setOptions({ textureStrength: .94, materialStrength: 1, detail: .9 });
  assert.equal(mat.case.map, firstMap, 'slider reuses existing GPU texture');
  assert.ok(Math.abs(firstMap.repeat.x - 2.405) < .0001);
  surface.setOptions({ steelVariant: 'enamel', brassVariant: 'copper' });
  assert.equal(pending.size, 4, 'new palettes load only when selected');
  for (const [url, callback] of pending) {
    if (!url.includes('enamel') && !url.includes('copper')) continue;
    const loaded = new THREE.Texture();
    loaded.image = { width: 512, height: 512 };
    callback(loaded);
  }
  assert.ok(mat.case.map?.isCanvasTexture);
  assert.notEqual(mat.case.map, firstMap, 'switching the steel palette updates the case');
  assert.notEqual(mat.case.map, mat.key.map, 'warm and cold materials use separate palettes');
  assert.equal(mat.key.map.repeat.x, 2, 'copper repeats mirror-to-mirror around a cylinder');
  assert.equal(mat.key.map.repeat.y, 2, 'copper has no vertical wrap discontinuity');
  assert.equal(mat.key.map.wrapS, THREE.MirroredRepeatWrapping);
  assert.equal(mat.glass.map, null);
  surface.setBaseCaseRoughness(.55);
  surface.setOptions({ enabled: false });
  assert.equal(mat.case.map, null);
  assert.equal(mat.case.roughness, .55, 'selected bronze finish survives reset');
  assert.equal(mat.case.metalness, original.metalness);
  assert.equal(mat.spring.map, null);
  assert.equal(mat.key.map, null);
  surface.setOptions({ enabled: true });
  assert.equal(pending.size, 4, 'switching back on reuses loaded textures');
  surface.dispose();
  assert.equal(mat.case.map, null);
  for (const material of Object.values(mat)) material.dispose();
});

test('rapid paint slider input is batched; detail and metal sliders cause no pixel uploads', () => {
  const pending = new Map();
  const callbacks = [];
  let canvasUploads = 0;
  const loader = {load(url,onLoad){pending.set(url,onLoad);}};
  const document = {createElement(){
    const canvas = {width:0,height:0};
    canvas.getContext = () => ({
      drawImage(){},
      getImageData(){return {data:new Uint8ClampedArray(canvas.width*canvas.height*4)};},
      createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},
      putImageData(){canvasUploads++;},
    });
    return canvas;
  }};
  const mat = {
    case:new THREE.MeshStandardMaterial({metalness:.8}),
    key:new THREE.MeshStandardMaterial({metalness:.8}),
  };
  const painter=createPaintedMaterials({THREE,mat,document,textureLoader:loader,
    scheduleRepaintFrame:callback=>callbacks.push(callback)});
  painter.setOptions({enabled:true});
  for(const onLoad of pending.values()){
    const texture=new THREE.Texture();
    texture.image={width:512,height:512};
    onLoad(texture);
  }
  assert.equal(canvasUploads,2);
  const version=mat.case.map.version;
  painter.setOptions({detail:.8});
  painter.setOptions({materialStrength:.4});
  assert.equal(canvasUploads,2,'UV repeat and material reflectance do not rewrite pixels');
  assert.equal(mat.case.map.version,version,'detail slider avoids needless GPU uploads');
  assert.ok(Math.abs(mat.case.map.repeat.x-2.21)<.0001);
  for(const strength of [.15,.35,.55,.75,.95,.65])painter.setOptions({textureStrength:strength});
  assert.equal(callbacks.length,1,'many pointer inputs schedule only one paint frame');
  assert.equal(canvasUploads,2,'painting waits until the animation frame');
  callbacks.shift()();
  assert.equal(canvasUploads,3,'only one texture is processed in each frame');
  assert.equal(callbacks.length,1);
  callbacks.shift()();
  assert.equal(canvasUploads,4,'latest strength is used for the second texture');
  assert.equal(callbacks.length,0,'stale slider values never queue redundant passes');
  painter.setOptions({enabled:false});
  painter.setOptions({textureStrength:.4});
  assert.equal(callbacks.length,0,'disabled paint does no background canvas work');
  painter.setOptions({enabled:true});
  assert.equal(callbacks.length,1,'re-enabling refreshes only stale textures');
  while(callbacks.length)callbacks.shift()();
  assert.equal(canvasUploads,6);
  painter.dispose();
  mat.case.dispose();mat.key.dispose();
});

test('gears, pins, and spring block receive individual gouache while retaining original finishes', () => {
  const pending = new Map();
  const loader = { load(url, onLoad) { pending.set(url, onLoad); return new THREE.Texture(); } };
  const document = { createElement() {
    const canvas = { width: 0, height: 0 };
    canvas.getContext = () => ({
      drawImage() {},
      getImageData() {
        const data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
        for (let i = 0; i < data.length; i += 4)
          data.set((i / 4) % 2 ? [160, 125, 95, 255] : [85, 71, 62, 255], i);
        return { data };
      },
      createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
      putImageData() {},
    });
    return canvas;
  } };
  const originalGearMap = new THREE.Texture();
  const originalPinMap = new THREE.Texture();
  const secondPinFinish = new THREE.Texture();
  const gear = new THREE.MeshStandardMaterial({ map: originalGearMap, metalness: .8 });
  const pin = new THREE.MeshStandardMaterial({ map: originalPinMap, metalness: .37 });
  const block = new THREE.MeshStandardMaterial({ metalness: .68 });
  const gearMesh = { userData: { rustState: { level: .7, cleanRoughness: gear.roughness } } };
  const painter = createPaintedMaterials({ THREE, mat: {}, document, textureLoader: loader,
    extraSurfaces: [{ material: gear, kind: 'gear', mesh: gearMesh }, { material: pin, kind: 'pin' },
      { material: block, kind: 'manifold' }] });
  painter.setOptions({ enabled: true, textureStrength: .95, materialStrength: .9, detail: .02 });
  assert.deepEqual([...pending.keys()].sort(), [
    './assets/painted-gear.webp', './assets/painted-manifold.webp',
    './assets/painted-pin.webp',
  ]);
  for (const callback of pending.values()) {
    const texture = new THREE.Texture();
    texture.image = { width: 512, height: 512 };
    callback(texture);
  }
  assert.ok(gear.map.isCanvasTexture && pin.map.isCanvasTexture && block.map.isCanvasTexture);
  assert.ok(pin.map.repeat.x < .6, 'pin strokes cover a larger area of the small cylinder');
  assert.ok(pin.map.repeat.x < gear.map.repeat.x, 'only the narrow pins receive broader strokes');
  assert.notEqual(gear.map, pin.map);
  assert.notEqual(pin.map, block.map);
  const gouachePinMap = pin.map;
  painter.setPinBaseTexture(secondPinFinish, 1);
  assert.equal(pin.map, gouachePinMap, 'selected classic finish does not remove active gouache');
  painter.setOptions({ enabled: false });
  assert.equal(gear.map, originalGearMap, 'original rusty gear finish is restored');
  assert.equal(pin.map, secondPinFinish, 'updated pin finish survives the gouache toggle');
  assert.equal(block.map, null, 'the original block material is restored');
  gearMesh.userData.rustState.level = 0;
  painter.setOptions({ enabled: false });
  assert.equal(gear.map, null, 'fully cleaned gears no longer restore a rust map');
  painter.setOptions({ enabled: true });
  assert.equal(pending.size, 3, 'all detail textures are cached');
  painter.dispose();
  for (const material of [gear, pin, block]) material.dispose();
  for (const texture of [originalGearMap, originalPinMap, secondPinFinish]) texture.dispose();
});
