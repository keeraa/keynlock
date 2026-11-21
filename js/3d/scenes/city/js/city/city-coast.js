// Terrain, coastal shelves, quays and sea meshes for the world map.
import {createWaterMaterials} from '../water.js';
import {createTerrainMeshes} from '../terrain.js';

export function createCityCoast({T,scene,materials,coast,heightAt,part,ribbon,clamp,objects,setTerrain}) {
  function landAndSea() {
    const waterMats=createWaterMaterials(T);
    // A continuous pale sand shelf descends under turquoise shallows to cooler deep dunes.
    const bedX=148,bedZ=100,bedPositions=[],bedUvs=[],bedIndices=[];
    for(let iz=0;iz<=bedZ;iz++)for(let ix=0;ix<=bedX;ix++) {
      const x=-305+610*ix/bedX,t=iz/bedZ;
      const start=coast(x)-7,z=start+(615-start)*Math.pow(t,1.65);
      const depth=clamp((z-coast(x)+3)/148,0,1);
      const ripples=(.095*Math.sin(x*.34+z*.21)+.065*Math.sin(z*.47-x*.13))*Math.min(1,depth*8);
      const dune=.26*Math.sin(x*.065+z*.11)*depth;
      bedPositions.push(x,-.84-13.3*Math.pow(depth,1.2)+ripples+dune,z);
      bedUvs.push(x,z);
      if(ix&&iz){const a=iz*(bedX+1)+ix,b=a-1,c=a-bedX-1,d=c-1;bedIndices.push(a,c,b,b,c,d);}
    }
    const bedGeometry=new T.BufferGeometry();
    bedGeometry.setAttribute('position',new T.Float32BufferAttribute(bedPositions,3));
    bedGeometry.setAttribute('uv',new T.Float32BufferAttribute(bedUvs,2));
    bedGeometry.setIndex(bedIndices);bedGeometry.computeVertexNormals();
    const seabed=new T.Mesh(bedGeometry,materials.get('seabed'));
    seabed.name='city-sandy-seabed';seabed.receiveShadow=true;
    scene.add(seabed);objects.push(seabed);
    // The sea starts beneath the shoreline and extends beyond every camera pan.
    const seaGeometry=new T.PlaneGeometry(600,600,116,116);
    const sea=waterMats.createSea(seaGeometry);
    sea.rotation.x=-Math.PI/2;sea.position.set(0,-.34,312);
    scene.add(sea);objects.push(sea);
    const ground=createTerrainMeshes(T,materials.get('land'),coast,heightAt);
    setTerrain(ground.land,ground.surfaceHeightAt);
    scene.add(ground.land);objects.push(ground.land);
    for(const edge of ground.skirts){scene.add(edge);objects.push(edge);}
    const westernBeach=[],easternBeach=[],westernWetSand=[],easternWetSand=[];
    const westernQuay=[],easternQuay=[];
    for(let x=-113;x<=113;x+=.8){
      if(x< -59.5){
        westernBeach.push([x,coast(x)-2.45]);
        westernWetSand.push([x,coast(x)-.85]);
      }else if(x>59.5){
        easternBeach.push([x,coast(x)-2.45]);
        easternWetSand.push([x,coast(x)-.85]);
      }
      if(x>=-60&&x< -25)westernQuay.push([x,coast(x)-2.35]);
      if(x> -15.5&&x<=60)easternQuay.push([x,coast(x)-2.35]);
    }
    // Wild coast stays sandy. Across the town, the paved apron owns the whole
    // waterfront footprint: no sand polygon can overdraw its inland edge.
    ribbon(westernBeach,5.35,'beach',.027,{rough:.035});
    ribbon(easternBeach,5.35,'beach',.027,{rough:.035});
    ribbon(westernWetSand,1.65,'wetSand',.036,{rough:.02});
    ribbon(easternWetSand,1.65,'wetSand',.036,{rough:.02});
    // The bridge crosses a real open estuary; paving and retaining walls
    // end at either riverbank instead of forming a hidden dam under its deck.
    ribbon(westernQuay,5.55,'paving',.12,{rough:.005});
    ribbon(easternQuay,5.55,'paving',.12,{rough:.005});
    for(let x=-59;x<=59;x+=2.1) {
      if(x> -25&&x< -15.5)continue;
      const slope=(coast(x+1)-coast(x-1))/2;
      part('quay','box',x,-.42,coast(x)-.3,2.24,1.10,.88,-Math.atan(slope));
      part('stone','box',x,.13,coast(x)-.55,2.23,.14,.35,-Math.atan(slope));
    }
    return waterMats;
  }

  return {landAndSea};
}
