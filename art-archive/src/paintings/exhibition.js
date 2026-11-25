import {placedSlot,wallRange} from './hanging.js';
import {arrangeWall,canvasArea} from './wall-packing.js';

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
  const pending=[],tabletop=new Map(),tableRows=new Map();
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
    if(painting.collection==='keynlock'){
      const slot=walkthroughTableSlot(work,layout,settings,tableRows);
      if(slot)tabletop.set(painting.id,slot);
      else reserveReasons.set(painting.id,'oversize');
      continue;
    }
    const eligible = partitions.filter(({wall})=>{
      const {min,max}=wallRange(wall,settings);
      return max-min>=work.width-1e-7;
    });
    if (!eligible.length) { reserveReasons.set(painting.id,'oversize'); continue; }
    pending.push({work,eligible});
  }
  // Reserve the largest artwork in each wing before balancing the side walls.
  pending.sort((a,b)=>canvasArea(b.work)-canvasArea(a.work));
  for(const {work,eligible} of pending){
    const end=eligible.find(p=>p.wall.theme==='end'&&!p.featured);
    if(end &&
      work.height+2*settings.frameWidthM<=settings.maxTopM-settings.minBottomM){
      end.featured=work;
      end.area+=canvasArea(work);
      continue;
    }
    const besideFeature=eligible.filter(panel=>{
      if(!panel.featured)return true;
      const {min,max}=wallRange(panel.wall,settings);
      const sideSpace=(max-min-panel.featured.width)/2-settings.horizontalGapM;
      return work.width<=sideSpace+1e-7;
    });
    const candidates=besideFeature.length?besideFeature:eligible;
    const target=eligible[0].wall.hall==='center'
      ? chooseMasterpiecePanel(eligible,work,settings)
      : candidates.reduce((a,b)=>a.area/a.wall.length<=b.area/b.wall.length?a:b);
    target.works.push(work);
    target.area+=work.width*(work.height+2*settings.frameWidthM);
  }
  const groups = [], byId = new Map(tabletop);
  for (const {wall, works, featured} of surfaces) {
      const pages = arrangeWall(wall,works,settings,byId,reserveReasons,featured);
      if (pages.length) groups.push(pages);
  }
  function distanceAlong(s) {
    const {a,b,length}=s.wall;
    return ((s.x-a.x)*(b.x-a.x)+(s.z-a.z)*(b.z-a.z))/length;
  }
  function slots(page) {return groups.flatMap(group=>group[Math.min(page,group.length-1)]).concat([...tabletop.values()]);}
  function exclude(id,page) {
    const removed=byId.get(id);
    if(!removed)return null;
    if(tabletop.delete(id)){byId.delete(id);selected--;return null;}
    const visible=new Set(slots(page).map(s=>s.painting.id));
    const group=groups.find(pages=>pages[0][0].wall===removed.wall);
    const row=group[removed.page], where=row.indexOf(removed);
    const along=distanceAlong(removed);
    // Fill the vacancy from a later exhibition of the same theme, testing the real frame.
    const occupied=row.filter(s=>s!==removed).map(s=>({...s,along:distanceAlong(s)}));
    let replacement=null;
    for(const candidate of byId.values()){
      if(removed.featured || candidate.featured || visible.has(candidate.painting.id)||candidate.destination!==removed.destination)continue;
      replacement=placedSlot(candidate,removed.wall,along,removed.y,settings,occupied);
      if(!replacement)continue;
      const source=groups.find(pages=>pages[0][0].wall===candidate.wall)[candidate.page];
      source.splice(source.indexOf(candidate),1);
      row[where]=replacement;
      byId.set(candidate.painting.id,replacement);
      break;
    }
    if(!replacement)row.splice(where,1);
    for(const pages of groups)for(const slots of pages){
      if(slots===row)continue;
      const index=slots.indexOf(removed);
      if(index!==-1)slots.splice(index,1);
    }
    byId.delete(id);selected--;
    for(let g=groups.length-1;g>=0;g--){
      const pages=groups[g];
      for(let i=pages.length-1;i>=0;i--)if(!pages[i].length)pages.splice(i,1);
      const seen=new Set();
      pages.forEach((p,i)=>p.forEach(s=>{if(!seen.has(s)){seen.add(s);s.page=i;}}));
      if(!pages.length)groups.splice(g,1);
    }
    return replacement;
  }
  return {get selected(){return selected;},reserve:reserveReasons.size,reserveReasons,byId,
    get pageCount(){return Math.max(1,...groups.map(group=>group.length));},slots,exclude};
}

// Prefer a panel that can display the work alongside its current masterpieces.
function chooseMasterpiecePanel(panels,work,settings){
  let target,bestPages=Infinity;
  for(const panel of panels){
    const pages=arrangeWall(panel.wall,[...panel.works,work],settings,new Map(),new Map()).length;
    if(pages<bestPages || (pages===bestPages && panel.area<target.area)){
      target=panel;bestPages=pages;
    }
  }
  return target;
}

function walkthroughTableSlot(work,layout,settings,rows){
  const edge=.035,gap=.035;
  const tables=[...(layout.storageTables??[])].sort((a,b)=>(rows.get(a.id)?.length??0)-(rows.get(b.id)?.length??0));
  for(const table of tables){
    const row=rows.get(table.id)??[];
    const length=row.reduce((sum,slot)=>sum+slot.width+gap,work.width);
    if(length+2*edge>table.width || work.height+2*settings.frameWidthM+2*edge>table.depth)continue;
    const normal={x:Math.sin(table.angle),z:Math.cos(table.angle)};
    const slot={...work,y:table.y+settings.frameDepthM/2,normal,
      wall:{id:table.id,hall:table.room},floorRoom:table.room,supportId:table.id,
      floorAngle:table.angle,page:0,tier:1};
    row.push(slot);rows.set(table.id,row);
    let offset=-length/2;
    for(const piece of row){
      const center=offset+piece.width/2;
      piece.x=table.x+normal.z*center;piece.z=table.z-normal.x*center;
      offset+=piece.width+gap;
    }
    return slot;
  }
  return null;
}
