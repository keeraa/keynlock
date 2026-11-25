// A hand-drawn, seamless scrollwork repeat shared by both faces of every arch.
export function createArchOrnament(THREE){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
 const c=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);
 texture.wrapS=THREE.RepeatWrapping;texture.anisotropy=4;
 if(!c.bezierCurveTo)return texture;
 c.strokeStyle='#fff';c.fillStyle='#fff';c.lineCap='round';c.lineJoin='round';
 const scroll=()=>{
  c.beginPath();
  c.moveTo(-18,0);
  c.bezierCurveTo(19,-2,23,-42,64,-41);
  c.bezierCurveTo(103,-40,113,-10,92,0);
  c.bezierCurveTo(77,9,62,0,65,-13);
  c.bezierCurveTo(67,-21,76,-23,83,-18);
  c.moveTo(90,-24);
  c.bezierCurveTo(128,-48,161,-38,179,-15);
  c.bezierCurveTo(189,-1,213,9,237,0);
  c.stroke();
  c.beginPath();c.moveTo(125,-30);
  c.bezierCurveTo(139,-32,152,-28,161,-15);
  c.bezierCurveTo(147,-19,132,-17,125,-30);
  c.fill();
 };
 c.lineWidth=4.6;
 for(const center of [0,256,512])for(const side of [-1,1]){
  c.save();c.translate(center,64);c.scale(side,side);scroll();c.restore();
 }
 c.lineWidth=2;
 for(const center of [0,256,512]){
  c.beginPath();c.moveTo(center-14,64);c.lineTo(center,49);c.lineTo(center+14,64);c.lineTo(center,79);c.closePath();c.stroke();
  c.beginPath();c.arc(center,64,3,0,Math.PI*2);c.fill();
 }
 c.globalAlpha=.53;
 for(const y of [14,114])c.fillRect(0,y,512,1.5);
 return texture;
}
