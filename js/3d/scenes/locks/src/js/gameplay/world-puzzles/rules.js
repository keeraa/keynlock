/**
 * Four canonical chapter-one puzzles, ported from keeraa/keynlock v372.
 * This module deliberately knows nothing about Three.js, DOM or storage.
 * Every choice returns a semantic outcome; rendering is a separate adapter.
 */
export const CHAPTER_MISSIONS = Object.freeze([
  { id: 'wharf', title: 'Задвижки набережной', place: 'Старый порт',
    objective: 'Открой задвижки в скрытом порядке. Ошибка сбрасывает последовательность.',
    instruction: 'Пробуй соседние задвижки: порядок чаще проходит через близкие механизмы.' },
  { id: 'keyprofile', title: 'Слепок скважины', place: 'Улица мастеров',
    objective: 'Сравни профиль скважины с ключами и вставь подходящий.',
    instruction: 'Выбери ключ с точно таким же рисунком зубцов, как у слепка сверху.' },
  { id: 'pairednodes', title: 'Парные узлы', place: 'Площадь архивов',
    objective: 'Запомни расположение символов и открой все пары.',
    instruction: 'Выбирай по две пластины. Совпадающие символы останутся открытыми.' },
  { id: 'museum', title: 'Символьный замок', place: 'Музей',
    objective: 'Подбери профиль инструмента для каждого тумблера.',
    instruction: 'Полузакрытый знак узнавай по видимой части. Заклинивший повтори.' },
]);

export const PAIRED_SYMBOLS = Object.freeze(['◈','⌁','Ψ','⊙','✦','⌬','☿','♀']);
export const MUSEUM_SYMBOLS = Object.freeze([
  '△','◇','○','⌒','⊥','≋','∩','▽','◁','▷','◊','◌','⌣','◠','☉','☽','☿','♀','♂','♃','♄',
]);

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const integer = (random, low, high) => low + Math.floor(random() * (high - low + 1));

