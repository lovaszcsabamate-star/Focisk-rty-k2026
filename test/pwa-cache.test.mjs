import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';

const swSource = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const extractArray = name => {
  const marker = `const ${name} = Object.freeze([`;
  const start = swSource.indexOf(marker);
  const end = swSource.indexOf(']);', start);
  return [...swSource.slice(start + marker.length, end).matchAll(/'([^']+)'/g)].map(match => match[1]);
};
const CORE = extractArray('CORE_SHELL');
const OPTIONAL = extractArray('OPTIONAL_ASSETS');
assert.ok(CORE.length > 0);
assert.ok(OPTIONAL.length > 0);

class FakeCache {
  constructor(environment, name) {
    this.environment = environment;
    this.name = name;
    this.entries = new Map();
  }

  key(request) {
    return new URL(typeof request === 'string' ? request : request.url, this.environment.origin).href;
  }

  async addAll(resources) {
    if (resources.some(resource => this.environment.failCore.has(resource))) throw new Error('core fetch failed');
    resources.forEach(resource => this.entries.set(this.key(resource), new Response(`cached:${resource}`)));
  }

  async add(resource) {
    if (this.environment.failOptional.has(resource)) throw new Error('optional fetch failed');
    this.entries.set(this.key(resource), new Response(`cached:${resource}`));
  }

  async put(request, response) {
    this.entries.set(this.key(request), response.clone());
  }

  async match(request) {
    return this.entries.get(this.key(request))?.clone() ?? undefined;
  }

  async delete(request) {
    return this.entries.delete(this.key(request));
  }
}

function createEnvironment({ failCore = [], failOptional = [], scriptSource = swSource } = {}) {
  const origin = 'https://example.test';
  const listeners = {};
  const cachesByName = new Map();
  const env = {
    origin,
    failCore: new Set(failCore),
    failOptional: new Set(failOptional),
    scriptSource,
    offline: false,
    skipWaitingCalls: 0,
    claimCalls: 0,
  };

  const cacheStorage = {
    async open(name) {
      if (!cachesByName.has(name)) cachesByName.set(name, new FakeCache(env, name));
      return cachesByName.get(name);
    },
    async keys() {
      return [...cachesByName.keys()];
    },
    async delete(name) {
      return cachesByName.delete(name);
    },
  };

  const self = {
    location: { href: `${origin}/sw.js`, origin },
    clients: { claim: async () => { env.claimCalls += 1; } },
    skipWaiting: async () => { env.skipWaitingCalls += 1; },
    addEventListener: (type, handler) => { listeners[type] = handler; },
  };

  const fetchFn = async request => {
    const url = typeof request === 'string' ? request : request.url;
    if (url === self.location.href) return new Response(env.scriptSource, { status: 200 });
    if (env.offline) throw new Error('offline');
    return new Response(`network:${url}`, { status: 200 });
  };

  vm.runInNewContext(swSource, {
    self,
    caches: cacheStorage,
    fetch: fetchFn,
    Request,
    Response,
    URL,
    TextEncoder,
    Uint8Array,
    crypto: webcrypto,
    console,
    Promise,
    Error,
    JSON,
    String,
    Object,
  }, { filename: 'sw.js' });

  const eventPromise = handler => {
    let promise;
    handler({ waitUntil: value => { promise = Promise.resolve(value); } });
    return promise;
  };

  const triggerFetch = request => {
    let responsePromise;
    let waitPromise = Promise.resolve();
    listeners.fetch({
      request,
      respondWith: value => { responsePromise = Promise.resolve(value); },
      waitUntil: value => { waitPromise = Promise.resolve(value); },
    });
    return { response: responsePromise, background: waitPromise };
  };

  return {
    env,
    listeners,
    cachesByName,
    cacheStorage,
    install: () => eventPromise(listeners.install),
    activate: () => eventPromise(listeners.activate),
    triggerFetch,
  };
}

const legacyName = 'fociskartyak-2026-v84';

const successful = createEnvironment();
await successful.cacheStorage.open(legacyName);
await successful.install();
assert.equal(successful.env.skipWaitingCalls, 1);
let names = await successful.cacheStorage.keys();
const candidate = names.find(name => name.startsWith('fociskartyak-2026-build-'));
assert.ok(candidate, 'sikeres install után létre kell jönnie a build-cache-nek');
assert.ok(names.includes(legacyName), 'aktiválás előtt a régi működő cache megmarad');
await successful.activate();
names = await successful.cacheStorage.keys();
assert.ok(names.includes(candidate));
assert.equal(names.includes(legacyName), false, 'sikeres aktiválás után a régi cache törlődik');
assert.equal(successful.env.claimCalls, 1);

successful.env.offline = true;
const navigation = successful.triggerFetch({ method: 'GET', mode: 'navigate', url: `${successful.env.origin}/deep/link` });
assert.equal(await (await navigation.response).text(), 'cached:./index.html');

const optionalFailure = createEnvironment({ failOptional: [OPTIONAL[0]] });
await optionalFailure.install();
assert.equal(optionalFailure.env.skipWaitingCalls, 1, 'opcionális asset hibája nem blokkolhatja az installt');

const coreFailure = createEnvironment({ failCore: [CORE[0]] });
await coreFailure.cacheStorage.open(legacyName);
await assert.rejects(coreFailure.install(), /core fetch failed/);
assert.equal(coreFailure.env.skipWaitingCalls, 0, 'hibás CORE után tilos a skipWaiting');
const failedNames = await coreFailure.cacheStorage.keys();
assert.ok(failedNames.includes(legacyName), 'CORE hiba után a régi cache megmarad');
assert.equal(failedNames.some(name => name.startsWith('fociskartyak-2026-build-')), false, 'félkész build-cache nem maradhat hátra');

const deterministicA = createEnvironment();
await deterministicA.install();
const nameA = (await deterministicA.cacheStorage.keys()).find(name => name.startsWith('fociskartyak-2026-build-'));
const deterministicB = createEnvironment();
await deterministicB.install();
const nameB = (await deterministicB.cacheStorage.keys()).find(name => name.startsWith('fociskartyak-2026-build-'));
assert.equal(nameA, nameB, 'azonos buildhez azonos cache-hash tartozik');

const changed = createEnvironment({ scriptSource: `${swSource}\n// changed build` });
await changed.install();
const changedName = (await changed.cacheStorage.keys()).find(name => name.startsWith('fociskartyak-2026-build-'));
assert.notEqual(changedName, nameA, 'megváltozott service workerhez új cache-hash szükséges');

console.log('✓ PWA cache: atomikus CORE install, opcionális hibatűrés, determinisztikus hash, régi cache védelem és offline navigáció rendben');
