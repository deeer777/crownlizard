import { PLATFORM } from './platform.js?v=20260905-platform-isolation';

const ACTIVE_ENVIRONMENTS = new Set(['local', 'crazygames']);

export class PlatformRuntime {
  constructor({ platform = PLATFORM, windowRef = typeof window === 'undefined' ? null : window } = {}) {
    this.platform = platform;
    this.windowRef = windowRef;
    this.sdk = null;
    this.available = false;
    this.environment = platform.id === 'crazygames' ? 'unavailable' : 'native';
    this.gameplayActive = false;
    this.muteAudio = false;
    this.onMuteChange = null;
    this.settingsListener = settings => this.applySettings(settings);
    this.initialization = null;
  }

  initialize({ onMuteChange } = {}) {
    if (onMuteChange) this.onMuteChange = onMuteChange;
    if (this.initialization) return this.initialization;
    this.initialization = this.initializeSdk();
    return this.initialization;
  }

  async initializeSdk() {
    if (!this.platform.capabilities.portalSdk) return this.snapshot();
    const sdk = this.windowRef?.CrazyGames?.SDK;
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

  snapshot() {
    return Object.freeze({
      platform: this.platform.id,
      available: this.available,
      environment: this.environment,
      gameplayActive: this.gameplayActive,
      muteAudio: this.muteAudio,
    });
  }
}
