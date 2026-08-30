const DIFFICULTIES = new Set(['chill', 'arcade', 'crowned']);
const SUPPORTED_GAME_VERSIONS = new Set(['0.10.0-38', '0.10.1-39', '0.10.2-40', '0.10.3-41', '0.11.0-42', '0.12.0-43', '0.13.0-44', '0.14.0-45', '0.14.1-46', '0.14.2-47', '0.14.3-48', '0.14.4-49', '0.14.5-50', '0.14.6-51', '0.14.7-52', '0.14.8-53', '0.14.9-54', '0.15.0-55', '0.15.1-56', '0.15.2-57', '0.15.3-58', '0.15.4-59', '0.15.5-60', '0.15.6-61', '0.15.7-62', '0.15.8-63', '0.15.9-64', '0.16.0-65', '0.16.1-66', '0.16.2-67', '0.16.3-68', '0.16.4-69', '0.17.0-70', '0.17.1-71', '0.17.2-72', '0.17.3-73', '0.17.4-74', '0.18.0-75', '0.19.0-76', '0.20.0-77', '0.21.0-78', '0.22.0-79', '0.23.0-80', '0.24.0-81', '0.25.0-82', '0.26.0-83', '0.27.0-84', '0.27.1-85', '0.27.2-86', '0.28.0-87', '0.29.0-88', '0.30.0-89', '0.31.0-90', '0.32.0-91', '0.33.0-92', '0.34.0-93', '0.35.0-94', '0.36.0-95', '0.37.0-96']);
const ARMORY_UNLOCK_VERSIONS = new Set(['0.23.0-80', '0.24.0-81', '0.25.0-82', '0.26.0-83', '0.27.0-84', '0.27.1-85', '0.27.2-86', '0.28.0-87', '0.29.0-88', '0.30.0-89', '0.31.0-90', '0.32.0-91', '0.33.0-92', '0.34.0-93', '0.35.0-94', '0.36.0-95', '0.37.0-96']);
const MAX_BODY_BYTES = 4096;
const GAME_VERSION_PATTERN = /^\d+\.\d+\.\d+-\d+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COSMETIC_IDS = new Set([
  'ship_verdant_scout', 'ship_ember_runner', 'ship_crystal_dart', 'ship_void_hunter',
  'ship_solar_guard', 'ship_royal_vanguard', 'ship_rift_phantom', 'ship_crown_sovereign',
  'ship_gilded_viper', 'ship_neon_basilisk',
  'weapon_tesla_verdant_chain', 'weapon_tesla_storm_crown', 'weapon_laser_void_lance',
  'weapon_pulse_sovereign_eclipse', 'weapon_laser_royal_prism', 'weapon_pulse_solar_core',
]);
const LEGACY_BALANCE_CAP = 50_000;
const AUTH_BOOTSTRAP_LIMIT = 60;
const PROMO_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PROMO_SHARD_MIN = 25;
const PROMO_SHARD_MAX = 2500;
const PROMO_CRATE_MIN = 1;
const PROMO_CRATE_MAX = 5;
const MARKET_PRICE_BOUNDS = Object.freeze({
  uncommon: Object.freeze({ minimum: 50, maximum: 750 }),
  rare: Object.freeze({ minimum: 100, maximum: 1500 }),
  royal: Object.freeze({ minimum: 200, maximum: 3000 }),
  mythic: Object.freeze({ minimum: 400, maximum: 6000 }),
  sovereign: Object.freeze({ minimum: 1000, maximum: 15000 }),
});
const CALLSIGN_RENAME_COST = 500;
const CALLSIGN_RENAME_COOLDOWN_DAYS = 7;
const RESERVED_CALLSIGNS = new Set(['ADMIN', 'CROWNLIZARD', 'CROWN_LIZARD', 'DEVELOPER', 'GUEST', 'MOD', 'MODERATOR', 'STAFF', 'SUPPORT', 'SYSTEM']);
const BLOCKED_CALLSIGN_TERMS = ['FUCK', 'SHIT', 'BITCH', 'CUNT', 'NIGGER', 'NAZI'];
const SHARD_RULES = Object.freeze({
  minimumDurationSeconds: 30,
  minimumEnemies: 5,
  sponsoredDurationSeconds: 90,
  survivalStepSeconds: 30,
  survivalStepShards: 4,
  survivalCap: 24,
  enemiesPerStep: 5,
  enemyStepShards: 2,
  enemyCap: 30,
  zoneShards: 8,
  zoneCap: 32,
  wardenShards: 15,
  wardenCap: 60,
  maximumRunReward: 150,
});
const STANDARD_BLUEPRINT_ID = 'blaster_standard';
const ARSENAL_RANK_THRESHOLDS = Object.freeze([0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000]);
const BLUEPRINTS = Object.freeze([
  { id: STANDARD_BLUEPRINT_ID, weaponKey: 'blaster', masteryKey: '', name: 'STANDARD BLASTER', role: 'RELIABLE ALL-ROUNDER', sortOrder: 0, trialEligible: false },
  { id: 'blaster_royal_barrage', weaponKey: 'blaster', masteryKey: 'royalBarrage', name: 'ROYAL BARRAGE', role: 'CROWD CONTROL', sortOrder: 10, trialEligible: true },
  { id: 'blaster_crownrail', weaponKey: 'blaster', masteryKey: 'crownrail', name: 'CROWNRAIL', role: 'ELITE BREAKER', sortOrder: 20, trialEligible: true },
  { id: 'spread_halo_guard', weaponKey: 'spread', masteryKey: 'haloGuard', name: 'HALO GUARD', role: 'FULL DEFENCE', sortOrder: 30, trialEligible: true },
  { id: 'spread_guillotine_fan', weaponKey: 'spread', masteryKey: 'guillotineFan', name: 'GUILLOTINE FAN', role: 'FORWARD BURST', sortOrder: 40, trialEligible: true },
  { id: 'pulse_singularity', weaponKey: 'pulse', masteryKey: 'singularity', name: 'SINGULARITY', role: 'AREA DAMAGE', sortOrder: 50, trialEligible: true },
  { id: 'pulse_comet_cores', weaponKey: 'pulse', masteryKey: 'cometCores', name: 'COMET CORES', role: 'BOSS PRESSURE', sortOrder: 60, trialEligible: true },
  { id: 'laser_sovereign_lance', weaponKey: 'laser', masteryKey: 'sovereignLance', name: 'SOVEREIGN LANCE', role: 'FOCUS DAMAGE', sortOrder: 70, trialEligible: true },
  { id: 'laser_prism_array', weaponKey: 'laser', masteryKey: 'prismArray', name: 'PRISM ARRAY', role: 'MULTI TARGET', sortOrder: 80, trialEligible: true },
  { id: 'tesla_storm_web', weaponKey: 'tesla', masteryKey: 'stormWeb', name: 'STORM WEB', role: 'CHAIN CONTROL', sortOrder: 90, trialEligible: true },
  { id: 'tesla_thunder_anchor', weaponKey: 'tesla', masteryKey: 'thunderAnchor', name: 'THUNDER ANCHOR', role: 'WARDEN HUNTER', sortOrder: 100, trialEligible: true },
]);
const BLUEPRINT_BY_MASTERY = new Map(BLUEPRINTS.filter(item => item.masteryKey).map(item => [`${item.weaponKey}:${item.masteryKey}`, item]));
const BOSS_PHASE_CEILINGS = Object.freeze({
  blaster_standard: [750, 750, 750], blaster_royal_barrage: [700, 1100, 760], blaster_crownrail: [850, 600, 1080],
  spread_halo_guard: [650, 1120, 760], spread_guillotine_fan: [900, 700, 1150], pulse_singularity: [520, 1180, 620],
  pulse_comet_cores: [760, 900, 1100], laser_sovereign_lance: [1250, 520, 650], laser_prism_array: [620, 900, 1200],
  tesla_storm_web: [520, 1250, 650], tesla_thunder_anchor: [1150, 500, 760],
});

export const bossAttemptMultiplier = attempt => attempt <= 3 ? 1 : attempt <= 6 ? .75 : .5;

export const validateBossSettlementPayload = body => {
  const assaultId = String(body?.assaultId || '');
  const requestId = String(body?.requestId || '');
  const elapsedMs = normalizeInt(body?.elapsedMs, 0, 90_000);
  const targetsDestroyed = normalizeInt(body?.targetsDestroyed, 0, 1000);
  const outcome = String(body?.outcome || '');
  const phaseDamage = Array.isArray(body?.phaseDamage) && body.phaseDamage.length === 3
    ? body.phaseDamage.map(value => normalizeInt(value, 0, 1_000_000)) : [];
  if (!UUID_PATTERN.test(assaultId) || !UUID_PATTERN.test(requestId) || elapsedMs === null || targetsDestroyed === null
      || !['timeout', 'destroyed', 'breach'].includes(outcome) || phaseDamage.length !== 3 || phaseDamage.some(value => value === null)) {
    return { error: 'Invalid boss settlement.' };
  }
  return { value: { assaultId, requestId, elapsedMs, targetsDestroyed, outcome, phaseDamage } };
};

const responseHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
};

const json = (data, status = 200, cacheControl = 'no-store') => new Response(JSON.stringify(data), {
  status,
  headers: { ...responseHeaders, 'Cache-Control': cacheControl },
});

const readJson = async request => {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY_BYTES) throw new Error('PAYLOAD_TOO_LARGE');
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error('PAYLOAD_TOO_LARGE');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.byteLength; });
  return JSON.parse(new TextDecoder().decode(bytes));
};

