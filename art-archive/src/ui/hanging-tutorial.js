import {mountedFrame} from '../../catalog/painting-geometry.js';
import {tutorialWorks} from '../paintings/floor-scatter.js';
import {getLanguage,paintingTitle,t} from '../localization/i18n.js';
import {STORAGE_KEYS,readText,writeText} from '../persistence/storage.js';

export function createHangingTutorial(node,archiveTask,layout,settings,debug=false,onEvent=()=>{}){
  let reported=null,stageSince=performance.now();
  function report(){const current=completed?'complete':stage;if(current===reported)return;const now=performance.now();onEvent('tutorial_step',{stage:current,previous:reported??'none',stepElapsedMs:Math.round(now-stageSince)});reported=current;stageSince=now;}
  const key=STORAGE_KEYS.tutorial+(debug?'-debug':'');
  const saved=readText(key);
  let completed=saved==='done',stage='wrong',active=false,first,second,wrong,carriedId=null,find=()=>null;
  try{stage=JSON.parse(saved)?.stage??stage;}catch{}
  if(!['wrong','inspect','drop','first','second'].includes(stage))stage='wrong';
  const work=()=>['wrong','inspect','drop'].includes(stage)?wrong:stage==='second'?second:first;
  const installed=slot=>{const placed=slot&&find(slot.painting.id);return Boolean(placed&&mountedFrame(placed));};
  function save(){writeText(key,completed?'done':JSON.stringify({version:3,stage}));}
  function advance(){
    if(!first)return;
    if(installed(first))stage='second';
    if(stage==='second'&&(!second||installed(second))){completed=true;save();}
  }
  function refresh(){
    const inTutorial=active&&!completed&&Boolean(work());
    node.hidden=!inTutorial;
    archiveTask.hidden=!active||inTutorial;
    if(!active)return;
    report();
    const en=getLanguage()==='en';
    if(inTutorial){
      const target=work(),name=paintingTitle(target.painting);
      const hall=t(layout.halls.find(h=>h.id===target.wall.hall)?.title??'Ротонда');
      const holding=carriedId===target.painting.id;
      let message;
      if(stage==='wrong')message=en?'Pick up the marked painting · E / LMB. We need “'+paintingTitle(first.painting)+'”.':
        'Поднимите отмеченную картину · E / ЛКМ. Нам нужна «'+paintingTitle(first.painting)+'».';
      else if(stage==='inspect')message=en?'Hold RMB to examine the framed painting, then release it. Check whether this is “'+paintingTitle(first.painting)+'”.':
        'Удерживайте ПКМ, чтобы рассмотреть картину в рамке, затем отпустите кнопку. Проверьте, это ли «'+paintingTitle(first.painting)+'».';
      else if(stage==='drop')message=en?'That is not “'+paintingTitle(first.painting)+'”! Look down at a clear spot on the floor and press E / LMB to throw this painting.':
        'А это не «'+paintingTitle(first.painting)+'»! Посмотрите вниз на свободное место на полу и нажмите E / ЛКМ, чтобы бросить картину.';
      else if(holding)message=(en?
        'Each gallery has its own colour: match the frame to the painted entrance. Hang “'+name+'” inside the green frame in the '+hall+' gallery · E / LMB to preview, then again to hang.':
        'У каждого зала свой цвет: цвет рамы совпадает с цветом входа в нужный зал. Повесьте «'+name+'» в область с зелёной рамкой в зале «'+hall+'» · E / ЛКМ — примерить, ещё раз — повесить.');
      else message=(stage==='second'?(en?'Now another gallery! ':'Теперь другой зал! '):'')+(en?
        'Follow the marker to “'+name+'”, pick it up with E / LMB and take it to the '+hall+' gallery.':
        'Найдите по указателю «'+name+'», поднимите её · E / ЛКМ — и отнесите в зал «'+hall+'».');
      if(carriedId&&!holding&&stage!=='drop')message=en?'You are holding a different painting. Look down and press E / LMB to release it, then follow the marker.':
        'У вас другая картина. Посмотрите вниз и нажмите E / ЛКМ, чтобы отпустить её, затем следуйте указателю.';
      if(node.textContent!==message)node.textContent=message;
      return;
    }
    const message=en?'Hang the remaining paintings in their galleries. Masterpieces have a star on the frame and belong in the rotunda.':
      'Развесьте остальные картины по залам. Шедевры отмечены звездой на раме. Их место в ротонде.';
    if(archiveTask.textContent!==message)archiveTask.textContent=message;
  }
  return {
    get stage(){return completed?'complete':stage;},
    beginPlaytest(){reported=null;stageSince=performance.now();if(active)report();},
    setPage(slots,locate){
      active=slots.length>0;find=locate;[first,second,wrong]=tutorialWorks(slots,settings);carriedId=null;
      if(stage==='drop'||stage==='inspect')stage='wrong';
      if(!wrong&&stage==='wrong')stage='first';
      advance();refresh();
    },
    update(id,phase){
      if(!completed&&['inspect','drop'].includes(stage)&&!id&&phase==='idle'){stage='wrong';save();carriedId=id;refresh();return;}
      if(id===carriedId)return;
      carriedId=id;
      if(!completed&&stage==='wrong'&&id===wrong?.painting.id){stage='inspect';save();}
      else if(!completed&&stage==='wrong'&&id===first?.painting.id){stage='first';save();}
      refresh();
    },
    inspected(slot){
      if(!completed&&stage==='inspect'&&carriedId===wrong?.painting.id&&slot.painting.id===wrong.painting.id){stage='drop';save();refresh();}
    },
    thrown(slot){
      if(!completed&&stage==='drop'&&slot.painting.id===wrong?.painting.id){stage='first';carriedId=null;save();refresh();}
    },
    mounted(){if(!completed){advance();save();refresh();}},
    target(){
      if(!active||completed)return null;
      const target=work();if(!target)return null;
      if(stage==='drop')return {kind:'drop'};
      if(stage==='inspect')return null;
      if(carriedId===target.painting.id){
        const hall=layout.halls.find(h=>h.id===target.wall.hall);
        return {kind:'placement',slot:target,hall,label:getLanguage()==='en'?'Hang inside the green frame':'Повесьте в зелёную рамку'};
      }
      const slot=find(target.painting.id);
      return slot?{kind:'painting',slot,label:paintingTitle(target.painting)}:null;
    },
    refresh,
  };
}
