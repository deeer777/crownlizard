const DIFFICULTIES = new Set(['chill', 'arcade', 'crowned']);
const SUPPORTED_GAME_VERSIONS = new Set(['0.10.0-38', '0.10.1-39', '0.10.2-40', '0.10.3-41', '0.11.0-42', '0.12.0-43', '0.13.0-44', '0.14.0-45', '0.14.1-46']);
const MAX_BODY_BYTES = 4096;
const GAME_VERSION_PATTERN = /^\d+\.\d+\.\d+-\d+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COSMETIC_IDS = new Set([
  'ship_verdant_scout', 'ship_ember_runner', 'ship_crystal_dart', 'ship_void_hunter',
  'ship_solar_guard', 'ship_royal_vanguard', 'ship_rift_phantom', 'ship_crown_sovereign',
]);
const LEGACY_BALANCE_CAP = 50_000;
const AUTH_BOOTSTRAP_LIMIT = 5;
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

const sessionPayload = payload => ({
  accessToken: String(payload.access_token || ''),
  refreshToken: String(payload.refresh_token || ''),
  expiresIn: normalizeInt(payload.expires_in, 1, 604800) || 3600,
  expiresAt: normalizeInt(payload.expires_at, 1, Number.MAX_SAFE_INTEGER),
  player: {
    id: String(payload.user?.id || ''),
    anonymous: Boolean(payload.user?.is_anonymous ?? true),
  },
});

const beginAnonymousSession = async (request, config) => {
  if (!config.publishableKey) return json({ error: 'Player accounts are not configured yet.' }, 503);
  const ipHash = await hashIp(request, config.salt);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const query = new URLSearchParams({ select: 'id', ip_hash: `eq.${ipHash}`, created_at: `gte.${since}`, limit: String(AUTH_BOOTSTRAP_LIMIT + 1) });
  const recent = await supabaseFetch(config, `auth_bootstrap_events?${query}`);
  if (recent.length >= AUTH_BOOTSTRAP_LIMIT) return json({ error: 'Too many player accounts created. Try again later.' }, 429);
  await supabaseFetch(config, 'auth_bootstrap_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ip_hash: ipHash }) });
  const payload = await authFetch(config, 'signup', { method: 'POST', body: '{}' });
  const session = sessionPayload(payload);
  if (!UUID_PATTERN.test(session.player.id) || !session.accessToken || !session.refreshToken) throw new Error('AUTH_SESSION_INVALID');
  return json(session, 201);
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

const ensureWallet = async (config, userId) => {
  await supabaseFetch(config, 'player_wallets?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userId }),
  });
};

const walletSnapshot = async (config, userId) => {
  await ensureWallet(config, userId);
  const walletQuery = new URLSearchParams({ select: 'balance,opens,since_sovereign,equipped_ship,legacy_imported_at,updated_at', user_id: `eq.${userId}`, limit: '1' });
  const inventoryQuery = new URLSearchParams({ select: 'cosmetic_id,source,acquired_at', user_id: `eq.${userId}`, order: 'acquired_at.asc' });
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
    equippedShip: wallet.equipped_ship,
    legacyImported: Boolean(wallet.legacy_imported_at),
    updatedAt: wallet.updated_at,
    inventory: inventory.map(item => ({ cosmeticId: item.cosmetic_id, source: item.source, acquiredAt: item.acquired_at })),
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
  return json({ player: { id: user.id, anonymous: Boolean(user.is_anonymous) }, wallet: await walletSnapshot(config, user.id) });
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

export const validateScorePayload = (body, run, now = Date.now()) => {
  const initials = String(body.initials || '').toUpperCase();
  const score = normalizeInt(body.score, 1, 1_000_000_000);
  const durationMs = normalizeInt(body.durationMs, 3000, 86_400_000);
  const zone = normalizeInt(body.zone, 1, 999);
  const wardens = normalizeInt(body.wardens, 0, 999);
  const enemies = normalizeInt(body.enemies, 0, 1_000_000);
  const crates = normalizeInt(body.crates, 0, 100_000);
  const bestCombo = normalizeInt(body.bestCombo, 1, 100_000);
  const difficulty = String(body.difficulty || '');
  const gameVersion = String(body.gameVersion || '');

  if (!/^[A-Z0-9]{3}$/.test(initials)) return { error: 'Enter exactly 3 initials using A-Z or 0-9.' };
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

  return { value: { initials, score, durationMs, zone, wardens, enemies, crates, bestCombo, difficulty, gameVersion } };
};

const listScores = async (config, difficulty, limit = 10) => {
  const query = new URLSearchParams({
    select: 'id,initials,score,difficulty,zone,wardens,created_at',
    difficulty: `eq.${difficulty}`,
    is_hidden: 'eq.false',
    order: 'score.desc,created_at.asc',
    limit: String(limit),
  });
  return supabaseFetch(config, `leaderboard_scores?${query}`);
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
  const runQuery = new URLSearchParams({ select: 'id,user_id,created_at,economy_settled_at', id: `eq.${runId}`, limit: '1' });
  const runs = await supabaseFetch(config, `leaderboard_runs?${runQuery}`);
  if (!runs.length) return json({ error: 'Run not found.' }, 404);
  if (runs[0].user_id !== user.id) return json({ error: 'Run does not belong to this player.' }, 403);
  const validation = validateEconomySummary(body, runs[0]);
  if (validation.error) return json({ error: validation.error }, 422);
  const result = await supabaseFetch(config, 'rpc/settle_run_reward', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: user.id, p_run_id: runId, p_amount: validation.reward.total, p_reward: validation.reward }),
  });
  return json(result, result.duplicate ? 200 : 201);
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
  if (result.error === 'NOT_ENOUGH_SHARDS') return json({ error: 'Not enough shards.', code: result.error, balance: result.balance }, 409);
  return json(result, result.duplicateRequest ? 200 : 201);
};

