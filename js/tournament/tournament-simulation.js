/** Kártya- és kategórialefedettség-alapú torna szimuláció. */

import { ATTRIBUTES, attributeValue, hasAttributeData } from '../data/players.js';
import { AI, HUMAN, compare } from '../engine.js';
import {
  TOURNAMENT_MATCH_MODE,
  TOURNAMENT_MATCH_STATUS,
  TOURNAMENT_STATUS,
  advanceTournament,
  recordTournamentMatch,
  tournamentHumanEliminated,
  tournamentMatchById,
  tournamentNextIncompleteRound,
  tournamentSeededRandom,
  tournamentTeamById,
} from './tournament-domain.js';
import {
  appendSimulatedResult,
  applyMatchTelemetry,
  calculateTournamentAwards,
  migrateEnhancedTournament,
} from './tournament-state.js';

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const text = value => String(value ?? '').trim();

export const tournamentPlayerStrength = player => {
  const stats = player?.stats ?? {};
  const meta = player?.meta ?? {};
  const categoryCoverage = ATTRIBUTES.reduce((sum, attribute) => sum + (hasAttributeData(player, attribute.key) ? 1 : 0), 0);
  return Math.log1p(number(stats.marketValue)) * 1.15
    + Math.log1p(number(stats.minutes)) * 1.05
    + Math.log1p(number(stats.appearances)) * 1.25
    + Math.log1p(number(stats.starts)) * 0.85
    + Math.log1p(number(stats.goals)) * 1.75
    + Math.log1p(number(stats.assists)) * 1.45
    + Math.log1p(number(stats.cleanSheets)) * 0.8
    + Math.log1p(number(meta.height ?? player?.height)) * 0.04
    + categoryCoverage * 0.38;
};

const topCards = cards => [...(Array.isArray(cards) ? cards : [])]
  .sort((a, b) => tournamentPlayerStrength(b) - tournamentPlayerStrength(a))
  .slice(0, 11);

const categoryValue = (card, attribute) => {
  const value = attributeValue(card, attribute.key);
  if (value == null) return null;
  return Number(value);
};

const categoryScore = (card, attribute) => {
  const value = categoryValue(card, attribute);
  if (value == null) return -Infinity;
  return ['lower', 'earlier'].includes(attribute.direction) ? -value : value;
};

export function buildTournamentTeamProfile(cards) {
  const lineup = topCards(cards);
  const coverage = {};
  const categoryStrength = {};
  for (const attribute of ATTRIBUTES) {
    const available = lineup.filter(card => hasAttributeData(card, attribute.key));
    coverage[attribute.key] = available.length;
    const values = available.map(card => categoryScore(card, attribute)).sort((a, b) => b - a).slice(0, 4);
    categoryStrength[attribute.key] = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  }
  const strengthValues = lineup.map(tournamentPlayerStrength);
  const baseStrength = strengthValues.length
    ? strengthValues.reduce((sum, value) => sum + value, 0) / strengthValues.length
    : 0;
  const coveredCategories = Object.values(coverage).filter(value => value >= 2).length;
  const strongestCategories = ATTRIBUTES
    .filter(attribute => categoryStrength[attribute.key] != null)
    .sort((a, b) => categoryStrength[b.key] - categoryStrength[a.key])
    .slice(0, 3)
    .map(attribute => ({ key: attribute.key, label: attribute.label, icon: attribute.icon }));
  return {
    lineup,
    baseStrength,
    coverage,
    coveredCategories,
    coverageRatio: ATTRIBUTES.length ? coveredCategories / ATTRIBUTES.length : 0,
    categoryStrength,
    strongestCategories,
    keyCards: lineup.slice(0, 3),
    overall: baseStrength + coveredCategories * 0.2 + Math.log1p(lineup.length),
  };
}

const sharedAttributes = (homeProfile, awayProfile) => ATTRIBUTES.filter(attribute => (
  number(homeProfile.coverage[attribute.key]) > 0
  && number(awayProfile.coverage[attribute.key]) > 0
));

