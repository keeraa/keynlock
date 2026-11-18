// Small, opaque gouache stamps live in the metallic paint shader, not on
// transparent planes. The 3D and fallback SVG renderers share their positions.
export const MAX_KEY_MARKS=8;

const PIGMENTS=Object.freeze({
  brass:'#8e603c',steel:'#a2613f',copper:'#713b29',graphite:'#b48457',
  gold:'#91633f',mercury:'#a4613c',tin:'#906b4d',lead:'#bf8b5f',silver:'#a16c4d',
});

export function markPigment(metalId) { return PIGMENTS[metalId]??'#965a3b'; }

export function keyMarkings(template,design) {
  if(!design.engraving)return [];
  const positions=[[-.325,0,.019],[.325,0,.019],
    ...(template.bow==='twin'?[[0,.55,.019],[0,-.55,.019]]:[[0,.32,.019],[0,-.32,.019]])];
  if(template.id==='astral')for(let i=0;i<3;i++)
    positions.push([Math.cos(i*Math.PI*2/3)*.34,Math.sin(i*Math.PI*2/3)*.34,.023]);
  if(template.id==='alchemy')positions.push([0,-.235,.035]);
  const scale=design.headSize/100;
  return positions.map(([x,y,r])=>({
    x:-1.21+x*scale,y:y*scale,rx:r*1.36*scale,ry:r*2.03*scale,
  }));
}
