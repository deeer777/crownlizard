import { env } from 'cloudflare:workers';
import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import type { DuelRoom } from '../src/index';

const host = '11111111-1111-4111-8111-111111111111';
const guest = '22222222-2222-4222-8222-222222222222';
const rival = '33333333-3333-4333-8333-333333333333';

const create = async (name: string, lifetime = 600_000) => {
  const now = Date.now();
  // Wrangler cannot infer the RPC class across this Worker's external binding
  // in generated test types, so keep the cast local and explicit.
  const stub = env.DUEL_ROOMS.getByName(name) as DurableObjectStub<DuelRoom>;
  const result = await stub.createRoom({ roomId: name, inviteCode: 'PVPK2X79', hostUserId: host, createdAt: now, expiresAt: now + lifetime });
  expect(result.ok).toBe(true);
  return { stub, now };
};

describe('DuelRoom', () => {
  it('creates an idempotent waiting room and rejects self-join', async () => {
    const roomId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const { stub, now } = await create(roomId);
    const duplicate = await stub.createRoom({ roomId, inviteCode: 'PVPK2X79', hostUserId: host, createdAt: now, expiresAt: now + 600_000 });
    expect(duplicate).toMatchObject({ ok: true, duplicateRequest: true });
    expect(await stub.claimGuest(host)).toEqual({ ok: false, error: 'SELF_JOIN' });
  });

  it('serializes the only guest seat', async () => {
    const { stub } = await create('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    const [first, second] = await Promise.all([stub.claimGuest(guest), stub.claimGuest(rival)]);
    expect([first, second].filter(result => result.ok)).toHaveLength(1);
    expect([first, second].filter(result => !result.ok)).toHaveLength(1);
    const state = await stub.getState();
    expect(state.ok && state.room.status).toBe('matched');
  });

  it('allows rollback of the claimed seat before the database commit', async () => {
    const { stub } = await create('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    expect((await stub.claimGuest(guest)).ok).toBe(true);
    expect(await stub.releaseGuest(guest)).toMatchObject({ ok: true, room: { status: 'waiting', guestUserId: null } });
    expect((await stub.claimGuest(rival)).ok).toBe(true);
  });

  it('expires through its durable alarm', async () => {
    const { stub } = await create('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 60_000);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(await stub.getState()).toMatchObject({ ok: true, room: { status: 'expired' } });
  });

  it('only lets a participant cancel', async () => {
    const { stub } = await create('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    expect(await stub.cancelRoom(rival)).toEqual({ ok: false, error: 'NOT_PARTICIPANT' });
    expect(await stub.cancelRoom(host)).toMatchObject({ ok: true, room: { status: 'cancelled' } });
  });

  it('requires normalized loadouts and starts one server-seeded 90-second match', async () => {
    const { stub, now } = await create('ffffffff-ffff-4fff-8fff-ffffffffffff');
    const initial = await stub.getState(now + 1);
    expect(initial.ok && initial.room.blueprintOffer).toHaveLength(3);
    const offer = initial.ok ? initial.room.blueprintOffer : [];
    expect(new Set(offer).size).toBe(3);
    expect(await stub.setReady(host, true, now + 5)).toEqual({ ok: false, error: 'LOADOUT_REQUIRED' });
    expect(await stub.selectBlueprint(host, offer[0], now + 10)).toMatchObject({ ok: true, room: { hostBlueprint: offer[0], hostReady: false } });
    expect((await stub.claimGuest(guest, now + 20)).ok).toBe(true);
    expect(await stub.selectBlueprint(guest, offer[1], now + 25)).toMatchObject({ ok: true, room: { guestBlueprint: offer[1] } });
    expect(await stub.setReady(host, true, now + 30)).toMatchObject({ ok: true, room: { hostReady: true, guestReady: false, matchSeed: null } });
    const started = await stub.setReady(guest, true, now + 40);
    expect(started).toMatchObject({ ok: true, room: { hostReady: true, guestReady: true } });
    if (!started.ok) throw new Error('match did not start');
    expect(started.room.matchSeed).toMatch(/^[0-9a-f]{32}$/);
    expect(started.room.matchStartAt).toBe(now + 4_040);
    expect(started.room.matchEndAt! - started.room.matchStartAt!).toBe(90_000);
    expect(await stub.selectBlueprint(host, offer[2], now + 50)).toEqual({ ok: false, error: 'MATCH_LOCKED' });
    expect(await stub.releaseGuest(guest, now + 60)).toEqual({ ok: false, error: 'MATCH_LOCKED' });
    expect(await stub.cancelRoom(host, now + 65)).toEqual({ ok: false, error: 'MATCH_LOCKED' });
    expect(await stub.heartbeat(host, now + 70)).toMatchObject({ ok: true, room: { hostSeenAt: now + 70 } });
    expect(await stub.setReady(rival, true, now + 50)).toEqual({ ok: false, error: 'NOT_PARTICIPANT' });
  });

  it('accepts only monotonic, time-bounded participant progress', async () => {
    const { stub, now } = await create('13131313-1313-4313-8313-131313131313');
    const state = await stub.getState(now + 1);
    if (!state.ok) throw new Error('room missing');
    await stub.claimGuest(guest, now + 10);
    await stub.selectBlueprint(host, state.room.blueprintOffer[0], now + 20);
    await stub.selectBlueprint(guest, state.room.blueprintOffer[1], now + 30);
    await stub.setReady(host, true, now + 40);
    const started = await stub.setReady(guest, true, now + 50);
    if (!started.ok || !started.room.matchStartAt) throw new Error('match missing');
    const matchStart = started.room.matchStartAt;
    expect(await stub.submitProgress(host, 2400, 2_000, matchStart + 2_100, 1)).toMatchObject({ ok: true, room: { hostScore: 2400 } });
    expect(await stub.submitProgress(host, 2300, 2_500, matchStart + 2_600, 1)).toEqual({ ok: false, error: 'PROGRESS_REWIND' });
    expect(await stub.submitProgress(guest, 3000, 20_000, matchStart + 3_000)).toEqual({ ok: false, error: 'INVALID_PROGRESS' });
    expect(await stub.submitProgress(rival, 100, 2_000, matchStart + 3_000)).toEqual({ ok: false, error: 'NOT_PARTICIPANT' });
    expect(await stub.submitProgress(host, 999_999, 3_000, matchStart + 3_100, 999)).toEqual({ ok: false, error: 'PROGRESS_CEILING' });
  });

  it('applies the internal room schema through version 4', async () => {
    const { stub } = await create('12121212-1212-4212-8212-121212121212');
    await runInDurableObject(stub, async (_instance, state) => {
      const migration = state.storage.sql.exec<{ version: number }>('SELECT MAX(id) AS version FROM _sql_schema_migrations').one();
      const columns = state.storage.sql.exec<{ name: string }>('PRAGMA table_info(room_state)').toArray().map(column => column.name);
      expect(migration.version).toBe(4);
      expect(columns).toEqual(expect.arrayContaining([
        'host_ready', 'guest_ready', 'host_seen_at', 'guest_seen_at', 'blueprint_offer',
        'host_blueprint', 'guest_blueprint', 'match_seed', 'match_start_at', 'match_end_at',
        'host_score', 'guest_score', 'host_progress_at', 'guest_progress_at',
        'host_samples', 'guest_samples', 'host_submitted_at', 'guest_submitted_at',
        'host_verification', 'guest_verification', 'result_status', 'winner_role', 'host_rematch', 'guest_rematch',
      ]));
    });
  });

  it('verifies both finish signals, owns the winner, and starts a rematch only after both votes', async () => {
    const { stub, now } = await create('14141414-1414-4414-8414-141414141414');
    const state = await stub.getState(now + 1);
    if (!state.ok) throw new Error('room missing');
    await stub.claimGuest(guest, now + 10);
    await stub.selectBlueprint(host, state.room.blueprintOffer[0], now + 20);
    await stub.selectBlueprint(guest, state.room.blueprintOffer[1], now + 30);
    await stub.setReady(host, true, now + 40);
    const started = await stub.setReady(guest, true, now + 50);
    if (!started.ok || !started.room.matchStartAt) throw new Error('match missing');
    const at = started.room.matchStartAt;
    await stub.submitProgress(host, 600, 10_000, at + 10_100, 3);
    await stub.submitProgress(guest, 500, 10_000, at + 10_100, 2);
    const hostFinish = await stub.finishRun(host, 900, 18_000, 5, 'destroyed', at + 18_100);
    expect(hostFinish).toMatchObject({ ok: true, room: { resultStatus: 'verifying' } });
    const guestFinish = await stub.finishRun(guest, 700, 17_000, 4, 'destroyed', at + 18_200);
    expect(guestFinish).toMatchObject({ ok: true, room: { resultStatus: 'final', winnerRole: 'host' } });
    expect(await stub.requestRematch(host, at + 19_000)).toMatchObject({ ok: true, room: { hostRematch: true, round: 1 } });
    expect(await stub.requestRematch(guest, at + 19_100)).toMatchObject({ ok: true, room: { round: 2, matchStartAt: null, hostRematch: false, guestRematch: false } });
  });
});
