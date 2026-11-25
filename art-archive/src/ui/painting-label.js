import {getLanguage,paintingTitle,paintingArtist} from '../localization/i18n.js';

const nationality={
  Algerian:'DZ',American:'US',Austrian:'AT',British:'GB',Castilian:'ES',Chinese:'CN',
  Cretan:'GR',Danish:'DK',Dutch:'NL',French:'FR',German:'DE',Hungarian:'HU',Indian:'IN',
  Italian:'IT',Japanese:'JP',Korean:'Korea',Norwegian:'NO',Persian:'IR',Russian:'RU',
  Scottish:'Scotland',Spanish:'ES',Swedish:'SE',Swiss:'CH',Flemish:'Flanders',
  Netherlandish:'NetherlandsHistorical',
};
const regions={
  Algeria:'DZ',Austria:'AT',China:'CN',Denmark:'DK',England:'GB',France:'FR',
  Germany:'DE',Hungary:'HU',India:'IN',Italy:'IT',Japan:'JP',Korea:'Korea',
  Netherlands:'NL',Norway:'NO',Russia:'RU',Spain:'ES',Sweden:'SE',Switzerland:'CH',
  'United States':'US','Mughal India':'IN','Northwestern India':'IN',
  Scotland:'Scotland',Flanders:'Flanders',
};
const historical={
  Scotland:{ru:'Шотландия',en:'Scotland'},
  Flanders:{ru:'Фландрия',en:'Flanders'},
  Korea:{ru:'Корея',en:'Korea'},
  NetherlandsHistorical:{ru:'Исторические Нидерланды',en:'Historical Netherlands'},
};
const displayNames=Object.fromEntries(['ru','en'].map(lang=>[lang,new Intl.DisplayNames(lang,{type:'region'})]));
const artistKey=artist=>artist.split(' (')[0].trim();
const knownArtists={
  'Leonardo da Vinci':'IT','Johannes Vermeer':'NL','Hieronymus Bosch':'NetherlandsHistorical',
  'Jan van Eyck':'NetherlandsHistorical','Raphael':'IT','Jean-Antoine Watteau':'FR',
  'Неизвестный мастер школы Фонтенбло':'FR','Francesco Melzi':'IT','Альбрехт Дюрер':'DE',
  'Domenico Ghirlandaio':'IT','Rembrandt':'NL','Andrea Mantegna':'IT','Georges de La Tour':'FR',
  'Paul Delaroche':'FR','Pisanello':'IT','Jean-Honoré Fragonard':'FR','Théodore Géricault':'FR',
  'Francisco Goya':'ES','Pieter Bruegel the Elder':'NetherlandsHistorical',
  'Rogier van der Weyden':'NetherlandsHistorical','Fra Angelico':'IT','Paul-Jacques-Aimé Baudry':'FR',
  'Giorgione':'IT','Henri Matisse':'FR','Paul Cézanne':'FR','Rosso Fiorentino':'IT',
  'Pontormo':'IT','Caspar David Friedrich':'DE','Pablo Picasso':'ES','Camille Pissarro':'FR',

  'Katsushika Hokusai':'JP','Sandro Botticelli':'IT','Gustav Klimt':'AT','Edvard Munch':'NO',
  'Edgar Degas':'FR','Hans Holbein the Younger':'DE','Artemisia Gentileschi':'IT',
  'Antoine Watteau':'FR','Alphonse Mucha':'CZ','Egon Schiele':'AT','Franz Marc':'DE',
  'J. M. W. Turner':'GB','Henry Fuseli':'CH','John William Waterhouse':'GB','Gustave Moreau':'FR',
  'George Frederic Watts':'GB','Hugo Simberg':'FI','Franz von Stuck':'DE',
  'Mikalojus Čiurlionis':'LT','Carlos Schwabe':'CH','Salvador Dalí':'ES','René Magritte':'BE',
  'Joan Miró':'ES','Max Ernst':'DE','Muqi':'CN','Han Gan':'CN','Zhou Fang':'CN','Qiu Ying':'CN',
  'Qing court workshop master':'CN','Yan Liben':'CN','Utagawa Hiroshige II':'JP',
  'Emperor Huizong':'CN','Shin Yun-bok':'Korea','Unknown minhwa master':'Korea',
  'Kim Hong-do':'Korea','Byeon Sang-byeok':'Korea','Abanindranath Tagore':'IN',
  'Raja Ravi Varma':'IN','Basawan and Chetar Munti':'IN','Nihâl Chand':'IN','Purkhu of Kangra':'IN',
  'Kangra school master':'IN',
};
const nationalityOf=painting=>nationality[painting.artist.match(/\(([A-Za-z]+)(?=[,)])/)?.[1]];
const regionOf=painting=>regions[painting.region?.split(/[,(]/)[0].trim()];

export function createPaintingLabel(element,paintings){
  const authorCountries=new Map();
  for(const painting of paintings){
    const key=artistKey(painting.artist),code=nationalityOf(painting);
    if(code)authorCountries.set(key,code);
    else if(!authorCountries.has(key)&&regionOf(painting))authorCountries.set(key,regionOf(painting));
  }
  let previous,previousLanguage;
  return function showPaintingLabel(painting){
    const lang=getLanguage();
    if(previous===painting&&previousLanguage===lang)return;
    previous=painting;previousLanguage=lang;
    if(!painting||typeof painting==='string'){
      element.textContent=painting??'';return;
    }
    const slot=painting;
    painting=slot.painting;
    const key=artistKey(painting.artist);
    const code=knownArtists[key]??nationalityOf(painting)??authorCountries.get(key)??regionOf(painting);
    const country=code
      ? historical[code]?.[lang]??displayNames[lang].of(code)
      : painting.collection==='keynlock'?(lang==='ru'?'Кеййнлок':'Keynlock'):'';
    const artist=paintingArtist(painting).replace(/\s*\([A-Za-z]+, [^()]*\)$/, '');
    const {width,height}=painting.physicalSizeM??{};
    const number=new Intl.NumberFormat(lang,{maximumFractionDigits:2});
    const dimensions=Number.isFinite(width)&&Number.isFinite(height)
      ? [width,height].map(m=>number.format(m*100)).join(' × ')+(lang==='ru'?' см':' cm') : null;
    const dates=lang==='ru'?painting.year?.replace(/^c\.\s*/,'ок. '):painting.year;
    const details=[dimensions,slot.category??painting.category].filter(Boolean).join(' · ');
    const fragment=element.ownerDocument.createDocumentFragment();
    for(const [className,value] of [['title',paintingTitle(painting)],['artist',artist],['country',[country,dates].filter(Boolean).join(' · ')],['details',details],
      ['badge',slot.destination?.startsWith('center/')?(lang==='ru'?'✦ Шедевр · Ротонда':'✦ Masterpiece · Rotunda'):'']]){
      if(!value)continue;
      const line=element.ownerDocument.createElement(className==='title'?'strong':'span');
      line.className='painting-label-'+className;line.textContent=value;fragment.append(line);
    }
    element.replaceChildren(fragment);
  };
}