const getConfig = env => {
  const url = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(env.SUPABASE_SECRET_KEY || '');
  const salt = String(env.SCORE_HASH_SALT || '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !key || !salt) return null;
  return { url, key, salt, publishableKey: String(env.SUPABASE_PUBLISHABLE_KEY || '') };
};

const authFetch = async (config, resource, options = {}) => {
  if (!config.publishableKey) throw new Error('AUTH_NOT_CONFIGURED');
  const response = await fetch(`${config.url}/auth/v1/${resource}`, {
    ...options,
    headers: {
      apikey: config.publishableKey,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(JSON.stringify({ event: 'supabase_auth_error', resource: resource.split('?')[0], status: response.status }));
    const error = new Error('AUTH_REQUEST_FAILED');
    error.status = response.status;
    throw error;
  }
  return payload;
};

const supabaseFetch = async (config, resource, options = {}) => {
  const response = await fetch(`${config.url}/rest/v1/${resource}`, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    console.error(JSON.stringify({ event: 'supabase_error', resource: resource.split('?')[0], status: response.status }));
    throw new Error(`SUPABASE_${response.status}`);
  }
  if (response.status === 204) return [];
  const text = await response.text();
  return text ? JSON.parse(text) : [];
};

const hashIp = async (request, salt) => {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const normalizeInt = (value, min, max) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
};

const sha256Hex = async value => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

export const normalizeRewardCode = value => {
  const compact = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!compact.startsWith('CROWN')) return '';
  const token = compact.slice(5);
  if (token.length !== 12 || [...token].some(character => !PROMO_CODE_ALPHABET.includes(character))) return '';
  return `CROWN-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8)}`;
};

export const generateRewardCode = () => {
  let token = '';
  for (let index = 0; index < 12; index += 1) token += PROMO_CODE_ALPHABET[secureServerInt(PROMO_CODE_ALPHABET.length)];
  return normalizeRewardCode(`CROWN${token}`);
};

export const validatePromoCreation = (body, now = Date.now()) => {
  const campaignName = String(body?.campaignName || '').trim().toUpperCase();
  const rewardType = String(body?.rewardType || '');
  const rewardAmount = normalizeInt(body?.rewardAmount, 1, 1_000_000);
  const maxRedemptions = normalizeInt(body?.maxRedemptions, 1, 100_000);
  const note = String(body?.note || '').trim();
  const startsMs = body?.startsAt ? Date.parse(String(body.startsAt)) : now;
  const expiresMs = Date.parse(String(body?.expiresAt || ''));
  const validReward = rewardType === 'shards'
    ? rewardAmount !== null && rewardAmount >= PROMO_SHARD_MIN && rewardAmount <= PROMO_SHARD_MAX
    : rewardType === 'crate_credit' && rewardAmount !== null && rewardAmount >= PROMO_CRATE_MIN && rewardAmount <= PROMO_CRATE_MAX;
  if (campaignName.length < 3 || campaignName.length > 48 || note.length > 160 || !validReward || maxRedemptions === null
      || !Number.isFinite(startsMs) || !Number.isFinite(expiresMs) || startsMs < now - 300_000
      || expiresMs <= startsMs || expiresMs > startsMs + 90 * 86_400_000) {
    return { error: 'Invalid campaign settings.' };
  }
  return {
    value: {
      campaignName, rewardType, rewardAmount, maxRedemptions, note,
      startsAt: new Date(startsMs).toISOString(), expiresAt: new Date(expiresMs).toISOString(),
    },
  };
};

export const validateMarketListing = body => {
  const cosmeticId = String(body?.cosmeticId || '');
  const price = normalizeInt(body?.price, 50, 15_000);
  const requestId = String(body?.requestId || '');
  if (!COSMETIC_IDS.has(cosmeticId) || price === null || !UUID_PATTERN.test(requestId)) return { error: 'Invalid market listing.' };
  return { value: { cosmeticId, price, requestId } };
};

export const normalizeCallsign = value => String(value || '').trim().toUpperCase();

const callsignModerationKey = value => normalizeCallsign(value)
  .replaceAll('0', 'O')
  .replaceAll('1', 'I')
  .replaceAll('3', 'E')
  .replaceAll('4', 'A')
  .replaceAll('5', 'S')
  .replaceAll('7', 'T');

export const validateCallsign = value => {
  const callsign = normalizeCallsign(value);
  if (callsign.length < 3 || callsign.length > 10) return { error: 'Use 3–10 characters.', code: 'INVALID_CALLSIGN' };
  if (!/^[A-Z0-9][A-Z0-9_]*[A-Z0-9]$/.test(callsign) || !/[A-Z]/.test(callsign)) {
    return { error: 'Use A–Z, 0–9 or _ without _ at the ends.', code: 'INVALID_CALLSIGN' };
  }
  const moderationKey = callsignModerationKey(callsign);
  if (RESERVED_CALLSIGNS.has(moderationKey) || BLOCKED_CALLSIGN_TERMS.some(term => moderationKey.includes(term))) {
    return { error: 'That callsign is unavailable.', code: 'CALLSIGN_BLOCKED' };
  }
  return { value: callsign };
};

export const calculateServerShardReward = summary => {
  const durationMs = normalizeInt(summary?.durationMs, 0, 86_400_000);
  const enemies = normalizeInt(summary?.enemies, 0, 1_000_000);
  const zone = normalizeInt(summary?.zone, 1, 999);
  const wardens = normalizeInt(summary?.wardens, 0, 999);
  if ([durationMs, enemies, zone, wardens].some(value => value === null)) return null;
  const durationSeconds = Math.floor(durationMs / 1000);
  const missing = [];
  if (durationSeconds < SHARD_RULES.minimumDurationSeconds) missing.push(`SURVIVE ${SHARD_RULES.minimumDurationSeconds} SEC`);
  if (enemies < SHARD_RULES.minimumEnemies) missing.push(`DEFEAT ${SHARD_RULES.minimumEnemies} ENEMIES`);
  const qualified = missing.length === 0;
  const breakdown = qualified ? {
    survival: Math.min(SHARD_RULES.survivalCap, Math.floor(durationSeconds / SHARD_RULES.survivalStepSeconds) * SHARD_RULES.survivalStepShards),
    enemies: Math.min(SHARD_RULES.enemyCap, Math.floor(enemies / SHARD_RULES.enemiesPerStep) * SHARD_RULES.enemyStepShards),
    zones: Math.min(SHARD_RULES.zoneCap, Math.max(0, zone - 1) * SHARD_RULES.zoneShards),
    wardens: Math.min(SHARD_RULES.wardenCap, wardens * SHARD_RULES.wardenShards),
  } : { survival: 0, enemies: 0, zones: 0, wardens: 0 };
  return {
    qualified,
    sponsoredEligible: qualified && (durationSeconds >= SHARD_RULES.sponsoredDurationSeconds || wardens > 0),
    reason: qualified ? '' : missing.join(' + '),
    durationSeconds,
    breakdown,
    total: qualified ? Math.min(SHARD_RULES.maximumRunReward, Object.values(breakdown).reduce((sum, value) => sum + value, 0)) : 0,
  };
};

export const validateEconomySummary = (body, run, now = Date.now()) => {
  const reward = calculateServerShardReward(body);
  if (!reward) return { error: 'Invalid run statistics.' };
  const elapsedSeconds = Math.max(0, (now - Date.parse(run.created_at)) / 1000);
  const expectedZone = Math.floor(reward.durationSeconds / 120) + 1;
  if (reward.durationSeconds > elapsedSeconds + 20) return { error: 'Run timing could not be verified.' };
  if (Number(body.zone) > expectedZone + 1 || Number(body.wardens) > Number(body.zone) || Number(body.enemies) > reward.durationSeconds * 8 + 80) {
    return { error: 'Run statistics could not be verified.' };
  }
  return { reward };
};

export const arsenalRankForXp = xp => {
  const normalized = Math.max(0, Math.floor(Number(xp) || 0));
  let rank = 0;
  ARSENAL_RANK_THRESHOLDS.forEach((threshold, index) => { if (normalized >= threshold) rank = index; });
  return Math.min(10, rank);
};

export const validateArmorySummary = (body, run) => {
  const durationMs = normalizeInt(body?.durationMs, 0, 86_400_000);
  const enemies = normalizeInt(body?.enemies, 0, 1_000_000);
  const zone = normalizeInt(body?.zone, 1, 999);
  const wardens = normalizeInt(body?.wardens, 0, 999);
  const crates = normalizeInt(body?.crates ?? 0, 0, 100_000);
  if ([durationMs, enemies, zone, wardens, crates].some(value => value === null)) return { error: 'Invalid Armory progression data.' };
  const durationSeconds = Math.floor(durationMs / 1000);
  if (crates > durationSeconds / 4 + 8) return { error: 'Armory run statistics could not be verified.' };

  const rawMasteries = body?.masteries ?? [];
  if (!Array.isArray(rawMasteries) || rawMasteries.length > 5) return { error: 'Invalid mastery unlock data.' };
  const claims = [];
  const claimedWeapons = new Set();
  let minimumCrates = 0;
  for (const raw of rawMasteries) {
    const weaponKey = String(raw?.weaponKey || '');
    const masteryKey = String(raw?.masteryKey || '');
    const blueprint = BLUEPRINT_BY_MASTERY.get(`${weaponKey}:${masteryKey}`);
    if (!blueprint || claimedWeapons.has(weaponKey)) return { error: 'Invalid mastery unlock data.' };
    claimedWeapons.add(weaponKey);
    claims.push(blueprint.id);
    minimumCrates += weaponKey === 'blaster' ? 4 : 5;
  }

  if (claims.length) {
    if (!ARMORY_UNLOCK_VERSIONS.has(String(run?.game_version || ''))) return { error: 'This build cannot unlock Armory blueprints.' };
    if (durationMs < claims.length * 110_000 || wardens < claims.length || crates < minimumCrates) return { error: 'Mastery unlock could not be verified.' };
  }

  const qualified = durationMs >= 60_000 && enemies >= 10;
  const xp = qualified ? Math.min(250,
    Math.min(60, Math.floor(durationSeconds / 30) * 5)
    + Math.min(60, Math.floor(enemies / 10) * 4)
    + Math.min(50, Math.max(0, zone - 1) * 10)
    + Math.min(120, wardens * 30)
  ) : 0;
  return { xp, blueprintIds: claims };
};

const bearerToken = request => {
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(request.headers.get('Authorization') || '');
  return match && match[1].length <= 4096 ? match[1] : '';
};

export const secureServerInt = maximum => {
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 0x1_0000_0000) throw new RangeError('Invalid secure random range.');
  const limit = Math.floor(0x1_0000_0000 / maximum) * maximum;
  const values = new Uint32Array(1);
  do { crypto.getRandomValues(values); } while (values[0] >= limit);
  return values[0] % maximum;
};

const authenticatePlayer = async (request, config) => {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    const user = await authFetch(config, 'user', { headers: { Authorization: `Bearer ${token}` } });
    return UUID_PATTERN.test(String(user.id || '')) ? user : null;
  } catch { return null; }
};

const sessionPayload = payload => {
  const expiresIn = normalizeInt(payload.expires_in, 1, 604800) || 3600;
  return {
    accessToken: String(payload.access_token || ''),
    refreshToken: String(payload.refresh_token || ''),
    expiresIn,
    expiresAt: normalizeInt(payload.expires_at, 1, Number.MAX_SAFE_INTEGER) || Math.floor(Date.now() / 1000) + expiresIn,
    player: {
      id: String(payload.user?.id || ''),
      anonymous: Boolean(payload.user?.is_anonymous ?? true),
      email: String(payload.user?.email || ''),
    },
  };
};

const createAnonymousSession = async (request, config) => {
  if (!config.publishableKey) throw new Error('PLAYER_ACCOUNTS_NOT_CONFIGURED');
  const ipHash = await hashIp(request, config.salt);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const query = new URLSearchParams({ select: 'id', ip_hash: `eq.${ipHash}`, created_at: `gte.${since}`, limit: String(AUTH_BOOTSTRAP_LIMIT + 1) });
  const recent = await supabaseFetch(config, `auth_bootstrap_events?${query}`);
  if (recent.length >= AUTH_BOOTSTRAP_LIMIT) {
    const error = new Error('AUTH_BOOTSTRAP_LIMIT');
    error.status = 429;
    throw error;
  }
  const payload = await authFetch(config, 'signup', { method: 'POST', body: '{}' });
  const session = sessionPayload(payload);
  if (!UUID_PATTERN.test(session.player.id) || !session.accessToken || !session.refreshToken) throw new Error('AUTH_SESSION_INVALID');
  await supabaseFetch(config, 'auth_bootstrap_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ip_hash: ipHash }) });
  return session;
};

const beginAnonymousSession = async (request, config) => {
  try { return json(await createAnonymousSession(request, config), 201); }
  catch (error) {
    if (error.message === 'PLAYER_ACCOUNTS_NOT_CONFIGURED') return json({ error: 'Player accounts are not configured yet.' }, 503);
    if (error.status === 429) return json({ error: 'Too many player accounts created. Try again later.' }, 429);
    throw error;
  }
};

const refreshPlayerSession = async (request, config) => {
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid session request.' }, 400); }
  const refreshToken = String(body.refreshToken || '');
  if (!refreshToken || refreshToken.length > 4096) return json({ error: 'Invalid session.' }, 400);
  try {
    const payload = await authFetch(config, 'token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) });
    return json(sessionPayload(payload));
  } catch { return json({ error: 'Player session expired.' }, 401); }
};

const logoutPlayer = async (request, config) => {
  const token = bearerToken(request);
  if (!token) return json({ error: 'Player session required.' }, 401);
  try {
    await authFetch(config, 'logout?scope=local', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: '{}',
    });
    return json({ status: 'signed_out', scope: 'local' });
  } catch (error) {
    if (error.status === 401 || error.status === 403) return json({ status: 'signed_out', scope: 'local' });
    throw error;
  }
};

const ensureWallet = async (config, userId) => {
  await supabaseFetch(config, 'player_wallets?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userId }),
  });
};

