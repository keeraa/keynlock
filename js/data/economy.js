(function(){
  'use strict';

  const components=Object.freeze([
    Object.freeze({id:'red',name:'Красный',color:'#b9473f'}),
    Object.freeze({id:'orange',name:'Оранжевый',color:'#d9853d'}),
    Object.freeze({id:'yellow',name:'Жёлтый',color:'#d7bd4a'}),
    Object.freeze({id:'green',name:'Зелёный',color:'#55945d'}),
    Object.freeze({id:'cyan',name:'Голубой',color:'#59a9b8'}),
    Object.freeze({id:'blue',name:'Синий',color:'#506fae'}),
    Object.freeze({id:'violet',name:'Фиолетовый',color:'#875c9e'})
  ]);
  const lockLoot=Object.freeze({
    1:Object.freeze({coinMultiplier:1,parts:[1,2],components:[1,1],handleChance:.02,paintingChance:.2}),
    2:Object.freeze({coinMultiplier:1.4,parts:[2,3],components:[1,2],handleChance:.04,paintingChance:.35}),
    3:Object.freeze({coinMultiplier:2,parts:[3,5],components:[2,3],handleChance:.07,paintingChance:.5})
  });

  window.KeynlockContent=window.KeynlockContent||{};
  window.KeynlockContent.economy=Object.freeze({components,lockLoot});
})();
