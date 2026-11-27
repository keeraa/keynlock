import {wallRange} from './hanging.js';
export const canvasArea = work => work.painting.physicalSizeM.width * work.height;
export const heightOrder=(a,b)=>a.height-b.height||a.width-b.width||a.painting.id.localeCompare(b.painting.id);
// Miniatures share a lower-tier footprint. Pair similar widths for a clean stack.
function hangingGroups(works, settings, prioritizeTall) {
  const miniature=work=>Math.max(work.painting.physicalSizeM.width,work.height)<=settings.smallCanvasM;
  const byArea=(a,b)=>canvasArea(a)-canvasArea(b);
  const widthOrder=(a,b)=>b.width-a.width;
  const height=work=>work.height+2*settings.frameWidthM;
  const available=settings.maxTopM-settings.minBottomM;
  const leaders=prioritizeTall?works.filter(work=>height(work)>available*.52).sort((a,b)=>byArea(b,a)):[];
  const remaining=new Set(works);
  for(const work of leaders)remaining.delete(work);
  const columns=[];
  for(const leader of leaders){
    let companion=null,best=Infinity;
    for(const work of remaining){
      const ratio=work.width/leader.width;
      if(ratio<.43||ratio>1||canvasArea(work)>=canvasArea(leader)||height(work)>leader.height*.63)continue;
      if(height(work)+height(leader)+settings.verticalGapM>available)continue;
      const subject=work.painting.subject===leader.painting.subject;
      const theme=work.destination===leader.destination;
      const score=(1-ratio)*2+Math.abs(.36-work.height/leader.height)+(theme?0:.4)+(subject?0:.2);
      if(score<best){companion=work;best=score;}
    }
    if(companion)remaining.delete(companion);
    columns.push(companion?[companion,leader]:[leader]);
  }
  const small=[...remaining].filter(miniature).sort(widthOrder),compact=[];
  for(let i=0;i<small.length;i+=2)compact.push(small.slice(i,i+2).sort(byArea));
  const regular=[...remaining].filter(work=>!miniature(work)).sort((a,b)=>byArea(a,b)||widthOrder(a,b));
  // Alternate tall focal points with compact stacks instead of filling a whole
  // wall with a parade of tall canvases before considering their neighbours.
  const groups=[];
  let separator=0;
  for(const column of columns){
    groups.push(column);
    if(separator<compact.length)groups.push(compact[separator++]);
    else if(regular.length)groups.push([regular.shift()]);
  }
  groups.push(...compact.slice(separator),...regular.map(work=>[work]));
  return groups;
}

// Test the floor line and the free ledges above already placed groups.
// A short frame can still use the space underneath an overhanging wider one.
function fitGroup(page, width, height, lowOnly, smallest, largest, wall, settings, anchor) {
  const {horizontalGapM:gx,verticalGapM:gy,minBottomM,maxTopM,tiers} = settings;
  const {min:leftLimit,max:rightLimit}=wallRange(wall,settings);
  const edges = new Set([leftLimit]);
  const centered=anchor && page.includes(anchor);
  const axis=(leftLimit+rightLimit)/2;
  for (const group of page) {
    edges.add(group.left);
    edges.add(group.right + gx);
    edges.add(group.right - width);
    edges.add((group.left+group.right-width)/2);
    if(centered)edges.add(group.left-gx-width);
  }
  const eps = 1e-7;
  const fromBottom = [...page].sort((a,b) => a.bottom-b.bottom);
  let best;
  const sideBalance=centered?page.reduce((balance,group)=>{
    if(group===anchor)return balance;
    return balance+Math.sign((group.left+group.right)/2-axis)*(group.right-group.left)*(group.top-group.bottom);
  },0):0;
  for (const left of edges) {
    const right = left + width;
    if (left < leftLimit-eps || right > rightLimit+eps) continue;
    let bottom = minBottomM, tier = 1, ceiling = maxTopM;
    for (const group of fromBottom) {
      if (left >= group.right+gx-eps || right <= group.left-gx+eps) continue;
      if(group.largest>smallest+eps)ceiling=Math.min(ceiling,group.bottom-gy);
      if (bottom + height + gy <= group.bottom + eps) continue;
      bottom = Math.max(bottom, group.top + gy);
      tier = Math.max(tier,group.tier+1);
    }
    const top = bottom + height;
    if(page.some(group=>left<group.right-eps && right>group.left+eps &&
      top<=group.bottom+eps && largest>group.smallest+eps))continue;
    if (tier > (lowOnly ? 1 : tiers) || top > ceiling+eps) continue;
    const middle=(left+right)/2;
    const score=centered
      ? bottom+.25*Math.abs(sideBalance+Math.sign(middle-axis)*width*height)+.08*Math.abs(middle-axis)
      : bottom+.002*(left-leftLimit);
    if (!best || score < best.score-eps) {
      best = {left,right,bottom,top,tier,score};
    }
  }
  return best;
}

