// Physics integration for detached screws and the removable front plate.
// Rendering is handled by their existing Three.js meshes.
export function screwSupportHeight(rotation,scale=1){
  // The shaft spans [-.725, .08] along local Z after its 0.5 scale.
  // Its lowest point depends on how it rolled and tilted on the table.
  const vertical=Math.cos(rotation.x)*Math.cos(rotation.y);
  const radial=.11*Math.sqrt(Math.max(0,1-vertical*vertical));
  return (-Math.min(-.725*vertical,.08*vertical)+radial)*scale;
}

export function stepLooseScrews({screws,bodies,dt,onTray,trayContact,trayContacts=[trayContact],isDragging,
  tableSurfaceZ,traySurfaceZ,trayRimZ,screwScaleFactor=1,dropBounds=null,
  supportSurfaceAt=null}){
  for(const [index,body] of bodies){
    if(body.sleeping||isDragging(index))continue;
    const screw=screws[index];
    body.velocity.z-=5.4*dt;
    const previousX=screw.position.x,previousY=screw.position.y;
    screw.position.addScaledVector(body.velocity,dt);
    if(dropBounds){
      for(const axis of ['x','y']){
        const [min,max]=dropBounds[axis];
        if(screw.position[axis]<min||screw.position[axis]>max){
          screw.position[axis]=Math.max(min,Math.min(max,screw.position[axis]));
          body.velocity[axis]*=-.12;
        }
      }
    }
    if(!body.inTray&&onTray(screw.position.x,screw.position.y)){
      if(screw.position.z<trayRimZ){
        screw.position.x=previousX;screw.position.y=previousY;
        body.velocity.x*=-.28;body.velocity.y*=-.28;
      }else body.inTray=true;
    }
    if(body.inTray){
      const contact=trayContacts.reduce((nearest,item)=>
        Math.hypot(screw.position.x-item.bounds.x,screw.position.y-item.bounds.y)<
        Math.hypot(screw.position.x-nearest.bounds.x,screw.position.y-nearest.bounds.y)?
          item:nearest,trayContacts[0]).clamp(screw.position);
      if(screw.position.x!==contact.x){screw.position.x=contact.x;body.velocity.x*=-.18;}
      if(screw.position.y!==contact.y){screw.position.y=contact.y;body.velocity.y*=-.18;}
    }
    body.angle+=body.angularVelocity*dt;
    screw.rotation.x=body.angle;
    screw.rotation.y+=body.spin*dt;
    const surface=body.inTray?traySurfaceZ:
      (supportSurfaceAt?.(screw.position.x,screw.position.y,.10)??tableSurfaceZ);
    const floor=surface+screwSupportHeight(screw.rotation,screwScaleFactor);
    if(screw.position.z<=floor){
      screw.position.z=floor;
      if(Math.abs(body.velocity.z)>.14){
        body.velocity.z=-body.velocity.z*.27;body.angularVelocity*=.78;
      }else body.velocity.z=0;
      body.velocity.x*=Math.exp(-3.3*dt);
      body.velocity.y*=Math.exp(-3.3*dt);
      body.angularVelocity*=Math.exp(-2.9*dt);
      body.spin*=Math.exp(-3.7*dt);
      if(body.velocity.length()<.045&&Math.abs(body.angularVelocity)<.08){
        body.sleeping=true;body.velocity.set(0,0,0);
      }
    }
  }
}

export function stepLooseCover({cover,body,dt,onTray,isDragging,
  tableSurfaceZ,traySurfaceZ,coverScaleFactor=1,dropBounds=null,
  supportSurfaceAt=null}){
  if(!body||body.sleeping||isDragging('cover'))return;
  body.velocity.z-=3.5*dt;
  cover.position.addScaledVector(body.velocity,dt);
  if(dropBounds){
    for(const axis of ['x','y']){
      const [min,max]=dropBounds[axis];
      if(cover.position[axis]<min||cover.position[axis]>max){
        cover.position[axis]=Math.max(min,Math.min(max,cover.position[axis]));
        body.velocity[axis]*=-.12;
      }
    }
  }
  const floor=(onTray(cover.position.x,cover.position.y)?traySurfaceZ:
    (supportSurfaceAt?.(cover.position.x,cover.position.y,1.68*coverScaleFactor,
      1.23*coverScaleFactor)??tableSurfaceZ))-
    .685*coverScaleFactor+.024*coverScaleFactor;
  if(cover.position.z<=floor){
    cover.position.z=floor;body.velocity.z=0;
    body.velocity.x*=Math.exp(-5*dt);
    body.velocity.y*=Math.exp(-5*dt);
    if(body.velocity.length()<.06)body.sleeping=true;
  }
}
