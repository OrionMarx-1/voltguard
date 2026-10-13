import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createDemoCarpark } from '../backend/carpark.mjs';
import { createBayAIStub } from '../backend/testing/bay-ai-stub.mjs';
import { createVoltGuardServer } from '../backend/server.mjs';
import { BayAIError } from '../backend/ai-provider.mjs';

const flush = () => new Promise(setImmediate), sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const choice = (level = 'maintain', aiStance = 'none', aiRunId = null) => ({ level, extras: [], operator: 'P1', viewedMs: 1000, aiStance, aiRunId });
function fixture(provider = createBayAIStub({ delayMs: 0 }), aiOptions = {}) {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON');
  let time = Date.parse('2026-10-09T00:00:00Z'); const messages = [];
  const carpark = createDemoCarpark({ db, now: () => time, autoStart: false, provider, aiOptions, broadcast: (type, report) => messages.push({ type, report }) });
  return { db, carpark, messages, tick: seconds => { time += seconds * 1000; carpark.tick(); }, close: () => { carpark.close(); db.close(); } };
}
async function settle(f, bay) {
  for (let i = 0; i < 100; i++) { if (f.carpark.detail(bay).ai.status !== 'waiting') return; await sleep(2); }
  assert.fail('AI test fixture did not settle');
}

test('early frames do not duplicate lifecycle requests; accepted suggestions store AI input separately from the operation frame', async () => {
  const stub = createBayAIStub({ delayMs: 0 }); let calls = 0;
  const f = fixture({ ...stub, complete: args => { calls++; return stub.complete(args); } });
  try {
    f.carpark.play({ name: 'A', ai: true }); await settle(f, 'B2-03');
    const initial = f.carpark.detail('B2-03'); assert.equal(initial.ai.output.recommendation, 'maintain'); assert.deepEqual(initial.ai.output.next_steps, ['observe', 'request_closeup']); assert.equal(initial.ai.testStub, true); assert.equal(calls, 1);
    for (let t = 0; t < 5; t++) { f.tick(1); await flush(); }
    assert.equal(calls, 1); const alertId = initial.alert.id, aiRunId = initial.ai.id;
    f.carpark.decide(alertId, choice('maintain', 'confirmed', aiRunId));
    const after = f.carpark.detail('B2-03'), record = after.decisions[0];
    assert.equal(after.alert.status, 'processing'); assert.equal(after.summary.status, 'warning');
    assert.equal(record.aiUnavailable, false); assert.equal(record.aiRun.id, aiRunId); assert.equal(record.aiRun.frameSeq, initial.frame.seq);
    assert.equal(record.frameSeq, after.frame.seq); assert.notEqual(record.frameSeq, record.aiRun.frameSeq);
    assert.equal(record.exportable, false); assert.equal(record.sourceType, 'simulation');
    f.carpark.decide(alertId, choice('maintain', 'rejected', aiRunId)); assert.equal(f.carpark.detail('B2-03').decisions.at(-1).aiStance, 'rejected');
    assert.throws(() => f.carpark.decide(alertId, choice('downgrade', 'confirmed', aiRunId)), /AI_LEVEL_MISMATCH/);
    f.carpark.decide(alertId, choice('escalate')); await settle(f, 'B2-03');
    assert.equal(calls, 2); assert.equal(f.carpark.detail('B2-03').aiRuns[0].status, 'stale');
    assert.throws(() => f.carpark.decide(alertId, choice('maintain', 'confirmed', aiRunId)), /AI_STALE/);
    assert.equal(f.carpark.detail('B2-03').ai.levelAtRequest, 'danger');
    const events = f.messages.filter(message => message.type === 'ai'); assert.ok(events.length >= 4);
    assert.ok(events.every(message => !JSON.stringify(message).includes('temperaturesC') && !JSON.stringify(message).includes('rationale')));
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM bay_ai_runs').get().n, 2);
    f.carpark.reset(); assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM bay_ai_runs').get().n, 0);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM bay_decisions').get().n, 0); assert.equal(f.carpark.detail('B2-03').aiRuns.length, 0);
    f.carpark.play({ name: 'A', ai: false }); await flush(); assert.equal(calls, 2); assert.equal(f.carpark.detail('B2-03').ai.errorCode, 'AI_DISABLED');
  } finally { f.close(); }
});

