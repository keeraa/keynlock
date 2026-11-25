// Original Village Engine seeded value field. No imported demo noise or textures.
export const CUMULUS_QUALITY=Object.freeze({low:16,medium:28,high:44});
const smooth=x=>x*x*(3-2*x),mix=(a,b,t)=>a+(b-a)*t;
function lattice(x,y,z,seed){let n=Math.imul(x+seed,374761393)^Math.imul(y,668265263)^Math.imul(z,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
export function cumulusNoise(x,y,z,seed=37){
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),u=smooth(x-ix),v=smooth(y-iy),w=smooth(z-iz);
 const row=(dy,dz)=>mix(lattice(ix,iy+dy,iz+dz,seed),lattice(ix+1,iy+dy,iz+dz,seed),u);
 return mix(mix(row(0,0),row(1,0),v),mix(row(0,1),row(1,1),v),w);
}
export function createCumulusField({size=48,seed=37}={}){
 if(!Number.isInteger(size)||size<8||size>96||!Number.isFinite(seed))throw Error('Invalid cumulus field');
 const data=new Uint8Array(size**3);let i=0;
 for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/(size-1),v=y/(size-1),w=z/(size-1);
  // Flattened base and rounded cap, then independent broad lobes and fine erosion.
  const edge=Math.max(0,1-((u-.5)/.5)**2-((w-.5)/.5)**2),vertical=Math.max(0,1-((v-.46)/.48)**2);
  const broad=cumulusNoise(u*4,v*3,w*4,seed),fine=cumulusNoise(u*13,v*11,w*13,seed+91);
  data[i++]=Math.round(255*Math.max(0,Math.min(1,(broad*.78+fine*.22-.23)*edge*vertical*2.4)));
 }
 return {data,size,seed};
}