// Centre complete rows as units. Interlocking groups can keep their packed
// positions when centring would put a frame over a larger work or close a gap.
function centerRows(page, axis, settings) {
  const rows=new Map();
  for(const group of page){
    if(!rows.has(group.tier))rows.set(group.tier,[]);
    rows.get(group.tier).push(group);
  }
  const offsets=new Map();
  for(const [tier,row] of rows){
    const left=Math.min(...row.map(group=>group.left));
    const right=Math.max(...row.map(group=>group.right));
    offsets.set(tier,axis-(left+right)/2);
  }
  const eps=1e-7;
  for(const lower of page)for(const upper of page){
    if(lower.bottom>=upper.bottom || lower.tier===upper.tier)continue;
    const a=offsets.get(lower.tier), b=offsets.get(upper.tier);
    const gap=Math.max(upper.left+b-lower.right-a,lower.left+a-upper.right-b);
    if(gap>=settings.horizontalGapM-eps)continue;
    if(upper.bottom-lower.top<settings.verticalGapM-eps)return null;
    if(gap<-eps && upper.smallest<lower.largest-eps)return null;
  }
  return offsets;
}

function centerRowHeights(page, horizontalOffset, settings) {
  const offsets=new Map();
  const {horizontalGapM,verticalGapM,maxTopM}=settings;
  for(const group of page){
    const peers=page.filter(other=>other.tier===group.tier && other.bottom===group.bottom);
    const rowTop=Math.max(...peers.map(other=>other.top));
    if(rowTop===group.top)continue;
    const x=horizontalOffset(group);
    let ceiling=maxTopM;
    for(const other of page){
      if(other.bottom<=group.bottom)continue;
      const otherX=horizontalOffset(other);
      if(group.right+x+horizontalGapM<=other.left+otherX+1e-7 ||
         other.right+otherX+horizontalGapM<=group.left+x+1e-7)continue;
      ceiling=Math.min(ceiling,other.bottom-verticalGapM);
    }
    offsets.set(group,Math.max(0,Math.min((rowTop-group.top)/2,ceiling-group.top)));
  }
  return offsets;
}

