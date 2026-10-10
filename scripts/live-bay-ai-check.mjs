import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalEnv } from '../backend/local-env.mjs';
import { createAIProvider, BayAIError } from '../backend/ai-provider.mjs';
import { createBayMonitor } from '../backend/bays.mjs';
import { frameAt, SCENARIOS } from '../backend/sim/scenarios.mjs';
import { prepareBayAIInput, validateBayAIOutput, BAY_AI_RATIONALE_INSTRUCTION } from '../backend/bay-ai-output.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const groups = ['formal', 'image_only'];
const imageOnlySystem = 'Return only a JSON object matching the supplied schema. Review the supplied thermal image and its hotspot shape and distribution. Return Traditional Chinese and English rationales together; no digits, safety guarantees, firefighting, disconnecting power, ventilation or disassembly instructions. Do not declare a fire or claim certainty. Never recommend downgrade for a battery-zone anomaly or an undetermined cause. Use undetermined when evidence is insufficient. Next steps are operator choices only; call_999 requires escalate. The image covers only the outward-facing vehicle end at an angle across the aisle.';

export function buildBayCheckCases() {
  const epoch = Date.parse('2026-10-10T00:00:00Z'), cases = [];
  for (const [scenario, seconds] of [['A', [0, 30, 60]], ['B', [28, 42]]]) {
    let time = epoch; const monitor = createBayMonitor({ now: () => time }); monitor.reset('evaluation', { scenario });
    for (let second = 0; second <= Math.max(...seconds); second++) {
      time = epoch + second * 1000;
      monitor.ingestSimulation({ schemaVersion: 'voltguard-frame-1', bayId: SCENARIOS[scenario].bayId, seq: second + 1, capturedAt: new Date(time).toISOString(), temperaturesC: frameAt(scenario, second) });
      if (seconds.includes(second)) cases.push({ scenario, second, detail: monitor.detail(SCENARIOS[scenario].bayId),
        expected: scenario === 'A' ? { cause: 'brake_residual_heat', recommendation: second === 0 ? 'maintain' : 'downgrade' } : { cause: 'battery_zone_anomaly', recommendation: 'escalate' } });
    }
  }
  return cases;
}

// Evaluation-only synthetic counterexamples. Never registered with the demo player.
export function buildBayDowngradeCounterexamples() {
  const epoch = Date.parse('2026-10-10T00:00:00Z');
  return ['rising_wheel', 'cooling_underbody'].map(name => {
    let time = epoch; const monitor = createBayMonitor({ now: () => time }); monitor.reset('counterexample');
    const base = frameAt(name === 'rising_wheel' ? 'A' : 'B', name === 'rising_wheel' ? 0 : 28);
    for (let second = 0; second <= 30; second++) {
      time = epoch + second * 1000;
      const delta = name === 'rising_wheel' ? (second - 30) * 1.2 : (30 - second) * .1;
      monitor.ingestSimulation({ schemaVersion: 'voltguard-frame-1', bayId: 'B2-02', seq: second + 1, capturedAt: new Date(time).toISOString(), temperaturesC: base.map(row => row.map(value => value + delta)) });
    }
    return { scenario: name, second: 30, testOnly: true, sourceType: 'simulation', exportable: false, detail: monitor.detail('B2-02'),
      expected: { cause: name === 'rising_wheel' ? 'brake_residual_heat' : 'battery_zone_anomaly', recommendation: 'maintain' } };
  });
}

export function prepareBayCheckInput(sample, group) {
  if (!groups.includes(group)) throw new Error('CHECK_GROUP');
  const input = prepareBayAIInput(sample.detail, sample.detail.alert);
  return group === 'formal' ? input : { ...input, system: imageOnlySystem + ' ' + BAY_AI_RATIONALE_INSTRUCTION, text: '' };
}

function statistics(values) {
  if (!values.length) return { medianMs: null, p95Ms: null, maxMs: null };
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
  return { medianMs: n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
    p95Ms: sorted[Math.ceil(n * .95) - 1], maxMs: sorted.at(-1) };
}
export function summarizeBayChecks(rows) {
  const total = rows.length, validated = rows.filter(row => row.ok), timely = validated.filter(row => row.latencyMs <= 10000), aligned = validated.filter(row => row.expectedMatch);
  const rate = count => total ? count / total : null;
  return { total, validated: validated.length, validationRate: rate(validated.length), validatedWithin10Seconds: timely.length, validatedWithin10SecondsRate: rate(timely.length),
    expectedCauseMatches: validated.filter(row => row.causeMatch).length, expectedRecommendationMatches: validated.filter(row => row.recommendationMatch).length,
    expectedMatches: aligned.length, expectedMatchRate: rate(aligned.length), expectedMatchRateAmongValidated: validated.length ? aligned.length / validated.length : null,
    latency: statistics(rows.map(row => row.latencyMs)), validatedLatency: statistics(validated.map(row => row.latencyMs)),
    errors: rows.filter(row => !row.ok).reduce((all, row) => { all[row.errorCode] = (all[row.errorCode] ?? 0) + 1; return all; }, {}) };
}

