import fs from 'node:fs';

const path = 'test/static.test.mjs';
let source = fs.readFileSync(path, 'utf8');

const replaceOnce = (search, replacement, label) => {
  if (!source.includes(search)) throw new Error(`Nem található statikus tesztpont: ${label}`);
  source = source.replace(search, replacement);
};

replaceOnce(
  "const main = read('../js/main.js');\n",
  "const main = read('../js/main.js');\nconst menuController = read('../js/app/menu-controller.js');\n",
  'menüvezérlő forrás beolvasása',
);
replaceOnce(
  'assert.match(main, /Klasszikus mód/);',
  'assert.match(menuController, /Klasszikus mód/);',
  'Klasszikus mód szerződés',
);
replaceOnce(
  'assert.match(main, /Penalties mód/);',
  'assert.match(menuController, /Penalties mód/);',
  'Penalties mód szerződés',
);
replaceOnce(
  'assert.match(main, /Játék folytatása/);',
  'assert.match(menuController, /Játék folytatása/);',
  'folytatás szerződés',
);
replaceOnce(
  'assert.match(main, /handleBackAction/);',
  "assert.match(main, /createMenuController/);\nassert.match(main, /handleBackAction/);\nassert.match(serviceWorker, /js\\/app\\/menu-controller\\.js/);",
  'Session és PWA menüvezérlő integráció',
);

fs.writeFileSync(path, source);
console.log('✓ A statikus regresszió az új menüvezérlő modulhatárhoz igazítva.');
