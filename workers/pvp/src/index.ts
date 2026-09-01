import { DurableObject } from 'cloudflare:workers';

type RoomStatus = 'waiting' | 'matched' | 'cancelled' | 'expired';
type VerificationStatus = 'pending' | 'verified' | 'invalid';
type WinnerRole = 'host' | 'guest' | 'draw' | null;
type RoomState = {
  roomId: string;
  inviteCode: string;
  hostUserId: string;
  guestUserId: string | null;
  status: RoomStatus;
  createdAt: number;
  expiresAt: number;
  updatedAt: number;
  hostReady: boolean;
  guestReady: boolean;
  hostSeenAt: number;
  guestSeenAt: number | null;
  blueprintOffer: string[];
  hostBlueprint: string | null;
  guestBlueprint: string | null;
  matchSeed: string | null;
  matchStartAt: number | null;
  matchEndAt: number | null;
  hostScore: number;
  guestScore: number;
  hostProgressAt: number | null;
  guestProgressAt: number | null;
  round: number;
  hostSamples: number;
  guestSamples: number;
  hostElapsedMs: number;
  guestElapsedMs: number;
  hostEnemies: number;
  guestEnemies: number;
  hostSubmittedAt: number | null;
  guestSubmittedAt: number | null;
  hostVerification: VerificationStatus;
  guestVerification: VerificationStatus;
  resultStatus: 'playing' | 'verifying' | 'final';
  winnerRole: WinnerRole;
  finalizedAt: number | null;
  hostRematch: boolean;
  guestRematch: boolean;
};
type RoomResult = { ok: true; room: RoomState; duplicateRequest?: boolean } | { ok: false; error: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INVITE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;
const ACTIVE_STATUSES = new Set<RoomStatus>(['waiting', 'matched']);
const DUEL_DURATION_MS = 90_000;
const DUEL_COUNTDOWN_MS = 4_000;
const RESULT_GRACE_MS = 20_000;
const BLUEPRINT_GROUPS = [
  ['blaster_royal_barrage', 'blaster_crownrail'],
  ['spread_guillotine_fan', 'pulse_comet_cores'],
  ['laser_prism_array', 'tesla_storm_web'],
] as const;
const BLUEPRINT_IDS = new Set<string>(BLUEPRINT_GROUPS.flat());

const hashSeed = (value: string): number => {
  let hash = 2166136261;
  for (const character of String(value || '')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 0x9e3779b9;
};

const seededRandom = (seed: string): (() => number) => {
  let state = hashSeed(seed);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
};

// Mirrors the browser wave scheduler without trusting any browser-reported wave count.
const spawnedEnemyCeiling = (seed: string, elapsedMs: number): number => {
  const random = seededRandom(seed);
  const elapsed = elapsedMs / 1000;
  let at = 1.35;
  let index = 0;
  let count = 0;
  while (at < DUEL_DURATION_MS / 1000 - .35) {
    const progress = at / (DUEL_DURATION_MS / 1000);
    const groupSize = progress < .2 ? 1 : progress < .52 ? 1 + Number(index % 4 === 0) : 2 + Number(index % 5 === 0);
    for (let group = 0; group < groupSize; group += 1) {
      random(); // enemy type
      random(); // x ratio
      random(); // side
      random(); // shoot timing
      random(); // phase
      random(); // hold ratio
      if (at + group * .16 <= elapsed + .25) count += 1;
    }
    index += 1;
    at += Math.max(.72, 1.48 - progress * .56) + random() * .28;
  }
  return count;
};

const secureHex = (length = 16): string => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
};

const blueprintOffer = (): string[] => {
  const bytes = new Uint8Array(BLUEPRINT_GROUPS.length);
  crypto.getRandomValues(bytes);
  return BLUEPRINT_GROUPS.map((group, index) => group[bytes[index] % group.length]);
};

export class DuelRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => this.migrate());
  }

  async createRoom(input: { roomId: string; inviteCode: string; hostUserId: string; createdAt: number; expiresAt: number }): Promise<RoomResult> {
    if (!this.validIdentity(input.roomId) || !this.validIdentity(input.hostUserId)
        || !INVITE_PATTERN.test(input.inviteCode) || !this.validWindow(input.createdAt, input.expiresAt)) {
      return { ok: false, error: 'INVALID_ROOM' };
    }
    const current = this.readRoom();
    if (current) {
      const sameRoom = current.roomId === input.roomId && current.hostUserId === input.hostUserId && current.inviteCode === input.inviteCode;
      return sameRoom ? { ok: true, room: this.expireIfDue(current, Date.now()), duplicateRequest: true } : { ok: false, error: 'ROOM_ALREADY_INITIALIZED' };
    }
    const room: RoomState = {
      ...input, guestUserId: null, status: 'waiting', updatedAt: input.createdAt,
      hostReady: false, guestReady: false, hostSeenAt: input.createdAt, guestSeenAt: null,
      blueprintOffer: blueprintOffer(), hostBlueprint: null, guestBlueprint: null,
      matchSeed: null, matchStartAt: null, matchEndAt: null,
      hostScore: 0, guestScore: 0, hostProgressAt: null, guestProgressAt: null,
      round: 1, hostSamples: 0, guestSamples: 0, hostElapsedMs: 0, guestElapsedMs: 0,
      hostEnemies: 0, guestEnemies: 0, hostSubmittedAt: null, guestSubmittedAt: null,
      hostVerification: 'pending', guestVerification: 'pending', resultStatus: 'playing', winnerRole: null,
      finalizedAt: null, hostRematch: false, guestRematch: false,
    };
    this.writeRoom(room);
    await this.ctx.storage.setAlarm(room.expiresAt);
    return { ok: true, room };
  }

  async claimGuest(userId: string, now = Date.now()): Promise<RoomResult> {
    if (!this.validIdentity(userId) || !Number.isSafeInteger(now)) return { ok: false, error: 'INVALID_PLAYER' };
    const stored = this.readRoom();
    if (!stored) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const room = this.expireIfDue(stored, now);
    if (room.status === 'expired') return { ok: false, error: 'ROOM_EXPIRED' };
    if (room.hostUserId === userId) return { ok: false, error: 'SELF_JOIN' };
    if (room.status === 'matched' && room.guestUserId === userId) return { ok: true, room, duplicateRequest: true };
    if (room.status !== 'waiting' || room.guestUserId) return { ok: false, error: 'ROOM_UNAVAILABLE' };
    const matched: RoomState = {
      ...room, guestUserId: userId, status: 'matched', updatedAt: now,
      guestReady: false, guestSeenAt: now, guestBlueprint: null, guestScore: 0, guestProgressAt: null,
    };
    this.writeRoom(matched);
    return { ok: true, room: matched };
  }

  async releaseGuest(userId: string, now = Date.now()): Promise<RoomResult> {
    if (!this.validIdentity(userId) || !Number.isSafeInteger(now)) return { ok: false, error: 'INVALID_PLAYER' };
    const room = this.readRoom();
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };
    if (room.matchStartAt) return { ok: false, error: 'MATCH_LOCKED' };
    if (room.status === 'waiting' && !room.guestUserId) return { ok: true, room, duplicateRequest: true };
    if (room.status !== 'matched' || room.guestUserId !== userId) return { ok: false, error: 'NOT_GUEST' };
    const waiting: RoomState = {
      ...room, guestUserId: null, status: 'waiting', updatedAt: now,
      guestReady: false, guestSeenAt: null, guestBlueprint: null, guestScore: 0, guestProgressAt: null,
    };
    this.writeRoom(waiting);
    return { ok: true, room: waiting };
  }

  async cancelRoom(userId: string, now = Date.now()): Promise<RoomResult> {
    if (!this.validIdentity(userId) || !Number.isSafeInteger(now)) return { ok: false, error: 'INVALID_PLAYER' };
    const stored = this.readRoom();
    if (!stored) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const room = this.expireIfDue(stored, now);
    if (userId !== room.hostUserId && userId !== room.guestUserId) return { ok: false, error: 'NOT_PARTICIPANT' };
    if (room.matchStartAt) return { ok: false, error: 'MATCH_LOCKED' };
    if (!ACTIVE_STATUSES.has(room.status)) return { ok: true, room, duplicateRequest: true };
    const cancelled: RoomState = { ...room, status: 'cancelled', updatedAt: now };
    this.writeRoom(cancelled);
    await this.ctx.storage.deleteAlarm();
    return { ok: true, room: cancelled };
  }

  async getState(now = Date.now()): Promise<RoomResult> {
    if (!Number.isSafeInteger(now)) return { ok: false, error: 'INVALID_TIME' };
    const room = this.readRoom();
    return room ? { ok: true, room: this.expireIfDue(room, now) } : { ok: false, error: 'ROOM_NOT_FOUND' };
  }

  async setReady(userId: string, ready: boolean, now = Date.now()): Promise<RoomResult> {
    if (!this.validIdentity(userId) || typeof ready !== 'boolean' || !Number.isSafeInteger(now)) return { ok: false, error: 'INVALID_PLAYER' };
    const stored = this.readRoom();
    if (!stored) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const room = this.expireIfDue(stored, now);
    if (!ACTIVE_STATUSES.has(room.status)) return { ok: false, error: room.status === 'expired' ? 'ROOM_EXPIRED' : 'ROOM_UNAVAILABLE' };
    if (userId !== room.hostUserId && userId !== room.guestUserId) return { ok: false, error: 'NOT_PARTICIPANT' };
    if (room.matchStartAt) return { ok: true, room, duplicateRequest: true };
    if (userId === room.hostUserId) {
      if (ready && !room.hostBlueprint) return { ok: false, error: 'LOADOUT_REQUIRED' };
      const next = this.startIfReady({ ...room, hostReady: ready, hostSeenAt: now, updatedAt: now }, now);
      this.writeRoom(next);
      if (!room.matchStartAt && next.matchEndAt) await this.ctx.storage.setAlarm(next.matchEndAt + 60_000);
      return { ok: true, room: next };
    }
    if (userId === room.guestUserId) {
      if (ready && !room.guestBlueprint) return { ok: false, error: 'LOADOUT_REQUIRED' };
      const next = this.startIfReady({ ...room, guestReady: ready, guestSeenAt: now, updatedAt: now }, now);
      this.writeRoom(next);
      if (!room.matchStartAt && next.matchEndAt) await this.ctx.storage.setAlarm(next.matchEndAt + 60_000);
      return { ok: true, room: next };
    }
    return { ok: false, error: 'NOT_PARTICIPANT' };
  }

  async selectBlueprint(userId: string, blueprintId: string, now = Date.now()): Promise<RoomResult> {
    if (!this.validIdentity(userId) || !BLUEPRINT_IDS.has(blueprintId) || !Number.isSafeInteger(now)) return { ok: false, error: 'INVALID_LOADOUT' };
    const stored = this.readRoom();
    if (!stored) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const room = this.expireIfDue(stored, now);
    if (!ACTIVE_STATUSES.has(room.status)) return { ok: false, error: 'ROOM_UNAVAILABLE' };
    if (room.matchStartAt) return { ok: false, error: 'MATCH_LOCKED' };
    if (!room.blueprintOffer.includes(blueprintId)) return { ok: false, error: 'LOADOUT_NOT_OFFERED' };
    if (userId === room.hostUserId) {
      const next: RoomState = { ...room, hostBlueprint: blueprintId, hostReady: false, hostSeenAt: now, updatedAt: now };
      this.writeRoom(next);
      return { ok: true, room: next };
    }
    if (userId === room.guestUserId) {
      const next: RoomState = { ...room, guestBlueprint: blueprintId, guestReady: false, guestSeenAt: now, updatedAt: now };
      this.writeRoom(next);
      return { ok: true, room: next };
    }
    return { ok: false, error: 'NOT_PARTICIPANT' };
  }

  async submitProgress(userId: string, score: number, elapsedMs: number, now = Date.now(), enemies = 0): Promise<RoomResult> {
    if (!this.validIdentity(userId) || !Number.isSafeInteger(score) || score < 0 || !Number.isSafeInteger(elapsedMs) || elapsedMs < 0
        || !Number.isSafeInteger(enemies) || enemies < 0 || enemies > 2_000 || !Number.isSafeInteger(now)) {
      return { ok: false, error: 'INVALID_PROGRESS' };
    }
    const stored = this.readRoom();
    if (!stored) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const room = this.expireIfDue(stored, now);
    if (!room.matchStartAt || !room.matchEndAt) return { ok: false, error: 'MATCH_NOT_STARTED' };
    const serverElapsed = Math.max(0, Math.min(DUEL_DURATION_MS, now - room.matchStartAt));
    if (elapsedMs > serverElapsed + 3_000 || elapsedMs > DUEL_DURATION_MS + 1_000) return { ok: false, error: 'INVALID_PROGRESS' };
    const enemyCeiling = spawnedEnemyCeiling(String(room.matchSeed || ''), elapsedMs);
    if (enemies > enemyCeiling) return { ok: false, error: 'PROGRESS_CEILING' };
    // 18 passive points/second plus a deliberately generous 6,000-point ceiling
    // per server-scheduled kill (max combo, dash bonus and rounding included).
    const scoreCeiling = 2_000 + Math.ceil(elapsedMs / 1000) * 20 + enemies * 6_000;
    if (score > scoreCeiling) return { ok: false, error: 'PROGRESS_CEILING' };
    if (userId === room.hostUserId) {
      if (score < room.hostScore) return { ok: false, error: 'PROGRESS_REWIND' };
      if (elapsedMs < room.hostElapsedMs || enemies < room.hostEnemies) return { ok: false, error: 'PROGRESS_REWIND' };
      const next: RoomState = { ...room, hostScore: score, hostElapsedMs: elapsedMs, hostEnemies: enemies,
        hostSamples: room.hostSamples + Number(elapsedMs > room.hostElapsedMs), hostProgressAt: now, hostSeenAt: now, updatedAt: now };
      this.writeRoom(next);
      return { ok: true, room: next };
    }
    if (userId === room.guestUserId) {
      if (score < room.guestScore) return { ok: false, error: 'PROGRESS_REWIND' };
      if (elapsedMs < room.guestElapsedMs || enemies < room.guestEnemies) return { ok: false, error: 'PROGRESS_REWIND' };
      const next: RoomState = { ...room, guestScore: score, guestElapsedMs: elapsedMs, guestEnemies: enemies,
        guestSamples: room.guestSamples + Number(elapsedMs > room.guestElapsedMs), guestProgressAt: now, guestSeenAt: now, updatedAt: now };
      this.writeRoom(next);
      return { ok: true, room: next };
    }
    return { ok: false, error: 'NOT_PARTICIPANT' };
  }

  async finishRun(userId: string, score: number, elapsedMs: number, enemies: number, outcome: string, now = Date.now()): Promise<RoomResult> {
    if (!['timeout', 'destroyed'].includes(outcome)) return { ok: false, error: 'INVALID_FINISH' };
    const progress = await this.submitProgress(userId, score, elapsedMs, now, enemies);
    if (!progress.ok) return progress;
    let room = progress.room;
    if (!room.matchStartAt || !room.matchEndAt) return { ok: false, error: 'MATCH_NOT_STARTED' };
    const matchEndAt = room.matchEndAt;
    const timeoutValid = outcome !== 'timeout' || elapsedMs >= DUEL_DURATION_MS - 3_000 || now >= matchEndAt - 1_000;
    const sampleMinimum = Math.max(1, Math.min(4, Math.floor(elapsedMs / 20_000)));
    const verification: VerificationStatus = timeoutValid
      && (userId === room.hostUserId ? room.hostSamples : room.guestSamples) >= sampleMinimum ? 'verified' : 'invalid';
    if (userId === room.hostUserId) {
      if (room.hostSubmittedAt) return { ok: true, room, duplicateRequest: true };
      room = { ...room, hostSubmittedAt: now, hostVerification: verification, updatedAt: now };
    } else if (userId === room.guestUserId) {
      if (room.guestSubmittedAt) return { ok: true, room, duplicateRequest: true };
      room = { ...room, guestSubmittedAt: now, guestVerification: verification, updatedAt: now };
    } else return { ok: false, error: 'NOT_PARTICIPANT' };
    room = this.finalizeIfReady(room, now);
    this.writeRoom(room);
    if (room.resultStatus !== 'final') await this.ctx.storage.setAlarm(Math.max(now + 1_000, matchEndAt + RESULT_GRACE_MS));
    return { ok: true, room };
  }

  async requestRematch(userId: string, now = Date.now()): Promise<RoomResult> {
    const stored = this.readRoom();
    if (!stored) return { ok: false, error: 'ROOM_NOT_FOUND' };
    let room = this.finalizeIfReady(stored, now, true);
    if (room.resultStatus !== 'final') return { ok: false, error: 'RESULT_PENDING' };
    if (userId === room.hostUserId) room = { ...room, hostRematch: true, updatedAt: now };
    else if (userId === room.guestUserId) room = { ...room, guestRematch: true, updatedAt: now };
    else return { ok: false, error: 'NOT_PARTICIPANT' };
    if (room.hostRematch && room.guestRematch) {
      room = { ...room, round: room.round + 1, expiresAt: now + 10 * 60_000, blueprintOffer: blueprintOffer(),
        hostReady: false, guestReady: false, hostBlueprint: null, guestBlueprint: null, matchSeed: null, matchStartAt: null, matchEndAt: null,
        hostScore: 0, guestScore: 0, hostProgressAt: null, guestProgressAt: null, hostSamples: 0, guestSamples: 0,
        hostElapsedMs: 0, guestElapsedMs: 0, hostEnemies: 0, guestEnemies: 0, hostSubmittedAt: null, guestSubmittedAt: null,
        hostVerification: 'pending', guestVerification: 'pending', resultStatus: 'playing', winnerRole: null, finalizedAt: null,
        hostRematch: false, guestRematch: false, updatedAt: now };
      await this.ctx.storage.setAlarm(room.expiresAt);
    }
    this.writeRoom(room);
    return { ok: true, room };
  }

  async heartbeat(userId: string, now = Date.now()): Promise<RoomResult> {
    if (!this.validIdentity(userId) || !Number.isSafeInteger(now)) return { ok: false, error: 'INVALID_PLAYER' };
    const stored = this.readRoom();
    if (!stored) return { ok: false, error: 'ROOM_NOT_FOUND' };
    const room = this.expireIfDue(stored, now);
    if (!ACTIVE_STATUSES.has(room.status)) return { ok: false, error: room.status === 'expired' ? 'ROOM_EXPIRED' : 'ROOM_UNAVAILABLE' };
    if (userId === room.hostUserId) {
      const next: RoomState = { ...room, hostSeenAt: now, updatedAt: now };
      this.writeRoom(next);
      return { ok: true, room: next };
    }
    if (userId === room.guestUserId) {
      const next: RoomState = { ...room, guestSeenAt: now, updatedAt: now };
      this.writeRoom(next);
      return { ok: true, room: next };
    }
    return { ok: false, error: 'NOT_PARTICIPANT' };
  }

  async alarm(): Promise<void> {
    const room = this.readRoom();
    if (!room) return;
    const now = Date.now();
    if (room.matchEndAt && room.resultStatus !== 'final' && now >= room.matchEndAt + RESULT_GRACE_MS) {
      this.writeRoom(this.finalizeIfReady(room, now, true));
      return;
    }
    this.expireIfDue(room, now, true);
  }

  private migrate(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
        id INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      )
    `);
    const version = this.ctx.storage.sql
      .exec<{ version: number }>('SELECT COALESCE(MAX(id), 0) AS version FROM _sql_schema_migrations')
      .one().version;
    if (version < 1) {
      this.ctx.storage.sql.exec(`
        CREATE TABLE room_state (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          room_id TEXT NOT NULL,
          invite_code TEXT NOT NULL,
          host_user_id TEXT NOT NULL,
          guest_user_id TEXT,
          status TEXT NOT NULL CHECK (status IN ('waiting','matched','cancelled','expired')),
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        INSERT INTO _sql_schema_migrations (id, applied_at) VALUES (1, unixepoch('now') * 1000)
      `);
    }
    if (version < 2) {
      this.ctx.storage.sql.exec(`
        ALTER TABLE room_state ADD COLUMN host_ready INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE room_state ADD COLUMN guest_ready INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE room_state ADD COLUMN host_seen_at INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE room_state ADD COLUMN guest_seen_at INTEGER;
        UPDATE room_state SET host_seen_at = CASE WHEN host_seen_at = 0 THEN updated_at ELSE host_seen_at END;
        INSERT INTO _sql_schema_migrations (id, applied_at) VALUES (2, unixepoch('now') * 1000)
      `);
    }
    if (version < 3) {
      this.ctx.storage.sql.exec(`
        ALTER TABLE room_state ADD COLUMN blueprint_offer TEXT NOT NULL DEFAULT '[]';
        ALTER TABLE room_state ADD COLUMN host_blueprint TEXT;
        ALTER TABLE room_state ADD COLUMN guest_blueprint TEXT;
        ALTER TABLE room_state ADD COLUMN match_seed TEXT;
        ALTER TABLE room_state ADD COLUMN match_start_at INTEGER;
        ALTER TABLE room_state ADD COLUMN match_end_at INTEGER;
        ALTER TABLE room_state ADD COLUMN host_score INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE room_state ADD COLUMN guest_score INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE room_state ADD COLUMN host_progress_at INTEGER;
        ALTER TABLE room_state ADD COLUMN guest_progress_at INTEGER;
        INSERT INTO _sql_schema_migrations (id, applied_at) VALUES (3, unixepoch('now') * 1000)
      `);
    }
    if (version < 4) {
      this.ctx.storage.sql.exec(`
        ALTER TABLE room_state ADD COLUMN round INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE room_state ADD COLUMN host_samples INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE room_state ADD COLUMN guest_samples INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE room_state ADD COLUMN host_elapsed_ms INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE room_state ADD COLUMN guest_elapsed_ms INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE room_state ADD COLUMN host_enemies INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE room_state ADD COLUMN guest_enemies INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE room_state ADD COLUMN host_submitted_at INTEGER;
        ALTER TABLE room_state ADD COLUMN guest_submitted_at INTEGER;
        ALTER TABLE room_state ADD COLUMN host_verification TEXT NOT NULL DEFAULT 'pending';
        ALTER TABLE room_state ADD COLUMN guest_verification TEXT NOT NULL DEFAULT 'pending';
        ALTER TABLE room_state ADD COLUMN result_status TEXT NOT NULL DEFAULT 'playing';
        ALTER TABLE room_state ADD COLUMN winner_role TEXT;
        ALTER TABLE room_state ADD COLUMN finalized_at INTEGER;
        ALTER TABLE room_state ADD COLUMN host_rematch INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE room_state ADD COLUMN guest_rematch INTEGER NOT NULL DEFAULT 0;
        INSERT INTO _sql_schema_migrations (id, applied_at) VALUES (4, unixepoch('now') * 1000)
      `);
    }
  }

  private finalizeIfReady(room: RoomState, now: number, force = false): RoomState {
    if (room.resultStatus === 'final' || !room.matchEndAt) return room;
    if (!force && !(room.hostSubmittedAt && room.guestSubmittedAt)) return { ...room, resultStatus: 'verifying' };
    const hostValid = room.hostVerification === 'verified';
    const guestValid = room.guestVerification === 'verified';
    let winnerRole: WinnerRole = null;
    if (hostValid && !guestValid) winnerRole = 'host';
    else if (!hostValid && guestValid) winnerRole = 'guest';
    else if (hostValid && guestValid) winnerRole = room.hostScore === room.guestScore ? 'draw' : room.hostScore > room.guestScore ? 'host' : 'guest';
    return { ...room, resultStatus: 'final', winnerRole, finalizedAt: now,
      hostVerification: hostValid ? 'verified' : 'invalid', guestVerification: guestValid ? 'verified' : 'invalid', updatedAt: now };
  }

  private startIfReady(room: RoomState, now: number): RoomState {
    if (room.matchStartAt || room.status !== 'matched' || !room.guestUserId
        || !room.hostReady || !room.guestReady || !room.hostBlueprint || !room.guestBlueprint) return room;
    const matchStartAt = now + DUEL_COUNTDOWN_MS;
    const matchEndAt = matchStartAt + DUEL_DURATION_MS;
    return {
      ...room, expiresAt: Math.max(room.expiresAt, matchEndAt + 60_000), matchSeed: secureHex(), matchStartAt, matchEndAt,
      hostScore: 0, guestScore: 0, hostProgressAt: null, guestProgressAt: null, updatedAt: now,
    };
  }

  private validIdentity(value: string): boolean {
    return UUID_PATTERN.test(String(value || ''));
  }

  private validWindow(createdAt: number, expiresAt: number): boolean {
    return Number.isSafeInteger(createdAt) && Number.isSafeInteger(expiresAt)
      && expiresAt > createdAt && expiresAt - createdAt <= 20 * 60_000;
  }

  private readRoom(): RoomState | null {
    const rows = this.ctx.storage.sql.exec<{
      room_id: string; invite_code: string; host_user_id: string; guest_user_id: string | null;
      status: RoomStatus; created_at: number; expires_at: number; updated_at: number;
      host_ready: number; guest_ready: number; host_seen_at: number; guest_seen_at: number | null;
      blueprint_offer: string; host_blueprint: string | null; guest_blueprint: string | null;
      match_seed: string | null; match_start_at: number | null; match_end_at: number | null;
      host_score: number; guest_score: number; host_progress_at: number | null; guest_progress_at: number | null;
      round: number; host_samples: number; guest_samples: number; host_elapsed_ms: number; guest_elapsed_ms: number;
      host_enemies: number; guest_enemies: number; host_submitted_at: number | null; guest_submitted_at: number | null;
      host_verification: VerificationStatus; guest_verification: VerificationStatus; result_status: RoomState['resultStatus'];
      winner_role: WinnerRole; finalized_at: number | null; host_rematch: number; guest_rematch: number;
    }>(`SELECT room_id, invite_code, host_user_id, guest_user_id, status, created_at, expires_at, updated_at,
        host_ready, guest_ready, host_seen_at, guest_seen_at, blueprint_offer, host_blueprint, guest_blueprint,
        match_seed, match_start_at, match_end_at, host_score, guest_score, host_progress_at, guest_progress_at,
        round, host_samples, guest_samples, host_elapsed_ms, guest_elapsed_ms, host_enemies, guest_enemies,
        host_submitted_at, guest_submitted_at, host_verification, guest_verification, result_status, winner_role,
        finalized_at, host_rematch, guest_rematch
      FROM room_state WHERE singleton = 1`).toArray();
    const row = rows[0];
    return row ? {
      roomId: row.room_id, inviteCode: row.invite_code, hostUserId: row.host_user_id,
      guestUserId: row.guest_user_id, status: row.status,
      createdAt: row.created_at, expiresAt: row.expires_at, updatedAt: row.updated_at,
      hostReady: Boolean(row.host_ready), guestReady: Boolean(row.guest_ready),
      hostSeenAt: row.host_seen_at, guestSeenAt: row.guest_seen_at,
      blueprintOffer: JSON.parse(row.blueprint_offer || '[]'),
      hostBlueprint: row.host_blueprint, guestBlueprint: row.guest_blueprint,
      matchSeed: row.match_seed, matchStartAt: row.match_start_at, matchEndAt: row.match_end_at,
      hostScore: row.host_score, guestScore: row.guest_score,
      hostProgressAt: row.host_progress_at, guestProgressAt: row.guest_progress_at,
      round: row.round, hostSamples: row.host_samples, guestSamples: row.guest_samples,
      hostElapsedMs: row.host_elapsed_ms, guestElapsedMs: row.guest_elapsed_ms,
      hostEnemies: row.host_enemies, guestEnemies: row.guest_enemies,
      hostSubmittedAt: row.host_submitted_at, guestSubmittedAt: row.guest_submitted_at,
      hostVerification: row.host_verification, guestVerification: row.guest_verification,
      resultStatus: row.result_status, winnerRole: row.winner_role, finalizedAt: row.finalized_at,
      hostRematch: Boolean(row.host_rematch), guestRematch: Boolean(row.guest_rematch),
    } : null;
  }

  private writeRoom(room: RoomState): void {
    this.ctx.storage.sql.exec(`
      INSERT INTO room_state (singleton, room_id, invite_code, host_user_id, guest_user_id, status, created_at, expires_at, updated_at,
        host_ready, guest_ready, host_seen_at, guest_seen_at, blueprint_offer, host_blueprint, guest_blueprint,
        match_seed, match_start_at, match_end_at, host_score, guest_score, host_progress_at, guest_progress_at,
        round, host_samples, guest_samples, host_elapsed_ms, guest_elapsed_ms, host_enemies, guest_enemies,
        host_submitted_at, guest_submitted_at, host_verification, guest_verification, result_status, winner_role,
        finalized_at, host_rematch, guest_rematch)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(singleton) DO UPDATE SET
        guest_user_id = excluded.guest_user_id,
        status = excluded.status,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at,
        host_ready = excluded.host_ready,
        guest_ready = excluded.guest_ready,
        host_seen_at = excluded.host_seen_at,
        guest_seen_at = excluded.guest_seen_at,
        blueprint_offer = excluded.blueprint_offer,
        host_blueprint = excluded.host_blueprint,
        guest_blueprint = excluded.guest_blueprint,
        match_seed = excluded.match_seed,
        match_start_at = excluded.match_start_at,
        match_end_at = excluded.match_end_at,
        host_score = excluded.host_score,
        guest_score = excluded.guest_score,
        host_progress_at = excluded.host_progress_at,
        guest_progress_at = excluded.guest_progress_at,
        round = excluded.round,
        host_samples = excluded.host_samples,
        guest_samples = excluded.guest_samples,
        host_elapsed_ms = excluded.host_elapsed_ms,
        guest_elapsed_ms = excluded.guest_elapsed_ms,
        host_enemies = excluded.host_enemies,
        guest_enemies = excluded.guest_enemies,
        host_submitted_at = excluded.host_submitted_at,
        guest_submitted_at = excluded.guest_submitted_at,
        host_verification = excluded.host_verification,
        guest_verification = excluded.guest_verification,
        result_status = excluded.result_status,
        winner_role = excluded.winner_role,
        finalized_at = excluded.finalized_at,
        host_rematch = excluded.host_rematch,
        guest_rematch = excluded.guest_rematch
    `, room.roomId, room.inviteCode, room.hostUserId, room.guestUserId, room.status, room.createdAt, room.expiresAt, room.updatedAt,
    Number(room.hostReady), Number(room.guestReady), room.hostSeenAt, room.guestSeenAt,
    JSON.stringify(room.blueprintOffer), room.hostBlueprint, room.guestBlueprint, room.matchSeed, room.matchStartAt, room.matchEndAt,
    room.hostScore, room.guestScore, room.hostProgressAt, room.guestProgressAt,
    room.round, room.hostSamples, room.guestSamples, room.hostElapsedMs, room.guestElapsedMs, room.hostEnemies, room.guestEnemies,
    room.hostSubmittedAt, room.guestSubmittedAt, room.hostVerification, room.guestVerification, room.resultStatus, room.winnerRole,
    room.finalizedAt, Number(room.hostRematch), Number(room.guestRematch));
  }

  private expireIfDue(room: RoomState, now: number, alarmFired = false): RoomState {
    if (!ACTIVE_STATUSES.has(room.status) || (!alarmFired && now < room.expiresAt)) return room;
    const expired: RoomState = { ...room, status: 'expired', updatedAt: now };
    this.writeRoom(expired);
    return expired;
  }
}

export default {
  async fetch(): Promise<Response> {
    return Response.json({ error: 'Not found.' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