export async function runLiveBayCheck({ provider, repeats = 3, cases = buildBayCheckCases(), execution = 'test_fixture', timeoutMs = 9000, clock = () => performance.now(), onProgress = () => {} }) {
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 10) throw new Error('CHECK_REPEATS');
  if (!['real_provider', 'test_fixture'].includes(execution)) throw new Error('CHECK_EXECUTION');
  const report = { schemaVersion: 'voltguard-bay-ai-evaluation-1', checkedAt: new Date().toISOString(), execution, sourceType: 'simulation', exportable: false,
    expectations: 'Synthetic scenario labels, not vehicle diagnoses or real-world accuracy.', model: provider.model ?? null, repeats, plannedChecks: cases.length * groups.length * repeats,
    attemptedCalls: 0, completed: false, ok: false, errorCode: null, summary: {}, rows: [] };
  if (!provider.configured) { report.errorCode = 'AI_NOT_CONFIGURED'; return report; }
  if (execution === 'real_provider' && provider.kind !== 'provider') { report.errorCode = 'CHECK_REQUIRES_REAL_PROVIDER'; return report; }
  // Sequential, uncached calls: neither replay the formal answer into the image
  // group nor let one slow response consume a later sample's own budget.
  for (const sample of cases) for (let iteration = 1; iteration <= repeats; iteration++) for (const group of groups) {
    const started = clock(), controller = new AbortController(); let timer;
    const row = { scenario: sample.scenario, second: sample.second, iteration, group, frameSeq: sample.detail.frame.seq, ruleLevel: sample.detail.alert.level,
      expected: sample.expected, model: provider.model ?? null, latencyMs: 0, ok: false, errorCode: null, output: null, causeMatch: false, recommendationMatch: false, expectedMatch: false,
      responseFormat: null, requests: null };
    try {
      const input = prepareBayCheckInput(sample, group), remaining = timeoutMs - (clock() - started);
      const sentEvidence = JSON.parse(group === 'formal' ? input.text : prepareBayAIInput(sample.detail, sample.detail.alert).text);
      row.imageSha256 = createHash('sha256').update(input.imagePng).digest('hex');
      row.inputSha256 = createHash('sha256').update(JSON.stringify(input)).digest('hex');
      if (remaining <= 0) throw new BayAIError('AI_TIMEOUT');
      const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new BayAIError('AI_TIMEOUT')); }, remaining); });
      report.attemptedCalls++;
      const result = await Promise.race([deadline, provider.complete({ ...input, signal: controller.signal, timeoutMs: remaining })]);
      row.model = result.model; row.responseFormat = result.responseFormat ?? null; row.requests = result.requests ?? null;
      if (clock() - started >= timeoutMs) throw new BayAIError('AI_TIMEOUT');
      row.rejectedOutput = result.json;
      row.output = validateBayAIOutput(result.json, row.ruleLevel, sentEvidence); row.ok = true;
      delete row.rejectedOutput;
      row.causeMatch = row.output.cause === sample.expected.cause; row.recommendationMatch = row.output.recommendation === sample.expected.recommendation;
      row.expectedMatch = row.causeMatch && row.recommendationMatch;
    } catch (error) { row.errorCode = error instanceof BayAIError ? error.code : 'AI_UNAVAILABLE'; }
    finally { clearTimeout(timer); row.latencyMs = Math.round(Math.max(0, clock() - started)); }
    report.rows.push(row); onProgress({ completed: report.rows.length, planned: report.plannedChecks, group, scenario: row.scenario, second: row.second, ok: row.ok, expectedMatch: row.expectedMatch, errorCode: row.errorCode, latencyMs: row.latencyMs });
  }
  report.completed = true;
  report.summary = Object.fromEntries(groups.map(group => [group, summarizeBayChecks(report.rows.filter(row => row.group === group))]));
  report.ok = report.rows.length > 0 && report.rows.every(row => row.ok && row.expectedMatch);
  return report;
}

export async function saveBayCheckReport(report, { directory = path.join(root, '.sites-runtime', 'live-bay-ai'), apiKey = '' } = {}) {
  const text = JSON.stringify(report, null, 2);
  if (apiKey && text.includes(apiKey)) throw new Error('AI_SECRET_OUTPUT');
  await mkdir(directory, { recursive: true });
  const filename = path.join(directory, `${report.checkedAt.replace(/[:.]/g, '-')}-${randomUUID()}.json`);
  await writeFile(filename, text, { mode: 0o600 }); return filename;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length && !/^--repeats=(?:[1-9]|10)$/.test(args[0]))) throw new Error('CHECK_ARGUMENTS');
    loadLocalEnv();
    const result = await runLiveBayCheck({ provider: createAIProvider(), repeats: args.length ? Number(args[0].split('=')[1]) : 3, execution: 'real_provider',
      onProgress: progress => console.log(JSON.stringify(progress)) });
    const filename = await saveBayCheckReport(result, { apiKey: process.env.VOLTGUARD_AI_API_KEY ?? '' });
    console.log(JSON.stringify({ completed: result.completed, ok: result.ok, errorCode: result.errorCode, attemptedCalls: result.attemptedCalls, summary: result.summary, saved: filename }, null, 2));
    process.exitCode = result.ok ? 0 : 1;
  } catch (error) { console.error(JSON.stringify({ ok: false, errorCode: ['CHECK_ARGUMENTS', 'ENV_FILE_UNREADABLE', 'AI_SECRET_OUTPUT'].includes(error.message) ? error.message : 'CHECK_FAILED' })); process.exitCode = 1; }
}
