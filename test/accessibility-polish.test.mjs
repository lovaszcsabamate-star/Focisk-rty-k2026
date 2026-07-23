import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(html, /<meta name="color-scheme" content="dark">/);
assert.match(html, /<a class="skip-link" href="#felt">Ugrás a játéktérhez<\/a>/);
assert.match(html, /<section id="felt" tabindex="-1" aria-label="Aktuális kártyapárbaj">/);
assert.match(html, /id="hud-scores" role="status" aria-live="polite" aria-atomic="true"/);
assert.match(html, /id="prompt" role="status" aria-live="polite" aria-atomic="true"/);
assert.match(html, /id="verdict" role="status" aria-live="polite" aria-atomic="true"/);
assert.match(html, /id="overlay-body" role="dialog" aria-modal="true"/);
assert.match(html, /<noscript>[\s\S]*role="alert"[\s\S]*JavaScriptet/);
assert.match(html, /\.skip-link\{[^}]*transform:translateY\(-160%\)/);
assert.match(html, /:focus-visible\{outline:3px solid #fff3bd/);
assert.doesNotMatch(html, /css\/accessibility-polish\.css/);

console.log('✓ Egyszerű akadálymentességi felületi javítások: rendben');
