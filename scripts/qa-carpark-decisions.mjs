import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createVoltGuardServer } from '../backend/server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Admin1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let clock = Date.now();
const app = await createVoltGuardServer({ databasePath: ':memory:', copilotOptions: { apiKey: '' }, carparkOptions: { autoStart: false, now: () => clock } });
await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${app.server.address().port}`, output = path.resolve('.sites-runtime/qa-carpark-v15');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, serviceWorkers: 'block' });
const page = await context.newPage(), errors = [], writes = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.method() === 'POST') writes.push({ route: new URL(request.url()).pathname, input: request.postDataJSON() }); });
const bay = id => page.locator(`.cp-bay[data-bay="${id}"]`);
const step = () => { clock += 1000; app.carpark.tick(); };
async function count(value) { await page.waitForFunction(n => document.querySelector('#cpDecisionCount').textContent === String(n), value); }
async function submit(level, extras = []) {
  await page.locator(`#cpLevel${level ?? 'extras'}`).check();
  for (const extra of extras) await page.locator(`#cpExtra_${extra}`).check();
  await page.locator('#cpDecisionSubmit').click();
}
async function overflow() { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
async function capture(name) { await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); }); await page.screenshot({ path: path.join(output, name), fullPage: true }); }
try {
  await page.goto(base + '/?view=carpark&lang=en', { waitUntil: 'networkidle' }); step();
  await page.locator('#cpScenarioA').click(); step(); await bay('B2-03').click();
  await page.locator('#cpDecisionForm').waitFor();
  assert.match(await page.locator('#cpAiUnavailable').innerText(), /unavailable/);
  await submit('maintain'); assert.match(await page.locator('#cpDecisionFeedback').innerText(), /operator name/);
  assert.equal(await page.locator('#cpOperator').evaluate(element => element === document.activeElement), true);
  assert.equal(writes.filter(item => /decisions$/.test(item.route)).length, 0);
  await page.locator('#cpOperator').fill('P1');

  // Explicit failed-write fixture: no successful state or record is invented.
  await page.route('**/api/alerts/*/decisions', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.locator('#cpDecisionSubmit').click(); await page.locator('#cpDecisionFeedback[data-result="error"]').waitFor();
  assert.match(await page.locator('#cpDecisionFeedback').innerText(), /unconfirmed/);
  assert.equal(app.carpark.detail('B2-03').decisions.length, 0); assert.equal(app.carpark.alerts().alerts[0].status, 'pending');
  assert.equal(await page.locator('#cpLevelmaintain').isChecked(), true);
  await page.unroute('**/api/alerts/*/decisions');
  await submit(null, ['dispatch_patrol']); await count(1);
  assert.equal(app.carpark.alerts().alerts[0].status, 'pending');
  assert.equal(app.carpark.detail('B2-03').decisions[0].level, null);

  await submit('downgrade'); await count(2);
  await page.locator('.cp-alert-group[data-group="processing"] .cp-alert-item[data-alert-status="downgraded"]').waitFor();
  assert.equal(await bay('B2-03').getAttribute('data-status'), 'warning'); assert.equal(await bay('B2-03').getAttribute('data-alert-status'), 'downgraded');
  assert.equal(await bay('B2-03').evaluate(element => getComputedStyle(element).borderTopStyle), 'dashed');
  await page.locator('#cpDecisionHistory details').first().locator('summary').click();
  assert.equal(await page.locator('#cpDecisionHistory details').first().locator('canvas').isVisible(), true);
  assert.match(await page.locator('#cpDecisionHistory details').first().innerText(), /Identity unverified/);
  const records = app.carpark.detail('B2-03').decisions;
  assert.equal(records.length, 2); assert.ok(records.every(row => row.operator === 'P1' && row.operatorVerified === false && row.viewedMs >= 0 && row.aiUnavailable === true && row.aiRunId === null && row.exportable === false));
  const latest = records.at(-1);
  const colour = await page.locator('#cpDecisionHistory details').first().locator('canvas').evaluate(canvas => [...canvas.getContext('2d').getImageData(12, 12, 1, 1).data]);
  const actualColour = await page.locator('#cpThermalImage').evaluate(canvas => [...canvas.getContext('2d').getImageData(12, 12, 1, 1).data]);
  assert.deepEqual(colour, actualColour); assert.equal(latest.frameSeq, app.carpark.detail('B2-03').frame.seq);
  await capture('carpark-observing-en.png'); step();

  await submit(null, ['notify_manager']); await count(3); assert.equal(app.carpark.alerts().alerts[0].status, 'downgraded');
  await submit('maintain'); await count(4); assert.equal(app.carpark.alerts().alerts[0].status, 'processing');
  const beforeCall = page.url(); await submit(null, ['call_999']); await count(5);
  assert.equal(app.carpark.alerts().alerts[0].level, 'danger'); assert.equal(app.carpark.alerts().alerts[0].escalationSource, 'operator');
  assert.equal(app.carpark.detail('B2-03').decisions.at(-1).level, 'escalate');
  assert.equal(page.url(), beforeCall); assert.equal(await page.locator('#cpCall999').getAttribute('href'), 'tel:999');
  assert.equal(await page.locator('#cpLeveldowngrade').isDisabled(), true); assert.equal(await page.locator('#cpDangerLock').isVisible(), true);
  assert.equal(await page.locator('#cpCall999').isVisible(), true); await overflow();
  await page.reload({ waitUntil: 'networkidle' }); step(); assert.equal(await page.locator('#cpOperator').inputValue(), 'P1');
  await bay('B2-03').click(); await count(5); await page.locator('#langButton').click();
  assert.match(await page.locator('#cpDecisionHistoryTitle').innerText(), /決定記錄/);
  assert.match(await page.locator('#cpDecisionStatus').innerText(), /處理中/);
  await page.setViewportSize({ width: 390, height: 844 }); await overflow(); await capture('carpark-decisions-zh-mobile.png');
  await page.locator('#langButton').click(); assert.equal(await page.locator('#carparkView').evaluate(element => /[\u3400-\u9fff]/.test(element.innerText)), false);

  step(); await page.locator('#cpScenarioB').click(); const origin = clock;
  clock = origin + 28000; app.carpark.tick(); await bay('B2-02').click();
  await page.locator('#cpDecisionForm').waitFor(); await page.locator('#cpLeveldowngrade').check();
  // Hold an actual downgrade POST until the rule has escalated to danger.
  let release, reached;
  const gate = new Promise(resolve => { release = resolve; }), reachedGate = new Promise(resolve => { reached = resolve; });
  await page.route('**/api/alerts/*/decisions', async route => { assert.equal(route.request().postDataJSON().level, 'downgrade'); reached(); await gate; await route.continue(); });
  await page.locator('#cpDecisionSubmit').click(); await reachedGate;
  clock = origin + 42000; app.carpark.tick(); release();
  await page.locator('#cpDecisionFeedback[data-result="error"]').waitFor();
  assert.match(await page.locator('#cpDecisionFeedback').innerText(), /cannot be downgraded/);
  assert.equal(app.carpark.detail('B2-02').decisions.length, 0); assert.equal(app.carpark.alerts().alerts[0].status, 'pending');
  await page.unroute('**/api/alerts/*/decisions');
  await submit('maintain', ['notify_manager']); await count(1); assert.equal(app.carpark.alerts().alerts[0].status, 'processing');
  await page.setViewportSize({ width: 1440, height: 1050 }); await overflow(); await capture('carpark-danger-handled-en.png');
  await page.locator('#cpReset').click(); await count(0); assert.equal(app.carpark.alerts().alerts.length, 0);
  assert.equal(await page.locator('#cpDecisionForm').isVisible(), false); assert.equal(await page.locator('#cpCall999').isVisible(), false);
  step(); await page.locator('#cpScenarioC').click();
  const originC = clock;
  await bay('B2-04').click();
  await page.locator('#cpDecisionForm').waitFor();
  await submit('maintain', ['request_closeup', 'dispatch_patrol']); await count(1);
  assert.match(await page.locator('#cpCloseupFollowup').innerText(), /Waiting for the thermal camera/);
  assert.match(await page.locator('#cpPatrolFollowup').innerText(), /Waiting for a site report/);
  assert.equal(await page.locator('#cpCloseupImage').isHidden(), true);
  clock = originC + 8000; app.carpark.tick();
  await page.locator('#cpCloseupImage:not([hidden])').waitFor();
  assert.equal(await page.locator('#cpCloseupImage').getAttribute('data-region'), 'wheel');
  assert.match(await page.locator('#cpCloseupNote').innerText(), /not a live CCTV/);
  assert.match(await page.locator('#cpPatrolFollowup').innerText(), /hub is warm/);
  await capture('carpark-closeup-en.png');
  await page.locator('#cpReset').click(); await count(0);
  step(); await page.locator('#cpScenarioA').click(); await bay('B2-03').click();
  await context.setOffline(true); await page.locator('#cpConnection[data-connected="false"]').waitFor();
  assert.equal(await page.locator('#cpDecisionSubmit').isDisabled(), true);
  await context.setOffline(false);

  const blocked = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const blockedPage = await blocked.newPage(); blockedPage.on('pageerror', error => errors.push(error.message));
  await blockedPage.addInitScript(() => {
    const read = Storage.prototype.getItem, write = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) { if (key === 'voltguard.carpark.operator') throw new DOMException('Test-only blocked storage', 'SecurityError'); return read.call(this, key); };
    Storage.prototype.setItem = function(key, value) { if (key === 'voltguard.carpark.operator') throw new DOMException('Test-only blocked storage', 'SecurityError'); return write.call(this, key, value); };
  });
  await blockedPage.goto(base + '/?view=carpark&lang=en', { waitUntil: 'networkidle' });
  await blockedPage.locator('.cp-bay[data-bay="B2-03"]').click(); await blockedPage.locator('#cpOperator').fill('P2');
  await blockedPage.locator('#cpLevelmaintain').check(); await blockedPage.locator('#cpDecisionSubmit').click();
  await blockedPage.locator('#cpDecisionCount').filter({ hasText: /^1$/ }).waitFor();
  assert.equal(app.carpark.detail('B2-03').decisions[0].operator, 'P2'); await blocked.close();

  assert.ok(writes.every(item => ['/api/demo/scenario', '/api/demo/reset'].includes(item.route) || /^\/api\/alerts\/[0-9a-f-]+\/decisions$/.test(item.route)));
  assert.ok(writes.filter(item => /decisions$/.test(item.route)).every(item => item.input.aiStance === 'none' && item.input.aiRunId === null && !('frame' in item.input)));
  assert.equal((await (await fetch(base + '/api/events')).json()).events.length, 0);
  assert.equal((await (await fetch(base + '/api/fleet')).json()).records.length, 0); assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, manualDecisions: true, additionalActionsOnly: true, queueSections: true, observingStillWarning: true, appendedFrameSnapshots: true, failureRetainsChoices: true, serverRejectsRacingDowngrade: true, call999EscalatesWithoutDialling: true, operatorUnverifiedAndStorageOptional: true, resetClearsHistory: true, offlineDisabled: true, simulatedCloseupAndPatrol: true, bilingual: true, mobileOverflow: false, aiCalls: 0, pageErrors: errors, output }, null, 2));
} finally { await browser.close(); await app.close(); }
