import { normalisePlayerPayload } from '../models/player-model.js';

/**
 * A szigorú teljességi audit és a futásidejű játszhatóság két külön szabály.
 *
 * - A teljességi audit továbbra is jelzi az összes hiányzó, kártyán megjelenő
 *   vagy statisztikai mezőt.
 * - A futásidejű pakli csak a valóban kötelező azonosítómezőket követeli meg.
 *   Az opcionális, nem igazolt értékek `null` formában maradnak, és az adott
 *   összehasonlítási kategória csak akkor válik elérhetővé, ha mindkét aktuális
 *   kártyához van hiteles adat.
 */

export const COMPLETE_CARD_TEXT_FIELDS = ['id', 'name', 'club', 'nation', 'position'];
export const COMPLETE_CARD_STAT_FIELDS = [
  'appearances',
  'starts',
  'goals',
  'squads',
  'yellowCards',
  'redCards',
  'totalDismissals',
];
export const PLAYABLE_CARD_REQUIRED_FIELDS = Object.freeze(['id', 'name', 'club']);

const PLACEHOLDERS = new Set([
  '', '-', '–', '—', 'n/a', 'n.a.', 'na', 'null', 'undefined', 'ismeretlen', 'nincs adat',
]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const finiteNonNegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function hasMeaningfulText(value) {
  return typeof value === 'string'
    && !PLACEHOLDERS.has(value.trim().toLocaleLowerCase('hu-HU'));
}

function hasValidBirthDate(value) {
  if (!hasMeaningfulText(value) || !ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

/** Szigorú adatminőségi audit; nem használható futásidejű kizárási szabályként. */
export function getIncompleteCardFields(card) {
  const missing = [];

  for (const field of COMPLETE_CARD_TEXT_FIELDS) {
    if (!hasMeaningfulText(card?.[field])) missing.push(field);
  }
  if (!hasValidBirthDate(card?.birthDate)) missing.push('birthDate');

  for (const field of COMPLETE_CARD_STAT_FIELDS) {
    if (!finiteNonNegative(card?.stats?.[field])) missing.push(`stats.${field}`);
  }

  if (finiteNonNegative(card?.stats?.starts)
    && finiteNonNegative(card?.stats?.appearances)
    && card.stats.starts > card.stats.appearances) {
    missing.push('stats.starts>appearances');
  }

  return missing;
}

export const isCompleteCard = card => getIncompleteCardFields(card).length === 0;

/** Csak a motor számára valóban kötelező kártyaazonosítókat vizsgálja. */
export function getUnplayableCardFields(card) {
  if (!card || typeof card !== 'object' || Array.isArray(card)) return ['card'];
  const missing = [];
  if (!hasMeaningfulText(card.id)) missing.push('id');
  if (!hasMeaningfulText(card.name)) missing.push('name');
  if (!hasMeaningfulText(card.clubName ?? card.club)) missing.push('club');
  return missing;
}

export const isPlayableCard = card => getUnplayableCardFields(card).length === 0;

export function filterCompleteCardsPayload(payload, { minimumCards = 52, playerModel = {} } = {}) {
  const modelledPayload = normalisePlayerPayload(payload, playerModel);
  const players = modelledPayload.players;
  const playablePlayers = players.filter(isPlayableCard);
  const completePlayers = playablePlayers.filter(isCompleteCard);
  const excludedUnplayableCards = players.length - playablePlayers.length;
  const incompleteButPlayableCards = playablePlayers.length - completePlayers.length;

  if (playablePlayers.length < minimumCards) {
    throw new Error(
      `Nincs elegendő kötelező azonosítóval rendelkező játékoskártya: `
      + `${playablePlayers.length}/${minimumCards}. ${excludedUnplayableCards} érvénytelen rekord kizárva.`,
    );
  }

  return {
    ...modelledPayload,
    players: playablePlayers,
    selection: {
      ...(modelledPayload?.selection ?? {}),
      playableCards: playablePlayers.length,
      completePlayableCards: completePlayers.length,
      incompleteButPlayableCards,
      excludedUnplayableCards,
      // Visszafelé kompatibilis adatminőségi számláló: hány rekord nem teljes
      // a szigorú audit szerint. Ez nem jelenti azt, hogy ki is lett zárva.
      excludedIncompleteCards: players.length - completePlayers.length,
      sourcePlayerRecords: players.length,
    },
    completenessFilter: {
      enabled: true,
      mode: 'runtime-identity',
      requiredTextFields: PLAYABLE_CARD_REQUIRED_FIELDS,
      requiredStatFields: [],
      auditRequiredTextFields: COMPLETE_CARD_TEXT_FIELDS,
      auditRequiredStatFields: COMPLETE_CARD_STAT_FIELDS,
      sourcePlayerRecords: players.length,
      playableCards: playablePlayers.length,
      completePlayableCards: completePlayers.length,
      incompleteButPlayableCards,
      excludedUnplayableCards,
      excludedIncompleteCards: players.length - completePlayers.length,
    },
  };
}
