import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createVoltGuardServer } from '../backend/server.mjs';
import { createBayAIStub } from '../backend/testing/bay-ai-stub.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Admin1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let clock = Date.now(), mode = 'success', calls = 0;
const provider = { configured: true, kind: 'test_stub', complete(args) {
  calls++;
  if (mode === 'timeout') return new Promise(() => {});
  return createBayAIStub({ mode, delayMs: 300 }).complete(args);
} };
const app = await createVoltGuardServer({ databasePath: ':memory:', copilotOptions: { apiKey: '' }, carparkOptions: { provider, autoStart: false, now: () => clock, aiOptions: { timeoutMs: 1400 } } });
await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${app.server.address().port}`, output = path.resolve('.sites-runtime/qa-carpark-v16');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, serviceWorkers: 'block' });
const page = await context.newPage(), errors = [], writes = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/\/decisions$/.test(request.url())) writes.push(request.postDataJSON()); });
const tick = (seconds = 1) => { clock += seconds * 1000; app.carpark.tick(); };
const timer = setInterval(tick, 1000);
const bay = id => page.locator(`.cp-bay[data-bay="${id}"]`);
async function available() { await page.locator('#cpAiPanel[data-ai-status="available"]').waitFor(); await page.waitForFunction(() => !document.querySelector('#cpAiConfirm').disabled); }
async function count(n) { await page.waitForFunction(n => document.querySelector('#cpDecisionCount').textContent === String(n), n); }
async function capture(name) { await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); }); await page.screenshot({ path: path.join(output, name), fullPage: true }); }
async function startA() { await page.locator('#cpAiToggle').check(); await page.locator('#cpScenarioA').click(); await bay('B2-03').click(); }
try {
  await page.goto(base + '/?view=carpark&lang=en', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('#cpAiToggle').isEnabled(), true); assert.equal(await page.locator('#cpAiToggle').isChecked(), true);
  await page.locator('#cpOperator').fill('P1'); await startA(); await available();
  assert.match(await page.locator('#cpAiStub').innerText(), /TEST STUB.*Not a real model/);
  assert.match(await page.locator('#cpAiRecommendation').innerText(), /Maintain.*Wheel residual/);
  assert.match(await page.locator('#cpAiHotspot').innerText(), /Front wheels/);
  const initialRun = app.carpark.detail('B2-03').ai, callsBeforeLanguage = calls;
  await page.locator('#langButton').click(); assert.match(await page.locator('#cpAiRationale').innerText(), /測試替身/);
  await page.locator('#langButton').click(); assert.equal(calls, callsBeforeLanguage);
  tick(2); await page.waitForFunction(() => !document.querySelector('#cpAiConfirm').disabled);
  await page.locator('#cpAiConfirm').click(); assert.equal(await page.locator('#cpLevelmaintain').isChecked(), true);
  assert.equal(app.carpark.detail('B2-03').decisions.length, 0);
  await page.locator('#cpDecisionSubmit').click(); await count(1);
  const saved = app.carpark.detail('B2-03').decisions[0];
  assert.equal(saved.aiStance, 'confirmed'); assert.equal(saved.aiRunId, initialRun.id); assert.notEqual(saved.frameSeq, saved.aiRun.frameSeq);
  await page.locator('#cpDecisionHistory details').first().locator('summary').click();
  assert.equal(await page.locator('#cpDecisionHistory details').first().locator('canvas').count(), 2);
  await page.locator('#cpAiHistoryTitle').click();
  await page.locator('#cpAiRuns details').first().locator('summary').click();
  assert.match(await page.locator('#cpAiRuns').innerText(), /test-stub-not-a-real-model.*Validated/);
  assert.equal(await page.locator('#cpAiRuns canvas').first().isVisible(), true);
  await page.locator('#cpAiHistoryTitle').click();
  await capture('ai-stub-accepted-en.png');
  await page.locator('#cpAiReject').click(); assert.equal(await page.locator('#cpLevelmaintain').isChecked(), false);
  await page.locator('#cpDecisionSubmit').click(); assert.match(await page.locator('#cpDecisionFeedback').innerText(), /Choose a level/);
  await page.locator('#cpLevelmaintain').check(); await page.locator('#cpDecisionSubmit').click(); await count(2);
  assert.equal(app.carpark.detail('B2-03').decisions[1].aiStance, 'rejected');
  await page.locator('#cpAiConfirm').click(); await page.locator('#cpLeveldowngrade').check(); await page.locator('#cpDecisionSubmit').click(); await count(3);
  assert.equal(app.carpark.detail('B2-03').decisions[2].aiStance, 'rejected');

  await page.locator('#cpAiToggle').uncheck(); const disabledCalls = calls;
  await page.locator('#cpScenarioA').click(); await bay('B2-03').click();
  await page.waitForFunction(() => document.querySelector('#cpAiUnavailable').textContent.includes('switched off'));
  assert.equal(calls, disabledCalls); assert.equal(await page.locator('#cpAiOutput').isVisible(), false);
  await page.locator('#cpLevelmaintain').check(); await page.locator('#cpDecisionSubmit').click(); await count(1);
  assert.equal(app.carpark.detail('B2-03').decisions[0].aiUnavailable, true);

  for (const failure of ['refusal', 'invalid', 'timeout']) {
    mode = failure; await startA();
    if (failure === 'timeout') {
      await page.locator('#cpAiPanel[data-ai-status="waiting"]').waitFor();
      assert.equal(await page.locator('#cpLevelmaintain').isEnabled(), true);
    }
    await page.waitForFunction(() => document.querySelector('#cpAiPanel').dataset.aiStatus === 'unavailable' && /Model refused|validation|timed out/.test(document.querySelector('#cpAiUnavailable').textContent));
    assert.equal(await page.locator('#cpAiOutput').isVisible(), false); assert.equal(await page.locator('#cpAiConfirm').isDisabled(), true);
    await page.locator('#cpLevelmaintain').check(); await page.locator('#cpDecisionSubmit').click(); await count(1);
    assert.equal(app.carpark.detail('B2-03').decisions[0].aiStance, 'none');
  }
  await capture('ai-unavailable-en.png');
  mode = 'success'; await page.locator('#cpScenarioB').click(); tick(28); await bay('B2-02').click(); await available();
  assert.match(await page.locator('#cpAiRecommendation').innerText(), /Escalate.*Underbody anomaly/);
  assert.equal(app.carpark.detail('B2-02').alert.level, 'warning');
  await page.locator('#cpAiConfirm').click(); assert.equal(await page.locator('#cpLevelescalate').isChecked(), true);
  assert.equal(await page.locator('#cpExtra_dispatch_patrol').isChecked(), true); assert.equal(await page.locator('#cpExtra_notify_manager').isChecked(), true);
  await page.locator('#cpDecisionSubmit').click(); await count(1); await available();
  assert.equal(await page.locator('#cpLeveldowngrade').isDisabled(), true);
  await page.locator('#langButton').click(); await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await capture('ai-danger-stub-zh-mobile.png');
  await page.locator('#langButton').click(); assert.equal(await page.locator('#carparkView').evaluate(element => /[\u3400-\u9fff]/.test(element.innerText)), false);
  await context.setOffline(true); await page.locator('#cpConnection[data-connected="false"]').waitFor(); assert.equal(await page.locator('#cpAiConfirm').isDisabled(), true);
  await context.setOffline(false); await page.locator('#cpConnection[data-connected="true"]').waitFor();
  await page.locator('#cpReset').click(); await count(0); assert.equal(await page.locator('#cpAiOutput').isVisible(), false); assert.equal(app.carpark.detail('B2-02').aiRuns.length, 0);
  assert.ok(writes.some(input => input.aiStance === 'confirmed' && input.aiRunId)); assert.ok(writes.some(input => input.aiStance === 'rejected' && input.aiRunId));
  assert.equal((await (await fetch(base + '/api/events')).json()).events.length, 0); assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, testStubOnly: true, realProviderCalls: 0, confirmPrefillsWithoutAutoAction: true, rejectionRequiresLevel: true, editedLevelRecordsRejection: true, independentFrames: true, unavailableManualPath: true, aiOff: true, bilingualWithoutNewCalls: true, dangerProtected: true, resetClearsRuns: true, mobileOverflow: false, pageErrors: errors, output }, null, 2));
} finally { clearInterval(timer); await browser.close(); await app.close(); }
