import {MODEL_TYPES} from './model-types.js';
import {KEYNLOCK_FIXED_BRIDGES} from './keynlock-fixed-bridges.js';

const GROUND_SLIDERS=[['groundGrass','grass'],['groundSaturation','grassSaturation'],
  ['groundMoisture','moisture'],['groundWear','wear']];
const TERRAIN_TIPS={river:'Река: проведи русло по земле, удерживая ЛКМ. Ширина и глубина применятся к новой реке.',
  hill:'Возвышенность: нажми на землю, чтобы поднять плавный холм.',
  bridge:'Каменный мост: нажми на реку в месте переправы.',
  erase:'Ластик: нажми на дерево, мост, холм или реку для удаления.',
  'tree-oak':'Зелёный дуб: выбери место на земле и нажми, чтобы посадить.',
  'tree-linden':'Жёлтая липа: выбери место на земле и нажми, чтобы посадить.',
  'tree-maple':'Красный клён: выбери место на земле и нажми, чтобы посадить.'};

// Translates DOM events and renders state; map data stays in the controller.
export function createEditorView(root=document){
  const $=id=>root.getElementById(id);
  const typeButtons=[...root.querySelectorAll('[data-place]')];
  const terrainButtons=[...root.querySelectorAll('[data-terrain]')];
  const listeners=new AbortController();
  const clock=root.defaultView;
  let toastTimer=0,workspaceFrame=0;
  const listen=(target,type,handler)=>target.addEventListener(type,handler,{signal:listeners.signal});
  const slider=id=>Number($(id).value);

  function ground(groundSettings){
    $('groundDistrict').value=groundSettings.district;
    for(const [id,key] of GROUND_SLIDERS){
      $(id).value=groundSettings[key];$(`${id}Value`).textContent=`${groundSettings[key]}%`;
    }
  }
  function toast(message){
    const el=$('toast');el.textContent=message;el.hidden=false;
    clock.clearTimeout(toastTimer);toastTimer=clock.setTimeout(()=>el.hidden=true,2300);
  }
  function tools(tool,terrainTool){
    for(const [buttons,key,value] of [[typeButtons,'place',tool],[terrainButtons,'terrain',terrainTool]]){
      for(const button of buttons){
        const active=button.dataset[key]===value;
        button.classList.toggle('selected',active);
        button.setAttribute('aria-pressed',String(active));
      }
    }
    $('modeText').textContent=terrainTool?TERRAIN_TIPS[terrainTool]:tool?
      `Размещение: ${MODEL_TYPES[tool].label}. Нажми на участок, чтобы поставить. Esc — выход.`:
      'Выбери здание или инструмент ландшафта';
  }
  function selection(item,record){
    const panel=$('selectionPanel');
    $('rotateButton').disabled=$('deleteButton').disabled=!item;
    if(!item){panel.innerHTML='<p>Нажми на здание, чтобы передвинуть, повернуть или удалить его.</p>';return;}
    const kind=MODEL_TYPES[item.type].kind==='landmark'?'Особое здание':'Обычное здание';
    const footprint=record?`${record.width.toFixed(1).replace('.',',')} × ${record.depth.toFixed(1).replace('.',',')} м`:'—';
    panel.innerHTML=`<b>${MODEL_TYPES[item.type].label}</b><small>${kind}<br>Пятно застройки: ${footprint}<br>Поворот: ${Math.round((item.rotation||0)*180/Math.PI)%360}°</small>`;
  }
  function stats({buildings,landscape,layout,status}){
    $('exportButton').disabled=status==='pending';
    $('buildingCount').textContent=buildings.length;
    $('landmarkCount').textContent=buildings.filter(b=>MODEL_TYPES[b.type].kind==='landmark').length;
    $('pathCount').textContent=layout?.paths.length||0;
    $('pathLength').textContent=`${Math.round(layout?.length||0)} м`;
    $('junctionCount').textContent=layout?.junctions||0;
    $('connectedCount').textContent=`${layout?.connected||0} / ${buildings.length}`;
    $('landscapeSummary').textContent=`Реки и протоки: на карте · Новых рек: ${landscape.rivers.length} · Холмов: ${landscape.hills.length} · Больших мостов: ${KEYNLOCK_FIXED_BRIDGES.length} · Новых мостов: ${landscape.bridges.length+landscape.channelBridges.length}`;
    $('treesSummary').textContent=`Деревьев: ${landscape.trees.length} · Дубов: ${landscape.trees.filter(t=>t.kind==='oak').length} · Лип: ${landscape.trees.filter(t=>t.kind==='linden').length} · Клёнов: ${landscape.trees.filter(t=>t.kind==='maple').length}`;
    const note=$('networkStatus');
    if(status==='pending')note.textContent='Перестраиваем дороги…';
    else if(status==='error')note.textContent='Не удалось перестроить дороги. Карту можно выгрузить без дорожек.';
    else if(buildings.length<2)note.textContent='Поставь ещё одно здание, чтобы соединить входы.';
    else if(layout?.connected===buildings.length)note.textContent='Все здания связаны пешеходными дорожками.';
    else note.textContent='Некоторые входы недоступны. Добавь мост или освободи пространство.';
  }
  function download(payload){
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=root.createElement('a');
    a.href=url;a.download='keynlock-pedestrian-layout.json';root.body.append(a);a.click();a.remove();
    clock.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function bind(editor){
    const houseFrame=$('cityHouseEditorFrame');
    let houseLoaded=false;
    const switchWorkspace=(tab)=>{
      const city=tab!=='house';
      $('cityWorkspace').hidden=!city;
      $('houseWorkspace').hidden=city;
      $('cityViewTab').classList.toggle('active',city);
      $('houseViewTab').classList.toggle('active',!city);
      $('cityViewTab').setAttribute('aria-selected',String(city));
      $('houseViewTab').setAttribute('aria-selected',String(!city));
      editor.setActive(city);
      if(!city&&!houseFrame.src)houseFrame.src=houseFrame.dataset.src;
      if(houseFrame.src&&houseLoaded)houseFrame.contentWindow?.postMessage({
        type:'keynlock:house-active',active:!city},clock.location.origin);
      if(workspaceFrame)clock.cancelAnimationFrame(workspaceFrame);
      if(city)workspaceFrame=clock.requestAnimationFrame(()=>{workspaceFrame=0;editor.setView('overview');});
    };
    listen($('cityViewTab'),'click',()=>switchWorkspace('city'));
    listen($('houseViewTab'),'click',()=>switchWorkspace('house'));
    listen(houseFrame,'load',()=>{
      houseLoaded=true;$('placeCustomHouse').disabled=false;
      houseFrame.contentWindow?.postMessage({type:'keynlock:house-active',
        active:!$('houseWorkspace').hidden},clock.location.origin);
    });
    listen($('placeCustomHouse'),'click',()=>{
      houseFrame.contentWindow?.postMessage({type:'keynlock:request-house'},clock.location.origin);
    });
    listen(clock,'message',event=>{
      if(event.origin!==clock.location.origin||event.source!==houseFrame.contentWindow||
        event.data?.type!=='keynlock:house-blueprint')return;
      switchWorkspace('city');
      editor.setHouseDraft(event.data.blueprint,event.data.atmosphere);
    });
    for(const button of typeButtons)listen(button,'click',()=>{
      editor.toggleBuildingTool(button.dataset.place);
    });
    for(const button of terrainButtons)listen(button,'click',()=>editor.setTerrainTool(button.dataset.terrain));
    for(const [id,out,unit] of [['riverWidth','riverWidthValue','м'],['riverDepth','riverDepthValue','м'],
      ['hillRadius','hillRadiusValue','м'],['hillHeight','hillHeightValue','м']]){
      listen($(id),'input',()=>$(out).textContent=`${$(id).value} ${unit}`);
    }
    for(const [id,handler] of [
      ['landscapeDemo',editor.loadLandscapeDemo],['landscapeClear',editor.clearLandscape],
      ['groveButton',editor.plantGrove],['treesClear',editor.clearTrees],
      ['rotateButton',editor.rotate],['deleteButton',editor.remove],['demoButton',editor.loadDemo],
      ['clearButton',editor.clearMap],['undoButton',editor.undo],['redoButton',editor.redo],
      ['exportButton',editor.download],
    ])listen($(id),'click',handler);
    listen($('pathsToggle'),'change',event=>editor.setPathsVisible(event.target.checked));
    listen($('pavingMode'),'change',event=>editor.setPaving(event.target.value));
    listen($('groundDistrict'),'change',event=>editor.setGroundDistrict(event.target.value));
    for(const [id,key] of GROUND_SLIDERS){
      let slideStarted=false;
      const update=event=>{
        $(`${id}Value`).textContent=`${event.target.value}%`;
        editor.setGroundValue(key,Number(event.target.value),{begin:!slideStarted});
        slideStarted=true;
      };
      listen($(id),'input',update);
      listen($(id),'change',event=>{update(event);slideStarted=false;});
    }
    listen($('gridToggle'),'change',e=>editor.setGridVisible(e.target.checked));
    root.querySelectorAll('[data-view]').forEach(button=>listen(button,'click',()=>{
      root.querySelectorAll('[data-view]').forEach(other=>other.classList.toggle('active',other===button));
      editor.setView(button.dataset.view);
    }));
    listen(root,'keydown',event=>{
      if(event.key==='Escape'){
        event.preventDefault();editor.exitTool();return;
      }
      const editing=/INPUT|TEXTAREA|SELECT/.test(root.activeElement?.tagName||'');
      if(editing)return;
      if((event.ctrlKey||event.metaKey)&&!event.altKey){
        if(event.code==='KeyZ'||event.code==='KeyY'){
          event.preventDefault();
          if(event.code==='KeyY'||event.shiftKey)editor.redo();else editor.undo();
          return;
        }
      }
      if((event.code==='KeyR'||event.code==='KeyК')&&editor.selected){event.preventDefault();editor.rotate();return;}
      if((event.code==='Delete'||event.code==='Backspace')&&editor.selected){event.preventDefault();editor.remove();return;}
    });
  }

  return {
    canvas:$('pathCanvas'),
    get pathsVisible(){return $('pathsToggle').checked;},
    getActiveTab:()=>$('houseWorkspace').hidden?'city':'house',
    brushSettings:()=>({riverWidth:slider('riverWidth'),riverDepth:slider('riverDepth'),
      hillRadius:slider('hillRadius'),hillHeight:slider('hillHeight')}),
    bind,ground,toast,tools,selection,stats,download,
    paving(mode){$('pavingMode').value=mode;},
    history(history){$('undoButton').disabled=!history.canUndo;$('redoButton').disabled=!history.canRedo;},
    metrics({fps,triangles,waterTriangles=0}){
      $('fpsValue').textContent=fps;
      $('trianglesValue').textContent=triangles?triangles.toLocaleString('ru-RU'):'2D';
      $('waterTrianglesValue').textContent=waterTriangles.toLocaleString('ru-RU');
    },
    setModeText(text){$('modeText').textContent=text;},
    showError(){$('stageError').hidden=false;$('modeText').textContent='3D-сцена недоступна';},
    dispose(){
      listeners.abort();
      clock.clearTimeout(toastTimer);
      if(workspaceFrame)clock.cancelAnimationFrame(workspaceFrame);
    },
  };
}
