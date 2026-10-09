import test from 'node:test';
import assert from 'node:assert/strict';
import { createBayMonitor } from '../backend/bays.mjs';

const epoch = Date.parse('2026-10-09T00:00:00Z');
const matrix = value => Array.from({ length: 24 }, () => Array(32).fill(value));
function fixture() {
  let clock = epoch;
  const notifications = [];
  const monitor = createBayMonitor({ now: () => clock, onAlert: (event, alert) => notifications.push({ event, alert }) });
  monitor.reset('isolated-demo-session');
  const frame = (temperature, t, bayId = 'B2-02') => ({ schemaVersion: 'voltguard-frame-1', bayId, seq: t + 1, capturedAt: new Date(epoch + t * 1000).toISOString(), temperaturesC: matrix(temperature) });
  return { monitor, notifications, frame, at: ms => { clock = epoch + ms; }, send(temperature, t, bayId) { clock = epoch + t * 1000; return monitor.ingestSimulation(frame(temperature, t, bayId)); } };
}

test('normal first frame is connecting; a comparable second frame becomes normal; freshness uses receipt time with a strict five-second boundary', () => {
  const f = fixture();
  assert.ok(f.monitor.summaries().every(bay => bay.status === 'no_data' && bay.noData));
  f.at(3000); f.monitor.ingestSimulation(f.frame(30, 0));
  assert.equal(f.monitor.detail('B2-02').summary.connecting, true);
  assert.equal(f.monitor.detail('B2-02').summary.status, 'no_data');
  f.at(4000); f.monitor.ingestSimulation(f.frame(30, 1));
  assert.equal(f.monitor.detail('B2-02').summary.status, 'normal');
  f.at(9000); assert.equal(f.monitor.detail('B2-02').summary.status, 'normal');
  f.at(9001); assert.equal(f.monitor.detail('B2-02').summary.status, 'no_data');
  assert.equal(f.monitor.detail('B2-02').summary.connecting, false);
  assert.equal(f.monitor.alerts().length, 0);
});

test('a first warning/danger frame alerts immediately without needing a rise rate', () => {
  for (const [temperature, level] of [[60, 'warning'], [80, 'danger']]) {
    const f = fixture(), summary = f.send(temperature, 0);
    assert.equal(summary.status, level);
    assert.equal(summary.noData, false);
    assert.equal(summary.riseCPerS, null);
    assert.equal(f.notifications[0].event, 'created');
    assert.equal(f.monitor.alerts()[0].level, level);
    assert.equal(f.monitor.alerts()[0].sessionId, 'isolated-demo-session');
  }
});

test('demo occupancy follows the scenario configuration instead of inferring a vehicle from an alert', () => {
  const f = fixture();
  f.monitor.reset('scenario-A-session', { scenario: 'A' });
  f.send(30, 0, 'B2-08');
  assert.equal(f.monitor.detail('B2-08').summary.occupied, true);
  assert.equal(f.monitor.alerts().length, 0);
  f.monitor.reset('baseline-session');
  f.send(60, 1, 'B2-08');
  assert.equal(f.monitor.detail('B2-08').summary.occupied, false);
});

test('warning coalesces into one alert, upgrades once to danger, and never falls with cooling or disconnection', () => {
  const f = fixture();
  f.send(60, 0); const id = f.monitor.alerts()[0].id;
  f.send(60, 1); f.send(80, 2); f.send(80, 3); f.send(30, 4);
  assert.equal(f.monitor.alerts().length, 1);
  assert.equal(f.monitor.alerts()[0].id, id);
  assert.equal(f.monitor.alerts()[0].level, 'danger');
  assert.equal(f.monitor.alerts()[0].escalationSource, 'rule');
  assert.deepEqual(f.notifications.map(item => item.event), ['created', 'escalated']);
  f.at(10001);
  const summary = f.monitor.detail('B2-02').summary;
  assert.equal(summary.status, 'danger'); assert.equal(summary.noData, true);
  assert.equal(f.monitor.alerts()[0].status, 'pending');
});

