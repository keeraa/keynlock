import test from 'node:test';
import assert from 'node:assert/strict';

test('библиотека предзагружает текстуры один раз и передаёт краску каждому инстансу',async()=>{
  const previousDocument=globalThis.document;
  let images=0;
  globalThis.document={createElementNS:()=>{
    images++;
    const handlers=new Map();
    return {
      addEventListener:(name,fn)=>handlers.set(name,fn),
      removeEventListener:name=>handlers.delete(name),
      set src(value){this.source=value;queueMicrotask(()=>handlers.get('load')?.());},
    };
  }};
  try {
    const {getMetalMaterial,preloadKeyTextures}=await import('../dist/js/key-materials.js');
    const first=await preloadKeyTextures();
    const second=await preloadKeyTextures();
    assert.equal(first.length,6,'пять гуашевых металлов и ржавчина');
    assert.deepEqual(first,second);
    assert.equal(images,6,'повторное использование текстур между сценами');
    const cache=new Map();
    const material=getMetalMaterial('brass',90,3,0,cache);
    assert.equal(typeof material.onBeforeCompile,'function');
    const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',
      fragmentShader:'#include <common>\n#include <map_pars_fragment>\n#include <map_fragment>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>'};
    material.onBeforeCompile(shader);
    assert.match(shader.vertexShader,/attribute vec3 instanceKeyPaint/);
    assert.match(shader.vertexShader,/#ifdef USE_INSTANCING/);
    assert.match(shader.fragmentShader,/vInstanceKeyPaint\.x/);
    assert.match(shader.fragmentShader,/keySeed\*\.031/);
    assert.doesNotMatch(shader.fragmentShader,/uMark|markCoverage|uKeyMarks/);
    assert.equal(Object.keys(shader.uniforms).some(name=>name.startsWith('uMark')),false);
    assert.ok(shader.uniforms.uPaintedRust.value);
    material.dispose();
  } finally {
    if(previousDocument===undefined)delete globalThis.document;
    else globalThis.document=previousDocument;
  }
});
