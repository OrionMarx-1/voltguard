import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createVoltGuardServer } from '../backend/server.mjs';

async function fixture(databasePath = ':memory:', overrides = {}) {
  let clock = Date.parse('2026-10-09T00:00:00Z');
  const app = await createVoltGuardServer({ databasePath, carparkOptions: { autoStart: false, now: () => clock, ...overrides } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const health = await (await fetch(base + '/api/health')).json();
  return { app, base,
    get: async route => (await fetch(base + route)).json(),
    post: (route, body, headers = {}) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Voltguard-Csrf': health.csrf, ...headers }, body: JSON.stringify(body) }),
    tick(seconds = 1) { clock += seconds * 1000; return app.carpark.tick(); }
  };
}

test('carpark APIs expose six bays, one permanently missing feed, compact summaries and isolated simulation details', async () => {
  const f = await fixture();
  try {
    const initial = await f.get('/api/carpark');
    assert.equal(initial.bays.length, 6); assert.equal(initial.layout.bays.length, 6);
    assert.equal(initial.session.sourceType, 'simulation'); assert.equal(initial.session.exportable, false);
    assert.ok(initial.bays.filter(bay => bay.id !== 'B2-06').every(bay => bay.connecting));
    f.tick();
    const state = await f.get('/api/carpark');
    assert.equal(state.bays.filter(bay => bay.status === 'normal').length, 5);
    assert.deepEqual(state.bays.filter(bay => bay.noData).map(bay => bay.id), ['B2-06']);
    assert.equal(JSON.stringify(state.bays).includes('temperaturesC'), false);
    const detail = await f.get('/api/bays/B2-02');
    assert.equal(detail.frame.temperaturesC.length, 24); assert.equal(detail.frame.temperaturesC[0].length, 32);
    assert.equal(detail.history.length, 2); assert.equal(detail.frame.sourceType, 'simulation');
    assert.equal(detail.ai.errorCode, 'AI_NOT_CONFIGURED');
    assert.equal(detail.session.aiEnabled, false); assert.equal(detail.session.aiConfigured, false);
    assert.equal((await f.get('/api/alerts')).alerts.length, 0);
    assert.equal((await fetch(f.base + '/api/bays/B2-13')).status, 404);
    assert.equal((await f.post('/api/frames', {})).status, 404);
  } finally { await f.app.close(); }
});

test('demo controls require CSRF/trusted origin and reject invalid payloads without resetting the session', async () => {
  const f = await fixture();
  try {
    const id = (await f.get('/api/carpark')).session.id;
    assert.equal((await f.post('/api/demo/scenario', { name: 'A', ai: true }, { 'X-Voltguard-Csrf': '' })).status, 403);
    assert.equal((await f.post('/api/demo/reset', {}, { Origin: 'https://foreign.invalid' })).status, 403);
    for (const body of [null, [], { name: 'C', ai: true }, { name: 'A' }, { name: 'A', ai: 'true' }, { name: 'B', ai: false, sourceType: 'device' }]) {
      assert.equal((await f.post('/api/demo/scenario', body)).status, 422);
      assert.equal((await f.get('/api/carpark')).session.id, id);
    }
    assert.equal((await f.post('/api/demo/reset', { unexpected: true })).status, 422);
    assert.equal((await f.post('/api/demo/reset', {}, { 'Content-Type': 'text/plain' })).status, 422);
    assert.equal((await fetch(f.base + '/api/carpark', { headers: { Origin: 'https://foreign.invalid' } })).status, 403);
    assert.equal((await f.get('/api/carpark')).session.id, id);
  } finally { await f.app.close(); }
});

test('scenario startup clears baseline rate history, A stays warning and B crosses the exact documented seconds', async () => {
  const f = await fixture();
  try {
    f.tick();
    let response = await f.post('/api/demo/scenario', { name: 'A', ai: false }); assert.equal(response.status, 200);
    let detail = await f.get('/api/bays/B2-03');
    assert.equal(detail.summary.status, 'warning'); assert.equal(detail.assessment.riseCPerS, null);
    assert.equal(detail.hotspot.zone, 'wheel'); assert.equal(detail.history.length, 1);
    assert.equal(detail.bay.charging, true); assert.equal(detail.summary.occupied, true); assert.equal(detail.summary.isCharging, false);
    assert.equal(detail.ai.errorCode, 'AI_DISABLED'); assert.equal(detail.session.aiRequested, false);
    for (let t = 1; t <= 60; t++) {
      f.tick(); assert.equal(f.app.carpark.detail('B2-03').summary.status, 'warning', `A second ${t}`);
      // Let HTTP keep-alive timers/socket close events run during the virtual replay.
      // Blocking for a full minute's computation can otherwise reuse an expired socket.
      await new Promise(setImmediate);
    }
    response = await f.post('/api/demo/scenario', { name: 'B', ai: true }); assert.equal(response.status, 200);
    detail = await f.get('/api/bays/B2-02');
    assert.equal(detail.summary.connecting, true); assert.equal(detail.assessment.riseCPerS, null);
    assert.equal(detail.history.length, 1); assert.equal(detail.summary.peakC, 38);
    assert.equal((await f.get('/api/alerts')).alerts.length, 0);
    let alertId;
    for (let t = 1; t <= 50; t++) {
      f.tick(); const bay = f.app.carpark.detail('B2-02');
      assert.equal(bay.summary.status, t < 28 ? 'normal' : t < 42 ? 'warning' : 'danger', `B second ${t}`);
      assert.ok(bay.assessment.riseCPerS < 2);
      if (t === 28) alertId = bay.alert.id;
      if (t >= 28) assert.equal(bay.alert.id, alertId);
      await new Promise(setImmediate);
    }
    assert.equal((await f.get('/api/alerts')).alerts.length, 1);
    assert.equal((await f.get('/api/alerts')).alerts[0].level, 'danger');
    assert.equal((await f.get('/api/bays/B2-02')).summary.peakC, 86);
  } finally { await f.app.close(); }
});

test('sessions and alerts persist in separate tables, reset cascades demo rows, and measured records/exports stay unchanged', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'voltguard-carpark-tests-'));
  const databasePath = path.join(directory, 'test.sqlite'), f = await fixture(databasePath);
  const inspection = new DatabaseSync(databasePath);
  try {
    await f.post('/api/records/nasa', { cell: 'B0005', cycle: 168 });
    const measured = await f.get('/api/events');
    const count = table => inspection.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
    const original = ['telemetry', 'events', 'audit'].map(count);
    await f.post('/api/demo/scenario', { name: 'A', ai: false });
    const sessionId = (await f.get('/api/carpark')).session.id;
    assert.equal(count('demo_sessions'), 1); assert.equal(count('bay_alerts'), 1);
    assert.equal(inspection.prepare('SELECT session_id FROM bay_alerts').get().session_id, sessionId);
    assert.deepEqual(['telemetry', 'events', 'audit'].map(count), original);
    assert.deepEqual(await f.get('/api/events'), measured);
    assert.equal((await f.get('/api/fleet')).records.length, 0);
    assert.equal(JSON.stringify(measured).includes('simulation'), false);
    await f.post('/api/demo/reset', {});
    assert.equal(count('bay_alerts'), 0); assert.equal(count('demo_sessions'), 1);
    assert.equal(inspection.prepare('SELECT id FROM demo_sessions WHERE id=?').get(sessionId), undefined);
    assert.equal((await f.get('/api/alerts')).alerts.length, 0);
    assert.equal((await f.get('/api/bays/B2-03')).summary.occupied, false);
    assert.equal((await f.get('/api/bays/B2-03')).history.length, 1);
    assert.deepEqual(['telemetry', 'events', 'audit'].map(count), original);
    f.tick(); assert.equal((await f.get('/api/carpark')).bays.filter(bay => bay.status === 'normal').length, 5);
  } finally { inspection.close(); await f.app.close(); }
});

