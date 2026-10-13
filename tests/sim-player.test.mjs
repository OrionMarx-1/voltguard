import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulationPlayer } from '../backend/sim/player.mjs';
import { createBayMonitor } from '../backend/bays.mjs';

const epoch = Date.parse('2026-10-09T00:00:00Z');
test('injected clock emits exactly five frames per second, skips duplicates, resets scenario time, and holds the final frame', () => {
  let clock = epoch;
  const frames = [], ticks = [];
  const player = createSimulationPlayer({ now: () => clock, onFrame: frame => frames.push(frame), onTick: tick => ticks.push(tick) });
  player.reset(); assert.equal(frames.length, 5);
  assert.equal(frames.some(frame => frame.bayId === 'B2-06'), false);
  assert.ok(frames.every(frame => frame.seq === 1 && frame.capturedAt === new Date(epoch).toISOString()));
  assert.equal(player.tick(), false); assert.equal(frames.length, 5);
  clock += 1000; player.tick(); assert.equal(frames.length, 10); assert.equal(ticks.at(-1).second, 1);
  player.reset('A'); assert.equal(ticks.at(-1).second, 0);
  assert.equal(frames.at(-4).schemaVersion, 'voltguard-frame-1');
  const firstA = frames.slice(-5).find(frame => frame.bayId === 'B2-03');
  assert.equal(firstA.temperaturesC[19][5], 68);
  clock += 60000; player.tick();
  const lastA = frames.slice(-5).find(frame => frame.bayId === 'B2-03');
  clock += 10000; player.tick();
  assert.deepEqual(frames.slice(-5).find(frame => frame.bayId === 'B2-03').temperaturesC, lastA.temperaturesC);
  assert.equal(lastA.temperaturesC[19][5], 62);
  player.reset('C');
  assert.equal(frames.slice(-5).find(frame => frame.bayId === 'B2-04').temperaturesC[19][8], 65);
  assert.throws(() => player.reset('D'), /SIMULATION_SCENARIO/);
});

test('source timestamps resist timer jitter and do not fabricate danger rates near the B transition', () => {
  let clock = epoch;
  const monitor = createBayMonitor({ now: () => clock }); monitor.reset('jitter-test-session');
  const player = createSimulationPlayer({ now: () => clock, onFrame: monitor.ingestSimulation });
  player.reset('B');
  for (let t = 1; t <= 40; t++) { clock = epoch + t * 1000; player.tick(); }
  clock = epoch + 41900; player.tick();
  assert.equal(monitor.detail('B2-02').assessment.thermal, 'warning');
  clock = epoch + 42010; player.tick();
  const result = monitor.detail('B2-02').assessment;
  assert.equal(result.peakC, 80); assert.equal(result.thermal, 'danger');
  assert.equal(result.riseCPerS, 1.5); assert.equal(result.intervalSeconds, 1);
});

test('start is idempotent, uses a one-second timer, and stop removes it', () => {
  let created = 0, removed = 0, unrefs = 0, callback;
  const timer = { unref() { unrefs++; } };
  const player = createSimulationPlayer({ now: () => epoch, onFrame: () => {},
    setIntervalFn(fn, interval) { assert.equal(interval, 1000); created++; callback = fn; return timer; },
    clearIntervalFn(value) { assert.equal(value, timer); removed++; }
  });
  player.start(); player.start(); assert.equal(created, 1); assert.equal(unrefs, 1);
  assert.equal(callback(), false);
  player.stop(); player.stop(); assert.equal(removed, 1);
  player.start(); assert.equal(created, 2); player.stop(); assert.equal(removed, 2);
});
