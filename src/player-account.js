const SESSION_KEY = 'cl:player-session:v1';
const PENDING_CRATE_KEY = 'cl:pending-crate:v1';
const PENDING_SETTLEMENT_KEY = 'cl:pending-settlement:v1';
const PENDING_STORE_KEY = 'cl:pending-store:v1';
const PENDING_MARKET_KEY = 'cl:pending-market:v1';
const PASSWORD_SETUP_KEY = 'cl:account-password:v1';
const REQUEST_TIMEOUT = 20000;

const validToken = value => typeof value === 'string' && value.length > 0 && value.length <= 8192;

const validSession = value => value
  && validToken(value.accessToken)
  && typeof value.player?.id === 'string' && value.player.id.length > 0;

const normalizeSession = value => {
  const source = value?.session || value || {};
  const player = source.player || source.user || {};
  return {
    accessToken: String(source.accessToken || source.access_token || ''),
    refreshToken: String(source.refreshToken || source.refresh_token || ''),
    expiresIn: Number(source.expiresIn || source.expires_in) || 3600,
    expiresAt: Number(source.expiresAt || source.expires_at) || 0,
    player: {
      id: String(player.id || ''),
      anonymous: Boolean(player.anonymous ?? player.is_anonymous ?? false),
      email: String(player.email || ''),
    },
  };
};

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
      error.code = String(payload.code || '');
      if (payload.availableAt) error.availableAt = payload.availableAt;
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

export class PlayerAccount {
  constructor(storage = globalThis.localStorage, storageKey = SESSION_KEY) {
    this.storage = storage;
    this.storageKey = storageKey;
    this.sessionExpired = false;
    this.legacyRefreshToken = '';
    this.session = this.readSession();
    this.redirectResult = this.consumeAuthRedirect();
  }

  consumeAuthRedirect(location = globalThis.location, history = globalThis.history) {
    if (!location?.href) return null;
    const url = new URL(location.href);
    const params = new URLSearchParams(url.hash.slice(1));
    const error = params.get('error_description');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const tokenHash = params.get('token_hash');
    const verificationType = params.get('type');
    const pendingVerification = params.get('account') === 'confirm'
      && /^[A-Za-z0-9_-]{20,512}$/.test(String(tokenHash || ''))
      && ['email', 'email_change', 'recovery'].includes(String(verificationType || ''));
    const accountAction = url.searchParams.get('account');
    const confirmation = accountAction === 'verified' || Boolean(params.get('message'));
    const clearRedirect = () => {
      try {
        url.hash = '';
        url.searchParams.delete('account');
        history?.replaceState({}, '', `${url.pathname}${url.search}`);
      } catch {}
    };
    if (error) {
      clearRedirect();
      return { error };
    }
    if (accountAction === 'signed-in') {
      clearRedirect();
      return { sessionReturn: true };
    }
    if (accountAction === 'sign-in') {
      clearRedirect();
      return { signIn: true };
    }
    if (pendingVerification) {
      clearRedirect();
      return { pending: true, tokenHash, type: verificationType };
    }
    if (accessToken || refreshToken) {
      clearRedirect();
      return { error: 'Legacy sign-in link rejected. Request a new secure account link.' };
    }
    if (!accessToken && !refreshToken) {
      if (!confirmation) return null;
      try { this.storage?.setItem(PASSWORD_SETUP_KEY, 'required'); } catch {}
      clearRedirect();
      return { confirmed: true };
    }
    return null;
  }

  readSession() {
    try {
      const normalized = normalizeSession(JSON.parse(this.storage?.getItem(this.storageKey) || 'null'));
      if (!validSession(normalized)) return null;
      if (validToken(normalized.refreshToken)) this.legacyRefreshToken = normalized.refreshToken;
      const expiresAt = Number(normalized.expiresAt) || Math.floor(Date.now() / 1000) + Number(normalized.expiresIn || 3600);
      const { refreshToken: _removed, ...publicFields } = normalized;
      const session = { ...publicFields, expiresAt };
      try { this.storage?.setItem(this.storageKey, JSON.stringify(session)); } catch {}
      return session;
    } catch { return null; }
  }

  saveSession(session) {
    const normalized = normalizeSession(session);
    if (!validSession(normalized)) throw new Error('Sign-in succeeded, but the player session could not be restored. Please try again.');
    const expiresAt = Number(normalized.expiresAt) || Math.floor(Date.now() / 1000) + Number(normalized.expiresIn || 3600);
    const { refreshToken: _removed, ...publicFields } = normalized;
    this.session = { ...publicFields, expiresAt };
    this.legacyRefreshToken = '';
    this.sessionExpired = false;
    try { this.storage?.setItem(this.storageKey, JSON.stringify(this.session)); } catch {}
    return this.session;
  }

