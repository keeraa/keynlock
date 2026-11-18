// Shared deterministic puzzle rules. The cut heights also determine pin lengths.
export const PIN_ORDER = Object.freeze([2, 0, 3, 1]);
export const CUT_LEVELS = Object.freeze([0.05, 0.12, 0.19, 0.26]);
export const TARGET_CUTS = Object.freeze(PIN_ORDER.map(code => CUT_LEVELS[code]));
export const CUT_TOLERANCE = 0.06; // Allowed deviation: 6% of each tooth's target depth.
export const cutTolerance = (target,ratio=CUT_TOLERANCE) => target*ratio;
export const BREAK_CUT = 0.55; // The cut reaches the bottom edge of the key.
export const MAX_CUT = 0.60;
export const DIFFICULTIES = Object.freeze([4,6,8]);
export const BLADE_LEFT = -1.40;
export const BLADE_RIGHT = 2.18;
export const KEY_TOP_Y = .17;
export const KEY_BOTTOM_Y = -.38;
export const TIP_START_X = BLADE_RIGHT-.28;
export const TIP_TOP_Y = -.09;
export const TIP_BOTTOM_Y = -.22;
// Generous vertical targeting lets the player pick a tooth with the cursor
// even when aiming above or below the very thin visible edge of the key.
export const KEY_PICK_MIN_Y=KEY_BOTTOM_Y-.75;
export const KEY_PICK_MAX_Y=KEY_TOP_Y+1.10;
export function showKeyTargetGuide(method,intact=true){
  return method==='guided'&&Boolean(intact);
}
// All three difficulties use the same fixed-length key blade.
export function cutLayout(count=4){
  const n=DIFFICULTIES.includes(count)?count:4;
  const step=2.92/n;
  return Array.from({length:n},(_,i)=>({
    center:-1.05+(i+.5)*step,
    ramp:step*.43,
    flat:step*.14,
    hitWidth:step*.98
  }));
}

// Deterministic hit selection on the actual front face: the nearest tooth
// wins at the boundary, independent of overlapping 3D hit boxes.
export function cutIndexAtX(x,layout){
  if(!Number.isFinite(x))return -1;
  let best=-1,distance=Infinity;
  for(let i=0;i<layout.length;i++){
    const d=Math.abs(x-layout[i].center);
    if(d<distance){distance=d;best=i;}
  }
  return best>=0&&distance<=layout[best].hitWidth*.525?best:-1;
}

export function keyPickIndexAt(x,y,layout){
  if(!Number.isFinite(y)||y<KEY_PICK_MIN_Y||y>KEY_PICK_MAX_Y)return -1;
  return cutIndexAtX(x,layout);
}

export function keyTopOutline(cuts,layout){
  const points=[[BLADE_LEFT,KEY_TOP_Y]];
  layout.forEach(({center,ramp,flat},i)=>{
    const y=Math.max(KEY_BOTTOM_Y,KEY_TOP_Y-(cuts[i]||0));
    points.push([center-ramp,KEY_TOP_Y],[center-flat,y],
      [center+flat,y],[center+ramp,KEY_TOP_Y]);
  });
  points.push([TIP_START_X,KEY_TOP_Y],[BLADE_RIGHT,TIP_TOP_Y]);
  return points;
}

export function keyTopAtX(cuts,layout,x){
  const outline=keyTopOutline(cuts,layout);
  for(let i=1;i<outline.length;i++){
    const a=outline[i-1],b=outline[i];
    if(x>=a[0]-1e-8&&x<=b[0]+1e-8){
      const t=clamp((x-a[0])/(b[0]-a[0]),0,1);
      return a[1]+(b[1]-a[1])*t;
    }
  }
  return null;
}

// In free filing the tool cuts the tooth whose actual contour is beneath the
// tip of the file. Moving the tip away from the cutting edge stops removal.
export function filingContactAt(x,y,cuts,layout){
  const index=cutIndexAtX(x,layout);
  if(index<0)return -1;
  const top=keyTopAtX(cuts,layout,x);
  if(top===null||Math.abs(y-top)>.23)return -1;
  return index;
}

