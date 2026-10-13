import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalEnv } from '../backend/local-env.mjs';
import { createAIProvider, BayAIError } from '../backend/ai-provider.mjs';
import { prepareBayAIInput, validateBayAIOutput, BAY_AI_RATIONALE_INSTRUCTION } from '../backend/bay-ai-output.mjs';
import { buildBayCheckCases, buildBayCheckPlan, buildBayDowngradeCounterexamples, prepareBayCheckInput, runLiveBayCheck, summarizeBayChecks, saveBayCheckReport } from '../scripts/live-bay-ai-check.mjs';
import { SCENARIOS } from '../backend/sim/scenarios.mjs';

const samples = buildBayCheckCases();
const reply = expected => ({ ...expected, rationale_zh: '熱源分布仍需由現場人員核實。', rationale_en: 'The heat distribution requires a site inspection.', next_steps: ['observe'] });
const noKey = createAIProvider({ apiKey: '', enabled: false, fetchImpl: () => assert.fail('No real call allowed') });

test('live plan retains all five exact base cases and appends two test-only counterexamples without changing the player', () => {
  const plan = buildBayCheckPlan();
  // Each independent monitor generates a UUID. Assert its integrity, then
  // normalize only that identifier before comparing every evidence field.
  const normalized = cases => cases.map(sample => {
    const copy = structuredClone(sample), id = copy.detail.alert.id;
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(copy.detail.summary.alertId, id);
    copy.detail.alert.id = 'normalized-test-alert'; copy.detail.summary.alertId = 'normalized-test-alert'; return copy;
  });
  assert.equal(plan.length, 7); assert.deepEqual(normalized(plan.slice(0, 5)), normalized(samples));
  assert.deepEqual(plan.map(sample => [sample.scenario, sample.second, Boolean(sample.testOnly)]), [
    ['A', 0, false], ['A', 30, false], ['A', 60, false], ['B', 28, false], ['B', 42, false], ['rising_wheel', 30, true], ['cooling_underbody', 30, true]]);
  assert.deepEqual(plan.slice(5).map(sample => sample.expected.recommendation), ['not_downgrade', 'not_downgrade']);
  assert.deepEqual(Object.keys(SCENARIOS), ['A', 'B', 'C']);
  for (const sample of plan.slice(5)) {
    const formal = prepareBayCheckInput(sample, 'formal');
    assert.equal(JSON.parse(formal.text).isChargingBay, true);
    for (const hidden of ['testOnly', sample.scenario, 'not_downgrade']) assert.equal((formal.system + formal.text).includes(hidden), false);
  }
});

test('single-repeat default plan makes fourteen fixture calls and separately labels both counterexample groups', async () => {
  const plan = buildBayCheckPlan(); let calls = 0; const progress = [];
  const report = await runLiveBayCheck({ repeats: 1, provider: { configured: true, kind: 'test_stub', model: 'fixture', async complete() {
    const sample = plan[Math.floor(calls++ / 2)];
    return { json: reply({ ...sample.expected, recommendation: sample.testOnly ? 'maintain' : sample.expected.recommendation }), model: 'fixture' };
  } }, onProgress: row => progress.push(row) });
  assert.equal(calls, 14); assert.equal(report.plannedChecks, 14); assert.equal(report.attemptedCalls, 14); assert.equal(report.completed, true); assert.equal(report.ok, true);
  assert.deepEqual(report.rows.map(row => [row.scenario, row.group, row.testOnly]), plan.flatMap(sample => ['formal', 'image_only'].map(group => [sample.scenario, group, Boolean(sample.testOnly)])));
  assert.equal(progress.filter(row => row.testOnly).length, 4);
  assert.equal(report.summary.formal.total, 7); assert.equal(report.summary.image_only.total, 7);
});