const walletSnapshot = async (config, userId) => {
  await ensureWallet(config, userId);
  const walletQuery = new URLSearchParams({ select: 'balance,opens,since_sovereign,free_crate_credits,equipped_ship,equipped_weapon_skins,legacy_imported_at,updated_at', user_id: `eq.${userId}`, limit: '1' });
  const inventoryQuery = new URLSearchParams({ select: 'cosmetic_id,source,acquired_at,seen_at,market_listing_id', user_id: `eq.${userId}`, market_listing_id: 'is.null', order: 'acquired_at.asc' });
  const [wallets, inventory] = await Promise.all([
    supabaseFetch(config, `player_wallets?${walletQuery}`),
    supabaseFetch(config, `player_inventory?${inventoryQuery}`),
  ]);
  if (!wallets.length) throw new Error('WALLET_NOT_FOUND');
  const wallet = wallets[0];
  return {
    balance: wallet.balance,
    opens: wallet.opens,
    sinceSovereign: wallet.since_sovereign,
    freeCrateCredits: Number(wallet.free_crate_credits) || 0,
    equippedShip: wallet.equipped_ship,
    equippedWeapons: wallet.equipped_weapon_skins || {},
    legacyImported: Boolean(wallet.legacy_imported_at),
    updatedAt: wallet.updated_at,
    inventory: inventory.map(item => ({ cosmeticId: item.cosmetic_id, source: item.source, acquiredAt: item.acquired_at, seenAt: item.seen_at || null })),
  };
};

const storeCatalogSnapshot = async config => {
  const now = new Date().toISOString();
  const query = new URLSearchParams({
    select: 'sku,product_type,cosmetic_id,name,description,price,rarity,sort_order,available_from,available_until',
    active: 'eq.true',
    order: 'sort_order.asc',
  });
  const rows = await supabaseFetch(config, `store_catalog?${query}`);
  return rows
    .filter(row => (!row.available_from || row.available_from <= now) && (!row.available_until || row.available_until > now))
    .map(row => ({
      sku: String(row.sku || ''),
      type: String(row.product_type || ''),
      cosmeticId: row.cosmetic_id ? String(row.cosmetic_id) : null,
      name: String(row.name || ''),
      description: String(row.description || ''),
      price: Number(row.price) || 0,
      rarity: String(row.rarity || 'standard'),
      sortOrder: Number(row.sort_order) || 0,
    }));
};

export const armoryTrialWindow = (catalog, now = Date.now()) => {
  const trials = [...catalog].filter(item => item.trialEligible).sort((a, b) => a.sortOrder - b.sortOrder);
  if (!trials.length) return null;
  const dayMs = 86_400_000;
  const week = Math.floor((Math.floor(now / dayMs) + 3) / 7);
  const startsAt = (week * 7 - 3) * dayMs;
  const index = ((week % trials.length) + trials.length) % trials.length;
  return {
    blueprintId: trials[index].id,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(startsAt + 7 * dayMs).toISOString(),
  };
};

const armorySnapshot = async (config, userId) => {
  await supabaseFetch(config, 'rpc/ensure_player_armory', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: userId }),
  });
  const progressionQuery = new URLSearchParams({ select: 'arsenal_xp,arsenal_rank,selected_blueprint_id,backfilled_at,updated_at', user_id: `eq.${userId}`, limit: '1' });
  const unlockQuery = new URLSearchParams({ select: 'blueprint_id,source,unlocked_run_id,unlocked_at', user_id: `eq.${userId}`, order: 'unlocked_at.asc' });
  const catalogQuery = new URLSearchParams({ select: 'id,weapon_key,mastery_key,name,role,description,sort_order,trial_eligible,active', active: 'eq.true', order: 'sort_order.asc' });
  const [progressions, unlocks, rows] = await Promise.all([
    supabaseFetch(config, `player_progression?${progressionQuery}`),
    supabaseFetch(config, `player_weapon_blueprints?${unlockQuery}`),
    supabaseFetch(config, `weapon_blueprint_catalog?${catalogQuery}`),
  ]);
  if (!progressions.length) throw new Error('ARMORY_NOT_FOUND');
  const progression = progressions[0];
  const catalog = rows.map(row => ({
    id: String(row.id), weaponKey: String(row.weapon_key), masteryKey: String(row.mastery_key || ''),
    name: String(row.name), role: String(row.role), description: String(row.description || ''), sortOrder: Number(row.sort_order) || 0,
    trialEligible: Boolean(row.trial_eligible),
  }));
  const unlockedById = new Map(unlocks.map(item => [String(item.blueprint_id), item]));
  const trial = armoryTrialWindow(catalog);
  const accessible = new Set([STANDARD_BLUEPRINT_ID, ...unlockedById.keys(), trial?.blueprintId].filter(Boolean));
  const selectedBlueprintId = accessible.has(String(progression.selected_blueprint_id || ''))
    ? String(progression.selected_blueprint_id)
    : STANDARD_BLUEPRINT_ID;
  const rank = Math.max(0, Math.min(10, Number(progression.arsenal_rank) || 0));
  return {
    progression: {
      xp: Math.max(0, Number(progression.arsenal_xp) || 0),
      rank,
      damageBonus: rank * 0.02,
      nextRankXp: rank < 10 ? ARSENAL_RANK_THRESHOLDS[rank + 1] : null,
      selectedBlueprintId,
      backfilled: Boolean(progression.backfilled_at),
      updatedAt: progression.updated_at,
    },
    standardBlueprintId: STANDARD_BLUEPRINT_ID,
    trial,
    blueprints: catalog.map(item => {
      const unlock = unlockedById.get(item.id);
      const access = item.id === STANDARD_BLUEPRINT_ID ? 'standard' : unlock ? 'unlocked' : item.id === trial?.blueprintId ? 'trial' : 'locked';
      return {
        ...item,
        access,
        unlockedAt: unlock?.unlocked_at || null,
        unlockedRunId: unlock?.unlocked_run_id || null,
      };
    }),
  };
};

export const validateLegacyWallet = body => {
  const balance = normalizeInt(body?.balance, 0, LEGACY_BALANCE_CAP);
  const opens = normalizeInt(body?.opens, 0, 100_000);
  const sinceSovereign = normalizeInt(body?.sinceSovereign, 0, 199);
  const cosmetics = Array.isArray(body?.cosmetics) ? [...new Set(body.cosmetics.map(String))] : [];
  const equippedShip = String(body?.equippedShip || 'ship_default');
  if ([balance, opens, sinceSovereign].some(value => value === null)) return { error: 'Invalid legacy wallet.' };
  if (cosmetics.length > COSMETIC_IDS.size || cosmetics.some(id => !COSMETIC_IDS.has(id))) return { error: 'Invalid legacy inventory.' };
  if (equippedShip !== 'ship_default' && !cosmetics.includes(equippedShip)) return { error: 'Invalid equipped cosmetic.' };
  return { value: { balance, opens, sinceSovereign, cosmetics, equippedShip } };
};

const getPlayerWallet = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  return json({ player: { id: user.id, anonymous: Boolean(user.is_anonymous), email: String(user.email || '') }, wallet: await walletSnapshot(config, user.id) });
};

const accountCredentials = async request => {
  let body;
  try { body = await readJson(request); } catch { return { error: 'Invalid account request.' }; }
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return { error: 'Enter a valid email address.' };
  return { email, password };
};

const linkPlayerEmail = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  if (!user.is_anonymous) return json({ error: 'This player account is already secured.' }, 409);
  const credentials = await accountCredentials(request);
  if (credentials.error) return json({ error: credentials.error }, 422);
  const redirect = new URL('/?account=verified', request.url);
  try {
    await authFetch(config, `user?redirect_to=${encodeURIComponent(redirect.href)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${bearerToken(request)}` },
      body: JSON.stringify({ email: credentials.email }),
    });
    return json({ status: 'verification_sent', email: credentials.email }, 202);
  } catch (error) {
    if (error.status === 422 || error.status === 400) return json({ error: 'That email cannot be linked. Sign in if it already has an account.' }, 409);
    if (error.status === 429) return json({ error: 'Please wait before requesting another verification email.' }, 429);
    throw error;
  }
};

const confirmPlayerEmail = async (request, config) => {
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid verification link.' }, 400); }
  const tokenHash = String(body.tokenHash || '');
  const type = String(body.type || '');
  if (!/^[A-Za-z0-9_-]{20,512}$/.test(tokenHash) || !new Set(['email', 'email_change', 'recovery']).has(type)) {
    return json({ error: 'Invalid verification link.' }, 400);
  }
  try {
    const payload = await authFetch(config, 'verify', {
      method: 'POST',
      body: JSON.stringify({ token_hash: tokenHash, type }),
    });
    const session = sessionPayload(payload);
    if (!UUID_PATTERN.test(session.player.id) || session.player.anonymous || !session.player.email || !session.accessToken || !session.refreshToken) {
      throw new Error('AUTH_SESSION_INVALID');
    }
    return json(session);
  } catch (error) {
    if ([400, 401, 403, 422].includes(error.status) || error.message === 'AUTH_SESSION_INVALID') {
      return json({ error: 'This verification link is invalid or has expired.' }, 400);
    }
    throw error;
  }
};

const accountPage = ({ title, eyebrow, message, body, status = 200, cookie = '', script = '' }) => {
  const nonce = script ? crypto.randomUUID().replace(/-/g, '') : '';
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#03090d"><title>Crown Lizard · Secure Account</title><style>
@font-face{font-family:PressStart;src:url('/assets/fonts/PressStart2P-Regular.ttf')}@font-face{font-family:Silkscreen;src:url('/assets/fonts/Silkscreen-Bold.ttf')}*{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:22px;background:#03090d;color:#e8fff8;font-family:Silkscreen,monospace;text-align:center}.panel{width:min(440px,100%);border-block:3px solid #6fffd2;background:#071a1d;padding:30px 22px;box-shadow:8px 8px 0 #010405}.crown{color:#ffd36b;font-size:42px;line-height:1;text-shadow:3px 3px 0 #7d4318}.brand{margin:10px 0 4px;color:#ffd36b;font-family:PressStart,monospace;font-size:14px;letter-spacing:1px}.eyebrow{margin:18px 0 8px;color:#77a69a;font-size:10px;letter-spacing:2px}h1{margin:0 0 14px;font:400 20px/1.45 PressStart,monospace;letter-spacing:0}p{margin:0 auto 24px;max-width:350px;color:#b8d8d0;font-size:12px;line-height:1.55}.field{display:block;margin:0 0 17px;text-align:left}.field span{display:block;margin:0 0 7px;color:#8cc8b9;font-size:10px;letter-spacing:2px}.field input{width:100%;min-height:52px;border:2px solid #377f72;border-radius:0;background:#02090c;color:#fff;padding:10px 12px;font:700 16px Silkscreen,monospace;outline:0}.field input:focus{border-color:#ffd36b;box-shadow:0 0 0 2px #8f541c}.button{display:grid;place-items:center;width:100%;min-height:58px;border:0;background:transparent;color:#e8fff8;text-decoration:none;font:400 11px/1.7 PressStart,monospace;letter-spacing:1px;text-shadow:2px 2px #164b41;cursor:pointer}.button:hover,.button:focus{color:#ffd36b;outline:0}.button:active{transform:translateY(2px)}.error{margin:-5px 0 18px;color:#ff8c83;font-size:12px;line-height:1.5}.note{margin:18px 0 0;color:#77958d;font-size:9px;letter-spacing:1px}</style></head><body><main class="panel"><div class="crown">♛</div><div class="brand">CROWN LIZARD</div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${message}</p>${body}<div class="note">CROWNLIZARD.COM · SECURE CONNECTION</div></main>${script ? `<script nonce="${nonce}">${script}</script>` : ''}</body></html>`, {
  status,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; ${script ? `script-src 'nonce-${nonce}';` : ''} form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
    ...(cookie ? { 'Set-Cookie': cookie } : {}),
  },
  });
};

