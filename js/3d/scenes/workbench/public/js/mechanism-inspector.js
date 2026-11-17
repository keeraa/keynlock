import {PARTS,PIN_CODES,buildContacts} from './mechanism-engine.js';
import {STANDARD_TENSION_TOOLS} from './mechanism-lockpicks.js';

export const escapeMechanismHtml=s=>String(s).replace(/[&<>"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

// Pure inspector markup; the controller owns DOM events and any mutations.
export function mechanismInspectorMarkup({parts,selected,mode,runtime,view,effects}){
  const html=escapeMechanismHtml;
  const part=parts.find(item=>item.id===selected);
  if(mode==='attack'){
    const bank=parts.find(item=>item.type==='pinbank');
    const fixed=(runtime.pinBanks?.[bank?.id]?.pins||[]).filter(pin=>pin.set).length;
    return `<div class="mech-part-name">Как открыть этот замок</div>
      <ol class="mech-physical-chain">
        <li><b>Форма натяжителя</b> должна пройти через направляющую у скважины.</li>
        <li><b>Подходящий натяжитель</b> чуть поворачивает сердцевину и удерживает поднятые штифты.</li>
        <li><b>Отмычка-крючок</b> по одному приподнимает штифты внутри скважины.</li>
        <li><b>Щелчок ✓</b> означает правильное положение. Когда все штифты выставлены, сердцевина может повернуться.</li>
      </ol>
      ${bank?'<div class="mech-param-row"><span>Выставлено штифтов</span><strong data-mech-pin-count="true">'+fixed+' / '+PIN_CODES.length+'</strong></div>':
        '<p>В механизме нет штифтового секрета. Исследуйте доступные точки через скважину.</p>'}
      <p class="mech-pin-help">Выбирайте штифт под замком. Если подняли слишком высоко, извлеките натяжитель — штифты опустятся.</p>`;
  }
  if(!part){
    return `<div class="mech-part-name">Как открыть замок</div>
      <ol class="mech-physical-chain">
        <li><b>Ключ</b> приподнимает пять штифтов на нужную высоту.</li>
        <li><b>Сердцевина</b> получает возможность повернуться.</li>
        <li><b>Кулачок или тяги</b> отводят пружинную защёлку.</li>
        <li><b>Засов</b> втягивается и отпускает правую скобу.</li>
      </ol><p>Нажмите «Повернуть ключ». Каждый этап будет подсвечен прямо на металле. Нажмите на деталь в 3D, чтобы увидеть её роль.</p>`;
  }
  const def=PARTS[part.type];
  const contacts=buildContacts(parts).filter(link=>link.from===part.id||link.to===part.id).length;
  let body=`<div class="mech-part-name">${def.name}</div>
    <div class="mech-part-kind">${part.type==='shield'?'ЗАЩИТНАЯ ПЛАСТИНА':`СОЕДИНЕНИЙ С ДРУГИМИ ДЕТАЛЯМИ: ${contacts}`}</div>
    <p class="mech-simple-explanation">${html(effects[part.type]||def.detail)}</p>
    <details class="mech-technical-note"><summary>Как устроена деталь</summary><p>${html(def.detail)}</p></details>`;
  if(mode==='build'){
    if(part.type==='key'){
      body+=`<label class="mech-keyway-label" for="mechKeywayProfile">Фигурный паз для натяжителя</label>
        <select id="mechKeywayProfile" class="mech-keyway-select" aria-label="Форма направляющей скважины">
          ${STANDARD_TENSION_TOOLS.map((tool,i)=>`<option value="${i}" ${part.wrenchProfile===i?'selected':''}>${html(tool.name)}</option>`).join('')}
        </select>
        <p class="mech-pin-help">Изгиб направляющей определяет, какой натяжитель войдёт в замок.</p>`;
    }
    if(def.param){
      const title={ratio:'Передаточное число',resistance:'Сопротивление',strength:'Сила возврата',
        steps:'Число щелчков',phase:'Начало рабочей фазы',threshold:'Порог открытия',
        radius:'Радиус защиты'}[def.param];
      body+=`<label class="mech-param-row" for="mechParameter"><span>${title}</span>
        <strong id="mechParameterValue">${Number(part.setting).toFixed(def.step===1||def.step===5?0:2)}${def.unit}</strong></label>
        <input id="mechParameter" type="range" min="${def.min}" max="${def.max}"
        step="${def.step}" value="${part.setting}" />`;
    }
    if(part.type==='lever')body+=`<label class="mech-toggle-row"><input type="checkbox" id="mechFlip" ${part.flip?'checked':''} /> Обратное плечо</label>`;
    if(['pin','cam','latch'].includes(part.type))body+=`<label class="mech-toggle-row"><input type="checkbox" id="mechPolarity" ${part.polarity===-1?'checked':''} /> Работает от обратного усилия</label>`;
    body+=`<div class="mech-properties-actions"><button id="mechRotate" type="button" ${def.fixed?'disabled':''}>Повернуть 90° ↻</button>
      <button id="mechRemove" type="button" ${def.fixed?'disabled':''}>Убрать деталь ×</button></div>`;
  }else{
    const level=view?.values[part.id]||0;
    body+=`<div class="mech-param-row"><span>Текущий ход</span><strong data-mech-travel="true">${Math.round(Math.abs(level)*100)}%</strong></div>`;
  }
  return body;
}
