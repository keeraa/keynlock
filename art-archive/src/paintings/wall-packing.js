// Miniatures share a lower-tier footprint. Pair similar widths for a clean stack.
function hangingGroups(works, settings) {
  const small = [], regular = [];
  for (const work of works) {
    const size = work.painting.physicalSizeM;
    (Math.max(size.width,size.height) <= settings.smallCanvasM ? small : regular).push(work);
  }
  const byWidth = (a,b) => b.width - a.width;
  small.sort(byWidth);
  const groups = [];
  for (let i = 0; i < small.length; i += 2) groups.push(small.slice(i,i+2));
  for (const work of regular.sort(byWidth)) groups.push([work]);
  return groups;
}

// Test the floor line and the free ledges above already placed groups.
// A short frame can still use the space underneath an overhanging wider one.
function fitGroup(page, width, height, lowOnly, wall, settings) {
  const {horizontalGapM:gx,verticalGapM:gy,edgeMarginM:margin,minBottomM,maxTopM,tiers} = settings;
  const edges = new Set([margin]);
  for (const group of page) {
    edges.add(group.left);
    edges.add(group.right + gx);
    edges.add(group.right - width);
  }
  const eps = 1e-7;
  const fromBottom = [...page].sort((a,b) => a.bottom-b.bottom);
  let best;
  for (const left of edges) {
    const right = left + width;
    if (left < margin-eps || right > wall.length-margin+eps) continue;
    let bottom = minBottomM, tier = 1;
    for (const group of fromBottom) {
      if (left >= group.right+gx-eps || right <= group.left-gx+eps) continue;
      if (bottom + height + gy <= group.bottom + eps) break;
      bottom = Math.max(bottom, group.top + gy);
      tier = Math.max(tier,group.tier+1);
    }
    const top = bottom + height;
    if (tier > (lowOnly ? 1 : tiers) || top > maxTopM+eps) continue;
    if (!best || bottom < best.bottom-eps || (Math.abs(bottom-best.bottom)<eps && left < best.left)) {
      best = {left,right,bottom,top,tier};
    }
  }
  return best;
}

export function arrangeWall(wall, works, settings, byId, reserveReasons) {
  const pages = [], frame = settings.frameWidthM;
  for (const items of hangingGroups(works,settings)) {
    const width = Math.max(...items.map(w=>w.width));
    const height = items.reduce((sum,w)=>sum+w.height+2*frame,0) + (items.length-1)*settings.verticalGapM;
    const lowOnly = Math.max(items[0].width-2*frame,items[0].height) <= settings.smallCanvasM + 1e-8;
    let page, fit;
    for (page of pages) {
      fit = fitGroup(page,width,height,lowOnly,wall,settings);
      if (fit) break;
    }
    if (!fit) {
      page = [];
      fit = fitGroup(page,width,height,lowOnly,wall,settings);
      if (!fit) {
        for (const w of items) reserveReasons.set(w.painting.id,'oversize');
        continue;
      }
      pages.push(page);
    }
    page.push({...fit,items});

  }

  const depth = settings.frameDepthM/2 + settings.wallClearanceM;
  return pages.map((page,index)=>{
    const shift = (wall.length-Math.min(...page.map(g=>g.left))-Math.max(...page.map(g=>g.right)))/2;
    const frameHeight = item => item.height + 2*frame;
    const worksOnPage = page.flatMap(group=>group.items);
    const stackHeight = worksOnPage.reduce((sum,item)=>sum+frameHeight(item),0) + (worksOnPage.length-1)*settings.verticalGapM;
    const stack = wall.centerComposition && worksOnPage.length <= settings.tiers &&
      stackHeight <= settings.maxTopM-settings.minBottomM;
    const top = stack ? settings.minBottomM+stackHeight : Math.max(...page.map(group=>group.top));
    const lift = wall.centerComposition && wall.hall==='center' ? (settings.maxTopM-top)/2 : 0;
    let stackBottom = settings.minBottomM+lift;
    const slots = [];
    for (const group of page) {
      const along = stack ? .5 : ((group.left+group.right)/2+shift)/wall.length;
      let bottom = stack ? stackBottom : group.bottom+lift;
      for (const work of group.items) {
        const slot = {...work,wall,normal:wall.normal,page:index,tier:group.tier,
          x:wall.a.x+(wall.b.x-wall.a.x)*along+wall.normal.x*depth,
          z:wall.a.z+(wall.b.z-wall.a.z)*along+wall.normal.z*depth,
          y:bottom+frame+work.height/2};
        bottom += work.height + 2*frame + settings.verticalGapM;
        slots.push(slot);
        byId.set(work.painting.id,slot);
      }
      stackBottom = bottom;
    }
    return slots;
  });
}
