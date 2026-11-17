export const CODE_LOCK_STORAGE_KEY='keynlock-code-box-v1';
export const CODE_LENGTH=6;

const validCode=value=>typeof value==='string'&&/^\d{6}$/.test(value);
const validDigits=value=>Array.isArray(value)&&value.length===CODE_LENGTH&&
  value.every(digit=>Number.isInteger(digit)&&digit>=0&&digit<=9);

export function newCodeLock(random=Math.random){
  const value=Math.max(0,Math.min(999999,Math.floor(random()*1000000)));
  return {secret:String(value).padStart(CODE_LENGTH,'0'),digits:Array(CODE_LENGTH).fill(0),
    attempts:0,matched:null,opened:false};
}

export function restoreCodeLock(saved,random=Math.random){
  if(!saved||!validCode(saved.secret)||!validDigits(saved.digits))return newCodeLock(random);
  const matches=saved.digits.reduce((total,digit,index)=>
    total+(digit===Number(saved.secret[index])?1:0),0);
  const opened=saved.opened===true&&matches===CODE_LENGTH;
  return {secret:saved.secret,digits:[...saved.digits],
    attempts:Number.isSafeInteger(saved.attempts)&&saved.attempts>=0?saved.attempts:0,
    matched:Number.isInteger(saved.matched)&&saved.matched>=0&&saved.matched<=CODE_LENGTH?
      saved.matched:null,opened};
}

export function loadCodeLock(storage=globalThis.localStorage,random=Math.random){
  try{return restoreCodeLock(JSON.parse(storage?.getItem(CODE_LOCK_STORAGE_KEY)||'null'),random);}
  catch{return newCodeLock(random);}
}

export function saveCodeLock(state,storage=globalThis.localStorage){
  try{storage?.setItem(CODE_LOCK_STORAGE_KEY,JSON.stringify(state));return true;}
  catch{return false;}
}

export function moveCodeWheel(state,index,delta){
  if(state.opened||!Number.isInteger(index)||index<0||index>=CODE_LENGTH||
    !Number.isInteger(delta))return false;
  state.digits[index]=(state.digits[index]+delta%10+10)%10;
  state.matched=null;
  return true;
}

export function testCodeLock(state){
  if(state.opened)return {opened:true,matched:CODE_LENGTH,attempts:state.attempts};
  state.attempts++;
  state.matched=state.digits.reduce((matches,digit,index)=>
    matches+(digit===Number(state.secret[index])?1:0),0);
  state.opened=state.matched===CODE_LENGTH;
  return {opened:state.opened,matched:state.matched,attempts:state.attempts};
}
