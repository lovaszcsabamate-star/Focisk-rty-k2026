import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  TOURNAMENT_UI_IMPROVEMENT_VERSION,
  foldTournamentUiText,
  resolveTournamentClubPresentation,
  resolveTournamentCupPresentation,
} from '../js/tournament/tournament-ui-improvement.js';

assert.equal(TOURNAMENT_UI_IMPROVEMENT_VERSION, 1);
assert.equal(foldTournamentUiText('Puskás Akadémia FC'), 'puskas akademia fc');

const clubs = [
  ['DVSC', 'DVSC'],
  ['DVTK', 'DVTK'],
  ['ETO FC', 'ETO'],
  ['Ferencvárosi TC', 'FTC'],
  ['Kisvárda Master Good', 'KISV'],
  ['Kolorcity Kazincbarcika SC', 'KBSC'],
  ['MTK Budapest', 'MTK'],
  ['Nyíregyháza Spartacus FC', 'NYÍR'],
  ['Paksi FC', 'PAKS'],
  ['Puskás Akadémia FC', 'PAFC'],
  ['Újpest FC', 'UTE'],
  ['ZTE FC', 'ZTE'],
];
for (const [label, short] of clubs) {
  const presentation = resolveTournamentClubPresentation(label);
  assert.ok(presentation, `${label}: hiányzó klubprezentáció`);
  assert.equal(presentation.short, short, `${label}: kanonikus rövid klubjel`);
  assert.match(presentation.primary, /^#[0-9a-f]{6}$/i);
  assert.match(presentation.secondary, /^#[0-9a-f]{6}$/i);
}
assert.equal(resolveTournamentClubPresentation('Magyar válogatott'), null);
assert.equal(resolveTournamentClubPresentation('Ismeretlen Teszt FC'), null);

assert.equal(resolveTournamentCupPresentation('Magyar Bajnokság').tone, 'league');
assert.equal(resolveTournamentCupPresentation('Magyar Bajnokság').tag, 'Szezon');
assert.equal(resolveTournamentCupPresentation('Magyar Kupa').tone, 'cup');
assert.equal(resolveTournamentCupPresentation('Nemzetközi Bajnokok Kupája').tone, 'international');
assert.equal(resolveTournamentCupPresentation('Nemzetek Kupája').tone, 'international');
assert.equal(resolveTournamentCupPresentation('Új saját kupa létrehozása').tone, 'custom');

const source = fs.readFileSync('js/tournament/tournament-ui-improvement.js', 'utf8');
assert.match(source, /quick-team-mark--text/);
assert.match(source, /__FOCISKARTYAK_TEAM_LOGO_RESTORATION__/);
assert.match(source, /min-height:44px/);
assert.match(source, /@media\(max-width:390px\)/);
assert.match(source, /@media\(max-width:340px\)/);
assert.doesNotMatch(source, /https?:\/\//, 'A Torna UI nem hozhat be távoli klubcímer URL-t.');

const entry = fs.readFileSync('js/tournament-experience-v2.js', 'utf8');
const standalone = fs.readFileSync('scripts/postprocess-standalone.mjs', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
assert.match(entry, /tournament\/tournament-ui-improvement\.js/);
assert.match(entry, /installTournamentUiImprovement\(\)/);
assert.match(standalone, /tournament\/tournament-ui-improvement\.js/);
assert.match(serviceWorker, /\.\/js\/tournament\/tournament-ui-improvement\.js/);

console.log('✓ Torna UI: 12 klub generált címerpalettája, kupa-karakterek, mobil touch target és offline/standalone bekötés rendben.');
