import fs from 'node:fs';
import path from 'node:path';

const TEST_DIR = 'test';
let changed = 0;

for (const name of fs.readdirSync(TEST_DIR)) {
  if (!name.endsWith('.mjs')) continue;
  const file = path.join(TEST_DIR, name);
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(/fociskartyak-2026-v\d+/g, 'fociskartyak-2026-v30');
  if (after === before) continue;
  fs.writeFileSync(file, after);
  changed += 1;
}

fs.rmSync(new URL(import.meta.url), { force: true });
console.log(`${changed} tesztfájl PWA-cache elvárása v30-ra egységesítve.`);
