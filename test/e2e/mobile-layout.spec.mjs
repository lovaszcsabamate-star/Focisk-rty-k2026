import { test, expect } from '@playwright/test';
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
      if (!sessionStorage.getItem('fociskartyak:e2e-initialized')) {
        localStorage.clear();
        localStorage.setItem('fociskartyak:onboarding-complete', 'true');
        sessionStorage.setItem('fociskartyak:e2e-initialized', 'true');
      }
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
  await expect(page.locator('#hud-scores')).toContainText(/csabi/i);
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
  await expect(page.locator('.next-round-button')).toBeVisible();
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
  await expect(page.locator('#hud-scores')).toContainText(/nagyon hosszú csabinév/i);
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
  await expect(page.locator('#penalty-board .attempt-row').first()).toContainText(/csabi/i);
  await expect(page.locator('#penalty-board .attempt-row').first().locator('.attempt')).toHaveCount(11);
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
