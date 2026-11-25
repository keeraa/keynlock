// Quest works remain present while ordinary exhibition pages change.
// Keep their existing slots/IDs so saved positions and disposal still apply.
export function playableSelection(slots,allSlots){
 const ids=new Set(slots.map(s=>s.painting.id));
 return [...slots,...allSlots.filter(s=>s.painting.collection==='keynlock'&&!ids.has(s.painting.id))];
}
