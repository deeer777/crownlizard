export const installContext = ({ userAgent = '', standalone = false, hasPrompt = false, preview = false } = {}) => ({
  installed: Boolean(standalone),
  nativePrompt: Boolean(hasPrompt && !standalone),
  instructions: Boolean(!standalone && (preview || /iPad|iPhone|iPod/.test(userAgent))),
});

export class PwaManager {
  constructor({ preview = false, onInstallChange = () => {}, onUpdateReady = () => {} } = {}) {
    this.preview = preview;
    this.onInstallChange = onInstallChange;
    this.onUpdateReady = onUpdateReady;
    this.deferredPrompt = null;
    this.registration = null;
    this.waitingWorker = null;
    this.applyingUpdate = false;
    this.installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    this.ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      this.deferredPrompt = event;
      this.notifyInstall();
    });
    addEventListener('appinstalled', () => {
      this.installed = true;
      this.deferredPrompt = null;
      this.notifyInstall();
    });
  }

  get installAvailable() {
    return !this.installed && Boolean(this.deferredPrompt || this.ios || this.preview);
  }

  notifyInstall() {
    this.onInstallChange({ available: this.installAvailable, installed: this.installed });
  }

  async install() {
    if (this.deferredPrompt) {
      const prompt = this.deferredPrompt;
      this.deferredPrompt = null;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      this.notifyInstall();
      return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
    }
    if (this.ios || this.preview) return 'instructions';
    return 'unavailable';
  }

  markUpdate(worker) {
    if (!worker || !navigator.serviceWorker.controller) return;
    this.waitingWorker = worker;
    this.onUpdateReady();
  }

  observeRegistration(registration) {
    if (registration.waiting) this.markUpdate(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') this.markUpdate(worker);
      });
    });
  }

  async register() {
    this.notifyInstall();
    if (!('serviceWorker' in navigator)) return null;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (this.applyingUpdate) location.reload();
    });
    try {
      this.registration = await navigator.serviceWorker.register('/sw.js?v=75-mvp', { scope: '/', updateViaCache: 'none' });
      this.observeRegistration(this.registration);
      return this.registration;
    } catch {
      return null;
    }
  }

  async applyUpdate() {
    this.applyingUpdate = true;
    if (!this.waitingWorker && this.registration) {
      await this.registration.update();
      this.waitingWorker = this.registration.waiting;
    }
    if (!this.waitingWorker) {
      this.applyingUpdate = false;
      return false;
    }
    this.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    return true;
  }
}