// Draw the desired outline only where there is still metal underneath it.
// A deepened notch must not leave a guide line suspended over empty space.
export function targetGuideSegments(cuts,targets,layout){
  const actual=keyTopOutline(cuts,layout);
  const guide=keyTopOutline(targets,layout);
  const segments=[];
  for(let i=1;i<guide.length;i++){
    const a=guide[i-1],b=guide[i];
    const da=actual[i-1][1]-a[1],db=actual[i][1]-b[1];
    if(da>=-1e-6&&db>=-1e-6){segments.push([a,b]);continue;}
    if(da<0&&db<0)continue;
    const t=da/(da-db);
    const crossing=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    segments.push(da>=0?[a,crossing]:[crossing,b]);
  }
  return segments;
}

// Polygon matching the metal still present under one filing zone. Used for
// the cursor highlight, so even a deep notch has no floating rectangle.
export function keyHighlightPolygon(cuts,layout,index){
  const zone=layout[index];if(!zone)return [];
  const left=zone.center-zone.hitWidth*.5;
  const right=zone.center+zone.hitWidth*.5;
  const top=keyTopOutline(cuts,layout);
  function height(x){
    for(let i=1;i<top.length;i++){
      const [aX,aY]=top[i-1],[bX,bY]=top[i];
      if(x>=aX-1e-8&&x<=bX+1e-8)
        return aY+(bY-aY)*clamp((x-aX)/(bX-aX),0,1);
    }
    return KEY_TOP_Y;
  }
  const upper=[[left,height(left)],
    ...top.filter(([x])=>x>left&&x<right),
    [right,height(right)]];
  return [[left,KEY_BOTTOM_Y],[right,KEY_BOTTOM_Y],...upper.reverse()];
}

export function keyProfileSegments(cuts,layout,breakIndex=-1){
  const segments=[[[BLADE_LEFT,KEY_TOP_Y]]];
  layout.forEach(({center,ramp,flat},i)=>{
    const y=Math.max(KEY_BOTTOM_Y,KEY_TOP_Y-Math.min(BREAK_CUT,cuts[i]||0));
    const current=segments[segments.length-1];
    current.push([center-ramp,KEY_TOP_Y],[center-flat,y]);
    if(i===breakIndex)segments.push([[center+flat,KEY_BOTTOM_Y],[center+ramp,KEY_TOP_Y]]);
    else current.push([center+flat,y],[center+ramp,KEY_TOP_Y]);
  });
  segments[segments.length-1].push([TIP_START_X,KEY_TOP_Y],[BLADE_RIGHT,TIP_TOP_Y]);
  return segments;
}

// The first four cuts encode the four-pin training cylinder. Optional extra
// cuts increase the hand-filing challenge while using the same blade length.
export function generateBlueprint(difficulty=4,previous='',random=Math.random){
  if(!DIFFICULTIES.includes(difficulty))difficulty=4;
  const order=[0,1,2,3];
  for(let i=order.length-1;i>0;i--){
    const j=Math.floor(clamp(random(),0,.999999)* (i+1));
    [order[i],order[j]]=[order[j],order[i]];
  }
  const extra=Array.from({length:difficulty-4},()=>
    Math.floor(clamp(random(),0,.999999)*CUT_LEVELS.length));
  const codes=order.concat(extra);
  if(codes.join('')===previous){[codes[0],codes[1]]=[codes[1],codes[0]];}
  return {difficulty,targets:codes.map(code=>CUT_LEVELS[code]),
    pinOrder:codes.slice(0,4),signature:codes.join('')};
}

