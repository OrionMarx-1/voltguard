// Safe standalone entry: imports the timing library but never executes the live CLI.
// Does not load .env and does not construct an API provider.
import { runBayTimingFixture, saveBayTimingReport } from './live-bay-ai-check.mjs';

try {
  if (process.argv.length !== 2) throw Error('TIMING_ARGUMENTS');
  const transport = { kind: 'test_stub', model: 'timing-test-stub-not-a-real-model', async receive(body) {
    const evidence = JSON.parse(JSON.parse(body).messages[1].content[0].text), wheel = evidence.hotspotRegionId === 'wheel';
    const output = { cause: wheel ? 'brake_residual_heat' : 'battery_zone_anomaly', recommendation: wheel ? 'maintain' : 'escalate',
      rationale_zh: '測試替身預設說明，只驗證分段計時流程。', rationale_en: 'Preset test-stub explanation for checking segmented timing only.', next_steps: ['observe'] };
    return { status: 200, body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(output) } }] }) };
  } };
  const report = await runBayTimingFixture({ transport }), saved = await saveBayTimingReport(report);
  console.log(JSON.stringify({ completed: report.completed, execution: report.execution, reportType: report.reportType, realProviderCalls: 0, rows: report.rows.length, saved }, null, 2));
  process.exitCode = report.rows.every(row => row.ok) ? 0 : 1;
} catch (error) {
  console.error(JSON.stringify({ ok: false, errorCode: error.message === 'TIMING_ARGUMENTS' ? 'TIMING_ARGUMENTS' : 'TIMING_FIXTURE_FAILED' })); process.exitCode = 1;
}
