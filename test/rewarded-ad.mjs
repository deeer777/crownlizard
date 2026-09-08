import assert from 'node:assert/strict';
import {
  CrazyGamesRewardedAdAdapter,
  REWARDED_AD_STATUS,
  SimulatedRewardedAdAdapter,
  createRewardedAdAdapter,
} from '../src/rewarded-ad.js';

const platform = rewardedAds => ({ id: 'crazygames', capabilities: { rewardedAds } });
let callbacks = null;
let requestType = '';
const runtime = {
  available: true,
  sdk: {
    ad: {
      requestAd: (type, nextCallbacks) => {
        requestType = type;
        callbacks = nextCallbacks;
      },
    },
  },
};

const disabled = createRewardedAdAdapter({ platform: platform(false), runtime });
assert.equal(disabled.provider, 'disabled', 'the submitted Basic build keeps its ad provider disabled');
assert.equal(disabled.isReady(), false);

const local = createRewardedAdAdapter({ platform: platform(false), runtime, localPreview: true });
assert.ok(local instanceof SimulatedRewardedAdAdapter, 'localhost retains the existing UX simulator');

const adapter = createRewardedAdAdapter({ platform: platform(true), runtime });
assert.ok(adapter instanceof CrazyGamesRewardedAdAdapter);
assert.equal(adapter.isReady(), true);

let starts = 0;
let finishes = 0;
let errors = 0;
const completed = adapter.show({
  onStarted: () => { starts += 1; },
  onFinished: () => { finishes += 1; },
  onError: () => { errors += 1; },
});
assert.equal(requestType, 'rewarded');
assert.equal(adapter.isReady(), false, 'a second request is blocked while the provider owns the first');
callbacks.adStarted();
callbacks.adStarted();
callbacks.adFinished();
callbacks.adError({ code: 'lateError' });
assert.deepEqual(await completed, { status: REWARDED_AD_STATUS.granted, provider: 'crazygames' });
assert.deepEqual({ starts, finishes, errors }, { starts: 1, finishes: 1, errors: 0 }, 'only the first terminal callback can settle the reward');

const failed = adapter.show({ onError: () => { errors += 1; } });
const unavailableError = { code: 'unfilled', message: 'No ad available' };
callbacks.adError(unavailableError);
assert.deepEqual(await failed, { status: REWARDED_AD_STATUS.unavailable, provider: 'crazygames', error: unavailableError });
assert.equal(errors, 1, 'an unfilled ad grants nothing and reports one recoverable error');

const cancelled = adapter.show();
assert.equal(adapter.cancel(), false, 'the game cannot fake-cancel the provider fullscreen');
callbacks.adFinished();
assert.equal((await cancelled).status, REWARDED_AD_STATUS.granted, 'only the provider completion callback grants after a cancel attempt');

const unavailableAdapter = new CrazyGamesRewardedAdAdapter({ runtime: { available: false } });
assert.equal((await unavailableAdapter.show()).status, REWARDED_AD_STATUS.unavailable);

console.log('CrazyGames rewarded-ad adapter tests passed');
