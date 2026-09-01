import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generatePvpInviteCode, onRequest } from '../functions/api/[[path]].js';

const sql = await readFile(new URL('../supabase/pvp-lobby-build100.sql', import.meta.url), 'utf8');
const resultSql = await readFile(new URL('../supabase/pvp-results-build102.sql', import.meta.url), 'utf8');
const worker = await readFile(new URL('../workers/pvp/src/index.ts', import.meta.url), 'utf8');
const playerClient = await readFile(new URL('../src/player-account.js', import.meta.url), 'utf8');
const mainClient = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const markup = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const pagesApi = await readFile(new URL('../functions/api/[[path]].js', import.meta.url), 'utf8');
const pagesConfig = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));

for (let index = 0; index < 50; index += 1) {
  assert.match(generatePvpInviteCode(), /^[A-HJ-NP-Z2-9]{8}$/, 'invite codes are fixed-length and omit ambiguous characters');
}
assert.match(sql, /enable row level security[\s\S]*revoke all on table public\.pvp_challenges from public, anon, authenticated/, 'the browser cannot mutate PvP discovery state');
assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\('pvp-player:'/, 'one player cannot race multiple challenge memberships');
assert.match(sql, /for update skip locked[\s\S]*status = 'expired'/, 'expired lobbies are claimed safely by the cleanup path');
assert.match(sql, /guest_user_id = p_guest_user_id, status = 'matched'/, 'the guest seat is committed server-side');
assert.match(sql, /leave_pvp_challenge[\s\S]*guest_user_id = null, status = 'waiting'/, 'a guest can release the seat without cancelling the host challenge');
assert.match(resultSql, /primary key \(challenge_id, round\)/, 'verified duel history is idempotent per room round');
assert.match(resultSql, /enable row level security[\s\S]*revoke all on table public\.pvp_match_results/, 'duel history cannot be forged from the browser');
assert.match(pagesApi, /finishPvpRun[\s\S]*persistPvpResult/, 'only a finalized Durable Object result reaches persistent history');
assert.match(worker, /requestRematch/, 'rematch is mediated by the authoritative duel room');
assert.doesNotMatch(worker, /Math\.random/, 'room identity and invite security never use predictable randomness');
assert.match(worker, /extends DurableObject<Env>/, 'each duel is backed by a real Durable Object');
assert.match(worker, /CREATE TABLE room_state/, 'room state persists across isolate eviction');
assert.match(worker, /storage\.setAlarm\(room\.expiresAt\)/, 'room timeout persists across isolate eviction');
assert.match(worker, /_sql_schema_migrations[\s\S]*host_ready[\s\S]*guest_seen_at/, 'Ready and presence state use an explicit internal migration');
assert.match(worker, /blueprintOffer\(\)/, 'the room server owns the normalized match offer');
assert.match(worker, /matchSeed: secureHex\(\)[\s\S]*matchEndAt/, 'the room server owns a cryptographic seed and fixed match window');
assert.match(worker, /submitProgress[\s\S]*PROGRESS_CEILING/, 'provisional score signals are bounded');
assert.match(worker, /score < room\.hostScore[\s\S]*PROGRESS_REWIND/, 'provisional score signals are monotonic');
assert.deepEqual(pagesConfig.durable_objects.bindings[0], {
  name: 'DUEL_ROOMS', class_name: 'DuelRoom', script_name: 'crownlizard-pvp',
}, 'Pages binds to the separate Durable Object Worker');
assert.match(playerClient, /selectPvpBlueprint[\s\S]*submitPvpProgress/, 'the account client exposes authenticated match loadout and progress signals');
assert.match(mainClient, /beginDuelGameplay[\s\S]*startDuel[\s\S]*transmitDuelProgress/, 'the lobby launches the seeded 90-second gameplay and its discreet rival signal');
assert.match(pagesApi, /const participant = viewerRole === 'host' \|\| viewerRole === 'guest'[\s\S]*match: participant && room\.matchStartAt/, 'the Pages API keeps seed and live score details participant-only');
assert.match(markup, /id="menuDuel"[\s\S]*id="duelOverlay"[\s\S]*id="duelHostCard"[\s\S]*id="duelGuestCard"/, 'the arcade menu and visual two-pilot lobby are present');
assert.match(styles, /\.duel-pilot-grid[\s\S]*grid-template-columns: minmax\(0,1fr\) 28px minmax\(0,1fr\)/, 'the mobile lobby keeps both pilot ships visible side by side');
assert.match(styles, /\.duel-room-body \{[^}]*grid-template-columns: minmax\(0,1\.65fr\) minmax\(246px,\.7fr\)/, 'desktop separates the pilot arena from its compact control console');
assert.match(styles, /\.duel-challenge-list \{[^}]*grid-template-columns: repeat\(3,[^}]*[\s\S]*@media \(max-width: 600px\)[\s\S]*\.duel-challenge-list \{ grid-template-columns: repeat\(2,/, 'open challenges use a three-column desktop grid and a two-column phone grid');
assert.doesNotMatch(markup, /JOIN WITH INVITE CODE|duelRoomCode|duelInviteCode/, 'raw invite codes are not exposed in the player-facing arcade UI');
assert.match(markup, /id="duelShare"[^>]*>[\s\S]*SHARE CHALLENGE/, 'private invites use one clear direct-link action');
assert.match(styles, /\.duel-share \{[^}]*min-height: 46px/, 'the direct-link action is one compact arcade menu command');

const hostId = '11111111-1111-4111-8111-111111111111';
const guestId = '22222222-2222-4222-8222-222222222222';
const challengeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const publicId = '99999999-9999-4999-8999-999999999999';
const inviteCode = 'PVPK2X79';
const expiry = new Date(Date.now() + 600_000).toISOString();
let joined = false;

const roomState = new Map();
const roomNamespace = {
  getByName(id) {
    return {
      async createRoom(input) { roomState.set(id, { ...input, status: 'waiting', updatedAt: input.createdAt, guestUserId: null, hostReady: false, guestReady: false, hostSeenAt: Date.now(), guestSeenAt: null, blueprintOffer: ['blaster_royal_barrage', 'pulse_comet_cores', 'tesla_storm_web'], hostBlueprint: null, guestBlueprint: null, matchSeed: null, matchStartAt: null, matchEndAt: null, hostScore: 0, guestScore: 0, hostProgressAt: null, guestProgressAt: null }); return { ok: true, room: roomState.get(id) }; },
      async claimGuest(userId) {
        const room = roomState.get(id) || { hostUserId: hostId, status: 'waiting', guestUserId: null };
        if (room.hostUserId === userId) return { ok: false, error: 'SELF_JOIN' };
        if (room.guestUserId && room.guestUserId !== userId) return { ok: false, error: 'ROOM_UNAVAILABLE' };
        Object.assign(room, { status: 'matched', guestUserId: userId, guestReady: false, guestSeenAt: Date.now() }); roomState.set(id, room);
        return { ok: true, room };
      },
      async releaseGuest(userId) { const room = roomState.get(id); if (room?.matchStartAt) return { ok: false, error: 'MATCH_LOCKED' }; if (room?.guestUserId === userId) Object.assign(room, { status: 'waiting', guestUserId: null }); return { ok: true, room }; },
      async getState() { return { ok: true, room: roomState.get(id) || { status: 'waiting' } }; },
      async cancelRoom() { return { ok: true, room: { status: 'cancelled' } }; },
      async setReady(userId, ready) {
        const room = roomState.get(id);
        if (userId === room.hostUserId) Object.assign(room, { hostReady: ready, hostSeenAt: Date.now() });
        else if (userId === room.guestUserId) Object.assign(room, { guestReady: ready, guestSeenAt: Date.now() });
        else return { ok: false, error: 'NOT_PARTICIPANT' };
        if (room.hostReady && room.guestReady && room.hostBlueprint && room.guestBlueprint && !room.matchStartAt) {
          room.matchSeed = '0123456789abcdef0123456789abcdef'; room.matchStartAt = Date.now() + 4_000; room.matchEndAt = room.matchStartAt + 90_000;
        }
        return { ok: true, room };
      },
      async selectBlueprint(userId, blueprintId) {
        const room = roomState.get(id);
        if (!room.blueprintOffer.includes(blueprintId)) return { ok: false, error: 'LOADOUT_NOT_OFFERED' };
        if (userId === room.hostUserId) { room.hostBlueprint = blueprintId; room.hostReady = false; }
        else if (userId === room.guestUserId) { room.guestBlueprint = blueprintId; room.guestReady = false; }
        else return { ok: false, error: 'NOT_PARTICIPANT' };
        return { ok: true, room };
      },
      async submitProgress(userId, score, elapsedMs) {
        const room = roomState.get(id);
        if (userId === room.hostUserId) { room.hostScore = score; room.hostProgressAt = Date.now(); }
        else if (userId === room.guestUserId) { room.guestScore = score; room.guestProgressAt = Date.now(); }
        else return { ok: false, error: 'NOT_PARTICIPANT' };
        return { ok: true, room };
      },
      async heartbeat(userId) {
        const room = roomState.get(id);
        if (userId === room.hostUserId) room.hostSeenAt = Date.now();
        else if (userId === room.guestUserId) room.guestSeenAt = Date.now();
        else return { ok: false, error: 'NOT_PARTICIPANT' };
        return { ok: true, room };
      },
    };
  },
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  if (target.endsWith('/auth/v1/user')) {
    const token = String(new Headers(options.headers).get('Authorization') || '').replace('Bearer ', '');
    return Response.json({ id: token === 'guest-token' ? guestId : token === 'spectator-token' ? rival : hostId, is_anonymous: false, email: 'pilot@example.com' });
  }
  if (target.includes('/rest/v1/player_profiles?')) {
    const isGuest = target.includes(encodeURIComponent(`eq.${guestId}`));
    return Response.json([{ user_id: isGuest ? guestId : hostId, public_id: publicId, is_public: true, display_name: isGuest ? 'RIVAL' : 'HOST', rename_count: 0 }]);
  }
  if (target.endsWith('/rest/v1/rpc/create_pvp_challenge')) {
    return Response.json({ challengeId, inviteCode, status: 'waiting', expiresAt: expiry, duplicateRequest: false });
  }
  if (target.endsWith('/rest/v1/rpc/join_pvp_challenge')) {
    joined = true;
    return Response.json({ challengeId, status: 'matched', duplicateRequest: false });
  }
  if (target.endsWith('/rest/v1/rpc/pvp_challenge_snapshot')) {
    const body = JSON.parse(options.body || '{}');
    const viewerGuest = body.p_viewer_user_id === guestId;
    return Response.json({
      challengeId, inviteCode: viewerGuest || body.p_viewer_user_id === hostId ? inviteCode : null,
      status: joined ? 'matched' : 'waiting', viewerRole: viewerGuest && joined ? 'guest' : body.p_viewer_user_id === hostId ? 'host' : 'spectator',
      expiresAt: expiry, host: { callsign: 'HOST', publicId, equippedShip: 'ship_default' },
      guest: joined ? { callsign: 'RIVAL', publicId, equippedShip: 'ship_default' } : null,
    });
  }
  if (target.endsWith('/rest/v1/rpc/pvp_open_challenges')) {
    return Response.json([{ challengeId, status: 'waiting', expiresAt: expiry, host: { callsign: 'HOST', publicId, equippedShip: 'ship_default' } }]);
  }
  if (target.endsWith('/rest/v1/rpc/cancel_pvp_challenge')) return Response.json({ challengeId, status: 'cancelled' });
  if (target.endsWith('/rest/v1/rpc/leave_pvp_challenge')) { joined = false; return Response.json({ challengeId, status: 'waiting' }); }
  throw new Error(`Unexpected fetch: ${target}`);
};

const env = {
  SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SECRET_KEY: 'server-secret',
  SUPABASE_PUBLISHABLE_KEY: 'browser-publishable', SCORE_HASH_SALT: 'test-salt', DUEL_ROOMS: roomNamespace,
};
const route = (path, method = 'GET', token = '', origin = false, body = null) => onRequest({
  request: new Request(`https://crownlizard.com/api/${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { Origin: 'https://crownlizard.com' } : {}) },
    ...(body === null ? {} : { body: JSON.stringify(body) }),
  }),
  env,
  params: { path: path.split('/') },
});

try {
  const listing = await route('pvp/challenges');
  assert.equal(listing.status, 200);
  assert.equal((await listing.json()).challenges[0].host.callsign, 'HOST');

  const created = await route('pvp/challenges', 'POST', 'host-token', true);
  const createdBody = await created.json();
  assert.equal(created.status, 201);
  assert.equal(createdBody.invite.url, `https://crownlizard.com/?duel=${inviteCode}`);
  assert.equal(createdBody.challenge.viewerRole, 'host');

  const joinedResponse = await route(`pvp/invites/${inviteCode}/join`, 'POST', 'guest-token', true);
  const joinedBody = await joinedResponse.json();
  assert.equal(joinedResponse.status, 201);
  assert.equal(joinedBody.challenge.viewerRole, 'guest');
  assert.equal(joinedBody.challenge.guest.callsign, 'RIVAL');

  const guestLoadout = await route(`pvp/challenges/${challengeId}/blueprint`, 'POST', 'guest-token', true, { blueprintId: 'pulse_comet_cores' });
  assert.equal((await guestLoadout.json()).challenge.selectedBlueprint, 'pulse_comet_cores');

  const hostLoadout = await route(`pvp/challenges/${challengeId}/blueprint`, 'POST', 'host-token', true, { blueprintId: 'blaster_royal_barrage' });
  assert.equal((await hostLoadout.json()).challenge.selectedBlueprint, 'blaster_royal_barrage');

  const guestReady = await route(`pvp/challenges/${challengeId}/ready`, 'POST', 'guest-token', true, { ready: true });
  const guestReadyBody = await guestReady.json();
  assert.equal(guestReady.status, 200);
  assert.equal(guestReadyBody.challenge.guest.ready, true);
  assert.equal(guestReadyBody.challenge.allReady, false);
  assert.equal('guestUserId' in guestReadyBody.challenge, false, 'internal player identifiers never reach the browser');

  const hostReady = await route(`pvp/challenges/${challengeId}/ready`, 'POST', 'host-token', true, { ready: true });
  const match = (await hostReady.json()).challenge;
  assert.equal(match.allReady, true);
  assert.match(match.match.seed, /^[0-9a-f]{32}$/);
  assert.equal(match.match.durationMs, 90_000);

  const progress = await route(`pvp/challenges/${challengeId}/progress`, 'POST', 'guest-token', true, { score: 4200, elapsedMs: 1500 });
  const progressBody = await progress.json();
  assert.equal(progressBody.challenge.match.yourScore, 4200);
  assert.equal('hostUserId' in progressBody.challenge, false, 'match coordination never exposes internal player identifiers');

  const heartbeat = await route(`pvp/challenges/${challengeId}/heartbeat`, 'POST', 'guest-token', true);
  assert.equal((await heartbeat.json()).challenge.guest.connected, true);

  const left = await route(`pvp/challenges/${challengeId}/leave`, 'POST', 'guest-token', true);
  assert.equal(left.status, 409, 'a launched match cannot be abandoned through the lobby seat API');
  assert.equal(roomState.get(challengeId).guestUserId, guestId, 'the challenger seat remains locked during the score race');

  const missingBinding = await onRequest({
    request: new Request('https://crownlizard.com/api/pvp/challenges', { method: 'POST', headers: { Origin: 'https://crownlizard.com' } }),
    env: { ...env, DUEL_ROOMS: undefined }, params: { path: ['pvp', 'challenges'] },
  });
  assert.equal(missingBinding.status, 503, 'PvP fails closed when its room binding is unavailable');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('PvP lobby API, discovery schema and Durable Object contract passed.');