test('B warning suggests escalation without changing rule severity; rule danger invalidates the warning run', async () => {
  const f = fixture();
  try {
    f.carpark.play({ name: 'B', ai: true }); f.tick(28); await settle(f, 'B2-02');
    const warning = f.carpark.detail('B2-02'); assert.equal(warning.ai.output.recommendation, 'escalate'); assert.equal(warning.alert.level, 'warning'); assert.equal(warning.alert.status, 'pending');
    f.tick(14); await settle(f, 'B2-02'); const danger = f.carpark.detail('B2-02');
    assert.equal(danger.alert.level, 'danger'); assert.notEqual(danger.ai.id, warning.ai.id); assert.equal(danger.aiRuns[0].status, 'stale');
    assert.throws(() => f.carpark.decide(danger.alert.id, choice('downgrade')), /DANGER_NO_DOWNGRADE/);
    assert.throws(() => f.carpark.decide(danger.alert.id, choice('escalate', 'confirmed', warning.ai.id)), /AI_STALE/);
  } finally { f.close(); }
});

test('malicious provider always asks for downgrade: every A/B frame preserves danger and rejects invalid AI', async () => {
  const f = fixture(createBayAIStub({ delayMs: 0, mode: 'always_downgrade' }));
  try {
    for (const [scenario, bay] of [['A', 'B2-03'], ['B', 'B2-02']]) {
      f.carpark.play({ name: scenario, ai: true });
      for (let t = 0; t <= 50; t++) {
        // Keep A an invalid-downgrade fixture: seven-second gaps never provide
        // exact ten/thirty-second history. Continuous eligible A is tested below.
        if (t) f.tick(scenario === 'A' ? 7 : 1); await settle(f, bay); const detail = f.carpark.detail(bay);
        if (detail.alert?.level === 'danger') {
          assert.equal(detail.ai.status, 'unavailable'); assert.equal(detail.ai.output, null); assert.equal(detail.ai.errorCode, 'AI_OUTPUT_DOWNGRADE_RULE');
          assert.throws(() => f.carpark.decide(detail.alert.id, choice('downgrade')), /DANGER_NO_DOWNGRADE/);
        }
        if (scenario === 'A') {
          assert.equal(detail.ai.status, 'unavailable'); assert.equal(detail.ai.errorCode, 'AI_OUTPUT_DOWNGRADE_RULE'); assert.equal(detail.ai.output, null);
          assert.equal(detail.alert.status, 'pending');
        }
        if (scenario === 'A' && detail.ai.status === 'available') f.carpark.decide(detail.alert.id, choice('downgrade', 'confirmed', detail.ai.id));
      }
    }
  } finally { f.close(); }
});

test('pending A refreshes at simulation seconds ten, twenty and thirty with complete evidence; handled alerts stop frame requests', async () => {
  const stub = createBayAIStub({ delayMs: 0 }), inputs = [];
  const f = fixture({ ...stub, complete: args => { inputs.push(JSON.parse(args.text)); return stub.complete(args); } });
  try {
    f.carpark.play({ name: 'A', ai: true }); await settle(f, 'B2-03');
    const first = f.carpark.detail('B2-03').ai;
    assert.equal(inputs.length, 1); assert.equal(first.frameSeq, 1); assert.equal(first.output.recommendation, 'maintain');
    f.carpark.tick(); await flush(); assert.equal(inputs.length, 1);
    for (let t = 1; t <= 30; t++) { f.tick(1); await settle(f, 'B2-03'); assert.equal(inputs.length, 1 + Math.floor(t / 10), `A second ${t}`); }
    const current = f.carpark.detail('B2-03');
    assert.deepEqual(current.aiRuns.map(run => run.frameSeq), [1, 11, 21, 31]);
    assert.equal(current.aiRuns.slice(0, 3).every(run => run.status === 'stale'), true);
    assert.equal(current.ai.output.recommendation, 'downgrade'); assert.equal(current.alert.level, 'warning');
    assert.equal(inputs.at(-1).peak10SecondsAgoC, 66); assert.equal(inputs.at(-1).peak30SecondsAgoC, 68);
    assert.throws(() => f.carpark.decide(current.alert.id, choice('maintain', 'confirmed', first.id)), /AI_STALE/);
    f.carpark.decide(current.alert.id, choice('downgrade', 'confirmed', current.ai.id));
    f.tick(30); await flush(); assert.equal(inputs.length, 4);
    f.carpark.play({ name: 'A', ai: false }); for (let t = 0; t < 31; t++) f.tick(1);
    await flush(); assert.equal(inputs.length, 4);
  } finally { f.close(); }
});