// Pointer gestures shared by both workbench scenes. Tools own clicks on
// interactive geometry; bare left-drags orbit, and Cmd/Ctrl-drags pan.
export function cameraPointerAction({toolTarget=false,shiftKey=false,metaKey=false,ctrlKey=false}={}) {
  if(metaKey||ctrlKey)return 'pan';
  if(toolTarget&&!shiftKey)return 'tool';
  return 'orbit';
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function applyFilingStroke(cut, pixels, pressure = 1) {
  if (!Number.isFinite(cut) || !Number.isFinite(pixels) || pixels < 0) return clamp(cut || 0, 0, MAX_CUT);
  return clamp(cut + pixels * 0.00059 * clamp(pressure, 0.5, 1.5), 0, MAX_CUT);
}

// The first stroke crossing 95% lands on the blueprint. Continuing to file
// deliberately can overcut it, including severing the key entirely.
export function assistedFilingStroke(cut, pixels, target) {
  const next = applyFilingStroke(cut, pixels);
  return next >= target * 0.95 && cut < target ? target : next;
}

export function inspectKey(cuts, targets = TARGET_CUTS, tolerance = CUT_TOLERANCE) {
  const errors = targets.map((target, i) => Number((Number(cuts[i] ?? 0) - target).toFixed(4)));
  // The same relative tolerance applies to shallow and deep teeth.
  const brokenAt=cuts.findIndex(cut=>cut>=BREAK_CUT);
  const accurate = brokenAt<0&&errors.every((error,i) =>
    Math.abs(error) <= cutTolerance(targets[i],tolerance)+1e-8);
  const rawScore = Math.round(100 * clamp(1 - errors.reduce((sum, error) => sum + Math.abs(error), 0) / (MAX_CUT * targets.length), 0, 1));
  return { accurate, errors, brokenAt, overshot:brokenAt>=0||errors.some((error,i) => error > cutTolerance(targets[i],tolerance)+1e-8), rawScore,
    score: rawScore >= 95 ? 100 : Math.round(rawScore / 5) * 5 };
}

export const SLOT_TYPES = Object.freeze([
  'core-0',
  ...Array.from({ length: 4 }, (_, i) => `pin-${i}`),
  ...Array.from({ length: 4 }, (_, i) => `spring-${i}`),
  'gear-0', 'gear-1', 'cam-0', 'cover-0'
]);

export const ASSEMBLY_STEPS = Object.freeze([
  { id:'core', title:'Установить сердцевину', instruction:'Поместите латунный цилиндр в горизонтальное гнездо корпуса.', slots:['core-0'] },
  { id:'pins', title:'Разложить кодовые штифты', instruction:'Вставьте четыре штифта по схеме: III · I · IV · II. Длина каждого штифта влияет на линию среза.', slots:['pin-0','pin-1','pin-2','pin-3'] },
  { id:'springs', title:'Установить пружины', instruction:'Поставьте по одной пружине поверх каждого верхнего штифта. Пружины остаются отдельными деталями.', slots:['spring-0','spring-1','spring-2','spring-3'] },
  { id:'drive', title:'Собрать привод', instruction:'Сначала шестерня 12 зубьев, затем 16 зубьев. К ведомой шестерне присоедините кулачок.', slots:['gear-0','gear-1','cam-0'] },
  { id:'cover', title:'Закрыть пружинный блок', instruction:'Установите верхнюю крышку, удерживающую пружины. Затем испытайте готовый замок ключом.', slots:['cover-0'] }
]);

export function checkSocket(part, socket) {
  if (!part || !socket) return false;
  return (part.startsWith('pin-') && socket.startsWith('pin-')) ||
    (part.startsWith('spring-') && socket.startsWith('spring-')) ||
    (part.startsWith('washer-') && socket.startsWith('washer-')) ||
    (part === 'clip-0' && socket === 'clip-0') ||
    (part === 'rod-0' && socket === 'rod-0') ||
    (part === 'bolt-0' && socket === 'bolt-0') ||
    (part === 'gear-0' && socket === 'gear-0') ||
    (part === 'gear-1' && socket === 'gear-1') ||
    (part === 'core-0' && socket === 'core-0') ||
    (part === 'cam-0' && socket === 'cam-0') ||
    (part === 'cover-0' && socket === 'cover-0');
}

export function detachPart(installed, partId) {
  const next={...installed};
  for(const [socket,id] of Object.entries(next))if(id===partId)delete next[socket];
  return next;
}

export function stepComplete(stepIndex, installed) {
  const step=ASSEMBLY_STEPS[stepIndex];
  return Boolean(step && step.slots.every(socket=>installed[socket]));
}

export function firstIncompleteStep(installed) {
  const index=ASSEMBLY_STEPS.findIndex((_,i)=>!stepComplete(i,installed));
  return index===-1?ASSEMBLY_STEPS.length-1:index;
}

export function inspectAssembly(installed, cuts, targets=TARGET_CUTS, pinOrder=PIN_ORDER) {
  const missing = SLOT_TYPES.filter(socket => !installed[socket]);
  const wrongPins = pinOrder.map((code, slot) => installed[`pin-${slot}`] === `pin-${code}` ? null : slot)
    .filter(slot => slot !== null);
  const key = inspectKey(cuts,targets);
  return {complete: missing.length === 0, missing, wrongPins, key,
    success: missing.length === 0 && wrongPins.length === 0 && key.accurate};
}
