export const REWARDED_AD_STATUS = Object.freeze({
  granted: 'granted',
  dismissed: 'dismissed',
  unavailable: 'unavailable',
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
