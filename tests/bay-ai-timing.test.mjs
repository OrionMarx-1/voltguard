import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BayAIError } from '../backend/ai-provider.mjs';
import { buildBayCheckCases, runBayTimingFixture, prepareBayTimingRequest, parseBayTimingResponse, saveBayTimingReport } from '../scripts/live-bay-ai-check.mjs';

const output = () => ({ cause: 'undetermined', recommendation: 'maintain', rationale_zh: '測試替身說明，需進一步核實熱源。', rationale_en: 'Test-stub explanation; inspect the heat source.', next_steps: ['observe'] });
const response = (json = output()) => ({ status: 200, body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(json) } }] }) });
const stub = receive => ({ kind: 'test_stub', model: 'timing-fixture', receive });

test('timing entry reuses one stub sequentially: ten A-start frames, then ten B-warning frames, without semantic rates', async () => {
  let time = 0, active = 0; const seen = [], budgets = [];
  const transport = stub(async (body, { signal, timeoutMs }) => {
    assert.equal(active++, 0); assert.equal(signal.aborted, false); budgets.push(timeoutMs);
    seen.push(JSON.parse(body)); time += 11; active--; return response();
  });
  const report = await runBayTimingFixture({ transport, clock: () => time,
    prepare(sample, model) { time += 3; return prepareBayTimingRequest(sample, model); },
    parseAndValidate(raw, evidence) { time += 2; return parseBayTimingResponse(raw, evidence); } });
  assert.equal(report.rows.length, 20); assert.equal(report.plannedCalls, 20); assert.equal(report.attemptedCalls, 20);
  assert.equal(report.execution, 'test_fixture'); assert.equal(report.realProviderCalls, 0); assert.equal(report.completed, true); assert.equal(report.timeoutMs, 9000);
  assert.deepEqual(report.rows.map(row => [row.scenario, row.second, row.iteration]), [
    ...Array.from({ length: 10 }, (_, i) => ['A', 0, i + 1]), ...Array.from({ length: 10 }, (_, i) => ['B', 28, i + 1])]);
  for (const row of report.rows) { assert.deepEqual(row.timings, { prepareMs: 3, waitMs: 11, parseValidateMs: 2 }); assert.equal(row.totalMs, 16); assert.equal(row.ok, true); }
  assert.deepEqual(budgets, Array(20).fill(8997));
  assert.equal(new Set(seen.slice(0, 10).map(body => body.messages[1].content[1].image_url.url)).size, 1);
  assert.equal(new Set(seen.slice(10).map(body => body.messages[1].content[1].image_url.url)).size, 1);
  assert.notEqual(seen[0].messages[1].content[1].image_url.url, seen[10].messages[1].content[1].image_url.url);
  assert.equal(JSON.parse(seen[0].messages[1].content[0].text).peak30SecondsAgoC, null);
  assert.equal(JSON.parse(seen[10].messages[1].content[0].text).peakC, buildBayCheckCases()[3].detail.assessment.peakC);
  assert.equal(seen.every(body => body.store === false && body.response_format.json_schema.strict === true), true);
  for (const key of ['summary', 'expectedMatchRate', 'expectations']) assert.equal(key in report, false);
});
test('each failed segment preserves measured times and leaves later segments null, with no retries', async () => {
  for (const failingPhase of ['prepareMs', 'waitMs', 'parseValidateMs']) {
    let time = 0, calls = 0;
    const operation = (name, delta, result) => { time += delta; if (name === failingPhase) throw new BayAIError('AI_PROVIDER_ERROR'); return result(); };
    const report = await runBayTimingFixture({ clock: () => time, transport: stub(() => { calls++; return operation('waitMs', 7, response); }),
      prepare: (sample, model) => operation('prepareMs', 3, () => prepareBayTimingRequest(sample, model)),
      parseAndValidate: (raw, evidence) => operation('parseValidateMs', 2, () => parseBayTimingResponse(raw, evidence)) });
    assert.equal(report.rows.length, 20); assert.equal(calls, failingPhase === 'prepareMs' ? 0 : 20);
    for (const row of report.rows) {
      assert.equal(row.failedPhase, failingPhase); assert.equal(row.errorCode, 'AI_PROVIDER_ERROR'); assert.equal(row.ok, false);
      assert.deepEqual(row.timings, { prepareMs: 3, waitMs: failingPhase === 'prepareMs' ? null : 7, parseValidateMs: failingPhase === 'parseValidateMs' ? 2 : null });
    }
  }
});
test('uncooperative wait times out, aborts each attempt, and never invokes parsing or exceeds the original budget', async () => {
  const signals = [];
  const report = await runBayTimingFixture({ transport: stub((_body, { signal }) => { signals.push(signal); return new Promise(() => {}); }), timeoutMs: 10,
    prepare: () => ({ evidence: {}, body: '{}' }), parseAndValidate: () => assert.fail('No response was received') });
  assert.equal(signals.length, 20); assert.equal(signals.every(signal => signal.aborted), true);
  for (const row of report.rows) { assert.equal(row.errorCode, 'AI_TIMEOUT'); assert.equal(row.failedPhase, 'waitMs'); assert.ok(row.timings.prepareMs >= 0); assert.ok(row.timings.waitMs >= 0); assert.equal(row.timings.parseValidateMs, null); }
});
test('preparation and parsing consume the same deadline; the fixture cannot raise it above nine seconds', async () => {
  for (const phase of ['prepareMs', 'parseValidateMs']) {
    let time = 0, calls = 0;
    const report = await runBayTimingFixture({ clock: () => time, transport: stub(() => { calls++; return response(); }),
      prepare: (sample, model) => { if (phase === 'prepareMs') time += 9000; return prepareBayTimingRequest(sample, model); },
      parseAndValidate: () => { time += 9000; return output(); } });
    assert.equal(calls, phase === 'prepareMs' ? 0 : 20); assert.equal(report.rows.every(row => row.errorCode === 'AI_TIMEOUT' && row.failedPhase === phase), true);
  }
  for (const timeoutMs of [10000, Infinity, 0, -1]) await assert.rejects(runBayTimingFixture({ transport: stub(response), timeoutMs }), /TIMING_TIMEOUT/);
});
test('real providers are refused before preparing an image or making any request; arbitrary errors never enter a report', async () => {
  await assert.rejects(runBayTimingFixture({ transport: { kind: 'provider', receive: () => assert.fail('No real API allowed') }, prepare: () => assert.fail('Refuse before preparing') }), /TIMING_REQUIRES_TEST_STUB/);
  const report = await runBayTimingFixture({ transport: stub(() => { throw Error('private-test-secret'); }) });
  assert.equal(report.rows.every(row => row.errorCode === 'TIMING_FIXTURE_ERROR'), true); assert.equal(JSON.stringify(report).includes('private-test-secret'), false);
});
test('body parsing and downgrade validation remain separate from waiting, and never rewrite an invalid answer', () => {
  const sample = buildBayCheckCases()[0], request = prepareBayTimingRequest(sample, 'fixture');
  assert.throws(() => parseBayTimingResponse(response({ ...output(), cause: 'brake_residual_heat', recommendation: 'downgrade' }), request.evidence), { code: 'AI_OUTPUT_DOWNGRADE_RULE' });
  assert.throws(() => parseBayTimingResponse({ status: 200, body: 'invalid' }, request.evidence), { code: 'AI_JSON' });
  assert.throws(() => parseBayTimingResponse({ status: 429, body: '{}' }, request.evidence), { code: 'AI_PROVIDER_RATE_LIMIT' });
  assert.deepEqual(parseBayTimingResponse(response(), request.evidence), output());
});
test('timing reports have a distinct filename/type and secret guards; evaluation reports cannot be saved as timing', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'voltguard-timing-'));
  const report = await runBayTimingFixture({ transport: stub(() => response()) });
  const first = await saveBayTimingReport(report, { directory }), second = await saveBayTimingReport(report, { directory });
  assert.notEqual(first, second); assert.match(path.basename(first), /^timing-fixture-/); assert.equal((await readdir(directory)).length, 2);
  assert.deepEqual(JSON.parse(await readFile(first, 'utf8')), report);
  await assert.rejects(saveBayTimingReport({ ...report, schemaVersion: 'voltguard-bay-ai-evaluation-1' }, { directory }), /TIMING_REPORT_TYPE/);
  await assert.rejects(saveBayTimingReport({ ...report, secret: 'test-only-secret' }, { directory, apiKey: 'test-only-secret' }), /AI_SECRET_OUTPUT/);
  assert.equal((await readdir(directory)).length, 2);
});
test('standalone fixture entry ignores provider environment and never loads env or fetches', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'voltguard-timing-cli-'));
  const entry = fileURLToPath(new URL('../scripts/check-bay-ai-timing-fixture.mjs', import.meta.url));
  const guard = 'globalThis.fetch = () => { throw Error("No network in timing fixture"); }; process.loadEnvFile = () => { throw Error("No private env in timing fixture"); };';
  const result = JSON.parse(execFileSync(process.execPath, ['--import', 'data:text/javascript,' + encodeURIComponent(guard), entry], {
    cwd, env: { ...process.env, VOLTGUARD_AI_ENABLED: 'true', VOLTGUARD_AI_API_KEY: 'timing-fake-key', VOLTGUARD_AI_BASE_URL: 'https://fixture.invalid/v1', VOLTGUARD_AI_MODEL: 'must-not-be-used' }, encoding: 'utf8' }));
  assert.equal(result.completed, true); assert.equal(result.execution, 'test_fixture'); assert.equal(result.rows, 20); assert.equal(result.realProviderCalls, 0);
  const report = JSON.parse(await readFile(result.saved, 'utf8'));
  assert.equal(report.model, 'timing-test-stub-not-a-real-model'); assert.equal(report.rows.every(row => row.ok), true); assert.equal(JSON.stringify(report).includes('timing-fake-key'), false);
});