const sessionReadyPage = (session, cookie, flow = 'password') => {
  const safeSession = JSON.stringify(session)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const script = `(()=>{try{const session=${safeSession};session.expiresIn=Number(session.expiresIn)||3600;session.expiresAt=Number(session.expiresAt)||Math.floor(Date.now()/1000)+session.expiresIn;localStorage.setItem('cl:player-session:v1',JSON.stringify(session));localStorage.setItem('cl:account-password:v1','done')}catch{}})();`;
  const login = flow === 'login';
  return accountPage({ title: login ? 'SIGNED IN' : 'PASSWORD SAVED', eyebrow: login ? 'VAULT RESTORED' : 'ACCOUNT READY', message: login ? 'Your Crown account is active on this device.' : 'Your password is saved and your Crown account is ready.', body: '<a class="button" href="/">♛ ENTER CROWN LIZARD</a>', cookie, script });
};

const passwordSetupForm = error => `<form method="post" action="/api/player/account/password/complete"><label class="field"><span>NEW PASSWORD</span><input name="password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required autofocus></label><label class="field"><span>CONFIRM PASSWORD</span><input name="confirm_password" type="password" minlength="10" maxlength="128" autocomplete="new-password" required></label>${error ? `<div class="error" role="alert">${error}</div>` : ''}<button class="button" type="submit">♛ SAVE PASSWORD</button></form>`;

const accountCookies = request => Object.fromEntries(String(request.headers.get('Cookie') || '').split(';').map(part => {
  const separator = part.indexOf('=');
  return separator < 0 ? ['', ''] : [part.slice(0, separator).trim(), part.slice(separator + 1)];
}).filter(([key]) => key));

const playerAccountCallback = async (request, config) => {
  const url = new URL(request.url);
  let tokenHash = String(url.searchParams.get('token_hash') || '');
  let type = String(url.searchParams.get('type') || '');
  if (request.method === 'POST') {
    try {
      const form = await request.formData();
      tokenHash = String(form.get('token_hash') || '');
      type = String(form.get('type') || '');
    } catch {
      tokenHash = '';
      type = '';
    }
  }
  if (!/^[A-Za-z0-9_-]{20,512}$/.test(tokenHash) || !new Set(['email', 'email_change', 'recovery']).has(type)) {
    return accountPage({ title: 'LINK EXPIRED', eyebrow: 'SECURE ACCOUNT LINK', message: 'This account link is invalid or has expired. Request a new recovery link from the game.', body: '<a class="button" href="/">BACK TO CROWN LIZARD</a>', status: 400 });
  }
  if (request.method === 'GET') {
    const action = new URL('/api/player/account/callback', url.origin).pathname;
    return accountPage({ title: 'LINK READY', eyebrow: 'SECURE ACCOUNT LINK', message: 'Continue to open the protected password screen. This one-time link is only used after you press the button.', body: `<form method="post" action="${action}"><input type="hidden" name="token_hash" value="${tokenHash}"><input type="hidden" name="type" value="${type}"><button class="button" type="submit">♛ CONTINUE TO CREATE PASSWORD</button></form>` });
  }
  try {
    const payload = await authFetch(config, 'verify', {
      method: 'POST',
      body: JSON.stringify({ token_hash: tokenHash, type }),
    });
    const session = sessionPayload(payload);
    if (!UUID_PATTERN.test(session.player.id) || session.player.anonymous || !session.player.email || !session.refreshToken) throw new Error('AUTH_SESSION_INVALID');
    const cookie = `__Secure-cl_password_setup=${encodeURIComponent(session.refreshToken)}; Max-Age=600; Path=/api/player/account/password/complete; HttpOnly; Secure; SameSite=Strict`;
    return accountPage({ title: 'CREATE PASSWORD', eyebrow: 'SECURE VAULT SETUP', message: 'Choose at least 10 characters. Your password is sent directly to the protected account service.', body: passwordSetupForm(''), cookie });
  } catch (error) {
    if ([400, 401, 403, 422].includes(error.status) || error.message === 'AUTH_SESSION_INVALID') {
      return accountPage({ title: 'LINK EXPIRED', eyebrow: 'SECURE ACCOUNT LINK', message: 'This account link is invalid or has already been used. Request a new recovery link from the game.', body: '<a class="button" href="/">BACK TO CROWN LIZARD</a>', status: 400 });
    }
    throw error;
  }
};

const completeCallbackPassword = async (request, config) => {
  const cookies = accountCookies(request);
  let refreshToken = '';
  try { refreshToken = decodeURIComponent(String(cookies['__Secure-cl_password_setup'] || '')); } catch {}
  const clearCookie = '__Secure-cl_password_setup=; Max-Age=0; Path=/api/player/account/password/complete; HttpOnly; Secure; SameSite=Strict';
  if (!refreshToken || refreshToken.length > 4096) {
    return accountPage({ title: 'SETUP EXPIRED', eyebrow: 'SECURE VAULT SETUP', message: 'The protected setup session has expired. Request a new recovery link from the game.', body: '<a class="button" href="/">BACK TO CROWN LIZARD</a>', status: 401, cookie: clearCookie });
  }
  let password = '';
  let confirmPassword = '';
  try {
    const form = await request.formData();
    password = String(form.get('password') || '');
    confirmPassword = String(form.get('confirm_password') || '');
  } catch {}
  if (password.length < 10 || password.length > 128) {
    return accountPage({ title: 'CREATE PASSWORD', eyebrow: 'SECURE VAULT SETUP', message: 'Choose at least 10 characters. Your password is sent directly to the protected account service.', body: passwordSetupForm('USE AT LEAST 10 CHARACTERS.') });
  }
  if (password !== confirmPassword) {
    return accountPage({ title: 'CREATE PASSWORD', eyebrow: 'SECURE VAULT SETUP', message: 'Choose at least 10 characters. Your password is sent directly to the protected account service.', body: passwordSetupForm('THE PASSWORDS DO NOT MATCH.') });
  }
  try {
    const payload = await authFetch(config, 'token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const session = sessionPayload(payload);
    if (!UUID_PATTERN.test(session.player.id) || session.player.anonymous || !session.player.email || !session.accessToken) throw new Error('AUTH_SESSION_INVALID');
    await authFetch(config, 'user', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ password }),
    });
    try {
      const loginPayload = await authFetch(config, 'token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email: session.player.email, password }),
      });
      const loginSession = sessionPayload(loginPayload);
      if (!UUID_PATTERN.test(loginSession.player.id) || !loginSession.accessToken || !loginSession.refreshToken) throw new Error('AUTH_SESSION_INVALID');
      return sessionReadyPage(loginSession, clearCookie);
    } catch {
      return accountPage({ title: 'PASSWORD SAVED', eyebrow: 'VAULT SECURED', message: 'Your password is saved. Return to the game and use SIGN IN to restore your Vault.', body: '<a class="button" href="/?account=sign-in">♛ OPEN SIGN IN</a>', cookie: clearCookie });
    }
  } catch (error) {
    if ([400, 401, 403, 422].includes(error.status) || error.message === 'AUTH_SESSION_INVALID') {
      return accountPage({ title: 'SETUP EXPIRED', eyebrow: 'SECURE VAULT SETUP', message: 'The protected setup session has expired. Request a new recovery link from the game.', body: '<a class="button" href="/">BACK TO CROWN LIZARD</a>', status: 401, cookie: clearCookie });
    }
    throw error;
  }
};

const requestPasswordRecovery = async (request, config) => {
  const credentials = await accountCredentials(request);
  if (credentials.error) return json({ error: credentials.error }, 422);
  const redirect = new URL('/?account=recovery', request.url);
  try {
    await authFetch(config, `recover?redirect_to=${encodeURIComponent(redirect.href)}`, {
      method: 'POST',
      body: JSON.stringify({ email: credentials.email }),
    });
  } catch (error) {
    if (error.status === 429) return json({ error: 'Please wait before requesting another recovery email.' }, 429);
    if (error.status !== 400 && error.status !== 422) throw error;
  }
  return json({ status: 'recovery_requested' }, 202);
};

