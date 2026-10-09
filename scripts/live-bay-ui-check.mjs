// Opt-in only: uses the private .env and sends real simulation frames to the
// configured provider. Ordinary qa-* scripts continue to use test fixtures.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
import { loadLocalEnv } from '../backend/local-env.mjs';
import { createAIProvider } from '../backend/ai-provider.mjs';
import { createVoltGuardServer } from '../backend/server.mjs';
import { saveBayCheckReport } from './live-bay-ai-check.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Admin1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let app, browser, timer, check = 'configuration';
try {
  loadLocalEnv();
  const real = createAIProvider();
  if (!real.configured) throw Error('AI_NOT_CONFIGURED');
  let clock = Date.now(), calls = 0;
  const provider = { ...real, complete: args => { calls++; return real.complete(args); } };
  app = await createVoltGuardServer({ databasePath: ':memory:', copilotOptions: { apiKey: '' },
    carparkOptions: { provider, autoStart: false, now: () => clock } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`, output = path.join(root, '.sites-runtime/live-bay-ui');
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, serviceWorkers: 'block' });
  const page = await context.newPage(), errors = [], runs = [], screenshots = [], browserData = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => browserData.push(JSON.stringify(request.headers()), request.postData() ?? ''));
  page.on('websocket', socket => socket.on('framereceived', frame => browserData.push(String(frame.payload))));
  const step = () => { clock += 1000; app.carpark.tick(); };
  timer = setInterval(step, 1000);
  const bay = id => page.locator(`.cp-bay[data-bay="${id}"]`);
  async function result(id, label) {
    check = label;
    const deadline = performance.now() + 12000;
    while (app.carpark.detail(id).ai.status === 'waiting' && performance.now() < deadline) await pause(100);
    const detail = app.carpark.detail(id), run = detail.ai;
    assert.notEqual(run.status, 'waiting'); assert.ok(run.id);
    await page.waitForFunction(({ runId, status }) => document.querySelector('#cpAiPanel')?.dataset.aiStatus === status &&
      document.querySelector('#cpAiRuns details')?.dataset.aiRunId === runId, { runId: run.id, status: run.status }, { timeout: 12000 });
    assert.equal(run.testStub, false); assert.equal(run.model, real.model);
    assert.equal(detail.sourceType, 'simulation'); assert.equal(detail.exportable, false);
    assert.equal(await page.locator('#cpAiStub').isVisible(), false);
    assert.equal(await page.locator('#cpLevelmaintain').isEnabled(), true);
    if (run.ok) {
      assert.equal(await page.locator('#cpAiOutput').isVisible(), true);
      await page.waitForFunction(() => !document.querySelector('#cpAiConfirm').disabled);
      assert.equal(await page.locator('#cpAiRationale').innerText(), run.output.rationale_en);
      await page.locator('#cpAiConfirm').click();
      assert.equal(await page.locator(`#cpLevel${run.output.recommendation}`).isChecked(), true);
      assert.equal(app.carpark.detail(id).decisions.length, 0);
      await page.locator('#cpAiReject').click();
    } else {
      assert.equal(await page.locator('#cpAiOutput').isVisible(), false);
      assert.ok(run.errorCode);
    }
    const previous = calls;
    await page.locator('#langButton').click();
    if (run.ok) assert.equal(await page.locator('#cpAiRationale').innerText(), run.output.rationale_zh);
    await page.locator('#langButton').click(); assert.equal(calls, previous);
    await page.locator('#cpAiHistoryTitle').click();
    assert.match(await page.locator('#cpAiRuns').innerText(), new RegExp(real.model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    runs.push({ label, model: run.model, ok: run.ok, errorCode: run.errorCode, latencyMs: Math.round(run.latencyMs), output: run.output, levelAtRequest: run.levelAtRequest, frameSeq: run.frameSeq });
    const filename = path.join(output, `${label}-${run.ok ? 'available' : 'unavailable'}.png`);
    await page.screenshot({ path: filename, fullPage: true }); screenshots.push(filename);
    await page.locator('#cpAiHistoryTitle').click();
    return run;
  }
  check = 'open';
  await page.goto(base + '/?view=carpark&lang=en', { waitUntil: 'networkidle' });
  assert.equal(app.carpark.snapshot().session.aiMode, 'provider');
  assert.equal(await page.locator('#cpAiToggle').isEnabled(), true);
  await page.locator('#cpOperator').fill('LIVE-CHECK');
  await page.locator('#cpAiToggle').check(); await page.locator('#cpScenarioA').click(); await bay('B2-08').click();
  await result('B2-08', 'A-warning');
  await page.locator('#cpLevelmaintain').check(); await page.locator('#cpDecisionSubmit').click();
  await page.waitForFunction(() => document.querySelector('#cpDecisionCount').textContent === '1');
  check = 'B-warning';
  await page.locator('#cpScenarioB').click(); const start = clock;
  while (clock < start + 28000) step();
  await bay('B2-02').click(); await result('B2-02', 'B-warning');
  check = 'B-danger';
  while (clock < start + 42000) step();
  // Wait for the selected detail to catch up with the newly escalated alert.
  await page.waitForFunction(() => document.querySelector('#cpLeveldowngrade').disabled);
  await result('B2-02', 'B-danger');
  assert.equal(app.carpark.detail('B2-02').alert.level, 'danger');
  assert.equal(await page.locator('#cpLeveldowngrade').isDisabled(), true);
  await page.locator('#cpLevelmaintain').check(); await page.locator('#cpDecisionSubmit').click();
  await page.waitForFunction(() => document.querySelector('#cpDecisionCount').textContent === '1');
  check = 'isolation-and-reset';
  assert.equal(calls, 3); assert.deepEqual(errors, []);
  assert.equal((await (await fetch(base + '/api/events')).json()).events.length, 0);
  assert.equal(browserData.some(value => value.includes(process.env.VOLTGUARD_AI_API_KEY)), false);
  await page.locator('#cpReset').click();
  await page.waitForFunction(() => document.querySelector('#cpDecisionCount').textContent === '0');
  assert.equal(app.carpark.detail('B2-02').aiRuns.length, 0); assert.equal(calls, 3);
  const report = { schemaVersion: 'voltguard-bay-ai-live-ui-1', checkedAt: new Date().toISOString(), ok: true,
    execution: 'real_provider', sourceType: 'simulation', exportable: false, model: real.model, realProviderCalls: calls,
    validated: runs.filter(run => run.ok).length, modelResultsAllValidated: runs.every(run => run.ok),
    note: 'ok verifies UI behavior, not model accuracy or acceptance rate. Clock advances synthetic scenarios; model calls use real wall time.',
    bilingualWithoutNewCalls: true, confirmPrefillsWithoutAutoAction: true, manualPath: true, dangerProtected: true, resetClearsRuns: true,
    credentialsAbsentFromBrowser: true, measuredEvents: 0, pageErrors: errors, runs, screenshots };
  const saved = await saveBayCheckReport(report, { directory: output, apiKey: process.env.VOLTGUARD_AI_API_KEY });
  console.log(JSON.stringify({ ok: report.ok, realProviderCalls: calls, validated: report.validated, saved, screenshots }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errorCode: error.message === 'AI_NOT_CONFIGURED' ? error.message : 'LIVE_UI_CHECK_FAILED', check }));
  process.exitCode = 1;
} finally { clearInterval(timer); await browser?.close(); await app?.close(); }
