// Local SVG paths: no CDN, font or icon library required.
const paths={grid:'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',brush:'M3 21c3 0 5-1 5-4a4 4 0 0 0-4-4c-2 0-3 2-3 4s1 4 2 4 M9 13L19 3l2 2-10 10',church:'M3 21h18 M5 21V10l7-5 7 5v11 M10 21v-7h4v7 M12 3v4 M10 5h4',flower:'M12 12c-5-5-9-2-7 2s6 2 7-2 M12 12c5-5 9-2 7 2s-6 2-7-2 M12 12c-5 5-2 9 2 7s2-6-2-7 M12 12c5 5 2 9-2 7s-2-6 2-7 M12 12V3',mountain:'M2 20l7-12 4 6 2-3 7 9z',user:'M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8 M5 21v-2a7 7 0 0 1 14 0v2',palette:'M12 3a9 9 0 0 0 0 18c2 0 3-2 2-4s1-3 3-3h2c4-7-2-11-7-11 M7 12h.01 M9 7h.01 M15 7h.01',sun:'M12 4V2 M12 22v-2 M4 12H2 M22 12h-2 M5.6 5.6L4 4 M20 20l-1.6-1.6 M18.4 5.6L20 4 M4 20l1.6-1.6 M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8',feather:'M20 4c-7-1-12 2-14 9-1 3-1 5-2 7 5-5 9-8 14-12 M4 20l12-12',photo:'M4 4h16v16H4z M8 9h.01 M4 17l5-5 4 4 3-3 4 4',heart:'M20.8 8.6C21.6 4 16 2 12 6 8 2 2.4 4 3.2 8.6 4 13 12 20 12 20s8-7 8.8-11.4',check:'M5 12l4 4L19 6',down:'M6 9l6 6 6-6'};
function icon(name){return '<span class="ico"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path d="'+(paths[name]||paths.palette)+'"/></svg></span>'}
function categoryIcon(s){if(!s)return 'grid';if(/Китай|Корей|Япон|Индий/.test(s))return 'feather';if(/Готик|религиоз|икон/.test(s))return 'church';if(/Пейзаж/.test(s))return 'mountain';if(/Портрет/.test(s))return 'user';if(/Натюрморт/.test(s))return 'flower';if(/Импрессионизм/.test(s))return 'sun';return 'palette'}

Object.assign(paths, {
  female: 'M12 14a5 5 0 1 0 0-10a5 5 0 0 0 0 10 M12 14v8 M8 18h8',
  male: 'M10 14a5 5 0 1 0 0-10a5 5 0 0 0 0 10 M14 6l7-4 M16 2h5v5',
  users: 'M9 13a4 4 0 1 0 0-8a4 4 0 0 0 0 8 M2 21v-2a7 7 0 0 1 14 0v2 M17 6a4 4 0 0 1 0 8 M19 16a6 6 0 0 1 3 5',
  waves: 'M2 7c3-3 5 3 8 0s5-3 8 0s3 3 4 0 M2 13c3-3 5 3 8 0s5-3 8 0s3 3 4 0 M2 19c3-3 5 3 8 0s5-3 8 0s3 3 4 0',
  paw: 'M7 12a2 2 0 1 0 0-4a2 2 0 0 0 0 4 M12 8a2 2 0 1 0 0-4a2 2 0 0 0 0 4 M17 12a2 2 0 1 0 0-4a2 2 0 0 0 0 4 M12 12c-3 0-7 4-6 7c1 3 4 1 6 1s5 2 6-1c1-3-3-7-6-7',
  swords: 'M3 3l18 18 M15 3l6 6 M3 9l6-6 M4 20l4-4 M16 8l4-4 M14 14l-4 4',
  question: 'M9 9a3 3 0 1 1 5 2c-2 2-2 2-2 4 M12 19h.01 M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20',
});
function subjectIcon(s) {
  return ({
    'Женщины': 'female', 'Мужчины': 'male', 'Люди и быт': 'users',
    'Природа': 'mountain', 'Вода и корабли': 'waves',
    'Архитектура': 'church', 'Натюрморты': 'flower',
    'Животные': 'paw', 'Мифы и религия': 'sun',
    'История и битвы': 'swords', 'Абстракция и орнамент': 'palette', 'Не определено': 'question',
  })[s] || 'grid';
}
