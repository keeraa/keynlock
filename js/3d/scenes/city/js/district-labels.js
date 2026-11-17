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
    const occupied=[];
    for(const marker of markers) {
      const point=marker.projected.copy(marker.point).project(camera);
      const onScreen=point.z>=-1&&point.z<=1&&Math.abs(point.x)<.92&&
        Math.abs(point.y)<.86&&(camera.zoom<1.65||selectedId===marker.district.id);
      marker.element.hidden=!onScreen;
      if(!onScreen)continue;
      const x=Math.max(80,Math.min(width-80,(point.x*.5+.5)*width));
      const baseY=Math.max(96,Math.min(height-48,(-point.y*.5+.5)*height));
      const markerWidth=Math.min(146,marker.element.offsetWidth||130);
      const markerHeight=marker.element.offsetHeight||34;
      let y=baseY;
      for(let attempt=0;attempt<6;attempt++){
        const bounds={left:x-markerWidth/2,right:x+markerWidth/2,top:y-markerHeight/2,bottom:y+markerHeight/2};
        const collision=occupied.find(other=>bounds.left<other.right+8&&bounds.right+8>other.left&&bounds.top<other.bottom+8&&bounds.bottom+8>other.top);
        if(!collision)break;
        y=collision.bottom+markerHeight/2+10;
        if(y+markerHeight/2>height-24)y=collision.top-markerHeight/2-10;
      }
      occupied.push({left:x-markerWidth/2,right:x+markerWidth/2,top:y-markerHeight/2,bottom:y+markerHeight/2});
      marker.element.style.left=`${x}px`;
      marker.element.style.top=`${y}px`;
      marker.element.classList.toggle('selected',selectedId===marker.district.id);
    }
  }

  return {update};
}
