// All paintings share one upload budget per animation frame.
export function createDetailStream(THREE,renderer){
  if(!renderer || typeof Worker==='undefined' || typeof OffscreenCanvas==='undefined' ||
      typeof createImageBitmap==='undefined')return null;
  const worker=new Worker(new URL('./detail-pixels.worker.js',import.meta.url),{type:'module'});
  const pending=new Map(),queue=[];
  let sequence=0,closed=false;
  function stop(){
    closed=true;worker.terminate();
    for(const job of pending.values()){
      job.texture?.dispose();job.reject(Error('Detail stream closed'));
    }
    pending.clear();queue.length=0;
  }
  worker.onerror=stop;
  worker.onmessage=({data})=>{
    const job=pending.get(data.id);
    if(!job)return;
    if(data.error){pending.delete(data.id);job.reject(Error(data.error));return;}
    const texture=new THREE.DataTexture(new Uint8Array(data.buffer),data.width,data.height);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.anisotropy=4;texture.generateMipmaps=true;texture.mipmapsAutoUpdate=false;
    texture.source.dataReady=false;texture.needsUpdate=true;
    Object.assign(job,{texture,row:0});queue.push(job);
  };
  function update(){
    const job=queue[0];if(!job)return;
    const dest=job.texture,{width,height,data}=dest.image;
    try{
      if(job.row===0)renderer.initTexture(dest);
      const rows=Math.min(height-job.row,Math.max(1,Math.floor(1024*1024/(4*width))));
      const end=job.row+rows;
      const strip=new THREE.DataTexture(data.subarray(job.row*width*4,end*width*4),width,rows);
      dest.mipmapsAutoUpdate=end===height;
      renderer.copyTextureToTexture(strip,dest,null,new THREE.Vector2(0,job.row));
      strip.dispose();job.row=end;
      if(end<height)return;
      // Retain the CPU source for context restoration, using Three's ordinary texture lifecycle.
      dest.source.dataReady=true;job.resolve(dest);
    }catch(error){dest.dispose();job.reject(error);}
    pending.delete(job.id);queue.shift();
  }
  function load(url){
    if(closed)return Promise.reject(Error('Detail stream closed'));
    return new Promise((resolve,reject)=>{
      const id=++sequence;
      pending.set(id,{id,resolve,reject});
      worker.postMessage({id,url,maxSize:renderer.capabilities.maxTextureSize});
    });
  }
  return {load,update,dispose:stop};
}
