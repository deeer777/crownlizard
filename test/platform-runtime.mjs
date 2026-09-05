import assert from 'node:assert/strict';
import { PlatformRuntime } from '../src/platform-runtime.js';

const platform = (id, portalSdk) => ({
  id,
  capabilities: { portalSdk },
});

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

console.log('CrazyGames SDK lifecycle, environment and portal mute tests passed');
