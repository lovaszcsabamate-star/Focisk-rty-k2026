import assert from 'node:assert/strict';
import {
  TOURNAMENT_STATUS,
  saveAndVerifyTournament,
} from '../js/tournament/tournament-flow-shared.js';

const previous = Object.freeze({
  id: 'tournament-real-device-regression',
  status: TOURNAMENT_STATUS.ACTIVE,
  currentMatchId: null,
  updatedAt: '2026-08-09T20:00:00.000Z',
});
const expected = Object.freeze({
  ...previous,
  currentMatchId: 'league-r1-m1-eto-dvtk',
  updatedAt: '2026-08-09T20:01:00.000Z',
});

{
  let pendingNext = null;
  const transactionalStorage = {
    save(state) {
      pendingNext = structuredClone(state);
      return true;
    },
    read() {
      // Új meccs indításakor a fő tornaállapot szándékosan még a korábbi snapshot.
      return previous;
    },
    readPendingLaunch() {
      return { previous, next: pendingNext };
    },
  };

  const restored = saveAndVerifyTournament(expected, transactionalStorage);
  assert.deepEqual(restored, expected,
    'A pending launch next snapshotot érvényes visszaolvasásként kell elfogadni.');
}

{
  let persisted = null;
  const directStorage = {
    save(state) {
      persisted = structuredClone(state);
      return true;
    },
    read() {
      return persisted;
    },
    readPendingLaunch() {
      throw new Error('Közvetlen mentésnél nem kell pending launchot olvasni.');
    },
  };

  assert.deepEqual(saveAndVerifyTournament(previous, directStorage), previous,
    'A normál közvetlen torna-mentés visszaellenőrzése maradjon változatlan.');
}

assert.throws(
  () => saveAndVerifyTournament(expected, {
    save: () => true,
    read: () => previous,
    readPendingLaunch: () => ({ previous, next: { ...expected, updatedAt: 'stale' } }),
  }),
  /A mentett tornaállapot nem olvasható vissza/,
  'Valóban eltérő aktív és pending snapshot esetén továbbra is hibát kell jelezni.',
);

assert.throws(
  () => saveAndVerifyTournament(expected, { save: () => false, read: () => null }),
  /A tornaállapot mentése nem sikerült/,
  'Sikertelen storage írást nem szabad olvasható mentésnek tekinteni.',
);

console.log('✓ Tournament pending launch verification: az új meccs tranzakciós snapshotja nem vált ki hamis visszaolvasási hibát.');
