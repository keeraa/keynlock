(function(){
  'use strict';

  function create(options){
    const {doc,requestFrame,shuffle,waveLiquid,setContinuousLiquidReaction,setSurface,makeKeyClickable,breakFlask,activeGameName}=options;
    const palette=[
      {name:'красный',hex:'#d46a5b'},{name:'золотой',hex:'#d2b25a'},
      {name:'зелёный',hex:'#69bf72'},{name:'синий',hex:'#5d86d6'},
      {name:'фиолетовый',hex:'#9271cd'}
    ];
    const heatStages=[
      {name:'синий',pos:0,rgb:[93,134,214]},
      {name:'фиолетовый',pos:.2,rgb:[146,113,205]},
      {name:'красный',pos:.4,rgb:[212,106,91]},
      {name:'зелёный',pos:.6,rgb:[105,191,114]},
      {name:'золотой',pos:.8,rgb:[210,178,90]},
      {name:'синий',pos:1,rgb:[93,134,214]}
    ];
    const columns=doc.getElementById('columns'),elements=[];
    let levels=[],directions=[],speeds=[],locked=[],last=performance.now(),heatPositions=[],heating=[],targets=[],zoneCenters=[],zoneHalf=11;
    const hexToRgb=hex=>{const value=hex.replace('#','');return [parseInt(value.slice(0,2),16),parseInt(value.slice(2,4),16),parseInt(value.slice(4,6),16)]};
    const rgbToHex=rgb=>'#'+rgb.map(value=>Math.max(0,Math.min(255,Math.round(value))).toString(16).padStart(2,'0')).join('');
    const hexToRgba=(hex,alpha=.2)=>{const rgb=hexToRgb(hex);return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`};
    const mixRgb=(a,b,t)=>[0,1,2].map(index=>a[index]+(b[index]-a[index])*t);
    const saturate=(rgb,k=1.28)=>{const average=(rgb[0]+rgb[1]+rgb[2])/3;return rgb.map(value=>Math.max(0,Math.min(255,average+(value-average)*k)))};
    const darken=(rgb,k=.12)=>rgb.map(value=>Math.max(0,value*(1-k)));
    const lighten=(rgb,k=.18)=>rgb.map(value=>value+(255-value)*k);
    function stageData(position){
      const normalized=((position%1)+1)%1;
      let best=heatStages[0],distance=Infinity;
      heatStages.slice(0,5).forEach((stage,index)=>{
        const raw=Math.abs(stage.pos-normalized),next=Math.min(raw,1-raw);
        if(next<distance){distance=next;best={...stage,index,distance:next};}
      });
      return best;
    }
    const targetPosition=index=>heatStages[Math.max(0,Math.min(4,index))]?.pos||0;
    function colorData(index){
      const position=((heatPositions[index]%1)+1)%1;
      let base=0;
      for(let i=0;i<heatStages.length-1;i++)if(position>=heatStages[i].pos&&position<=heatStages[i+1].pos){base=i;break;}
      const from=heatStages[base],to=heatStages[base+1],span=Math.max(.0001,to.pos-from.pos);
      const rgb=mixRgb(from.rgb,to.rgb,Math.max(0,Math.min(1,(position-from.pos)/span))),nearest=stageData(position);
      return {rgb,nearest:palette.findIndex(item=>item.name===nearest.name),closeness:nearest.distance};
    }
    function toggleHeat(index,on){
      if(locked[index])return;
      heating[index]=on==null?!heating[index]:!!on;
      elements[index]?.heatBtn.classList.toggle('active',heating[index]);
      if(heating[index]){waveLiquid(elements[index]?.vapor,.9);setContinuousLiquidReaction(elements[index]?.vapor,true);}
      else setContinuousLiquidReaction(elements[index]?.vapor,false);
    }
    const zone=index=>({min:zoneCenters[index]-zoneHalf,max:zoneCenters[index]+zoneHalf});
    const inZone=(value,index)=>{const target=zone(index);return value>=target.min&&value<=target.max;};
    const success=index=>{const color=colorData(index);return inZone(levels[index],index)&&color.nearest===targets[index]&&color.closeness<=.055;};
    function capture(index){
      if(locked[index])return;
      waveLiquid(elements[index]?.vapor,1.2);
      if(success(index)){locked[index]=true;toggleHeat(index,false);render();return;}
      breakFlask('Нужны одновременно верная зона и нужный оттенок после нагрева');
      const column=elements[index].column;column.classList.remove('miss');void column.offsetWidth;column.classList.add('miss');
    }
    function reset(){
      levels=[16,34,61,76,88].map(value=>Math.max(8,Math.min(92,value+(Math.random()*12-6))));
      directions=[1,-1,1,-1,1];speeds=[17,21,15,19,16].map(value=>value+(Math.random()*4-2));heating=[false,false,false,false,false];
      targets=shuffle([0,1,2,3,4]);heatPositions=targets.map(index=>(targetPosition(index)+(Math.random()*.016-.008)+1)%1);
      zoneCenters=[18,32,48,64,80].map(value=>Math.max(14,Math.min(86,value+(Math.random()*6-3))));locked=[false,false,false,false,false];last=performance.now();
      columns.innerHTML='';elements.length=0;
      for(let index=0;index<5;index++){
        const target=palette[targets[index]],box=document.createElement('div');box.className='columnbox';
        box.innerHTML=`<div class="distill-target-chip" title="${target.name}" style="background:${target.hex}"></div><div class="distill-target-name"></div><div class="test-tube tube-lg distill-flask-v76"><div class="vapor distill-liquid-v76"></div><div class="distill-zone-layer-v76"><div class="distill-zone-band-v76"></div></div></div><div class="distill-controls"><button class="distill-ctrl-btn distill-heat-btn" type="button" aria-label="Нагрев пробирки ${index+1}"><i class="ti ti-flame"></i></button><button class="distill-ctrl-btn distill-fix-btn" type="button" aria-label="Зафиксировать цвет пробирки ${index+1}"><i class="ti ti-circle-check"></i></button></div><div class="capture-key">клавиша ${index+1}</div>`;
        const column=box.querySelector('.distill-flask-v76'),heatBtn=box.querySelector('.distill-heat-btn'),fixBtn=box.querySelector('.distill-fix-btn'),center=zoneCenters[index];
        column.style.setProperty('--zone-top',`${Math.max(8,center-zoneHalf)}%`);column.style.setProperty('--zone-height',`${zoneHalf*2}%`);column.style.setProperty('--zone-fill',hexToRgba(target.hex,.15));column.style.setProperty('--zone-line',hexToRgba(target.hex,.72));
        column.onclick=()=>capture(index);makeKeyClickable(column,()=>capture(index));heatBtn.onclick=()=>toggleHeat(index);fixBtn.onclick=()=>capture(index);
        elements.push({column,vapor:box.querySelector('.vapor'),targetChip:box.querySelector('.distill-target-chip'),targetName:box.querySelector('.distill-target-name'),heatBtn});columns.appendChild(box);
      }
      render();
    }
    function render(now=performance.now()){
      const bodyTop=29,bodyHeight=62;
      levels.forEach((value,index)=>{
        const item=elements[index];if(!item)return;
        const live=colorData(index),target=palette[targets[index]],data=heating[index]?live:{rgb:hexToRgb(target.hex),nearest:targets[index],closeness:0};
        const vivid=saturate(data.rgb,1.34),liquidTop=bodyTop+(value/100)*bodyHeight;
        item.vapor.style.height='100%';item.vapor.style.setProperty('--liquid-top',`${liquidTop}%`);setSurface(item.vapor,liquidTop,now,index,!!heating[index]);
        item.vapor.style.background=`linear-gradient(180deg, ${rgbToHex(lighten(vivid,.26))} 0%, ${rgbToHex(vivid)} 34%, ${rgbToHex(vivid)} 72%, ${rgbToHex(darken(vivid,.08))} 100%)`;
        const targetZone=zone(index);item.column.style.setProperty('--zone-top-visual',`${bodyTop+(Math.max(0,targetZone.min)/100)*bodyHeight}%`);item.column.style.setProperty('--zone-height-visual',`${(Math.max(0,targetZone.max-targetZone.min)/100)*bodyHeight}%`);
        item.column.style.setProperty('--zone-fill',hexToRgba(target.hex,.16));item.column.style.setProperty('--zone-line',hexToRgba(target.hex,.78));item.column.classList.toggle('good',inZone(value,index));item.column.classList.toggle('locked',locked[index]);item.heatBtn.classList.toggle('active',!!heating[index]);
        item.targetChip.style.boxShadow=(data.nearest===targets[index]&&data.closeness<=.055)?'0 0 0 1px rgba(255,255,255,.24) inset,0 0 12px rgba(255,255,255,.18)':'0 0 0 1px rgba(0,0,0,.18) inset,0 0 10px rgba(255,255,255,.05)';
        item.targetName.className='distill-target-name '+(success(index)||locked[index]?'distill-ok':'');
      });
      const complete=locked.filter(Boolean).length;doc.getElementById('distillStatus').innerHTML=`<strong>${complete} / 5</strong>${complete===5?'цветов поймано':'цветов зафиксировано'}`;
    }
    function loop(now){
      const delta=Math.min(.05,(now-last)/1000);last=now;
      if(activeGameName()==='Перегонка'){
        for(let index=0;index<5;index++){if(locked[index])continue;levels[index]+=directions[index]*speeds[index]*delta;if(heating[index])heatPositions[index]=(heatPositions[index]+delta*.20)%1;if(levels[index]>=92){levels[index]=92;directions[index]=-1;}else if(levels[index]<=8){levels[index]=8;directions[index]=1;}}
        render(now);
      }
      requestFrame(loop);
    }
    reset();requestFrame(loop);
    return Object.freeze({capture,toggleHeat,reset});
  }

  window.KeynlockAlchemyDistillation=Object.freeze({create});
})();
