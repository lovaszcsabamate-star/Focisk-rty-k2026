/** Short Hungarian pub commentary. Pure flavour; never delays game state. */

export const SPEAKERS = {
  csapos: { id: 'csapos', name: 'Csapos', colour: '#e8c37a' },
  shady: { id: 'shady', name: 'Shady alak', colour: '#8fbf6a' },
  torzsvendeg: { id: 'torzsvendeg', name: 'Törzsvendég', colour: '#6aa9bf' },
};

const LINES = {
  gameStart: [
    ['csapos', 'Na, osszátok ki. Aki veszít, az hozza a következő kört.'],
    ['shady', 'A lapok nem hazudnak. Az emberek annál inkább.'],
    ['torzsvendeg', 'Csak semmi reklamálás, a VAR ma is szabadságon van.'],
  ],
  youChooseAttribute: {
    birthDate: [
      ['csapos', 'A kölyök még bírja szusszal.'],
      ['shady', 'A személyit azért ne kérd el tőle.'],
    ],
    yellowCards: [
      ['torzsvendeg', 'Ezt még a bíró is felírta.'],
      ['csapos', 'Sárga lapból egész szép gyűjtemény.'],
    ],
    totalDismissals: [
      ['shady', 'Ő már az öltözőből nézi a folytatást.'],
      ['csapos', 'Piros. Egyből a kijárat felé.'],
    ],
  },
  aiChooseAttribute: [
    ['shady', 'A gép ezt mondja: {attr}. Valamit nagyon tud.'],
    ['csapos', '{attr}? Legyen, de utána nincs reklamáció.'],
  ],
  attributeWin: {
    birthDate: [['csapos', 'A kölyök még bírja szusszal.']],
    yellowCards: [['torzsvendeg', 'Ezt még a bíró is felírta.']],
    totalDismissals: [['shady', 'Ő már az öltözőből nézi a folytatást.']],
  },
  youWin: [
    ['csapos', 'Szép volt. Ezt a csapos állja.'],
    ['torzsvendeg', '{card} most rendesen odatette magát.'],
  ],
  youWinBig: [
    ['csapos', 'Ez simább volt, mint a kocsmapult.'],
    ['shady', 'Ez nem párbaj volt, hanem bemutató.'],
  ],
  youLose: [
    ['shady', 'A shady alak csak vigyorog.'],
    ['torzsvendeg', 'Ezt a lapot jobb lett volna a kezedben tartani.'],
  ],
  youLoseClose: [
    ['csapos', 'Egy hajszál. Vagy egy rosszul húzott vonal.'],
    ['torzsvendeg', 'Ennél közelebb már csak a pult széle van.'],
  ],
  tie: [
    ['csapos', 'A VAR sem tud dönteni.'],
    ['shady', 'Ugyanaz az érték. Ettől még egyikük sem boldog.'],
  ],
  potScooped: [
    ['torzsvendeg', 'És viszi az asztalon maradt lapokat is.'],
  ],
  suddenDeath: [
    ['shady', 'Most már minden lap számít.'],
    ['csapos', 'Hirtelen halál. Most ne remegjen a kéz.'],
  ],
  reshuffle: [
    ['csapos', 'Elfogyott a tizenegy. Ugyanazok új sorrendben.'],
  ],
  idle: [
    ['csapos', 'Valakinek fogy a söre. Remélem, nem az enyém.'],
    ['torzsvendeg', 'Régen az ilyen párbajokat sárban játszották.'],
    ['shady', 'A következő lap mindig többet ér. Kivéve, amikor nem.'],
  ],
  gameOverWin: [
    ['csapos', 'Ezt a csapos állja. Megérdemelt győzelem.'],
  ],
  gameOverLose: [
    ['shady', 'A shady alak csak vigyorog.'],
  ],
  gameOverTie: [
    ['torzsvendeg', 'Döntetlen. Legalább senki nem borította fel az asztalt.'],
  ],
};

const lastUsed = new Map();
let lastSpeaker = null;

function pick(pool, key) {
  if (!pool?.length) return null;
  const previousText = lastUsed.get(key);
  let candidates = pool.filter(([, text]) => text !== previousText);
  if (!candidates.length) candidates = pool;
  const differentSpeaker = candidates.filter(([speaker]) => speaker !== lastSpeaker);
  if (differentSpeaker.length) candidates = differentSpeaker;
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  lastUsed.set(key, chosen[1]);
  lastSpeaker = chosen[0];
  return chosen;
}

const fill = (text, context) => text.replace(/\{(\w+)\}/g, (_, key) => context[key] ?? `{${key}}`);

export function getLine(event, context = {}) {
  let pool = LINES[event];
  if (pool && !Array.isArray(pool)) pool = pool[context.attributeKey];
  const line = pick(pool, `${event}${context.attributeKey ?? ''}`);
  if (!line) return null;
  return { speaker: SPEAKERS[line[0]], text: fill(line[1], context) };
}

export function getIdleChatter(chance = 0.35) {
  return Math.random() < chance ? getLine('idle') : null;
}
