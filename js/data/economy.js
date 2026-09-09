(function(){
  'use strict';

  const components=Object.freeze([
    Object.freeze({id:'red',name:'Красный',color:'#b9473f',image:'assets/alchemy/components/mednaya_strugka.png',material:'Медная стружка'}),
    Object.freeze({id:'orange',name:'Оранжевый',color:'#d9853d',image:'assets/alchemy/components/solnechniy_pepel.png',material:'Солнечный пепел'}),
    Object.freeze({id:'yellow',name:'Жёлтый',color:'#d7bd4a',image:'assets/alchemy/components/geltaya_sera.png',material:'Жёлтая сера'}),
    Object.freeze({id:'green',name:'Зелёный',color:'#55945d',image:'assets/alchemy/components/pepelniy_paporotnik.png',material:'Пепельный папоротник'}),
    Object.freeze({id:'cyan',name:'Голубой',color:'#59a9b8',image:'assets/alchemy/components/moroznaya_sol.png',material:'Морозная соль'}),
    Object.freeze({id:'blue',name:'Синий',color:'#506fae',image:'assets/alchemy/components/lunnaya_voda.png',material:'Лунная вода'}),
    Object.freeze({id:'violet',name:'Фиолетовый',color:'#875c9e',image:'assets/alchemy/components/efirnaya_iskra.png',material:'Эфирная искра'})
  ]);
  const lockLoot=Object.freeze({
    1:Object.freeze({coinMultiplier:1,parts:[1,2],components:[1,1],handleChance:.04,paintingChance:.2}),
    2:Object.freeze({coinMultiplier:1.4,parts:[2,3],components:[1,2],handleChance:.08,paintingChance:.35}),
    3:Object.freeze({coinMultiplier:2,parts:[3,5],components:[2,3],handleChance:.14,paintingChance:.5})
  });

  window.KeynlockContent=window.KeynlockContent||{};
  window.KeynlockContent.economy=Object.freeze({components,lockLoot,handlePity:5,caseUpgradePrice:2500});
})();
