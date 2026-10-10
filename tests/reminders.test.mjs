import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createDemoCarpark } from '../backend/carpark.mjs';
import { createBayMonitor } from '../backend/bays.mjs';
import { TONES, reminderPolicy, reminderCycleKey, highestReminder } from '../dist/carpark/reminders.mjs';
import { createReminderAudio } from '../dist/carpark/reminder-audio.mjs';

const alert = (level = 'warning', pendingSeconds = 0, id = 'alert') => ({ id, level, status: 'pending', pendingSince: '2026-10-10T00:00:00Z', pendingSeconds });
const choice = (level = 'maintain', extras = []) => ({ level, extras, operator: 'P1', viewedMs: 0, aiStance: 'none', aiRunId: null });
test('reminder boundaries keep the same tone and level: warning at sixty seconds, danger at thirty', () => {
  assert.deepEqual(TONES.warning, { frequencyHz: 880, durationMs: 120, gapMs: 80, count: 2 });
  assert.deepEqual(TONES.danger, { frequencyHz: 1320, durationMs: 80, gapMs: 50, count: 3 });
  for (const [level, threshold] of [['warning', 60], ['danger', 30]]) {
    for (const seconds of [0, threshold - .001, threshold, threshold + 1]) {
      const input = alert(level, seconds), policy = reminderPolicy(input);
      assert.equal(policy.repeatMs, seconds < threshold ? 10000 : 5000);
      assert.equal(policy.overdue, seconds >= threshold); assert.deepEqual(policy.tone, TONES[level]); assert.equal(input.level, level);
    }
  }
});
test('multiple pending alerts choose only the highest audible level, without changing any alert', () => {
  const pending = [alert('warning', 100, 'warning'), alert('danger', 1, 'danger'), alert('danger', 40, 'older-danger')], before = structuredClone(pending);
  assert.equal(highestReminder(pending).id, 'older-danger'); assert.deepEqual(pending, before);
  assert.equal(highestReminder(pending, { enabled: false }), null); assert.equal(highestReminder(pending, { globalMuted: true }), null);
  for (const status of ['processing', 'downgraded', 'closed']) {
    assert.equal(highestReminder([{ ...alert('danger', 100), status }]), null);
    assert.equal(reminderPolicy({ ...alert('danger', 100), status }).overdue, false);
  }
});
test('single mute is exactly sixty seconds, survives a severity change and does not mute a reopened cycle', () => {
  const input = alert(), mutedUntil = new Map([[reminderCycleKey(input), 60000]]);
  assert.equal(highestReminder([input], { mutedUntil, now: 59999 }), null);
  assert.equal(highestReminder([input], { mutedUntil, now: 60000 }).id, input.id);
  assert.equal(highestReminder([{ ...input, level: 'danger' }], { mutedUntil, now: 1000 }), null);
  assert.equal(highestReminder([{ ...input, pendingSince: '2026-10-10T00:00:10Z' }], { mutedUntil, now: 1000 }).id, input.id);
  assert.equal(reminderPolicy(input).pending, true);
});

