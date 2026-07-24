import assert from 'node:assert/strict';

import {
  UI,
  beginUiEnhancementLayer,
  commitUiEnhancementLayer,
  getUiEnhancementLayers,
  rollbackUiEnhancementLayer,
} from '../js/ui.js';

const BaseUI = UI;
const baseRenderCard = BaseUI.prototype.renderCard;

const FirstLayer = beginUiEnhancementLayer('test/first-layer');
assert.equal(UI, FirstLayer);
assert.notEqual(UI, BaseUI);
assert.equal(Object.getPrototypeOf(FirstLayer.prototype), BaseUI.prototype);
assert.equal(FirstLayer.prototype.renderCard, baseRenderCard, 'az alapmetódus öröklődik, nem másolódik');

UI.prototype.testFirstLayer = function testFirstLayer() { return 'first'; };
const firstRecord = commitUiEnhancementLayer('test/first-layer');
assert.deepEqual(firstRecord.methods, ['testFirstLayer']);
assert.equal(Object.create(UI.prototype).testFirstLayer(), 'first');

const CommittedUI = UI;
const SecondLayer = beginUiEnhancementLayer('test/second-layer');
assert.equal(Object.getPrototypeOf(SecondLayer.prototype), CommittedUI.prototype);
UI.prototype.testSecondLayer = function testSecondLayer() { return `${this.testFirstLayer()}-second`; };
const secondRecord = commitUiEnhancementLayer('test/second-layer');
assert.deepEqual(secondRecord.methods, ['testSecondLayer']);
assert.equal(Object.create(UI.prototype).testSecondLayer(), 'first-second');
assert.equal(Object.prototype.hasOwnProperty.call(UI.prototype, 'testFirstLayer'), false);
assert.equal(Object.prototype.hasOwnProperty.call(UI.prototype, 'testSecondLayer'), true);

const BeforeRollback = UI;
beginUiEnhancementLayer('test/rollback-layer');
UI.prototype.temporaryMethod = () => 'temporary';
assert.equal(rollbackUiEnhancementLayer('test/rollback-layer'), true);
assert.equal(UI, BeforeRollback);
assert.equal(UI.prototype.temporaryMethod, undefined);
assert.equal(rollbackUiEnhancementLayer('test/rollback-layer'), false);

const layers = getUiEnhancementLayers();
assert.equal(Object.isFrozen(layers), true);
assert.equal(layers.length, 2);
assert.deepEqual(layers.map(layer => layer.name), ['test/first-layer', 'test/second-layer']);
assert.equal(Object.isFrozen(layers[0]), true);
assert.equal(Object.isFrozen(layers[0].methods), true);

assert.throws(() => beginUiEnhancementLayer(''), /UI-réteg neve kötelező/);
beginUiEnhancementLayer('test/pending');
assert.throws(() => beginUiEnhancementLayer('test/nested'), /még nincs lezárva/);
assert.throws(() => commitUiEnhancementLayer('test/wrong'), /Nincs lezárható UI-réteg/);
assert.equal(rollbackUiEnhancementLayer('test/pending'), true);

console.log('✓ Az UI enhancement modulok külön, öröklődő osztályrétegeken működnek');