test('reopened warning triggers one new run and old run cannot be used again', async () => {
  const f = fixture();
  try {
    f.carpark.play({ name: 'B', ai: true }); f.tick(28); await settle(f, 'B2-02');
    const before = f.carpark.detail('B2-02'); f.carpark.decide(before.alert.id, choice('downgrade'));
    f.tick(3); await settle(f, 'B2-02'); const after = f.carpark.detail('B2-02');
    assert.equal(after.alert.status, 'pending'); assert.notEqual(after.ai.id, before.ai.id); assert.equal(after.aiRuns.length, 2);
    assert.throws(() => f.carpark.decide(after.alert.id, choice('escalate', 'confirmed', before.ai.id)), /AI_STALE/);
  } finally { f.close(); }
});

test('refusal, invalid output, timeout and storage failure leave rule/manual operations working', async () => {
  for (const mode of ['refusal', 'invalid', 'timeout', 'storage']) {
    const p = mode === 'timeout' ? { configured: true, complete: () => new Promise(() => {}) } : createBayAIStub({ mode, delayMs: 0 });
    const f = fixture(p, { timeoutMs: 30 });
    try {
      if (mode === 'storage') f.db.exec("CREATE TRIGGER fail_ai BEFORE INSERT ON bay_ai_runs BEGIN SELECT RAISE(ABORT, 'test-only failure'); END;");
      f.carpark.play({ name: 'A', ai: true }); await settle(f, 'B2-03');
      const detail = f.carpark.detail('B2-03'); assert.equal(detail.ai.status, 'unavailable'); assert.equal(detail.ai.output, null);
      assert.equal(detail.summary.status, 'warning'); f.carpark.decide(detail.alert.id, choice('maintain'));
      assert.equal(f.carpark.detail('B2-03').decisions[0].aiUnavailable, true);
    } finally { f.close(); }
  }
});

test('reset during an in-flight run prevents late records or cross-session output', async () => {
  let resolve; const f = fixture({ configured: true, complete: () => new Promise(done => { resolve = done; }) });
  try {
    f.carpark.play({ name: 'A', ai: true }); await flush(); const sessionId = f.carpark.snapshot().session.id;
    f.carpark.reset(); resolve({ json: {}, model: 'late' }); await flush();
    assert.notEqual(f.carpark.snapshot().session.id, sessionId); assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM bay_ai_runs').get().n, 0);
    assert.equal(f.carpark.detail('B2-03').ai.errorCode, 'AI_NO_ALERT');
  } finally { f.close(); }
});

test('AI API decisions are CSRF protected, persisted, and excluded from measured records and exports', async () => {
  const app = await createVoltGuardServer({ databasePath: ':memory:', copilotOptions: { apiKey: '' }, carparkOptions: { provider: createBayAIStub({ delayMs: 0 }), autoStart: false } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve)); const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const csrf = (await (await fetch(base + '/api/health')).json()).csrf;
    const post = (route, input, token = csrf) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Voltguard-Csrf': token }, body: JSON.stringify(input) });
    await post('/api/demo/scenario', { name: 'A', ai: true }); await settle({ carpark: app.carpark }, 'B2-03');
    const detail = await (await fetch(base + '/api/bays/B2-03')).json(), input = choice('maintain', 'confirmed', detail.ai.id), route = `/api/alerts/${detail.alert.id}/decisions`;
    assert.equal((await post(route, input, '')).status, 403); assert.equal((await post(route, { ...input, aiRunId: 'old' })).status, 409);
    assert.equal((await post(route, input)).status, 201); assert.equal(app.carpark.detail('B2-03').decisions.length, 1);
    assert.equal((await (await fetch(base + '/api/events')).json()).events.length, 0); assert.equal((await (await fetch(base + '/api/fleet')).json()).records.length, 0);
    await post('/api/demo/reset', {}); assert.equal((await post(route, input)).status, 409); assert.equal(app.carpark.detail('B2-03').aiRuns.length, 0);
  } finally { await app.close(); }
});
