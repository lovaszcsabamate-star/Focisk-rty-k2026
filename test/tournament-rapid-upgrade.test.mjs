import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(new URL('../js/tournament-rapid-upgrade.js', import.meta.url), 'utf8');
const flowPaths = [
  '../js/tournament/tournament-flow-shared.js',
  '../js/tournament/tournament-flow-wizard.js',
  '../js/tournament/tournament-flow-runtime.js',
  '../js/tournament-flow-upgrade.js',
  '../js/tournament/tournament-experience-v2-shared.js',
  '../js/tournament/tournament-experience-v2-wizard.js',
  '../js/tournament/tournament-experience-v2-runtime.js',
  '../js/tournament-experience-v2.js',
].map(relative => fileURLToPath(new URL(relative, import.meta.url)));
const flow = flowPaths.map(path => readFileSync(path, 'utf8')).join('\n');
const bootstrap = readFileSync(new URL('../js/bootstrap.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../css/tournament-rapid-upgrade.css', import.meta.url), 'utf8');
const experienceStyles = readFileSync(new URL('../css/tournament-experience-v2.css', import.meta.url), 'utf8');
const standalone = readFileSync(new URL('../scripts/postprocess-standalone.mjs', import.meta.url), 'utf8');

for (const flowPath of flowPaths) {
  const syntax = spawnSync(process.execPath, ['--check', flowPath], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || `A tornaválasztási modul szintaktikailag hibás: ${flowPath}`);
}

assert.match(bootstrap, /import\('\.\/tournament-rapid-upgrade\.js'\)/, 'A bootstrap töltse be a fejlesztést.');
assert.match(bootstrap, /import\('\.\/tournament-flow-upgrade\.js'\)/, 'A bootstrap töltse be a többlépcsős tornaválasztást.');
assert.match(bootstrap, /import\('\.\/tournament-experience-v2\.js'\)/, 'A bootstrap töltse be a Torna mód v2 élményrétegét.');
assert.match(source, /GROUP_KNOCKOUT[\s\S]*state\.phase === 'group'[\s\S]*return null;/, 'A csoportkör ne ígérjen hibás győzelemszámot.');
assert.ok(
  source.indexOf("label.includes('elodont')") < source.indexOf("label === 'donto'"),
  'Az elődöntőt a döntő előtt, külön kell felismerni.',
);
assert.match(source, /fold\(round\.label\) === 'donto'/, 'Csak a valódi döntő kapjon kupameccs címet.');
assert.match(source, /gyűjts pontokat a továbbjutáshoz/i, 'A csoportkör kapjon releváns felvezetést.');
assert.match(styles, /\.tournament-roadmap/, 'A tornahaladás vizuális elemei legyenek formázva.');
assert.match(styles, /\.tournament-match-summary/, 'A meccsösszefoglaló legyen formázva.');
assert.match(styles, /@media\(max-width:620px\)/, 'A fejlesztés maradjon mobilbarát.');

