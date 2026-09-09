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
    {mode:'classic',x:35,y:48,district:'old',icon:'assets/map/mission-icons/mission_ico_03.png'}, {mode:'sequence',x:43,y:37,district:'old',icon:'assets/map/mission-icons/mission_ico_10.png'},
    {mode:'special',x:44,y:51,district:'old',icon:'assets/map/mission-icons/mission_ico_16.png'}, {mode:'keyprofile',x:28,y:52,district:'old',icon:'assets/map/mission-icons/mission_ico_11.png'},
    {mode:'wharf',x:25,y:70,district:'port',icon:'assets/map/mission-icons/mission_ico_08.png'}, {mode:'pipeline',x:56,y:77,district:'port',icon:'assets/map/mission-icons/mission_ico_13.png'},
    {mode:'timingneedle',x:76,y:80,district:'port',icon:'assets/map/mission-icons/mission_ico_05.png'}, {mode:'pairednodes',x:40,y:74,district:'port',icon:'assets/map/mission-icons/mission_ico_24.png'},
    {mode:'museum',x:77,y:44,district:'arts',icon:'assets/map/mission-icons/mission_ico_23.png'}, {mode:'composite',x:67,y:48,district:'arts',icon:'assets/map/mission-icons/mission_ico_25.png'},
    {mode:'scope',x:82,y:55,district:'arts',icon:'assets/map/mission-icons/mission_ico_26.png'}, {mode:'turnmemory',x:65,y:59,district:'arts',icon:'assets/map/mission-icons/mission_ico_15.png'},
    {mode:'drum',x:51,y:47,district:'bohemian',icon:'assets/map/mission-icons/mission_ico_20.png'}, {mode:'resonance',x:49,y:29,district:'bohemian',icon:'assets/map/mission-icons/mission_ico_04.png'},
    {mode:'signalbalance',x:39,y:57,district:'bohemian',icon:'assets/map/mission-icons/mission_ico_22.png'}, {mode:'tension',x:54,y:36,district:'bohemian',icon:'assets/map/mission-icons/mission_ico_28.png'},
    {mode:'torqueangle',x:11,y:17,district:'industrial',icon:'assets/map/mission-icons/mission_ico_14.png'}, {mode:'ringpassage',x:28,y:22,district:'industrial',icon:'assets/map/mission-icons/mission_ico_12.png'},
    {mode:'symbolpins',x:17,y:11,district:'industrial',icon:'assets/map/mission-icons/mission_ico_27.png'}, {mode:'springtumblers',x:11,y:29,district:'industrial',icon:'assets/map/mission-icons/mission_ico_35.png'},
    {mode:'workingangle',x:59,y:31,district:'upper',icon:'assets/map/mission-icons/mission_ico_07.png'}, {mode:'deduction',x:73,y:34,district:'upper',icon:'assets/map/mission-icons/mission_ico_29.png'},
    {mode:'cylinderpath',x:85,y:26,district:'upper',icon:'assets/map/mission-icons/mission_ico_32.png'}, {mode:'ringsecret',x:90,y:32,district:'upper',icon:'assets/map/mission-icons/mission_ico_33.png'},
    {mode:'soundlatch',x:66,y:12,district:'palace',icon:'assets/map/mission-icons/mission_ico_18.png'}, {mode:'twinbalance',x:56,y:16,district:'palace',icon:'assets/map/mission-icons/mission_ico_06.png'},
    {mode:'pinflight',x:78,y:17,district:'palace',icon:'assets/map/mission-icons/mission_ico_30.png'},
    {mode:'silhouettes',x:59,y:54,district:'arts',icon:'assets/map/mission-icons/mission_ico_34.png'}
  ].map(Object.freeze));

  window.KeynlockContent=window.KeynlockContent||{};
  window.KeynlockContent.world=Object.freeze({
    districts,
    missionPlaces,
    missionTiers:Object.freeze([1,2,3]),
    // The city map is a free-play catalogue; the journal owns story order.
    missionAccess:'free'
  });
})();