test('counterexample prohibition accepts maintain or escalate but never downgrade, without relaxing base-case expectations', async () => {
  const cases = buildBayCheckPlan().slice(5);
  for (const recommendation of ['maintain', 'escalate', 'downgrade']) {
    const report = await runLiveBayCheck({ cases, repeats: 1, provider: { configured: true, kind: 'test_stub', async complete() {
      return { json: reply({ cause: 'brake_residual_heat', recommendation }), model: 'fixture' };
    } } });
    if (recommendation === 'downgrade') {
      assert.equal(report.rows.every(row => !row.ok && row.output === null && row.errorCode === 'AI_OUTPUT_DOWNGRADE_RULE' && !row.recommendationMatch), true);
    } else {
      assert.equal(report.rows.every(row => row.ok && row.recommendationMatch), true);
      assert.equal(report.rows.filter(row => row.scenario === 'cooling_underbody').every(row => !row.causeMatch && !row.expectedMatch), true);
    }
  }
  const base = await runLiveBayCheck({ cases: [samples[1]], repeats: 1, provider: { configured: true, kind: 'test_stub', complete: async () => ({ json: reply({ cause: 'brake_residual_heat', recommendation: 'maintain' }), model: 'fixture' }) } });
  assert.equal(base.rows.every(row => row.ok && !row.recommendationMatch && !row.expectedMatch), true);
});

test('counterexamples are test-only charging-bay frames and cannot authorize downgrade', () => {
  const cases = buildBayDowngradeCounterexamples();
  assert.deepEqual(cases.map(sample => sample.scenario), ['rising_wheel', 'cooling_underbody']);
  for (const sample of cases) {
    const data = JSON.parse(prepareBayCheckInput(sample, 'formal').text);
    assert.equal(sample.testOnly, true); assert.equal(sample.exportable, false); assert.equal(data.isChargingBay, true);
    assert.throws(() => validateBayAIOutput(reply({ cause: 'brake_residual_heat', recommendation: 'downgrade' }), data.alertLevel, data), { code: 'AI_OUTPUT_DOWNGRADE_RULE' });
  }
  assert.equal(cases[0].detail.hotspot.zone, 'wheel'); assert.equal(cases[1].detail.hotspot.zone, 'underbody');
});

test('evaluation cases use real scene generators and history: A start/middle/end; B warning/danger', () => {
  assert.deepEqual(samples.map(sample => [sample.scenario, sample.second, sample.detail.alert.level]), [['A', 0, 'warning'], ['A', 30, 'warning'], ['A', 60, 'warning'], ['B', 28, 'warning'], ['B', 42, 'danger']]);
  const data = JSON.parse(prepareBayCheckInput(samples[1], 'formal').text);
  assert.equal(data.peak10SecondsAgoC, 66); assert.equal(data.peak30SecondsAgoC, 68); assert.equal(samples[0].detail.assessment.riseCPerS, null);
  assert.equal(JSON.parse(prepareBayCheckInput(samples[4], 'formal').text).peakC, 80);
  assert.deepEqual(samples.map(sample => sample.expected.recommendation), ['maintain', 'downgrade', 'downgrade', 'escalate', 'escalate']);
});

test('formal input is identical to production; image-only receives no identity, region, severity, trend or charging evidence', () => {
  for (const sample of samples) {
    const formal = prepareBayCheckInput(sample, 'formal'), image = prepareBayCheckInput(sample, 'image_only');
    assert.deepEqual(formal, prepareBayAIInput(sample.detail, sample.detail.alert)); assert.equal(formal.imagePng, image.imagePng);
    assert.equal(image.text, ''); assert.deepEqual(image.schema, formal.schema);
    assert.ok(formal.system.includes(BAY_AI_RATIONALE_INSTRUCTION)); assert.ok(image.system.includes(BAY_AI_RATIONALE_INSTRUCTION));
    for (const value of [sample.detail.bay.id, sample.detail.frame.capturedAt, 'simulation', 'hotspotRegion', 'peakC', 'riseCPerS', 'warning', 'danger', 'charging', 'trend', 'authoritative']) assert.equal((image.system + image.text).includes(value), false);
  }
  assert.throws(() => prepareBayCheckInput(samples[0], 'wrong'), /CHECK_GROUP/);
});

test('unconfigured evaluations do not call or invent results; repeat count and real-provider provenance are enforced', async () => {
  const result = await runLiveBayCheck({ provider: noKey }); assert.equal(result.errorCode, 'AI_NOT_CONFIGURED'); assert.equal(result.attemptedCalls, 0); assert.deepEqual(result.rows, []); assert.equal(result.completed, false);
  await assert.rejects(runLiveBayCheck({ provider: noKey, repeats: 0 }), /CHECK_REPEATS/);
  const stub = { configured: true, kind: 'test_stub', complete: () => assert.fail('Must refuse stub presented as live') };
  assert.equal((await runLiveBayCheck({ provider: stub, execution: 'real_provider' })).errorCode, 'CHECK_REQUIRES_REAL_PROVIDER');
});

