(function(){
  'use strict';
  const store=window.KeynlockSaveStore;
  const gameKey=key=>/^(keynlock|lockpick)/.test(key);
  const notice=document.querySelector('#saveFailureNotice');
  const status=document.querySelector('#saveBackupStatus');
  function showStatus(message){status.textContent=message;}
  function update(){
    notice.hidden=store.persistent;
    document.querySelectorAll('[data-save-slot-status]').forEach(el=>{
      el.textContent=store.persistent?'':'Слоты временные: скачай копию перед закрытием игры.';
      el.hidden=store.persistent;
    });
  }
  function download(){
    const payload={format:'keynlock-backup',version:1,createdAt:new Date().toISOString(),state:store.snapshot(gameKey)};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`keynlock-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    showStatus('Копия подготовлена. Сохрани скачанный файл: его можно загрузить здесь в настройках.');
  }
  document.querySelectorAll('[data-save-backup]').forEach(button=>button.addEventListener('click',download));
  document.querySelector('#saveRetry').addEventListener('click',()=>{
    const ok=store.retry();
    document.querySelector('#saveFailureText').textContent=ok?'Сохранение восстановлено.':'Не удалось записать прогресс. Скачай копию перед закрытием игры.';
    update();
  });
  const input=document.querySelector('#saveBackupFile');
  document.querySelector('#saveBackupImport').addEventListener('click',()=>input.click());
  input.addEventListener('change',async()=>{
    const file=input.files[0];input.value='';if(!file)return;
    try{
      if(file.size>10*1024*1024)throw new Error('Слишком большой файл сохранения.');
      const payload=JSON.parse(await file.text());
      const values=payload?.state;
      if(payload?.format!=='keynlock-backup'||payload.version!==1||!values||Array.isArray(values)||typeof values!=='object'||!Object.keys(values).length||Object.entries(values).some(([key,value])=>!gameKey(key)||typeof value!=='string'))throw new Error('Это не резервная копия KEYNLOCK поддерживаемой версии.');
      if(!store.retry()){showStatus('Хранилище недоступно. Разреши сохранение данных для сайта и повтори загрузку копии.');return;}
      if(!await window.KeynlockDialogs.confirm('Загрузить резервную копию?','Текущий прогресс и слоты будут заменены данными из файла.','Загрузить'))return;
      const before=store.snapshot(gameKey);
      if(!store.restore(values,{clear:gameKey})){
        // Keep the current session in memory if a larger imported save exceeds quota.
        store.restore(before,{clear:gameKey});
        showStatus('Копию не удалось записать. Текущий прогресс оставлен в этой вкладке; скачай его перед закрытием.');return;
      }
      location.reload();
    }catch(error){showStatus(error instanceof SyntaxError?'Файл повреждён или не является JSON-сохранением.':error.message);}
  });
  window.addEventListener('keynlock-storage-change',update);
  window.addEventListener('beforeunload',event=>{
    if(store.persistent)return;
    event.preventDefault();event.returnValue='';
  });
  update();
})();
