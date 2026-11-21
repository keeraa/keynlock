// Keep the thumbnail texture readiness check free of WebGL dependencies.
export function landmarkTextureImagesReady(maps){
  return Object.values(maps).every(map=>{
    const image=map?.image;
    return Boolean(image&&(image.naturalWidth||image.width||image.videoWidth)>0&&
      (!('complete' in image)||image.complete));
  });
}
