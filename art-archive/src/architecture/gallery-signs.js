export function buildGallerySigns(context, {h,g}){
 const {layout, ceilingHeight, sign}=context;
  // Flush curved plaque on the drum: no projecting canopy or crossbeam.
  sign(h.title,0,ceilingHeight+1.45,layout.ringRadius-.10,Math.PI,1.95,g,layout.ringRadius-.10,h.color).name='entrance-sign';
}
