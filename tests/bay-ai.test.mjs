import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { createAIProvider, BayAIError } from '../backend/ai-provider.mjs';
import { createBayAI, publicAIRun } from '../backend/bay-ai.mjs';
import { prepareBayAIInput, validateBayAIOutput, BAY_AI_SCHEMA, BAY_AI_DOWNGRADE_INSTRUCTION } from '../backend/bay-ai-output.mjs';
import { bayFrameImage } from '../backend/frame-image.mjs';
import { createBayMonitor } from '../backend/bays.mjs';
import { normalizeDecision } from '../backend/bay-decisions.mjs';
import { createAIWaitClock } from '../dist/carpark/ai-view.mjs';
import { temperatureColor } from '../dist/thermal-map.mjs';

const output = () => ({ cause: 'brake_residual_heat', recommendation: 'downgrade', rationale_zh: '輪區熱源分布較集中，建議持續觀察。', rationale_en: 'Heat is concentrated near the wheels. Continue observing.', next_steps: ['observe'] });
const eligibleEvidence = () => ({ alertLevel: 'warning', hotspotRegionId: 'wheel', peakC: 64, peak10SecondsAgoC: 65, peak30SecondsAgoC: 68, isChargingBay: true, isCharging: true });
const flush = () => new Promise(setImmediate), sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function evidence() {
  const monitor = createBayMonitor({ now: () => Date.parse('2026-10-09T00:00:30Z') }); monitor.reset('session');
  monitor.ingestSimulation({ schemaVersion: 'voltguard-frame-1', bayId: 'B2-03', seq: 31, capturedAt: '2026-10-09T00:00:30Z', temperaturesC: Array.from({ length: 24 }, () => Array(32).fill(60)) });
  return { alert: monitor.alerts()[0], detail: monitor.detail('B2-03') };
}
const response = json => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(json) } }] }), { status: 200 });
const input = () => ({ system: 'Return JSON.', text: '{}', imagePng: bayFrameImage(evidence().detail.frame.temperaturesC), schema: BAY_AI_SCHEMA, timeoutMs: 100 });
function provider(fetchImpl, options = {}) { return createAIProvider({ enabled: true, baseUrl: 'https://provider.invalid/v1', model: 'test-model', apiKey: 'test-secret-never-a-real-key', fetchImpl, ...options }); }

test('PNG preserves the shared fixed palette, null hatching and configured outlines without text metadata', () => {
  const matrix = Array.from({ length: 24 }, () => Array(32).fill(60)); matrix[0][0] = null;
  const png = Buffer.from(bayFrameImage(matrix).split(',')[1], 'base64');
  assert.equal(png.readUInt32BE(16), 256); assert.equal(png.readUInt32BE(20), 192);
  let offset = 8; const tags = [], compressed = [];
  while (offset < png.length) { const length = png.readUInt32BE(offset), tag = png.toString('ascii', offset + 4, offset + 8); tags.push(tag); if (tag === 'IDAT') compressed.push(png.subarray(offset + 8, offset + 8 + length)); offset += length + 12; }
  assert.deepEqual(tags, ['IHDR', 'IDAT', 'IEND']);
  const raw = inflateSync(Buffer.concat(compressed)), rgb = (x, y) => [...raw.subarray(y * 769 + 1 + x * 3, y * 769 + 4 + x * 3)];
  assert.deepEqual(rgb(0, 0), [157, 171, 178]);
  const colour = temperatureColor(60), expected = colour.startsWith('#') ? [1, 3, 5].map(i => parseInt(colour.slice(i, i + 2), 16)) : colour.match(/\d+/g).map(Number);
  assert.deepEqual(rgb(12, 12), expected); assert.notDeepEqual(rgb(0, 0), rgb(1, 0));
  assert.throws(() => bayFrameImage([[60]]), /BAY_FRAME_MATRIX/);
});

test('AI input contains one image and minimal evidence, resolves rear-facing labels and missing trend samples', () => {
  const { alert, detail } = evidence(); detail.hotspot.labels = { zh: '後輪', en: 'Rear wheels' }; detail.operator = 'PRIVATE_OPERATOR_ID';
  detail.history.push({ capturedAt: '2026-10-09T00:00:20Z', peakC: 55 });
  const prepared = prepareBayAIInput(detail, alert), data = JSON.parse(prepared.text);
  assert.deepEqual(data.hotspotRegion, detail.hotspot.labels); assert.equal(data.peak10SecondsAgoC, 55); assert.equal(data.peak30SecondsAgoC, null);
  assert.equal(data.cellsAbove60C, 0); assert.equal(prepared.imagePng.startsWith('data:image/png;base64,'), true);
  for (const secret of [alert.id, detail.bay.id, 'capturedAt', 'PRIVATE_OPERATOR_ID', 'simulation', 'scenario']) assert.equal((prepared.text + prepared.system).includes(secret), false);
  assert.equal('operator' in data, false);
});