test('unhandled alerts survive more than ten normal seconds, show recovery, and sort by severity then creation time', () => {
  const f = fixture();
  f.send(60, 0, 'B2-08');
  f.send(60, 1, 'B2-07');
  f.send(80, 2, 'B2-02');
  for (let t = 3; t <= 15; t++) f.send(30, t, 'B2-08');
  const alerts = f.monitor.alerts();
  assert.deepEqual(alerts.map(alert => alert.bayId), ['B2-02', 'B2-08', 'B2-07']);
  assert.equal(alerts[1].recovered, true);
  assert.equal(alerts[1].status, 'pending');
  assert.equal(f.monitor.detail('B2-08').summary.status, 'warning');
  f.at(21000); assert.equal(f.monitor.alerts()[1].recovered, false);
});

test('ring buffer retains sixty samples, public detail cannot mutate evidence, and reset drops both history and alerts', () => {
  const f = fixture();
  for (let t = 0; t <= 65; t++) f.send(60, t);
  const detail = f.monitor.detail('B2-02');
  assert.equal(detail.history.length, 60); assert.equal(detail.history[0].seq, 7); assert.equal(detail.history.at(-1).seq, 66);
  detail.frame.temperaturesC[0][0] = 999; detail.alert.level = 'normal';
  const alert = f.monitor.alerts()[0]; alert.level = 'normal';
  assert.equal(f.monitor.detail('B2-02').frame.temperaturesC[0][0], 60);
  assert.equal(f.monitor.alerts()[0].level, 'warning');
  f.monitor.reset('next-demo-session');
  assert.equal(f.monitor.alerts().length, 0);
  assert.equal(f.monitor.detail('B2-02').history.length, 0);
  f.send(30, 66); assert.equal(f.monitor.detail('B2-02').assessment.riseCPerS, null);
});

test('invalid frames cannot replace the latest evidence and frame-reported provenance is ignored', () => {
  const f = fixture();
  const input = { ...f.frame(30, 0), sourceType: 'device', VIN: 'not retained' };
  f.monitor.ingestSimulation(input); input.temperaturesC[0][0] = 999;
  assert.equal(f.monitor.detail('B2-02').frame.sourceType, 'simulation');
  assert.equal(f.monitor.detail('B2-02').frame.VIN, undefined);
  assert.equal(f.monitor.detail('B2-02').frame.temperaturesC[0][0], 30);
  const valid = f.frame(30, 1);
  const invalid = [
    [null, 'FRAME_OBJECT'], [{ ...valid, schemaVersion: 'voltguard-telemetry-1' }, 'FRAME_SCHEMA'],
    [{ ...valid, bayId: 'B2-99' }, 'BAY_ID'], [{ ...valid, seq: 0 }, 'FRAME_SEQUENCE'],
    [{ ...valid, seq: 1.5 }, 'FRAME_SEQUENCE'], [{ ...valid, capturedAt: 'not a date' }, 'TIMESTAMP'],
    [{ ...valid, capturedAt: f.frame(30, 0).capturedAt }, 'OUT_OF_ORDER'],
    [{ ...valid, temperaturesC: [[30]] }, 'FRAME_MATRIX'], [{ ...valid, temperaturesC: matrix(null) }, 'NO_MEASUREMENTS'],
    [{ ...valid, temperaturesC: matrix(1001) }, 'TEMPERATURE']
  ];
  for (const [frame, code] of invalid) {
    assert.throws(() => f.monitor.ingestSimulation(frame), new RegExp(code));
    assert.equal(f.monitor.detail('B2-02').frame.seq, 1);
  }
});

test('bad pixels remain missing and prevent a normal assertion without suppressing a measured warning', () => {
  const f = fixture();
  for (let t = 0; t <= 1; t++) {
    const frame = f.frame(30, t); frame.temperaturesC[0][0] = null;
    f.at(t * 1000); f.monitor.ingestSimulation(frame);
  }
  assert.equal(f.monitor.detail('B2-02').summary.status, 'no_data');
  const frame = f.frame(60, 2); frame.temperaturesC[0][0] = null;
  f.at(2000); f.monitor.ingestSimulation(frame);
  assert.equal(f.monitor.detail('B2-02').summary.status, 'danger'); // actual test-fixture jump is >= 2°C/s
  assert.equal(f.monitor.detail('B2-02').frame.temperaturesC[0][0], null);
});
