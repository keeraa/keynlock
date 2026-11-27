// Tint the painted gradient while preserving the original palette at its default.
export function createSky(THREE,color='#75a3bd'){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
 const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,512);
 const tint=new THREE.Color(color), base=new THREE.Color('#75a3bd');
 for(const [stop,original,weight] of [[0,'#75a3bd',1],[.45,'#bad5db',.8],[.56,'#e7e4d2',.5],[1,'#899d88',.25]]){
  const shade=new THREE.Color(original);
  for(const channel of ['r','g','b'])shade[channel]=THREE.MathUtils.clamp(shade[channel]+(tint[channel]-base[channel])*weight,0,1);
  gradient.addColorStop(stop,'#'+shade.getHexString());
 }
 ctx.fillStyle=gradient;ctx.fillRect(0,0,1024,512);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 texture.mapping=THREE.EquirectangularReflectionMapping;texture.userData.color=color;
 return texture;
}
