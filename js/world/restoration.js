(function(){
  'use strict';

  const STORAGE_KEY='keynlockRestoredPaintings';
  const TARGET_SCORE=88;
  const PAINTINGS=Object.freeze([
    {id:'sunflowers',title:'Подсолнухи',artist:'Винсент ван Гог',year:'1888',image:'assets/restoration/sunflowers.jpg',colors:['yellow','orange','green']},
    {id:'starry-night',title:'Звёздная ночь',artist:'Винсент ван Гог',year:'1889',image:'assets/restoration/starry-night.jpg',colors:['blue','yellow','violet']},
    {id:'great-wave',title:'Большая волна в Канагаве',artist:'Кацусика Хокусай',year:'ок. 1831',image:'assets/restoration/great-wave.jpg',colors:['blue','cyan']},
    {id:'mona-lisa',title:'Мона Лиза',artist:'Леонардо да Винчи',year:'1503–1519',image:'assets/restoration/mona-lisa.jpg',colors:['green','yellow','orange']},
    {id:'girl-pearl',title:'Девушка с жемчужной серёжкой',artist:'Ян Вермеер',year:'ок. 1665',image:'assets/restoration/girl-pearl.jpg',colors:['blue','yellow']},
    {id:'birth-venus',title:'Рождение Венеры',artist:'Сандро Боттичелли',year:'1480-е',image:'assets/restoration/birth-venus.jpg',colors:['cyan','orange','green']},
    {id:'the-kiss',title:'Поцелуй',artist:'Густав Климт',year:'1907–1908',image:'assets/restoration/the-kiss.jpg',colors:['yellow','orange']},
    {id:'the-scream',title:'Крик',artist:'Эдвард Мунк',year:'1893',image:'assets/restoration/the-scream.jpg',colors:['orange','blue','violet']},
    {id:'las-meninas',title:'Менины',artist:'Диего Веласкес',year:'1656',image:'assets/restoration/las-meninas.jpg',colors:['yellow','violet']},
    {id:'impression-sunrise',title:'Впечатление. Восход солнца',artist:'Клод Моне',year:'1872',image:'assets/restoration/impression-sunrise.jpg',colors:['orange','cyan','blue']},
    {id:'boating-party',title:'Завтрак гребцов',artist:'Пьер Огюст Ренуар',year:'1880–1881',image:'assets/restoration/impressionism/boating-party.jpg',colors:['blue','orange','yellow'],category:'impressionism'},
    {id:'moulin-galette',title:'Бал в Мулен де ла Галетт',artist:'Пьер Огюст Ренуар',year:'1876',image:'assets/restoration/impressionism/moulin-galette.jpg',colors:['blue','green','yellow'],category:'impressionism'},
    {id:'dance-class',title:'Танцевальный класс',artist:'Эдгар Дега',year:'1874',image:'assets/restoration/impressionism/dance-class.jpg',colors:['green','yellow','orange'],category:'impressionism'},
    {id:'paris-rain',title:'Парижская улица в дождливую погоду',artist:'Гюстав Кайботт',year:'1877',image:'assets/restoration/impressionism/paris-rain.jpg',colors:['blue','cyan','violet'],category:'impressionism'},
    {id:'woman-parasol',title:'Дама с зонтиком',artist:'Клод Моне',year:'1875',image:'assets/restoration/impressionism/woman-parasol.jpg',colors:['blue','green','yellow'],category:'impressionism'},
    {id:'water-lilies',title:'Водяные лилии',artist:'Клод Моне',year:'1916',image:'assets/restoration/impressionism/water-lilies.jpg',colors:['blue','green','violet'],category:'impressionism'},
    {id:'boulevard-montmartre',title:'Бульвар Монмартр весной',artist:'Камиль Писсарро',year:'1897',image:'assets/restoration/impressionism/boulevard-montmartre.jpg',colors:['blue','green','yellow'],category:'impressionism'},
    {id:'cradle',title:'Колыбель',artist:'Берта Моризо',year:'1872',image:'assets/restoration/impressionism/cradle.jpg',colors:['blue','green','yellow'],category:'impressionism'},
    {id:'poppies',title:'Маки',artist:'Клод Моне',year:'1873',image:'assets/restoration/impressionism/poppies.jpg',colors:['red','green','blue'],category:'impressionism'},
    {id:'absinthe',title:'Абсент',artist:'Эдгар Дега',year:'1875–1876',image:'assets/restoration/impressionism/absinthe.jpg',colors:['green','yellow','blue'],category:'impressionism'},
    {id:'folies-bergere',title:'Бар в «Фоли-Бержер»',artist:'Эдуард Мане',year:'1882',image:'assets/restoration/impressionism/folies-bergere.jpg',colors:['blue','yellow','red'],category:'impressionism'},
    {id:'montmartre-night',title:'Бульвар Монмартр ночью',artist:'Камиль Писсарро',year:'1897',image:'assets/restoration/impressionism/montmartre-night.jpg',colors:['blue','yellow','orange'],category:'impressionism'},
    {id:'red-fuji',title:'Красная Фудзи',artist:'Кацусика Хокусай',year:'ок. 1830–1832',image:'assets/restoration/red-fuji.jpg',colors:['red','blue','green']},
    {id:'kajikazawa',title:'Кадзикадзава в провинции Каи',artist:'Кацусика Хокусай',year:'ок. 1830–1832',image:'assets/restoration/kajikazawa.jpg',colors:['blue','cyan','yellow']},
    {id:'sea-satta',title:'Море в Сатта, провинция Суруга',artist:'Утагава Хиросигэ',year:'1858',image:'assets/restoration/sea-satta.jpg',colors:['blue','cyan','green']},
    {id:'sudden-shower',title:'Внезапный ливень над мостом Син-Охаси',artist:'Утагава Хиросигэ',year:'1857',image:'assets/restoration/sudden-shower.jpg',colors:['blue','cyan','violet']},
    {id:'plum-garden',title:'Сливовый сад в Камэйдо',artist:'Утагава Хиросигэ',year:'1857',image:'assets/restoration/plum-garden.jpg',colors:['red','green','cyan']},
    {id:'ejiri',title:'Эдзири в провинции Суруга',artist:'Кацусика Хокусай',year:'ок. 1830–1832',image:'assets/restoration/ejiri.jpg',colors:['green','yellow','blue']},
    {id:'umezawa',title:'Умэдзава в провинции Сагами',artist:'Кацусика Хокусай',year:'ок. 1830–1832',image:'assets/restoration/umezawa.jpg',colors:['green','yellow','blue']},
    {id:'inume',title:'Перевал Инумэ в провинции Каи',artist:'Кацусика Хокусай',year:'ок. 1830–1832',image:'assets/restoration/inume.jpg',colors:['blue','green','yellow']},
    {id:'mishima',title:'Перевал Мисима в провинции Каи',artist:'Кацусика Хокусай',year:'ок. 1830–1832',image:'assets/restoration/mishima.jpg',colors:['blue','cyan','green']},
    {id:'shono',title:'Сёно. Внезапный дождь',artist:'Утагава Хиросигэ',year:'1833–1834',image:'assets/restoration/shono.jpg',colors:['blue','green','violet']},
    {id:'yokkaichi',title:'Ёккаити',artist:'Утагава Хиросигэ',year:'1833–1834',image:'assets/restoration/yokkaichi.jpg',colors:['blue','green','yellow']},
    {id:'kameyama',title:'Камэяма',artist:'Утагава Хиросигэ',year:'1833–1834',image:'assets/restoration/kameyama.jpg',colors:['cyan','blue','violet']},
    {id:'nihonbashi',title:'Нихонбаси. Утро',artist:'Утагава Хиросигэ',year:'1833–1834',image:'assets/restoration/nihonbashi.jpg',colors:['blue','yellow','red']},
    {id:'kanbara',title:'Камбара. Ночной снег',artist:'Утагава Хиросигэ',year:'1833–1834',image:'assets/restoration/kanbara.jpg',colors:['blue','cyan','violet']},
    {id:'last-supper',title:'Тайная вечеря',artist:'Леонардо да Винчи',year:'1495–1498',image:'assets/restoration/renaissance/last-supper.jpg',colors:['blue','yellow','red'],category:'renaissance'},
    {id:'school-of-athens',title:'Афинская школа',artist:'Рафаэль Санти',year:'1509–1511',image:'assets/restoration/renaissance/school-of-athens.jpg',colors:['blue','orange','yellow'],category:'renaissance'},
    {id:'creation-of-adam',title:'Сотворение Адама',artist:'Микеланджело',year:'ок. 1512',image:'assets/restoration/renaissance/creation-of-adam.jpg',colors:['cyan','orange','green'],category:'renaissance'},
    {id:'arnolfini-portrait',title:'Портрет четы Арнольфини',artist:'Ян ван Эйк',year:'1434',image:'assets/restoration/renaissance/arnolfini-portrait.jpg',colors:['green','red','yellow'],category:'renaissance'},
    {id:'primavera',title:'Весна',artist:'Сандро Боттичелли',year:'ок. 1482',image:'assets/restoration/renaissance/primavera.jpg',colors:['green','orange','red'],category:'renaissance'},
    {id:'sistine-madonna',title:'Сикстинская Мадонна',artist:'Рафаэль Санти',year:'1512–1513',image:'assets/restoration/renaissance/sistine-madonna.jpg',colors:['blue','green','red'],category:'renaissance'},
    {id:'lady-ermine',title:'Дама с горностаем',artist:'Леонардо да Винчи',year:'1489–1490',image:'assets/restoration/renaissance/lady-ermine.jpg',colors:['blue','green','red'],category:'renaissance'},
    {id:'castiglione',title:'Портрет Бальдассаре Кастильоне',artist:'Рафаэль Санти',year:'1514–1515',image:'assets/restoration/renaissance/castiglione.jpg',colors:['blue','yellow','violet'],category:'renaissance'},
    {id:'ghent-altarpiece',title:'Гентский алтарь',artist:'Ян ван Эйк и Хуберт ван Эйк',year:'1432',image:'assets/restoration/renaissance/ghent-altarpiece.jpg',colors:['red','green','yellow'],category:'renaissance'},
    {id:'garden-earthly-delights',title:'Сад земных наслаждений',artist:'Иероним Босх',year:'ок. 1490–1510',image:'assets/restoration/renaissance/garden-delights.jpg',colors:['blue','green','red'],category:'renaissance'},
    {id:'assumption-virgin',title:'Вознесение Девы Марии',artist:'Тициан',year:'1516–1518',image:'assets/restoration/renaissance/assumption.jpg',colors:['red','blue','yellow'],category:'renaissance'},
    {id:'ambassadors',title:'Послы',artist:'Ганс Гольбейн Младший',year:'1533',image:'assets/restoration/renaissance/ambassadors.jpg',colors:['green','red','yellow'],category:'renaissance'},
    {id:'tower-of-babel',title:'Вавилонская башня',artist:'Питер Брейгель Старший',year:'1563',image:'assets/restoration/renaissance/tower-babel.jpg',colors:['blue','green','orange'],category:'renaissance'},
    {id:'calling-saint-matthew',title:'Призвание апостола Матфея',artist:'Караваджо',year:'1599–1600',image:'assets/restoration/baroque/calling-saint-matthew.jpg',colors:['yellow','orange','violet'],category:'baroque'},
    {id:'judith-holofernes',title:'Юдифь, обезглавливающая Олоферна',artist:'Артемизия Джентилески',year:'ок. 1620',image:'assets/restoration/baroque/judith-holofernes.jpg',colors:['red','yellow','violet'],category:'baroque'},
    {id:'anatomy-lesson',title:'Урок анатомии доктора Тульпа',artist:'Рембрандт',year:'1632',image:'assets/restoration/baroque/anatomy-lesson.jpg',colors:['yellow','orange','violet'],category:'baroque'},
    {id:'milkmaid',title:'Молочница',artist:'Ян Вермеер',year:'ок. 1658–1660',image:'assets/restoration/baroque/milkmaid.jpg',colors:['blue','yellow','red'],category:'baroque'},
    {id:'elevation-cross',title:'Воздвижение Креста',artist:'Питер Пауль Рубенс',year:'1610–1611',image:'assets/restoration/baroque/elevation-cross.jpg',colors:['red','yellow','violet'],category:'baroque'},
    {id:'surrender-breda',title:'Сдача Бреды',artist:'Диего Веласкес',year:'1634–1635',image:'assets/restoration/baroque/surrender-breda.jpg',colors:['blue','green','yellow'],category:'baroque'},
    {id:'art-of-painting',title:'Искусство живописи',artist:'Ян Вермеер',year:'ок. 1666–1668',image:'assets/restoration/baroque/art-of-painting.jpg',colors:['blue','yellow','orange'],category:'baroque'},
    {id:'prodigal-son',title:'Возвращение блудного сына',artist:'Рембрандт',year:'ок. 1668–1669',image:'assets/restoration/baroque/prodigal-son.jpg',colors:['red','yellow','violet'],category:'baroque'},
    {id:'supper-emmaus',title:'Ужин в Эммаусе',artist:'Караваджо',year:'1601',image:'assets/restoration/baroque/supper-emmaus.jpg',colors:['red','green','yellow'],category:'baroque'},
    {id:'three-graces',title:'Три грации',artist:'Питер Пауль Рубенс',year:'1630–1635',image:'assets/restoration/baroque/three-graces.jpg',colors:['red','green','yellow'],category:'baroque'},
    {id:'night-watch',title:'Ночной дозор',artist:'Рембрандт',year:'1642',image:'assets/restoration/baroque/night-watch.jpg',colors:['yellow','red','violet'],category:'baroque'},
    {id:'rokeby-venus',title:'Венера с зеркалом',artist:'Диего Веласкес',year:'1647–1651',image:'assets/restoration/baroque/rokeby-venus.jpg',colors:['red','blue','yellow'],category:'baroque'},
    {id:'jewish-bride',title:'Еврейская невеста',artist:'Рембрандт',year:'ок. 1665–1669',image:'assets/restoration/baroque/jewish-bride.jpg',colors:['red','yellow','green'],category:'baroque'},
    {id:'rococo-swing',title:'Качели',artist:'Жан-Оноре Фрагонар',year:'1767',image:'assets/restoration/rococo/swing.jpg',colors:['green','red','yellow'],category:'rococo'},
    {id:'rococo-cythera',title:'Паломничество на остров Киферу',artist:'Антуан Ватто',year:'1717',image:'assets/restoration/rococo/cythera.jpg',colors:['green','blue','orange'],category:'rococo'},
    {id:'rococo-pierrot',title:'Пьеро',artist:'Антуан Ватто',year:'ок. 1718–1719',image:'assets/restoration/rococo/pierrot.jpg',colors:['yellow','green','blue'],category:'rococo'},
    {id:'rococo-gersaint',title:'Вывеска лавки Жерсена',artist:'Антуан Ватто',year:'1720',image:'assets/restoration/rococo/gersaint.jpg',colors:['red','yellow','blue'],category:'rococo'},
    {id:'rococo-stolen-kiss',title:'Украденный поцелуй',artist:'Жан-Оноре Фрагонар',year:'конец 1780-х',image:'assets/restoration/rococo/stolen-kiss.jpg',colors:['red','green','yellow'],category:'rococo'},
    {id:'rococo-reader',title:'Читающая девушка',artist:'Жан-Оноре Фрагонар',year:'ок. 1770',image:'assets/restoration/rococo/reader.jpg',colors:['yellow','violet','orange'],category:'rococo'},
    {id:'rococo-bolt',title:'Задвижка',artist:'Жан-Оноре Фрагонар',year:'1777',image:'assets/restoration/rococo/bolt.jpg',colors:['red','yellow','violet'],category:'rococo'},
    {id:'rococo-blind-mans-bluff',title:'Жмурки',artist:'Жан-Оноре Фрагонар',year:'ок. 1750–1752',image:'assets/restoration/rococo/blind-mans-bluff.jpg',colors:['blue','red','green'],category:'rococo'},
    {id:'rococo-diana-bath',title:'Диана после купания',artist:'Франсуа Буше',year:'1742',image:'assets/restoration/rococo/diana-bath.jpg',colors:['blue','green','orange'],category:'rococo'},
    {id:'rococo-breakfast',title:'Завтрак',artist:'Франсуа Буше',year:'1739',image:'assets/restoration/rococo/pompadour.jpg',colors:['red','yellow','green'],category:'rococo'},
    {id:'rococo-venus-toilet',title:'Туалет Венеры',artist:'Франсуа Буше',year:'1751',image:'assets/restoration/rococo/venus-toilet.jpg',colors:['blue','yellow','orange'],category:'rococo'},
    {id:'rococo-triumph-venus',title:'Триумф Венеры',artist:'Франсуа Буше',year:'1740',image:'assets/restoration/rococo/triumph-venus.jpg',colors:['blue','red','yellow'],category:'rococo'},
    {id:'rococo-meeting',title:'Встреча',artist:'Жан-Оноре Фрагонар',year:'1771–1773',image:'assets/restoration/rococo/lover-crowned.jpg',colors:['green','red','blue'],category:'rococo'},
    {id:'rococo-mezzetin',title:'Меццетен',artist:'Антуан Ватто',year:'ок. 1718–1720',image:'assets/restoration/rococo/mezzetin.jpg',colors:['red','blue','yellow'],category:'rococo'},
    {id:'rococo-rinaldo-armida',title:'Ринальдо и Армида',artist:'Франсуа Буше',year:'1734',image:'assets/restoration/rococo/rinaldo-armida.jpg',colors:['red','blue','yellow'],category:'rococo'},
    {id:'adele-bloch-bauer',title:'Портрет Адели Блох-Бауэр I',artist:'Густав Климт',year:'1907',image:'assets/restoration/modern/adele-bloch-bauer.jpg',colors:['yellow','orange','green'],category:'modern'},
    {id:'judith-i',title:'Юдифь I',artist:'Густав Климт',year:'1901',image:'assets/restoration/modern/judith-i.jpg',colors:['yellow','green','violet'],category:'modern'},
    {id:'mucha-dance',title:'Танец',artist:'Альфонс Муха',year:'1898',image:'assets/restoration/modern/mucha-dance.jpg',colors:['red','orange','green'],category:'modern'},
    {id:'munch-madonna',title:'Мадонна',artist:'Эдвард Мунк',year:'1894–1895',image:'assets/restoration/modern/munch-madonna.jpg',colors:['red','blue','violet'],category:'modern'},
    {id:'composition-vii',title:'Композиция VII',artist:'Василий Кандинский',year:'1913',image:'assets/restoration/modern/composition-vii.jpg',colors:['red','blue','yellow'],category:'modern'},
    {id:'schiele-self-portrait',title:'Автопортрет с физалисом',artist:'Эгон Шиле',year:'1912',image:'assets/restoration/modern/schiele-self-portrait.jpg',colors:['orange','green','violet'],category:'modern'},
    {id:'blue-horse',title:'Синяя лошадь I',artist:'Франц Марк',year:'1911',image:'assets/restoration/modern/blue-horse.jpg',colors:['blue','red','yellow'],category:'modern'},
    {id:'woman-with-hat',title:'Женщина в шляпе',artist:'Анри Матисс',year:'1905',image:'assets/restoration/modern/woman-with-hat.jpg',colors:['green','red','violet'],category:'modern'},
    {id:'tree-of-life',title:'Древо жизни',artist:'Густав Климт',year:'1905–1909',image:'assets/restoration/modern/tree-life.jpg',colors:['yellow','orange','green'],category:'modern'},
    {id:'matisse-dance',title:'Танец',artist:'Анри Матисс',year:'1910',image:'assets/restoration/modern/dance-matisse.jpg',colors:['red','blue','green'],category:'modern'},
    {id:'franz-marc-fox',title:'Лиса',artist:'Франц Марк',year:'1911',image:'assets/restoration/modern/fox.jpg',colors:['red','blue','yellow'],category:'modern'},
    {id:'portrait-wally',title:'Портрет Валли',artist:'Эгон Шиле',year:'1912',image:'assets/restoration/modern/wally.jpg',colors:['red','green','yellow'],category:'modern'},
    {id:'composition-viii',title:'Композиция VIII',artist:'Василий Кандинский',year:'1923',image:'assets/restoration/modern/composition-viii.jpg',colors:['red','blue','yellow'],category:'modern'},
    {id:'wanderer',title:'Странник над морем тумана',artist:'Каспар Давид Фридрих',year:'ок. 1818',image:'assets/restoration/romanticism/wanderer.jpg',colors:['blue','green','violet'],category:'romanticism'},
    {id:'liberty',title:'Свобода, ведущая народ',artist:'Эжен Делакруа',year:'1830',image:'assets/restoration/romanticism/liberty.jpg',colors:['red','blue','yellow'],category:'romanticism'},
    {id:'raft-medusa',title:'Плот «Медузы»',artist:'Теодор Жерико',year:'1818–1819',image:'assets/restoration/romanticism/raft-medusa.jpg',colors:['yellow','orange','violet'],category:'romanticism'},
    {id:'third-may',title:'Третье мая 1808 года',artist:'Франсиско Гойя',year:'1814',image:'assets/restoration/romanticism/third-may.jpg',colors:['yellow','red','violet'],category:'romanticism'},
    {id:'fighting-temeraire',title:'Последний рейс корабля «Отважный»',artist:'Уильям Тёрнер',year:'1839',image:'assets/restoration/romanticism/fighting-temeraire.jpg',colors:['yellow','orange','blue'],category:'romanticism'},
    {id:'hay-wain',title:'Телега для сена',artist:'Джон Констебл',year:'1821',image:'assets/restoration/romanticism/hay-wain.jpg',colors:['green','blue','yellow'],category:'romanticism'},
    {id:'nightmare',title:'Кошмар',artist:'Иоганн Генрих Фюсли',year:'1781',image:'assets/restoration/romanticism/nightmare.jpg',colors:['red','yellow','violet'],category:'romanticism'},
    {id:'monk-sea',title:'Монах у моря',artist:'Каспар Давид Фридрих',year:'1808–1810',image:'assets/restoration/romanticism/monk-sea.jpg',colors:['blue','cyan','violet'],category:'romanticism'},
    {id:'saturn-devouring-son',title:'Сатурн, пожирающий своего сына',artist:'Франсиско Гойя',year:'1819–1823',image:'assets/restoration/romanticism/saturn.jpg',colors:['red','yellow','violet'],category:'romanticism'},
    {id:'sea-of-ice',title:'Море льда',artist:'Каспар Давид Фридрих',year:'1823–1824',image:'assets/restoration/romanticism/sea-ice.jpg',colors:['blue','cyan','yellow'],category:'romanticism'},
    {id:'slave-ship',title:'Невольничий корабль',artist:'Уильям Тёрнер',year:'1840',image:'assets/restoration/romanticism/slave-ship.jpg',colors:['red','orange','blue'],category:'romanticism'},
    {id:'rain-steam-speed',title:'Дождь, пар и скорость',artist:'Уильям Тёрнер',year:'1844',image:'assets/restoration/romanticism/rain-steam-speed.jpg',colors:['yellow','blue','green'],category:'romanticism'},
    {id:'death-sardanapalus',title:'Смерть Сарданапала',artist:'Эжен Делакруа',year:'1827',image:'assets/restoration/romanticism/sardanapalus.jpg',colors:['red','yellow','orange'],category:'romanticism'},
    {id:'salisbury-cathedral',title:'Солсберийский собор с лугов',artist:'Джон Констебл',year:'1831',image:'assets/restoration/romanticism/salisbury.jpg',colors:['green','blue','yellow'],category:'romanticism'},
    {id:'lady-of-shalott',title:'Леди Шалотт',artist:'Джон Уильям Уотерхаус',year:'1888',image:'assets/restoration/romanticism/lady-shalott.jpg',colors:['red','green','yellow'],category:'romanticism'},
    {id:'isle-dead',title:'Остров мёртвых',artist:'Арнольд Бёклин',year:'1883',image:'assets/restoration/symbolism/isle-dead.jpg',colors:['green','blue','violet'],category:'symbolism'},
    {id:'oedipus-sphinx',title:'Эдип и Сфинкс',artist:'Гюстав Моро',year:'1864',image:'assets/restoration/symbolism/oedipus-sphinx.jpg',colors:['red','orange','violet'],category:'symbolism'},
    {id:'hope',title:'Надежда',artist:'Джордж Фредерик Уоттс',year:'1886',image:'assets/restoration/symbolism/hope.jpg',colors:['blue','green','yellow'],category:'symbolism'},
    {id:'death-life',title:'Смерть и жизнь',artist:'Густав Климт',year:'1910–1915',image:'assets/restoration/symbolism/death-life.jpg',colors:['blue','red','yellow'],category:'symbolism'},
    {id:'wounded-angel',title:'Раненый ангел',artist:'Хуго Симберг',year:'1903',image:'assets/restoration/symbolism/wounded-angel.jpg',colors:['blue','green','yellow'],category:'symbolism'},
    {id:'jupiter-semele',title:'Юпитер и Семела',artist:'Гюстав Моро',year:'1894–1895',image:'assets/restoration/symbolism/jupiter-semele.jpg',colors:['blue','yellow','violet'],category:'symbolism'},
    {id:'the-sin',title:'Грех',artist:'Франц фон Штук',year:'1893',image:'assets/restoration/symbolism/the-sin.jpg',colors:['green','red','violet'],category:'symbolism'},
    {id:'poor-fisherman',title:'Бедный рыбак',artist:'Пюви де Шаванн',year:'1881',image:'assets/restoration/symbolism/poor-fisherman.jpg',colors:['blue','green','orange'],category:'symbolism'},
    {id:'apparition',title:'Видение',artist:'Гюстав Моро',year:'ок. 1876',image:'assets/restoration/symbolism/apparition.jpg',colors:['red','yellow','violet'],category:'symbolism'},
    {id:'cyclops',title:'Циклоп',artist:'Одилон Редон',year:'ок. 1914',image:'assets/restoration/symbolism/cyclops.jpg',colors:['yellow','green','blue'],category:'symbolism'},
    {id:'demon-seated',title:'Демон сидящий',artist:'Михаил Врубель',year:'1890',image:'assets/restoration/symbolism/demon-seated.jpg',colors:['blue','violet','orange'],category:'symbolism'},
    {id:'rex',title:'Король',artist:'Микалоюс Чюрлёнис',year:'1904–1905',image:'assets/restoration/symbolism/rex.jpg',colors:['blue','yellow','green'],category:'symbolism'},
    {id:'symbolist-dream',title:'Сон',artist:'Пюви де Шаванн',year:'1883',image:'assets/restoration/symbolism/dream.jpg',colors:['blue','green','yellow'],category:'symbolism'},
    {id:'kiss-sphinx',title:'Поцелуй Сфинкса',artist:'Франц фон Штук',year:'1895',image:'assets/restoration/symbolism/kiss-sphinx.jpg',colors:['red','yellow','violet'],category:'symbolism'},
    {id:'death-gravedigger',title:'Смерть и могильщик',artist:'Карлос Швабе',year:'ок. 1895',image:'assets/restoration/symbolism/death-gravedigger.jpg',colors:['green','blue','violet'],category:'symbolism'},
    {id:'persistence-memory',title:'Постоянство памяти',artist:'Сальвадор Дали',year:'1931',image:'assets/restoration/surrealism/persistence-memory.jpg',colors:['blue','yellow','orange'],category:'surrealism'},
    {id:'son-of-man',title:'Сын человеческий',artist:'Рене Магритт',year:'1964',image:'assets/restoration/surrealism/son-of-man.jpg',colors:['green','blue','red'],category:'surrealism'},
    {id:'treachery-images',title:'Вероломство образов',artist:'Рене Магритт',year:'1929',image:'assets/restoration/surrealism/treachery-images.jpg',colors:['yellow','orange','violet'],category:'surrealism'},
    {id:'elephants',title:'Слоны',artist:'Сальвадор Дали',year:'1948',image:'assets/restoration/surrealism/elephants.jpg',colors:['blue','orange','red'],category:'surrealism'},
    {id:'human-condition',title:'Условия человеческого существования',artist:'Рене Магритт',year:'1933',image:'assets/restoration/surrealism/human-condition.jpg',colors:['blue','green','yellow'],category:'surrealism'},
    {id:'golconda',title:'Голконда',artist:'Рене Магритт',year:'1953',image:'assets/restoration/surrealism/golconda.jpg',colors:['blue','red','violet'],category:'surrealism'},
    {id:'narcissus',title:'Метаморфозы Нарцисса',artist:'Сальвадор Дали',year:'1937',image:'assets/restoration/surrealism/narcissus.jpg',colors:['blue','orange','yellow'],category:'surrealism'},
    {id:'swans-elephants',title:'Лебеди, отражённые в слонах',artist:'Сальвадор Дали',year:'1937',image:'assets/restoration/surrealism/swans-elephants.jpg',colors:['blue','orange','green'],category:'surrealism'},
    {id:'magritte-lovers',title:'Влюблённые',artist:'Рене Магритт',year:'1928',image:'assets/restoration/surrealism/lovers.jpg',colors:['blue','red','yellow'],category:'surrealism'},
    {id:'false-mirror',title:'Ложное зеркало',artist:'Рене Магритт',year:'1928',image:'assets/restoration/surrealism/false-mirror.jpg',colors:['blue','cyan','yellow'],category:'surrealism'},
    {id:'time-transfixed',title:'Пронзённое время',artist:'Рене Магритт',year:'1938',image:'assets/restoration/surrealism/time-transfixed.jpg',colors:['red','green','violet'],category:'surrealism'},
    {id:'harlequin-carnival',title:'Карнавал Арлекина',artist:'Жоан Миро',year:'1924–1925',image:'assets/restoration/surrealism/harlequin-carnival.jpg',colors:['red','blue','yellow'],category:'surrealism'},
    {id:'dream-flight-bee',title:'Сон, вызванный полётом пчелы',artist:'Сальвадор Дали',year:'1944',image:'assets/restoration/surrealism/dream-bee.jpg',colors:['blue','yellow','orange'],category:'surrealism'},
    {id:'miro-painting-1936',title:'Живопись',artist:'Жоан Миро',year:'1936',image:'assets/restoration/surrealism/painting-1936.jpg',colors:['red','blue','yellow'],category:'surrealism'},
    {id:'surrealism-and-painting',title:'Сюрреализм и живопись',artist:'Макс Эрнст',year:'1942',image:'assets/restoration/surrealism/surrealism-painting.jpg',colors:['red','green','yellow'],category:'surrealism'},
    {id:'journey-sichuan',title:'Путешествие императора Минхуана в Сычуань',artist:'Неизвестный мастер эпохи Тан',year:'VIII век',image:'assets/restoration/china/journey-sichuan.jpg',colors:['green','blue','yellow'],category:'china'},
    {id:'listening-qin',title:'Император Хуэйцзун слушает цинь',artist:'Неизвестный придворный мастер',year:'XI–XII век',image:'assets/restoration/china/listening-qin.jpg',colors:['green','red','yellow'],category:'china'},
    {id:'ladies-silk',title:'Придворные дамы готовят шёлк',artist:'Чжан Сюань',year:'VIII век',image:'assets/restoration/china/ladies-silk.jpg',colors:['red','yellow','green'],category:'china'},
    {id:'court-ladies',title:'Придворные дамы с цветами в волосах',artist:'Чжоу Фан',year:'VIII век',image:'assets/restoration/china/court-ladies.jpg',colors:['red','yellow','green'],category:'china'},
    {id:'han-palace',title:'Весеннее утро во дворце Хань',artist:'Цю Ин',year:'XVI век',image:'assets/restoration/china/han-palace.jpg',colors:['red','green','yellow'],category:'china'},
    {id:'nomad-flute',title:'Восемнадцать песен кочевой флейты',artist:'Неизвестный мастер',year:'XIV век',image:'assets/restoration/china/nomad-flute.jpg',colors:['green','red','yellow'],category:'china'},
    {id:'qianlong-hunt',title:'Император Цяньлун на охоте',artist:'Джузеппе Кастильоне',year:'XVIII век',image:'assets/restoration/china/qianlong-hunt.jpg',colors:['red','green','yellow'],category:'china'},
    {id:'tibetan-envoy',title:'Император Тай-цзун принимает тибетского посла',artist:'Янь Либэнь',year:'VII век',image:'assets/restoration/china/tibetan-envoy.jpg',colors:['red','green','yellow'],category:'china'},
    {id:'double-sixes',title:'Придворные дамы играют в шуанлу',artist:'Чжоу Фан',year:'VIII век',image:'assets/restoration/china/double-sixes.jpg',colors:['red','green','yellow'],category:'china'},
    {id:'auspicious-cranes',title:'Благоприятные журавли',artist:'Император Хуэйцзун',year:'1112',image:'assets/restoration/china/auspicious-cranes.jpg',colors:['blue','yellow','red'],category:'china'},
    {id:'night-revels',title:'Ночной пир Хань Сицзая',artist:'Гу Хунчжун',year:'X век',image:'assets/restoration/china/night-revels.jpg',colors:['red','green','yellow'],category:'china'},
    {id:'peach-blossom-spring',title:'Источник персиковых цветов',artist:'Цю Ин',year:'XVI век',image:'assets/restoration/china/peach-blossom.jpg',colors:['red','green','blue'],category:'china'},
    {id:'birds-flowers',title:'Птицы и цветы четырёх сезонов',artist:'Бянь Вэньцзинь',year:'XV век',image:'assets/restoration/china/birds-flowers.jpg',colors:['green','red','yellow'],category:'china'},
    {id:'qianlong-armour',title:'Император Цяньлун в церемониальных доспехах',artist:'Джузеппе Кастильоне',year:'1739',image:'assets/restoration/china/qianlong-armour.jpg',colors:['yellow','red','blue'],category:'china'},
    {id:'kangxi-southern-tour',title:'Южная инспекционная поездка императора Канси',artist:'Ван Хуэй и помощники',year:'1698',image:'assets/restoration/china/kangxi-tour.jpg',colors:['green','blue','yellow'],category:'china'},
    {id:'lovers-moon',title:'Влюблённые под луной',artist:'Син Юн Бок',year:'конец XVIII века',image:'assets/restoration/korea/lovers-moon.jpg',colors:['blue','red','yellow'],category:'korea'},
    {id:'tiger-magpie',title:'Тигр и сорока',artist:'Неизвестный мастер минхва',year:'XIX век',image:'assets/restoration/korea/tiger-magpie.jpg',colors:['green','red','yellow'],category:'korea'},
    {id:'korean-beauty',title:'Портрет красавицы',artist:'Син Юн Бок',year:'конец XVIII века',image:'assets/restoration/korea/beauty.jpg',colors:['red','yellow','green'],category:'korea'},
    {id:'dancing-boy',title:'Танцующий мальчик',artist:'Ким Хон До',year:'конец XVIII века',image:'assets/restoration/korea/dancing-boy.jpg',colors:['red','blue','yellow'],category:'korea'},
    {id:'ssireum',title:'Ссирым',artist:'Ким Хон До',year:'конец XVIII века',image:'assets/restoration/korea/ssireum.jpg',colors:['yellow','orange','blue'],category:'korea'},
    {id:'tiger-pine',title:'Тигр под сосной',artist:'Ким Хон До',year:'XVIII век',image:'assets/restoration/korea/tiger-pine.jpg',colors:['green','yellow','orange'],category:'korea'},
    {id:'royal-procession',title:'Королевская процессия в Хвасон',artist:'Придворные художники Чосон',year:'1795',image:'assets/restoration/korea/royal-procession.jpg',colors:['red','blue','yellow'],category:'korea'},
    {id:'sun-moon-peaks',title:'Солнце, Луна и пять вершин',artist:'Неизвестный мастер Чосон',year:'XIX век',image:'assets/restoration/korea/sun-moon-peaks.jpg',colors:['red','blue','green'],category:'korea'},
    {id:'cats-sparrows',title:'Кошки и воробьи',artist:'Пён Санбёк',year:'XVIII век',image:'assets/restoration/korea/cats-sparrows.jpg',colors:['green','yellow','red'],category:'korea'},
    {id:'dano-day',title:'Праздник Дано',artist:'Син Юн Бок',year:'конец XVIII века',image:'assets/restoration/korea/dano-day.jpg',colors:['red','green','blue'],category:'korea'},
    {id:'geomungo-women',title:'Женщины выбирают комунго',artist:'Син Юн Бок',year:'конец XVIII века',image:'assets/restoration/korea/geomungo-women.jpg',colors:['red','yellow','blue'],category:'korea'},
    {id:'board-game',title:'Игра в традиционную настольную игру',artist:'Син Юн Бок',year:'конец XVIII века',image:'assets/restoration/korea/board-game.jpg',colors:['green','red','yellow'],category:'korea'},
    {id:'welcoming-governor',title:'Встреча губернатора Пхёнана',artist:'Ким Хон До',year:'конец XVIII века',image:'assets/restoration/korea/welcoming-governor.jpg',colors:['red','blue','yellow'],category:'korea'},
    {id:'lotus-dragonflies',title:'Лотосы и стрекозы',artist:'Ким Хон До',year:'XVIII век',image:'assets/restoration/korea/lotus-dragonflies.jpg',colors:['green','red','blue'],category:'korea'},
    {id:'flowers-birds-minhwa',title:'Цветы и птицы',artist:'Неизвестный мастер минхва',year:'XIX век',image:'assets/restoration/korea/flowers-birds.jpg',colors:['red','green','yellow'],category:'korea'},
    {id:'bharat-mata',title:'Мать-Индия',artist:'Абаниндранат Тагор',year:'1905',image:'assets/restoration/india/bharat-mata.jpg',colors:['orange','yellow','green'],category:'india'},
    {id:'shakuntala',title:'Шакунтала',artist:'Раджа Рави Варма',year:'1870',image:'assets/restoration/india/shakuntala.jpg',colors:['green','red','yellow'],category:'india'},
    {id:'hamsa-damayanti',title:'Дамаянти беседует с лебедем',artist:'Раджа Рави Варма',year:'1899',image:'assets/restoration/india/hamsa-damayanti.jpg',colors:['blue','yellow','orange'],category:'india'},
    {id:'galaxy-musicians',title:'Галактика музыкантов',artist:'Раджа Рави Варма',year:'1889',image:'assets/restoration/india/galaxy-musicians.jpg',colors:['red','blue','yellow'],category:'india'},
    {id:'akbar-elephant',title:'Акбар укрощает слона Хаваи',artist:'Басаван и Четар Мунти',year:'ок. 1590',image:'assets/restoration/india/akbar-elephant.jpg',colors:['red','green','yellow'],category:'india'},
    {id:'bani-thani',title:'Бани Тхани',artist:'Нихал Чанд',year:'ок. 1750',image:'assets/restoration/india/bani-thani.jpg',colors:['green','red','yellow'],category:'india'},
    {id:'radha-krishna',title:'Кришна с гопи и печаль Радхи',artist:'Пуркху из Кангры',year:'1810–1820',image:'assets/restoration/india/radha-krishna.jpg',colors:['green','blue','red'],category:'india'},
    {id:'lakshmi',title:'Богиня Лакшми',artist:'Раджа Рави Варма',year:'1896',image:'assets/restoration/india/lakshmi.jpg',colors:['red','yellow','green'],category:'india'},
    {id:'keechaka-sairandhri',title:'Кичака и Сайрандхри',artist:'Раджа Рави Варма',year:'1890',image:'assets/restoration/india/keechaka-sairandhri.jpg',colors:['red','green','yellow'],category:'india'},
    {id:'there-comes-papa',title:'Папа идёт',artist:'Раджа Рави Варма',year:'1893',image:'assets/restoration/india/there-comes-papa.jpg',colors:['red','green','yellow'],category:'india'},
    {id:'india-milkmaid',title:'Молочница',artist:'Раджа Рави Варма',year:'1904',image:'assets/restoration/india/milkmaid.jpg',colors:['blue','red','yellow'],category:'india'},
    {id:'krishna-holi',title:'Кришна празднует Холи с Радхой и гопи',artist:'Нихал Чанд',year:'1750–1760',image:'assets/restoration/india/krishna-holi.jpg',colors:['red','blue','yellow'],category:'india'},
    {id:'birth-krishna',title:'Рождение Кришны',artist:'Мастер школы Кангра',year:'1790',image:'assets/restoration/india/birth-krishna.jpg',colors:['blue','red','yellow'],category:'india'},
    {id:'murugan',title:'Муруган',artist:'Раджа Рави Варма',year:'XIX век',image:'assets/restoration/india/murugan.jpg',colors:['red','yellow','green'],category:'india'},
    {id:'jatayu-vadham',title:'Равана похищает Ситу и сражается с Джатаю',artist:'Раджа Рави Варма',year:'1895',image:'assets/restoration/india/jatayu.jpg',colors:['red','green','yellow'],category:'india'}
  ]);
  const DAMAGE=Object.freeze({hue:[-44,-38,-31,-25,24,29,36,43],sat:[.62,.70,.78,1.22,1.30,1.38],light:[.74,.82,.88,1.12,1.20,1.28]});
  const TEXTURES=Object.freeze({
    dirt:['mask_dirt_light_dust.png','mask_dirt_heavy_dust.png','mask_dirt_soot.png','mask_dirt_streaks.png','mask_old_varnish.png'].map(name=>`assets/restoration/masks/${name}`),
    loss:['mask_loss_small_chip.png','mask_loss_large_area.png','mask_loss_abrasion.png','mask_loss_scratch.png'].map(name=>`assets/restoration/masks/${name}`),
    uv:['uv_old_restoration.png','uv_modern_paint.png','uv_false_signature.png','uv_replaced_fragment.png','uv_chemical_stain.png'].map(name=>`assets/restoration/uv/${name}`)
  });
  const textureCache=new Map();
  const root=document.querySelector('#restorationRoot');
  if(!root)return;

  const elements={
    orderButton:root.querySelector('#restorationOrderButton'),orderName:root.querySelector('#restorationOrderName'),orderArtist:root.querySelector('#restorationOrderArtist'),orderGrid:root.querySelector('#restorationOrderGrid'),
    original:root.querySelector('#restorationOriginal'),damaged:root.querySelector('#restorationDamaged'),
    hue:root.querySelector('#restorationHue'),sat:root.querySelector('#restorationSat'),light:root.querySelector('#restorationLight'),
    hueValue:root.querySelector('#restorationHueValue'),satValue:root.querySelector('#restorationSatValue'),lightValue:root.querySelector('#restorationLightValue'),
    loupe:document.querySelector('#restorationLoupeButton'),newDamage:root.querySelector('#restorationNewDamage'),check:root.querySelector('#restorationCheck'),
    score:root.querySelector('#restorationScore'),hint:root.querySelector('#restorationHint'),reward:root.querySelector('#restorationReward'),lightMatch:root.querySelector('#restorationLightMatch'),cleanliness:root.querySelector('#restorationCleanliness'),
    damagedArea:root.querySelector('[data-restoration-art="damaged"]'),dirt:root.querySelector('#restorationDirtSurface'),repair:root.querySelector('#restorationRepairSurface'),overpaint:root.querySelector('#restorationOverpaintSurface'),uv:root.querySelector('#restorationUvSurface'),scan:root.querySelector('#restorationScanSurface'),activeTool:root.querySelector('#restorationActiveTool'),toolEffect:root.querySelector('#restorationToolEffect'),drawer:document.querySelector('#restorationInventoryDrawer'),drawerToggle:document.querySelector('#restorationInventoryToggle'),tools:[...document.querySelectorAll('#restorationInventoryDrawer [data-restoration-tool]')]
  };
  let completed={};
  try{completed=JSON.parse(STORE.getItem(STORAGE_KEY)||'{}')||{};}catch(_){completed={};}
  function ownedPaintingIds(){
    try{
      const ids=JSON.parse(STORE.getItem('keynlockOwnedPaintings')||'[]');
      return new Set(Array.isArray(ids)?ids:[]);
    }catch(_){return new Set();}
  }
  const state={painting:0,hue:0,sat:100,light:100,damage:{hue:34,sat:.72,light:1.18},tool:'loupe',loupe:true,working:false,toolActing:false,lastPoint:null,lastMetricAt:0,damageReady:false,initialDirt:1,initialContamination:1,layerRefresh:0,layerImages:{dirt:'',repair:'',overpaint:'',scan:''},checked:false,started:false,focus:{x:50,y:50,pinned:false}};
  function restorationItemAt(x,y){
    let nearest=null;
    elements.tools.filter(item=>!item.disabled).forEach(item=>{
      const rect=item.getBoundingClientRect(),isUv=item.dataset.restorationTool==='uv';
      const top=rect.top-(isUv?Math.max(55,rect.height*.8):0),side=isUv?Math.max(12,rect.width*.35):0;
      if(x<rect.left-side||x>rect.right+side||y<top||y>rect.bottom)return;
      const distance=(x-(rect.left+rect.right)/2)**2+(y-(top+rect.bottom)/2)**2;
      if(!nearest||distance<nearest.distance)nearest={item,distance};
    });
    return nearest?.item||null;
  }
  const drawerController=window.KeynlockEquipmentDrawers?.create({root:'#restorationInventoryDrawer',toggle:'#restorationInventoryToggle',bodyClass:'restoration-inventory-open',openLabel:'Открыть инвентарь реставратора',closeLabel:'Закрыть инвентарь реставратора',approachVar:'--equipment-approach',approachLift:42,approachDepth:90,itemSelector:'.equipmentInventoryItem:not(:disabled)',routeVisualItems:true,hitTest:restorationItemAt,ignoreApproach:event=>Boolean(event.target.closest?.('.restorationArtwork,.restorationSliders'))});
  const TOOL_IMAGES={
    brush:{idle:'assets/restoration/tools/brush.png',active:'assets/restoration/tools/brush-active.png'},
    paint:{idle:'assets/restoration/tools/retouch-brush.png',active:'assets/restoration/tools/retouch-brush-active.png'},
    uv:{idle:'assets/restoration/tools/uv-lamp.png',active:'assets/restoration/tools/uv-lamp-active.png'},
    reagent:{idle:'assets/restoration/tools/dropper.png',active:'assets/restoration/tools/dropper-active.png'}
  };
  const pick=array=>array[Math.floor(Math.random()*array.length)];
  const current=()=>PAINTINGS[state.painting];
  const JAPANESE_IDS=new Set(['great-wave','red-fuji','kajikazawa','sea-satta','sudden-shower','plum-garden','ejiri','umezawa','inume','mishima','shono','yokkaichi','kameyama','nihonbashi','kanbara']);
  const categoryOf=painting=>painting.category||(JAPANESE_IDS.has(painting.id)?'japan':(['mona-lisa','birth-venus'].includes(painting.id)?'renaissance':(['girl-pearl','las-meninas'].includes(painting.id)?'baroque':(['sunflowers','starry-night','impression-sunrise'].includes(painting.id)?'impressionism':'modern'))));
  const PAINTING_DISTRICTS=Object.freeze({japan:'port',china:'port',korea:'port',india:'port',impressionism:'arts',modern:'arts',rococo:'bohemian',romanticism:'bohemian',symbolism:'bohemian',surrealism:'industrial',renaissance:'upper',baroque:'upper'});
  const districtOf=painting=>{
    const categoryDistrict=PAINTING_DISTRICTS[categoryOf(painting)]||'arts';
    if(categoryDistrict==='port') return 'port';
    const bucket=[...painting.id].reduce((sum,character)=>sum+character.charCodeAt(0),0)%11;
    if(bucket===0) return 'palace';
    if(bucket===1) return 'old';
    return categoryDistrict;
  };
  PAINTINGS.forEach(painting=>{painting.district=districtOf(painting);});
  function yearStart(year){
    const numeric=year.match(/\d{3,4}/);
    if(numeric)return Number(numeric[0]);
    const roman=year.match(/[IVXLCDM]+/);
    if(!roman)return Number.MAX_SAFE_INTEGER;
    const values={I:1,V:5,X:10,L:50,C:100,D:500,M:1000};let total=0,previous=0;
    [...roman[0]].reverse().forEach(character=>{const value=values[character];if(value<previous)total-=value;else{total+=value;previous=value;}});
    return Math.max(0,(total-1)*100);
  }
  const ORDER_CATEGORIES=[['all','Все'],['japan','Укиё-э'],['china','Китай'],['korea','Корея'],['india','Индия'],['renaissance','Возрождение'],['baroque','Барокко'],['rococo','Рококо'],['impressionism','Импрессионизм'],['modern','Модерн'],['romanticism','Романтизм'],['symbolism','Символизм'],['surrealism','Сюрреализм']];
  let orderCategory='all';

  function filterValue(){
    return `hue-rotate(${state.damage.hue+state.hue}deg) saturate(${(state.damage.sat*state.sat/100).toFixed(4)}) brightness(${(state.damage.light*state.light/100).toFixed(4)})`;
  }
  function score(){
    const hueScore=Math.max(0,1-Math.abs(state.damage.hue+state.hue)/60);
    const satScore=Math.max(0,1-Math.abs(state.damage.sat*state.sat/100-1)/.6);
    const lightScore=Math.max(0,1-Math.abs(state.damage.light*state.light/100-1)/.5);
    return Math.max(0,Math.min(100,Math.round((hueScore*.38+satScore*.31+lightScore*.31)*100)));
  }
  function alphaTotal(canvas){
    const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let total=0;
    for(let i=3;i<data.length;i+=16)total+=data[i];
    return total;
  }
  function contamination(){return alphaTotal(elements.dirt)+alphaTotal(elements.uv)+alphaTotal(elements.overpaint);}
  function cleanliness(){return Math.max(0,Math.min(100,Math.round((1-contamination()/Math.max(1,state.initialContamination))*100)));}
  function dirtCleanliness(){return Math.max(0,Math.min(100,Math.round((1-alphaTotal(elements.dirt)/Math.max(1,state.initialDirt))*100)));}
  function dirtReady(){return state.damageReady&&dirtCleanliness()>=99;}
  function uvSearchComplete(){const hidden=alphaTotal(elements.uv);return hidden<25||alphaTotal(elements.scan)>=hidden*.96;}
  function renderMetrics(){
    elements.lightMatch.textContent=`${score()}%`;elements.cleanliness.textContent=`${cleanliness()}%`;
    root.classList.toggle('show-check-result',state.checked);
    const ready=dirtReady();
    elements.tools.forEach(button=>{if(['paint','uv','reagent'].includes(button.dataset.restorationTool))button.disabled=!ready;});
  }
  function resetControls(){
    state.hue=0;state.sat=100;state.light=100;state.checked=false;
    elements.hue.value='0';elements.sat.value='100';elements.light.value='100';
  }
  function newDamage(){
    state.damage={hue:pick(DAMAGE.hue),sat:pick(DAMAGE.sat),light:pick(DAMAGE.light)};
    state.focus.pinned=false;state.lastPoint=null;state.damageReady=false;
    hideLenses();
    resetControls();
    renderLive();
    requestAnimationFrame(initDamageSurfaces);
  }
  function renderOrders(){
    const selected=current();
    const owned=ownedPaintingIds();
    elements.orderName.textContent=`${selected.title} (${selected.year})`;
    elements.orderArtist.textContent=selected.artist;
    const categories=`<nav class="restorationOrderCategories" aria-label="Категории картин">${ORDER_CATEGORIES.map(([id,label])=>`<button type="button" data-order-category="${id}" class="${id===orderCategory?'active':''}">${label}</button>`).join('')}</nav>`;
    const filtered=PAINTINGS.map((painting,index)=>({painting,index})).filter(({painting})=>orderCategory==='all'||categoryOf(painting)===orderCategory).sort((a,b)=>orderCategory==='all'?a.index-b.index:yearStart(a.painting.year)-yearStart(b.painting.year)||a.painting.title.localeCompare(b.painting.title,'ru'));
    const orderColumns=window.innerWidth<=680?3:(window.innerWidth<=900?4:5);
    const skeletonCount=orderCategory==='all'?0:Math.max(0,orderColumns*3-filtered.length);
    const skeletons=Array.from({length:skeletonCount},()=>'<div class="restorationOrderCard restorationOrderSkeleton" aria-hidden="true"><i></i><span></span><small></small></div>').join('');
    elements.orderGrid.innerHTML=categories+filtered.map(({painting,index})=>`
      <button class="restorationOrderCard${index===state.painting?' active':''}" type="button" data-painting="${index}" data-district="${painting.district}" style="--district-color:${DISTRICTS[painting.district].hex}" aria-label="${painting.title}, ${painting.artist}; ${DISTRICTS[painting.district].name}">
        <img src="${painting.image}" alt="">
        ${owned.has(painting.id)?`<i class="restorationOrderStatus restorationOrderFound" title="Найдена в миссии" aria-label="Найдена в миссии">${tablerIcon('eye',14)}</i>`:''}
        ${completed[painting.id]?`<i class="restorationOrderStatus restorationOrderCompleted" title="Отреставрирована" aria-label="Отреставрирована">${tablerIcon('check',14)}</i>`:''}
        <span>${painting.title} (${painting.year})</span>
        <small>${painting.artist}</small>
      </button>`).join('')+skeletons;
  }
  function closeOrders(){
    elements.orderGrid.hidden=true;
    elements.orderButton.setAttribute('aria-expanded','false');
  }
  function showOriginalActionDenied(){
    const originalArea=elements.original.closest('[data-restoration-art="original"]');
    originalArea.classList.remove('action-denied');
    void originalArea.offsetWidth;
    originalArea.classList.add('action-denied');
    clearTimeout(showOriginalActionDenied.timer);
    showOriginalActionDenied.timer=setTimeout(()=>originalArea.classList.remove('action-denied'),360);
  }
  function renderPainting(){
    const painting=current();
    const applyRatio=()=>{
      if(!elements.original.naturalWidth||!elements.original.naturalHeight)return;
      const ratio=Math.max(.55,Math.min(2.8,elements.original.naturalWidth/elements.original.naturalHeight));
      root.dataset.orientation=ratio<.86?'portrait':ratio>1.18?'landscape':'square';
      root.style.setProperty('--painting-ratio',String(ratio));
      sizePaintings();
      requestAnimationFrame(initDamageSurfaces);
      if(state.focus.pinned)placePinnedLenses();
    };
    elements.original.addEventListener('load',applyRatio,{once:true});
    elements.original.src=painting.image;
    elements.damaged.src=painting.image;
    elements.original.alt=`${painting.artist}, «${painting.title}», ${painting.year}`;
    elements.damaged.alt=`Повреждённая версия: ${painting.artist}, «${painting.title}»`;
    if(elements.original.complete)applyRatio();
    renderLive();
  }
  function sizePaintings(){
    const ratio=Number.parseFloat(getComputedStyle(root).getPropertyValue('--painting-ratio'))||1.35;
    const workspace=root.querySelector('.restorationWorkspace');
    const controls=root.querySelector('.restorationControls');
    const gap=7;
    const columnWidth=Math.max(180,(root.clientWidth-gap)/2-16);
    const availableHeight=Math.max(180,root.clientHeight-(controls?.offsetHeight||112)-gap-38);
    const heightBudget=root.dataset.orientation==='portrait'?availableHeight*.9:availableHeight;
    const width=Math.floor(Math.min(columnWidth,heightBudget*ratio));
    workspace.style.setProperty('--painting-width',`${width}px`);
    root.style.setProperty('--composition-width',`${Math.min(root.clientWidth,width*2+35)}px`);
  }
  function prepareCanvas(canvas){
    const width=Math.max(1,Math.round(elements.damagedArea.clientWidth));
    const height=Math.max(1,Math.round(elements.damagedArea.clientHeight));
    canvas.width=width;canvas.height=height;
    return canvas.getContext('2d');
  }
  function refreshLayerImages(){
    if(state.layerRefresh)return;
    state.layerRefresh=requestAnimationFrame(()=>{
      state.layerRefresh=0;
      state.layerImages={dirt:elements.dirt.toDataURL(),repair:elements.repair.toDataURL(),overpaint:elements.overpaint.toDataURL(),scan:elements.scan.toDataURL()};
      if(state.focus.pinned)placePinnedLenses();
    });
  }
  function loadTexture(src){
    if(!textureCache.has(src))textureCache.set(src,new Promise(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=src;}));
    return textureCache.get(src);
  }
  async function stampTextures(ctx,sources,count,w,h,minScale,maxScale){
    const images=(await Promise.all(sources.map(loadTexture))).filter(Boolean);
    for(let i=0;i<count&&images.length;i++){
      const image=pick(images),scale=minScale+Math.random()*(maxScale-minScale);
      const drawW=w*scale,drawH=drawW*image.naturalHeight/image.naturalWidth;
      const x=Math.random()*w,y=Math.random()*h;
      ctx.save();ctx.translate(x,y);ctx.rotate((Math.random()-.5)*1.4);ctx.globalAlpha=.72+Math.random()*.25;ctx.drawImage(image,-drawW/2,-drawH/2,drawW,drawH);ctx.restore();
    }
  }
  async function initDamageSurfaces(){
    if(!elements.damagedArea.clientWidth)return;
    const dirt=prepareCanvas(elements.dirt),repair=prepareCanvas(elements.repair),overpaint=prepareCanvas(elements.overpaint),uv=prepareCanvas(elements.uv),scan=prepareCanvas(elements.scan);
    const w=elements.dirt.width,h=elements.dirt.height;
    await Promise.all([stampTextures(dirt,TEXTURES.dirt,8,w,h,.09,.2),stampTextures(repair,TEXTURES.loss,4,w,h,.055,.13),stampTextures(uv,TEXTURES.uv,5,w,h,.05,.1)]);
    overpaint.clearRect(0,0,w,h);scan.clearRect(0,0,w,h);
    state.initialDirt=Math.max(1,alphaTotal(elements.dirt));state.initialContamination=Math.max(1,contamination());state.damageReady=true;refreshLayerImages();renderMetrics();
  }
  function canvasPoint(event){
    const rect=elements.damagedArea.getBoundingClientRect();
    return {x:(event.clientX-rect.left)/rect.width*elements.dirt.width,y:(event.clientY-rect.top)/rect.height*elements.dirt.height};
  }
  function softEraseAt(canvas,point,radius){
    const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(point.x,point.y,0,point.x,point.y,radius);
    gradient.addColorStop(0,'rgba(0,0,0,.9)');gradient.addColorStop(.62,'rgba(0,0,0,.58)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    ctx.save();ctx.globalCompositeOperation='destination-out';ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function softStroke(canvas,from,to,radius){
    const distance=Math.hypot(to.x-from.x,to.y-from.y),steps=Math.max(1,Math.ceil(distance/(radius*.22)));
    for(let i=0;i<=steps;i++)softEraseAt(canvas,{x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps},radius);
  }
  function useActiveTool(event){
    if(event.currentTarget!==elements.damagedArea)return;
    const point=canvasPoint(event),from=state.lastPoint||point;
    state.checked=false;
    if(state.tool==='brush'){
      softStroke(elements.dirt,from,point,28);softStroke(elements.overpaint,from,point,28);
      elements.hint.textContent=dirtCleanliness()<99?'Продолжай очищать видимую грязь по всему полотну.':(alphaTotal(elements.overpaint)>25?'Видимая грязь удалена. Теперь счисти участки, проявленные реагентом.':'Очистка завершена. Можно перейти к УФ-диагностике или восстановлению утрат.');
    }
    if(state.tool==='paint')softStroke(elements.repair,from,point,20);
    state.lastPoint=point;
    if(performance.now()-state.lastMetricAt>120){state.lastMetricAt=performance.now();renderMetrics();}
  }
  function selectTool(tool){
    if(state.tool===tool){
      state.tool='';state.loupe=false;state.working=false;state.toolActing=false;state.lastPoint=null;state.focus.pinned=false;root.dataset.activeTool='';
      root.classList.remove('original-tool-blocked');
      elements.tools.forEach(button=>button.classList.remove('active'));
      elements.damagedArea.classList.remove('tool-brush','tool-paint','tool-uv','tool-reagent','working');
      hideLenses();updateToolVisual();elements.hint.textContent='Инструмент убран. Выбери следующий этап работы.';return;
    }
    if(['paint','uv','reagent'].includes(tool)&&!dirtReady()){elements.hint.textContent='Сначала полностью очисти картину щёткой.';return;}
    state.tool=tool;state.loupe=tool==='loupe';state.working=false;state.toolActing=false;state.lastPoint=null;root.dataset.activeTool=tool;
    if(state.loupe)root.classList.remove('original-tool-blocked');
    elements.tools.forEach(button=>button.classList.toggle('active',button.dataset.restorationTool===tool));
    elements.damagedArea.classList.remove('tool-brush','tool-paint','tool-uv','tool-reagent','working');
    elements.damagedArea.classList.add(`tool-${tool}`);
    if(!state.loupe){state.focus.pinned=false;hideLenses();}
    syncLenses();
    const hasScan=alphaTotal(elements.scan)>25;
    const hints={loupe:'Изучи детали и закрепи лупу кликом.',brush:dirtCleanliness()<99?'Сначала очисти полотно от видимой грязи.':'Удаляй щёткой только уже проявленные реагентом вмешательства.',paint:'Проводи кончиком кисти по тёмным утраченным участкам.',uv:uvSearchComplete()?'Все скрытые следы уже обнаружены. Теперь используй реагент.':'Медленно освети всё полотно, чтобы обнаружить скрытые вмешательства.',reagent:hasScan?'Наноси реагент только на участки, уже обнаруженные УФ-светом.':'Сначала исследуй полотно УФ-фонарём — проявленных участков пока нет.'};
    elements.hint.textContent=hints[tool];
  }
  function setDrawerOpen(force){
    drawerController?.setOpen(force);
  }
  function updateToolVisual(){
    const images=TOOL_IMAGES[state.tool];
    if(!images){elements.activeTool.classList.remove('visible','acting');elements.toolEffect.classList.remove('visible');return;}
    const active=state.toolActing||state.tool==='uv';
    elements.activeTool.src=active?images.active:images.idle;elements.activeTool.classList.toggle('acting',active);
    if(state.tool==='uv'){elements.toolEffect.src='assets/restoration/effects/effect_uv_spot.png';elements.toolEffect.classList.add('visible');}
    else if(state.tool==='brush'&&state.toolActing){elements.toolEffect.src='assets/restoration/effects/effect_brush_dust.png';elements.toolEffect.classList.add('visible');}
    else elements.toolEffect.classList.remove('visible');
  }
  function setToolActing(active){state.toolActing=active;updateToolVisual();}
  function moveActiveTool(event){
    if(!TOOL_IMAGES[state.tool]){elements.activeTool.classList.remove('visible');elements.toolEffect.classList.remove('visible');return;}
    const rect=elements.damagedArea.getBoundingClientRect();
    const left=`${event.clientX-rect.left}px`,top=`${event.clientY-rect.top}px`;
    elements.activeTool.style.left=left;elements.activeTool.style.top=top;elements.toolEffect.style.left=left;elements.toolEffect.style.top=top;elements.activeTool.classList.add('visible');updateToolVisual();
  }
  function scanUltraviolet(event){
    if(state.tool!=='uv'||event.currentTarget!==elements.damagedArea)return;
    const {x,y}=canvasPoint(event),radius=64,target=elements.scan.getContext('2d');
    elements.damagedArea.style.setProperty('--scan-x',`${x/elements.scan.width*100}%`);elements.damagedArea.style.setProperty('--scan-y',`${y/elements.scan.height*100}%`);
    target.save();target.beginPath();target.arc(x,y,radius,0,Math.PI*2);target.clip();target.drawImage(elements.uv,0,0);target.restore();
    if(performance.now()-state.lastMetricAt>180){state.lastMetricAt=performance.now();elements.hint.textContent=uvSearchComplete()?'Все скрытые следы обнаружены. Выбери реагент и прояви подсвеченные участки.':'Продолжай вести УФ-фонарём по неисследованным участкам полотна.';}
  }
  function applyDiagnosticReagent(event){
    if(state.tool!=='reagent'||event.currentTarget!==elements.damagedArea)return;
    const {x,y}=canvasPoint(event),pixel=elements.scan.getContext('2d').getImageData(Math.round(x),Math.round(y),1,1).data;
    if(pixel[3]<=25){elements.hint.textContent=alphaTotal(elements.scan)>25?'На этом участке нет УФ-следа. Выбери видимое подсвеченное пятно.':'Сначала найди скрытые пятна УФ-фонарём — реагент пока наносить не на что.';return;}
    state.checked=false;setToolActing(true);setTimeout(()=>{if(state.tool==='reagent')setToolActing(false);},260);
    const radius=46,source=elements.uv.getContext('2d'),scan=elements.scan.getContext('2d'),target=elements.overpaint.getContext('2d');
    target.save();target.beginPath();target.arc(x,y,radius,0,Math.PI*2);target.clip();target.drawImage(elements.uv,0,0);target.restore();
    source.save();source.globalCompositeOperation='destination-out';source.beginPath();source.arc(x,y,radius,0,Math.PI*2);source.fill();source.restore();
    scan.save();scan.globalCompositeOperation='destination-out';scan.beginPath();scan.arc(x,y,radius,0,Math.PI*2);scan.fill();scan.restore();
    const reaction=document.createElement('img');
    reaction.className='restorationReaction';reaction.alt='';reaction.src=`assets/restoration/reactions/reaction_${pick(['red','green','violet'])}.png`;
    reaction.style.left=`${x/elements.uv.width*100}%`;reaction.style.top=`${y/elements.uv.height*100}%`;
    elements.damagedArea.append(reaction);setTimeout(()=>reaction.remove(),1400);
    refreshLayerImages();renderMetrics();
    elements.hint.textContent=alphaTotal(elements.scan)>25?'Пятно проявлено. Отметь оставшиеся подсвеченные участки.':'Все найденные пятна проявлены. Теперь выбери щётку и очисти их.';
  }
  function renderLive(){
    elements.damaged.style.filter=filterValue();
    [elements.hue,elements.sat,elements.light].forEach(input=>input.style.setProperty('--range-progress',`${(Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min))*100}%`));
    elements.hueValue.textContent=String(state.hue);
    elements.satValue.textContent=`${state.sat}%`;
    elements.lightValue.textContent=`${state.light}%`;
    renderMetrics();
    if(!state.checked){
      elements.score.textContent='—';
      elements.score.classList.remove('good');
      elements.hint.textContent=`Добейся совпадения не ниже ${TARGET_SCORE}%.`;
      elements.reward.hidden=true;
    }
    syncLenses();
  }
  function rewardMarkup(result){
    const rows=Object.entries(result.components).map(([id,count])=>{
      const component=window.KeynlockResources.components.find(item=>item.id===id);
      return `<span><i style="--reward-color:${component?.color||'#888'}"></i>+${count} ${component?.name||id}</span>`;
    }).join('');
    return `<b>Награда</b><span>+${result.coins} монет</span>${rows}`;
  }
  function checkRestoration(){
    const value=score();
    const clean=cleanliness();
    state.checked=true;
    renderMetrics();
    const success=value>=TARGET_SCORE&&clean>=100;
    elements.score.textContent=`${value}%`;
    elements.score.classList.toggle('good',success);
    if(!success){
      elements.hint.textContent=value<TARGET_SCORE&&clean<100?'Нужно точнее подобрать цвет и полностью очистить картину.':(value<TARGET_SCORE?'Цвет всё ещё отличается от оригинала.':`Очистка не завершена: ${clean}%. Удали все видимые и проявленные загрязнения.`);
      elements.reward.hidden=true;return;
    }
    const painting=current();
    if(completed[painting.id]){
      elements.hint.textContent='Картина уже была восстановлена. Это тренировочная попытка.';
      elements.reward.hidden=true;
      return;
    }
    completed[painting.id]={score:value,completedAt:new Date().toISOString()};
    STORE.setItem(STORAGE_KEY,JSON.stringify(completed));
    const result=window.KeynlockResources?.awardRestoration?.({coins:50,componentCount:2,preferredColors:painting.colors})||{coins:50,components:{}};
    elements.hint.textContent='Картина восстановлена и возвращена заказчику.';
    elements.reward.innerHTML=rewardMarkup(result);
    elements.reward.hidden=false;
    renderOrders();
  }
  function syncLenses(){
    root.querySelectorAll('.restorationLens').forEach(lens=>lens.classList.toggle('enabled',state.loupe));
    elements.loupe.classList.toggle('active',state.loupe);
    if(state.loupe&&state.focus.pinned)placePinnedLenses();
  }
  function setFocusFromEvent(event){
    const area=event.currentTarget;
    const rect=area.getBoundingClientRect();
    const x=Math.max(0,Math.min(rect.width,event.clientX-rect.left));
    const y=Math.max(0,Math.min(rect.height,event.clientY-rect.top));
    state.focus.x=x/rect.width*100;
    state.focus.y=y/rect.height*100;
  }
  function moveLenses(event){
    if(!state.loupe||state.focus.pinned)return;
    setFocusFromEvent(event);
    placeLenses(false);
  }
  function placeLenses(pinned){
    root.querySelectorAll('.restorationArtwork').forEach(target=>{
      const lens=target.querySelector('.restorationLens');
      const lensImage=lens.querySelector('i');
      const img=target.querySelector('img');
      const x=target.clientWidth*state.focus.x/100;
      const y=target.clientHeight*state.focus.y/100;
      lens.style.left=`${state.focus.x}%`;
      lens.style.top=`${state.focus.y}%`;
      const overlays=img===elements.damaged?[...(['uv','reagent'].includes(state.tool)?[state.layerImages.scan]:[]),state.layerImages.overpaint,state.layerImages.repair,state.layerImages.dirt].filter(Boolean):[];
      const size=`${target.clientWidth*2.7}px ${target.clientHeight*2.7}px`;
      const position=`${64-x*2.7}px ${64-y*2.7}px`;
      lensImage.style.setProperty('--lens-base',`url("${img.src}")`);
      lensImage.style.setProperty('--lens-base-filter',img===elements.damaged?filterValue():'none');
      lensImage.style.setProperty('--lens-overlays',overlays.length?overlays.map(src=>`url("${src}")`).join(','):'none');
      lensImage.style.setProperty('--lens-size',overlays.length?overlays.map(()=>size).join(','):size);
      lensImage.style.setProperty('--lens-position',overlays.length?overlays.map(()=>position).join(','):position);
      lens.classList.add('visible');
      lens.classList.toggle('pinned',pinned);
    });
  }
  function placePinnedLenses(){
    placeLenses(true);
  }
  function togglePinnedLens(event){
    if(!state.loupe)return;
    if(state.focus.pinned){state.focus.pinned=false;hideLenses();return;}
    setFocusFromEvent(event);
    state.focus.pinned=true;
    placePinnedLenses();
  }
  function hideLenses(){if(state.focus.pinned)return;root.querySelectorAll('.restorationLens').forEach(lens=>lens.classList.remove('visible','pinned'));}
  function start(){
    setDrawerOpen(false);
    state.started=true;
    const previous=state.painting;
    state.painting=PAINTINGS.length>1?(previous+1+Math.floor(Math.random()*(PAINTINGS.length-1)))%PAINTINGS.length:0;
    closeOrders();renderOrders();newDamage();renderPainting();
    requestAnimationFrame(sizePaintings);
  }

  [['hue','hue'],['sat','sat'],['light','light']].forEach(([element,key])=>elements[element].addEventListener('input',event=>{state[key]=Number(event.target.value);state.checked=false;renderLive();}));
  elements.orderButton.addEventListener('click',()=>{const open=elements.orderGrid.hidden;elements.orderGrid.hidden=!open;elements.orderButton.setAttribute('aria-expanded',String(open));});
  elements.orderGrid.addEventListener('click',event=>{const category=event.target.closest('[data-order-category]');if(category){orderCategory=category.dataset.orderCategory;renderOrders();return;}const card=event.target.closest('[data-painting]');if(!card)return;state.painting=Number(card.dataset.painting)||0;closeOrders();newDamage();renderPainting();renderOrders();});
  elements.newDamage.addEventListener('click',newDamage);
  elements.check.addEventListener('click',checkRestoration);
  elements.tools.forEach(button=>button.addEventListener('click',()=>selectTool(button.dataset.restorationTool)));
  root.querySelectorAll('.restorationArtwork').forEach(area=>{area.addEventListener('pointerenter',event=>{root.classList.toggle('original-tool-blocked',area.dataset.restorationArt==='original'&&Boolean(state.tool)&&state.tool!=='loupe');moveLenses(event);moveActiveTool(event);});area.addEventListener('pointermove',event=>{moveLenses(event);scanUltraviolet(event);if(state.working)useActiveTool(event);});area.addEventListener('pointerleave',()=>{root.classList.remove('original-tool-blocked');hideLenses();state.working=false;state.toolActing=false;state.lastPoint=null;elements.damagedArea.classList.remove('working');});area.addEventListener('click',event=>{if(area.dataset.restorationArt==='original'&&state.tool&&state.tool!=='loupe'){showOriginalActionDenied();return;}togglePinnedLens(event);applyDiagnosticReagent(event);});});
  elements.damagedArea.addEventListener('pointerdown',event=>{if(!['brush','paint'].includes(state.tool))return;state.working=true;state.lastPoint=null;setToolActing(true);elements.damagedArea.classList.add('working');elements.damagedArea.setPointerCapture?.(event.pointerId);useActiveTool(event);});
  const finishStroke=()=>{state.working=false;state.lastPoint=null;setToolActing(false);elements.damagedArea.classList.remove('working');refreshLayerImages();renderMetrics();};
  elements.damagedArea.addEventListener('pointerup',finishStroke);elements.damagedArea.addEventListener('pointercancel',finishStroke);
  document.addEventListener('pointermove',event=>{if(root.closest('.lairPanel')?.classList.contains('active'))moveActiveTool(event);},{passive:true});
  document.addEventListener('pointerdown',event=>{if(elements.orderGrid.hidden||event.target.closest('#restorationOrderGrid,#restorationOrderButton'))return;closeOrders();});
  window.addEventListener('resize',()=>{sizePaintings();if(!elements.orderGrid.hidden)renderOrders();});

  window.KeynlockRestoration=Object.freeze({start,paintings:PAINTINGS});
})();
