// A capped set of real night lights tracks the camera focus.
export function createCityNightLighting(ctx) {
  const {T,scene,houseAtmosphereResources,effectMaterials,streetLampSites,windowLightSites,setBuildingAtmosphereSettings}=ctx;
  // Keep a small, reusable set of real point lights around the camera focus.
  // Hundreds of independent lamps would create a huge fragment-shader cost;
  // the glowing glass itself remains instanced for the entire city.
  const nightEmitters=[];
  let nightMode='day';
  function createNightLights(){
    const glowMaterial=new T.SpriteMaterial({map:houseAtmosphereResources.glowMap,
      color:'#ffe0ab',transparent:true,blending:T.AdditiveBlending,
      depthWrite:false,depthTest:true,opacity:.92});
    effectMaterials.push(glowMaterial);
    for(const [kind,count] of [['lamp',9],['window',7]])for(let i=0;i<count;i++){
      const light=new T.PointLight('#ffd49a',0,kind==='lamp'?14:9,2);
      const glow=new T.Sprite(glowMaterial);
      glow.scale.setScalar(kind==='lamp'?3.5:2.15);
      light.visible=false;glow.visible=false;
      scene.add(light);scene.add(glow);
      nightEmitters.push({kind,light,glow,site:null});
    }
  }
  function updateNightLights(focus={x:0,z:-12}) {
    if(nightMode==='day')return;
    const focusX=focus.x||0,focusZ=focus.z||0;
    for(const kind of ['lamp','window']){
      const sites=kind==='lamp'?streetLampSites:windowLightSites;
      const close=sites.map(site=>({site,distance:(site.x-focusX)**2+(site.z-focusZ)**2}))
        .sort((a,b)=>a.distance-b.distance);
      const selected=[];
      for(const candidate of close){
        if(selected.length>=nightEmitters.filter(emitter=>emitter.kind===kind).length)break;
        if(selected.some(site=>(site.x-candidate.site.x)**2+(site.z-candidate.site.z)**2<
            (kind==='lamp'?25:16)))continue;
        selected.push(candidate.site);
      }
      nightEmitters.filter(emitter=>emitter.kind===kind).forEach((emitter,i)=>{
        const site=selected[i];emitter.site=site||null;
        emitter.light.visible=Boolean(site);
        emitter.glow.visible=Boolean(site);
        if(!site)return;
        emitter.light.position.set(site.x,site.y,site.z);
        emitter.glow.position.set(site.x,site.y,site.z);
        emitter.light.intensity=(kind==='lamp'?6.4:4.6)*(nightMode==='dusk'?.37:1);
        emitter.glow.material.opacity=nightMode==='dusk'?.67:.92;
      });
    }
  }
  function setNightLighting(time){
    nightMode=time;
    setBuildingAtmosphereSettings({night:time!=='day'});
    for(const {light,glow} of nightEmitters){
      light.visible=false;glow.visible=false;
    }
    if(time!=='day')updateNightLights();
  }
  return {nightEmitters,createNightLights,updateNightLights,setNightLighting};
}