const equipPlayerShip = async (request, config) => {
  const user = await authenticatePlayer(request, config);
  if (!user) return json({ error: 'Player session required.' }, 401);
  let body;
  try { body = await readJson(request); } catch { return json({ error: 'Invalid equip request.' }, 400); }
  const cosmeticId = String(body.cosmeticId || '');
  if (cosmeticId !== 'ship_default' && !COSMETIC_IDS.has(cosmeticId)) return json({ error: 'Invalid cosmetic.' }, 400);
  const equipped = await supabaseFetch(config, 'rpc/equip_player_ship', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: user.id, p_cosmetic_id: cosmeticId }),
  });
  if (equipped !== true) return json({ error: 'This cosmetic is not owned.', code: 'COSMETIC_LOCKED' }, 403);
  return json({ player: { id: user.id, anonymous: Boolean(user.is_anonymous) }, wallet: await walletSnapshot(config, user.id) });
};

const submitScore = async (request, config) => {
  let body;
  try { body = await readJson(request); } catch (error) { return json({ error: error.message === 'PAYLOAD_TOO_LARGE' ? 'Request too large.' : 'Invalid JSON.' }, 400); }
  const runId = String(body.runId || '');
  if (!UUID_PATTERN.test(runId)) return json({ error: 'Invalid run.' }, 400);

  const runQuery = new URLSearchParams({ select: 'id,user_id,difficulty,game_version,created_at,used_at', id: `eq.${runId}`, limit: '1' });
  const runs = await supabaseFetch(config, `leaderboard_runs?${runQuery}`);
  if (!runs.length) return json({ error: 'Run not found.' }, 404);
  if (runs[0].user_id) {
    const user = await authenticatePlayer(request, config);
    if (!user) return json({ error: 'Player session required.' }, 401);
    if (user.id !== runs[0].user_id) return json({ error: 'Run does not belong to this player.' }, 403);
  }
  const validation = validateScorePayload(body, runs[0]);
  if (validation.error) return json({ error: validation.error }, 422);
  const value = validation.value;

  const inserted = await supabaseFetch(config, 'leaderboard_scores', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      run_id: runId,
      initials: value.initials,
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
  return json({ entry: inserted[0], rank: rank || null, scores: scores.slice(0, 10) }, 201);
};

export const onRequest = async context => {
  const { request, env, params } = context;
  const config = getConfig(env);
  if (!config) return json({ error: 'Leaderboard is not configured yet.' }, 503);
  const path = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');

  try {
    if (path === 'player/session' && request.method === 'POST') return await beginAnonymousSession(request, config);
    if (path === 'player/refresh' && request.method === 'POST') return await refreshPlayerSession(request, config);
    if (path === 'player/wallet' && request.method === 'GET') return await getPlayerWallet(request, config);
    if (path === 'player/wallet/import' && request.method === 'POST') return await importLegacyWallet(request, config, env);
    if (path === 'economy/settle' && request.method === 'POST') return await settleRunReward(request, config);
    if (path === 'vault/open' && request.method === 'POST') return await openCrownCrate(request, config);
    if (path === 'vault/equip' && request.method === 'POST') return await equipPlayerShip(request, config);
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
    console.error(JSON.stringify({ event: 'leaderboard_request_failed', path, message: String(error.message || error).slice(0, 120) }));
    return json({ error: 'Leaderboard temporarily unavailable.' }, 503);
  }
};
