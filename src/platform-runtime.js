import { PLATFORM } from './platform.js?v=20260907-crazygames-data-pass2';

const ACTIVE_ENVIRONMENTS = new Set(['local', 'crazygames']);

export class PlatformRuntime {
  constructor({
    platform = PLATFORM,
    windowRef = typeof window === 'undefined' ? null : window,
    sdkWaitMs = 10000,
    sdkPollMs = 50,
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
  } = {}) {
    this.platform = platform;
    this.windowRef = windowRef;
    this.sdk = null;
    this.available = false;
    this.environment = platform.id === 'crazygames' ? 'unavailable' : 'native';
    this.gameplayActive = false;
    this.muteAudio = false;
    this.progressStorageMode = 'device';
    this.onMuteChange = null;
    this.settingsListener = settings => this.applySettings(settings);
    this.initialization = null;
    this.sdkWaitMs = sdkWaitMs;
    this.sdkPollMs = sdkPollMs;
    this.sleep = sleep;
  }

  initialize({ onMuteChange } = {}) {
    if (onMuteChange) this.onMuteChange = onMuteChange;
    if (this.initialization) return this.initialization;
    this.initialization = this.initializeSdk().then(snapshot => {
      // A late portal script or transient SDK failure must not permanently
      // poison the runtime. gameplayStart() gets one fresh attempt when needed.
      if (!snapshot.available && snapshot.environment !== 'disabled') this.initialization = null;
      return snapshot;
    });
    return this.initialization;
  }

  async initializeSdk() {
    if (!this.platform.capabilities.portalSdk) return this.snapshot();
    const sdk = await this.waitForSdk();
    if (!sdk?.init) return this.snapshot();
    try {
      await sdk.init();
      this.environment = String(sdk.environment || 'disabled');
      if (!ACTIVE_ENVIRONMENTS.has(this.environment)) return this.snapshot();
      this.sdk = sdk;
      this.available = true;
      this.applySettings(sdk.game?.settings);
      sdk.game?.addSettingsChangeListener?.(this.settingsListener);
    } catch {
      this.environment = 'unavailable';
      this.sdk = null;
      this.available = false;
    }
    return this.snapshot();
  }

  async waitForSdk() {
    const deadline = Date.now() + this.sdkWaitMs;
    do {
      const sdk = this.windowRef?.CrazyGames?.SDK;
      if (sdk?.init) return sdk;
      if (Date.now() >= deadline) return null;
      await this.sleep(this.sdkPollMs);
    } while (true);
  }

  applySettings(settings = {}) {
    const nextMute = settings?.muteAudio === true;
    if (nextMute === this.muteAudio) return;
    this.muteAudio = nextMute;
    this.onMuteChange?.(nextMute);
  }

  async gameplayStart() {
    await this.initialize();
    if (!this.available || this.gameplayActive) return false;
    try {
      this.sdk.game.gameplayStart();
      this.gameplayActive = true;
      return true;
    } catch {
      return false;
    }
  }

  async gameplayStop() {
    await this.initialize();
    if (!this.available || !this.gameplayActive) return false;
    try {
      this.sdk.game.gameplayStop();
      this.gameplayActive = false;
      return true;
    } catch {
      return false;
    }
  }

  progressStorage(fallbackStorage, migrateKeys = []) {
    if (!this.platform.capabilities.progressSave || !this.available || !this.sdk?.data) {
      this.progressStorageMode = 'device';
      return fallbackStorage;
    }
    try {
      for (const key of migrateKeys) {
        if (this.sdk.data.getItem(key) !== null) continue;
        const localValue = fallbackStorage?.getItem(key);
        if (localValue !== null && localValue !== undefined) this.sdk.data.setItem(key, localValue);
      }
      this.progressStorageMode = 'crazygames';
      return this.sdk.data;
    } catch {
      this.progressStorageMode = 'device';
      return fallbackStorage;
    }
  }

  snapshot() {
    return Object.freeze({
      platform: this.platform.id,
      available: this.available,
      environment: this.environment,
      gameplayActive: this.gameplayActive,
      muteAudio: this.muteAudio,
      progressStorageMode: this.progressStorageMode,
    });
  }
}