const weightedAttribute = (attributes, homeProfile, awayProfile, rng) => {
  if (!attributes.length) return null;
  const weighted = attributes.map(attribute => ({
    attribute,
    weight: Math.max(1, Math.min(
      number(homeProfile.coverage[attribute.key]),
      number(awayProfile.coverage[attribute.key]),
    )),
  }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = rng() * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.attribute;
  }
  return weighted.at(-1).attribute;
};

const chooseCategoryCard = (profile, attribute, rng, usedIds = new Set()) => {
  let candidates = profile.lineup.filter(card => hasAttributeData(card, attribute.key) && !usedIds.has(String(card.id)));
  if (!candidates.length) candidates = profile.lineup.filter(card => hasAttributeData(card, attribute.key));
  if (!candidates.length) return null;
  candidates.sort((a, b) => categoryScore(b, attribute) - categoryScore(a, attribute));
  const shortlist = candidates.slice(0, Math.min(3, candidates.length));
  return shortlist[Math.floor(rng() * shortlist.length)] ?? shortlist[0];
};

const fallbackDuel = (homeProfile, awayProfile, rng) => {
  const relative = (homeProfile.overall - awayProfile.overall) / Math.max(homeProfile.overall, awayProfile.overall, 1);
  const homeWins = rng() < clamp(0.5 + relative * 0.34, 0.2, 0.8);
  return homeWins ? HUMAN : AI;
};

const simulateDuel = ({ homeProfile, awayProfile, attributes, rng, round, suddenDeath = false, usedHome, usedAway }) => {
  const attribute = weightedAttribute(attributes, homeProfile, awayProfile, rng);
  if (!attribute) {
    const winner = fallbackDuel(homeProfile, awayProfile, rng);
    return { round, attribute: '', humanCard: homeProfile.lineup[0] ?? null, aiCard: awayProfile.lineup[0] ?? null, winner, suddenDeath };
  }
  const homeCard = chooseCategoryCard(homeProfile, attribute, rng, usedHome);
  const awayCard = chooseCategoryCard(awayProfile, attribute, rng, usedAway);
  if (!homeCard || !awayCard) {
    const winner = fallbackDuel(homeProfile, awayProfile, rng);
    return { round, attribute: attribute.key, humanCard: homeCard, aiCard: awayCard, winner, suddenDeath };
  }
  usedHome.add(String(homeCard.id));
  usedAway.add(String(awayCard.id));
  let winner = compare(attribute.key, homeCard, awayCard);
  if (winner === HUMAN) winner = 'human';
  else if (winner === AI) winner = 'ai';
  return { round, attribute: attribute.key, humanCard: homeCard, aiCard: awayCard, winner, suddenDeath };
};

const summaryFor = ({ homeTeam, awayTeam, homeScore, awayScore, mode, suddenDeath, homeProfile, awayProfile }) => {
  const winner = homeScore > awayScore ? homeTeam : awayScore > homeScore ? awayTeam : null;
  const key = winner
    ? (winner.id === homeTeam.id ? homeProfile.keyCards[0] : awayProfile.keyCards[0])
    : null;
  const format = mode === TOURNAMENT_MATCH_MODE.PENALTIES ? 'büntetőpárbajban' : 'körgyőzelmekkel';
  const ending = suddenDeath ? ', hirtelen halálban' : '';
  return winner
    ? `${winner.label} ${format}${ending} nyert${key?.name ? `; kulcslap: ${key.name}` : ''}.`
    : `Kiegyenlített mérkőzés, ${homeScore}–${awayScore} eredménnyel.`;
};

function simulateClassic({ state, match, homeTeam, awayTeam, homeCards, awayCards }) {
  const homeProfile = buildTournamentTeamProfile(homeCards);
  const awayProfile = buildTournamentTeamProfile(awayCards);
  const rng = tournamentSeededRandom(`${state.id}:${match.id}:classic-v3`);
  const attributes = sharedAttributes(homeProfile, awayProfile);
  const usedHome = new Set();
  const usedAway = new Set();
  const log = [];
  let homeScore = 0;
  let awayScore = 0;
  const regularRounds = 8;
  for (let round = 1; round <= regularRounds; round += 1) {
    const duel = simulateDuel({ homeProfile, awayProfile, attributes, rng, round, usedHome, usedAway });
    log.push(duel);
    if (duel.winner === 'human') homeScore += 1;
    if (duel.winner === 'ai') awayScore += 1;
  }
  let suddenDeath = false;
  if (match.stage === 'knockout' && homeScore === awayScore) {
    suddenDeath = true;
    for (let extra = 1; extra <= 12 && homeScore === awayScore; extra += 1) {
      const duel = simulateDuel({
        homeProfile,
        awayProfile,
        attributes,
        rng,
        round: regularRounds + extra,
        suddenDeath: true,
        usedHome,
        usedAway,
      });
      log.push(duel);
      if (duel.winner === 'human') homeScore += 1;
      if (duel.winner === 'ai') awayScore += 1;
    }
    if (homeScore === awayScore) {
      const winner = fallbackDuel(homeProfile, awayProfile, rng) === HUMAN ? 'human' : 'ai';
      log.push({
        round: regularRounds + 13,
        attribute: '',
        humanCard: homeProfile.keyCards[0] ?? homeProfile.lineup[0] ?? null,
        aiCard: awayProfile.keyCards[0] ?? awayProfile.lineup[0] ?? null,
        winner,
        suddenDeath: true,
      });
      if (winner === 'human') homeScore += 1;
      else awayScore += 1;
    }
  }
  return {
    mode: TOURNAMENT_MATCH_MODE.CLASSIC,
    homeScore,
    awayScore,
    winnerId: homeScore > awayScore ? match.homeId : awayScore > homeScore ? match.awayId : null,
    suddenDeath,
    homeProfile,
    awayProfile,
    telemetry: {
      mode: TOURNAMENT_MATCH_MODE.CLASSIC,
      homeSide: 'human',
      captainIds: [homeProfile.keyCards[0]?.id, awayProfile.keyCards[0]?.id].filter(Boolean),
      log,
    },
    summary: summaryFor({ homeTeam, awayTeam, homeScore, awayScore, mode: TOURNAMENT_MATCH_MODE.CLASSIC, suddenDeath, homeProfile, awayProfile }),
  };
}

function simulatePenalties({ state, match, homeTeam, awayTeam, homeCards, awayCards }) {
  const homeProfile = buildTournamentTeamProfile(homeCards);
  const awayProfile = buildTournamentTeamProfile(awayCards);
  const rng = tournamentSeededRandom(`${state.id}:${match.id}:penalties-v3`);
  const attributes = sharedAttributes(homeProfile, awayProfile);
  const usedHome = new Set();
  const usedAway = new Set();
  const log = [];
  let homeScore = 0;
  let awayScore = 0;
  let round = 0;
  for (round = 1; round <= 5; round += 1) {
    const duel = simulateDuel({ homeProfile, awayProfile, attributes, rng, round, usedHome, usedAway });
    log.push(duel);
    if (duel.winner === 'human') homeScore += 1;
    if (duel.winner === 'ai') awayScore += 1;
    const remaining = 5 - round;
    if (Math.abs(homeScore - awayScore) > remaining) break;
  }
  let suddenDeath = false;
  if (homeScore === awayScore) {
    suddenDeath = true;
    for (let extra = 1; extra <= 18 && homeScore === awayScore; extra += 1) {
      const duel = simulateDuel({
        homeProfile,
        awayProfile,
        attributes,
        rng,
        round: round + extra,
        suddenDeath: true,
        usedHome,
        usedAway,
      });
      log.push(duel);
      if (duel.winner === 'human') homeScore += 1;
      if (duel.winner === 'ai') awayScore += 1;
    }
  }
  if (homeScore === awayScore) {
    const winner = fallbackDuel(homeProfile, awayProfile, rng) === HUMAN ? 'human' : 'ai';
    log.push({
      round: round + 19,
      attribute: '',
      humanCard: homeProfile.keyCards[0] ?? homeProfile.lineup[0] ?? null,
      aiCard: awayProfile.keyCards[0] ?? awayProfile.lineup[0] ?? null,
      winner,
      suddenDeath: true,
    });
    if (winner === 'human') homeScore += 1;
    else awayScore += 1;
  }
  return {
    mode: TOURNAMENT_MATCH_MODE.PENALTIES,
    homeScore,
    awayScore,
    winnerId: homeScore > awayScore ? match.homeId : match.awayId,
    suddenDeath,
    homeProfile,
    awayProfile,
    telemetry: {
      mode: TOURNAMENT_MATCH_MODE.PENALTIES,
      homeSide: 'human',
      captainIds: [homeProfile.keyCards[0]?.id, awayProfile.keyCards[0]?.id].filter(Boolean),
      log,
    },
    summary: summaryFor({ homeTeam, awayTeam, homeScore, awayScore, mode: TOURNAMENT_MATCH_MODE.PENALTIES, suddenDeath, homeProfile, awayProfile }),
  };
}

export function simulateTournamentMatchEnhanced(state, matchId, resolveCards) {
  let next = migrateEnhancedTournament(state);
  const match = tournamentMatchById(next, matchId);
  if (!match || match.status !== TOURNAMENT_MATCH_STATUS.PENDING) return next;
  const homeTeam = tournamentTeamById(next, match.homeId);
  const awayTeam = tournamentTeamById(next, match.awayId);
  const homeCards = Array.isArray(resolveCards?.(match.homeId)) ? resolveCards(match.homeId) : [];
  const awayCards = Array.isArray(resolveCards?.(match.awayId)) ? resolveCards(match.awayId) : [];
  if (!homeTeam || !awayTeam || !homeCards.length || !awayCards.length) return next;
  const simulation = next.matchMode === TOURNAMENT_MATCH_MODE.PENALTIES
    ? simulatePenalties({ state: next, match, homeTeam, awayTeam, homeCards, awayCards })
    : simulateClassic({ state: next, match, homeTeam, awayTeam, homeCards, awayCards });
  next = recordTournamentMatch(next, match.id, {
    homeScore: simulation.homeScore,
    awayScore: simulation.awayScore,
    winnerId: simulation.winnerId,
    decidedBy: simulation.mode === TOURNAMENT_MATCH_MODE.PENALTIES
      ? 'simulation-penalties'
      : 'simulation-classic',
  });
  const recorded = tournamentMatchById(next, match.id);
  recorded.simulation = {
    mode: simulation.mode,
    summary: simulation.summary,
    suddenDeath: simulation.suddenDeath,
    rounds: simulation.telemetry.log.length,
    keyCardIds: [simulation.homeProfile.keyCards[0]?.id, simulation.awayProfile.keyCards[0]?.id].filter(Boolean),
  };
  const lookup = new Map([...homeCards, ...awayCards].map(card => [text(card?.id), card]));
  next = applyMatchTelemetry(next, recorded, simulation.telemetry, lookup);
  next = appendSimulatedResult(next, recorded, simulation);
  return next;
}

export function simulatePendingAiMatchesEnhanced(state, resolveCards) {
  let next = migrateEnhancedTournament(state);
  for (let guard = 0; guard < 160; guard += 1) {
    next = migrateEnhancedTournament(advanceTournament(next));
    if (next.status === TOURNAMENT_STATUS.COMPLETE) break;
    const round = tournamentNextIncompleteRound(next);
    if (!round) break;
    let humanPending = false;
    let changed = false;
    for (const match of round.matches ?? []) {
      if (match.status === TOURNAMENT_MATCH_STATUS.COMPLETE) continue;
      if ([match.homeId, match.awayId].includes(next.humanTeamId) && !tournamentHumanEliminated(next)) {
        humanPending = true;
        continue;
      }
      if (match.status === TOURNAMENT_MATCH_STATUS.PENDING) {
        next = simulateTournamentMatchEnhanced(next, match.id, resolveCards);
        changed = true;
      }
    }
    next = migrateEnhancedTournament(advanceTournament(next));
    if (humanPending || next.status === TOURNAMENT_STATUS.COMPLETE) break;
    if (!changed && tournamentNextIncompleteRound(next)?.id === round.id) break;
  }
  if (next.status === TOURNAMENT_STATUS.COMPLETE) next = calculateTournamentAwards(next);
  return next;
}

export function tournamentTacticalSummary(ownCards, opponentCards) {
  const own = buildTournamentTeamProfile(ownCards);
  const opponent = buildTournamentTeamProfile(opponentCards);
  const ownLabels = own.strongestCategories.slice(0, 2).map(item => item.label.toLocaleLowerCase('hu-HU'));
  const opponentLabels = opponent.strongestCategories.slice(0, 2).map(item => item.label.toLocaleLowerCase('hu-HU'));
  const ownSentence = ownLabels.length
    ? `A te kereted fő erőssége: ${ownLabels.join(' és ')}.`
    : 'A te kereted kiegyensúlyozott, de kevés teljesen lefedett kategóriával rendelkezik.';
  const opponentSentence = opponentLabels.length
    ? `Az ellenfél erős a(z) ${opponentLabels.join(' és ')} kategóriában.`
    : 'Az ellenfél kategórialefedettsége vegyes.';
  const coverage = own.coverageRatio > opponent.coverageRatio
    ? 'A te paklid több választható kategóriát fed le.'
    : own.coverageRatio < opponent.coverageRatio
      ? 'Az ellenfél paklija több választható kategóriát fed le.'
      : 'A két pakli kategórialefedettsége közel azonos.';
  return { own, opponent, sentences: [opponentSentence, ownSentence, coverage] };
}
