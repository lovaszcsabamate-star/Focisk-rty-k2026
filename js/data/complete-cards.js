import { normalisePlayerPayload } from '../models/player-model.js';

/**
 * Keep incomplete source records in the database, but exclude them from the playable deck.
 * "Complete" means every field currently printed on a standard card or used by the base
 * comparison categories has a verified, non-placeholder value.
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

export function filterCompleteCardsPayload(payload, { minimumCards = 52, playerModel = {} } = {}) {
  const modelledPayload = normalisePlayerPayload(payload, playerModel);
  const players = modelledPayload.players;
  const completePlayers = players.filter(isCompleteCard);
  const excludedPlayers = players.length - completePlayers.length;

  if (completePlayers.length < minimumCards) {
    throw new Error(
      `Nincs elegendő teljes játékoskártya: ${completePlayers.length}/${minimumCards}. `
      + `${excludedPlayers} hiányos rekord kizárva.`,
    );
  }

  return {
    ...modelledPayload,
    players: completePlayers,
    selection: {
      ...(modelledPayload?.selection ?? {}),
      playableCards: completePlayers.length,
      completePlayableCards: completePlayers.length,
      excludedIncompleteCards: excludedPlayers,
      sourcePlayerRecords: players.length,
    },
    completenessFilter: {
      enabled: true,
      requiredTextFields: COMPLETE_CARD_TEXT_FIELDS,
      requiredStatFields: COMPLETE_CARD_STAT_FIELDS,
      sourcePlayerRecords: players.length,
      playableCards: completePlayers.length,
      excludedIncompleteCards: excludedPlayers,
    },
  };
}