test('independent validation rejects schema, unsafe instructions, numbers, invalid actions and protected downgrades', () => {
  assert.deepEqual(validateBayAIOutput(output(), 'warning', eligibleEvidence()), output());
  for (const change of [null, { ...output(), extra: true }, { ...output(), cause: 'fire' }, { ...output(), recommendation: 'close' },
    { ...output(), rationale_en: 'Read 60 degrees' }, { ...output(), rationale_en: 'Guaranteed safe' }, { ...output(), rationale_en: 'Disconnect power' },
    { ...output(), rationale_zh: '請拆卸電池' }, { ...output(), rationale_zh: 'x'.repeat(81) }, { ...output(), rationale_en: 'x'.repeat(301) },
    { ...output(), next_steps: [] }, { ...output(), next_steps: ['observe', 'observe'] }, { ...output(), next_steps: ['extinguish'] },
    { ...output(), next_steps: ['call_999'] }, { ...output(), cause: 'battery_zone_anomaly' }, { ...output(), cause: 'undetermined' }]) assert.throws(() => validateBayAIOutput(change, 'warning', eligibleEvidence()), BayAIError);
  assert.throws(() => validateBayAIOutput(output(), 'danger'), /AI_OUTPUT_DOWNGRADE/);
  assert.equal(validateBayAIOutput({ ...output(), cause: 'battery_zone_anomaly', recommendation: 'escalate', next_steps: ['call_999'] }, 'danger').recommendation, 'escalate');
});

test('downgrade requires warning, non-underbody and both non-rising historical peaks; it is never rewritten', () => {
  for (const change of [{ peak10SecondsAgoC: null }, { peak30SecondsAgoC: null }, { hotspotRegionId: 'underbody' },
    { peak10SecondsAgoC: 63 }, { peak30SecondsAgoC: 63 }, { alertLevel: 'danger' }, { alertLevel: 'normal' }, { peakC: NaN }]) {
    const input = output(), data = { ...eligibleEvidence(), ...change };
    assert.throws(() => validateBayAIOutput(input, data.alertLevel, data), { code: 'AI_OUTPUT_DOWNGRADE_RULE' });
    assert.equal(input.recommendation, 'downgrade');
    assert.equal(validateBayAIOutput({ ...input, recommendation: 'maintain' }, data.alertLevel, data).recommendation, 'maintain');
  }
  assert.throws(() => validateBayAIOutput(output(), 'warning'), { code: 'AI_OUTPUT_DOWNGRADE_RULE' });
  assert.throws(() => validateBayAIOutput(output(), 'danger', eligibleEvidence()), { code: 'AI_OUTPUT_DOWNGRADE_RULE' });
  assert.deepEqual(validateBayAIOutput(output(), 'warning', eligibleEvidence()), output());
  assert.deepEqual(validateBayAIOutput(output(), 'warning', { ...eligibleEvidence(), peak10SecondsAgoC: 64, peak30SecondsAgoC: 64 }), output());
  for (const cause of ['battery_zone_anomaly', 'undetermined']) assert.throws(() => validateBayAIOutput({ ...output(), cause }, 'warning', eligibleEvidence()), { code: 'AI_OUTPUT_DOWNGRADE' });
});

test('production prompt includes all five conditions and leaves concentration to visual model judgment', () => {
  const { alert, detail } = evidence(), prepared = prepareBayAIInput(detail, alert);
  assert.ok(prepared.system.includes(BAY_AI_DOWNGRADE_INSTRUCTION));
  for (const clause of ['(1)', '(2)', '(3)', '(4)', '(5)', 'judge from the image', 'small concentrated patch', 'not widespread', 'charging wheel hotspot']) assert.ok(prepared.system.includes(clause));
  assert.equal(JSON.parse(prepared.text).hotspotRegionId, detail.hotspot.zone);
});

