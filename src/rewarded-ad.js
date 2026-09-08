export const REWARDED_AD_STATUS = Object.freeze({
  granted: 'granted',
  dismissed: 'dismissed',
  unavailable: 'unavailable',
});

const unavailable = (provider, error = null) => ({
  status: REWARDED_AD_STATUS.unavailable,
  provider,
  error,
});

export class SimulatedRewardedAdAdapter {
  constructor({ durationMs = 3600, tickMs = 80 } = {}) {
    this.durationMs = Math.max(1, Number(durationMs) || 3600);
    this.tickMs = Math.max(1, Number(tickMs) || 80);
    this.active = null;
  }

  isReady() { return !this.active; }

  show({ onProgress } = {}) {
    if (!this.isReady()) return Promise.resolve({ status: REWARDED_AD_STATUS.unavailable, provider: 'simulated' });
    return new Promise(resolve => {
      const startedAt = Date.now();
      const finish = status => {
        if (!this.active) return;
        clearInterval(this.active.timer);
        this.active = null;
        onProgress?.(status === REWARDED_AD_STATUS.granted ? 1 : 0);
        resolve({ status, provider: 'simulated' });
      };
      const update = () => {
        const progress = Math.min(1, (Date.now() - startedAt) / this.durationMs);
        onProgress?.(progress);
        if (progress >= 1) finish(REWARDED_AD_STATUS.granted);
      };
      this.active = { finish, timer: setInterval(update, this.tickMs) };
      update();
    });
  }

  cancel() {
    this.active?.finish(REWARDED_AD_STATUS.dismissed);
  }
}

export class CrazyGamesRewardedAdAdapter {
  constructor({ runtime } = {}) {
    this.runtime = runtime;
    this.active = null;
    this.provider = 'crazygames';
  }

  isReady() {
    return !this.active
      && this.runtime?.available === true
      && typeof this.runtime?.sdk?.ad?.requestAd === 'function';
  }

  async show({ onStarted, onFinished, onError } = {}) {
    if (!this.isReady()) return unavailable(this.provider, { code: 'sdkUnavailable' });

    return new Promise(resolve => {
      let started = false;
      const finish = (status, error = null) => {
        if (!this.active) return;
        this.active = null;
        try {
          if (status === REWARDED_AD_STATUS.granted) onFinished?.();
          else onError?.(error);
        } catch {}
        resolve(status === REWARDED_AD_STATUS.granted
          ? { status, provider: this.provider }
          : unavailable(this.provider, error));
      };

      this.active = { started: false };
      const callbacks = {
        adStarted: () => {
          if (!this.active || started) return;
          started = true;
          this.active.started = true;
          try { onStarted?.(); } catch {}
        },
        adFinished: () => finish(REWARDED_AD_STATUS.granted),
        adError: error => finish(REWARDED_AD_STATUS.unavailable, error || { code: 'unknownAdError' }),
      };

      try {
        // CrazyGames grants rewarded inventory only through adFinished. A
        // returned Promise (if any) is deliberately not treated as proof.
        const request = this.runtime.sdk.ad.requestAd('rewarded', callbacks);
        request?.catch?.(error => finish(REWARDED_AD_STATUS.unavailable, error));
      } catch (error) {
        finish(REWARDED_AD_STATUS.unavailable, error);
      }
    });
  }

  // The provider owns its fullscreen surface and cannot be cancelled by the
  // game. Ignoring cancel prevents a local close action from minting a reward.
  cancel() { return false; }
}

export const createRewardedAdAdapter = ({ platform, runtime, localPreview = false } = {}) => {
  if (platform?.id === 'crazygames' && platform.capabilities?.rewardedAds === true) {
    return new CrazyGamesRewardedAdAdapter({ runtime });
  }
  if (localPreview) return new SimulatedRewardedAdAdapter();
  return Object.freeze({
    provider: 'disabled',
    isReady: () => false,
    show: async () => unavailable('disabled', { code: 'featureDisabled' }),
    cancel: () => false,
  });
};
