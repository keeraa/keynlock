// Smooth oil films and gravity runs are procedural, generated only on startup.
export function createOilTextures(THREE) {
  function makeOilBlotTexture(){
    const c=document.createElement('canvas');c.width=c.height=256;
    const ctx=c.getContext('2d');
    ctx.save();ctx.translate(128,128);ctx.rotate(-.21);ctx.scale(1,.85);
    // A fully feathered density gradient: no clipped circular border on gears.
    const gradient=ctx.createRadialGradient(-12,-13,2,0,0,125);
    gradient.addColorStop(0,'rgba(31,29,24,.45)');
    gradient.addColorStop(.28,'rgba(38,34,29,.37)');
    gradient.addColorStop(.55,'rgba(43,39,31,.22)');
    gradient.addColorStop(.80,'rgba(42,40,35,.075)');
    gradient.addColorStop(1,'rgba(42,40,35,0)');
    ctx.fillStyle=gradient;ctx.fillRect(-130,-130,260,260);
    // Diffuse reflected light instead of a sharply outlined droplet.
    ctx.beginPath();ctx.ellipse(-21,-21,77,72,-.12,3.65,4.5);
    ctx.shadowBlur=11;ctx.shadowColor='rgba(226,228,208,.12)';
    ctx.strokeStyle='rgba(226,228,208,.10)';ctx.lineWidth=1.8;ctx.stroke();
    ctx.restore();
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=4;return texture;
  }
  function makeOilRunTexture(){
    const c=document.createElement('canvas');c.width=96;c.height=256;
    const ctx=c.getContext('2d');
    // A narrow gravity-driven rivulet with a heavier, rounded bead at its tip.
    ctx.beginPath();ctx.moveTo(47,7);
    ctx.bezierCurveTo(44,44,51,94,45,146);
    ctx.bezierCurveTo(40,182,31,215,39,237);
    ctx.bezierCurveTo(47,253,65,244,61,222);
    ctx.bezierCurveTo(57,206,52,181,53,148);
    ctx.bezierCurveTo(55,92,50,44,49,7);ctx.closePath();
    const body=ctx.createLinearGradient(30,0,66,0);
    body.addColorStop(0,'rgba(25,23,17,.20)');
    body.addColorStop(.48,'rgba(31,28,21,.63)');
    body.addColorStop(1,'rgba(43,38,27,.29)');
    ctx.fillStyle=body;ctx.fill();
    ctx.beginPath();ctx.moveTo(43,195);ctx.quadraticCurveTo(38,221,44,235);
    ctx.strokeStyle='rgba(229,222,191,.32)';ctx.lineWidth=2;ctx.stroke();
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    return texture;
  }
  return { makeOilBlotTexture, makeOilRunTexture };
}