test('WS publishes a complete compact bay batch within one second, sends alert changes, and excludes matrices', async () => {
  const f = await fixture();
  let socket;
  try {
    socket = new WebSocket(f.base.replace('http', 'ws') + '/ws');
    const inbox = [], waiting = [];
    socket.addEventListener('message', event => {
      const value = JSON.parse(event.data), index = waiting.findIndex(waiter => waiter.type === value.type);
      if (index < 0) inbox.push(value);
      else { const waiter = waiting.splice(index, 1)[0]; clearTimeout(waiter.timer); waiter.resolve(value); }
    });
    const waitFor = type => {
      const index = inbox.findIndex(item => item.type === type);
      if (index >= 0) return Promise.resolve(inbox.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = { type, resolve, timer: setTimeout(() => reject(new Error(`WS timeout: ${type}`)), 1500) };
        waiting.push(waiter);
      });
    };
    await waitFor('connected');
    const start = performance.now(); f.tick(); const batch = await waitFor('bays');
    assert.ok(performance.now() - start < 1000);
    assert.equal(batch.report.bays.length, 6); assert.equal(batch.report.sourceType, 'simulation');
    assert.equal(batch.report.exportable, false); assert.ok(Buffer.byteLength(JSON.stringify(batch)) < 8192);
    assert.equal(JSON.stringify(batch).includes('temperaturesC'), false);
    await f.post('/api/demo/scenario', { name: 'B', ai: false });
    for (let t = 1; t <= 28; t++) f.tick();
    const created = await waitFor('alert'); assert.equal(created.report.event, 'created');
    assert.equal(created.report.alert.level, 'warning');
    for (let t = 29; t <= 42; t++) f.tick();
    const escalated = await waitFor('alert'); assert.equal(escalated.report.event, 'escalated');
    assert.equal(escalated.report.alert.id, created.report.alert.id); assert.equal(escalated.report.alert.level, 'danger');
    assert.equal(JSON.stringify(escalated).includes('temperaturesC'), false);
  } finally { socket?.close(); await f.app.close(); }
});

test('real timer advances the startup demonstration without manual ticks and is cleaned up on service close', async () => {
  const f = await fixture(':memory:', { autoStart: true, now: Date.now });
  try {
    await new Promise(resolve => setTimeout(resolve, 1100));
    const state = await f.get('/api/carpark');
    assert.equal(state.bays.filter(bay => bay.status === 'normal').length, 5);
    assert.equal(state.bays.find(bay => bay.id === 'B2-06').status, 'no_data');
  } finally { await f.app.close(); }
});
