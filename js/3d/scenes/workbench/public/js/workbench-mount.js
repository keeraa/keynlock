import {createWorkbenchApp} from './workbench-app.js';

// The standalone page is the single source of markup. The embedded edition
// imports only <main class="app">; scripts and head styles are never copied.
const pageUrl=new URL('../index.html',import.meta.url);
const stylesheetUrl=new URL('../style.css',import.meta.url);
let markupPromise=null;

async function loadMarkup(){
  if(!markupPromise)markupPromise=fetch(pageUrl).then(response=>{
    if(!response.ok)throw new Error(`KEYNLOCK markup: HTTP ${response.status}`);
    return response.text();
  }).then(text=>{
    const parsed=new DOMParser().parseFromString(text,'text/html');
    const main=parsed.querySelector('main.app');
    if(!main)throw new Error('KEYNLOCK markup: main.app is missing');
    return main;
  }).catch(error=>{markupPromise=null;throw error;});
  return markupPromise;
}

/**
 * Mount a fully isolated KEYNLOCK workbench into any sized DOM container.
 * CSS, IDs, input, rendering and cleanup remain inside the instance.
 *
 * @param {HTMLElement} container - the host-provided element (give it a height)
 * @param {{initialMode?:'key'|'assembly'|'mechanism'|'code',active?:boolean}} options
 * @returns {Promise<{show:Function,hide:Function,setMode:Function,getMode:Function,
 *                    getState:Function,dispose:Function,root:HTMLElement}>}
 */
export async function mountWorkbench(container,options={}){
  if(!container?.attachShadow)throw new TypeError('KEYNLOCK requires a DOM host element');
  const initiallyHidden=container.hidden;
  const template=await loadMarkup();
  const shadow=container.shadowRoot||container.attachShadow({mode:'open'});
  if(shadow.childNodes.length)throw new Error('KEYNLOCK host already contains a mounted view');
  const link=document.createElement('link');link.rel='stylesheet';link.href=stylesheetUrl.href;
  const stylesReady=new Promise((resolve,reject)=>{
    link.addEventListener('load',resolve,{once:true});
    link.addEventListener('error',()=>reject(new Error('KEYNLOCK stylesheet failed to load')),{once:true});
  });
  const root=document.importNode(template,true);
  shadow.append(link,root);
  let app;
  try{
    await stylesReady;
    app=createWorkbenchApp({root});
    if(options.initialMode)app.setMode(options.initialMode);
    if(options.active===false){app.setActive(false);container.hidden=true;}
  }catch(error){app?.dispose();shadow.replaceChildren();throw error;}
  let disposed=false;
  return {
    root,
    show(){if(disposed)return;container.hidden=false;app.setActive(true);},
    hide(){if(disposed)return;app.setActive(false);container.hidden=true;},
    setMode:mode=>{if(!disposed)app.setMode(mode);},
    getMode:()=>app.getMode(),
    getState:()=>app.getState(),
    dispose(){if(disposed)return;disposed=true;app.dispose();shadow.replaceChildren();
      container.hidden=initiallyHidden;}
  };
}