const setPlayerPassword = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  if (user.is_anonymous || !user.email) return json({ error: 'Verify your email before creating a password.' }, 409);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid account request.' }, 400); }
  const password = String(body.password || '');
  if (password.length < 10 || password.length > 128) return json({ error: 'Use at least 10 characters for your password.' }, 422);
  try {
    const updated = await authFetch(config, 'user', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${bearerToken(request)}` },
      body: JSON.stringify({ password }),
    });
    return json({ player: { id: user.id, anonymous: false, email: String(updated.email || user.email) } });
  } catch (error) {
    if (error.status === 422 || error.status === 400) return json({ error: 'That password could not be saved.' }, 422);
    throw error;
  }
};

const loginPlayer = async (request, config) => {
  const credentials = await accountCredentials(request);
  if (credentials.error || credentials.password.length < 1 || credentials.password.length > 128) return json({ error: 'Email or password is incorrect.' }, 401);
  try {
    const payload = await authFetch(config, 'token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email: credentials.email, password: credentials.password }),
    });
    const session = sessionPayload(payload);
    if (!UUID_PATTERN.test(session.player.id) || session.player.anonymous || !session.accessToken || !session.refreshToken) throw new Error('AUTH_SESSION_INVALID');
    return json({ contract: 'player-session-v1', session, wallet: await walletSnapshot(config, session.player.id) });
  } catch (error) {
    if (error.status === 400 || error.status === 401 || error.message === 'AUTH_SESSION_INVALID') return json({ error: 'Email or password is incorrect.' }, 401);
    if (error.status === 429) return json({ error: 'Too many sign-in attempts. Try again later.' }, 429);
    throw error;
  }
};

const completePlayerLoginPage = async (request, config) => {
  let email = '';
  let password = '';
  try {
    const form = await request.formData();
    email = String(form.get('email') || '').trim().toLowerCase();
    password = String(form.get('password') || '');
  } catch {}
  if (!EMAIL_PATTERN.test(email) || email.length > 254 || password.length < 1 || password.length > 128) {
    return accountPage({ title: 'SIGN IN FAILED', eyebrow: 'CROWN ACCOUNT', message: 'The email or password is incorrect.', body: '<a class="button" href="/?account=sign-in">TRY AGAIN</a>', status: 401 });
  }
  try {
    const payload = await authFetch(config, 'token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const session = sessionPayload(payload);
    if (!UUID_PATTERN.test(session.player.id) || session.player.anonymous || !session.accessToken || !session.refreshToken) throw new Error('AUTH_SESSION_INVALID');
    return sessionReadyPage(session, '', 'login');
  } catch (error) {
    if ([400, 401, 403, 422].includes(error.status) || error.message === 'AUTH_SESSION_INVALID') {
      return accountPage({ title: 'SIGN IN FAILED', eyebrow: 'CROWN ACCOUNT', message: 'The email or password is incorrect.', body: '<a class="button" href="/?account=sign-in">TRY AGAIN</a>', status: 401 });
    }
    throw error;
  }
};

const bootstrapPlayerWallet = async (request, config) => {
  try {
    const session = await createAnonymousSession(request, config);
    return json({ ...session, wallet: await walletSnapshot(config, session.player.id) }, 201);
  } catch (error) {
    if (error.message === 'PLAYER_ACCOUNTS_NOT_CONFIGURED') return json({ error: 'Player accounts are not configured yet.' }, 503);
    if (error.status === 429) return json({ error: 'Too many player accounts created. Try again later.' }, 429);
    throw error;
  }
};

const importLegacyWallet = async (request, config, env) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  const deadline = Date.parse(String(env.ECONOMY_MIGRATION_DEADLINE || ''));
  if (!Number.isFinite(deadline) || Date.now() > deadline) return json({ error: 'Legacy migration is closed.' }, 403);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid migration request.' }, 400); }
  const validation = validateLegacyWallet(body);
  if (validation.error) return json({ error: validation.error }, 422);
  await ensureWallet(config, user.id);
  const value = validation.value;
  const imported = await supabaseFetch(config, 'rpc/import_legacy_wallet', {
    method: 'POST',
    body: JSON.stringify({
      p_user_id: user.id,
      p_balance: value.balance,
      p_opens: value.opens,
      p_since_sovereign: value.sinceSovereign,
      p_equipped_ship: value.equippedShip,
      p_cosmetic_ids: value.cosmetics,
    }),
  });
  if (imported !== true) return json({ error: 'This wallet was already migrated.' }, 409);
  return json({ player: { id: user.id, anonymous: Boolean(user.is_anonymous) }, wallet: await walletSnapshot(config, user.id) }, 201);
};

export const validateScorePayload = (body, run, now = Date.now(), profile = null) => {
  const initials = String(body.initials || '').toUpperCase();
  const accountName = String(profile?.displayName || '').toUpperCase();
  const accountRun = Boolean(run.user_id);
  const score = normalizeInt(body.score, 1, 1_000_000_000);
  const durationMs = normalizeInt(body.durationMs, 3000, 86_400_000);
  const zone = normalizeInt(body.zone, 1, 999);
  const wardens = normalizeInt(body.wardens, 0, 999);
  const enemies = normalizeInt(body.enemies, 0, 1_000_000);
  const crates = normalizeInt(body.crates, 0, 100_000);
  const bestCombo = normalizeInt(body.bestCombo, 1, 100_000);
  const difficulty = String(body.difficulty || '');
  const gameVersion = String(body.gameVersion || '');

  if (accountRun && !/^[A-Z0-9][A-Z0-9_]{1,8}[A-Z0-9]$/.test(accountName)) return { error: 'Choose a callsign before submitting an account score.' };
  if (!accountRun && !/^[A-Z0-9]{3}$/.test(initials)) return { error: 'Enter exactly 3 initials using A-Z or 0-9.' };
  if (!DIFFICULTIES.has(difficulty) || difficulty !== run.difficulty) return { error: 'Invalid difficulty.' };
  if (!GAME_VERSION_PATTERN.test(gameVersion) || gameVersion !== run.game_version) return { error: 'Game version mismatch.' };
  if ([score, durationMs, zone, wardens, enemies, crates, bestCombo].some(value => value === null)) return { error: 'Invalid score data.' };
  if (run.used_at) return { error: 'This run was already submitted.' };

  const durationSeconds = durationMs / 1000;
  const elapsedSeconds = Math.max(0, (now - Date.parse(run.created_at)) / 1000);
  const expectedZone = Math.floor(durationSeconds / 120) + 1;
  const plausibleScore = 25_000 + durationSeconds * 12_000 + enemies * 20_000 + wardens * 200_000;
  if (durationSeconds > elapsedSeconds + 20) return { error: 'Run timing could not be verified.' };
  if (zone > expectedZone + 1 || wardens > zone || crates > durationSeconds / 4 + 8 || enemies > durationSeconds * 8 + 80) return { error: 'Run statistics could not be verified.' };
  if (score > plausibleScore) return { error: 'Score is outside the verified range.' };

  return { value: { initials: accountRun ? null : initials, playerName: accountRun ? accountName : initials, userId: accountRun ? run.user_id : null, score, durationMs, zone, wardens, enemies, crates, bestCombo, difficulty, gameVersion } };
};

const listScores = async (config, difficulty, limit = 10) => {
  const query = new URLSearchParams({
    select: 'id,initials,player_name,user_id,score,difficulty,zone,wardens,created_at',
    difficulty: `eq.${difficulty}`,
    is_hidden: 'eq.false',
    order: 'score.desc,created_at.asc',
    limit: String(limit),
  });
  const rows = await supabaseFetch(config, `leaderboard_scores?${query}`);
  const userIds = [...new Set(rows.map(row => row.user_id).filter(Boolean))];
  let currentNames = new Map();
  if (userIds.length) {
    const profileQuery = new URLSearchParams({ select: 'user_id,display_name,public_id,is_public', user_id: `in.(${userIds.join(',')})` });
    const profiles = await supabaseFetch(config, `player_profiles?${profileQuery}`);
    currentNames = new Map(profiles.map(profile => [profile.user_id, profile]));
  }
  return rows.map(row => {
    const currentProfile = currentNames.get(row.user_id);
    const playerName = String(currentProfile?.display_name || row.player_name || row.initials || '---');
    return {
      id: row.id,
      playerName,
      initials: playerName,
      publicProfileId: currentProfile?.is_public && UUID_PATTERN.test(String(currentProfile.public_id || '')) ? String(currentProfile.public_id) : null,
      score: row.score,
      difficulty: row.difficulty,
      zone: row.zone,
      wardens: row.wardens,
      created_at: row.created_at,
    };
  });
};

const beginRun = async (request, config) => {
  let body;
  try { body = await readJson(request); } catch (error) { return json({ error: error.message === 'PAYLOAD_TOO_LARGE' ? 'Request too large.' : 'Invalid JSON.' }, 400); }
  const difficulty = String(body.difficulty || '');
  const gameVersion = String(body.gameVersion || '');
  if (!DIFFICULTIES.has(difficulty) || !GAME_VERSION_PATTERN.test(gameVersion) || !SUPPORTED_GAME_VERSIONS.has(gameVersion)) return json({ error: 'Invalid run request.' }, 400);

  const suppliedToken = bearerToken(request);
  const user = suppliedToken ? await authenticatePlayer(request, config) : null;
  if (suppliedToken && !user) return json({ error: 'Player session expired.' }, 401);
  const ipHash = await hashIp(request, config.salt);
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const rateQuery = new URLSearchParams({ select: 'id', ip_hash: `eq.${ipHash}`, created_at: `gte.${since}`, limit: '21' });
  const recent = await supabaseFetch(config, `leaderboard_runs?${rateQuery}`);
  if (recent.length >= 20) return json({ error: 'Too many runs started. Try again shortly.' }, 429);

  const rows = await supabaseFetch(config, 'leaderboard_runs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ difficulty, game_version: gameVersion, ip_hash: ipHash, user_id: user?.id || null }),
  });
  return json({ id: rows[0].id, startedAt: rows[0].created_at }, 201);
};

const settleRunReward = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid settlement request.' }, 400); }
  const runId = String(body.runId || '');
  if (!UUID_PATTERN.test(runId)) return json({ error: 'Invalid run.' }, 400);
  const runQuery = new URLSearchParams({ select: 'id,user_id,difficulty,game_version,created_at,economy_settled_at', id: `eq.${runId}`, limit: '1' });
  const runs = await supabaseFetch(config, `leaderboard_runs?${runQuery}`);
  if (!runs.length) return json({ error: 'Run not found.' }, 404);
  if (runs[0].user_id !== user.id) return json({ error: 'Run does not belong to this player.' }, 403);
  const validation = validateEconomySummary(body, runs[0]);
  if (validation.error) return json({ error: validation.error }, 422);
  const armoryValidation = validateArmorySummary(body, runs[0]);
  if (armoryValidation.error) return json({ error: armoryValidation.error }, 422);
  // Freeze the one-time historical backfill before this run becomes settled,
  // otherwise the current run could be counted once as history and once as XP.
  await supabaseFetch(config, 'rpc/ensure_player_armory', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: user.id }),
  });
  const rewardResult = await supabaseFetch(config, 'rpc/settle_run_reward', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: user.id, p_run_id: runId, p_amount: validation.reward.total, p_reward: validation.reward }),
  });
  const progression = await supabaseFetch(config, 'rpc/settle_armory_progression', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: user.id, p_run_id: runId, p_xp: armoryValidation.xp, p_blueprint_ids: armoryValidation.blueprintIds }),
  });
  return json({ ...rewardResult, progression, armory: await armorySnapshot(config, user.id) }, rewardResult.duplicate && progression.duplicate ? 200 : 201);
};

const getCrownArmory = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  return json({ armory: await armorySnapshot(config, user.id) });
};

const selectCrownArmoryBlueprint = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid Armory request.' }, 400); }
  const blueprintId = String(body.blueprintId || '');
  if (!/^[a-z0-9_]{3,64}$/.test(blueprintId)) return json({ error: 'Invalid blueprint.' }, 400);
  const current = await armorySnapshot(config, user.id);
  const result = await supabaseFetch(config, 'rpc/select_armory_blueprint', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: user.id, p_blueprint_id: blueprintId, p_trial_blueprint_id: current.trial?.blueprintId || null }),
  });
  if (result.error === 'BLUEPRINT_LOCKED') return json({ error: 'This blueprint is locked.', code: result.error }, 403);
  if (result.error) return json({ error: 'Blueprint selection failed.', code: 'ARMORY_SELECTION_FAILED' }, 409);
  return json({ selectedBlueprintId: result.selectedBlueprintId, armory: await armorySnapshot(config, user.id) });
};

const bossEventRecord = async (config, eventId = '') => {
  const query = new URLSearchParams({
    select: 'id,slug,name,status,starts_at,ends_at,max_hp,current_hp,trial_blueprint_id,balance_version,config',
    order: 'starts_at.desc', limit: '1',
  });
  if (eventId) query.set('id', `eq.${eventId}`);
  else {
    query.set('status', 'in.(active,victory,failed)');
    query.set('starts_at', `lte.${new Date().toISOString()}`);
  }
  let rows = await supabaseFetch(config, `boss_events?${query}`);
  if (rows[0]?.status === 'active' && (Number(rows[0].current_hp) <= 0 || Date.parse(rows[0].ends_at) <= Date.now())) {
    await supabaseFetch(config, 'rpc/refresh_boss_event_state', {
      method: 'POST', body: JSON.stringify({ p_event_id: rows[0].id }),
    });
    rows = await supabaseFetch(config, `boss_events?${query}`);
  }
  return rows[0] || null;
};

const ensureBossEventSchedule = config => supabaseFetch(config, 'rpc/ensure_boss_event_schedule', {
  method: 'POST', body: '{}',
});

const nextBossEventRecord = async config => {
  const query = new URLSearchParams({
    select: 'id,slug,name,status,starts_at,ends_at,max_hp,current_hp,trial_blueprint_id,balance_version,config',
    status: 'eq.scheduled', starts_at: `gt.${new Date().toISOString()}`, order: 'starts_at.asc', limit: '1',
  });
  const rows = await supabaseFetch(config, `boss_events?${query}`);
  return rows[0] || null;
};

const publicBossEvent = row => row ? ({
  id: String(row.id), slug: String(row.slug), name: String(row.name), status: String(row.status),
  startsAt: row.starts_at, endsAt: row.ends_at, maxHp: Number(row.max_hp) || 0,
  currentHp: Number(row.current_hp) || 0, trialBlueprintId: String(row.trial_blueprint_id || ''),
  balanceVersion: Number(row.balance_version) || 1,
}) : null;

const bossLeaderboard = async (config, eventId, userId = null, limit = 10) => supabaseFetch(config, 'rpc/boss_event_leaderboard', {
  method: 'POST', body: JSON.stringify({ p_event_id: eventId, p_user_id: userId, p_limit: Math.max(1, Math.min(100, limit)) }),
});

const bossRewards = async (config, eventId, userId) => userId
  ? supabaseFetch(config, 'rpc/boss_reward_status', { method: 'POST', body: JSON.stringify({ p_user_id: userId, p_event_id: eventId }) })
  : { eventId, playerDamage: 0, qualified: false, rewards: [] };

const getBossEvent = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  await ensureBossEventSchedule(config);
  const event = await bossEventRecord(config);
  const nextEvent = await nextBossEventRecord(config);
  const serverTime = new Date().toISOString();
  if (!event) return json({ event: null, nextEvent: publicBossEvent(nextEvent), serverTime, ranking: { leaders: [], player: null }, rewards: { eventId: null, playerDamage: 0, qualified: false, rewards: [] } }, 200);
  const [ranking, rewards] = await Promise.all([
    bossLeaderboard(config, event.id, user?.id || null, 10),
    bossRewards(config, event.id, user?.id || null),
  ]);
  return json({ event: publicBossEvent(event), nextEvent: publicBossEvent(nextEvent), serverTime, ranking, rewards });
};

const getBossLeaderboard = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  const url = new URL(request.url);
  const eventId = String(url.searchParams.get('eventId') || '');
  const limit = normalizeInt(Number(url.searchParams.get('limit') || 10), 1, 100);
  if (!UUID_PATTERN.test(eventId) || limit === null) return json({ error: 'Invalid event ranking request.' }, 400);
  const event = await bossEventRecord(config, eventId);
  if (!event) return json({ error: 'Event not found.' }, 404);
  return json({ event: publicBossEvent(event), ranking: await bossLeaderboard(config, event.id, user?.id || null, limit) });
};

const claimBossRewardRequest = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid reward request.' }, 400); }
  const eventId = String(body.eventId || '');
  const rewardKey = String(body.rewardKey || '');
  const requestId = String(body.requestId || '');
  if (!UUID_PATTERN.test(eventId) || !UUID_PATTERN.test(requestId) || !/^[a-z0-9_]{3,64}$/.test(rewardKey)) {
    return json({ error: 'Invalid reward request.' }, 400);
  }
  const event = await bossEventRecord(config, eventId);
  if (!event) return json({ error: 'Event not found.', code: 'EVENT_NOT_FOUND' }, 404);
  const claim = await supabaseFetch(config, 'rpc/claim_boss_reward', {
    method: 'POST', body: JSON.stringify({ p_user_id: user.id, p_event_id: eventId, p_reward_key: rewardKey, p_request_id: requestId }),
  });
  const statuses = { REWARD_NOT_FOUND: 404, MILESTONE_LOCKED: 409, EVENT_REWARD_LOCKED: 409 };
  if (claim.error) return json({ error: 'This reward is not claimable yet.', code: claim.error }, statuses[claim.error] || 409);
  const [rewards, wallet] = await Promise.all([bossRewards(config, eventId, user.id), walletSnapshot(config, user.id)]);
  return json({ claim, rewards, wallet }, claim.duplicate ? 200 : 201);
};

const startBossAssaultRequest = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid assault request.' }, 400); }
  const eventId = String(body.eventId || '');
  const blueprintId = String(body.blueprintId || '');
  const gameVersion = String(body.gameVersion || '');
  if (!UUID_PATTERN.test(eventId) || !BOSS_PHASE_CEILINGS[blueprintId] || !SUPPORTED_GAME_VERSIONS.has(gameVersion)) {
    return json({ error: 'Invalid assault loadout.' }, 400);
  }
  await ensureBossEventSchedule(config);
  const event = await bossEventRecord(config, eventId);
  if (!event || event.status !== 'active' || Date.parse(event.ends_at) <= Date.now() || Number(event.current_hp) <= 0) {
    return json({ error: 'This event is not active.', code: 'EVENT_NOT_ACTIVE' }, 409);
  }
  const armory = await armorySnapshot(config, user.id);
  const selected = armory.blueprints.find(item => item.id === blueprintId);
  if (!selected || selected.access === 'locked' || armory.progression.selectedBlueprintId !== blueprintId) {
    return json({ error: 'Equip an available blueprint before starting.', code: 'BLUEPRINT_NOT_EQUIPPED' }, 409);
  }
  const ceilingScale = 1 + armory.progression.damageBonus;
  const phaseCeiling = BOSS_PHASE_CEILINGS[blueprintId].map(value => Math.round(value * ceilingScale));
  const assault = await supabaseFetch(config, 'rpc/start_boss_assault', {
    method: 'POST',
    body: JSON.stringify({
      p_user_id: user.id, p_event_id: eventId, p_blueprint_id: blueprintId,
      p_trial_blueprint_id: armory.trial?.blueprintId || null, p_seed: secureServerInt(2_147_483_647),
      p_game_version: gameVersion, p_phase_ceiling: phaseCeiling,
    }),
  });
  if (assault.error === 'BLUEPRINT_LOCKED') return json({ error: 'This blueprint is locked.', code: assault.error }, 403);
  if (assault.error) return json({ error: 'Assault signal is unavailable.', code: assault.error }, 409);
  return json({ assault, event: publicBossEvent(event), ranking: await bossLeaderboard(config, eventId, user.id, 10) }, assault.duplicate ? 200 : 201);
};

const settleBossAssaultRequest = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid boss settlement.' }, 400); }
  const validation = validateBossSettlementPayload(body);
  if (validation.error) return json({ error: validation.error }, 400);
  const value = validation.value;
  const settlement = await supabaseFetch(config, 'rpc/settle_boss_assault', {
    method: 'POST', body: JSON.stringify({
      p_user_id: user.id, p_assault_id: value.assaultId, p_request_id: value.requestId,
      p_elapsed_ms: value.elapsedMs, p_phase_damage: value.phaseDamage,
      p_outcome: value.outcome, p_targets_destroyed: value.targetsDestroyed,
    }),
  });
  const statuses = { ASSAULT_NOT_FOUND: 404, ASSAULT_OWNER_MISMATCH: 403, ASSAULT_EXPIRED: 409, ASSAULT_TIME_INVALID: 422 };
  if (settlement.error) return json({ error: 'Assault could not be verified.', code: settlement.error }, statuses[settlement.error] || 409);
  const event = await bossEventRecord(config, settlement.eventId);
  const ranking = await bossLeaderboard(config, settlement.eventId, user.id, 10);
  return json({ settlement, event: publicBossEvent(event), ranking, rewards: await bossRewards(config, settlement.eventId, user.id) }, settlement.duplicate ? 200 : 201);
};

const openCrownCrate = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid crate request.' }, 400); }
  const openingId = String(body.requestId || '');
  if (!UUID_PATTERN.test(openingId)) return json({ error: 'Invalid crate request.' }, 400);
  const result = await supabaseFetch(config, 'rpc/open_crown_crate', {
    method: 'POST',
    body: JSON.stringify({
      p_user_id: user.id,
      p_opening_id: openingId,
      p_tier_roll: secureServerInt(10_000),
      p_cosmetic_roll: secureServerInt(1_000_000),
    }),
  });
  if (result.error === 'NOT_ENOUGH_SHARDS') return json({ error: 'Not enough shards or free opens.', code: result.error, balance: result.balance, freeCrateCredits: result.freeCrateCredits || 0 }, 409);
  return json(result, result.duplicateRequest ? 200 : 201);
};

const requireCrownAdmin = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user || user.is_anonymous) return null;
  const admin = await supabaseFetch(config, 'rpc/is_crown_admin', {
    method: 'POST', body: JSON.stringify({ p_user_id: user.id }),
  });
  return admin === true ? user : null;
};

const adminPromoView = row => ({
  id: String(row.id), codeHint: String(row.code_hint), campaignName: String(row.campaign_name),
  rewardType: String(row.reward_type), rewardAmount: Number(row.reward_amount) || 0,
  startsAt: row.starts_at, expiresAt: row.expires_at,
  maxRedemptions: Number(row.max_redemptions) || 0, redeemedCount: Number(row.redeemed_count) || 0,
  status: String(row.status), note: String(row.note || ''), createdAt: row.created_at, updatedAt: row.updated_at,
});

const getAdminSession = async (request, config) => {
  const admin = await requireCrownAdmin(request, config);
  if (!admin) return json({ admin: false }, 403);
  return json({ admin: true, role: 'owner' });
};

const listAdminRewardCodes = async (request, config) => {
  const admin = await requireCrownAdmin(request, config);
  if (!admin) return json({ error: 'Admin access required.' }, 403);
  const query = new URLSearchParams({
    select: 'id,code_hint,campaign_name,reward_type,reward_amount,starts_at,expires_at,max_redemptions,redeemed_count,status,note,created_at,updated_at',
    order: 'created_at.desc', limit: '100',
  });
  const rows = await supabaseFetch(config, `promo_codes?${query}`);
  return json({ codes: rows.map(adminPromoView) });
};

const createAdminRewardCode = async (request, config) => {
  const admin = await requireCrownAdmin(request, config);
  if (!admin) return json({ error: 'Admin access required.' }, 403);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid campaign request.' }, 400); }
  const validation = validatePromoCreation(body);
  if (validation.error) return json({ error: validation.error }, 422);
  const value = validation.value;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = generateRewardCode();
    const codeHash = await sha256Hex(code);
    const codeHint = `CROWN-****-****-${code.slice(-4)}`;
    const promo = await supabaseFetch(config, 'rpc/create_reward_code', {
      method: 'POST',
      body: JSON.stringify({
        p_admin_user_id: admin.id, p_code_hash: codeHash, p_code_hint: codeHint,
        p_campaign_name: value.campaignName, p_reward_type: value.rewardType,
        p_reward_amount: value.rewardAmount, p_starts_at: value.startsAt,
        p_expires_at: value.expiresAt, p_max_redemptions: value.maxRedemptions, p_note: value.note,
      }),
    });
    if (promo.error === 'CODE_COLLISION') continue;
    if (promo.error) return json({ error: 'Campaign code could not be created.', code: promo.error }, promo.error === 'ADMIN_REQUIRED' ? 403 : 422);
    console.log(JSON.stringify({ event: 'admin_promo_created', adminUserId: admin.id, promoId: promo.id, rewardType: value.rewardType, maxRedemptions: value.maxRedemptions }));
    return json({ code, promo }, 201);
  }
  return json({ error: 'Secure code generation failed. Try again.' }, 503);
};

const setAdminRewardCodeStatus = async (request, config, codeId) => {
  const admin = await requireCrownAdmin(request, config);
  if (!admin) return json({ error: 'Admin access required.' }, 403);
  if (!UUID_PATTERN.test(codeId)) return json({ error: 'Invalid campaign.' }, 400);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid campaign request.' }, 400); }
  const status = String(body.status || '');
  if (!['active', 'paused', 'revoked'].includes(status)) return json({ error: 'Invalid campaign status.' }, 422);
  const result = await supabaseFetch(config, 'rpc/set_reward_code_status', {
    method: 'POST', body: JSON.stringify({ p_admin_user_id: admin.id, p_code_id: codeId, p_status: status }),
  });
  if (result.error === 'PROMO_NOT_FOUND') return json({ error: 'Campaign not found.' }, 404);
  if (result.error === 'PROMO_FINAL') return json({ error: 'A revoked or exhausted campaign cannot be changed.', code: result.error }, 409);
  if (result.error) return json({ error: 'Campaign status could not be changed.', code: result.error }, 409);
  console.log(JSON.stringify({ event: 'admin_promo_status_changed', adminUserId: admin.id, promoId: codeId, status }));
  return json({ promo: result });
};

const redeemPlayerRewardCode = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user || user.is_anonymous) return json({ error: 'Crown account required.', code: 'ACCOUNT_REQUIRED' }, 401);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Code could not be redeemed.', code: 'INVALID_CODE' }, 400); }
  const code = normalizeRewardCode(body.code);
  if (!code) return json({ error: 'Code could not be redeemed.', code: 'INVALID_CODE' }, 400);
  const result = await supabaseFetch(config, 'rpc/redeem_reward_code', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: user.id, p_code_hash: await sha256Hex(code), p_ip_hash: await hashIp(request, config.salt) }),
  });
  if (result.error === 'RATE_LIMITED') return json({ error: 'Too many attempts. Try again later.', code: result.error }, 429);
  if (result.error === 'ALREADY_REDEEMED') return json({ error: 'This code was already redeemed by this account.', code: result.error }, 409);
  if (result.error === 'ACCOUNT_REQUIRED') return json({ error: 'Crown account required.', code: result.error }, 401);
  if (result.error) return json({ error: 'Code could not be redeemed.', code: 'INVALID_CODE' }, 400);
  console.log(JSON.stringify({ event: 'promo_redeemed', userId: user.id, rewardType: result.rewardType, rewardAmount: result.rewardAmount }));
  return json({ redemption: result, wallet: await walletSnapshot(config, user.id) }, 201);
};

const marketView = snapshot => ({
  rules: snapshot?.rules || { feePercent: 10, maxActiveListings: 5, tradeableSource: 'crate', listingDays: 7 },
  listings: (snapshot?.listings || []).map(row => ({
    id: String(row.id || ''), cosmeticId: String(row.cosmetic_id || ''), price: Number(row.price) || 0,
    rarity: String(row.rarity || ''), slot: String(row.slot || ''), sellerName: String(row.seller_name || 'PILOT'),
    sellerPublicId: UUID_PATTERN.test(String(row.seller_public_id || '')) ? String(row.seller_public_id) : null,
    createdAt: row.created_at || null, expiresAt: row.expires_at || null,
  })),
  myListings: (snapshot?.myListings || []).map(row => ({
    id: String(row.id || ''), cosmeticId: String(row.cosmetic_id || ''), price: Number(row.price) || 0,
    status: String(row.status || ''), createdAt: row.created_at || null, expiresAt: row.expires_at || null,
    soldAt: row.sold_at || null, cancelledAt: row.cancelled_at || null, updatedAt: row.updated_at || null,
  })),
  activity: (snapshot?.activity || []).map(row => ({
    id: String(row.activity_id || ''), kind: String(row.kind || ''), cosmeticId: String(row.cosmetic_id || ''),
    amount: Number(row.amount) || 0, fee: Number(row.fee) || 0, occurredAt: row.occurred_at || null,
    counterparty: row.counterparty ? String(row.counterparty) : null,
  })),
  signals: (snapshot?.signals || []).map(row => ({
    id: String(row.id || ''), cosmeticId: String(row.cosmetic_id || ''), price: Number(row.price) || 0,
    fee: Number(row.fee) || 0, sellerPayout: Number(row.seller_payout) || 0,
    buyerName: String(row.buyer_name || 'PILOT'), createdAt: row.created_at || null,
  })),
});

const getCrownMarket = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  const snapshot = await supabaseFetch(config, 'rpc/market_snapshot', {
    method: 'POST', body: JSON.stringify({ p_user_id: user && !user.is_anonymous ? user.id : null, p_limit: 60 }),
  });
  return json({ market: marketView(snapshot), wallet: user ? await walletSnapshot(config, user.id) : null });
};

const createCrownMarketListing = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user || user.is_anonymous) return json({ error: 'Crown account required.', code: 'ACCOUNT_REQUIRED' }, 401);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid market listing.' }, 400); }
  const validation = validateMarketListing(body);
  if (validation.error) return json({ error: validation.error }, 400);
  const value = validation.value;
  const result = await supabaseFetch(config, 'rpc/create_market_listing', {
    method: 'POST', body: JSON.stringify({ p_user_id: user.id, p_cosmetic_id: value.cosmeticId, p_price: value.price, p_request_id: value.requestId }),
  });
  const statuses = { ACCOUNT_REQUIRED: 403, LISTING_LIMIT: 409, NOT_TRADEABLE: 422, PRICE_OUT_OF_RANGE: 422, ITEM_NOT_OWNED: 404, ALREADY_LISTED: 409, ITEM_EQUIPPED: 409 };
  if (result.error) return json({ error: 'Listing could not be created.', code: result.error, bounds: result.bounds }, statuses[result.error] || 409);
  console.log(JSON.stringify({ event: 'market_listing_created', userId: user.id, listingId: result.listingId, cosmeticId: value.cosmeticId, price: value.price }));
  const snapshot = await supabaseFetch(config, 'rpc/market_snapshot', { method: 'POST', body: JSON.stringify({ p_user_id: user.id, p_limit: 60 }) });
  return json({ listing: result, market: marketView(snapshot), wallet: await walletSnapshot(config, user.id) }, result.duplicateRequest ? 200 : 201);
};

const cancelCrownMarketListing = async (request, config, listingId) => {
  const user = await authenticatePlayer(request, config);
  if (!user || user.is_anonymous) return json({ error: 'Crown account required.', code: 'ACCOUNT_REQUIRED' }, 401);
  if (!UUID_PATTERN.test(listingId)) return json({ error: 'Invalid market listing.' }, 400);
  const result = await supabaseFetch(config, 'rpc/cancel_market_listing', { method: 'POST', body: JSON.stringify({ p_user_id: user.id, p_listing_id: listingId }) });
  const statuses = { LISTING_NOT_FOUND: 404, NOT_LISTING_OWNER: 403, LISTING_FINAL: 409 };
  if (result.error) return json({ error: 'Listing could not be cancelled.', code: result.error }, statuses[result.error] || 409);
  const snapshot = await supabaseFetch(config, 'rpc/market_snapshot', { method: 'POST', body: JSON.stringify({ p_user_id: user.id, p_limit: 60 }) });
  return json({ listing: result, market: marketView(snapshot), wallet: await walletSnapshot(config, user.id) });
};

const buyCrownMarketListing = async (request, config, listingId) => {
  const user = await authenticatePlayer(request, config);
  if (!user || user.is_anonymous) return json({ error: 'Crown account required.', code: 'ACCOUNT_REQUIRED' }, 401);
  if (!UUID_PATTERN.test(listingId)) return json({ error: 'Invalid market purchase.' }, 400);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid market purchase.' }, 400); }
  const requestId = String(body.requestId || '');
  if (!UUID_PATTERN.test(requestId)) return json({ error: 'Invalid market purchase.' }, 400);
  const result = await supabaseFetch(config, 'rpc/buy_market_listing', { method: 'POST', body: JSON.stringify({ p_user_id: user.id, p_listing_id: listingId, p_request_id: requestId }) });
  const statuses = { LISTING_NOT_FOUND: 404, LISTING_UNAVAILABLE: 409, SELF_PURCHASE: 409, NOT_ENOUGH_SHARDS: 409, ALREADY_OWNED: 409, ESCROW_MISSING: 409 };
  if (result.error) return json({ error: 'Market purchase failed.', code: result.error, balance: result.balance, cost: result.cost }, statuses[result.error] || 409);
  console.log(JSON.stringify({ event: 'market_listing_purchased', buyerId: user.id, listingId, saleId: result.saleId, price: result.price }));
  const snapshot = await supabaseFetch(config, 'rpc/market_snapshot', { method: 'POST', body: JSON.stringify({ p_user_id: user.id, p_limit: 60 }) });
  return json({ sale: result, market: marketView(snapshot), wallet: await walletSnapshot(config, user.id) }, result.duplicateRequest ? 200 : 201);
};

const acknowledgeCrownMarketSignals = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user || user.is_anonymous) return json({ error: 'Crown account required.', code: 'ACCOUNT_REQUIRED' }, 401);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid market signals.' }, 400); }
  const saleIds = [...new Set(Array.isArray(body.saleIds) ? body.saleIds.map(value => String(value || '')) : [])];
  if (!saleIds.length || saleIds.length > 10 || saleIds.some(id => !UUID_PATTERN.test(id))) return json({ error: 'Invalid market signals.' }, 400);
  const acknowledged = await supabaseFetch(config, 'rpc/acknowledge_market_signals', {
    method: 'POST', body: JSON.stringify({ p_user_id: user.id, p_sale_ids: saleIds }),
  });
  console.log(JSON.stringify({ event: 'market_signals_acknowledged', userId: user.id, count: Number(acknowledged) || 0 }));
  return json({ acknowledged: Number(acknowledged) || 0 });
};

const getCrownStore = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  const [products, wallet] = await Promise.all([
    storeCatalogSnapshot(config),
    walletSnapshot(config, user.id),
  ]);
  return json({ products, wallet });
};

const purchaseCrownStoreItem = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid store request.' }, 400); }
  const requestId = String(body.requestId || '');
  const sku = String(body.sku || '');
  if (!UUID_PATTERN.test(requestId) || !/^[a-z0-9_]{3,64}$/.test(sku)) return json({ error: 'Invalid store request.' }, 400);
  const result = await supabaseFetch(config, 'rpc/purchase_store_cosmetic', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: user.id, p_sku: sku, p_request_id: requestId }),
  });
  if (result.error === 'NOT_ENOUGH_SHARDS') return json({ error: 'Not enough shards.', code: result.error, balance: result.balance, cost: result.cost }, 409);
  if (result.error === 'ALREADY_OWNED') return json({ error: 'This item is already owned.', code: result.error, balance: result.balance, cosmeticId: result.cosmeticId }, 409);
  if (result.error === 'PRODUCT_UNAVAILABLE') return json({ error: 'This store item is unavailable.', code: result.error }, 404);
  if (result.error) return json({ error: 'Store purchase failed.', code: 'STORE_PURCHASE_FAILED' }, 409);
  return json({ ...result, wallet: await walletSnapshot(config, user.id) }, result.duplicateRequest ? 200 : 201);
};

const markPlayerInventorySeen = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid inventory request.' }, 400); }
  const cosmeticId = String(body.cosmeticId || '');
  if (!COSMETIC_IDS.has(cosmeticId)) return json({ error: 'Invalid cosmetic.' }, 400);
  const marked = await supabaseFetch(config, 'rpc/mark_inventory_seen', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: user.id, p_cosmetic_id: cosmeticId }),
  });
  if (marked !== true) return json({ error: 'This cosmetic is not owned.', code: 'COSMETIC_LOCKED' }, 404);
  return json({ marked: true, cosmeticId });
};

const equipPlayerCosmetic = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid equip request.' }, 400); }
  const cosmeticId = String(body.cosmeticId || '');
  const defaultIds = new Set(['ship_default', 'weapon_laser_default', 'weapon_tesla_default', 'weapon_pulse_default']);
  if (!defaultIds.has(cosmeticId) && !COSMETIC_IDS.has(cosmeticId)) return json({ error: 'Invalid cosmetic.' }, 400);
  const equipped = await supabaseFetch(config, 'rpc/equip_player_cosmetic', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: user.id, p_cosmetic_id: cosmeticId }),
  });
  if (equipped !== true) return json({ error: 'This cosmetic is not owned.', code: 'COSMETIC_LOCKED' }, 403);
  return json({ player: { id: user.id, anonymous: Boolean(user.is_anonymous) }, wallet: await walletSnapshot(config, user.id) });
};

const profileRules = () => ({
  minimumLength: 3,
  maximumLength: 10,
  allowedCharacters: 'A-Z 0-9 _',
  renameCost: CALLSIGN_RENAME_COST,
  renameCooldownDays: CALLSIGN_RENAME_COOLDOWN_DAYS,
});

const playerProfileSnapshot = async (config, userId) => {
  const query = new URLSearchParams({
    select: 'user_id,public_id,is_public,display_name,rename_count,last_renamed_at,created_at,updated_at',
    user_id: `eq.${userId}`,
    limit: '1',
  });
  const rows = await supabaseFetch(config, `player_profiles?${query}`);
  if (!rows.length) return null;
  const row = rows[0];
  return {
    userId: String(row.user_id || ''),
    publicId: UUID_PATTERN.test(String(row.public_id || '')) ? String(row.public_id) : null,
    isPublic: row.is_public !== false,
    displayName: String(row.display_name || ''),
    renameCount: Number(row.rename_count) || 0,
    lastRenamedAt: row.last_renamed_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
};

const getPublicPlayerProfile = async (config, publicId) => {
  if (!UUID_PATTERN.test(publicId)) return json({ error: 'Profile not found.' }, 404);
  const profile = await supabaseFetch(config, 'rpc/public_player_profile', {
    method: 'POST',
    body: JSON.stringify({ p_public_id: publicId }),
  });
  if (!profile?.publicId) return json({ error: 'Profile not found.' }, 404);
  return json({ profile }, 200, 'public, max-age=20, s-maxage=20');
};

const setPlayerProfileVisibility = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user || user.is_anonymous) return json({ error: 'Permanent player account required.' }, 401);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid profile request.' }, 400); }
  if (typeof body.isPublic !== 'boolean') return json({ error: 'Invalid profile visibility.' }, 422);
  const result = await supabaseFetch(config, 'rpc/set_player_profile_visibility', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: user.id, p_is_public: body.isPublic }),
  });
  if (result?.error === 'PROFILE_REQUIRED') return json({ error: 'Choose a callsign before changing profile visibility.', code: result.error }, 409);
  if (result?.error) return json({ error: 'Profile visibility could not be changed.' }, 503);
  return json({ profile: await playerProfileSnapshot(config, user.id) });
};

const getPlayerProfile = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  const permanent = !Boolean(user.is_anonymous);
  return json({
    eligible: permanent,
    profile: permanent ? await playerProfileSnapshot(config, user.id) : null,
    rules: profileRules(),
  });
};

const profileErrorResponse = result => {
  const code = String(result?.error || '');
  if (code === 'ACCOUNT_REQUIRED') return json({ error: 'Create an account before choosing a callsign.', code }, 403);
  if (code === 'INVALID_REQUEST') return json({ error: 'Invalid callsign request.', code }, 400);
  if (code === 'CALLSIGN_TAKEN') return json({ error: 'That callsign is already taken.', code }, 409);
  if (code === 'CALLSIGN_ALREADY_SET') return json({ error: 'This account already has a callsign.', code }, 409);
  if (code === 'PROFILE_REQUIRED') return json({ error: 'Choose your first callsign before renaming it.', code }, 409);
  if (code === 'NOT_ENOUGH_SHARDS') return json({ error: 'Not enough shards.', code, balance: result.balance, cost: CALLSIGN_RENAME_COST }, 409);
  if (code === 'RENAME_COOLDOWN') return json({ error: 'Callsign changes are limited to once every 7 days.', code, availableAt: result.availableAt }, 429);
  if (code === 'CALLSIGN_BLOCKED') return json({ error: 'That callsign is unavailable.', code }, 422);
  if (code === 'INVALID_CALLSIGN') return json({ error: 'Invalid callsign.', code }, 422);
  return code ? json({ error: 'Callsign service temporarily unavailable.', code: 'PROFILE_OPERATION_FAILED' }, 503) : null;
};

const claimPlayerCallsign = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  if (user.is_anonymous) return json({ error: 'Create an account before choosing a callsign.', code: 'ACCOUNT_REQUIRED' }, 403);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid callsign request.' }, 400); }
  const validation = validateCallsign(body.callsign);
  if (validation.error) return json({ error: validation.error, code: validation.code }, 422);
  const result = await supabaseFetch(config, 'rpc/claim_player_callsign', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: user.id, p_display_name: validation.value }),
  });
  const failure = profileErrorResponse(result);
  if (failure) return failure;
  return json({ ...result, rules: profileRules() }, result.created ? 201 : 200);
};

const renamePlayerCallsign = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  if (user.is_anonymous) return json({ error: 'Create an account before changing a callsign.', code: 'ACCOUNT_REQUIRED' }, 403);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid callsign request.' }, 400); }
  const requestId = String(body.requestId || '');
  const validation = validateCallsign(body.callsign);
  if (!UUID_PATTERN.test(requestId)) return json({ error: 'Invalid rename request.' }, 400);
  if (validation.error) return json({ error: validation.error, code: validation.code }, 422);
  const result = await supabaseFetch(config, 'rpc/rename_player_callsign', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: user.id, p_display_name: validation.value, p_request_id: requestId }),
  });
  const failure = profileErrorResponse(result);
  if (failure) return failure;
  return json({ ...result, rules: profileRules() }, result.duplicateRequest || result.duplicateName ? 200 : 201);
};

const submitScore = async (request, config) => {
  let body;
  try { body = await readJson(request); } catch (error) { return json({ error: error.message === 'PAYLOAD_TOO_LARGE' ? 'Request too large.' : 'Invalid JSON.' }, 400); }
  const runId = String(body.runId || '');
  if (!UUID_PATTERN.test(runId)) return json({ error: 'Invalid run.' }, 400);

  const runQuery = new URLSearchParams({ select: 'id,user_id,difficulty,game_version,created_at,used_at', id: `eq.${runId}`, limit: '1' });
  const runs = await supabaseFetch(config, `leaderboard_runs?${runQuery}`);
  if (!runs.length) return json({ error: 'Run not found.' }, 404);
  let profile = null;
  if (runs[0].user_id) {
    const user = await authenticatePlayer(request, config);
    if (!user) return json({ error: 'Player session required.' }, 401);
    if (user.id !== runs[0].user_id) return json({ error: 'Run does not belong to this player.' }, 403);
    profile = await playerProfileSnapshot(config, user.id);
    if (!profile) return json({ error: 'Choose a callsign before submitting this score.', code: 'PROFILE_REQUIRED' }, 409);
  }
  const validation = validateScorePayload(body, runs[0], Date.now(), profile);
  if (validation.error) return json({ error: validation.error }, 422);
  const value = validation.value;

  const inserted = await supabaseFetch(config, 'leaderboard_scores', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      run_id: runId,
      initials: value.initials,
      user_id: value.userId,
      player_name: value.playerName,
      score: value.score,
      difficulty: value.difficulty,
      duration_ms: value.durationMs,
      zone: value.zone,
      wardens: value.wardens,
      enemies: value.enemies,
      crates: value.crates,
      best_combo: value.bestCombo,
      game_version: value.gameVersion,
    }),
  });

  const usedQuery = new URLSearchParams({ id: `eq.${runId}`, used_at: 'is.null' });
  await supabaseFetch(config, `leaderboard_runs?${usedQuery}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ used_at: new Date().toISOString() }),
  });
  const scores = await listScores(config, value.difficulty, 100);
  const rank = scores.findIndex(entry => entry.id === inserted[0].id) + 1;
  const entry = scores.find(score => score.id === inserted[0].id) || { ...inserted[0], playerName: value.playerName, initials: value.playerName };
  return json({ entry, rank: rank || null, scores: scores.slice(0, 10) }, 201);
};

