const SESSION_KEY = 'cl:player-session:v1';
const PENDING_CRATE_KEY = 'cl:pending-crate:v1';
const PENDING_SETTLEMENT_KEY = 'cl:pending-settlement:v1';
const REQUEST_TIMEOUT = 20000;

const validSession = value => value
  && typeof value.accessToken === 'string' && value.accessToken.length > 20
  && typeof value.refreshToken === 'string' && value.refreshToken.length > 20
  && typeof value.player?.id === 'string';

const requestJson = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Player service unavailable.');
      error.status = response.status;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Player service timed out.');
      timeoutError.status = 408;
      throw timeoutError;
    }
    throw error;
  } finally { clearTimeout(timer); }
};

export const legacyWalletPayload = state => ({
  balance: Math.max(0, Math.floor(Number(state?.balance) || 0)),
  opens: Math.max(0, Math.floor(Number(state?.vault?.opens) || 0)),
  sinceSovereign: Math.max(0, Math.floor(Number(state?.vault?.sinceSovereign) || 0)),
  equippedShip: String(state?.inventory?.equipped?.ship || 'ship_default'),
  cosmetics: Object.keys(state?.inventory?.cosmetics || {}),
});

export class PlayerAccount {
  constructor(storage = globalThis.localStorage, storageKey = SESSION_KEY) {
    this.storage = storage;
    this.storageKey = storageKey;
    this.session = this.readSession();
  }

  readSession() {
    try {
      const value = JSON.parse(this.storage?.getItem(this.storageKey) || 'null');
      return validSession(value) ? value : null;
    } catch { return null; }
  }

  saveSession(session) {
    if (!validSession(session)) throw new Error('Invalid player session.');
    const expiresAt = Number(session.expiresAt) || Math.floor(Date.now() / 1000) + Number(session.expiresIn || 3600);
    this.session = { ...session, expiresAt };
    try { this.storage?.setItem(this.storageKey, JSON.stringify(this.session)); } catch {}
    return this.session;
  }

  clearSession() {
    this.session = null;
    try { this.storage?.removeItem(this.storageKey); } catch {}
  }

  createSession() {
    return requestJson('/api/player/session', { method: 'POST', body: '{}' }).then(session => this.saveSession(session));
  }

  async recoverExpiredSession(error) {
    if (error?.status !== 400 && error?.status !== 401) throw error;
    this.clearSession();
    return this.createSession();
  }

  async ensureSession() {
    if (!this.session) return this.createSession();
    if (this.session.expiresAt * 1000 > Date.now() + 30_000) return this.session;
    try { return await this.refresh(); } catch (error) { return this.recoverExpiredSession(error); }
  }

  async refresh() {
    if (!this.session?.refreshToken) throw new Error('Player session is missing.');
    return this.saveSession(await requestJson('/api/player/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.session.refreshToken }),
    }));
  }

  async authorizedRequest(url, options = {}, retry = true) {
    const session = await this.ensureSession();
    try {
      return await requestJson(url, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${session.accessToken}` } });
    } catch (error) {
      if (retry && error.status === 401) {
        try { await this.refresh(); } catch (refreshError) { await this.recoverExpiredSession(refreshError); }
        return this.authorizedRequest(url, options, false);
      }
      throw error;
    }
  }

  async getAccessToken() { return (await this.ensureSession()).accessToken; }

  getWallet() { return this.authorizedRequest('/api/player/wallet'); }

  async bootstrapWallet() {
    if (this.session) return this.getWallet();
    const payload = await requestJson('/api/player/bootstrap', { method: 'POST', body: '{}' });
    const session = {
      accessToken: String(payload.accessToken || ''),
      refreshToken: String(payload.refreshToken || ''),
      expiresIn: Number(payload.expiresIn) || 3600,
      expiresAt: Number(payload.expiresAt) || Math.floor(Date.now() / 1000) + 3600,
      player: payload.player || { id: '', anonymous: true },
    };
    if (!session.accessToken || !session.refreshToken) throw new Error('Player bootstrap session is missing.');
    this.session = session;
    try { this.storage?.setItem(this.storageKey, JSON.stringify(session)); } catch {}
    return payload;
  }

  async settleRun(runId, summary) {
    const settlement = {
      runId,
      durationMs: summary.durationMs,
      zone: summary.zone,
      wardens: summary.wardens,
      enemies: summary.enemies,
    };
    try { this.storage?.setItem(PENDING_SETTLEMENT_KEY, JSON.stringify(settlement)); } catch {}
    const result = await this.authorizedRequest('/api/economy/settle', {
      method: 'POST',
      body: JSON.stringify(settlement),
    });
    try { this.storage?.removeItem(PENDING_SETTLEMENT_KEY); } catch {}
    return result;
  }

  async retryPendingSettlement() {
    let settlement = null;
    try { settlement = JSON.parse(this.storage?.getItem(PENDING_SETTLEMENT_KEY) || 'null'); } catch {}
    if (!settlement?.runId) return null;
    const result = await this.authorizedRequest('/api/economy/settle', { method: 'POST', body: JSON.stringify(settlement) });
    try { this.storage?.removeItem(PENDING_SETTLEMENT_KEY); } catch {}
    return result;
  }

  pendingCrateId() {
    try {
      const existing = this.storage?.getItem(PENDING_CRATE_KEY);
      if (existing) return existing;
    } catch {}
    if (!globalThis.crypto?.randomUUID) throw new Error('Secure crate identifiers are unavailable.');
    const requestId = globalThis.crypto.randomUUID();
    try { this.storage?.setItem(PENDING_CRATE_KEY, requestId); } catch {}
    return requestId;
  }

  async openCrate() {
    const requestId = this.pendingCrateId();
    try {
      const result = await this.authorizedRequest('/api/vault/open', {
        method: 'POST',
        body: JSON.stringify({ requestId }),
      });
      try { this.storage?.removeItem(PENDING_CRATE_KEY); } catch {}
      return result;
    } catch (error) {
      if (error.status === 400) {
        try { this.storage?.removeItem(PENDING_CRATE_KEY); } catch {}
      }
      throw error;
    }
  }

  equipCosmetic(cosmeticId) {
    return this.authorizedRequest('/api/vault/equip', {
      method: 'POST',
      body: JSON.stringify({ cosmeticId }),
    });
  }

  importLegacy(state) {
    return this.authorizedRequest('/api/player/wallet/import', {
      method: 'POST',
      body: JSON.stringify(legacyWalletPayload(state)),
    });
  }
}