export function arrangeWall(wall, works, settings, byId, reserveReasons, featured=null) {
  if(wall.hall!=='center'&&wall.theme==='end'&&featured)return arrangeRearWall(wall,works,settings,byId,featured);
  if(wall.hall!=='center')return arrangeSizeOrderedWall(wall,works,settings,byId,reserveReasons,featured);
  const pages = [], frame = settings.frameWidthM;
  const {min,max}=wallRange(wall,settings);
  const anchor = featured && {
    left:(min+max-featured.width)/2,right:(min+max+featured.width)/2,
    bottom:settings.minBottomM,top:settings.minBottomM+featured.height+2*frame,
    tier:1,items:[featured],smallest:canvasArea(featured),largest:canvasArea(featured),
  };
  if(anchor)pages.push([anchor]);
  for (const items of hangingGroups(works,settings,wall.hall!=='center')) {
    const areas=items.map(canvasArea),smallest=Math.min(...areas),largest=Math.max(...areas);
    const width = Math.max(...items.map(w=>w.width));
    const height = items.reduce((sum,w)=>sum+w.height+2*frame,0) + (items.length-1)*settings.verticalGapM;
    const lowOnly = items.length>1 || items.every(work=>Math.max(work.painting.physicalSizeM.width,work.height)<=settings.smallCanvasM+1e-8);
    let page, fit;
    for (page of pages) {
      fit = fitGroup(page,width,height,lowOnly,smallest,largest,wall,settings,anchor);
      if (fit) break;
    }
    if (!fit) {
      page = anchor ? [anchor] : [];
      fit = fitGroup(page,width,height,lowOnly,smallest,largest,wall,settings,anchor);
      if (!fit && anchor) {
        page=[];fit=fitGroup(page,width,height,lowOnly,smallest,largest,wall,settings,anchor);
      }
      if (!fit) {
        for (const w of items) reserveReasons.set(w.painting.id,'oversize');
        continue;
      }
      pages.push(page);
    }
    page.push({...fit,items,smallest,largest});
  }

  const depth = settings.frameDepthM/2 + settings.wallClearanceM;
  let featuredSlot;
  return pages.map((page,index)=>{
    const shift = page.includes(anchor) ? 0 : (min+max-Math.min(...page.map(g=>g.left))-Math.max(...page.map(g=>g.right)))/2;
    const frameHeight = item => item.height + 2*frame;
    const worksOnPage = page.flatMap(group=>group.items);
    const stackHeight = worksOnPage.reduce((sum,item)=>sum+frameHeight(item),0) + (worksOnPage.length-1)*settings.verticalGapM;
    const stack = wall.hall==='center' && wall.centerComposition && worksOnPage.length <= settings.tiers &&
      stackHeight <= settings.maxTopM-settings.minBottomM;
    const centerComposition=wall.hall==='center' && wall.centerComposition;
    const rowOffsets=centerComposition && !stack
      ? centerRows(page,(min+max)/2,settings)
      : null;
    const horizontalOffset=group=>rowOffsets?.get(group.tier)??shift;
    const rowHeights=centerComposition && !stack ? centerRowHeights(page,horizontalOffset,settings) : null;
    const top = stack ? settings.minBottomM+stackHeight : Math.max(...page.map(group=>group.top));
    const lift = wall.centerComposition && wall.hall==='center' ? (settings.maxTopM-top)/2 : 0;
    let stackBottom = settings.minBottomM+lift;
    const slots = [];
    const ordered=stack?[...page].sort((a,b)=>a.smallest-b.smallest):page;
    for (const group of ordered) {
      const along = stack ? .5 : ((group.left+group.right)/2+horizontalOffset(group))/wall.length;
      let bottom = stack ? stackBottom : group.bottom+lift+(rowHeights?.get(group)??0);
      for (const work of stack?[...group.items].sort((a,b)=>canvasArea(a)-canvasArea(b)):group.items) {
        if(work===featured && featuredSlot){slots.push(featuredSlot);continue;}
        const slot = {...work,wall,normal:wall.normal,page:index,tier:group.tier,featured:work===featured,
          x:wall.a.x+(wall.b.x-wall.a.x)*along+wall.normal.x*depth,
          z:wall.a.z+(wall.b.z-wall.a.z)*along+wall.normal.z*depth,
          y:bottom+frame+work.height/2};
        bottom += work.height + 2*frame + settings.verticalGapM;
        slots.push(slot);
        if(work===featured)featuredSlot=slot;
        byId.set(work.painting.id,slot);
      }
      stackBottom = bottom;
    }
    return slots;
  });
}

// Consecutive height-ordered works share a column only when their frame widths
// differ by at most 25%. Do not pull a taller work past skipped smaller works.
export function galleryColumns(works,settings){
 const available=settings.maxTopM-settings.minBottomM,frame=settings.frameWidthM;
 const bandOf=w=>w.height<=settings.smallCanvasM?0:w.height<settings.hoistFromM?1:2;
 const columns=[];
 for(const band of [0,1,2]){
  const items=works.filter(w=>bandOf(w)===band).sort(heightOrder);
  const tallest=Math.max(0,...items.map(w=>w.height+2*frame));
  const count=Math.max(1,Math.min(band===0?settings.tiers:band===1?2:1,
   Math.floor((available+settings.verticalGapM)/(tallest+settings.verticalGapM))));
  for(let i=0;i<items.length;){
   const column=[];let narrow=Infinity,wide=0;
   while(i<items.length&&column.length<count){
    const next=items[i],min=Math.min(narrow,next.width),max=Math.max(wide,next.width);
    if(column.length&&max/min>1.25+1e-7)break;
    column.push(next);narrow=min;wide=max;i++;
   }
   columns.push({items:column,width:wide,band});
  }
 }
 return columns;
}

