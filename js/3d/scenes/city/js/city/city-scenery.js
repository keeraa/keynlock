// Reusable planting, gardens and street furniture for the world map.
export function createCityScenery(ctx) {
  const {T,TAU,random,part,coast,riverPoints,riverWidth,mainRoads,minorRoads,atPolyline,reserved,occupiedLots,housePaths,additionalPaths=[],scenicPaths=[],materials,collectSurface,terrainSurfaceAt,bridgeProfiles,heightAt,farmAccess,pavedRectangle,ribbon,streetLampSites}=ctx;
  function tree(x,z,r=1.2,type='green') {
    part('timber','cylinder',x,r*.9,z,.16*r,1.9*r,.16*r);
    const colors=type==='flower'?['flowers','rose','pale']:['greenery','greenDark','greenery'];
    part(colors[0],'crown',x,r*1.95,z,r*.8,r*1.13,r*.8);
    part(colors[1],'crown',x-r*.32,r*1.48,z+r*.18,r*.52,r*.67,r*.54);
    part(colors[2],'crown',x+r*.28,r*1.76,z-r*.12,r*.48,r*.65,r*.48);
  }
  function scenicFree(x,z,r=.8,allowReserved=false) {
    if(x<-57||x>57||z<-46||z>coast(x)-2)return false;
    if(atPolyline(x,z,riverPoints)<4.2+r*.6)return false;
    if(mainRoads.some(road=>atPolyline(x,z,road.p)<road.w*.5+r*.75))return false;
    if(minorRoads.some(road=>atPolyline(x,z,road.p)<road.w*.5+r*.7))return false;
    if(occupiedLots.some(lot=>Math.abs(x-lot.x)<lot.halfX+r&&Math.abs(z-lot.z)<lot.halfZ+r))return false;
    if(additionalPaths.some(path=>path.p.length>1&&atPolyline(x,z,path.p)<r+.5))return false;
    if(!allowReserved&&reserved.some(([rx,rz,d])=>Math.hypot(x-rx,z-rz)<d+r*.3))return false;
    return true;
  }
  function groundPatch(x,z,sx,sz,mat='lawn',height=.012) {
    const stone=['road','cobble','paving','quay','stonePath'].includes(mat);
    const uv=(px,pz)=>stone?[px/2.35,pz/5.2]:[px,pz];
    const positions=[x,terrainSurfaceAt(x,z)+height,z],uvs=uv(x,z),indices=[];
    for(let i=0;i<=32;i++){
      const a=i/32*TAU,rough=1+.065*Math.sin(i*2.8+x*.7+z*.27);
      const px=x+Math.cos(a)*sx*rough,pz=z+Math.sin(a)*sz*rough;
      positions.push(px,terrainSurfaceAt(px,pz)+height,pz);
      uvs.push(...uv(px,pz));
      if(i>0)indices.push(0,i+1,i);
    }
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    collectSurface(geometry,materials.get(mat));
  }
  function bench(x,z,yaw=0) {
    part('timber','box',x,.54,z,1.35,.15,.48,yaw);
    part('darkTimber','box',x,.95,z-.21,1.3,.76,.12,yaw);
    for(const dx of [-.5,.5])part('iron','box',x+dx,.28,z,.1,.56,.45,yaw);
  }
  function gardensAndTrees() {
    // Low planted terraces create relief without lifting building foundations.
    for(const [x,z,sx,sz] of [[-45,-50,5,3.4],[-10,-46,4.3,2.3],[42,-44,6,3],[55,-37,3.8,5]]) {
      groundPatch(x,z,sx*1.2,sz*1.16,'meadow',.011);
      part('meadow','dome',x,.035,z,sx,.32,sz);
    }
    // Formal palace gardens and wealthy courtyards, with planting beds and walks.
    const beds=[[-11,-25,3.2,3.3],[19,-25,3.3,3.3],[-10,-18,3.0,2.6],
      [19,-18,3,2.6],[43,-36,4.4,2.6],[47,-15,3.4,3.1],[27,-38,2.8,3.0],
      [44,2,3.0,2.8],[-44,3,2.6,2.8],[11,10,2.6,2.7]];
    for(const [x,z,sx,sz] of beds) {
      if(!scenicFree(x,z,.65))continue;
      groundPatch(x,z,sx+.5,sz+.45,'soil',.012);
      groundPatch(x,z,sx,sz,'lawn',.018);
      if(z< -13) {
        for(const dx of [-sx*.52,sx*.52])for(const dz of [-sz*.57,sz*.57]) {
          part('hedge','box',x+dx,.32,z+dz,sx*.52,.6,.42);
          part('flowers','dome',x+dx*.7,.44,z+dz*.7,.32,.25,.32);
        }
      } else {
        part('flowers','dome',x-.65,.27,z,.6,.34,.55);
        part('flowers','dome',x+.7,.27,z+.3,.5,.3,.56);
      }
    }
    const groves=[[-45,-50,5],[-39,6,4],[-48,11,5],[-12,-25,7],
      [13,-27,6],[24,-37,6],[44,-38,7],[52,-15,5],[48,5,6],
      [13,11,4],[-43,-5,5],[-8,9,4]];
    for(let i=0;i<720;i++) {
      const [cx,cz,r]=groves[Math.floor(random()*groves.length)];
      const a=random()*TAU,dist=Math.sqrt(random())*r;
      const x=cx+Math.cos(a)*dist,z=cz+Math.sin(a)*dist;
      const size=.65+random()*.39;
      if(scenicFree(x,z,size*.54))tree(x,z,size,random()>.85?'flower':'green');
    }
    // Evenly spaced trees guide the eye towards the palace gate.
    for(const z of [-27,-23,-19])for(const x of [-14,23]) {
      if(scenicFree(x,z,.45,true))tree(x,z,.84,'green');
    }
    for(const [x,z,a] of [[-7,12,0],[11,-8,1],[43,-9,0],[23,-34,1],[-46,2,1]]) {
      if(scenicFree(x,z,.75,true))bench(x,z,a);
    }
  }
  function openHillside(x,z,r=.8){
    if(x< -57||x>57||z< -91||z> -31)return false;
    if(Math.abs(x-5)<17&&z< -47&&z> -68)return false;
    if(atPolyline(x,z,riverPoints)<riverWidth(x,z)/2+2+r)return false;
    if(mainRoads.some(road=>atPolyline(x,z,road.p)<road.w/2+r+.95))return false;
    if(minorRoads.some(road=>atPolyline(x,z,road.p)<road.w/2+r+.7))return false;
    if(housePaths.some(path=>atPolyline(x,z,path)<r+.42))return false;
    if(occupiedLots.some(lot=>Math.abs(x-lot.x)<lot.halfX+r+.6&&
      Math.abs(z-lot.z)<lot.halfZ+r+.6))return false;
    return !reserved.some(([xx,zz,clearance])=>Math.hypot(x-xx,z-zz)<clearance+r);
  }
  function hillsideLandscaping(){
    // Clusters of scrub, sparse groves and exposed stone break up the bare
    // palace hill without overwhelming the main facade or blocking footpaths.
    const clusters=[[-45,-72,9],[-39,-55,7],[-18,-72,8],[-9,-40,7],
      [35,-70,8],[44,-57,10],[48,-78,10],[36,-43,6]];
    let planted=0,rocky=0;
    for(let i=0;i<620&&(planted<26||rocky<26);i++){
      const [cx,cz,extent]=clusters[Math.floor(random()*clusters.length)];
      const a=random()*TAU,radius=Math.sqrt(random())*extent;
      const x=cx+Math.cos(a)*radius,z=cz+Math.sin(a)*radius;
      const size=.46+random()*.49;
      if(!openHillside(x,z,size*.76))continue;
      if(i%3===0&&rocky<26){
        part('stone','crown',x,size*.16,z,size*.95,size*.44,size*.72);
        if(random()>.54)groundPatch(x,z,size*1.55,size*1.08,'meadow',.023);
        rocky++;
      }else if(planted<26){
        tree(x,z,size,random()>.92?'flower':'green');
        if(i%6===0)groundPatch(x,z,1.25+size,1.1+size*.4,'meadow',.021);
        planted++;
      }
    }
  }
  function riverbankLandscaping(){
    // Irregular small stones and reeds emphasize the changing bank profile.
    // Keep the bridge landings and building footprints completely clear.
    for(let i=6;i<riverPoints.length-7;i+=3){
      const [x,z]=riverPoints[i];
      const prev=riverPoints[i-2],next=riverPoints[i+2];
      const dx=next[0]-prev[0],dz=next[1]-prev[1],len=Math.hypot(dx,dz)||1;
      const nx=-dz/len,nz=dx/len;
      const side=i%2?1:-1;
      const bankDistance=riverWidth(x,z)*.5+1.12+random()*.8;
      const px=x+nx*side*bankDistance,pz=z+nz*side*bankDistance;
      const radius=.3+random()*.38;
      if(!openHillside(px,pz,radius)&&!scenicFree(px,pz,radius,true))continue;
      if(bridgeProfiles.some(bridge=>Math.hypot(px-bridge.x,pz-bridge.z)<9.0))continue;
      if(random()>.32)part('stone','crown',px,radius*.21,pz,radius*.92,radius*.44,radius*.76);
      if(random()>.28){
        for(let j=0;j<3;j++){
          const xx=px+(j-1)*.27,zz=pz+(j%2)*.24;
          part(j%3===0?'grain':'greenDark','cone',xx,.36,zz,.10,.72+random()*.38,.10);
        }
      }
    }
  }
  function greenOutskirts() {
    // Side groves and sparse northern copses follow the roads into the distant hills.
    for(let i=0;i<310;i++) {
      const northern=i>=138,side=i%2?-1:1;
      const x=northern?-109+random()*218:side*(65+random()*44);
      const z=northern?-89+random()*40:-46+random()*64;
      if(z>coast(x)-4.5)continue;
      if(atPolyline(x,z,riverPoints)<6.2)continue;
      if(reserved.some(([rx,rz,r])=>Math.hypot(x-rx,z-rz)<r+2.4))continue;
      if(atPolyline(x,z,farmAccess)<2.1)continue;
      if(occupiedLots.some(lot=>Math.abs(x-lot.x)<lot.halfX+1.25&&Math.abs(z-lot.z)<lot.halfZ+1.25))continue;
      if(mainRoads.some(road=>atPolyline(x,z,road.p)<road.w/2+1.9))continue;
      if(minorRoads.some(road=>atPolyline(x,z,road.p)<road.w/2+1.5))continue;
      if(i%8===0)groundPatch(x,z,1.9+random()*2.5,1.1+random()*2,'meadow',.027);
      if(random()>(northern?.48:.34))tree(x,z,.65+random()*.69,random()>.94?'flower':'green');
    }
  }
  function upperCityGarden() {
    // Symmetrical clipped planting, long axes and a small fountain make the
    // affluent hill neighborhood identifiable independently of roof colors.
    const x=43,z=-40;
    groundPatch(x,z,4.9,4.7,'lawn',.031);
    // Four garden arms meet a ring around the fountain: nobody walks through
    // its stone basin, and every visible paving segment becomes navigable.
    const radius=2.15;
    const ring=Array.from({length:25},(_,i)=>[x+Math.cos(i*Math.PI/12)*radius,
      z+Math.sin(i*Math.PI/12)*radius]);
    const walks=[
      {id:'garden-ring',p:ring},
      {id:'garden-west',p:[[x-3.9,z],[x-radius,z]]},
      {id:'garden-east',p:[[x+radius,z],[x+3.9,z]]},
      {id:'garden-north',p:[[x,z+radius],[x,z+3.7]]},
      {id:'garden-south',p:[[x,z-3.7],[x,z-radius]]},
    ];
    for(const walk of walks){
      ribbon(walk.p,walk.id==='garden-ring'?.9:1.0,'stonePath',.054);
      scenicPaths.push({...walk,kind:'garden'});
    }
    for(const side of [-1,1]){
      for(const dz of [-2.9,2.9]) {
        part('hedge','box',x+side*2.35,.44,z+dz,3.0,.85,.42);
        part('flowers','dome',x+side*2.35,.88,z+dz,.6,.28,.43);
      }
      part('hedge','box',x+side*3.95,.43,z,.46,.83,4.2);
      for(const dz of [-3.6,3.6]){
        part('timber','cylinder',x+side*4.3,1.05,z+dz,.17,2.05,.17);
        part('greenDark','cone',x+side*4.3,2.5,z+dz,.74,3.05,.74);
      }
    }
    const fy=heightAt(x,z);
    part('stone','cylinder',x,.38,z,1.52,.76,1.52,0,0,0,fy);
    part('river','cylinder',x,.79,z,1.27,.13,1.27,0,0,0,fy);
    part('stone','cylinder',x,1.21,z,.28,.79,.28,0,0,0,fy);
    part('river','dome',x,1.69,z,.42,.24,.42,0,0,0,fy);
    part('pale','dome',x,1.94,z,.12,.27,.12,0,0,0,fy);
  }
  function oldTownMarket() {
    // Market arch and covered stalls near the team hideout.
    pavedRectangle(-13,15,9,5.7,.049);
    for(const x of [-16.3,-12.4,-8.5]) {
      part('timber','box',x,.8,15,2.3,1.5,2.4);
      part('roofRed','box',x,1.65,15,2.8,.25,2.8);
      for(const xx of [-1.05,1.05])part('darkTimber','box',x+xx,.8,16.3,.13,1.6,.15);
    }
    part('pale','box',-14,1.8,9,2.3,3.4,2.3);
    part('roofTile','cone',-14,4.1,9,1.7,2.1,1.7);
    for(const [x,z] of [[-18,17],[-11,17],[-8,12]]) {
      part('timber','cylinder',x,.42,z,.3,.84,.3);
      part('quay','cylinder',x,.88,z,.34,.1,.34);
      part('timber','box',x+1,.38,z,.73,.7,.67);
    }
    for(const x of [-16.3,-12.4,-8.5]){
      part('roofOchre','box',x,2.11,15.25,2.55,.11,2.9);
      part('iron','box',x,1.05,16.32,.36,.2,.12);
    }
  }
  function streetFurniture() {
    // Lighted streets make the real routes legible after dusk.
    const paths=[...mainRoads,...minorRoads];
    for(let pathIndex=0;pathIndex<paths.length;pathIndex++) {
      const road=paths[pathIndex];
      let marker=0;
      for(let i=1;i<road.p.length;i++) {
        const a=road.p[i-1],b=road.p[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1;
        for(let s=3.4;s<len;s+=5.8) {
          marker++;
          if((pathIndex+marker)%3===0)continue;
          const side=(marker%2?1:-1),offset=(road.w/2+.85)*side;
          const x=a[0]+dx*s/len-dz/len*offset;
          const z=a[1]+dz*s/len+dx/len*offset;
          if(!scenicFree(x,z,.35,true))continue;
          part('iron','cylinder',x,1.32,z,.062,2.64,.062);
          part('litWindow','dome',x,2.77,z,.2,.24,.2);
          part('roofDark','cone',x,3.0,z,.32,.24,.32);
          streetLampSites.push({x,y:heightAt(x,z)+2.77,z});
        }
      }
    }
  }
  return {tree,scenicFree,groundPatch,bench,gardensAndTrees,hillsideLandscaping,riverbankLandscaping,greenOutskirts,upperCityGarden,oldTownMarket,streetFurniture};
}
