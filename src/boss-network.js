const PREVIEW_EVENT_ID = '00000000-0000-4000-8000-000000000082';
const PENDING_SETTLEMENT_KEY = 'cl:boss-pending-settlement:v1';
export const BOSS_REWARD_DEFINITIONS = Object.freeze([
  Object.freeze({ key: 'first_strike', type: 'milestone', name: 'FIRST STRIKE', description: 'DEAL 1,000 VERIFIED EVENT DAMAGE', threshold: 1000, shards: 25 }),
  Object.freeze({ key: 'crown_vanguard', type: 'milestone', name: 'CROWN VANGUARD', description: 'DEAL 5,000 VERIFIED EVENT DAMAGE', threshold: 5000, shards: 50 }),
  Object.freeze({ key: 'wardenbreaker', type: 'milestone', name: 'WARDENBREAKER', description: 'DEAL 15,000 VERIFIED EVENT DAMAGE', threshold: 15000, shards: 100, badgeId: 'wardenbreaker', badgeName: 'WARDENBREAKER' }),
  Object.freeze({ key: 'sovereign_slayer', type: 'global_victory', name: 'SOVEREIGN SLAYER', description: 'QUALIFY WITH 1,000 DAMAGE AND DEFEAT THE GLOBAL WARDEN', threshold: 1000, shards: 150, badgeId: 'sovereign_slayer', badgeName: 'SOVEREIGN SLAYER' }),
]);

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
  constructor({ preview = false, accessToken = async () => '', playerName = () => 'YOU', previewDamage = 0, previewStatus = 'active' } = {}) {
    this.preview = preview;
    this.accessToken = accessToken;
    this.playerName = playerName;
    this.event = { ...previewEvent(), status: previewStatus };
    this.attempts = 0;
    this.playerDamage = Math.max(0, Number(previewDamage) || 0);
    this.activeAssault = null;
    this.claimedRewards = new Set();
  }

  previewRewards() {
    return {
      eventId: this.event.id, playerDamage: this.playerDamage, qualified: this.playerDamage >= 1000,
      rewards: BOSS_REWARD_DEFINITIONS.map(reward => ({
        ...reward, earned: this.playerDamage >= reward.threshold,
        claimable: this.playerDamage >= reward.threshold && (reward.type === 'milestone' || this.event.status === 'victory') && !this.claimedRewards.has(reward.key),
        claimed: this.claimedRewards.has(reward.key), claimedAt: null,
      })),
    };
  }

  previewRanking() {
    const leaders = [
      { rank: 1, playerName: 'NOVA_KING', publicProfileId: 'preview:nova_king', damage: 18420, assaults: 5 },
      { rank: 2, playerName: 'VOIDLIZARD', publicProfileId: 'preview:voidlizard', damage: 15380, assaults: 4 },
      { rank: 3, playerName: 'PIXELACE', publicProfileId: 'preview:pixelace', damage: 12110, assaults: 4 },
    ];
    if (this.playerDamage > 0) leaders.push({ rank: 4, playerName: this.playerName() || 'YOU', publicProfileId: 'preview:you', isCurrent: true, damage: this.playerDamage, assaults: this.attempts });
    return { leaders, player: this.playerDamage > 0 ? leaders.at(-1) : null };
  }

  async headers() {
    const token = await this.accessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getEvent() {
    if (this.preview) return { event: this.event, ranking: this.previewRanking(), rewards: this.previewRewards() };
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
    return { settlement, event: this.event, ranking: this.previewRanking(), rewards: this.previewRewards() };
  }

  async claimReward({ eventId, rewardKey, requestId = crypto.randomUUID() }) {
    if (!this.preview) return requestJson('/api/boss/rewards/claim', {
      method: 'POST', headers: await this.headers(), body: JSON.stringify({ eventId, rewardKey, requestId }),
    });
    const reward = this.previewRewards().rewards.find(item => item.key === rewardKey);
    if (!reward?.claimable) throw Object.assign(new Error('This reward is not claimable yet.'), { status: 409 });
    this.claimedRewards.add(rewardKey);
    return {
      claim: { duplicate: false, rewardKey, shards: reward.shards, badgeId: reward.badgeId || null, badgeName: reward.badgeName || null, playerDamage: this.playerDamage },
      rewards: this.previewRewards(), wallet: null,
    };
  }

  async resumePending() {
    if (this.preview) return null;
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem(PENDING_SETTLEMENT_KEY) || 'null'); } catch {}
    if (!pending?.assaultId || !pending?.requestId) return null;
    return this.settle(pending);
  }
}