test('evaluations run both groups N times without caching and count valid, timely and expected results separately', async () => {
  let calls = 0, time = 0; const progress = [], seen = [];
  // Explicit test fixture, not a real provider or a claimed accuracy result.
  const provider = { configured: true, kind: 'test_stub', model: 'fixture', complete: async input => {
    seen.push(input); time += 125; calls++; return { json: reply(samples[0].expected), model: 'fixture' };
  } };
  const result = await runLiveBayCheck({ provider, cases: [samples[0]], repeats: 3, clock: () => time, onProgress: row => progress.push(row) });
  assert.equal(result.execution, 'test_fixture'); assert.equal(result.attemptedCalls, 6); assert.equal(calls, 6); assert.equal(progress.length, 6); assert.equal(result.ok, true); assert.equal(result.completed, true);
  assert.equal(seen.filter(input => input.text === '').length, 3); assert.equal(new Set(seen.map(input => input.imagePng)).size, 1);
  for (const summary of Object.values(result.summary)) { assert.equal(summary.total, 3); assert.equal(summary.validationRate, 1); assert.equal(summary.expectedMatchRate, 1); assert.equal(summary.validatedWithin10SecondsRate, 1); assert.equal(summary.latency.medianMs, 125); }
  assert.equal(result.sourceType, 'simulation'); assert.equal(result.exportable, false);
  assert.equal(result.rows[0].imageSha256, result.rows[1].imageSha256); assert.notEqual(result.rows[0].inputSha256, result.rows[1].inputSha256);
});

test('provider errors and invalid output are failures; safe unexpected conclusions remain validated but do not pass expectation checks', async () => {
  let n = 0;
  const provider = { configured: true, kind: 'test_stub', complete: async () => {
    n++; if (n === 1) throw new BayAIError('AI_PROVIDER_ERROR');
    if (n === 2) return { json: { ...reply(samples[0].expected), rationale_en: 'Guaranteed safe 99' }, model: 'fixture' };
    return { json: reply({ cause: 'undetermined', recommendation: 'maintain' }), model: 'fixture' };
  } };
  const report = await runLiveBayCheck({ provider, cases: [samples[0]], repeats: 2 });
  assert.equal(report.ok, false); assert.equal(report.completed, true); assert.equal(report.rows[0].errorCode, 'AI_PROVIDER_ERROR'); assert.equal(report.rows[1].errorCode, 'AI_OUTPUT_LANGUAGE');
  assert.equal(report.rows[1].output, null); assert.equal(report.rows[1].rejectedOutput.rationale_en, 'Guaranteed safe 99');
  assert.equal(report.rows[2].ok, true); assert.equal(report.rows[2].expectedMatch, false); assert.equal(report.rows[2].rejectedOutput, undefined);
  for (const summary of Object.values(report.summary)) { assert.equal(summary.validationRate, .5); assert.equal(summary.expectedMatchRate, 0); assert.equal(summary.validatedWithin10SecondsRate, .5); }
});

test('evaluation deadline includes provider wait and rejects late/uncooperative providers; danger downgrade is never valid', async () => {
  const hung = await runLiveBayCheck({ provider: { configured: true, kind: 'test_stub', complete: () => new Promise(() => {}) }, cases: [samples[0]], repeats: 1, timeoutMs: 100 });
  assert.ok(hung.rows.every(row => row.errorCode === 'AI_TIMEOUT')); assert.equal(hung.summary.formal.validatedWithin10SecondsRate, 0);
  const danger = await runLiveBayCheck({ provider: { configured: true, kind: 'test_stub', complete: async () => ({ json: reply({ ...samples[0].expected, recommendation: 'downgrade' }), model: 'malicious-fixture' }) }, cases: [samples[4]], repeats: 1 });
  assert.ok(danger.rows.every(row => row.errorCode === 'AI_OUTPUT_DOWNGRADE_RULE'));
});

