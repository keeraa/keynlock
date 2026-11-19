export const KEY_TEMPLATES = Object.freeze([
  { id:'cellar', name:'Подвальный', bow:'circle', blade:'warded', metal:'mercury', teeth:3, length:2.15, depth:25, description:'Круглое ушко · простая бородка' },
  { id:'tower', name:'Башенный', bow:'gothic', blade:'stepped', metal:'tin', teeth:4, length:2.5, depth:34, description:'Готическая арка · высокий стержень' },
  { id:'archive', name:'Архивный', bow:'square', blade:'double', metal:'steel', teeth:5, length:2.05, depth:25, description:'Угловатая головка · две стороны' },
  { id:'astral', name:'Астролябия', bow:'gear', blade:'comb', metal:'brass', teeth:5, length:2.3, depth:22, description:'Зубчатый венец · гребёнка' },
  { id:'garden', name:'Садовый', bow:'clover', blade:'warded', metal:'silver', teeth:3, length:1.85, depth:23, description:'Четырёхлистник · тонкая бородка' },
  { id:'clock', name:'Часовой', bow:'diamond', blade:'serrated', metal:'lead', teeth:6, length:2.35, depth:21, description:'Ромб · точная насечка' },
  { id:'palace', name:'Дворцовый', bow:'oval', blade:'ornate', metal:'gold', teeth:4, length:2.75, depth:31, description:'Вытянутый овал · фигурный край' },
  { id:'forge', name:'Кузнечный', bow:'hexagon', blade:'double', metal:'graphite', teeth:3, length:2.55, depth:39, description:'Шестигранник · массивная бородка' },
  { id:'alchemy', name:'Алхимический', bow:'star', blade:'serrated', metal:'copper', teeth:6, length:2.1, depth:25, description:'Звезда · мелкие насечки' },
  { id:'brotherhood', name:'Братства', bow:'twin', blade:'fork', metal:'copper', teeth:4, length:2.4, depth:33, description:'Двойное ушко · парные зубцы' },
]);

export const METALS = Object.freeze([
  { id:'brass', name:'Латунь', color:'#ce9b4c', description:'Старая латунь · золотистые мазки', file:'painted-brass.webp', tint:0xffffff },
  { id:'steel', name:'Сталь', color:'#a1acac', description:'Холодная сталь · светлые гуашевые блики', file:'painted-steel.webp', tint:0xffffff },
  { id:'copper', name:'Медь', color:'#bc704d', description:'Красная медь · неоднородный пигмент', file:'painted-copper.webp', tint:0xffffff },
  { id:'graphite', name:'Чернёное железо', color:'#515c60', description:'Тёмное железо · сухая кисть', file:'painted-graphite.webp', tint:0xffffff },
  { id:'enamel', name:'Эмаль', color:'#648878', description:'Зелёная эмаль · мягкие разводы', file:'painted-enamel.webp', tint:0xffffff },
  { id:'gold', name:'Позолота', color:'#e4b866', description:'Светлая позолота · тёплые высветления', file:'painted-brass.webp', tint:0xffedbb },
  { id:'mercury', name:'Ртуть · символ', color:'#839fa6', description:'Меркурий · холодная серебристо-синяя гуашь', file:'painted-steel.webp', tint:0xc4e3ef },
  { id:'tin', name:'Олово', color:'#b4b7aa', description:'Юпитер · светлое олово с приглушённой зеленью', file:'painted-steel.webp', tint:0xe1e6d0 },
  { id:'lead', name:'Свинец · символ', color:'#489f9c', description:'Сатурн · бирюзовая гуашевая эмаль', file:'painted-enamel.webp', tint:0xffffff },
  { id:'silver', name:'Серебро', color:'#d5d9d6', description:'Луна · прохладное серебро с мягкими мазками', file:'painted-steel.webp', tint:0xffffff },
]);

// Seven lockboxes belong to seven districts. The alchemical metals are lore
// identifiers: the mercury/lead finishes are painted fantasy alloys, not toxic materials.
export const BROTHERHOOD_KEYS = Object.freeze([
  { templateId:'brotherhood', district:'Богемный', alchemicalMetal:'Медь', planet:'Венера', material:'copper', accent:'#b28ba7', meaning:'творчество и красота' },
  { templateId:'palace', district:'Дворцовый', alchemicalMetal:'Золото', planet:'Солнце', material:'gold', accent:'#dcb65e', meaning:'власть и величие' },
  { templateId:'forge', district:'Промышленный', alchemicalMetal:'Железо', planet:'Марс', material:'graphite', accent:'#ce8d59', meaning:'сила и созидание' },
  { templateId:'cellar', district:'Портовый', alchemicalMetal:'Ртуть', planet:'Меркурий', material:'mercury', accent:'#86b2c9', meaning:'торговля и движение' },
  { templateId:'tower', district:'Верхний город', alchemicalMetal:'Олово', planet:'Юпитер', material:'tin', accent:'#a4b58a', meaning:'закон и порядок' },
  { templateId:'clock', district:'Старый квартал', alchemicalMetal:'Свинец', planet:'Сатурн', material:'lead', accent:'#a4aeca', meaning:'время и память' },
  { templateId:'garden', district:'Район искусств', alchemicalMetal:'Серебро', planet:'Луна', material:'silver', accent:'#c8d0d7', meaning:'образы и иллюзии' },
]);

export function brotherhoodBinding(templateId) {
  return BROTHERHOOD_KEYS.find(binding=>binding.templateId===templateId)||null;
}

export const RUST_TEXTURE = 'gouache-rust-overlay.webp';
// Resolve textures relative to the key library itself. A different scene can
// import the library without moving images next to its own index.html.
export function keyAssetUrl(file) { return new URL(`../assets/${file}`,import.meta.url).href; }

export function defaultDesign(index) {
  const t = KEY_TEMPLATES[index];
  return { template:index, metal:t.metal, shaftLength:t.length, headSize:100, teeth:t.teeth,
    cutDepth:t.depth, thickness:t.id==='forge'?17:12, rustAmount:0, dirtAmount:0, waxAmount:0,
    doubleSided: ['double','fork'].includes(t.blade),
    broken:false,breakAngle:70 };
}

// The metal belongs to the key, not to a saved browser draft or UI selection.
export function fixedMetal(templateIndex) {
  const template=KEY_TEMPLATES[templateIndex];
  if(!template)throw new RangeError('Unknown key template');
  return template.metal;
}

export function normalizeKeyDesign(design) {
  // Drop the retired decorative-oval setting from older saved collections.
  const {engraving: _legacyEngraving,...rest}=design;
  return {...rest,metal:fixedMetal(design.template),
    broken:design.broken===true,
    breakAngle:Math.max(60,Math.min(80,Number(design.breakAngle)||70)),
    dirtAmount:Number(design.dirtAmount)>0?100:0,
    waxAmount:Number(design.waxAmount)>0?100:0};
}
