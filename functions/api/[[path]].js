const DIFFICULTIES = new Set(['chill', 'arcade', 'crowned']);
const SUPPORTED_GAME_VERSIONS = new Set(['0.10.0-38', '0.10.1-39', '0.10.2-40', '0.10.3-41', '0.11.0-42', '0.12.0-43', '0.13.0-44', '0.14.0-45', '0.14.1-46', '0.14.2-47', '0.14.3-48', '0.14.4-49', '0.14.5-50', '0.14.6-51', '0.14.7-52', '0.14.8-53', '0.14.9-54', '0.15.0-55', '0.15.1-56', '0.15.2-57', '0.15.3-58', '0.15.4-59', '0.15.5-60', '0.15.6-61', '0.15.7-62', '0.15.8-63', '0.15.9-64']);
const MAX_BODY_BYTES = 4096;
const GAME_VERSION_PATTERN = /^\d+\.\d+\.\d+-\d+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COSMETIC_IDS = new Set([
  'ship_verdant_scout', 'ship_ember_runner', 'ship_crystal_dart', 'ship_void_hunter',
  'ship_solar_guard', 'ship_royal_vanguard', 'ship_rift_phantom', 'ship_crown_sovereign',
]);
const LEGACY_BALANCE_CAP = 50_000;
const AUTH_BOOTSTRAP_LIMIT = 60;
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
    email: String(payload.user?.email || ''),
  },
});

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
*{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:22px;background:#03090d;color:#e8fff8;font-family:monospace;text-align:center}.panel{width:min(440px,100%);border:3px solid #6fffd2;background:#071a1d;padding:30px 22px;box-shadow:8px 8px 0 #010405}.crown{color:#ffd36b;font-size:42px;line-height:1;text-shadow:3px 3px 0 #7d4318}.brand{margin:10px 0 4px;color:#ffd36b;font-weight:900;letter-spacing:4px}.eyebrow{margin:18px 0 8px;color:#77a69a;font-size:11px;letter-spacing:2px}h1{margin:0 0 14px;font-size:22px;letter-spacing:1px}p{margin:0 auto 24px;max-width:350px;color:#b8d8d0;line-height:1.55}.field{display:block;margin:0 0 17px;text-align:left}.field span{display:block;margin:0 0 7px;color:#8cc8b9;font-size:10px;font-weight:900;letter-spacing:2px}.field input{width:100%;min-height:52px;border:2px solid #377f72;border-radius:0;background:#02090c;color:#fff;padding:10px 12px;font:700 16px monospace;outline:0}.field input:focus{border-color:#ffd36b;box-shadow:0 0 0 2px #8f541c}.button{display:grid;place-items:center;width:100%;min-height:58px;border:0;background:#ffd36b;color:#071014;text-decoration:none;font:900 14px monospace;letter-spacing:1px;box-shadow:0 5px 0 #8f541c;cursor:pointer}.button:active{transform:translateY(3px);box-shadow:0 2px 0 #8f541c}.error{margin:-5px 0 18px;color:#ff8c83;font-size:12px;font-weight:900;line-height:1.5}.note{margin:18px 0 0;color:#77958d;font-size:10px;letter-spacing:1px}</style></head><body><main class="panel"><div class="crown">♛</div><div class="brand">CROWN LIZARD</div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${message}</p>${body}<div class="note">CROWNLIZARD.COM · SECURE CONNECTION</div></main>${script ? `<script nonce="${nonce}">${script}</script>` : ''}</body></html>`, {
  status,
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; ${script ? `script-src 'nonce-${nonce}';` : ''} form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
    ...(cookie ? { 'Set-Cookie': cookie } : {}),
  },
  });
};

const sessionReadyPage = (session, cookie) => {
  const safeSession = JSON.stringify(session)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const script = `(()=>{try{const session=${safeSession};localStorage.setItem('cl:player-session:v1',JSON.stringify(session));localStorage.setItem('cl:account-password:v1','done');setTimeout(()=>location.replace('/?account=signed-in'),700)}catch{setTimeout(()=>location.replace('/?account=sign-in'),700)}})();`;
  return accountPage({ title: 'PASSWORD SAVED', eyebrow: 'VAULT SECURED', message: 'Your Crown account is ready. Signing you in and restoring your Vault now.', body: '<a class="button" href="/?account=signed-in">♛ OPEN CROWN LIZARD</a>', cookie, script });
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
    return json({ ...session, session, wallet: await walletSnapshot(config, session.player.id) });
  } catch (error) {
    if (error.status === 400 || error.status === 401 || error.message === 'AUTH_SESSION_INVALID') return json({ error: 'Email or password is incorrect.' }, 401);
    if (error.status === 429) return json({ error: 'Too many sign-in attempts. Try again later.' }, 429);
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
    if (path === 'player/bootstrap' && request.method === 'POST') return await bootstrapPlayerWallet(request, config);
    if (path === 'player/refresh' && request.method === 'POST') return await refreshPlayerSession(request, config);
    if (path === 'player/wallet' && request.method === 'GET') return await getPlayerWallet(request, config);
    if (path === 'player/account/link-email' && request.method === 'POST') return await linkPlayerEmail(request, config);
    if (path === 'player/account/callback' && (request.method === 'GET' || request.method === 'POST')) return await playerAccountCallback(request, config);
    if (path === 'player/account/password/complete' && request.method === 'POST') return await completeCallbackPassword(request, config);
    if (path === 'player/account/confirm' && request.method === 'POST') return await confirmPlayerEmail(request, config);
    if (path === 'player/account/recovery' && request.method === 'POST') return await requestPasswordRecovery(request, config);
    if (path === 'player/account/password' && request.method === 'POST') return await setPlayerPassword(request, config);
    if (path === 'player/account/login' && request.method === 'POST') return await loginPlayer(request, config);
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
