import test from 'node:test';
import assert from 'node:assert/strict';
import { createBayMonitor } from '../backend/bays.mjs';
import { createVoltGuardServer } from '../backend/server.mjs';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const epoch = Date.parse('2026-10-09T00:00:00Z');
const choice = (level = 'maintain', extras = []) => ({ level, extras, operator: 'P1', viewedMs: 0, aiStance: 'none', aiRunId: null });
function fixture(onDecision) {
  let clock = epoch; const records = [], events = [];
  const monitor = createBayMonitor({ now: () => clock, onAlert: (event, alert) => events.push({ event, alert }), onDecision: onDecision ?? ((record, alert) => records.push({ record, alert })) });
  monitor.reset('session');
  return { monitor, records, events, at: second => { clock = epoch + second * 1000; }, send(value, second, partial = false, bayId = 'B2-02') {
    clock = epoch + second * 1000;
    const matrix = Array.from({ length: 24 }, () => Array(32).fill(value)); if (partial) matrix[0][0] = null;
    monitor.ingestSimulation({ schemaVersion: 'voltguard-frame-1', bayId, seq: second + 1, capturedAt: new Date(clock).toISOString(), temperaturesC: matrix });
  }, decide(input = choice()) { return monitor.decide(monitor.alerts()[0].id, input); } };
}

test('manual downgrade keeps warning severity, extras only keep pending, and every operation captures independent current evidence', () => {
  const f = fixture(); f.send(60, 0);
  f.decide(choice(null, ['dispatch_patrol'])); assert.equal(f.monitor.alerts()[0].status, 'pending');
  f.decide(choice('downgrade')); assert.equal(f.monitor.alerts()[0].status, 'downgraded');
  assert.equal(f.monitor.detail('B2-02').summary.status, 'warning'); assert.equal(f.monitor.detail('B2-02').summary.alertStatus, 'downgraded');
  f.send(60, 1); f.at(1.1); f.decide(choice('maintain', ['notify_manager']));
  assert.equal(f.records.length, 3); assert.equal(f.records[0].record.level, null);
  assert.equal(f.records[2].record.frameSeq, 2); assert.equal(f.records[2].record.at, new Date(epoch + 1100).toISOString());
  for (const { record } of f.records) { assert.equal(record.operatorVerified, false); assert.equal(record.aiUnavailable, true); assert.equal(record.sourceType, 'simulation'); assert.equal(record.exportable, false); assert.equal(record.frame.temperaturesC.length, 24); }
  f.records[0].record.frame.temperaturesC[0][0] = 999;
  assert.equal(f.records[2].record.frame.temperaturesC[0][0], 60); assert.equal(f.monitor.detail('B2-02').frame.temperaturesC[0][0], 60);
});

test('danger cannot be downgraded through any input; operator escalation and call_999 are sticky, handled danger does not reopen', () => {
  for (const extras of [[], ['call_999']]) {
    const f = fixture(); f.send(80, 0);
    assert.throws(() => f.decide(choice('downgrade', extras)), /DANGER_NO_DOWNGRADE/); assert.equal(f.records.length, 0);
  }
  for (const input of [choice('escalate'), choice(null, ['call_999']), choice('downgrade', ['call_999'])]) {
    const f = fixture(); f.send(60, 0); const result = f.decide(input);
    assert.equal(result.decision.level, 'escalate'); assert.equal(result.decision.levelBefore, 'warning'); assert.equal(result.decision.levelAfter, 'danger');
    assert.equal(result.alert.status, 'processing'); assert.equal(result.alert.escalationSource, 'operator');
    f.send(80, 20); assert.equal(f.monitor.alerts()[0].status, 'processing');
    assert.throws(() => f.decide(choice('downgrade')), /DANGER_NO_DOWNGRADE/);
  }
});

