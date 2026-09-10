/* Safe practice uses its own answers; it never changes a live puzzle or resources. */
(() => {
  'use strict';
  const lessons={
    wharf:[['Задвижки','Сай: «Порядок скрыт. Запоминай удачные нажатия; ошибка сбрасывает цепочку. В первом заказе одна отмычка сломается по ходу обучения. Следи за шумом: заполненная шкала зовёт стражу. Когда прилетит птица, посмотри вверх или удерживай на ней указатель, пока она не улетит».','Первая задвижка поднялась, вторая сбросила цепочку. Как продолжить?',['Повторить удачную первую и попробовать другую','Нажимать вторую снова'],0]],
    keyprofile:[['Подбор ключа','Тик: «Сравни каждый выступ ключа с выемкой. Выбор безопасен; проверка скобами вставит ключ. Несовпадение сломает одну отмычку. На раунд — 30 секунд».','В выемке слева квадратный паз, справа треугольный. Какой ключ выбрать?',['Слева квадратный зубец, справа треугольный','Слева треугольный, справа квадратный'],0]],
    pairednodes:[['Парные узлы','Тик: «Наведи указатель, чтобы увидеть символ. На сенсорном экране удерживай узел. Найди четыре пары за 75 секунд; ошибка не тратит отмычки».','Первый узел — ◈. Какой открыть вторым?',['Ψ','◈','⊙'],1]],
    museum:[['Профили','Тик: «Выбирай форму текущего тумблера. Здесь нет таймера и расхода отмычек — можно спокойно сравнивать».','Текущий профиль — △. Выбери совпадение.',['◇','○','△'],2]],
    classic:[['Натяжитель','Тик: «Форма конца пластин подсказывает тип натяжителя. Выбери его в инвентаре до открытия скоб. Неверный инструмент ломает отмычку даже при выставленных штифтах».','Учебный замок требует Hook. Что возьмёшь?',['Bar','Hook','Wave'],1],['Связанные штифты','Тик: «Левая половина пластины сдвигает штифт влево, правая — вправо. Могут двигаться и соседние штифты. Выстрой все по центральной линии».','Сдвиг одной пластины изменил соседнюю. Что делать?',['Учесть связь при следующем движении','Сразу проверять скобы'],0],['Шум','Сай: «Шум накапливается от движений и ошибок. Если шкала заполнилась — приходит стража. Между действиями он стихает; у красной зоны лучше остановиться».','Шкала почти заполнена. Что безопаснее?',['Быстро сделать ещё несколько движений','Подождать, пока шум уменьшится'],1]],
    sequence:[['Кодовый замок','Тик: «Целевые позиции указаны сверху. Выстави каждый штифт по коду, затем проверь натяжитель и открой скобы. Следи за шумом».','Первый штифт на позиции 3, код требует 5. Куда его двигать?',['Вправо на два шага','Влево на два шага'],0]],
    special:[['Цепной механизм','Тик: «Здесь движение передаётся соседним штифтам. Следи за всей цепочкой; цель — общая центральная линия. Натяжитель и шум по-прежнему важны».','Один штифт встал на место, соседний сместился. Замок готов?',['Нет, нужно выровнять всю цепочку','Да, можно открыть'],0]],
    pipeline:[['Трубопровод','Тик: «Первый клик раскрывает клетку, следующие поворачивают трубу. За 45 секунд соедини левый вход с правым выходом, обходя аварийные клетки. Ошибка потока сразу завершает попытку и ломает все отмычки, взятые на заказ».','Труба уже раскрыта, но смотрит не туда. Что делать?',['Нажать её ещё раз, чтобы повернуть','Оставить — поток сам её повернёт'],0]],
    timingneedle:[['Остановка иглы','Тик: «Останавливай иглу в зелёной зоне. Нужно пройти пять этапов. Белая и красная зоны опасны для инструмента; красная может сбросить этапы. Не торопись: общего таймера здесь нет».','Когда нажимать остановку?',['На красном участке','Внутри зелёного участка','Между цветными участками'],1]],
    composite:[['Составная отмычка','Тик: «Сравни четыре участка целевого профиля со своей отмычкой. Первый клик выбирает участок, следующие меняют его высоту. Когда совпадут все четыре — открывай замок».','Совпали три участка из четырёх. Что дальше?',['Открыть скобы','Настроить оставшийся участок'],1]]
  };
  const store=window.KeynlockSaveStore,seen=store.getJSON('keynlockMechanicsLessons',{});
  const dialog=document.createElement('dialog');dialog.className='storyDialog missionLesson';dialog.setAttribute('aria-labelledby','missionLessonTitle');
  dialog.innerHTML='<div class="storyContent"><small id="missionLessonCount"></small><h2 id="missionLessonTitle"></h2><p id="missionLessonText"></p><fieldset><legend id="missionLessonQuestion"></legend><div id="missionLessonChoices" class="uiActions"></div></fieldset><p id="missionLessonFeedback" role="status"></p><label class="tutorialPreference"><input type="checkbox" data-hide-hints> Не показывать подсказки</label><div class="uiActions"><button id="missionLessonClose" class="uiButton" type="button">Закрыть</button><button id="missionLessonNext" class="uiButton uiButton--gold" type="button">Далее</button></div></div>';
  document.body.append(dialog);
  const help=document.createElement('button');help.id='missionLessonHelp';help.className='uiButton hudHelpButton';help.textContent='?';help.setAttribute('aria-label','Объяснение механики');document.body.append(help);help.hidden=true;
  const el=id=>dialog.querySelector('#missionLesson'+id);
  let current=null,page=0,answered=false,returnFocus=null;
  function render(){
    dialog.querySelector('[data-hide-hints]').checked=!window.KeynlockTutorialPreferences.hints;
    const row=lessons[current][page];answered=false;
    el('Count').textContent=`БЕЗОПАСНАЯ ПРОБА · ${page+1} / ${lessons[current].length}`;
    el('Title').textContent=row[0];
    const requirement=['classic','sequence','special'].includes(current)?window.getKeynlockTensionRequirement?.():null;
    el('Text').textContent=row[1]+(requirement?.type?` В текущем замке нужен натяжитель ${requirement.label}.`:'');
    if(current==='pipeline'&&!window.KeynlockCampaign.balance(current))el('Text').textContent=el('Text').textContent.replace('45 секунд','22 секунды');
    el('Question').textContent=row[2];
    el('Feedback').textContent='Эта проба не расходует инструменты. Раунд на паузе.';
    el('Next').disabled=true;el('Next').textContent=page===lessons[current].length-1?'К заказу':'Далее';
    el('Choices').replaceChildren(...row[3].map((label,i)=>{
      const b=document.createElement('button');b.type='button';b.className='uiButton';b.textContent=label;
      b.onclick=()=>{answered=i===row[4];el('Next').disabled=!answered;el('Feedback').textContent=answered?'Верно. Можно продолжать.':'Попробуй ещё раз. Отмычки не потрачены.';};return b;
    }));
  }
  function open(){
    if(!current||dialog.open)return;page=0;returnFocus=document.activeElement;render();document.body.classList.add('game-dialog-open');dialog.showModal();
  }
  function close(){dialog.close();document.body.classList.remove('game-dialog-open');if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}
  el('Close').onclick=close;
  window.KeynlockMissionLessons={hint:mode=>lessons[mode]?.map(row=>row[1]).join(' ')};
  el('Next').onclick=()=>{if(!answered)return;if(++page<lessons[current].length){render();return;}seen[current]=true;store.setJSON('keynlockMechanicsLessons',seen);close();};
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  window.addEventListener('keydown',event=>{if(!dialog.open)return;event.stopImmediatePropagation();if(event.key==='Escape'){event.preventDefault();close();}},true);
  window.addEventListener('keynlock-tutorial-preferences',()=>{if(dialog.open&&(!window.KeynlockTutorialPreferences.enabled||!window.KeynlockTutorialPreferences.hints))close();});
  help.onclick=open;
  window.addEventListener('keynlock-mission-started',event=>{
    if(dialog.open)close();
    current=event.detail.tier===1&&lessons[event.detail.mode]?event.detail.mode:null;
    help.hidden=!current;
    const button=document.getElementById('campaignButton');help.style.left=`${button.offsetLeft+button.offsetWidth+8}px`;
    if(current&&!seen[current]&&window.KeynlockTutorialPreferences.enabled&&window.KeynlockTutorialPreferences.hints)open();
  });
})();
