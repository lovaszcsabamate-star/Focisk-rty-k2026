import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The source collector is patched at runtime so legacy club aliases resolve to canonical database IDs.
const sourceFile = path.resolve('scripts/enrich-player-heights.mjs');
const runtimeFile = path.resolve('scripts/.enrich-player-heights.runtime.mjs');
let source = await fs.readFile(sourceFile, 'utf8');

const clubIdReplacements = new Map([
  ["clubId: 'eto'", "clubId: 'eto-fc'"],
  ["clubId: 'ferencvaros'", "clubId: 'ferencvarosi-tc'"],
  ["clubId: 'kazincbarcika'", "clubId: 'kolorcity-kazincbarcika-sc'"],
  ["clubId: 'kisvarda'", "clubId: 'kisvarda-master-good'"],
  ["clubId: 'mtk'", "clubId: 'mtk-budapest'"],
  ["clubId: 'nyiregyhaza'", "clubId: 'nyiregyhaza-spartacus-fc'"],
  ["clubId: 'paks'", "clubId: 'paksi-fc'"],
  ["clubId: 'puskas-akademia'", "clubId: 'puskas-akademia-fc'"],
  ["clubId: 'ujpest'", "clubId: 'ujpest-fc'"],
  ["clubId: 'zte'", "clubId: 'zte-fc'"],
]);

for (const [from, to] of clubIdReplacements) {
  if (!source.includes(from)) throw new Error(`Nem található cserélendő klubazonosító: ${from}`);
  source = source.replace(from, to);
}

source = source.replace(
  'const rowPattern = /<tr\\b[^>]*class="[^\"]*\\b(?:odd|even)\\b[^\"]*"[^>]*>([\\s\\S]*?)<\\/tr>/gi;',
  'const rowPattern = /<tr\\b[^>]*>([\\s\\S]*?)<\\/tr>/gi;',
);

await fs.writeFile(runtimeFile, source);
try {
  await import(`${pathToFileURL(runtimeFile).href}?v=${Date.now()}`);
} finally {
  await fs.rm(runtimeFile, { force: true });
}
