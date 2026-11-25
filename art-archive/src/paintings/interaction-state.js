// Exactly one interaction phase; no incompatible preview/inspection/drop flags.
export function createPaintingInteraction(){
 let state={phase:'idle',slot:null,source:null,landing:null};
 const carrying=()=>['carrying','examining','placing'].includes(state.phase);
 return {
  get phase(){return state.phase;},get carrying(){return carrying()?state.slot:null;},
  get source(){return state.source;},get placing(){return state.phase==='placing';},
  get raised(){return state.phase==='examining';},get landing(){return state.landing;},
  pick(slot,source){if(state.phase!=='idle')throw Error('Cannot pick during '+state.phase);state={phase:'carrying',slot,source,landing:null};},
  place(){if(!carrying())throw Error('No carried painting');state.phase='placing';},
  carry(){if(!carrying())throw Error('No carried painting');state.phase='carrying';},
  raise(value){if(state.phase==='carrying'||state.phase==='examining')state.phase=value?'examining':'carrying';},
  lower(landing){if(!carrying())throw Error('No carried painting');state={phase:'lowering',slot:landing.slot,source:state.source,landing};},
  reset(){state={phase:'idle',slot:null,source:null,landing:null};},
 };
}