test('latency summary uses the full denominator, accurate percentiles and null for absent validated data', () => {
  const rows = [100, 200, 300, 9000].map((latencyMs, i) => ({ latencyMs, ok: i < 3, expectedMatch: i === 0, causeMatch: i === 0, recommendationMatch: i < 2, errorCode: i === 3 ? 'AI_TIMEOUT' : null }));
  const result = summarizeBayChecks(rows); assert.equal(result.latency.medianMs, 250); assert.equal(result.latency.p95Ms, 9000); assert.equal(result.expectedMatchRate, .25); assert.equal(result.expectedMatchRateAmongValidated, 1 / 3); assert.equal(result.validatedWithin10SecondsRate, .75);
  assert.equal(summarizeBayChecks([]).validationRate, null); assert.equal(summarizeBayChecks(rows.slice(3)).validatedLatency.maxMs, null);
});

test('adapter fallback retains schema instructions and an image-only request contains exactly one user image', async () => {
  const calls = [], provider = createAIProvider({ apiKey: 'test-only-key', enabled: true, baseUrl: 'https://fixture.invalid/v1', model: 'fixture', fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    if (calls.length === 1) return new Response(JSON.stringify({ error: { param: 'response_format', message: 'json_schema unsupported' } }), { status: 400 });
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(reply(samples[0].expected)) } }] }));
  } });
  const result = await provider.complete({ ...prepareBayCheckInput(samples[0], 'image_only'), timeoutMs: 1000 });
  assert.equal(result.requests, 2); assert.equal(result.responseFormat, 'json_object'); assert.deepEqual(calls[0].messages, calls[1].messages);
  assert.equal(calls[1].messages[1].content.length, 1); assert.equal(calls[1].messages[1].content[0].type, 'image_url');
  assert.match(calls[1].messages[0].content, /"next_steps"/); assert.match(calls[1].messages[0].content, /"rationale_zh"/);
});

test('private env loading tolerates a missing file, masks read errors and preserves explicit process environment', async () => {
  assert.equal(loadLocalEnv({ load: () => { throw Object.assign(Error('missing'), { code: 'ENOENT' }); } }), false);
  assert.throws(() => loadLocalEnv({ load: () => { throw Error('secret fixture file text'); } }), error => error.message === 'ENV_FILE_UNREADABLE' && !String(error).includes('secret fixture'));
  const directory = await mkdtemp(path.join(tmpdir(), 'voltguard-env-test-')), filename = path.join(directory, '.env');
  await writeFile(filename, 'VOLTGUARD_AI_ENABLED=true\nVOLTGUARD_AI_BASE_URL=https://fixture.invalid/v1\nVOLTGUARD_AI_MODEL=fixture\nVOLTGUARD_AI_API_KEY=private-test-only\n');
  const env = { ...process.env, TEST_ENV_FILENAME: filename }; for (const name of Object.keys(env)) if (name.startsWith('VOLTGUARD_AI_')) delete env[name];
  const source = `import { loadLocalEnv } from './backend/local-env.mjs'; import { createAIProvider } from './backend/ai-provider.mjs'; loadLocalEnv({ filename: process.env.TEST_ENV_FILENAME }); console.log(JSON.stringify({ configured: createAIProvider().configured }));`;
  const run = environment => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', source], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: environment, encoding: 'utf8' }));
  assert.equal(run(env).configured, true); assert.equal(run({ ...env, VOLTGUARD_AI_ENABLED: 'false' }).configured, false);
});

test('evaluation report stays in its own directory, retains outputs and refuses secrets before writing', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'voltguard-bay-report-test-'));
  const report = await runLiveBayCheck({ provider: { configured: true, kind: 'test_stub', complete: async () => ({ json: reply(samples[0].expected), model: 'fixture' }) }, cases: [samples[0]], repeats: 1 });
  const filename = await saveBayCheckReport(report, { directory, apiKey: 'secret-not-in-report' }); assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')), report);
  const before = await readdir(directory); await assert.rejects(saveBayCheckReport({ ...report, model: 'secret-not-in-report' }, { directory, apiKey: 'secret-not-in-report' }), /AI_SECRET_OUTPUT/); assert.deepEqual(await readdir(directory), before);
});
