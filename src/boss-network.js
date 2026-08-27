const PREVIEW_EVENT_ID = '00000000-0000-4000-8000-000000000082';
const PENDING_SETTLEMENT_KEY = 'cl:boss-pending-settlement:v1';

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Crown Network unavailable.');
    error.code = payload.code || '';
    error.status = response.status;
    throw error;
  }
  return payload;
};

const previewEvent = () => ({
  id: PREVIEW_EVENT_ID, slug: 'sovereign-engine-alpha', name: 'THE SOVEREIGN ENGINE', status: 'active',
  startsAt: new Date(Date.now() - 300_000).toISOString(), endsAt: new Date(Date.now() + 47 * 3_600_000).toISOString(),
  maxHp: 68_420_000, currentHp: 51_884_260, trialBlueprintId: 'pulse_singularity', balanceVersion: 1,
});

export class BossNetwork {
  constructor({ preview = false, accessToken = async () => '', playerName = () => 'YOU' } = {}) {
    this.preview = preview;
    this.accessToken = accessToken;
    this.playerName = playerName;
    this.event = previewEvent();
    this.attempts = 0;
    this.playerDamage = 0;
    this.activeAssault = null;
  }

  previewRanking() {
    const leaders = [
      { rank: 1, playerName: 'NOVA_KING', damage: 18420, assaults: 5 },
      { rank: 2, playerName: 'VOIDLIZARD', damage: 15380, assaults: 4 },
      { rank: 3, playerName: 'PIXELACE', damage: 12110, assaults: 4 },
    ];
    if (this.playerDamage > 0) leaders.push({ rank: 4, playerName: this.playerName() || 'YOU', damage: this.playerDamage, assaults: this.attempts });
    return { leaders, player: this.playerDamage > 0 ? leaders.at(-1) : null };
  }

  async headers() {
    const token = await this.accessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getEvent() {
    if (this.preview) return { event: this.event, ranking: this.previewRanking() };
    return requestJson('/api/boss/event', { headers: await this.headers() });
  }

  async start({ eventId, blueprintId, gameVersion, arsenalRank = 0 }) {
    if (!this.preview) return requestJson('/api/boss/assault/start', {
      method: 'POST', headers: await this.headers(), body: JSON.stringify({ eventId, blueprintId, gameVersion }),
    });
    this.attempts += 1;
    const attemptMultiplier = this.attempts <= 3 ? 1 : this.attempts <= 6 ? .75 : .5;
    this.activeAssault = {
      assaultId: crypto.randomUUID(), eventId, blueprintId, arsenalRank,
      damageBonus: Math.min(.2, arsenalRank * .02), attemptNumber: this.attempts, attemptMultiplier,
      seed: Math.floor(Math.random() * 2_147_483_647), globalHp: this.event.currentHp, globalMaxHp: this.event.maxHp,
    };
    return { assault: this.activeAssault, event: this.event, ranking: this.previewRanking() };
  }

  async settle(result) {
    if (!this.preview) {
      try { localStorage.setItem(PENDING_SETTLEMENT_KEY, JSON.stringify(result)); } catch {}
      try {
        const payload = await requestJson('/api/boss/assault/settle', {
          method: 'POST', headers: await this.headers(), body: JSON.stringify(result),
        });
        try { localStorage.removeItem(PENDING_SETTLEMENT_KEY); } catch {}
        return payload;
      } catch (error) {
        if (error.status >= 400 && error.status < 500) try { localStorage.removeItem(PENDING_SETTLEMENT_KEY); } catch {}
        throw error;
      }
    }
    if (!this.activeAssault || this.activeAssault.assaultId !== result.assaultId) throw new Error('Assault signal expired.');
    const rawDamage = result.phaseDamage.reduce((sum, value) => sum + value, 0);
    const effectiveDamage = Math.min(this.event.currentHp, Math.floor(rawDamage * this.activeAssault.attemptMultiplier));
    this.event = { ...this.event, currentHp: this.event.currentHp - effectiveDamage };
    this.playerDamage += effectiveDamage;
    const settlement = {
      assaultId: result.assaultId, eventId: this.event.id, rawDamage, approvedDamage: rawDamage,
      effectiveDamage, attemptMultiplier: this.activeAssault.attemptMultiplier,
      playerTotalDamage: this.playerDamage, globalHp: this.event.currentHp, globalMaxHp: this.event.maxHp,
      eventDefeated: this.event.currentHp === 0, auditFlags: [],
    };
    this.activeAssault = null;
    return { settlement, event: this.event, ranking: this.previewRanking() };
  }

  async resumePending() {
    if (this.preview) return null;
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem(PENDING_SETTLEMENT_KEY) || 'null'); } catch {}
    if (!pending?.assaultId || !pending?.requestId) return null;
    return this.settle(pending);
  }
}
