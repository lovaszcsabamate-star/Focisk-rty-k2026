/** DOM-mentes mérkőzés-összesítő és párbajtörténet-logika. */

import { AI, HUMAN } from '../engine.js';

const finiteNumber = value => typeof value === 'number' && Number.isFinite(value);
const safeLog = value => Array.isArray(value) ? value.filter(Boolean) : [];
const safeText = value => String(value ?? '').trim();

const resultLabel = (winner, humanId, aiId) => {
  if (winner === humanId) return 'Győzelem';
  if (winner === aiId) return 'Vereség';
  return 'Döntetlen';
};

const formatComparedValues = (entry, formatValue) => {
  if (typeof formatValue !== 'function') return '';
  try {
    const human = formatValue(entry.humanCard, entry.attribute);
    const ai = formatValue(entry.aiCard, entry.attribute);
    return human && ai ? `${human}–${ai}` : '';
  } catch {
    return '';
  }
};

export function buildRecentDuelHistory(log, {
  attributeRegistry = {},
  formatValue = null,
  limit = 3,
  humanId = HUMAN,
  aiId = AI,
} = {}) {
  const safeLimit = Math.max(0, Math.min(3, Number.isFinite(limit) ? Math.floor(limit) : 3));
  if (!safeLimit) return [];

  return safeLog(log).slice(-safeLimit).map((entry, index, items) => {
    const attribute = attributeRegistry[entry.attribute] ?? {};
    const round = Number.isFinite(entry.round)
      ? entry.round
      : Math.max(1, safeLog(log).length - items.length + index + 1);
    return Object.freeze({
      round,
      attribute: entry.attribute ?? null,
      categoryLabel: safeText(attribute.label ?? attribute.nameHu ?? entry.attribute) || 'Ismeretlen kategória',
      values: formatComparedValues(entry, formatValue),
      result: resultLabel(entry.winner, humanId, aiId),
      winner: entry.winner,
    });
  });
}

const comparisonMargin = (entry, attributeValue) => {
  if (typeof attributeValue !== 'function') return 0;
  try {
    const human = attributeValue(entry.humanCard, entry.attribute);
    const ai = attributeValue(entry.aiCard, entry.attribute);
    if (!finiteNumber(human) || !finiteNumber(ai)) return 0;
    return Math.abs(human - ai) / Math.max(Math.abs(human), Math.abs(ai), 1);
  } catch {
    return 0;
  }
};

const winningCard = (entry, humanId, aiId) => {
  if (entry.winner === humanId) return entry.humanCard;
  if (entry.winner === aiId) return entry.aiCard;
  return null;
};

const cardIdentity = card => safeText(card?.id)
  || `${safeText(card?.name)}::${safeText(card?.club)}`;

const bestCategoryFrom = (categoryWins, attributeRegistry) => {
  const entries = [...categoryWins.entries()];
  if (!entries.length) return null;
  entries.sort((left, right) => right[1].wins - left[1].wins || left[1].firstRound - right[1].firstRound);
  const [key, value] = entries[0];
  const attribute = attributeRegistry[key] ?? {};
  return Object.freeze({
    key,
    label: safeText(attribute.label ?? attribute.nameHu ?? key) || key,
    icon: safeText(attribute.icon),
    wins: value.wins,
  });
};

const playerOfMatchFrom = candidates => {
  const ordered = [...candidates.values()]
    .sort((left, right) => right.wins - left.wins || right.bestMargin - left.bestMargin);
  const first = ordered[0];
  if (!first) return null;
  const second = ordered[1];
  if (second && first.wins === second.wins && Math.abs(first.bestMargin - second.bestMargin) < 1e-12) return null;
  return Object.freeze({
    id: first.card.id ?? null,
    name: safeText(first.card.name) || 'Ismeretlen játékos',
    club: safeText(first.card.club) || 'Ismeretlen klub',
    wins: first.wins,
  });
};

export function summariseClassicMatch({
  game,
  result = {},
  attributeRegistry = {},
  attributeValue = null,
  humanId = HUMAN,
  aiId = AI,
} = {}) {
  const log = safeLog(game?.log);
  let humanWins = 0;
  let aiWins = 0;
  let ties = 0;
  const categoryWins = new Map();
  const playerCandidates = new Map();

  for (const [index, entry] of log.entries()) {
    if (entry.winner === humanId) {
      humanWins += 1;
      const current = categoryWins.get(entry.attribute) ?? { wins: 0, firstRound: index + 1 };
      current.wins += 1;
      categoryWins.set(entry.attribute, current);
    } else if (entry.winner === aiId) {
      aiWins += 1;
    } else {
      ties += 1;
    }

    const card = winningCard(entry, humanId, aiId);
    const identity = cardIdentity(card);
    if (!card || !identity) continue;
    const candidate = playerCandidates.get(identity) ?? { card, wins: 0, bestMargin: 0 };
    candidate.wins += 1;
    candidate.bestMargin = Math.max(candidate.bestMargin, comparisonMargin(entry, attributeValue));
    playerCandidates.set(identity, candidate);
  }

  return Object.freeze({
    finalScore: Object.freeze({
      human: Number.isFinite(result?.human) ? result.human : 0,
      ai: Number.isFinite(result?.ai) ? result.ai : 0,
    }),
    rounds: log.length,
    humanWins,
    aiWins,
    ties,
    bestCategory: bestCategoryFrom(categoryWins, attributeRegistry),
    playerOfMatch: playerOfMatchFrom(playerCandidates),
  });
}
