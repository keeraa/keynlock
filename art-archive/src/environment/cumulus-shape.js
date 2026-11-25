import {cumulusNoise} from '../../vendor/village-cumulus/village-cumulus-field.js';

// Rounded, connected lobes give the sky volume a raised crown and a broken silhouette.
export function shapeCumulus(mesh,seed){
  const texture=mesh.material.uniforms.field.value,{data,width:size}=texture.image;
  const lobes=[
    [.48,.52,.49,.29,.39,.29],
    [.34,.37,.48,.27,.23,.29],[.67,.32,.5,.23,.22,.25],
    [.2,.26,.49,.17,.16,.23],[.79,.23,.49,.17,.14,.22],
    [.5,.22,.32,.3,.16,.23],[.49,.26,.68,.29,.19,.22],
    [.43,.76,.49,.19,.21,.19]
  ];
  for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/(size-1),v=y/(size-1),w=z/(size-1);
    let volume=0;
    for(const [cx,cy,cz,rx,ry,rz] of lobes){
      const d=Math.sqrt(((u-cx)/rx)**2+((v-cy)/ry)**2+((w-cz)/rz)**2);
      volume=Math.max(volume,1-d);
    }
    const broad=cumulusNoise(u*11,v*11,w*11,seed);
    const fine=cumulusNoise(u*29,v*29,w*29,seed+91);
    const density=(volume+(broad-.5)*.15+(fine-.5)*.045)*3.8;
    data[x+size*(y+size*z)]=Math.round(255*Math.max(0,Math.min(1,density)));
  }
  texture.needsUpdate=true;
  mesh.scale.y*=2.2;
  // Several light probes reveal the rounded lobes instead of a uniform grey underside.
  mesh.material.fragmentShader=mesh.material.fragmentShader.replace(
    'float blocked=densityAt(clamp(p+sunDirection*.08,vec3(-.499),vec3(.499)));',
    'float blocked=0.; for(int s=1;s<=4;s++){blocked+=densityAt(p+sunDirection*(float(s)*.065))*.32;}');
  mesh.material.needsUpdate=true;
}
