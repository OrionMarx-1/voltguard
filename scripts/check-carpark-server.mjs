import assert from 'node:assert/strict';
import { createVoltGuardServer } from '../backend/server.mjs';

// Isolated API demonstration: virtual clock jumps to selected seconds.
// Never touches the user's database, measured records, or a model provider.
let clock = Date.now();
const app = await createVoltGuardServer({ databasePath: ':memory:', carparkOptions: { now: () => clock, autoStart: false } });
await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${app.server.address().port}`;
const get = async route => { const response = await fetch(base + route); assert.equal(response.status, 200); return response.json(); };
let socket;
try {
  const { csrf } = await get('/api/health');
  const post = async (route, input) => {
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Voltguard-Csrf': csrf }, body: JSON.stringify(input) });
    assert.equal(response.status, 200); return response.json();
  };
  socket = new WebSocket(base.replace('http', 'ws') + '/ws');
  const messages = [];
  socket.addEventListener('message', event => messages.push(JSON.parse(event.data)));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WS_CONNECT_TIMEOUT')), 2000);
    socket.addEventListener('message', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', error => { clearTimeout(timer); reject(error); }, { once: true });
  });
  clock += 1000; app.carpark.tick();
  const initial = await get('/api/carpark');
  assert.equal(initial.bays.filter(bay => bay.status === 'normal').length, 5);
  assert.deepEqual(initial.bays.filter(bay => bay.noData).map(bay => bay.id), ['B2-06']);
  const results = {};
  for (const [name, bayId, seconds] of [['A', 'B2-03', [0, 1, 28, 42, 60]], ['B', 'B2-02', [0, 1, 27, 28, 41, 42, 46, 50]]]) {
    await post('/api/demo/scenario', { name, ai: false });
    const startedAt = clock, rows = [];
    for (const second of seconds) {
      clock = startedAt + second * 1000; app.carpark.tick();
      const detail = await get(`/api/bays/${bayId}`);
      rows.push({ second, bayId, state: detail.summary.status, connecting: detail.summary.connecting, peakC: Number(detail.summary.peakC.toFixed(1)), zone: detail.hotspot.zone });
    }
    results[name] = rows;
  }
  assert.equal(results.A[0].state, 'warning');
  assert.equal(results.B.find(row => row.second === 28).state, 'warning');
  assert.equal(results.B.find(row => row.second === 42).state, 'danger');
  await post('/api/demo/reset', {});
  const alerts = await get('/api/alerts'); assert.equal(alerts.alerts.length, 0);
  assert.equal((await get('/api/events')).events.length, 0); assert.equal((await get('/api/fleet')).records.length, 0);
  const batches = messages.filter(message => message.type === 'bays');
  assert.ok(batches.length > 0); assert.equal(JSON.stringify(batches).includes('temperaturesC'), false);
  console.log(JSON.stringify({ ok: true, sourceType: 'simulation', clock: 'injected; key seconds only', aiCalls: 0, noDataBays: ['B2-06'], scenarios: results, resetClearedAlerts: true, measuredRecords: 0, websocketBatches: batches.length, websocketHasMatrices: false }, null, 2));
} finally { socket?.close(); await app.close(); }
