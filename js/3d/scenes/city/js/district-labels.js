import * as THREE from 'three';

const STORAGE_KEY='keynlock.world.labels.v1';

/** Screen-space district markers, independent from the 3D map and camera UI. */
export function createDistrictLabels({districts,city,camera,canvas,onFocus,getSelectedId}) {
  const container=document.getElementById('mapLabels');
  const toggle=document.getElementById('mapLabelsToggle');
  let visible=true;
  try{visible=localStorage.getItem(STORAGE_KEY)!=='false';}catch{}

  container.innerHTML=districts.map(district=>
    `<button type="button" class="map-label" data-map-district="${district.id}" style="--district-color:${district.color}" aria-label="Приблизить: ${district.name}"><small>${district.index}</small><span>${district.name}</span></button>`
  ).join('');

  const markers=districts.map(district=>{
    const [x,,z]=district.anchor;
    const altitude=district.id==='palace'?14:district.id==='industrial'?7:district.id==='arts'?9:district.id==='port'?3:5.5;
    const element=container.querySelector(`[data-map-district="${district.id}"]`);
    element.addEventListener('click',()=>onFocus(district.id));
    return {
      district,element,
      point:new THREE.Vector3(x,city.heightAt(x,z)+altitude,z),
      projected:new THREE.Vector3(),
    };
  });

  function refreshToggle() {
    toggle.classList.toggle('active',visible);
    toggle.setAttribute('aria-pressed',String(visible));
    container.hidden=!visible;
  }
  toggle.addEventListener('click',()=>{
    visible=!visible;
    try{localStorage.setItem(STORAGE_KEY,String(visible));}catch{}
    refreshToggle();
    update();
  });
  refreshToggle();

  function update() {
    if(!visible)return;
    const width=canvas.clientWidth,height=canvas.clientHeight;
    const selectedId=getSelectedId();
    for(const marker of markers) {
      const point=marker.projected.copy(marker.point).project(camera);
      const onScreen=point.z>=-1&&point.z<=1&&Math.abs(point.x)<.96&&
        Math.abs(point.y)<.91&&(camera.zoom<2.65||selectedId===marker.district.id);
      marker.element.hidden=!onScreen;
      if(!onScreen)continue;
      marker.element.style.left=`${(point.x*.5+.5)*width}px`;
      marker.element.style.top=`${(-point.y*.5+.5)*height}px`;
      marker.element.classList.toggle('selected',selectedId===marker.district.id);
    }
  }

  return {update};
}
