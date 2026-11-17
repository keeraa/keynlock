import {CODE_LENGTH,loadCodeLock,saveCodeLock,newCodeLock,
  moveCodeWheel,testCodeLock} from './code-lock-logic.js';
import {createCodeBoxScene} from './code-box-scene.js';

export function createCodeLockUI({canvas,$,toast,isActive}){
  let state=loadCodeLock();
  let scene=null,selectedWheel=0,webglUnavailable=false;
  const grid=$('codeWheelGrid'),fallbackGrid=$('codeFallbackDigits');
  const displays=[],fallbackDisplays=[];
  function makeWheel(index,{fallback=false}={}){
    const field=document.createElement('div');
    field.className=fallback?'code-fallback-wheel':'code-wheel';
    const arrow=(delta)=>{
      const button=document.createElement('button');button.type='button';
      button.textContent=fallback?(delta>0?'▲':'▼'):(delta>0?'⌃':'⌄');
      button.dataset.wheel=String(index);button.dataset.delta=String(delta);
      const action=delta>0?'увеличить':'уменьшить';
      button.setAttribute('aria-label',`${fallback?'На шкатулке: '+action:action[0].toUpperCase()+action.slice(1)} цифру ${index+1}`);
      return button;
    };
    const up=arrow(1),down=arrow(-1);
    const digit=document.createElement('output');
    digit.className=fallback?'code-fallback-digit':'code-wheel-digit';
    if(!fallback)digit.setAttribute('aria-label',`Цифра ${index+1}`);
    field.append(up,digit,down);
    return {field,up,down,digit};
  }
  for(let index=0;index<CODE_LENGTH;index++){
    const wheel=makeWheel(index),fallback=makeWheel(index,{fallback:true});
    grid.append(wheel.field);fallbackGrid.append(fallback.field);
    displays.push(wheel);fallbackDisplays.push(fallback);
  }
  function render(){
    displays.forEach(({field,up,down,digit},index)=>{
      digit.textContent=String(state.digits[index]);
      field.classList.toggle('selected',selectedWheel===index);
      up.disabled=down.disabled=state.opened;
    });
    $('codeTarget').textContent=state.secret.split('').join(' ');
    fallbackDisplays.forEach(({up,down,digit},index)=>{
      digit.textContent=String(state.digits[index]);
      up.disabled=down.disabled=state.opened;
    });
    $('codeFallbackCasket').classList.toggle('opened',state.opened);
    $('codeAttemptCount').textContent=String(state.attempts);
    $('codeMatchedCount').textContent=state.matched==null?'—':`${state.matched} / 6`;
    $('codeTry').disabled=state.opened;
    const text=state.opened?
      'Шкатулка открыта. На внутренней подкладке лежит простой прямоугольник.':
      state.matched!=null?
        `Совпало ${state.matched} из 6 цифр на своих местах. Сверьтесь с кодом выше.`:
        'Выставьте показанный выше код. На шкатулке у каждой цифры есть стрелки ↑ ↓.';
    const note=$('codeFeedback');note.textContent=text;
    note.classList.toggle('good',state.opened);
    note.classList.remove('bad');
    $('codeStatus').textContent=state.opened?'ОТКРЫТО':'ЗАПЕРТО';
    $('codeStatus').classList.toggle('unlocked',state.opened);
  }
  function rotate(index,delta){
    selectedWheel=index;
    if(moveCodeWheel(state,index,delta)){
      scene?.setDigits(state.digits);
      saveCodeLock(state);
    }
    render();
  }
  function test(){
    const result=testCodeLock(state);saveCodeLock(state);
    if(result.opened){
      scene?.setOpened(true);
      toast('Шесть цифр совпали. Крышка шкатулки открывается.');
    }else toast(`Совпало ${result.matched} из 6 цифр.`);
    render();
  }
  const onWheelClick=event=>{
    const button=event.target.closest('button[data-wheel]');
    if(button)rotate(Number(button.dataset.wheel),Number(button.dataset.delta));
  };
  const onNew=()=>{
    state=newCodeLock();saveCodeLock(state);
    scene?.setDigits(state.digits);scene?.setOpened(false);
    render();toast('Новый шестизначный код установлен.');
  };
  const onKey=event=>{
    if(!isActive()||event.altKey||event.ctrlKey||event.metaKey||
      /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName||''))return;
    if(/^Digit[1-6]$/.test(event.code))selectedWheel=Number(event.code.slice(-1))-1;
    else if(event.code==='ArrowUp'||event.code==='ArrowDown'){
      event.preventDefault();rotate(selectedWheel,event.code==='ArrowUp'?1:-1);return;
    }else if(event.code==='Enter'){
      event.preventDefault();if(!state.opened)test();return;
    }else return;
    render();
  };
  grid.addEventListener('click',onWheelClick);
  fallbackGrid.addEventListener('click',onWheelClick);
  $('codeTry').addEventListener('click',test);
  $('codeNew').addEventListener('click',onNew);
  window.addEventListener('keydown',onKey);
  render();
  return {
    open(){
      if(!scene&&!webglUnavailable){
        try{
          scene=createCodeBoxScene(canvas,{onWheel:(index,delta)=>rotate(index,delta)});
          scene.setDigits(state.digits);scene.setOpened(state.opened,{instant:true});
        }catch(error){
          console.warn('3D-шкатулка: WebGL недоступен, используется графический режим.',error);
          webglUnavailable=true;
        }
      }
      canvas.hidden=webglUnavailable;
      $('codeFallback').hidden=!webglUnavailable;
      scene?.open();render();
    },
    close(){scene?.close();},
    dispose(){
      scene?.dispose();
      grid.removeEventListener('click',onWheelClick);
      fallbackGrid.removeEventListener('click',onWheelClick);
      $('codeTry').removeEventListener('click',test);
      $('codeNew').removeEventListener('click',onNew);
      window.removeEventListener('keydown',onKey);
    }
  };
}
