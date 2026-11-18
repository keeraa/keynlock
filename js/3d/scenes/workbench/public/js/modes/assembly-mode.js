// The previous flat assembly inventory has been retired. This mode now exposes
// only the lock's real removable hardware and tools; new installable parts
// will be introduced together with their physical bodies.
export function createAssemblyMode({scene,$,listen,toast}){
  const getDescription=()=>
    'Очистите крышку, выкрутите винты кликами, затем перетащите крышку и детали на свободное место стола.';
  let lastInstruction='';
  function selectPart(hit){
    const info=scene.getAssemblyPartInfo?.(hit);
    $('assemblySelected').hidden=!info;
    if(!info)return;
    $('assemblyPartName').textContent=info.name;
    $('assemblyPartHint').textContent=info.description||'';
  }
  function renderAssembly(){
    const guide=scene.getAssemblyGuidance?.();
    if(!guide)return;
    const signature=`${guide.title}|${guide.detail}`;
    if(signature===lastInstruction)return;
    lastInstruction=signature;
    $('assemblyGuideTitle').textContent=guide.title;
    $('assemblyGuideDetail').textContent=guide.detail;
    $('assemblyFeedback').textContent=`${guide.title}. ${guide.detail}`;
  }

  listen($('resetAssembly'),'click',()=>{
    scene.resetScrews?.();
    selectPart(null);
    lastInstruction='';renderAssembly();
    toast('Крышка, винты и все внутренние детали возвращены на свои места.');
  });

  return {getDescription,renderAssembly,selectPart};
}