export function shuffle(source, random) {
  const values = [...source];
  for (let i = values.length - 1; i > 0; i--) {
    const j = integer(random, 0, i);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

// A deterministic RNG belongs to the puzzle run and never perturbs the lock scene RNG.
export function makePuzzleRandom(seed) {
  let value = (seed >>> 0) || 0x9e3779b9;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

function makeWharf(level, random) {
  const count = [4, 6, 7][level - 1];
  const sequence = [integer(random, 0, count - 1)];
  while (sequence.length < count) {
    const last = sequence.at(-1);
    const options = Array.from({ length: count }, (_, i) => i)
      .filter(i => !sequence.includes(i))
      .sort((a, b) => Math.abs(a - last) - Math.abs(b - last));
    sequence.push(options[integer(random, 0, Math.min(2, options.length - 1))]);
  }
  let step = 0, selected = 0, stress = 0, wrongIndex = -1, solved = false;
  return {
    view: () => ({ count, step, selected, opened: sequence.slice(0, step), wrongIndex, solved }),
    choose(index) {
      if (solved || index < 0 || index >= count) return { changed: false };
      selected = index;
      if (sequence.slice(0, step).includes(index)) return { changed: true, message: 'Задвижка уже поднята.' };
      if (sequence[step] !== index) {
        step = 0; stress++; wrongIndex = index;
        const damage = stress >= 2;
        if (damage) stress = 0;
        return { changed: true, mistake: true, damage, message: 'Неверный порядок — задвижки вернулись назад.' };
      }
      step++; stress = 0; wrongIndex = -1;
      return { changed: true, ready: step === count, message: step === count
        ? 'Все задвижки подняты. Теперь открой механизм.' : `Задвижка ${index + 1} поднята.` };
    },
    confirm() {
      if (step !== count) return { changed: true, message: 'Сначала подними все задвижки.' };
      solved = true;
      return { changed: true, solved: true, message: 'Замок набережной открыт.' };
    },
    tick() { return false; },
  };
}

function samePattern(a, b) { return a.length === b.length && a.every((value, i) => value === b[i]); }

function makeKeyprofile(level, random) {
  const length = [4, 5, 6][level - 1];
  const target = Array.from({ length }, () => integer(random, 0, 5));
  if (target.every(value => value === target[0])) target[integer(random, 0, length - 1)] = (target[0] + 1) % 6;
  const count = [6, 8, 9][level - 1];
  const options = [target];
  let attempts = 0;
  while (options.length < count && attempts++ < 200) {
    const candidate = [...target];
    for (let n = integer(random, 1, 2); n > 0; n--) {
      const index = integer(random, 0, length - 1);
      candidate[index] = (candidate[index] + integer(random, 1, 5)) % 6;
    }
    if (!options.some(option => samePattern(option, candidate))) options.push(candidate);
  }
  // There is only one valid key, even after random generation of distractors.
  const choices = shuffle(options, random);
  const duration = [70, 45, 30][level - 1] / 3;
  let selected = -1, timeLeft = duration, solved = false;
  return {
    view: () => ({ count: choices.length, target: [...target], options: choices.map(option => [...option]),
      selected, timeLeft, duration, solved }),
    choose(index) {
      if (solved || index < 0 || index >= choices.length) return { changed: false };
      selected = index;
      return { changed: true, message: `Ключ ${index + 1} выбран. Попробуй вставить его.` };
    },
    confirm() {
      if (selected < 0) return { changed: true, message: 'Сначала выбери ключ.' };
      if (!samePattern(choices[selected], target)) {
        selected = -1; timeLeft = duration;
        return { changed: true, mistake: true, damage: true, message: 'Ключ не подходит. Попробуй другой.' };
      }
      solved = true;
      return { changed: true, solved: true, message: 'Профиль совпал. Замок открыт.' };
    },
    tick(dt) {
      if (solved || timeLeft <= 0) return false;
      timeLeft = Math.max(0, timeLeft - dt);
      return timeLeft === 0;
    },
  };
}

function makePairednodes(level, random) {
  // The original chapter's guided round uses four pairs, with eight pairs in standard rounds.
  const symbols = level === 1 ? PAIRED_SYMBOLS.slice(0, 4) : PAIRED_SYMBOLS;
  const nodes = shuffle([...symbols, ...symbols], random);
  const duration = [75, 40, 32][level - 1];
  let selected = -1, pending = [], cooldown = 0, timeLeft = duration;
  const matched = new Set();
  return {
    view: () => ({ count: nodes.length, nodes: [...nodes], selected, pending: [...pending],
      matched: [...matched], timeLeft, duration, cooldown, solved: matched.size === nodes.length }),
    choose(index) {
      if (cooldown > 0 || matched.size === nodes.length || index < 0 || index >= nodes.length || matched.has(index))
        return { changed: false };
      if (selected < 0) {
        selected = index;
        return { changed: true, message: 'Первый символ открыт. Найди пару.' };
      }
      if (index === selected) { selected = -1; return { changed: true, message: 'Выбор отменён.' }; }
      if (nodes[index] === nodes[selected]) {
        matched.add(index); matched.add(selected); selected = -1;
        return { changed: true, solved: matched.size === nodes.length,
          message: matched.size === nodes.length ? 'Все пары найдены.' : 'Пара совпала.' };
      }
      pending = [selected, index]; selected = -1; cooldown = .65;
      return { changed: true, mistake: true, damage: true, message: 'Символы разные. Отмычка повреждена.' };
    },
    confirm() { return { changed: false }; },
    tick(dt) {
      if (cooldown > 0) {
        cooldown = Math.max(0, cooldown - dt);
        if (!cooldown) pending = [];
      }
      if (matched.size === nodes.length || timeLeft <= 0) return false;
      timeLeft = Math.max(0, timeLeft - dt);
      return timeLeft === 0;
    },
  };
}

function makeMuseum(level, random) {
  const count = level === 1 ? 3 : 6;
  const sequence = Array.from({ length: count }, () => integer(random, 0, MUSEUM_SYMBOLS.length - 1));
  const covered = Array(count).fill(null);
  if (level > 1) {
    const coveredIndices = shuffle(Array.from({ length: count }, (_, i) => i), random);
    for (const index of coveredIndices.slice(0, integer(random, 2, 3))) {
      sequence[index] = integer(random, 0, 6);
      covered[index] = random() < .5 ? 'left' : 'right';
    }
  }
  const jam = Array.from({ length: count }, () => level === 1 ? 1 : random() < [0, .25, .35][level - 1] ? 2 : 1);
  const duration = [34, 28, 22][level - 1];
  let step = 0, selected = -1, timeLeft = duration;
  return {
    view: () => ({ count, step, targets: [...sequence], covered: [...covered], jam: [...jam],
      selected, timeLeft, duration, solved: step === count }),
    choose(index) {
      if (step >= count || index < 0 || index >= MUSEUM_SYMBOLS.length) return { changed: false };
      selected = index;
      if (index === sequence[step]) {
        jam[step]--;
        if (jam[step] > 0) return { changed: true, message: 'Профиль заклинило — нажми ещё раз.' };
        step++;
        return { changed: true, solved: step === count, message: step === count
          ? 'Все тумблеры открыты.' : 'Тумблер освобождён.' };
      }
      timeLeft = Math.max(0, timeLeft - 2.2);
      return { changed: true, mistake: true, damage: true, message: 'Неверный профиль. Время сокращено.' };
    },
    confirm() { return { changed: false }; },
    tick(dt) {
      if (step === count || timeLeft <= 0 || level === 1) return false;
      timeLeft = Math.max(0, timeLeft - dt);
      return timeLeft === 0;
    },
  };
}

const FACTORIES = Object.freeze({wharf:makeWharf,keyprofile:makeKeyprofile,
  pairednodes:makePairednodes,museum:makeMuseum});

export function createWorldPuzzle(id, level, random = Math.random) {
  if (!Object.hasOwn(FACTORIES, id)) throw new Error(`Unknown chapter puzzle: ${id}`);
  if (!Number.isInteger(level) || level < 1 || level > 3) throw new Error(`Invalid puzzle level: ${level}`);
  return FACTORIES[id](level, random);
}