test('downgraded warnings reopen at +3°C, >=1°C/s or danger, and maintain reopens on a rule danger escalation', () => {
  const f = fixture(); f.send(60, 0); f.decide(choice('downgrade'));
  for (let t = 1; t < 6; t++) { f.send(60 + .5 * t, t); assert.equal(f.monitor.alerts()[0].status, 'downgraded'); }
  f.send(63, 6); assert.equal(f.monitor.alerts()[0].status, 'pending'); assert.equal(f.events.at(-1).event, 'reopened');
  f.decide(choice('downgrade')); f.send(64, 7); assert.equal(f.monitor.alerts()[0].status, 'pending');
  for (const level of ['downgrade', 'maintain']) {
    const g = fixture(); g.send(60, 0); g.decide(choice(level)); g.send(80, 20);
    assert.equal(g.monitor.alerts()[0].status, 'pending'); assert.equal(g.monitor.alerts()[0].level, 'danger'); assert.equal(g.events.at(-1).event, 'escalated');
  }
});

test('handled alerts close only after ten seconds of continuous normal evidence; pending alerts remain and closure permits a new ID', () => {
  for (const level of ['maintain', 'downgrade', 'escalate']) {
    const f = fixture(); f.send(60, 0); const original = f.monitor.alerts()[0].id; f.decide(choice(level));
    for (let t = 1; t <= 10; t++) { f.send(30, t); assert.equal(f.monitor.alerts().length, 1); }
    f.send(30, 11); assert.equal(f.monitor.alerts().length, 0); assert.equal(f.events.at(-1).event, 'closed');
    assert.equal(f.monitor.detail('B2-02').summary.status, 'normal');
    assert.throws(() => f.monitor.decide(original, choice()), /ALERT_NOT_ACTIVE/);
    f.send(60, 12); assert.notEqual(f.monitor.alerts()[0].id, original);
  }
});

test('disconnection, missing pixels and non-normal frames restart the recovery interval; additional actions do not reset valid evidence', () => {
  const f = fixture(); f.send(60, 0); f.decide();
  for (let t = 1; t <= 5; t++) f.send(30, t);
  f.at(11); assert.equal(f.monitor.alerts()[0].noData, true);
  for (let t = 12; t <= 20; t++) f.send(30, t);
  assert.equal(f.monitor.alerts().length, 1);
  f.send(30, 21, true); f.send(30, 22);
  for (let t = 23; t <= 31; t++) f.send(30, t);
  assert.equal(f.monitor.alerts().length, 1);
  f.decide(choice(null, ['notify_manager'])); f.send(30, 32); assert.equal(f.monitor.alerts().length, 0);
});

test('invalid identity, durations, AI references, extra keys and empty decisions do not mutate alerts or create records', () => {
  const f = fixture(); f.send(60, 0); const before = f.monitor.alerts();
  for (const input of [null, [], { ...choice(), operator: '' }, { ...choice(), operator: 'x'.repeat(21) }, { ...choice(), operator: 'P1\nP2' },
    { ...choice(), viewedMs: -1 }, { ...choice(), viewedMs: .1 }, { ...choice(), viewedMs: Number.MAX_SAFE_INTEGER + 1 },
    { ...choice(), level: 'close' }, choice(null), choice(null, ['unknown']), choice(null, ['call_999', 'call_999']),
    { ...choice(), aiStance: 'confirmed' }, { ...choice(), aiStance: 'rejected' }, { ...choice(), aiRunId: 'invented-ai' }, { ...choice(), frame: {} }]) {
    assert.throws(() => f.decide(input)); assert.deepEqual(f.monitor.alerts(), before); assert.equal(f.records.length, 0);
  }
});

test('a failed decision persistence callback leaves in-memory alert and next downgrade baseline unchanged', () => {
  const f = fixture(() => { throw Error('disk failure'); }); f.send(60, 0); const before = f.monitor.alerts();
  assert.throws(() => f.decide(choice('escalate')), /disk failure/); assert.deepEqual(f.monitor.alerts(), before);
  f.send(61, 1); assert.equal(f.monitor.alerts()[0].status, 'pending'); assert.equal(f.monitor.alerts()[0].level, 'warning');
});