for (const label of ['Magyar Bajnokság', 'Magyar Kupa', 'Világkupa', 'Saját torna']) {
  assert.match(flow, new RegExp(label), `Hiányzó tornatípus: ${label}`);
}
for (const label of ['Tovább a tornában', 'Vissza a tornaághoz', 'Kilépés a főmenübe']) {
  assert.match(flow, new RegExp(label), `Hiányzó biztonságos eredményművelet: ${label}`);
}
assert.match(flow, /saveAndVerifyTournament[\s\S]*tournamentStorageService\.save\(state\)[\s\S]*tournamentStorageService\.read\(\)/, 'A mentést visszaolvasással kell ellenőrizni.');
assert.match(flow, /Már van egy folyamatban lévő tornád/, 'Az aktív torna felülírása kérjen megerősítést.');
assert.match(flow, /Jelenlegi torna folytatása[\s\S]*Új torna indítása[\s\S]*Mégse/, 'A felülírási párbeszéd mindhárom műveletet tartalmazza.');
assert.match(flow, /min-height:44px/, 'A mobilos érintési felület legalább 44 px legyen.');
assert.match(flow, /@media\(max-width:720px\)/, 'A tornaválasztás kapjon mobilos töréspontot.');
assert.match(flow, /input type=\"radio\" disabled[\s\S]*Vegyes mezőny/, 'A nem támogatott vegyes mezőny ne legyen félig működő opció.');
assert.match(flow, /TOURNAMENT_MATCH_STATUS\.TIEBREAK[\s\S]*TOURNAMENT_MATCH_MODE\.PENALTIES/, 'A döntetlen utáni büntetőpárbajt a véletlen keret is kezelje.');
assert.match(flow, /pushState[\s\S]*TOURNAMENT_HISTORY_KEY/, 'A tornaoverlay hozzon létre böngésző- és Android-kompatibilis visszalépési előzményt.');
assert.match(flow, /addEventListener\?\.\('popstate', handler/, 'A rendszer-vissza popstate eseménye legyen kezelve.');
assert.doesNotMatch(flow, /originalHome\.click\(\)/, 'A tornaeredmény navigációja ne függjön korábbi DOM-elem kattintásától.');

assert.match(flow, /function launchPreparedMatch\(/, 'A kézi és véletlen keret ugyanazt a megbízható meccsindítást használja.');
assert.match(flow, /deckRuntime\.stageQuickMatch\([\s\S]*navigateToStagedMatch\(trigger\)/, 'A párbaj csak sikeres előkészítés után navigáljon a játéktérre.');
assert.match(flow, /searchParams\.set\(MATCH_LAUNCH_QUERY_KEY/, 'Az Android WebView kapjon új URL-lekérést a meccs indulásakor.');
assert.match(flow, /enhanceLineup\(document\.querySelector\('\.tournament-lineup'\)\)/, 'A kézi keret Meccs indítása gombját a javított indító kezelje.');
assert.match(flow, /enhanceTournamentKickoff\(document\.querySelector\('\.penalty-intro #kickoff-btn'\)\)/, 'A torna büntetőpárbaja ne akadjon meg a második indítóképernyőn.');
assert.match(flow, /Párbaj indítása…/, 'A felhasználó kapjon egyértelmű indítási visszajelzést.');

for (const label of ['Magyarország', 'Nemzetközi', 'Saját', 'Tovább a csapatválasztáshoz']) {
  assert.match(flow, new RegExp(label), `A Torna mód v2-ből hiányzik: ${label}`);
}
for (const label of ['Minden ellenfél véletlenszerű', 'Kézi kiválasztás', 'Vegyes kiválasztás']) {
  assert.match(flow, new RegExp(label), `A Saját kupából hiányzik: ${label}`);
}
assert.match(flow, /Elkészült a torna sorsolása/, 'A sorsolás kapjon egyértelmű lezárást.');
assert.match(flow, /Sorsolás átugrása/, 'A sorsolási jelenet legyen átugorható.');
assert.match(flow, /configuration:[\s\S]*trophy:[\s\S]*drawPresented:/, 'A kupa megjelenése és a sorsolás állapota legyen a mentett torna része.');
assert.match(flow, /\['type', 'Tornaválasztás'\][\s\S]*\['team', 'Csapatválasztás'\][\s\S]*\['custom', 'Torna beállításai'\]/, 'A Saját kupa beállításai a csapatválasztás után jelenjenek meg.');
assert.match(flow, /\['type', 'Tornaválasztás'\], \['team', 'Csapatválasztás'\], \['summary', 'Összefoglaló'\]/, 'Az előre definiált tornák ne kapjanak felesleges beállítási lépést.');
assert.match(flow, /ArrowLeft[\s\S]*ArrowRight/, 'A csapatválasztás legyen billentyűzettel is kezelhető.');
assert.match(flow, /tx-bracket-round-nav/, 'A mobilos tornaág kapjon fordulóválasztót.');
assert.match(flow, /További lehetőségek/, 'A másodlagos torna-műveletek legyenek összecsukhatók.');
assert.doesNotMatch(flow, /UEFA|FIFA|Champions League/i, 'A saját tornaélmény ne használjon jogvédett versenyneveket.');
assert.match(experienceStyles, /@media\(max-width:760px\)/, 'A Torna mód v2 legyen mobilbarát.');
assert.match(experienceStyles, /prefers-reduced-motion:reduce/, 'A Torna mód v2 tisztelje a csökkentett mozgás beállítást.');
assert.match(experienceStyles, /\.tournament-bracket__round\.is-mobile-active/, 'Mobilon egyszerre egy tornaforduló jelenjen meg.');
assert.match(experienceStyles, /\.tx-trophy/, 'Minden tornához legyen saját, jogtiszta kupa-megjelenítés.');

assert.match(standalone, /RAPID_TOURNAMENT_MARKER/, 'Az egyfájlos build ágyazza be a tornafejlesztési modult.');
assert.match(standalone, /FLOW_TOURNAMENT_MARKER/, 'Az egyfájlos build ágyazza be a többlépcsős tornaválasztást.');
assert.match(standalone, /EXPERIENCE_TOURNAMENT_MARKER/, 'Az egyfájlos build ágyazza be a Torna mód v2 élményrétegét.');
assert.match(standalone, /EXPERIENCE_TOURNAMENT_STYLE_MARKER/, 'Az egyfájlos build ágyazza be a Torna mód v2 stílusát.');
assert.match(standalone, /FociskartyakDeckSelectionRuntime/, 'Az egyfájlos build tegye elérhetővé a pakliválasztó futtatókörnyezetet.');
assert.match(standalone, /TOURNAMENT_IIFE_MARKER/, 'A standalone build az eredeti torna-IIFE-t használja.');
assert.match(standalone, /lastIndexOf\(TOURNAMENT_IIFE_END, mainStart\)/, 'A flow modulokat a torna-IIFE lezárása elé kell beilleszteni.');
assert.match(standalone, /assertFlowRuntimeScope\(html\)/, 'A standalone build ellenőrizze a flow modulok futtatási hatókörét.');
assert.match(standalone, /RAPID_TOURNAMENT_STYLE_MARKER/, 'Az egyfájlos build ágyazza be a tornafejlesztési stílust.');
assert.match(standalone, /import\.meta\.url/, 'A standalone transzformáció kezelje a modul relatív stílusútvonalát.');
assert.match(standalone, /FLOW_BRIDGE_NAME/, 'A Torna mód v2 külön futtatási blokkban, kompatibilitási híddal működjön.');
assert.match(standalone, /normaliseWizardParticipantIds/, 'A standalone transzformáció kerülje el a névütközést.');
assert.match(
  standalone,
  /replaceAll\('tournamentStorageService\.read\(\)', 'globalThis\.FociskartyakTournament\?\.read\?\.\(\)'\)/,
  'A gyors tornafejlesztés a publikus torna API-n keresztül olvassa a mentést.',
);

console.log('Tournament rapid, flow and experience v2 regression checks passed.');