  clearSession() {
    this.session = null;
    this.legacyRefreshToken = '';
    this.sessionExpired = false;
    try { this.storage?.removeItem(this.storageKey); } catch {}
  }

  async logout() {
    const accessToken = this.session?.accessToken;
    const revokeRequest = accessToken
      ? requestJson('/api/player/account/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: '{}',
      })
      : Promise.resolve(null);
    let serverRevoked = false;
    this.clearSession();
    try {
      await revokeRequest;
      serverRevoked = Boolean(accessToken);
    } catch {
      // A player must still be able to leave the account on an offline device.
    } finally {
      try {
        this.storage?.removeItem(PASSWORD_SETUP_KEY);
        this.storage?.removeItem(PENDING_CRATE_KEY);
        this.storage?.removeItem(PENDING_SETTLEMENT_KEY);
        this.storage?.removeItem(PENDING_STORE_KEY);
        this.storage?.removeItem(PENDING_MARKET_KEY);
      } catch {}
    }
    return { signedOut: true, serverRevoked };
  }

  getPlayer() { return this.session?.player || null; }

  getAccountState() {
    if (!this.session?.player || this.session.player.anonymous) return 'guest';
    if (this.sessionExpired) return 'expired';
    if (this.needsPasswordSetup()) return 'setup';
    return 'signed-in';
  }

  needsPasswordSetup() {
    if (!this.session?.player || this.session.player.anonymous) return false;
    try { return this.storage?.getItem(PASSWORD_SETUP_KEY) !== 'done'; } catch { return true; }
  }

  syncPlayer(player) {
    if (!this.session || typeof player?.id !== 'string' || player.id !== this.session.player.id) return;
    this.saveSession({ ...this.session, player: { ...this.session.player, ...player } });
  }

  createSession() {
    return requestJson('/api/player/session', { method: 'POST', body: '{}' }).then(session => this.saveSession(session));
  }

  async recoverExpiredSession(error) {
    if (error?.status !== 400 && error?.status !== 401) throw error;
    const permanentAccount = Boolean(this.session?.player && !this.session.player.anonymous);
    if (permanentAccount) {
      this.sessionExpired = true;
      const expired = new Error('Player session expired. Sign in again.');
      expired.status = 401;
      throw expired;
    }
    this.clearSession();
    return this.createSession();
  }

  async ensureSession() {
    if (!this.session) return this.createSession();
    if (this.sessionExpired) {
      const expired = new Error('Player session expired. Sign in again.');
      expired.status = 401;
      throw expired;
    }
    if (this.legacyRefreshToken) {
      try { return await this.refresh(); } catch (error) { return this.recoverExpiredSession(error); }
    }
    if (this.session.expiresAt * 1000 > Date.now() + 30_000) return this.session;
    try { return await this.refresh(); } catch (error) { return this.recoverExpiredSession(error); }
  }

  async refresh() {
    if (!this.session) throw new Error('Player session is missing.');
    const refreshToken = this.legacyRefreshToken;
    const refreshed = await requestJson('/api/player/refresh', {
      method: 'POST',
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    });
    this.legacyRefreshToken = '';
    return this.saveSession(refreshed);
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

  async getWallet() {
    const payload = await this.authorizedRequest('/api/player/wallet');
    this.syncPlayer(payload.player);
    return payload;
  }

  getProfile() {
    return this.authorizedRequest('/api/player/profile');
  }

  getPublicProfile(publicId) {
    return requestJson(`/api/profiles/${encodeURIComponent(String(publicId || ''))}`);
  }

  setProfileVisibility(isPublic) {
    return this.authorizedRequest('/api/player/profile/visibility', {
      method: 'PUT',
      body: JSON.stringify({ isPublic: Boolean(isPublic) }),
    });
  }

  claimCallsign(callsign) {
    return this.authorizedRequest('/api/player/profile/callsign', {
      method: 'POST',
      body: JSON.stringify({ callsign }),
    });
  }

  renameCallsign(callsign, requestId = globalThis.crypto?.randomUUID?.()) {
    if (!requestId) throw new Error('Secure store identifiers are unavailable.');
    return this.authorizedRequest('/api/player/profile/callsign', {
      method: 'PUT',
      body: JSON.stringify({ callsign, requestId }),
    });
  }

  async bootstrapWallet() {
    if (this.session) return this.getWallet();
    const payload = await requestJson('/api/player/bootstrap', { method: 'POST', body: '{}' });
    const session = this.saveSession(payload.session || payload);
    if (!session.accessToken) throw new Error('Player bootstrap session is missing.');
    return payload;
  }

  async linkEmail(email) {
    const payload = await this.authorizedRequest('/api/player/account/link-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    try { this.storage?.setItem(PASSWORD_SETUP_KEY, 'required'); } catch {}
    return payload;
  }

  async completeAuthRedirect() {
    if (!this.redirectResult?.pending) return this.redirectResult;
    const payload = await requestJson('/api/player/account/confirm', {
      method: 'POST',
      body: JSON.stringify({ tokenHash: this.redirectResult.tokenHash, type: this.redirectResult.type }),
    });
    this.saveSession(payload);
    try { this.storage?.setItem(PASSWORD_SETUP_KEY, 'required'); } catch {}
    this.redirectResult = { verified: true, session: this.session };
    return this.redirectResult;
  }

  async setPassword(password) {
    const payload = await this.authorizedRequest('/api/player/account/password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    this.syncPlayer(payload.player);
    try { this.storage?.setItem(PASSWORD_SETUP_KEY, 'done'); } catch {}
    return payload;
  }

  async requestPasswordRecovery(email) {
    return requestJson('/api/player/account/recovery', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async login(email, password) {
    const payload = await requestJson('/api/player/account/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.saveSession(payload.session || payload);
    try {
      this.storage?.setItem(PASSWORD_SETUP_KEY, 'done');
      this.storage?.removeItem(PENDING_CRATE_KEY);
      this.storage?.removeItem(PENDING_SETTLEMENT_KEY);
    } catch {}
    return { ...payload, ...this.session };
  }

  async settleRun(runId, summary, checkpointToken, sequence) {
    const settlement = {
      runId,
      checkpointToken,
      sequence,
      score: Math.max(0, Math.floor(Number(summary.score) || 0)),
      durationMs: summary.durationMs,
      zone: summary.zone,
      wardens: summary.wardens,
      enemies: summary.enemies,
      crates: summary.crates,
      bestCombo: summary.bestCombo,
      masteries: Array.isArray(summary.masteries) ? summary.masteries.map(({ weaponKey, masteryKey }) => ({ weaponKey, masteryKey })) : [],
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

  getStore() {
    return this.authorizedRequest('/api/vault/store');
  }

  pendingStorePurchase(sku) {
    try {
      const pending = JSON.parse(this.storage?.getItem(PENDING_STORE_KEY) || 'null');
      if (pending?.sku === sku && typeof pending.requestId === 'string') return pending.requestId;
    } catch {}
    if (!globalThis.crypto?.randomUUID) throw new Error('Secure store identifiers are unavailable.');
    const requestId = globalThis.crypto.randomUUID();
    try { this.storage?.setItem(PENDING_STORE_KEY, JSON.stringify({ sku, requestId })); } catch {}
    return requestId;
  }

  async purchaseStoreItem(sku) {
    const requestId = this.pendingStorePurchase(sku);
    try {
      const result = await this.authorizedRequest('/api/vault/store/purchase', {
        method: 'POST',
        body: JSON.stringify({ sku, requestId }),
      });
      try { this.storage?.removeItem(PENDING_STORE_KEY); } catch {}
      return result;
    } catch (error) {
      if ([400, 404, 409].includes(error.status)) {
        try { this.storage?.removeItem(PENDING_STORE_KEY); } catch {}
      }
      throw error;
    }
  }

  markCosmeticSeen(cosmeticId) {
    return this.authorizedRequest('/api/vault/inventory/seen', {
      method: 'POST',
      body: JSON.stringify({ cosmeticId }),
    });
  }

  getMarket() { return this.authorizedRequest('/api/market'); }

  marketRequestId(action, target) {
    const key = `${action}:${target}`;
    try {
      const pending = JSON.parse(this.storage?.getItem(PENDING_MARKET_KEY) || 'null');
      if (pending?.key === key && typeof pending.requestId === 'string') return pending.requestId;
    } catch {}
    if (!globalThis.crypto?.randomUUID) throw new Error('Secure market identifiers are unavailable.');
    const requestId = globalThis.crypto.randomUUID();
    try { this.storage?.setItem(PENDING_MARKET_KEY, JSON.stringify({ key, requestId })); } catch {}
    return requestId;
  }

  async createMarketListing(cosmeticId, price) {
    const requestId = this.marketRequestId('list', cosmeticId);
    const result = await this.authorizedRequest('/api/market/listings', { method: 'POST', body: JSON.stringify({ cosmeticId, price, requestId }) });
    try { this.storage?.removeItem(PENDING_MARKET_KEY); } catch {}
    return result;
  }

  cancelMarketListing(listingId) {
    return this.authorizedRequest(`/api/market/listings/${encodeURIComponent(listingId)}/cancel`, { method: 'POST', body: '{}' });
  }

  async buyMarketListing(listingId) {
    const requestId = this.marketRequestId('buy', listingId);
    const result = await this.authorizedRequest(`/api/market/listings/${encodeURIComponent(listingId)}/buy`, { method: 'POST', body: JSON.stringify({ requestId }) });
    try { this.storage?.removeItem(PENDING_MARKET_KEY); } catch {}
    return result;
  }

  acknowledgeMarketSignals(saleIds) {
    return this.authorizedRequest('/api/market/signals/seen', {
      method: 'POST', body: JSON.stringify({ saleIds }),
    });
  }

  listPvpChallenges() {
    return requestJson('/api/pvp/challenges');
  }

  createPvpChallenge() {
    return this.authorizedRequest('/api/pvp/challenges', { method: 'POST', body: '{}' });
  }

  getPvpChallenge(challengeId) {
    return this.authorizedRequest(`/api/pvp/challenges/${encodeURIComponent(String(challengeId || ''))}`);
  }

  getPvpInvite(inviteCode) {
    return requestJson(`/api/pvp/invites/${encodeURIComponent(String(inviteCode || '').toUpperCase())}`);
  }

  joinPvpChallenge(locator, invite = false) {
    const base = invite ? 'invites' : 'challenges';
    return this.authorizedRequest(`/api/pvp/${base}/${encodeURIComponent(String(locator || '').toUpperCase())}/join`, { method: 'POST', body: '{}' });
  }

  cancelPvpChallenge(challengeId) {
    return this.authorizedRequest(`/api/pvp/challenges/${encodeURIComponent(String(challengeId || ''))}/cancel`, { method: 'POST', body: '{}' });
  }

  leavePvpChallenge(challengeId) {
    return this.authorizedRequest(`/api/pvp/challenges/${encodeURIComponent(String(challengeId || ''))}/leave`, { method: 'POST', body: '{}' });
  }

  setPvpReady(challengeId, ready) {
    return this.authorizedRequest(`/api/pvp/challenges/${encodeURIComponent(String(challengeId || ''))}/ready`, {
      method: 'POST', body: JSON.stringify({ ready: Boolean(ready) }),
    });
  }

  selectPvpBlueprint(challengeId, blueprintId) {
    return this.authorizedRequest(`/api/pvp/challenges/${encodeURIComponent(String(challengeId || ''))}/blueprint`, {
      method: 'POST', body: JSON.stringify({ blueprintId }),
    });
  }

  submitPvpProgress(challengeId, score, elapsedMs, enemies = 0) {
    return this.authorizedRequest(`/api/pvp/challenges/${encodeURIComponent(String(challengeId || ''))}/progress`, {
      method: 'POST', body: JSON.stringify({ score, elapsedMs, enemies }),
    });
  }

  finishPvpRun(challengeId, summary) {
    return this.authorizedRequest(`/api/pvp/challenges/${encodeURIComponent(String(challengeId || ''))}/finish`, {
      method: 'POST', body: JSON.stringify(summary),
    });
  }

  requestPvpRematch(challengeId) {
    return this.authorizedRequest(`/api/pvp/challenges/${encodeURIComponent(String(challengeId || ''))}/rematch`, { method: 'POST', body: '{}' });
  }

  heartbeatPvpChallenge(challengeId) {
    return this.authorizedRequest(`/api/pvp/challenges/${encodeURIComponent(String(challengeId || ''))}/heartbeat`, { method: 'POST', body: '{}' });
  }

  getAdminSession() {
    return this.authorizedRequest('/api/admin/session');
  }

  getRewardCodes() {
    return this.authorizedRequest('/api/admin/codes');
  }

  createRewardCode(campaign) {
    return this.authorizedRequest('/api/admin/codes', {
      method: 'POST',
      body: JSON.stringify(campaign),
    });
  }

  setRewardCodeStatus(codeId, status) {
    return this.authorizedRequest(`/api/admin/codes/${encodeURIComponent(String(codeId || ''))}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  redeemRewardCode(code) {
    return this.authorizedRequest('/api/player/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  getArmory() {
    return this.authorizedRequest('/api/armory');
  }

  selectArmoryBlueprint(blueprintId) {
    return this.authorizedRequest('/api/armory/select', {
      method: 'POST',
      body: JSON.stringify({ blueprintId }),
    });
  }

}
