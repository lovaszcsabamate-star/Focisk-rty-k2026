import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AI, HUMAN, PHASE, Game } from '../js/engine.js';
import { PenaltyGame } from '../js/penalties.js';
import { buildQuickMatchPayload } from '../js/domain/quick-match-domain.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const database = JSON.parse(fs.readFileSync(path.join(
  ROOT,
  'data/databases/hungary-nb1-2025-26/players.normalized.json',
), 'utf8'));
const players = Array.isArray(database?.players) ? database.players : [];
assert.ok(players.length > 100, 'A normalizált játékosadatbázis nem tölthető be.');

const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const lineupScore = player => {
  const stats = player?.stats ?? {};
  return Math.log1p(number(stats.marketValue)) * 1.2
    + Math.log1p(number(stats.minutes))
    + Math.log1p(number(stats.appearances)) * 1.2
    + Math.log1p(number(stats.goals)) * 1.6
    + Math.log1p(number(stats.assists)) * 1.4;
};

const clubCounts = new Map();
for (const player of players) {
  const club = String(player?.club ?? '').trim();
  if (!club) continue;
  clubCounts.set(club, (clubCounts.get(club) ?? 0) + 1);
}
const clubs = [...clubCounts.entries()]
  .filter(([, count]) => count >= 11)
  .map(([club]) => club)
  .sort((a, b) => a.localeCompare(b, 'hu-HU'));
assert.equal(clubs.length, 12, `A stresszteszt 12 NB I klubot vár, jelenleg ${clubs.length} játszható klub van.`);

const makeRng = seed => {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const tournamentLineup = (humanClub, aiClub, seed) => {
  const prepared = buildQuickMatchPayload(
    database,
    { kind: 'club', value: humanClub },
    { kind: 'club', value: aiClub },
    makeRng(seed),
  );
  assert.ok(prepared?.matchup?.enabled, `${humanClub} – ${aiClub}: nem épült fel a gyorsmeccs-párosítás.`);
  const staged = Array.isArray(prepared?.payload?.players) ? prepared.payload.players : [];
  const human = staged.filter(player => player?.meta?.quickMatchSide === HUMAN)
    .sort((a, b) => lineupScore(b) - lineupScore(a))
    .slice(0, 11)
    .map((player, index) => ({
      ...player,
      meta: { ...(player.meta ?? {}), tournamentLineupOrder: index, tournamentLineupSide: HUMAN },
    }));
  const ai = staged.filter(player => player?.meta?.quickMatchSide === AI)
    .sort((a, b) => lineupScore(b) - lineupScore(a))
    .slice(0, 11)
    .map((player, index) => ({
      ...player,
      meta: { ...(player.meta ?? {}), tournamentLineupOrder: index, tournamentLineupSide: AI },
    }));
  assert.equal(human.length, 11, `${humanClub}: nincs 11 emberi tornakártya.`);
  assert.equal(ai.length, 11, `${aiClub}: nincs 11 gépi tornakártya.`);
  return [...human, ...ai];
};

const choosePlayableMove = game => {
  const keys = game.availableAttributeKeys();
  assert.ok(keys.length > 0, `Nincs közös játszható kategória a(z) ${game.round}. körben.`);
  const chooser = game.chooser;
  const other = chooser === HUMAN ? AI : HUMAN;

  // Olyan lépést részesítünk előnyben, amelynél létezik nem döntetlen pár.
  // Ha minden párosítás döntetlen, az első érvényes kategória/kártya marad.
  let fallback = null;
  for (const key of keys) {
    const chooserCards = game.availableCards(chooser, key);
    const otherCards = game.availableCards(other, key);
    if (!chooserCards.length || !otherCards.length) continue;
    fallback ??= { key, chooserCard: chooserCards[0], otherCard: otherCards[0] };
    for (const left of chooserCards) {
      const leftValue = game.constructor === Game ? null : null;
      for (const right of otherCards) {
        // A motor maga végzi az összehasonlítást; itt elég az eltérő statisztikai objektumot keresni.
        if (JSON.stringify(left.stats ?? {}) !== JSON.stringify(right.stats ?? {})) {
          return { key, chooserCard: left, otherCard: right };
        }
      }
    }
  }
  assert.ok(fallback, `Nem található kijátszható kártyapár a(z) ${game.round}. körben.`);
  return fallback;
};

const playToCompletion = (GameClass, cards, rng, label) => {
  const game = new GameClass({ players: cards, rng });
  const maximumSteps = GameClass === PenaltyGame ? 240 : 120;
  let steps = 0;
  while (!game.isOver && steps < maximumSteps) {
    steps += 1;
    if (game.phase === PHASE.CHOOSE_ATTRIBUTE) {
      const move = choosePlayableMove(game);
      game.chooseAttribute(move.key, move.chooserCard.id);
      const other = game.chooser === HUMAN ? AI : HUMAN;
      const eligible = game.availableCards(other, move.key);
      const card = eligible.find(item => item.id === move.otherCard.id) ?? eligible[0];
      assert.ok(card, `${label}: nincs ellenfélkártya a(z) ${move.key} kategóriához.`);
      game.playCard(other, card.id);
      continue;
    }
    if (game.phase === PHASE.REVEAL) {
      if (GameClass === PenaltyGame) game.nextDuel();
      else game.nextRound();
      continue;
    }
    if (game.phase === PHASE.CHOOSE_CARD) {
      const other = game.chooser === HUMAN ? AI : HUMAN;
      const card = game.availableCards(other, game.attribute)[0];
      assert.ok(card, `${label}: CHOOSE_CARD fázisban nincs kijátszható lap.`);
      game.playCard(other, card.id);
      continue;
    }
    assert.fail(`${label}: ismeretlen vagy beragadt játékfázis: ${game.phase}`);
  }
  assert.equal(game.isOver, true, `${label}: ${maximumSteps} lépés után sem ért véget a mérkőzés.`);
  return { rounds: Number(game.round) || 0, log: game.log.length };
};

let classicMatches = 0;
let penaltyMatches = 0;
let longestClassic = { label: '', rounds: 0 };
let longestPenalty = { label: '', rounds: 0 };

for (let left = 0; left < clubs.length; left += 1) {
  for (let right = left + 1; right < clubs.length; right += 1) {
    for (let seed = 1; seed <= 3; seed += 1) {
      const humanClub = clubs[left];
      const aiClub = clubs[right];
      const label = `${humanClub} – ${aiClub} · seed ${seed}`;
      const cards = tournamentLineup(humanClub, aiClub, seed);
      const classic = playToCompletion(Game, cards, makeRng(seed * 101 + left * 17 + right), `${label} · klasszikus`);
      classicMatches += 1;
      if (classic.rounds > longestClassic.rounds) longestClassic = { label, rounds: classic.rounds };

      const penalties = playToCompletion(PenaltyGame, cards, makeRng(seed * 211 + left * 23 + right), `${label} · büntető`);
      penaltyMatches += 1;
      if (penalties.rounds > longestPenalty.rounds) longestPenalty = { label, rounds: penalties.rounds };
    }
  }
}

console.log(`✓ Torna meccs liveness: ${classicMatches} klasszikus és ${penaltyMatches} büntető NB I párosítás végesen lefutott.`);
console.log(`  Leghosszabb klasszikus: ${longestClassic.rounds} kör · ${longestClassic.label}`);
console.log(`  Leghosszabb büntető: ${longestPenalty.rounds} párbaj · ${longestPenalty.label}`);
