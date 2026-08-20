const DIFFICULTIES = new Set(['chill', 'arcade', 'crowned']);
const SUPPORTED_GAME_VERSIONS = new Set(['0.10.0-38', '0.10.1-39']);
const MAX_BODY_BYTES = 4096;
const GAME_VERSION_PATTERN = /^\d+\.\d+\.\d+-\d+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const responseHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
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
  return { url, key, salt };
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
  return response.json();
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

  const ipHash = await hashIp(request, config.salt);
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const rateQuery = new URLSearchParams({ select: 'id', ip_hash: `eq.${ipHash}`, created_at: `gte.${since}`, limit: '21' });
  const recent = await supabaseFetch(config, `leaderboard_runs?${rateQuery}`);
  if (recent.length >= 20) return json({ error: 'Too many runs started. Try again shortly.' }, 429);

  const rows = await supabaseFetch(config, 'leaderboard_runs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ difficulty, game_version: gameVersion, ip_hash: ipHash }),
  });
  return json({ id: rows[0].id, startedAt: rows[0].created_at }, 201);
};

const submitScore = async (request, config) => {
  let body;
  try { body = await readJson(request); } catch (error) { return json({ error: error.message === 'PAYLOAD_TOO_LARGE' ? 'Request too large.' : 'Invalid JSON.' }, 400); }
  const runId = String(body.runId || '');
  if (!UUID_PATTERN.test(runId)) return json({ error: 'Invalid run.' }, 400);

  const runQuery = new URLSearchParams({ select: 'id,difficulty,game_version,created_at,used_at', id: `eq.${runId}`, limit: '1' });
  const runs = await supabaseFetch(config, `leaderboard_runs?${runQuery}`);
  if (!runs.length) return json({ error: 'Run not found.' }, 404);
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
