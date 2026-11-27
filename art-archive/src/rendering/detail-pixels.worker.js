// Transfer bottom-up sRGB pixels so WebGL can upload strips without converting DOM images.
self.onmessage=async ({data:{id,url,maxSize}})=>{
  let bitmap;
  try {
    const response=await fetch(url);
    if(!response.ok)throw Error('HTTP '+response.status);
    bitmap=await createImageBitmap(await response.blob());
    const scale=Math.min(1,maxSize/Math.max(bitmap.width,bitmap.height));
    const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=new OffscreenCanvas(width,height).getContext('2d',{willReadFrequently:true,colorSpace:'srgb'});
    ctx.translate(0,height);ctx.scale(1,-1);ctx.drawImage(bitmap,0,0,width,height);
    const buffer=ctx.getImageData(0,0,width,height).data.buffer;
    self.postMessage({id,width,height,buffer},[buffer]);
  }catch(error){self.postMessage({id,error:String(error)});}
  finally{bitmap?.close();}
};
