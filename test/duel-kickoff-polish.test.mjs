import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AI, HUMAN } from '../js/engine.js';
import {
  KICKOFF_COUNTDOWN_STEPS,
  KICKOFF_WHISTLE_ASSET,
  createKickoffSequenceController,
  duelKickoffVisualState,
} from '../js/duel-kickoff-polish.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const createManualScheduler = () => {
  let nextId = 0;
  const queue = [];
  const cancelled = new Set();
  return {
    queue,
    schedule(callback, delay) {
      const id = ++nextId;
      queue.push({ id, callback, delay });
      return id;
    },
    cancel(id) { cancelled.add(id); },
    runNext() {
      const task = queue.shift();
      if (!task) return false;
      if (!cancelled.has(task.id)) task.callback();
      return task;
    },
  };
};

{
  assert.deepEqual(
    KICKOFF_COUNTDOWN_STEPS.map(step => step.label),
    ['3', '2', '1', 'Hajrá!', 'Síp'],
    'A kickoff sorrend nem változhat meg.',
  );
  assert.equal(KICKOFF_WHISTLE_ASSET, 'assets/ui/referee-whistle.svg');
}

{
  const scheduler = createManualScheduler();
  const seen = [];
  let completed = 0;
  const controller = createKickoffSequenceController({
    schedule: (callback, delay) => scheduler.schedule(callback, delay),
    cancelSchedule: id => scheduler.cancel(id),
  });

  const token = controller.start({
    onStep: step => seen.push(step.label),
    onComplete: () => { completed += 1; },
  });
  assert.ok(token, 'A kickoffnak el kell indulnia.');
  assert.deepEqual(seen, ['3'], 'Az első lépés azonnal a 3 legyen.');
  assert.equal(controller.isRunning(), true);
  assert.equal(controller.start({}), false, 'Aktív countdown alatt második kickoff nem indulhat.');

  while (scheduler.runNext()) {}
  assert.deepEqual(seen, ['3', '2', '1', 'Hajrá!', 'Síp']);
  assert.equal(completed, 1, 'A countdown pontosan egyszer fejezheti be a launch kaput.');
  assert.equal(controller.isRunning(), false);
}

{
  const scheduler = createManualScheduler();
  const seen = [];
  let completed = 0;
  const controller = createKickoffSequenceController({
    schedule: (callback, delay) => scheduler.schedule(callback, delay),
    cancelSchedule: id => scheduler.cancel(id),
  });
  controller.start({
    onStep: step => seen.push(step.label),
    onComplete: () => { completed += 1; },
  });
  assert.equal(controller.cancel(), true);
  while (scheduler.runNext()) {}
  assert.deepEqual(seen, ['3'], 'Megszakítás után régi timer nem léphet tovább.');
  assert.equal(completed, 0, 'Megszakított kickoff nem indíthatja el a mérkőzést.');
  assert.equal(controller.isRunning(), false);
}

{
  const humanWin = duelKickoffVisualState(HUMAN);
  assert.deepEqual(humanWin, { human: 'winner', ai: 'loser' });
  const aiWin = duelKickoffVisualState(AI);
  assert.deepEqual(aiWin, { human: 'loser', ai: 'winner' });
  const tie = duelKickoffVisualState('tie');
  assert.deepEqual(tie, { human: 'neutral', ai: 'neutral' });
}

{
  const source = fs.readFileSync(path.join(ROOT, 'js/duel-kickoff-polish.js'), 'utf8');
  assert.match(source, /\.duel-slot\.duel-visual-loser \.card/);
  assert.match(source, /opacity:\s*\.86/);
  assert.match(source, /brightness\(\.72\)/);
  assert.match(source, /display:\s*flex\s*!important/);
  assert.match(source, /visibility:\s*visible\s*!important/);
  assert.match(source, /prefers-reduced-motion:\s*reduce/);
}

{
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  const beginMatch = main.slice(main.indexOf('  _beginMatch() {'), main.indexOf('\n  beginRound() {'));
  assert.match(beginMatch, /kickoff\.start\(this\.ui, game/);
  assert.match(beginMatch, /onComplete:\s*\(\) => beginAfterKickoff\(\)/);
  assert.match(beginMatch, /this\.busy = true/);
  assert.match(beginMatch, /this\.ui\.setInteractionBusy\(true\)/);
  assert.ok(
    beginMatch.indexOf('kickoff.start(this.ui, game') < beginMatch.indexOf('onComplete: () => beginAfterKickoff()'),
    'A valódi első kör csak a kickoff completion callbackből indulhat.',
  );
}

{
  const whistle = fs.readFileSync(path.join(ROOT, KICKOFF_WHISTLE_ASSET), 'utf8');
  assert.match(whistle, /<svg\b/);
  assert.match(whistle, /<title[^>]*>Játékvezetői síp<\/title>/);
  assert.doesNotMatch(whistle, /<(?:image|use)\b[^>]*(?:href|xlink:href)=["']https?:/i);

  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/assets/licenses/assets-licenses.json'), 'utf8'));
  const entry = registry.find(asset => asset.filePath === KICKOFF_WHISTLE_ASSET);
  assert.ok(entry, 'A síp assetnek szerepelnie kell a licencnyilvántartásban.');
  assert.equal(entry.sourceType, 'original');
  assert.equal(entry.approvedForRelease, true);
  assert.equal(entry.commercialUseAllowed, true);
}

console.log('✓ Duel Visual Polish + Kickoff Countdown: vesztes kártya, 3–2–1–Hajrá!–síp, launch gate és asset szerződés rendben.');
