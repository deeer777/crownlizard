import assert from 'node:assert/strict';
import { AsyncSignalLoop } from '../src/async-signal-loop.js';

const scheduled = new Map();
let timerId = 0;
const scheduler = {
  setTimeout(callback, delay) {
    const id = ++timerId;
    scheduled.set(id, { callback, delay });
    return id;
  },
  clearTimeout(id) { scheduled.delete(id); },
};
const takeTimer = () => {
  const [id, timer] = scheduled.entries().next().value || [];
  if (!timer) throw new Error('Expected a scheduled signal.');
  scheduled.delete(id);
  return timer;
};
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

let calls = 0;
let pending = deferred();
let freshness = null;
const loop = new AsyncSignalLoop(async ({ isCurrent }) => {
  calls += 1;
  freshness = isCurrent;
  await pending.promise;
}, 3000, scheduler);

loop.start();
assert.equal(takeTimer().delay, 3000, 'the first poll respects its configured cadence');
const firstRun = loop.run(loop.generation);
assert.equal(calls, 1, 'the scheduled poll starts once');
loop.trigger();
assert.equal(calls, 1, 'a slow request cannot overlap with another poll from the same generation');
assert.equal(scheduled.size, 0, 'the next poll waits until the current request has settled');
pending.resolve();
await firstRun;
assert.equal(scheduled.size, 1, 'the next poll is scheduled after the request completes');

pending = deferred();
takeTimer();
const secondRun = loop.run(loop.generation);
assert.equal(freshness(), true, 'an active response may update its current room');
loop.pause();
assert.equal(freshness(), false, 'backgrounding invalidates an in-flight response');
pending.resolve();
await secondRun;
assert.equal(scheduled.size, 0, 'paused loops do not wake in the background');

pending = deferred();
loop.resume({ immediate: true });
assert.equal(calls, 3, 'foregrounding performs one immediate recovery request');
const resumedFreshness = freshness;
loop.stop();
assert.equal(resumedFreshness(), false, 'closing a view invalidates its outstanding response');
pending.resolve();
await Promise.resolve();
await Promise.resolve();
assert.equal(scheduled.size, 0, 'stopped loops cannot reschedule themselves');

console.log('P2B async signal lifecycle tests passed');
