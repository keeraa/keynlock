(function(){
  'use strict';

  const districts=Object.freeze({
    old:Object.freeze({order:1,name:'Старый квартал',color:'red',colorName:'Красный',hex:'#b94a42',risk:'Низкий',locks:'Простые',loot:'Невысокая',art:'Старые лавки и небольшие европейские собрания'}),
    port:Object.freeze({order:2,name:'Порт',color:'orange',colorName:'Оранжевый',hex:'#d5823b',risk:'Средний',locks:'Разные',loot:'Высокая',art:'Япония, Китай, Корея и Индия'}),
    arts:Object.freeze({order:3,name:'Район искусств',color:'yellow',colorName:'Жёлтый',hex:'#d8b34b',risk:'Средний',locks:'Галерейные',loot:'Высокая',art:'Импрессионизм, модерн и рынок искусства'}),
    bohemian:Object.freeze({order:4,name:'Богемный квартал',color:'green',colorName:'Зелёный',hex:'#57945b',risk:'Средний',locks:'Хитрые',loot:'Средняя',art:'Рококо, романтизм и символизм'}),
    industrial:Object.freeze({order:5,name:'Промышленный район',color:'cyan',colorName:'Голубой',hex:'#4d9da4',risk:'Высокий',locks:'Технические',loot:'Высокая',art:'Модерн, авангард и сюрреализм'}),
    upper:Object.freeze({order:6,name:'Верхний город',color:'blue',colorName:'Синий',hex:'#4c6ea9',risk:'Высокий',locks:'Сложные',loot:'Очень высокая',art:'Возрождение, барокко и частные коллекции'}),
    palace:Object.freeze({order:7,name:'Дворцовый район',color:'violet',colorName:'Фиолетовый',hex:'#7656a5',risk:'Очень высокий',locks:'Особые',loot:'Уникальная',art:'Шедевры и особые серии всех направлений'})
  });

  const missionPlaces=Object.freeze([
    {mode:'classic',x:28,y:62,district:'old'}, {mode:'sequence',x:38,y:30,district:'old'},
    {mode:'special',x:34,y:47,district:'old'}, {mode:'hillsfar',x:26,y:28,district:'old'},
    {mode:'wharf',x:11,y:61,district:'port'}, {mode:'pipeline',x:14,y:40,district:'port'},
    {mode:'bioshock2',x:17,y:23,district:'port'}, {mode:'mass2',x:76,y:82,district:'port'},
    {mode:'museum',x:25,y:82,district:'arts'}, {mode:'composite',x:72,y:52,district:'arts'},
    {mode:'scope',x:56,y:80,district:'arts'}, {mode:'g1',x:44,y:44,district:'arts'},
    {mode:'drum',x:65,y:72,district:'bohemian'}, {mode:'resonance',x:70,y:28,district:'bohemian'},
    {mode:'anach',x:50,y:72,district:'bohemian'}, {mode:'tension',x:62,y:33,district:'bohemian'},
    {mode:'fallout',x:88,y:70,district:'industrial'}, {mode:'masshack',x:96,y:59,district:'industrial'},
    {mode:'alphaprotocol',x:31,y:17,district:'industrial'}, {mode:'watchmen',x:86,y:34,district:'industrial'},
    {mode:'skyrim',x:44,y:64,district:'upper'}, {mode:'deduction',x:78,y:38,district:'upper'},
    {mode:'kingdomcome',x:64,y:16,district:'upper'}, {mode:'thiefds',x:48,y:15,district:'upper'},
    {mode:'thief12',x:88,y:49,district:'palace'}, {mode:'pathologic',x:40,y:82,district:'palace'},
    {mode:'oblivion',x:79,y:20,district:'palace'}
  ].map(Object.freeze));

  window.KeynlockContent=window.KeynlockContent||{};
  window.KeynlockContent.world=Object.freeze({
    districts,
    missionPlaces,
    missionTiers:Object.freeze([1,2,3]),
    missionsUnlockedForTesting:true
  });
})();
