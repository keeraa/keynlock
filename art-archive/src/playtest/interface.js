import {getLanguage} from '../localization/i18n.js';
export function mountPlaytestInterface({collector,elements,setMode}){
 const en=getLanguage()==='en',text=(ru,english)=>en?english:ru;
 const notice=document.createElement('label');notice.className='playtest-notice';
 const consent=document.createElement('input');consent.type='checkbox';consent.checked=collector.enabled;
 notice.append(consent,document.createTextNode(text('Отправлять анонимные данные плейтеста: игровые действия, этапы обучения и технические ошибки. Без имени и почты.','Send anonymous playtest data: game actions, tutorial progress and technical errors. No name or email.')));
 elements('intro').querySelector('.panel').insertBefore(notice,elements('start-btn'));
 const setting=notice.cloneNode(true),pauseConsent=setting.querySelector('input');elements('pause').querySelector('.panel').append(setting);
 const change=e=>{collector.setEnabled(e.target.checked);consent.checked=pauseConsent.checked=collector.enabled;};
 consent.addEventListener('change',change);pauseConsent.addEventListener('change',change);
 const button=document.createElement('button');button.id='playtest-feedback-open';button.textContent=text('Завершить плейтест и оставить отзыв','Finish playtest and leave feedback');
 elements('pause').querySelector('.panel').append(button);
 const dialog=document.createElement('dialog');dialog.id='playtest-feedback';dialog.className='playtest-feedback';
 dialog.innerHTML=`<form><h2>${text('Как прошла игра?','How was the game?')}</h2><p>${text('Отзыв связан со случайным ID этой сессии. Не указывайте имя, почту или другие личные данные.','Feedback uses this session’s random ID. Please omit names, emails and personal details.')}</p><label>${text('Что было непонятно?','What was unclear?')}<textarea name="unclear" maxlength="2000" rows="3"></textarea></label><label>${text('Что раздражало или мешало?','What was frustrating?')}<textarea name="frustrating" maxlength="2000" rows="3"></textarea></label><label>${text('Хотелось ли продолжать?','Did you want to keep playing?')}<select name="continuePlaying" required><option value="">${text('Выберите ответ','Choose an answer')}</option><option value="yes">${text('Да','Yes')}</option><option value="no">${text('Нет','No')}</option><option value="unsure">${text('Не уверен(а)','Not sure')}</option></select></label><label>${text('Если был баг — что произошло?','If there was a bug, what happened?')}<textarea name="bug" maxlength="3000" rows="3"></textarea></label><p class="playtest-status" role="status"></p><div class="playtest-actions"><button type="button" data-close>${text('Вернуться в игру','Back to game')}</button><button type="submit">${text('Отправить отзыв','Send feedback')}</button></div></form>`;
 document.body.append(dialog);const form=dialog.querySelector('form'),status=dialog.querySelector('[role="status"]'),submit=dialog.querySelector('[type="submit"]');
 const open=()=>{setMode('pause');status.textContent='';dialog.showModal();};button.addEventListener('click',open);
 const close=()=>{dialog.close();setMode('play');};dialog.querySelector('[data-close]').addEventListener('click',close);
 const send=async event=>{
  event.preventDefault();submit.disabled=true;status.textContent=text('Отправляем…','Sending…');
  const answers=Object.fromEntries(new FormData(form));
  const sent=await collector.feedback(answers);
  status.textContent=sent?text('Спасибо! Отзыв получен.','Thank you! Feedback received.'):!collector.pendingSaved?text('Не удалось отправить или сохранить отзыв. Оставьте окно открытым и повторите отправку.','Could not send or save feedback. Keep this window open and retry.'):text('Отзыв сохранён на этом устройстве. Отправим при появлении связи. Можно повторить отправку.','Saved on this device. We will retry when connected. You can also try sending again.');
  submit.disabled=false;
 };
 form.addEventListener('submit',send);
 return {open,dispose(){notice.remove();setting.remove();button.remove();dialog.remove();}};
}