test('queue groups pending before handled alerts, with danger then age within each group', () => {
  const f = fixture(); f.send(80, 0); f.decide(); f.send(60, 1, false, 'B2-08'); f.send(80, 2, false, 'B2-07');
  assert.deepEqual(f.monitor.alerts().map(alert => [alert.bayId, alert.status]), [['B2-07', 'pending'], ['B2-08', 'pending'], ['B2-02', 'processing']]);
});

test('HTTP decisions enforce CSRF/conflicts, append isolated persisted snapshots, publish compact WS, and reset cascades all records', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'voltguard-decisions-')), databasePath = path.join(directory, 'test.sqlite');
  let clock = epoch;
  const app = await createVoltGuardServer({ databasePath, carparkOptions: { autoStart: false, now: () => clock }, copilotOptions: { apiKey: '' } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`, csrf = (await (await fetch(base + '/api/health')).json()).csrf;
  const db = new DatabaseSync(databasePath), messages = [], socket = new WebSocket(base.replace('http', 'ws') + '/ws');
  socket.addEventListener('message', event => messages.push(JSON.parse(event.data)));
  const post = (route, input, headers = {}) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Voltguard-Csrf': csrf, ...headers }, body: JSON.stringify(input) });
  try {
    await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
    await post('/api/demo/scenario', { name: 'A', ai: false });
    const alert = app.carpark.alerts().alerts[0], route = `/api/alerts/${alert.id}/decisions`;
    assert.equal((await post(route, choice(), { 'X-Voltguard-Csrf': '' })).status, 403);
    assert.equal((await post(route, choice(), { Origin: 'https://foreign.invalid' })).status, 403);
    assert.equal((await post(route, { ...choice(), operator: '' })).status, 409);
    assert.equal((await post(route, { ...choice(), aiStance: 'confirmed' })).status, 409);
    db.exec("CREATE TRIGGER fail_decision BEFORE INSERT ON bay_decisions BEGIN SELECT RAISE(ABORT, 'test-only write failure'); END;");
    assert.throws(() => app.carpark.decide(alert.id, choice('escalate')), /test-only write failure/);
    assert.equal(app.carpark.alerts().alerts[0].level, 'warning');
    assert.equal(db.prepare('SELECT level FROM bay_alerts WHERE id=?').get(alert.id).level, 'warning');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM bay_decisions').get().n, 0);
    db.exec('DROP TRIGGER fail_decision');
    for (const level of ['downgrade', 'maintain', 'escalate']) {
      clock += 1000; app.carpark.tick(); const current = app.carpark.detail('B2-08').frame;
      const response = await post(route, choice(level, ['dispatch_patrol'])); assert.equal(response.status, 201);
      const saved = await response.json(); assert.deepEqual(saved.decision.frame, current); assert.equal(saved.decision.frameSeq, current.seq);
    }
    assert.equal((await post(route, choice('downgrade'))).status, 409);
    const details = await (await fetch(base + '/api/bays/B2-08')).json(); assert.equal(details.decisions.length, 3);
    assert.deepEqual(details.decisions.map(row => row.level), ['downgrade', 'maintain', 'escalate']);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM bay_decisions').get().n, 3);
    for (const table of ['telemetry', 'events', 'audit']) assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0);
    await new Promise(resolve => setTimeout(resolve, 20));
    const sent = messages.filter(item => item.type === 'decision'); assert.equal(sent.length, 3);
    assert.ok(sent.every(item => item.report.sourceType === 'simulation' && item.report.exportable === false && !JSON.stringify(item).includes('temperaturesC')));
    assert.equal((await (await fetch(base + '/api/fleet')).json()).records.length, 0);
    await post('/api/demo/reset', {}); assert.equal(db.prepare('SELECT COUNT(*) AS n FROM bay_decisions').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM bay_alerts').get().n, 0);
    assert.equal((await post(route, choice())).status, 409);
    assert.deepEqual(app.carpark.detail('B2-08').decisions, []);
  } finally { socket.close(); db.close(); await app.close(); }
});
