import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {createDetailStream} from '../src/rendering/detail-stream.js';

test('the shared uploader copies each row once, one strip per tick, then exposes the HD texture',async t=>{
  let worker;
  class Pixels {
    constructor(){worker=this;}
    postMessage({id}){
      const width=1024,height=513;
      this.onmessage({data:{id,width,height,buffer:new ArrayBuffer(width*height*4)}});
    }
    terminate(){}
  }
  for(const [key,value] of Object.entries({Worker:Pixels,OffscreenCanvas:class {},createImageBitmap:()=>{}})){
    const old=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{configurable:true,value});
    t.after(()=>{if(old)Object.defineProperty(globalThis,key,old);else delete globalThis[key];});
  }
  const copies=[];
  const renderer={capabilities:{maxTextureSize:4096},initTexture(tex){assert.equal(tex.source.dataReady,false);},
    copyTextureToTexture(strip,dest,region,offset){
      assert(strip.image.data.byteLength<=1024*1024);
      copies.push([offset.y,strip.image.height,dest.mipmapsAutoUpdate]);
    }};
  const stream=createDetailStream(THREE,renderer);
  let finished=false;
  const first=stream.load('/1').then(tex=>{finished=true;return tex;});
  const second=stream.load('/2');
  for(let i=0;i<2;i++){stream.update();await Promise.resolve();assert(!finished);assert.equal(copies.length,i+1);}
  stream.update();const hd=await first;assert(hd.source.dataReady);
  assert.deepEqual(copies,[[0,256,false],[256,256,false],[512,1,true]]);
  const cancelled=assert.rejects(second,/closed/);stream.dispose();await cancelled;
  hd.dispose();assert(worker);
});
