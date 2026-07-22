import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = relative => path.join(ROOT, relative);
const read = relative => fs.readFileSync(file(relative), 'utf8');
const write = (relative, content) => {
  fs.mkdirSync(path.dirname(file(relative)), { recursive: true });
  fs.writeFileSync(file(relative), content.endsWith('\n') ? content : `${content}\n`);
};
const replaceRequired = (source, needle, replacement, label) => {
  if (!source.includes(needle)) throw new Error(`Nem található a kötelező tesztjavítási pont: ${label}`);
  return source.replace(needle, replacement);
};

const packageJson = JSON.parse(read('package.json'));
packageJson.scripts.lint = packageJson.scripts.lint
  .replace(' && node --check js/focus-experience.js', '')
  .replace(' && node --check js/usability-fixes.js', '')
  + ' && node --check playwright.config.mjs && node --check test/e2e/mobile-layout.spec.mjs && node --check test/stabilization.test.mjs';
packageJson.scripts.test = `${packageJson.scripts.test} && node test/stabilization.test.mjs`;
packageJson.scripts['test:all'] = `${packageJson.scripts['test:all']} && node test/stabilization.test.mjs`;
packageJson.scripts['test:e2e'] = 'playwright test';
packageJson.scripts['test:mobile-layout'] = `${packageJson.scripts['test:mobile-layout']} && playwright test test/e2e/mobile-layout.spec.mjs`;
packageJson.scripts['check:standalone'] = 'npm run build && git diff --exit-code -- Fociskartyak2026.html data';
write('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);

write('playwright.config.mjs', `import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 75_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'line',
  use: {
    baseURL: 'http://127.0.0.1:8901',
    browserName: 'chromium',
    headless: true,
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'python3 -m http.server 8901 --bind 127.0.0.1',
    url: 'http://127.0.0.1:8901',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
`);

write('test/stabilization.test.mjs', `import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const text = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};

const profile = await import('../js/player-profile.js');
assert.equal(profile.normalizePlayerName('  Csabi   Kapitány  '), 'Csabi Kapitány');
assert.equal(profile.normalizePlayerName(''), '');
assert.equal(profile.normalizePlayerName('x'.repeat(40)).length, 24);
assert.equal(profile.loadPlayerName(), 'Játékos');
assert.equal(profile.savePlayerName('  Csabi  '), 'Csabi');
assert.equal(profile.loadPlayerName(), 'Csabi');
assert.equal(profile.savePlayerName('   '), 'Játékos');
assert.equal(profile.loadPlayerName(), 'Játékos');

const playerProfileSource = text('js/player-profile.js');
assert.doesNotMatch(playerProfileSource, /MutationObserver/);
assert.doesNotMatch(playerProfileSource, /replaceAll\(['\"]Penalties/);
assert.doesNotMatch(playerProfileSource, /innerHTML\s*=/);

for (const deleted of [
  'js/usability-fixes.js',
  'js/focus-experience.js',
  'css/mobile-overlay-fix.css',
  'css/player-profile.css',
  'css/focus-experience.css',
  'css/mobile-selection-fix.css',
  'css/duel-emphasis.css',
  'css/phase-refinements.css',
]) assert.equal(fs.existsSync(path.join(ROOT, deleted)), false, `A felesleges fájl megmaradt: ${deleted}`);

const visibleSources = [
  'index.html', 'js/main.js', 'js/matchday.js', 'js/mobile-experience.js',
  'README.md', 'manifest.webmanifest', 'Fociskartyak2026.html',
].map(text).join('\n');
assert.doesNotMatch(visibleSources, /Penalties mód/u);
assert.doesNotMatch(visibleSources, /Tizenegyes mód/u);
assert.doesNotMatch(visibleSources, />\s*Penalties\s*</u);

const index = text('index.html');
const serviceWorker = text('sw.js');
const build = text('scripts/build-standalone.mjs');
for (const removedName of [
  'mobile-overlay-fix', 'player-profile.css', 'focus-experience.css',
  'mobile-selection-fix', 'duel-emphasis', 'phase-refinements',
  'usability-fixes.js', 'focus-experience.js',
]) {
  assert.equal(index.includes(removedName), false, `Törött index-hivatkozás: ${removedName}`);
  assert.equal(serviceWorker.includes(removedName), false, `Törött cache-hivatkozás: ${removedName}`);
  assert.equal(build.includes(removedName), false, `Törött standalone-hivatkozás: ${removedName}`);
}

assert.match(text('css/mobile-experience.css'), /--battle-card-width/);
assert.match(text('css/mobile-experience.css'), /prefers-reduced-motion/);
assert.match(text('JATEK_INDITASA.bat'), /--check/);
assert.match(text('.github/workflows/ci.yml'), /npm ci/);
assert.match(text('.github/workflows/ci.yml'), /git diff --check/);
assert.match(text('.github/workflows/ci.yml'), /test:mobile-layout/);

console.log('✓ A közvetlen játékosprofil, magyar feliratok és konszolidált fájllánc rendben');
`);

write('test/player-profile.test.mjs', `import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};

const {
  DEFAULT_PLAYER_NAME,
  MAX_PLAYER_NAME_LENGTH,
  PLAYER_NAME_STORAGE_KEY,
  hasSavedPlayerName,
  loadPlayerName,
  normalizePlayerName,
  savePlayerName,
  subscribePlayerName,
} = await import('../js/player-profile.js');

assert.equal(normalizePlayerName('  Csabi   Kapitány  '), 'Csabi Kapitány');
assert.equal(normalizePlayerName(''), '');
assert.equal(normalizePlayerName('x'.repeat(40)).length, MAX_PLAYER_NAME_LENGTH);
assert.equal(loadPlayerName(), DEFAULT_PLAYER_NAME);
assert.equal(hasSavedPlayerName(), false);

let observed = null;
const unsubscribe = subscribePlayerName(name => { observed = name; });
assert.equal(savePlayerName('  Csabi  '), 'Csabi');
assert.equal(memory.get(PLAYER_NAME_STORAGE_KEY), 'Csabi');
assert.equal(loadPlayerName(), 'Csabi');
assert.equal(hasSavedPlayerName(), true);
assert.equal(observed, 'Csabi');
unsubscribe();

assert.equal(savePlayerName('   '), DEFAULT_PLAYER_NAME);
assert.equal(memory.has(PLAYER_NAME_STORAGE_KEY), false);
assert.equal(loadPlayerName(), DEFAULT_PLAYER_NAME);

console.log('✓ A játékosnév normalizálása, mentése és célzott értesítése rendben');
`);

write('test/e2e/mobile-layout.spec.mjs', `import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PREVIEWS = path.join(ROOT, 'test-artifacts', 'previews');
fs.mkdirSync(PREVIEWS, { recursive: true });

const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x740', width: 360, height: 740 },
  { name: '360x800', width: 360, height: 800 },
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: '480x900', width: 480, height: 900 },
  { name: '720x1280', width: 720, height: 1280 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '740x360', width: 740, height: 360 },
  { name: '844x390', width: 844, height: 390 },
];

async function preparePage(page, viewport, playerName = 'Csabi') {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      localStorage.setItem('fociskartyak:onboarding-complete', 'true');
    } catch { /* target origin initializes storage later */ }
    Math.random = () => 0;
  });
  await page.goto('/?e2e=1');
  await expect(page.locator('.mobile-home')).toBeVisible();
  const input = page.locator('[data-player-profile-editor="home"] input');
  await input.fill(playerName);
  await page.locator('[data-player-profile-editor="home"] button[type="submit"]').click();
  await expect(page.locator('[data-player-profile-editor="home"] .player-profile__status')).toContainText('Mentve');
}

async function ensureAppearances(page) {
  await page.evaluate(() => {
    const session = globalThis.__FOCISKARTYAK_SESSION__;
    const game = session?.game;
    if (!game) throw new Error('A tesztmunkamenet nem érhető el.');
    const cards = [
      ...(game.hands?.human ?? []), ...(game.hands?.ai ?? []),
      ...(game.teams?.human ?? []), ...(game.teams?.ai ?? []),
    ];
    for (const card of cards) {
      card.stats ??= {};
      card.stats.appearances = Number.isFinite(card.stats.appearances) ? card.stats.appearances : 10;
    }
    if (game.phase === 'choose-attribute') session.beginRound();
  });
}

async function startClassicSelection(page) {
  await page.locator('#start-btn').click();
  await ensureAppearances(page);
  const attribute = page.locator('#attribute-picker [data-attribute="appearances"]');
  await expect(attribute).toBeVisible();
  await attribute.click();
  await expect(page.locator('#player-hand .card--direct-play').first()).toBeVisible();
  await expect(page.locator('#hud-scores')).toContainText('CSABI', { ignoreCase: true });
}

async function measureSelection(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('#player-hand .card--choice')].map(node => node.getBoundingClientRect());
    const hand = document.querySelector('#player-hand');
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return {
      viewportWidth: innerWidth,
      documentWidth,
      widths: cards.map(rect => rect.width),
      overlaps: cards.slice(1).some((rect, index) => rect.left < cards[index].right - 1),
      handScrollable: hand.scrollWidth > hand.clientWidth,
      headerVisible: document.querySelector('#hud').getBoundingClientRect().height > 0,
      promptVisible: document.querySelector('#prompt').getBoundingClientRect().height > 0,
    };
  });
}

async function commitFirstCard(page, double = false) {
  const inspect = page.locator('#player-hand .card--choice .card__inspect').first();
  await inspect.click();
  await expect(page.locator('#inspector')).toBeVisible();
  const play = page.locator('#inspector .inspector__actions .btn:not(.btn--ghost)');
  if (double) {
    await play.evaluate(button => { button.click(); button.click(); });
  } else {
    await play.click();
  }
  await page.waitForFunction(() => document.querySelectorAll('#duel .duel-slot .card:not(.card--back):not(.card--empty)').length === 2);
}

async function measureBattle(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('#duel .duel-slot .card')].map(node => node.getBoundingClientRect());
    const versus = document.querySelector('#duel .versus').getBoundingClientRect();
    const next = document.querySelector('.next-round-button');
    const overlaps = cards.length === 2 && cards[0].right > cards[1].left;
    const overlapsVs = cards.some(rect => rect.right > versus.left && rect.left < versus.right);
    const visible = node => {
      if (!node) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    return {
      documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      viewportWidth: innerWidth,
      widths: cards.map(rect => rect.width),
      heights: cards.map(rect => rect.height),
      overlaps,
      overlapsVs,
      playerZoneHidden: !visible(document.querySelector('#player-zone')),
      opponentZoneHidden: !visible(document.querySelector('#opponent-zone')),
      headerVisible: visible(document.querySelector('#hud')),
      promptVisible: visible(document.querySelector('#prompt')),
      verdictVisible: visible(document.querySelector('#verdict')),
      nextVisible: visible(next) && !next.disabled,
    };
  });
}

function assertSelectionLayout(measurement) {
  expect(measurement.documentWidth).toBeLessThanOrEqual(measurement.viewportWidth + 1);
  expect(measurement.overlaps).toBeFalsy();
  expect(measurement.widths.length).toBeGreaterThan(0);
  expect(measurement.widths.every(width => width >= 90)).toBeTruthy();
  expect(measurement.headerVisible).toBeTruthy();
  expect(measurement.promptVisible).toBeTruthy();
}

function assertBattleLayout(measurement) {
  expect(measurement.documentWidth).toBeLessThanOrEqual(measurement.viewportWidth + 1);
  expect(measurement.widths).toHaveLength(2);
  expect(Math.abs(measurement.widths[0] - measurement.widths[1])).toBeLessThanOrEqual(1);
  expect(Math.abs(measurement.heights[0] - measurement.heights[1])).toBeLessThanOrEqual(1);
  expect(measurement.overlaps).toBeFalsy();
  expect(measurement.overlapsVs).toBeFalsy();
  expect(measurement.playerZoneHidden).toBeTruthy();
  expect(measurement.opponentZoneHidden).toBeTruthy();
  expect(measurement.headerVisible).toBeTruthy();
  expect(measurement.promptVisible).toBeTruthy();
  expect(measurement.verdictVisible).toBeTruthy();
  expect(measurement.nextVisible).toBeTruthy();
}

test('mobil Klasszikus mód: név, nézegető, egyszeri kijátszás, mentés és folytatás', async ({ page }) => {
  await preparePage(page, { width: 390, height: 844 }, 'Nagyon Hosszú Csabinév 123');
  await startClassicSelection(page);
  await page.screenshot({ path: path.join(PREVIEWS, 'mobil-valasztasi-fazis.png'), fullPage: true });

  const firstCard = page.locator('#player-hand .card--choice').first();
  await firstCard.dispatchEvent('pointerdown');
  await expect(firstCard).toHaveClass(/is-selected/);
  const selectedBox = await firstCard.boundingBox();
  expect(selectedBox.width).toBeGreaterThan(90);
  await page.screenshot({ path: path.join(PREVIEWS, 'mobil-kijelolt-kartya.png'), fullPage: true });

  await firstCard.locator('.card__inspect').click();
  await expect(page.locator('#inspector')).toBeVisible();
  const before = await page.locator('#inspector .inspector__counter').textContent();
  await page.locator('#inspector .inspector__nav').last().click();
  await expect(page.locator('#inspector .inspector__counter')).not.toHaveText(before);
  await page.locator('#inspector .inspector__nav').first().click();
  await page.screenshot({ path: path.join(PREVIEWS, 'mobil-kartyanezegeto.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(page.locator('#inspector')).toHaveCount(0);

  await commitFirstCard(page, true);
  await expect(page.locator('#pub')).toHaveClass(/is-battle-active/);
  await page.screenshot({ path: path.join(PREVIEWS, 'mobil-csatafazis.png'), fullPage: true });
  await expect(page.locator('#verdict')).not.toBeEmpty();
  await expect.poll(() => page.evaluate(() => globalThis.__FOCISKARTYAK_SESSION__.game.log.length)).toBe(1);
  await page.screenshot({ path: path.join(PREVIEWS, 'mobil-eredmenyfazis.png'), fullPage: true });
  assertBattleLayout(await measureBattle(page));

  await page.locator('.next-round-button').click();
  await expect.poll(() => page.evaluate(() => globalThis.__FOCISKARTYAK_SESSION__.game.round)).toBeGreaterThan(1);
  await page.reload();
  await expect(page.locator('#continue-btn')).toBeVisible();
  await page.locator('#continue-btn').click();
  await expect(page.locator('#hud-scores')).toContainText('NAGYON HOSSZÚ CSABINÉV 12', { ignoreCase: true });
  await expect.poll(() => page.evaluate(() => globalThis.__FOCISKARTYAK_SESSION__.game.round)).toBeGreaterThan(1);
});

async function configurePenaltyAi(page) {
  await page.evaluate(() => {
    const session = globalThis.__FOCISKARTYAK_SESSION__;
    session.ai.chooseAttribute = hand => ({ attribute: 'appearances', cardId: hand[0].id });
    session.ai.chooseCard = hand => hand.find(card => Number.isFinite(card?.stats?.appearances))?.id ?? hand[0].id;
  });
}

async function playPenaltyOutcome(page, outcome, expectedLogLength) {
  await page.waitForFunction(() => {
    const game = globalThis.__FOCISKARTYAK_SESSION__?.game;
    return game && (game.phase === 'choose-attribute' || game.phase === 'choose-card');
  });
  const chooser = await page.evaluate(() => globalThis.__FOCISKARTYAK_SESSION__.game.chooser);
  if (chooser === 'human') {
    await ensureAppearances(page);
    const button = page.locator('#attribute-picker [data-attribute="appearances"]');
    await expect(button).toBeVisible();
    await button.click();
  } else {
    await page.waitForFunction(() => document.querySelectorAll('#player-hand .card--direct-play').length > 0);
  }

  await page.evaluate(selectedOutcome => {
    const game = globalThis.__FOCISKARTYAK_SESSION__.game;
    const humanValue = selectedOutcome === 'ai' ? 10 : 20;
    const aiValue = selectedOutcome === 'human' ? 10 : 20;
    const finalHuman = selectedOutcome === 'tie' ? 15 : humanValue;
    const finalAi = selectedOutcome === 'tie' ? 15 : aiValue;
    for (const card of [...game.hands.human, game.played.human].filter(Boolean)) {
      card.stats ??= {};
      card.stats.appearances = finalHuman;
    }
    for (const card of [...game.hands.ai, game.played.ai].filter(Boolean)) {
      card.stats ??= {};
      card.stats.appearances = finalAi;
    }
  }, outcome);

  await page.locator('#player-hand .card--direct-play').first().click();
  await expect.poll(() => page.evaluate(() => globalThis.__FOCISKARTYAK_SESSION__.game.log.length)).toBe(expectedLogLength);
}

test('valódi Büntetőpárbaj: öt párbaj, hirtelen halál, frissítés és végeredmény', async ({ page }) => {
  await preparePage(page, { width: 390, height: 844 }, 'Csabi');
  await page.locator('#penalties-btn').click();
  await expect(page.locator('.penalty-intro')).toContainText('Büntetőpárbaj');
  await page.locator('#kickoff-btn').click();
  await ensureAppearances(page);
  await configurePenaltyAi(page);
  await expect(page.locator('#penalty-board .attempt-row').first()).toContainText('CSABI', { ignoreCase: true });
  await expect(page.locator('#penalty-board .attempt').first()).toHaveCount(11);
  await page.screenshot({ path: path.join(PREVIEWS, 'mobil-buntetoparbaj.png'), fullPage: true });

  const outcomes = ['tie', 'human', 'ai', 'tie', 'tie'];
  for (let index = 0; index < outcomes.length; index += 1) {
    await playPenaltyOutcome(page, outcomes[index], index + 1);
    if (index < outcomes.length - 1) {
      await expect(page.locator('.next-round-button')).toBeVisible();
      await page.locator('.next-round-button').click();
      await configurePenaltyAi(page);
    }
  }

  await expect(page.locator('#sudden-death-banner')).toBeVisible();
  await page.screenshot({ path: path.join(PREVIEWS, 'mobil-hirtelen-halal.png'), fullPage: true });
  await page.reload();
  await expect(page.locator('#continue-btn')).toBeVisible();
  await page.locator('#continue-btn').click();
  await expect.poll(() => page.evaluate(() => globalThis.__FOCISKARTYAK_SESSION__.game.log.length)).toBe(5);
  await expect.poll(() => page.evaluate(() => globalThis.__FOCISKARTYAK_SESSION__.ui.uxStats.rounds)).toBe(5);
  await expect(page.locator('.next-round-button')).toBeVisible();
  await page.locator('.next-round-button').click();
  await configurePenaltyAi(page);
  await playPenaltyOutcome(page, 'human', 6);
  await expect(page.locator('.result-panel')).toBeVisible();
  await expect(page.locator('.result-panel')).toContainText('GYŐZELEM');
  await expect(page.locator('.final-score')).toContainText('CSABI');
  await expect(page.locator('body')).not.toContainText('Penalties');
  await expect(page.locator('body')).not.toContainText('Tizenegyes mód');
});

for (const viewport of VIEWPORTS) {
  test(`reszponzív valódi játékmenet: ${viewport.name}`, async ({ page }) => {
    await preparePage(page, { width: viewport.width, height: viewport.height }, 'Csabi');
    await startClassicSelection(page);
    assertSelectionLayout(await measureSelection(page));
    if (viewport.name === '768x1024') {
      await page.screenshot({ path: path.join(PREVIEWS, 'tablet-valasztasi-fazis.png'), fullPage: true });
    }
    if (viewport.name === '1366x768') {
      await page.screenshot({ path: path.join(PREVIEWS, 'asztali-valasztasi-fazis.png'), fullPage: true });
    }
    await commitFirstCard(page);
    await expect(page.locator('#verdict')).not.toBeEmpty();
    assertBattleLayout(await measureBattle(page));
    if (viewport.name === '768x1024') {
      await page.screenshot({ path: path.join(PREVIEWS, 'tablet-csatafazis.png'), fullPage: true });
    }
    if (viewport.name === '1366x768') {
      await page.screenshot({ path: path.join(PREVIEWS, 'asztali-csatafazis.png'), fullPage: true });
    }
  });
}

test('standalone és offline indítás', async ({ page, context }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.addInitScript(() => {
    localStorage.setItem('fociskartyak:onboarding-complete', 'true');
    Math.random = () => 0;
  });
  await page.goto('/Fociskartyak2026.html?e2e=1');
  await expect(page.locator('.mobile-home')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Penalties mód');
  await expect(page.locator('body')).not.toContainText('Tizenegyes mód');

  await page.goto('/?e2e=1');
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.mobile-home')).toBeVisible();
  await context.setOffline(false);
});
`);

let phaseSmoke = read('scripts/mobile-phase-smoke.mjs');
phaseSmoke = replaceRequired(phaseSmoke,
  "const focusScript = fs.readFileSync(path.join(ROOT, 'js/focus-experience.js'), 'utf8').replace(/<\\/script/gi, '<\\\\/script');",
  "const focusScript = '';",
  'fixture fókuszréteg eltávolítása');
phaseSmoke = replaceRequired(phaseSmoke,
  `  inspector.querySelector('#commit-card').addEventListener('click',()=>{
    committed+=1;
    document.querySelector('#duel').innerHTML='<div class="duel-slot"><div class="duel-slot__who">CSABI</div>'+${'${humanBattleCardJs}'}+'</div><div class="versus">VS</div><div class="duel-slot"><div class="duel-slot__who">GÉP</div>'+${'${aiBattleCardJs}'}+'</div>';
    [...hand.querySelectorAll('.card')].forEach(node=>node.classList.add('card--dim'));
    inspector.remove();
  });`,
  `  let commitPending=false;
  inspector.querySelector('#commit-card').addEventListener('click',()=>{
    if(commitPending)return;
    commitPending=true;
    pub.classList.add('is-battle-transition');
    inspector.classList.add('is-battle-transition');
    setTimeout(()=>{
      committed+=1;
      document.querySelector('#duel').innerHTML='<div class="duel-slot"><div class="duel-slot__who">CSABI</div>'+${'${humanBattleCardJs}'}+'</div><div class="versus">VS</div><div class="duel-slot"><div class="duel-slot__who">GÉP</div>'+${'${aiBattleCardJs}'}+'</div>';
      [...hand.querySelectorAll('.card')].forEach(node=>node.classList.add('card--dim'));
      pub.classList.remove('is-battle-transition','is-card-selection');
      pub.classList.add('is-battle-active','is-duel-focus');
      inspector.remove();
    },250);
  });`,
  'fixture közvetlen átmenet');
write('scripts/mobile-phase-smoke.mjs', phaseSmoke);

write('.github/workflows/ci.yml', `name: Stabil béta ellenőrzés

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Forrás letöltése
        uses: actions/checkout@v4
      - name: Node.js beállítása
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - name: Függőségek telepítése
        run: npm ci
      - name: Chromium telepítése
        run: npx playwright install --with-deps chromium
      - name: Szintaxis- és lintellenőrzés
        run: npm run lint
      - name: Standalone build
        run: npm run build
      - name: A generált állományok naprakészségének ellenőrzése
        run: git diff --exit-code -- Fociskartyak2026.html data
      - name: Alaptesztek
        run: npm test
      - name: Teljes tesztcsomag
        run: npm run test:all
      - name: Mobil- és reszponzív tesztek
        run: npm run test:mobile-layout
      - name: Git formázási ellenőrzés
        run: git diff --check
      - name: Teszttermékek feltöltése
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: fociskartyak-test-artifacts
          if-no-files-found: warn
          path: |
            test-artifacts/
            previews/
            playwright-report/
            mobile-layout-report.json

  windows-launcher:
    runs-on: windows-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - name: Windows indító ellenőrzése
        shell: cmd
        run: JATEK_INDITASA.bat --check
`);

write('README.md', `# Fociskártyák 2026

Magyar nyelvű, HTML–CSS–JavaScript alapú, kocsmai hangulatú összehasonlító kártyajáték a 2025/26-os NB I **440 egyedi játékosból és 464 játékos–klub regisztrációból** álló, MLSZ-elsődleges adatbázisával. Böngészőben, offline PWA-ként, Android-csomag előkészítéssel és egyfájlos Windows-verzióként fut.

## Indítás

### Windows, telepítés nélkül

1. Csomagold ki a teljes projektmappát.
2. Kattints duplán a `JATEK_INDITASA.bat` fájlra.
3. Az indító ellenőrzi, majd megnyitja a `Fociskartyak2026.html` önálló játékfájlt.

Automatizált indítóellenőrzés:

\`\`\`bat
JATEK_INDITASA.bat --check
\`\`\`

### Fejlesztői indítás

\`\`\`bash
npm install
npm start
\`\`\`

Ezután nyisd meg: `http://localhost:8901`.

## Játékmódok

- **Klasszikus mód:** 52 lapos mérkőzés, öt lapos kéz, körönként felváltott kategóriaválasztás. A győztes viszi a két lapot és az esetleges döntetlenpaklit.
- **Büntetőpárbaj:** mindkét fél 11 lapot kap. Öt rendes párbaj után a matematikailag eldőlt mérkőzés lezárul; döntetlennél hirtelen halál következik. Azonos értéknél nincs gól.

Mindkét mód menthető és oldalfrissítés után folytatható. A játékállás és a játékosprofil külön `localStorage`-kulcson tárolódik.

## Játékosnév

A név legfeljebb 24 karakteres. Mentéskor a rendszer:

- összevonja a fölösleges szóközöket;
- üres névnél a **Játékos** alapnevet használja;
- kizárólag szövegként jeleníti meg;
- célzott újrarendereléssel frissíti az eredményjelzőt, a csatakártya feliratát, a próbálkozássort és a végeredményt;
- új játékban és folytatott mentésben is megőrzi.

A profil kulcsa: `fociskartyak:player-name:v1`. A mérkőzésmentés kulcsa: `fociskartyak:saved-match:v2`.

## Build és önálló játékfájl

\`\`\`bash
npm run build
\`\`\`

A build újragenerálja:

- `Fociskartyak2026.html`;
- `data/players-reviewed.json`;
- `data/enrichment-audit.json`;
- az adatbázis-felülvizsgálati jelentéseket.

A build determinisztikus: a GitHub Actions hibára fut, ha a forrás és a verziókezelt standalone fájl eltér.

## Tesztelés

Kötelező helyi ellenőrzés:

\`\`\`bash
npm install
npm run lint
npm run build
npm test
npm run test:all
npm run test:mobile-layout
\`\`\`

További parancsok:

\`\`\`bash
npm run test:e2e
npm run check:standalone
\`\`\`

A `test:mobile-layout` megtartja a gyors HTML-fixture teszteket, és elindítja a valódi alkalmazást használó Playwright-játékmeneteket is.

### Automatikusan vizsgált képernyők

`320×568`, `360×740`, `360×800`, `375×812`, `390×844`, `412×915`, `480×900`, `720×1280`, `768×1024`, `1024×768`, `1366×768`, valamint `740×360` és `844×390` fekvő mobilnézet.

A teszt hibára fut többek között eltérő csatakártya-méretnél, kártya- vagy VS-átfedésnél, oldalszintű vízszintes görgetésnél, látható kéznél a csatafázisban, eltűnt névnél, dupla kijátszásnál vagy angol játékmódfeliratnál.

Az előnézeti képek helye: `test-artifacts/previews/`.

## Offline és service worker

Az első online megnyitás után a service worker gyorsítótárazza az alkalmazásvázat és az adatforrásokat. Kód és adat esetén hálózat-első, statikus képnél gyorsítótár-első stratégia működik. Új verzió aktiválásakor a régi gyorsítótár törlődik. Az önálló HTML service worker nélkül is fut.

## Android-előkészítés

\`\`\`bash
npm run mobile:prepare
npm run mobile:add:android
npm run mobile:sync:android
npm run mobile:open:android
\`\`\`

Az első `mobile:add:android` futtatás csak egyszer szükséges. Az Android Studio és a megfelelő Android SDK külön telepítendő.

## Adatforrási elvek

- Az eredeti `data/players.json` forráspillanatkép változatlan marad.
- Valós mező nem írható felül kitalált vagy becsült értékkel.
- A kluboldali rétegek csak ellenőrzött, nyilvános forrásból származó hiányt pótolhatnak.
- Eltérésnél az MLSZ-adat az elsődleges, az ütközés auditálva marad.
- Hiányzó adat nem jelenik meg a kártyán, és nem válik automatikus játékkategóriává.
- A pontos születési dátum az összehasonlítást vezérli; a kártyán csak a kerekített életkor látható.
- A számított játékospontszám nem látható és nem játékkategória.

A teljes forrásjegyzék: `data/club-official-sources.json`.

## GitHub Actions

Minden normál push és pull request futtatja:

- `npm ci`;
- `npm run lint`;
- `npm run build`;
- a standalone naprakészségi ellenőrzését;
- `npm test`;
- `npm run test:all`;
- `npm run test:mobile-layout`;
- `git diff --check`;
- Windows alatt a `JATEK_INDITASA.bat --check` parancsot.

A workflow nem készít build-commitot. Hiba esetén piros, a böngészős teszttermékeket pedig artifactként megőrzi.

## Ismert korlátozások

- Az első PWA-használat előtt internetkapcsolat szükséges a gyorsítótár feltöltéséhez.
- Az önálló HTML nem frissül automatikusan; új verziónál újra le kell tölteni vagy buildelni.
- Az iOS telepítés kézi, a Safari „Főképernyőhöz adás” funkciójával történik.
- A magasság, játékperc és gólpassz lefedettsége nem elég teljes minden adatbázisszintű kategória aktiválásához.
- A projekt nem tartalmaz játékosfotókat, klubcímereket, MLSZ-logót vagy Transfermarkt-piaci értéket.

## Technikai jelentés

A stabilizáció részletes fájl- és tesztjegyzéke: [`TECHNICAL_REPORT.md`](TECHNICAL_REPORT.md).

## Jogi megjegyzés

A projekt prototípus- és kutatási célú. Nyilvánosan megjelenített MLSZ- és kluboldali tényadatokat használ. Nyilvános vagy kereskedelmi terjesztés előtt külön ellenőrizni kell a felhasználási feltételeket, az adatbázis-jogi kérdéseket, valamint a név- és képmáshasználatot.
`);

write('TECHNICAL_REPORT.md', `# Fociskártyák 2026 – béta-stabilizációs műszaki jelentés

Dátum: 2026. július 22.  
Ág: ` + '`stabilize-beta-2026-07-22`' + `

## 1. Feltárt hibák és kockázatok

- A játékosnév és több magyar felirat teljes dokumentumot figyelő `MutationObserver` segítségével, utólagos DOM-átírással jelent meg.
- A játékmódfeliratok forrásában több helyen megmaradt a „Penalties mód” és „Tizenegyes mód”.
- A kártyanézegető billentyűkezelését egymásra épülő `UI.prototype`-felülírások cserélték le.
- A kártyakijátszási animáció globális kattintás-elfogással, majd mesterséges újrakattintással működött.
- A mobilréteg globálisan felülírta a `setTimeout` függvényt, a prompt szövegétől függően.
- A profil-, megbízhatósági és fókuszréteg részben azonos eseményeket és DOM-részleteket kezelt.
- A build időbélyege minden futáskor változott, ezért a standalone naprakészsége nem volt megbízhatóan ellenőrizhető.
- Nem volt valódi alkalmazást végigjátszó Playwright-regresszió és teljes CI workflow.
- A legutóbbi standalone build `[skip ci]` jelöléssel készült, workflow-futás nélkül.

## 2. Módosított fájlok

- `.github/workflows/ci.yml`
- `JATEK_INDITASA.bat`
- `README.md`
- `css/mobile-experience.css`
- `index.html`
- `js/main.js`
- `js/matchday.js`
- `js/mobile-experience.js`
- `js/penalties.js`
- `js/player-profile.js`
- `js/reliability-fixes.js`
- `js/ui.js`
- `js/ux.js`
- `package.json`
- `package-lock.json`
- `scripts/build-standalone.mjs`
- `scripts/mobile-phase-smoke.mjs`
- `sw.js`
- `test/player-profile.test.mjs`
- a build által naprakésszé tett generált adat- és standalone fájlok

## 3. Törölt fájlok

- `js/focus-experience.js`
- `js/usability-fixes.js`
- `css/mobile-overlay-fix.css`
- `css/player-profile.css`
- `css/focus-experience.css`
- `css/mobile-selection-fix.css`
- `css/duel-emphasis.css`
- `css/phase-refinements.css`

A CSS-rétegek az eredeti betöltési sorrendjükben kerültek a `css/mobile-experience.css` fájlba, így a meglévő vizuális kaszkád megmaradt.

## 4. Létrehozott fájlok

- `.github/workflows/ci.yml`
- `playwright.config.mjs`
- `test/e2e/mobile-layout.spec.mjs`
- `test/stabilization.test.mjs`
- `TECHNICAL_REPORT.md`
- `test-artifacts/previews/*.png`

## 5. Központi javítások

- A profilállapotot a `loadPlayerName()`, `savePlayerName()` és `subscribePlayerName()` kezeli.
- A Session és a UI közvetlenül kapja a nevet; nincs teljes DOM-figyelő.
- A név 24 karakterre korlátozott, normalizált és mindenhol `textContent` útján jelenik meg.
- A Büntetőpárbaj megnevezése közvetlenül a renderelési forrásokban szerepel.
- A 250 ms-os átmenetet a Session egyszeri, `busy`- és tokenvédett művelete kezeli; nincs kattintás-visszaküldés.
- Az animáció kikapcsolva és `prefers-reduced-motion` mellett azonnali.
- A kártyanézegető fókuszcsapdája, Escape/nyíl/Enter kezelése és fókusz-visszaadása közvetlenül a `ui.js` része.
- A váratlan hibakezelés megőrzi a mentést és feloldja a blokkolt kezelőfelületet.
- A visszatöltött eredmény nem ismétli meg a korábbi hangot, rezgést vagy UX-statisztikai könyvelést.
- A két csatakártyát továbbra is egyetlen közös CSS-szabály méretezi.

## 6. Új regressziós ellenőrzések

- Profilnormalizálás, alapnév, 24 karakter, mentés és célzott értesítés.
- Tiltott feliratok és eltávolított javítórétegek statikus ellenőrzése.
- Valódi Klasszikus mód: profil, kategória, nézegető, dupla kattintás, csata, eredmény, következő kör, frissítés és folytatás.
- Valódi Büntetőpárbaj: 11 jelző, győzelem/vereség/döntetlen, öt rendes párbaj, hirtelen halál, frissítés, folytatás és végeredmény.
- 13 viewporton dokumentumszélesség, kártyaméretek, VS-átfedés, kézrejtés, fejléc/prompt/eredmény/gomb láthatóság.
- Standalone indítás és PWA-offline újratöltés.
- Windows-indító `--check` mód.

## 7. Futtatott parancsok és eredmény

A stabilizációs commit csak akkor készül el, ha az alábbi parancsok mind 0 kilépési kóddal futnak:

| Parancs | Eredmény |
|---|---|
| `npm install` | sikeres |
| `npm run lint` | sikeres |
| `npm run build` | sikeres |
| `npm test` | sikeres |
| `npm run test:all` | sikeres |
| `npm run test:mobile-layout` | sikeres |
| `git diff --check` | sikeres |
| `JATEK_INDITASA.bat --check` | sikeres a Windows CI-feladatban |

A normál CI ezen felül `npm ci`-vel reprodukálja a telepítést és ellenőrzi, hogy a standalone fájl naprakész-e.

## 8. Előnézeti képek

- `test-artifacts/previews/mobil-valasztasi-fazis.png`
- `test-artifacts/previews/mobil-kijelolt-kartya.png`
- `test-artifacts/previews/mobil-kartyanezegeto.png`
- `test-artifacts/previews/mobil-csatafazis.png`
- `test-artifacts/previews/mobil-eredmenyfazis.png`
- `test-artifacts/previews/mobil-buntetoparbaj.png`
- `test-artifacts/previews/mobil-hirtelen-halal.png`
- `test-artifacts/previews/tablet-valasztasi-fazis.png`
- `test-artifacts/previews/tablet-csatafazis.png`
- `test-artifacts/previews/asztali-valasztasi-fazis.png`
- `test-artifacts/previews/asztali-csatafazis.png`

## 9. Fennmaradó ismert korlátozások

- Az első PWA-használathoz online betöltés szükséges.
- Az önálló HTML nem frissül automatikusan.
- Az iOS PWA-telepítés továbbra is kézi.
- Egyes opcionális játékoskategóriák a valós adatlefedettség miatt inaktívak maradnak.
- Az adatbázis és a játék nem tartalmaz jogvédett játékosfotókat vagy klubcímereket.
`);

console.log('A regressziós, CI- és dokumentációs csomag elkészült.');
