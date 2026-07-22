/** Generate the six UX handoff previews required by the usability audit. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const STANDALONE = path.join(ROOT, 'Fociskartyak2026.html');
const OUTPUT = path.join(ROOT, 'previews', 'usability-audit-2026');

const chrome = [
  process.env.CHROME_BIN,
  'google-chrome-stable',
  'google-chrome',
  'chromium',
  'chromium-browser',
].filter(Boolean).find(command => spawnSync(command, ['--version'], { encoding: 'utf8' }).status === 0);

if (!chrome) throw new Error('A képi előnézetekhez nem található Chrome vagy Chromium.');
if (!fs.existsSync(STANDALONE)) throw new Error('Hiányzik a generált Fociskartyak2026.html. Futtasd előbb az npm run build parancsot.');

const standalone = fs.readFileSync(STANDALONE, 'utf8');
const styleMatch = standalone.match(/<style>([\s\S]*?)<\/style>/i);
if (!styleMatch) throw new Error('A generált játékból nem olvasható ki a beágyazott CSS.');
const css = styleMatch[1];
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fociskartyak-usability-previews-'));

const card = ({ id, name, club, flag = '🇭🇺', position = 'Középpályás', age = 25, matches = 26, goals = 4, yellow = 3, active = true, extra = '' }) => `
  <article class="card selectable card--choice ${extra}" data-card-id="${id}" tabindex="0" role="button" aria-label="${name}, ${club}">
    <div class="card__portrait" role="img" aria-label="${name} semleges játékosillusztrációja"><span class="card__position">${position}</span></div>
    <div class="card__name">${name}</div>
    <div class="card__club">${club} <span class="card__nation-flag" aria-hidden="true">${flag}</span><span class="card__nation-name">Magyar</span></div>
    <div class="card__stats">
      <div class="stat ${active ? 'active' : ''}"><span class="stat__label">🎂 Életkor</span><span class="stat__value">${age} év</span></div>
      <div class="stat"><span class="stat__label">👕 Mérkőzések</span><span class="stat__value">${matches}</span></div>
      <div class="stat"><span class="stat__label">⚽ Gólok</span><span class="stat__value">${goals}</span></div>
      <div class="stat"><span class="stat__label">🟨 Sárga lap</span><span class="stat__value">${yellow}</span></div>
    </div>
  </article>`;

const sampleCards = [
  card({ id: 'lukacs', name: 'Lukács Bence', club: 'DVTK', age: 25, matches: 27, goals: 5, yellow: 4 }),
  card({ id: 'csoka', name: 'Csóka Dániel', club: 'ZTE FC', age: 26, matches: 24, goals: 2, yellow: 5, extra: 'is-selected' }),
  card({ id: 'nagy', name: 'Nagy Barnabás', club: 'Ferencvárosi TC', age: 24, matches: 19, goals: 1, yellow: 3 }),
  card({ id: 'torocsik', name: 'Törőcsik Péter', club: 'Újpest FC', age: 27, matches: 22, goals: 3, yellow: 6 }),
  card({ id: 'szabo', name: 'Szabó Levente', club: 'Paksi FC', age: 23, matches: 25, goals: 7, yellow: 2 }),
];

const header = ({ mode = 'Klasszikus mód', turn = '8. kör · Te választasz', meta = '8. kör · 36 lap a pakliban', human = 8, ai = 6 } = {}) => `
  <header id="hud">
    <div id="hud-context"><span class="hud-context__mode">${mode}</span><span class="hud-context__turn">${turn}</span></div>
    <div class="title">Fociskártyák 2026</div>
    <div class="score-strip" id="hud-scores">
      <div class="score score--human leading"><span>CSABI</span><b>${human}</b></div>
      <div class="score score--opponent"><span>ELLENFÉL</span><b>${ai}</b></div>
    </div>
    <div class="meta" id="hud-meta">${meta}</div>
    <div class="hud-settings" id="hud-settings"><button class="icon-toggle">☰ Menü</button></div>
  </header>`;

const shell = (content, classes = '') => `
<div id="pub" class="${classes}">
  <main id="table">${content}</main>
  <aside id="banter"><h2>A hátsó asztal</h2><div id="banter-feed"><div class="bubble"><div class="avatar">B</div><div class="bubble__body"><div class="bubble__name">Bandi</div><div class="bubble__text">Most már első pillantásra látszik, mi a következő lépés.</div></div></div></div></aside>
</div>`;

const tableZones = ({ felt, hand = '', opponent = true }) => `
  ${header()}
  <section class="zone" id="opponent-zone"><div class="pile" id="opponent-pile"><span class="pile__label">Ellenfél nyereménye</span>6</div><div class="hand hand--opponent" id="opponent-hand">${opponent ? '<div class="card card--back"></div><div class="card card--back"></div><div class="card card--back"></div>' : ''}</div></section>
  ${felt}
  <section class="zone" id="player-zone"><div class="pile filled" id="player-pile"><span class="pile__label">Megnyert lapok</span>8</div><div class="hand ${hand ? 'hand--selection' : ''}" id="player-hand">${hand}</div></section>`;

const home = `
<div id="pub"><main id="table">${header({ turn: 'Új mérkőzés', meta: 'Válassz paklit, ellenfelet és játékmódot', human: 0, ai: 0 })}</main></div>
<div id="overlay"><div class="panel menu-panel mobile-home" id="overlay-body" role="dialog" aria-modal="true">
  <p class="eyebrow">A hátsó asztal bajnoksága</p><h1>Fociskártyák 2026</h1>
  <p>Válassz játékmódot. Minden fontos lépés nagy, jól olvasható és billentyűzettel is elérhető.</p>
  <h2 class="menu-section-title">Új játék</h2>
  <div class="primary-mode-actions">
    <button class="btn mode-start"><span>🃏 Klasszikus mód</span><small>52 lapos, hosszabb kártyameccs</small></button>
    <button class="btn mode-start"><span>⚽ Büntetőpárbaj</span><small>11 lap, öt alappróbálkozás, majd hirtelen halál</small></button>
  </div>
  <details class="opponent-details"><summary>👤 Ellenfél kiválasztása</summary></details>
  <div class="secondary-menu-actions"><button class="btn btn--ghost">📖 Játékszabályok</button><button class="btn btn--ghost">⚙ Beállítások</button></div>
</div></div>`;

const deckSelection = `
<div id="pub"><main id="table">${header({ turn: '1. lépés · Pakliválasztás', meta: 'Legalább 11 használható kártya szükséges', human: 0, ai: 0 })}</main></div>
<div id="overlay"><div class="panel menu-panel mobile-home" id="overlay-body">
  <p class="eyebrow">Pakli összeállítása</p><h1>Válassz csapatot vagy nemzetiséget</h1>
  <details class="deck-selector" open><summary><span>🗂 Pakli kiválasztása<small class="deck-selector__current">Nemzetiség: 🇭🇺 Magyar · 185 kártya</small></span></summary>
    <div class="deck-selector__body"><p class="deck-selector__lead">Csak legalább 11 használható kártyával rendelkező csoport indítható.</p>
      <div class="deck-selector__kinds"><button class="deck-kind">🎲 Véletlen kártyák</button><button class="deck-kind">🛡️ Csapat választása</button><button class="deck-kind is-active">🌍 Nemzetiség</button></div>
      <label class="deck-selector__search-wrap"><span class="deck-selector__search-label">Keresés a nemzetiségek között</span><input class="deck-selector__search" value="mag"><span class="deck-selector__search-status">3 találat, ebből 2 választható. A kizárás oka mindenhol látható.</span></label>
      <div class="deck-selector__choice"><label><span>Nemzetiség</span><select><option>🇭🇺 Magyar — 185 kártya</option><option>🇷🇸 Szerb — 26 kártya</option><option disabled>🇲🇰 Észak-macedón — 7 kártya (nem választható: legalább 11 szükséges)</option></select></label><button class="btn deck-selector__apply">Pakli alkalmazása</button></div>
      <p class="deck-selector__note">A választás a Klasszikus módra és a Büntetőpárbajra is érvényes.</p>
    </div></details>
</div></div>`;

const selectionFelt = `
<section id="felt"><div class="game-steps"><span class="game-step is-complete">1. Kategória</span><span class="game-step is-active">2. Kártya</span><span class="game-step">3. Eredmény</span></div>
<div id="pot-indicator"></div><div id="prompt">Válassz kártyát <span class="highlight">Fiatalabb játékos</span><small class="ux-direction">a fiatalabb nyer</small></div>
<div id="duel"><div class="duel-slot"><div class="duel-slot__who">CSABI</div><div class="card card--empty"></div></div><div class="versus">VS</div><div class="duel-slot"><div class="duel-slot__who">ELLENFÉL</div><div class="card card--back"></div></div></div><div id="verdict"></div><div id="attribute-picker"></div></section>`;

const selection = shell(tableZones({ felt: selectionFelt, hand: sampleCards.join('') }), 'is-card-selection');

const battleFelt = `
<section id="felt"><div class="game-steps"><span class="game-step is-complete">1. Kategória</span><span class="game-step is-complete">2. Kártya</span><span class="game-step is-active">3. Eredmény</span></div>
<div id="pot-indicator"></div><div id="prompt">Fiatalabb játékos<small class="ux-direction">a fiatalabb nyer</small></div>
<div id="duel"><div class="duel-slot duel-slot--human loser"><div class="duel-slot__who">CSABI</div>${card({ id: 'csoka-battle', name: 'Csóka Dániel', club: 'ZTE FC', age: 26, matches: 24, goals: 2, yellow: 5 })}</div><div class="versus">VS</div><div class="duel-slot duel-slot--opponent winner"><div class="duel-slot__who">ELLENFÉL</div>${card({ id: 'nagy-battle', name: 'Nagy Barnabás', club: 'Ferencvárosi TC', age: 24, matches: 19, goals: 1, yellow: 3 })}</div></div>
<div id="verdict" class="lose">× Az ellenfél nyerte a kört<small>🎂 Fiatalabb játékos: 26 év &gt; 24 év</small></div><div id="attribute-picker" class="has-next-action"><button class="btn next-round-button">Következő kör</button></div></section>`;

const battle = shell(`${header()}<section class="zone" id="opponent-zone"></section>${battleFelt}<section class="zone" id="player-zone"></section>`, 'is-battle-active is-duel-focus');

const result = `
<div id="pub"><main id="table">${header({ turn: 'Mérkőzés vége', meta: '52 lap feldolgozva', human: 28, ai: 24 })}</main></div>
<div id="overlay"><div class="panel result-panel result-panel--win" id="overlay-body"><p class="result-kicker">Mérkőzés vége</p><h1>Győzelem</h1><div class="final-score">CSABI 28–24 ELLENFÉL</div>
<dl class="result-stats"><div><dt>Lejátszott körök</dt><dd>26</dd></div><div><dt>Megnyert körök</dt><dd>14</dd></div><div><dt>Legjobb kategória</dt><dd>⚽ Gólok (5)</dd></div></dl>
<div class="result-actions"><button class="btn">Visszavágó</button><button class="btn btn--ghost">Vissza a főmenübe</button></div></div></div>`;

const previews = [
  { file: '01-kezdokepernyo-jatekmodvalasztas.png', width: 1366, height: 900, body: home },
  { file: '02-csapat-nemzetisegvalasztas.png', width: 1366, height: 900, body: deckSelection },
  { file: '03-kartyavalasztas-asztali.png', width: 1366, height: 900, body: selection },
  { file: '04-kartyavalasztas-mobil.png', width: 390, height: 844, body: selection },
  { file: '05-csata-azonos-kartyakkal.png', width: 1366, height: 900, body: battle },
  { file: '06-merkozes-vegi-eredmeny.png', width: 1366, height: 900, body: result },
];

fs.mkdirSync(OUTPUT, { recursive: true });
const failures = [];
for (const preview of previews) {
  const htmlPath = path.join(temporaryDirectory, preview.file.replace(/\.png$/u, '.html'));
  const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${css}</style></head><body>${preview.body}</body></html>`;
  fs.writeFileSync(htmlPath, html);
  const outputPath = path.join(OUTPUT, preview.file);
  const shot = spawnSync(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars',
    '--run-all-compositor-stages-before-draw', `--window-size=${preview.width},${preview.height}`,
    '--force-device-scale-factor=1', '--virtual-time-budget=2200', `--screenshot=${outputPath}`, `file://${htmlPath}`,
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (shot.status !== 0 || !fs.existsSync(outputPath)) failures.push(`${preview.file}: ${shot.stderr.slice(-500)}`);
}

fs.rmSync(temporaryDirectory, { recursive: true, force: true });
if (failures.length) {
  console.error(`Előnézeti hibák:\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`✓ Hat kezelhetőségi előnézet elkészült: ${OUTPUT}`);
}
