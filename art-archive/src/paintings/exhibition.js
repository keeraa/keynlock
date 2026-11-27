import {placedSlot} from './hanging.js';
import {arrangeWall} from './wall-packing.js';

export function arrangeExhibition(catalog, state, layout, settings) {
  const zones = new Map(), reserveReasons = new Map();
  const surfaces = layout.walls.map(wall=>({wall,works:[],area:0}));
  for (const surface of surfaces) {
    for (const theme of surface.wall.themes ?? [surface.wall.theme]) {
      const key = surface.wall.hall+'/'+theme;
      if (!zones.has(key)) zones.set(key,[]);
      zones.get(key).push(surface);
    }
  }
  let selected = 0;
  for (const painting of catalog.paintings) {
    if (state.included?.[painting.id] === false) continue;
    selected++;
    const {hall, wall} = painting.placement;
    const destination = state.placements?.[painting.id] || hall+'/'+wall;
    const partitions = zones.get(destination);
    const size = painting.physicalSizeM;
    if (!partitions) { reserveReasons.set(painting.id, 'unassigned'); continue; }
    if (!size || ![size.width,size.height].every(n => Number.isFinite(n) && n > 0)) {
      reserveReasons.set(painting.id, 'unmeasured');
      continue;
    }
    if (painting.image.sizeMatch === 'needs_review') { reserveReasons.set(painting.id, 'image'); continue; }
    const work = {painting,destination, width:size.width + 2 * settings.frameWidthM, height:size.height,
      category:state.categories?.[painting.id] || painting.category};
    const eligible = partitions.filter(p => p.wall.length >= work.width + 2 * settings.edgeMarginM);
    if (!eligible.length) { reserveReasons.set(painting.id,'oversize'); continue; }
    const target = eligible.reduce((a,b) => {
      if (a.wall.hall==='center' && a.works.length!==b.works.length) return a.works.length<b.works.length?a:b;
      return a.area/a.wall.length<=b.area/b.wall.length?a:b;
    });
    target.works.push(work);
    target.area += work.width*(work.height+2*settings.frameWidthM);
  }
  const groups = [], byId = new Map();
  for (const {wall, works} of surfaces) {
      const pages = arrangeWall(wall,works,settings,byId,reserveReasons);
      if (pages.length) groups.push(pages);
  }
  function distanceAlong(s) {
    const {a,b,length}=s.wall;
    return ((s.x-a.x)*(b.x-a.x)+(s.z-a.z)*(b.z-a.z))/length;
  }
  function slots(page) {return groups.flatMap(group=>group[page%group.length]);}
  function exclude(id,page) {
    const removed=byId.get(id);
    if(!removed)return null;
    const visible=new Set(slots(page).map(s=>s.painting.id));
    const group=groups.find(pages=>pages[0][0].wall===removed.wall);
    const row=group[removed.page], where=row.indexOf(removed);
    const along=distanceAlong(removed);
    // Fill the vacancy from a later exhibition of the same theme, testing the real frame.
    const occupied=row.filter(s=>s!==removed).map(s=>({...s,along:distanceAlong(s)}));
    let replacement=null;
    for(const candidate of byId.values()){
      if(visible.has(candidate.painting.id)||candidate.destination!==removed.destination)continue;
      replacement=placedSlot(candidate,removed.wall,along,removed.y,settings,occupied);
      if(!replacement)continue;
      const source=groups.find(pages=>pages[0][0].wall===candidate.wall)[candidate.page];
      source.splice(source.indexOf(candidate),1);
      row[where]=replacement;
      byId.set(candidate.painting.id,replacement);
      break;
    }
    if(!replacement)row.splice(where,1);
    byId.delete(id);selected--;
    for(let g=groups.length-1;g>=0;g--){
      const pages=groups[g];
      for(let i=pages.length-1;i>=0;i--)if(!pages[i].length)pages.splice(i,1);
      pages.forEach((p,i)=>p.forEach(s=>{s.page=i;}));
      if(!pages.length)groups.splice(g,1);
    }
    return replacement;
  }
  return {get selected(){return selected;},reserve:reserveReasons.size,reserveReasons,byId,
    get pageCount(){return Math.max(1,...groups.map(group=>group.length));},slots,exclude};
}
