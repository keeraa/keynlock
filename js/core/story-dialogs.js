(function(){
  'use strict';
  const dialog=document.createElement('dialog');
  dialog.id='storyDialog';
  dialog.className='storyDialog';
  dialog.setAttribute('aria-labelledby','storyTitle');
  dialog.setAttribute('aria-describedby','storyText');
  dialog.innerHTML='<div class="storyPortrait"><img src="assets/characters/portraits/sai.png" alt="Сай"></div><div class="storyContent"><div id="storyLabel"></div><h2 id="storyTitle"></h2><p id="storyText" aria-live="polite"></p><div class="storyActions uiActions"><button id="storyCancel" class="uiButton" type="button"></button><button id="storyNext" class="uiButton uiButton--gold" type="button"></button></div></div>';
  document.body.append(dialog);
  const title=dialog.querySelector('h2'),text=dialog.querySelector('p'),label=dialog.querySelector('#storyLabel');
  const cancel=dialog.querySelector('#storyCancel'),next=dialog.querySelector('#storyNext');
  let settle=null,previousFocus=null;
  function close(value){
    const callback=settle;settle=null;
    dialog.close();document.body.classList.remove('game-dialog-open');
    previousFocus?.focus?.();
    callback?.(value);
  }
  function show(){
    previousFocus=document.activeElement;
    document.body.classList.add('game-dialog-open');dialog.showModal();
  }
  window.addEventListener('keydown',event=>{
    if(!dialog.open)return;
    event.stopImmediatePropagation();
    if(event.key==='Escape'){event.preventDefault();if(!dialog.classList.contains('storyIntro'))close(false);}
  },true);
  dialog.addEventListener('cancel',event=>{event.preventDefault();if(!dialog.classList.contains('storyIntro'))close(false);});
  window.KeynlockDialogs={
    confirm(heading,message,action='Начать заново'){
      if(dialog.open)return Promise.resolve(false);
      dialog.classList.remove('storyIntro');
      label.textContent='KEYNLOCK · НОВАЯ СТРАНИЦА';title.textContent=heading;text.textContent=message;
      cancel.textContent='Отмена';next.textContent=action;
      cancel.onclick=()=>close(false);next.onclick=()=>close(true);
      return new Promise(resolve=>{settle=resolve;show();cancel.focus();});
    },
    intro(done){
      const store=window.KeynlockSaveStore;
      const saved=store.getJSON('keynlockIntro',{});
      if(saved.done){done();return;}
      if(dialog.open)return;
      const lines=[
        'Я вернулась в город, где выросла. Здесь по-прежнему умеют назначать искусству цену. Беречь его умеют далеко не все.',
        'Раньше я восстанавливала то, что приносили в мою мастерскую. Теперь иногда приходится самой забирать то, что ещё можно спасти.',
        'В лаках и красках я разбираюсь лучше, чем в замках. С механизмами поможет Тик. Кай знает, как попасть внутрь, — и непременно спросит, сколько на этом заработает.',
        'Начну с набережной. Инструменты уже со мной. Изучу заказ — и за дело.'
      ];
      let page=Math.min(lines.length-1,Math.max(0,Number(saved.page)||0));
      function render(){label.textContent=`САЙ · РЕСТАВРАТОР   /   ${page+1} ИЗ ${lines.length}`;text.textContent=lines[page];next.textContent=page===lines.length-1?'Открыть заказы':'Далее';store.setJSON('keynlockIntro',{page,done:false});}
      function finish(){store.setJSON('keynlockIntro',{done:true});close(true);done();}
      dialog.classList.add('storyIntro');title.textContent='Искусство стоит спасти';cancel.textContent='Пропустить';cancel.onclick=finish;
      next.onclick=()=>{if(page===lines.length-1)finish();else{page++;render();}};
      render();show();next.focus();
    }
  };
})();