export const onRequest = async context => {
  const { request, env, params } = context;
  const config = getConfig(env);
  if (!config) return json({ error: 'Leaderboard is not configured yet.' }, 503);
  const path = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');

  try {
    if (path === 'player/session' && request.method === 'POST') return await beginAnonymousSession(request, config);
    if (path === 'player/bootstrap' && request.method === 'POST') return await bootstrapPlayerWallet(request, config);
    if (path === 'player/refresh' && request.method === 'POST') return await refreshPlayerSession(request, config);
    if (path === 'player/account/logout' && request.method === 'POST') return await logoutPlayer(request, config);
    if (path === 'player/wallet' && request.method === 'GET') return await getPlayerWallet(request, config);
    if (path === 'player/account/link-email' && request.method === 'POST') return await linkPlayerEmail(request, config);
    if (path === 'player/account/callback' && (request.method === 'GET' || request.method === 'POST')) return await playerAccountCallback(request, config);
    if (path === 'player/account/password/complete' && request.method === 'POST') return await completeCallbackPassword(request, config);
    if (path === 'player/account/confirm' && request.method === 'POST') return await confirmPlayerEmail(request, config);
    if (path === 'player/account/recovery' && request.method === 'POST') return await requestPasswordRecovery(request, config);
    if (path === 'player/account/password' && request.method === 'POST') return await setPlayerPassword(request, config);
    if (path === 'player/account/login' && request.method === 'POST') return await loginPlayer(request, config);
    if (path === 'player/account/login/complete' && request.method === 'POST') return await completePlayerLoginPage(request, config);
    if (path === 'player/wallet/import' && request.method === 'POST') return await importLegacyWallet(request, config, env);
    if (path === 'economy/settle' && request.method === 'POST') return await settleRunReward(request, config);
    if (path === 'armory' && request.method === 'GET') return await getCrownArmory(request, config);
    if (path === 'armory/select' && request.method === 'POST') return await selectCrownArmoryBlueprint(request, config);
    if (path === 'boss/event' && request.method === 'GET') return await getBossEvent(request, config);
    if (path === 'boss/leaderboard' && request.method === 'GET') return await getBossLeaderboard(request, config);
    if (path === 'boss/assault/start' && request.method === 'POST') return await startBossAssaultRequest(request, config);
    if (path === 'boss/assault/settle' && request.method === 'POST') return await settleBossAssaultRequest(request, config);
    if (path === 'boss/rewards/claim' && request.method === 'POST') return await claimBossRewardRequest(request, config);
    if (path === 'vault/open' && request.method === 'POST') return await openCrownCrate(request, config);
    if (path === 'vault/equip' && request.method === 'POST') return await equipPlayerCosmetic(request, config);
    if (path === 'vault/store' && request.method === 'GET') return await getCrownStore(request, config);
    if (path === 'vault/store/purchase' && request.method === 'POST') return await purchaseCrownStoreItem(request, config);
    if (path === 'market' && request.method === 'GET') return await getCrownMarket(request, config);
    if (path === 'market/listings' && request.method === 'POST') return await createCrownMarketListing(request, config);
    if (path.startsWith('market/listings/') && path.endsWith('/cancel') && request.method === 'POST') {
      return await cancelCrownMarketListing(request, config, path.slice('market/listings/'.length, -'/cancel'.length));
    }
    if (path.startsWith('market/listings/') && path.endsWith('/buy') && request.method === 'POST') {
      return await buyCrownMarketListing(request, config, path.slice('market/listings/'.length, -'/buy'.length));
    }
    if (path === 'market/signals/seen' && request.method === 'POST') return await acknowledgeCrownMarketSignals(request, config);
    if (path === 'vault/inventory/seen' && request.method === 'POST') return await markPlayerInventorySeen(request, config);
    if (path === 'player/profile' && request.method === 'GET') return await getPlayerProfile(request, config);
    if (path === 'player/profile/visibility' && request.method === 'PUT') return await setPlayerProfileVisibility(request, config);
    if (path === 'player/profile/callsign' && request.method === 'POST') return await claimPlayerCallsign(request, config);
    if (path === 'player/profile/callsign' && request.method === 'PUT') return await renamePlayerCallsign(request, config);
    if (path === 'player/redeem' && request.method === 'POST') return await redeemPlayerRewardCode(request, config);
    if (path === 'admin/session' && request.method === 'GET') return await getAdminSession(request, config);
    if (path === 'admin/codes' && request.method === 'GET') return await listAdminRewardCodes(request, config);
    if (path === 'admin/codes' && request.method === 'POST') return await createAdminRewardCode(request, config);
    if (path.startsWith('admin/codes/') && path.endsWith('/status') && request.method === 'PUT') {
      return await setAdminRewardCodeStatus(request, config, path.slice('admin/codes/'.length, -'/status'.length));
    }
    if (path.startsWith('profiles/') && request.method === 'GET') return await getPublicPlayerProfile(config, path.slice('profiles/'.length));
    if (path === 'runs' && request.method === 'POST') return await beginRun(request, config);
    if (path === 'scores' && request.method === 'GET') {
      const url = new URL(request.url);
      const difficulty = url.searchParams.get('difficulty') || 'arcade';
      const limit = Math.min(10, Math.max(1, Number(url.searchParams.get('limit')) || 10));
      if (!DIFFICULTIES.has(difficulty)) return json({ error: 'Invalid difficulty.' }, 400);
      return json({ difficulty, scores: await listScores(config, difficulty, limit) }, 200, 'public, max-age=10, s-maxage=10');
    }
    if (path === 'scores' && request.method === 'POST') return await submitScore(request, config);
    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    console.error(JSON.stringify({ event: 'api_request_failed', path, message: String(error.message || error).slice(0, 120) }));
    return json({ error: 'Crown Network temporarily unavailable.' }, 503);
  }
};