// Height zones run horizontally, while each zone uses several vertical rows.
// Keep a large side-wall anchor on the active page instead of filling it with
// small works and sending every large canvas to a later exhibition.
function arrangeSizeOrderedWall(wall,works,settings,byId,reserveReasons,featured){
 const {min,max}=wallRange(wall,settings),frame=settings.frameWidthM,gap=settings.horizontalGapM;
 const availableHeight=settings.maxTopM-settings.minBottomM;
 const valid=w=>w.width<=max-min+1e-7&&w.height+2*frame<=availableHeight+1e-7;
 const eligible=[...works].sort(heightOrder).filter(w=>{if(valid(w))return true;reserveReasons.set(w.painting.id,'oversize');return false;});
 const anchor=featured??eligible.pop();
 if(!anchor)return [];
 const grouped=galleryColumns(eligible,settings);
 const queues=[0,1,2].map(band=>grouped.filter(column=>column.band===band));
 const pages=[];
 if(featured)pages.push({columns:[],anchor:true});
 else if(!queues.some(q=>q.length))pages.push({columns:[],anchor:true});
 while(queues.some(q=>q.length)){
  const columns=[],used=[0,0,0];let remaining=max-min-anchor.width-gap;
  function take(band){
   const q=queues[band];
   const starter=q.findIndex(c=>c.width<=remaining+1e-7&&c.items.some(w=>w.painting.id==='ART-1815'));
   const index=starter>=0?starter:band===2?q.findLastIndex(c=>c.width<=remaining+1e-7):q.findIndex(c=>c.width<=remaining+1e-7);
   if(index<0)return false;
   const [column]=q.splice(index,1);columns.push(column);remaining-=column.width+gap;used[band]+=column.width+gap;return true;
  }
  // Every page gets a representative of each available zone before extra fill.
  for(const band of [0,1,2])take(band);
  while(true){
   const priority=[0,1,2].sort((a,b)=>used[a]/[.3,.35,.35][a]-used[b]/[.3,.35,.35][b]);
   if(!priority.some(take))break;
  }
  if(!columns.length){
   // Two unusually wide works may require independent pages at full size.
   if(!pages.length)pages.push({columns:[],anchor:true});
   const band=queues.findIndex(q=>q.length),column=queues[band].shift();
   pages.push({columns:[column],anchor:false});
  }else pages.push({columns,anchor:true});
 }
 const dx=(wall.b.x-wall.a.x)/wall.length,dz=(wall.b.z-wall.a.z)/wall.length;
 const forward=dx*wall.normal.z-dz*wall.normal.x>0,depth=settings.frameDepthM/2+settings.wallClearanceM;
 let anchorSlot;
 function makeSlot(work,center,bottom,tier,index){
  const along=forward?center:min+max-center;
  const result={...work,wall,normal:wall.normal,page:index,tier,featured:work===featured,
   x:wall.a.x+dx*along+wall.normal.x*depth,z:wall.a.z+dz*along+wall.normal.z*depth,y:bottom+frame+work.height/2};
  byId.set(work.painting.id,result);return result;
 }
 return pages.map(({columns,anchor:showAnchor},index)=>{
  const result=[];let left=min;
  columns.sort((a,b)=>heightOrder(a.items[0],b.items[0]));
  const rowBottoms=new Map();
  for(const band of [0,1,2]){
   const heights=[];
   for(const column of columns.filter(c=>c.band===band))column.items.forEach((w,row)=>{
    heights[row]=Math.max(heights[row]??0,w.height+2*frame);
   });
   const bottoms=[];let bottom=settings.minBottomM;
   for(const height of heights){bottoms.push(bottom);bottom+=height+settings.verticalGapM;}
   rowBottoms.set(band,bottoms);
  }
  for(const column of columns){
   for(const [row,work]of column.items.entries()){
    result.push(makeSlot(work,left+column.width/2,rowBottoms.get(column.band)[row],row+1,index));
   }
   left+=column.width+gap;
  }
  if(showAnchor){
   if(!anchorSlot)anchorSlot=makeSlot(anchor,featured?(min+max)/2:max-anchor.width/2,settings.minBottomM,1,index);
   result.push(anchorSlot);
  }
  return result;
 });
}


// A rear wall holds either one monumental work or a balanced trio, lowered
// together until the tallest frame reaches the plaster baseline.
function arrangeRearWall(wall,companions,settings,byId,featured){
 const {min,max}=wallRange(wall,settings),axis=(min+max)/2;
 const dx=(wall.b.x-wall.a.x)/wall.length,dz=(wall.b.z-wall.a.z)/wall.length;
 const depth=settings.frameDepthM/2+settings.wallClearanceM,y=settings.minBottomM+featured.height/2+settings.frameWidthM;
 const pieces=[{work:featured,along:axis}];
 if(companions.length===2){
  pieces.push({work:companions[0],along:axis-featured.width/2-settings.horizontalGapM-companions[0].width/2},
   {work:companions[1],along:axis+featured.width/2+settings.horizontalGapM+companions[1].width/2});
 }
 return [pieces.map(({work,along})=>{
  const slot={...work,wall,normal:wall.normal,page:0,tier:1,featured:work===featured,
   x:wall.a.x+dx*along+wall.normal.x*depth,z:wall.a.z+dz*along+wall.normal.z*depth,y};
  byId.set(work.painting.id,slot);return slot;
 })];
}