test('scheduler validates immutable sent evidence, even when the source history later becomes eligible', async () => {
  const { alert, detail } = evidence(); let resolve;
  const ai = createBayAI({ provider: { configured: true, complete: () => new Promise(done => { resolve = done; }) }, timeoutMs: 1000 });
  try {
    ai.reset('session', true); ai.trigger(alert, detail); await flush();
    detail.history.push({ capturedAt: '2026-10-09T00:00:20Z', peakC: 65 }, { capturedAt: '2026-10-09T00:00:00Z', peakC: 68 });
    detail.hotspot.zone = 'wheel'; resolve({ json: output(), model: 'test-fixture' }); await flush();
    assert.equal(ai.latest(alert.id).status, 'unavailable'); assert.equal(ai.latest(alert.id).errorCode, 'AI_OUTPUT_DOWNGRADE_RULE'); assert.equal(ai.latest(alert.id).output, null);
  } finally { ai.close(); }
});

test('adapter sends image + strict JSON schema and falls back only for an explicitly unsupported format', async () => {
  const calls = [], p = provider(async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return calls.length === 1 ? new Response(JSON.stringify({ error: { param: 'response_format', code: 'unsupported', message: 'json_schema not supported' } }), { status: 400 }) : response(output());
  });
  assert.equal((await p.complete(input())).json.cause, 'brake_residual_heat'); assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://provider.invalid/v1/chat/completions'); assert.equal(calls[0].options.headers.Authorization, 'Bearer test-secret-never-a-real-key');
  assert.equal(calls[0].body.response_format.json_schema.strict, true); assert.equal(calls[1].body.response_format.type, 'json_object');
  assert.equal(calls[0].body.messages[1].content[1].image_url.url, input().imagePng);
  assert.deepEqual(calls[0].body.messages, calls[1].body.messages); assert.equal(calls[0].body.store, false);
  let count = 0;
  await assert.rejects(provider(async () => { count++; return new Response(JSON.stringify({ error: { message: 'wrong credentials' } }), { status: 401 }); }).complete(input()), /AI_PROVIDER_ERROR/); assert.equal(count, 1);
});

test('adapter handles refusals, bad JSON, incomplete responses and redacts echoed credentials', async () => {
  for (const [body, code] of [
    [{ choices: [{ finish_reason: 'stop', message: { refusal: 'No' } }] }, 'AI_REFUSAL'],
    [{ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }, 'AI_INCOMPLETE'],
    [{ choices: [{ finish_reason: 'stop', message: { content: 'not json' } }] }, 'AI_JSON'],
    [{ error: 'test-secret-never-a-real-key' }, 'AI_PROVIDER_ERROR']
  ]) await assert.rejects(provider(async () => new Response(JSON.stringify(body))).complete(input()), error => error.message === code && !JSON.stringify(error).includes('test-secret'));
  const unconfigured = provider(() => assert.fail('Disabled AI must not fetch'), { enabled: false });
  assert.equal(unconfigured.configured, false); await assert.rejects(unconfigured.complete(input()), /AI_NOT_CONFIGURED/);
});

test('one adapter deadline covers response parsing and fallback; cancellation never accepts a late result', async () => {
  const hung = provider(async () => ({ ok: true, json: () => new Promise(() => {}) }));
  await assert.rejects(hung.complete({ ...input(), timeoutMs: 15 }), /AI_TIMEOUT/);
  let count = 0;
  const fallback = provider(async () => { count++; if (count === 1) return new Response(JSON.stringify({ error: { param: 'response_format', message: 'unsupported' } }), { status: 400 }); return new Promise(() => {}); });
  await assert.rejects(fallback.complete({ ...input(), timeoutMs: 15 }), /AI_TIMEOUT/); assert.equal(count, 2);
  const controller = new AbortController(), cancelled = hung.complete({ ...input(), signal: controller.signal }); controller.abort();
  await assert.rejects(cancelled, /AI_CANCELLED/);
});

test('scheduler limits global concurrency and serialises each alert while invalidating old in-flight results', async () => {
  const pending = [], runs = [], { alert, detail } = evidence();
  const ai = createBayAI({ provider: { configured: true, complete: args => new Promise(resolve => pending.push({ resolve, args })) }, onRun: run => runs.push(run), timeoutMs: 1500 });
  try {
    ai.reset('session', true); ai.trigger(alert, detail); ai.trigger({ ...alert, id: 'second' }, detail); ai.trigger({ ...alert, id: 'third' }, detail); await flush();
    assert.equal(pending.length, 2); assert.equal(ai.activeCount, 2);
    const firstId = ai.latest(alert.id).id;
    ai.trigger({ ...alert, level: 'danger' }, { ...detail, frame: { ...detail.frame, seq: 32 } }); await flush();
    assert.equal(pending[0].args.signal.aborted, true); assert.equal(pending.length, 2);
    pending[0].resolve({ json: output(), model: 'old' }); await flush(); assert.equal(pending.length, 3);
    pending[1].resolve({ json: output(), model: 'second' }); await flush(); assert.equal(pending.length, 4);
    pending[3].resolve({ json: { ...output(), recommendation: 'maintain' }, model: 'new' }); pending[2].resolve({ json: output(), model: 'third' }); await flush();
    assert.equal(ai.latest(alert.id).levelAtRequest, 'danger'); assert.equal(ai.latest(alert.id).frameSeq, 32); assert.equal(ai.latest(alert.id).model, 'new');
    assert.equal(runs.findLast(run => run.id === firstId).status, 'stale'); assert.equal(ai.activeCount, 0);
  } finally { ai.close(); }
});

