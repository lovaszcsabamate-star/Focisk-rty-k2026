import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  TOURNAMENT_UI_IMPROVEMENT_VERSION,
  foldTournamentUiText,
  resolveTournamentClubPresentation,
  resolveTournamentCupPresentation,
} from '../js/tournament/tournament-ui-improvement.js';

assert.equal(TOURNAMENT_UI_IMPROVEMENT_VERSION, 2);
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
  assert.ok(presentation, `${label}: hiányzó központi klubprezentáció`);
  assert.equal(presentation.short, short, `${label}: kanonikus rövid klubjel`);
  assert.match(presentation.primary, /^#[0-9a-f]{6}$/i);
  assert.match(presentation.secondary, /^#[0-9a-f]{6}$/i);
}
assert.equal(resolveTournamentClubPresentation('Magyar válogatott'), null);
assert.equal(resolveTournamentClubPresentation('Ismeretlen Teszt FC'), null);

assert.equal(resolveTournamentCupPresentation('Magyar Bajnokság').tone, 'league');
assert.equal(resolveTournamentCupPresentation('Magyar Bajnokság').tag, 'Bajnokság');
assert.equal(resolveTournamentCupPresentation('Magyar Kupa').tone, 'cup');
assert.equal(resolveTournamentCupPresentation('Nemzetközi Bajnokok Kupája').tone, 'international');
assert.equal(resolveTournamentCupPresentation('Nemzetek Kupája').tone, 'international');
assert.equal(resolveTournamentCupPresentation('Új saját kupa létrehozása').tone, 'custom');

const source = fs.readFileSync('js/tournament/tournament-ui-improvement.js', 'utf8');
assert.match(source, /import '\.\.\/branding\.js'/, 'A Torna megjelenítés a központi branding réteget használja.');
assert.match(source, /clubPresentations/, 'A klubpaletta a branding API-ból származik.');
assert.doesNotMatch(source, /TOURNAMENT_UI_CLUB_PRESENTATION/, 'Nem maradhat külön Torna klubpaletta.');
assert.match(source, /\.tx-mini-teams\{display:none!important\}/, 'A normál csapatválasztó ne jelenítsen második klubfalat.');
assert.match(source, /tournament-center\[data-experience-v2=/, 'A futó torna kapjon külön 2.0 vizuális hierarchiát.');
assert.match(source, /MÉRKŐZÉS/, 'A következő meccs egyetlen domináns CTA-ja legyen egyértelmű.');
assert.match(source, /Hatása a tornára/, 'A meccs utáni tournament impact legyen explicit.');
assert.match(source, /overviewButton && tournamentUiText\(overviewButton\.textContent\) !== 'Áttekintés'/,
  'A center polish nem írhatja újra feltétel nélkül ugyanazt a tabfeliratot a MutationObserver alatt.');
assert.doesNotMatch(source, /if \(overviewButton\) overviewButton\.textContent = 'Áttekintés'/,
  'A feltétel nélküli textContent-írás önfenntartó childList refresh ciklust okozhat.');
assert.match(source, /\.tournament-table\{font-size:\.78rem;min-width:0!important\}/,
  'A Tournament Experience mobilrétegének fel kell oldania a legacy 590px tabella-minimumot.');
assert.match(source, /\.tournament-table-wrap\{min-width:0;overflow-x:visible\}/,
  'A mobil tabella wrapper nem kényszeríthet belső vízszintes görgetést.');
assert.match(source, /__FOCISKARTYAK_TEAM_LOGO_RESTORATION__/);
assert.match(source, /min-height:44px/);
assert.match(source, /@media\(max-width:390px\)/);
assert.match(source, /@media\(max-width:340px\)/);
assert.match(source, /prefers-reduced-motion:reduce/);
assert.match(source, /forced-colors:active/);
assert.doesNotMatch(source, /https?:\/\//, 'A Torna UI nem hozhat be távoli asset URL-t.');

const entry = fs.readFileSync('js/tournament-experience-v2.js', 'utf8');
const standalone = fs.readFileSync('scripts/postprocess-standalone.mjs', 'utf8');
const serviceWorker = fs.readFileSync('sw.js', 'utf8');
assert.match(entry, /tournament\/tournament-ui-improvement\.js/);
assert.match(entry, /installTournamentUiImprovement\(\)/);
assert.doesNotMatch(
  entry,
  /tournament-table\s+th:nth-child\(n\+4\)[^`]*display:none/,
  'Mobilon nem rejthetők el a tabella GY/D/V/+/−/P oszlopai.',
);
assert.match(entry, /grid-template-areas:"pos team team team team pts" "played wins draws losses diff diff"/,
  'A mobil tabella két soros, overflowmentes kompaktnézetet használjon.');
assert.match(entry, /td:nth-child\(8\)\{grid-area:pts/, 'A pontszám külön mobil gridterületen maradjon látható.');
assert.match(entry, /td:nth-child\(8\)::before\{content:"P"\}/, 'A mobil pontszám kapjon olvasható P címkét.');
assert.match(entry, /td:nth-child\(7\)::before\{content:"\+\/−"\}/, 'A gólkülönbség is maradjon látható mobilon.');
assert.match(standalone, /const rapidTournamentDependencies =/,
  'A standalone rapid Torna modul explicit domain-függőségi hidat kapjon.');
assert.match(standalone, /TOURNAMENT_FORMAT, TOURNAMENT_MATCH_STATUS, TOURNAMENT_STATUS/,
  'A standalone rapid híd tartalmazza a szükséges Torna enumokat.');
assert.match(standalone, /\$\{rapidTournamentDependencies\}/,
  'A rapid Torna függőségi híd ténylegesen kerüljön a flattenelt blokk elé.');
assert.match(standalone, /tournament\/tournament-ui-improvement\.js/);
assert.match(serviceWorker, /\.\/js\/tournament\/tournament-ui-improvement\.js/);

console.log('✓ Tournament Experience 2.0: központi branding, idempotens center polish, teljes overflowmentes mobil tabella, standalone rapid domain-híd, next-match hero, mobil/a11y és offline bekötés rendben.');
