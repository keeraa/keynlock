(function(){
  'use strict';

  window.KeynlockContent=window.KeynlockContent||{};
  window.KeynlockContent.restoration=Object.freeze({
    targetScore:88,
    japaneseIds:Object.freeze(['great-wave','red-fuji','kajikazawa','sea-satta','sudden-shower','plum-garden','ejiri','umezawa','inume','mishima','shono','yokkaichi','kameyama','nihonbashi','kanbara']),
    categoryDistricts:Object.freeze({japan:'port',china:'port',korea:'port',india:'port',impressionism:'arts',modern:'arts',rococo:'bohemian',romanticism:'bohemian',symbolism:'bohemian',surrealism:'industrial',renaissance:'upper',baroque:'upper'}),
    orderCategories:Object.freeze([
      Object.freeze(['all','Все']),Object.freeze(['japan','Укиё-э']),Object.freeze(['china','Китай']),
      Object.freeze(['korea','Корея']),Object.freeze(['india','Индия']),Object.freeze(['renaissance','Возрождение']),
      Object.freeze(['baroque','Барокко']),Object.freeze(['rococo','Рококо']),Object.freeze(['impressionism','Импрессионизм']),
      Object.freeze(['modern','Модерн']),Object.freeze(['romanticism','Романтизм']),Object.freeze(['symbolism','Символизм']),
      Object.freeze(['surrealism','Сюрреализм'])
    ])
  });
})();
