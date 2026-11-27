// Keep dynamic captions as text, with the same keycaps as the movement hints.
export function showPaintingControls(node,caption){
 if(node.textContent===caption)return;
 if(!node.ownerDocument){node.textContent=caption;return;}
 const document=node.ownerDocument,content=document.createDocumentFragment();
 const shortcut=/^(?:E|F|Q|ЛКМ|ПКМ|LMB|RMB)$/;
 for(const part of caption.split(/(?<![\p{L}\p{N}])(E|F|Q|ЛКМ|ПКМ|LMB|RMB)(?![\p{L}\p{N}])/u)){
  if(shortcut.test(part)){
   const key=document.createElement('kbd');key.textContent=part;content.append(key);
  }else if(part)content.append(part);
 }
 node.replaceChildren(content);
}
