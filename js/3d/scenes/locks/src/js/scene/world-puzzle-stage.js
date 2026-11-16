import { createWorldPuzzleArt } from './world-puzzle-art.js';
import { MUSEUM_SYMBOLS } from '../gameplay/world-puzzles/rules.js';

/** One Three.js stage, with four replaceable physical puzzle assemblies. */
export function createWorldPuzzleStage({THREE,RoundedBoxGeometry,document,scene,camera,controls,
  canvas,root,materials,dispatch}) {
  const group=new THREE.Group();
  group.position.set(-.62,-.03,.54);
  group.visible=false;
  scene.add(group);
  const raycaster=new THREE.Raycaster();
  const pointer=new THREE.Vector2();
  let art=null,layout=null,serial=-1,active=false,hover=-1,startPointer=null,cameraBefore=null;

  function resetAssembly() {
    while(group.children.length)group.remove(group.children[0]);
    art?.dispose();art=null;layout=null;serial=-1;hover=-1;
  }
  function buildWharf(view) {
    art.frame(group,'I · ПОРТОВЫЙ МЕХАНИЗМ');
    art.label(group,'ПРУЖИННЫЕ ЗАДВИЖКИ',0,1.07,.28,3.9,.27);
    const bolts=[];
    const gap=4.45/(view.count-1);
    for(let i=0;i<view.count;i++){
      const x=-2.225+i*gap;
      art.box(group,x,-.12,.24,Math.min(.42,gap*.67),2.1,.12,art.palette.slot,.08);
      const coil=art.spring(group,x,.46,.46,.105,.70);
      const shaft=art.box(group,x,-.49,.46,Math.min(.31,gap*.51),.77,.20,art.palette.steel,.06);
      const head=art.cylinder(group,x,-.86,.58,.11,.15,art.palette.brass);
      art.label(group,String(i+1),x,-1.13,.32,.30,.26,{color:'#b8a68c'});
      for(const part of [shaft,head,coil])part.userData.worldChoiceIndex=i;
      bolts.push({shaft,head,coil});
    }
    return {bolts};
  }
  function buildKeyprofile(view) {
    art.frame(group,'II · ОТПЕЧАТОК СКВАЖИНЫ');
    art.label(group,'СЛЕПОК ПРОФИЛЯ',0,1.04,.31,3.5,.25);
    art.box(group,0,.75,.27,4.15,.52,.13,art.palette.slot,.07);
    art.keyProfile(group,view.target,0,.80,.38,2.0,art.palette.shadow);
    art.label(group,'НАЙДИ ТОЧНЫЙ КЛЮЧ',0,.30,.26,3.25,.24,{color:'#baa47d'});
    const choices=[];
    for(let i=0;i<view.count;i++) {
      const x=-1.77+(i%3)*1.77,y=-.11-Math.floor(i/3)*.54;
      const button=art.interactivePlate(group,i,x,y,1.58,.44,String(i+1),{symbol:false});
      button.marking.position.x=-.63;button.marking.scale.setScalar(.65);
      const shape=art.keyProfile(button.group,view.options[i],.13,.09,.10,.90);
      shape.traverse(o=>{if(o.isMesh)o.userData.worldChoiceIndex=i;});
      choices.push(button);
    }
    return {choices};
  }
  function buildPaired(view) {
    art.frame(group,'III · ПАРНЫЕ УЗЛЫ');
    art.label(group,'ЗАПОМНИ СИМВОЛЫ И НАЙДИ ПАРЫ',0,1.06,.30,4.4,.27);
    const buttons=[];
    const rows=Math.ceil(view.count/4), step=.71;
    const top=(rows-1)*step/2;
    for(let i=0;i<view.count;i++){
      const x=-1.8+(i%4)*1.20,y=top-Math.floor(i/4)*step-.16;
      const button=art.interactivePlate(group,i,x,y,1.0,.62,view.nodes[i]);
      art.cylinder(button.group,-.41,.20,.09,.038,.035,art.palette.brass,10);
      button.marking.visible=false;
      buttons.push(button);
    }
    return {buttons};
  }
  function buildMuseum(view) {
    art.frame(group,'IV · МУЗЕЙНЫЙ ШИФР');
    art.label(group,'ТУМБЛЕРЫ',0,1.07,.3,2.8,.25);
    const tumblers=[];
    for(let i=0;i<view.count;i++) {
      const x=-(view.count-1)*.42+i*.84;
      art.box(group,x,.62,.23,.70,.65,.15,art.palette.slot,.05);
      const symbol=art.label(group,MUSEUM_SYMBOLS[view.targets[i]],x,.62,.37,.45,.42,{symbol:true});
      const mask=view.covered[i]?art.box(group,x+(view.covered[i]==='left' ? -.18 : .18),.62,.42,
        .36,.50,.06,art.palette.steel,.02):null;
      const marker=art.label(group,'✓',x,.62,.48,.43,.42,{symbol:true,color:'#b5e8c0'});
      marker.visible=false;
      tumblers.push({symbol,mask,marker});
    }
    art.label(group,'ВЫБЕРИ ФОРМУ ИНСТРУМЕНТА',0,.14,.27,4.4,.24,{color:'#b9a47d'});
    const buttons=[];
    for(let i=0;i<MUSEUM_SYMBOLS.length;i++) {
      const x=-2.25+(i%7)*.75,y=-.35-Math.floor(i/7)*.44;
      buttons.push(art.interactivePlate(group,i,x,y,.64,.37,MUSEUM_SYMBOLS[i]));
    }
    return {tumblers,buttons};
  }
  function rebuild(snapshot) {
    resetAssembly();
    art=createWorldPuzzleArt({THREE,RoundedBoxGeometry,document,materials});
    if(snapshot.id==='wharf')layout=buildWharf(snapshot.view);
    else if(snapshot.id==='keyprofile')layout=buildKeyprofile(snapshot.view);
    else if(snapshot.id==='pairednodes')layout=buildPaired(snapshot.view);
    else if(snapshot.id==='museum')layout=buildMuseum(snapshot.view);
    serial=snapshot.serial;
  }
  function updateButtons(buttons,activeIndices,newColor=0x6d7d7d) {
    for(let i=0;i<buttons.length;i++) {
      const button=buttons[i];
      button.material.color.setHex(activeIndices.includes(i) ? 0xc5a063 : newColor);
      button.material.emissive.setHex(activeIndices.includes(i) ? 0x463012 : 0x000000);
    }
  }
  function render(snapshot) {
    if(!snapshot.active)return;
    if(serial!==snapshot.serial)rebuild(snapshot);
    const view=snapshot.view;
    if(snapshot.id==='wharf') {
      for(let i=0;i<layout.bolts.length;i++) {
        const b=layout.bolts[i],opened=view.opened.includes(i);
        b.shaft.position.y=opened?-.11:-.49;
        b.head.position.y=opened?-.49:-.86;
        b.coil.scale.y=opened?.64:1;
        b.shaft.material=opened?art.palette.brass:art.palette.steel;
      }
    } else if(snapshot.id==='keyprofile') {
      updateButtons(layout.choices,[view.selected]);
    } else if(snapshot.id==='pairednodes') {
      for(let i=0;i<layout.buttons.length;i++) {
        const known=view.matched.includes(i),revealed=known||view.selected===i||view.pending.includes(i);
        layout.buttons[i].marking.visible=revealed;
        layout.buttons[i].material.color.setHex(known?0x8aa18a:revealed?0xc3a069:
          hover===i?0x768c8c:0x5b6e71);
        layout.buttons[i].material.emissive.setHex(known?0x1b3b26:0x0);
      }
    } else if(snapshot.id==='museum') {
      updateButtons(layout.buttons,[view.selected]);
      for(let i=0;i<layout.tumblers.length;i++) {
        const isDone=i<view.step,part=layout.tumblers[i];
        part.symbol.visible=!isDone;part.marker.visible=isDone;
        if(part.mask)part.mask.visible=!isDone;
      }
    }
  }
  function changeActive(snapshot) {
    const next=!!snapshot.active;
    if(next&&!active) {
      cameraBefore={position:camera.position.clone(),target:controls.target.clone(),
        minDistance:controls.minDistance,maxDistance:controls.maxDistance};
      root.visible=false;
      group.visible=true;
      controls.target.set(-.62,0,.30);
      camera.position.set(1.0,1.5,8.5);
      controls.minDistance=4.4;controls.maxDistance=12;
      controls.update();
      document.body.classList.add('world-puzzle-active');
    } else if(!next&&active) {
      root.visible=true;
      group.visible=false;
      resetAssembly();
      if(cameraBefore) {
        camera.position.copy(cameraBefore.position);controls.target.copy(cameraBefore.target);
        controls.minDistance=cameraBefore.minDistance;controls.maxDistance=cameraBefore.maxDistance;
        controls.update();
      }
      document.body.classList.remove('world-puzzle-active');
    }
    active=next;
    if(next)render(snapshot);
  }
  function choiceAt(event) {
    const rect=canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(group.children,true);
    for(const hit of hits) {
      let element=hit.object;
      while(element&&element!==group) {
        if(Number.isInteger(element.userData.worldChoiceIndex))return element.userData.worldChoiceIndex;
        element=element.parent;
      }
    }
    return -1;
  }
  canvas.addEventListener('pointerdown',event=>{
    if(active)startPointer={x:event.clientX,y:event.clientY};
  },true);
  canvas.addEventListener('pointerup',event=>{
    if(!active||!startPointer)return;
    const distance=Math.hypot(event.clientX-startPointer.x,event.clientY-startPointer.y);
    startPointer=null;
    if(distance>6)return;
    const index=choiceAt(event);
    if(index>=0)dispatch({type:'world-choice',index},{source:'scene'});
  },true);
  canvas.addEventListener('pointermove',event=>{
    if(!active)return;
    if(event.buttons!==0)return;
    const index=choiceAt(event);
    canvas.style.cursor=index>=0?'pointer':'grab';
    if(layout&&index!==hover) {
      hover=index;
      if(serial>=0&&lastSnapshot)render(lastSnapshot);
    }
  });
  canvas.addEventListener('pointerleave',()=>{
    startPointer=null;hover=-1;
    if(active&&lastSnapshot)render(lastSnapshot);
  });
  let lastSnapshot=null;
  function sync(snapshot){lastSnapshot=snapshot;changeActive(snapshot);}
  return {sync,dispose(){resetAssembly();scene.remove(group);}};
}
