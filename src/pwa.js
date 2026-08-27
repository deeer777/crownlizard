export const installContext = ({ userAgent = '', standalone = false, hasPrompt = false, preview = false } = {}) => ({
  installed: Boolean(standalone),
  nativePrompt: Boolean(hasPrompt && !standalone),
  instructions: Boolean(!standalone && (preview || /iPad|iPhone|iPod/.test(userAgent))),
});

const FALLBACK_RELEASE = Object.freeze({
  release: '',
  build: null,
  title: "WHAT'S NEW",
  notes: Object.freeze(['NEW ARCADE CONTENT AND POLISH']),
});

export const normalizeReleaseInfo = value => {
  if (!value || typeof value !== 'object') return FALLBACK_RELEASE;
  const release = typeof value.release === 'string' && /^\d+\.\d+\.\d+$/.test(value.release.trim()) ? value.release.trim() : '';
  const build = Number.isSafeInteger(value.build) && value.build > 0 ? value.build : null;
  const title = typeof value.title === 'string' && value.title.trim() ? value.title.trim().slice(0, 32) : FALLBACK_RELEASE.title;
  const notes = Array.isArray(value.notes)
    ? value.notes.filter(note => typeof note === 'string' && note.trim()).slice(0, 3).map(note => note.trim().slice(0, 80))
    : [];
  return { release, build, title, notes: notes.length ? notes : [...FALLBACK_RELEASE.notes] };
};

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

  async getReleaseInfo() {
    try {
      const response = await fetch(`/release.json?update=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return FALLBACK_RELEASE;
      return normalizeReleaseInfo(await response.json());
    } catch {
      return FALLBACK_RELEASE;
    }
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

  async markUpdate(worker) {
    if (!worker || !navigator.serviceWorker.controller) return;
    this.waitingWorker = worker;
    this.onUpdateReady({ releaseInfo: await this.getReleaseInfo() });
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