function audioFixture() {
  let time = 0, factories = 0; const oscillators = [];
  const context = { state: 'suspended', currentTime: 2, destination: {}, resume: async () => { context.state = 'running'; }, close: async () => {},
    createOscillator() { const node = { frequency: { setValueAtTime(value, at) { node.hz = value; node.frequencyAt = at; } }, connect() {}, disconnect() {}, start(at) { node.startAt = at; }, stop(at) { (node.stops ??= []).push(at); } }; oscillators.push(node); return node; },
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; } };
  const player = createReminderAudio({ contextFactory: () => { factories++; return context; }, clock: () => time });
  return { player, context, oscillators, factories: () => factories, at: value => { time = value; } };
}
test('audio requires explicit enable and synthesizes the exact warning and danger groups without files', async () => {
  const f = audioFixture(); assert.equal(f.player.tick([alert()]), null); assert.equal(f.factories(), 0);
  assert.equal(await f.player.enable(), true); assert.equal(f.factories(), 1);
  assert.equal(f.player.tick([alert()]).count, 2);
  assert.deepEqual(f.oscillators.map(node => [node.hz, node.startAt, node.stops[0]]), [[880, 2, 2.12], [880, 2.2, 2.3200000000000003]]);
  f.player.tick([alert(), alert('danger', 0, 'danger')]);
  assert.deepEqual(f.oscillators.slice(2).map(node => [node.hz, node.startAt, node.stops[0]]), [[1320, 2, 2.08], [1320, 2.13, 2.21], [1320, 2.26, 2.34]]);
  assert.equal(f.oscillators[0].stops.at(-1), undefined); assert.equal(f.oscillators[1].stops.at(-1), undefined);
  f.player.close();
});
test('audio repeats at ten then five seconds and cancels scheduled tones on handle or mute', async () => {
  const f = audioFixture(); await f.player.enable();
  f.player.tick([alert()]); f.at(9999); assert.equal(f.player.tick([alert('warning', 59)]), null);
  f.at(10000); assert.equal(f.player.tick([alert('warning', 59)]).frequencyHz, 880);
  f.at(14999); assert.equal(f.player.tick([alert('warning', 60)]), null);
  f.at(15000); assert.equal(f.player.tick([alert('warning', 60)]).frequencyHz, 880);
  assert.equal(f.oscillators.length, 6);
  assert.equal(f.player.tick([alert('warning', 60)], { globalMuted: true }), null);
  assert.equal(f.oscillators.at(-1).stops.at(-1), undefined);
  assert.equal(f.player.tick([alert('warning', 60)]).count, 2);
  assert.equal(f.player.tick([{ ...alert('warning', 60), status: 'processing' }]), null);
  assert.equal(f.oscillators.at(-1).stops.at(-1), undefined); f.player.close();
});
test('failed browser permission remains disabled and never schedules an oscillator', async () => {
  const f = audioFixture(); f.context.resume = async () => { throw Error('test permission failure'); };
  assert.equal(await f.player.enable(), false); assert.equal(f.player.enabled, false); assert.equal(f.player.tick([alert()]), null); assert.equal(f.oscillators.length, 0); f.player.close();
});
test('a newly pending alert immediately prompts one highest-severity group without overlapping sounds', async () => {
  const f = audioFixture(); await f.player.enable();
  f.player.tick([alert()]); f.at(1);
  const next = f.player.tick([alert(), alert('warning', 0, 'new-warning')]);
  assert.equal(next.count, 2); assert.equal(next.frequencyHz, 880); assert.equal(f.oscillators.length, 4);
  assert.equal(f.oscillators[0].stops.at(-1), undefined);
  assert.equal(f.player.tick([alert(), alert('warning', 0, 'new-warning')]), null); f.player.close();
});
test('server age survives reads and extras, stops on a level decision, and restarts when handled alerts reopen', () => {
  const epoch = Date.parse('2026-10-10T00:00:00Z'); let time = epoch;
  const monitor = createBayMonitor({ now: () => time }); monitor.reset('session');
  const send = (seconds, peak) => { time = epoch + seconds * 1000; monitor.ingestSimulation({ schemaVersion: 'voltguard-frame-1', bayId: 'B2-02', seq: seconds + 1, capturedAt: new Date(time).toISOString(), temperaturesC: Array.from({ length: 24 }, () => Array(32).fill(peak)) }); };
  send(0, 60); const id = monitor.alerts()[0].id, initial = monitor.alerts()[0].pendingSince;
  time += 60000; assert.equal(monitor.alerts()[0].pendingSeconds, 60); assert.equal(monitor.detail('B2-02').summary.pendingSeconds, 60);
  monitor.decide(id, choice(null, ['dispatch_patrol'])); assert.equal(monitor.alerts()[0].pendingSince, initial); assert.equal(monitor.alerts()[0].pendingSeconds, 60);
  monitor.decide(id, choice('downgrade')); assert.equal(monitor.alerts()[0].pendingSeconds, null); assert.equal(monitor.alerts()[0].pendingSince, null);
  send(61, 63); assert.equal(monitor.alerts()[0].status, 'pending'); assert.equal(monitor.alerts()[0].pendingSeconds, 0); assert.notEqual(monitor.alerts()[0].pendingSince, initial);
  send(75, 80); assert.equal(monitor.alerts()[0].level, 'danger'); assert.equal(monitor.alerts()[0].pendingSeconds, 14);
  monitor.decide(id, choice()); send(76, 80); assert.equal(monitor.alerts()[0].pendingSeconds, null);
});
test('pending timestamp migrates existing prototype tables and is persisted separately from extras', () => {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON; CREATE TABLE bay_alerts(id TEXT PRIMARY KEY,session_id TEXT,bay_id TEXT,level TEXT,status TEXT,escalation_source TEXT,created_at TEXT,updated_at TEXT);');
  let time = Date.parse('2026-10-10T00:00:00Z');
  const carpark = createDemoCarpark({ db, broadcast() {}, autoStart: false, now: () => time, provider: { configured: false } });
  try {
    carpark.play({ name: 'A', ai: false }); const first = carpark.alerts().alerts[0];
    assert.equal(db.prepare('SELECT pending_since FROM bay_alerts WHERE id=?').get(first.id).pending_since, first.pendingSince);
    time += 60000; carpark.tick(); assert.equal(carpark.alerts().alerts[0].pendingSeconds, 60); assert.equal(carpark.snapshot().bays.find(bay => bay.id === 'B2-03').pendingSeconds, 60);
    carpark.decide(first.id, choice(null, ['notify_manager'])); assert.equal(db.prepare('SELECT pending_since FROM bay_alerts WHERE id=?').get(first.id).pending_since, first.pendingSince);
    carpark.decide(first.id, choice()); assert.equal(db.prepare('SELECT pending_since FROM bay_alerts WHERE id=?').get(first.id).pending_since, null);
    assert.equal('muted' in carpark.detail('B2-03').decisions[0], false);
  } finally { carpark.close(); db.close(); }
});