test('queue time counts toward deadline, invalid output stays private, and reset discards late writes', async () => {
  const { alert, detail } = evidence(), persisted = [], pending = [];
  const ai = createBayAI({ provider: { configured: true, complete: () => new Promise(resolve => pending.push(resolve)) }, timeoutMs: 1000, onRun: run => persisted.push(run) });
  try {
    ai.reset('session', true); for (const id of ['a', 'b', 'c']) ai.trigger({ ...alert, id }, detail);
    await flush(); assert.equal(pending.length, 2); await sleep(1100);
    for (const id of ['a', 'b', 'c']) { assert.equal(ai.latest(id).errorCode, 'AI_TIMEOUT'); assert.equal(ai.latest(id).output, null); }
    ai.reset('session', true); ai.trigger(alert, detail); await flush(); pending.at(-1)({ json: { ...output(), rationale_en: 'Guaranteed safe 99' }, model: 'malicious' }); await flush();
    assert.equal(ai.latest(alert.id).status, 'unavailable'); assert.equal(ai.latest(alert.id).output, null);
    const rejected = persisted.at(-1); assert.ok(rejected.rejectedOutput); assert.equal(rejected.model, 'malicious'); assert.equal('rejectedOutput' in publicAIRun(rejected), false);
    ai.trigger(alert, detail); await flush(); ai.reset('next-session', true); const count = persisted.length;
    pending.at(-1)({ json: output(), model: 'late' }); await flush(); assert.equal(persisted.length, count); assert.equal(ai.latest(alert.id).errorCode, 'AI_NO_ALERT');
    ai.reset('next-session', false); ai.trigger({ ...alert, sessionId: 'next-session' }, detail); assert.equal(ai.latest(alert.id).errorCode, 'AI_DISABLED');
  } finally { ai.close(); }
});

test('AI-linked decisions require latest current run, explicit level, recommendation match and protected cause guards', () => {
  const { alert } = evidence(), ai = { id: 'run', alertId: alert.id, sessionId: alert.sessionId, status: 'available', ok: true, levelAtRequest: 'warning', output: output() };
  const choice = { operator: 'P1', viewedMs: 0, level: 'downgrade', extras: [], aiStance: 'confirmed', aiRunId: 'run' };
  assert.equal(normalizeDecision(choice, alert, ai).aiUnavailable, false);
  for (const change of [{ ...choice, aiRunId: 'old' }, { ...choice, level: null }, { ...choice, level: 'maintain' }]) assert.throws(() => normalizeDecision(change, alert, ai));
  assert.throws(() => normalizeDecision(choice, alert, { ...ai, output: { ...output(), cause: 'battery_zone_anomaly' } }), /DANGER_NO_DOWNGRADE/);
  assert.throws(() => normalizeDecision(choice, { ...alert, level: 'danger' }, { ...ai, levelAtRequest: 'danger' }), /DANGER_NO_DOWNGRADE/);
  assert.throws(() => normalizeDecision(choice, alert, { ...ai, status: 'stale' }), /AI_UNAVAILABLE/);
  assert.equal(normalizeDecision({ ...choice, aiStance: 'rejected', level: 'maintain' }, alert, ai).level, 'maintain');
});

test('UI wait budget is bounded and cannot be extended by repeated reads or wall-clock timestamps', () => {
  let time = 0; const read = createAIWaitClock(() => time), ai = { id: 'run', status: 'waiting', remainingMs: 9000, createdAt: '2099-01-01' };
  assert.equal(read(ai).status, 'waiting'); time = 8999; assert.equal(read(ai).status, 'waiting'); time = 9000; assert.equal(read({ ...ai, remainingMs: 9000 }).errorCode, 'AI_TIMEOUT');
  assert.equal(read({ ...ai, id: 'new' }).status, 'waiting'); time = 19001; assert.equal(read({ ...ai, id: 'new', remainingMs: 999999 }).status, 'unavailable');
});
