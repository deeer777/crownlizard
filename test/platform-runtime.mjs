import assert from 'node:assert/strict';
import { PlatformRuntime } from '../src/platform-runtime.js';

const platform = (id, portalSdk, progressSave = false) => ({
  id,
  capabilities: { portalSdk, progressSave },
});

class MemoryStorage {
  constructor(entries = []) { this.values = new Map(entries); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

let initCalls = 0;
let startCalls = 0;
let stopCalls = 0;
let settingsListener = null;
const sdk = {
  environment: 'local',
  init: async () => { initCalls += 1; },
  game: {
    settings: { muteAudio: true },
    addSettingsChangeListener: listener => { settingsListener = listener; },
    gameplayStart: () => { startCalls += 1; },
    gameplayStop: () => { stopCalls += 1; },
  },
};

const muteStates = [];
const runtime = new PlatformRuntime({
  platform: platform('crazygames', true),
  windowRef: { CrazyGames: { SDK: sdk } },
});
const initialized = await runtime.initialize({ onMuteChange: muted => muteStates.push(muted) });
assert.equal(initialized.available, true);
assert.equal(initialized.environment, 'local');
assert.equal(initCalls, 1);
assert.deepEqual(muteStates, [true]);

assert.equal(await runtime.gameplayStart(), true);
assert.equal(await runtime.gameplayStart(), false);
assert.equal(startCalls, 1, 'duplicate gameplayStart signals must be suppressed');
assert.equal(await runtime.gameplayStop(), true);
assert.equal(await runtime.gameplayStop(), false);
assert.equal(stopCalls, 1, 'duplicate gameplayStop signals must be suppressed');

settingsListener({ muteAudio: false });
assert.deepEqual(muteStates, [true, false]);
assert.equal(runtime.muteAudio, false);

const disabledSdk = {
  environment: 'disabled',
  init: async () => {},
  game: { gameplayStart: () => { throw new Error('must not be called'); } },
};
const disabled = new PlatformRuntime({
  platform: platform('crazygames', true),
  windowRef: { CrazyGames: { SDK: disabledSdk } },
});
assert.equal((await disabled.initialize()).available, false);
assert.equal(await disabled.gameplayStart(), false);

const crown = new PlatformRuntime({ platform: platform('crownlizard', false), windowRef: null });
assert.equal((await crown.initialize()).environment, 'native');
assert.equal(await crown.gameplayStart(), false);

let delayedSdk = null;
let delayedWaits = 0;
const delayedWindow = {};
const delayedRuntime = new PlatformRuntime({
  platform: platform('crazygames', true),
  windowRef: delayedWindow,
  sdkWaitMs: 100,
  sdkPollMs: 1,
  sleep: async () => {
    delayedWaits += 1;
    delayedSdk ||= {
      environment: 'crazygames',
      init: async () => {},
      game: { gameplayStart: () => { startCalls += 1; }, gameplayStop: () => {} },
    };
    delayedWindow.CrazyGames = { SDK: delayedSdk };
  },
});
assert.equal((await delayedRuntime.initialize()).available, true, 'late portal SDK becomes available without reloading the game');
assert.equal(delayedWaits, 1);

const retryWindow = {};
const retryRuntime = new PlatformRuntime({
  platform: platform('crazygames', true),
  windowRef: retryWindow,
  sdkWaitMs: 0,
  sleep: async () => {},
});
assert.equal((await retryRuntime.initialize()).available, false);
retryWindow.CrazyGames = { SDK: delayedSdk };
assert.equal((await retryRuntime.gameplayStart()), true, 'gameplay start retries SDK discovery after an early miss');

const cloudStorage = new MemoryStorage();
const localStorage = new MemoryStorage([['cl:economy:v1', '{"balance":55}']]);
const dataSdk = {
  environment: 'crazygames',
  init: async () => {},
  game: {},
  data: cloudStorage,
};
const dataRuntime = new PlatformRuntime({
  platform: platform('crazygames', true, true),
  windowRef: { CrazyGames: { SDK: dataSdk } },
});
await dataRuntime.initialize();
const selectedStorage = dataRuntime.progressStorage(localStorage, ['cl:economy:v1']);
assert.equal(selectedStorage, cloudStorage, 'CrazyGames Data becomes the authoritative progress store');
assert.equal(cloudStorage.getItem('cl:economy:v1'), '{"balance":55}', 'existing guest progress migrates once when cloud data is empty');
assert.equal(dataRuntime.snapshot().progressStorageMode, 'crazygames');
localStorage.setItem('cl:economy:v1', '{"balance":999}');
dataRuntime.progressStorage(localStorage, ['cl:economy:v1']);
assert.equal(cloudStorage.getItem('cl:economy:v1'), '{"balance":55}', 'existing cloud progress is never overwritten by stale device data');

const failingDataRuntime = new PlatformRuntime({
  platform: platform('crazygames', true, true),
  windowRef: { CrazyGames: { SDK: { environment: 'crazygames', init: async () => {}, game: {}, data: { getItem: () => { throw new Error('dataModuleDisabled'); } } } } },
});
await failingDataRuntime.initialize();
assert.equal(failingDataRuntime.progressStorage(localStorage, ['cl:economy:v1']), localStorage, 'a disabled data module keeps the local wallet usable');
assert.equal(failingDataRuntime.snapshot().progressStorageMode, 'device');

console.log('CrazyGames SDK lifecycle, environment and portal mute tests passed');
