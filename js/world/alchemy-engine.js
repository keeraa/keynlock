(function(){
  'use strict';

  let running=false;
  let parked=[];
  const nativeFrame=window.requestAnimationFrame.bind(window);
  const realById=document.getElementById.bind(document);
  const spare=()=>{
    const node=document.createElement('div');
    node.style.display='none';
    return node;
  };
  const scope=()=>realById('alchemyRoot')||document;
  const scopedDocument={
    getElementById:id=>realById(id)||spare(),
    querySelector:selector=>scope().querySelector(selector),
    querySelectorAll:selector=>scope().querySelectorAll(selector),
    createElement:tag=>document.createElement(tag),
    addEventListener:(...args)=>document.addEventListener(...args),
    get body(){return document.body;},
    get documentElement(){return document.documentElement;}
  };

  function requestFrame(callback){
    if(running)return nativeFrame(callback);
    parked.push(callback);
    return 0;
  }

  function start(){
    running=true;
    const queued=parked;
    parked=[];
    queued.forEach(callback=>nativeFrame(callback));
  }

  function stop(){
    running=false;
  }

  window.KeynlockAlchemyEngine=Object.freeze({document:scopedDocument,requestFrame,start,stop});
})();
