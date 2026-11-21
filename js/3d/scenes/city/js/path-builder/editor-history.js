// The editor stores one transaction per committed gesture. An undo followed by
// a new edit discards the old redo branch, as in conventional map editors.
export function createEditorHistory(limit=48){
  const past=[],future=[];
  const copy=value=>structuredClone(value);
  return {
    record(snapshot){past.push(copy(snapshot));if(past.length>limit)past.shift();future.length=0;},
    undo(current){if(!past.length)return null;
      const previous=past.pop();future.push(copy(current));return copy(previous);},
    redo(current){if(!future.length)return null;
      const next=future.pop();past.push(copy(current));return copy(next);},
    get canUndo(){return past.length>0;},
    get canRedo(){return future.length>0;},
  };
}
