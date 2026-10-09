import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createVoltGuardServer } from '../backend/server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Admin1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let clock = Date.now();
const app = await createVoltGuardServer({ databasePath: ':memory:', copilotOptions: { apiKey: '' }, carparkOptions: { now: () => clock, autoStart: false } });
await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${app.server.address().port}`, output = path.resolve('.sites-runtime/qa-carpark-v13');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1120 }, serviceWorkers: 'block' });
const page = await context.newPage(), errors = [], writes = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.method() === 'POST') writes.push({ route: new URL(request.url()).pathname, input: request.postDataJSON() }); });
// Test-only socket capture for replaying an actual previous-session message.
await page.addInitScript(() => {
  const Native = window.WebSocket; window.qaSockets = [];
  window.WebSocket = class extends Native { constructor(...args) { super(...args); window.qaSockets.push(this); } };
});
const bay = id => page.locator(`[data-bay="${id}"]`);
const step = (seconds = 1) => { clock += seconds * 1000; app.carpark.tick(); };
const overflow = async p => assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
async function capture(name, p = page) { await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: path.join(output, name), fullPage: true }); }
async function waitBay(id, status) { await bay(id).and(page.locator(`[data-status="${status}"]`)).waitFor(); }
try {
  await page.goto(base + '/?view=carpark&lang=en', { waitUntil: 'networkidle' });
  await page.locator('#cpConnection[data-connected="true"]').waitFor();
  assert.equal(await page.locator('#carparkView').isVisible(), true);
  assert.equal(await page.locator('#thermalView').isVisible(), false);
  assert.equal(await page.locator('.cp-bay').count(), 12);
  assert.equal(await bay('B2-02').getAttribute('data-status'), 'no_data');
  assert.match(await bay('B2-02').innerText(), /Connecting/);
  step(); await waitBay('B2-02', 'normal');
  assert.equal(await page.locator('.cp-bay[data-status="normal"]').count(), 11);
  assert.match(await bay('B2-11').innerText(), /No data/);
  assert.match(await page.locator('#cpNoDataBays').innerText(), /B2-11/);
  assert.match(await page.locator('.cp-demo-banner').innerText(), /Simulation demo.*Demo time is compressed/s);
  assert.match(await page.locator('.verified').innerText(), /Simulation/);
  assert.equal(await page.locator('#cpAiToggle').isDisabled(), true);
  await overflow(page);
  await capture('carpark-baseline-en.png');

  await bay('B2-02').focus(); await page.keyboard.press('ArrowDown');
  assert.equal(await bay('B2-08').evaluate(element => element === document.activeElement), true);
  assert.equal(await page.locator('#cpSelectedId').innerText(), 'B2-08');
  step(); await page.waitForFunction(() => document.querySelector('[data-bay="B2-08"]').dataset.frameSeq === '3');
  assert.equal(await bay('B2-08').evaluate(element => element === document.activeElement), true);

  await page.locator('#cpScenarioA').click(); await waitBay('B2-08', 'warning');
  step(); await waitBay('B2-02', 'normal');
  await page.locator('.cp-alert-item').filter({ hasText: 'B2-08' }).waitFor();
  await bay('B2-08').click(); assert.match(await page.locator('#cpSelectedStatus').innerText(), /Warning/);
  assert.equal(await page.locator('#cpScenarioA').getAttribute('aria-pressed'), 'true');
  assert.equal(app.carpark.snapshot().session.aiRequested, false);
  await page.locator('#langButton').click();
  assert.match(await page.locator('#carparkView').innerText(), /仿真演示/); assert.match(await bay('B2-08').innerText(), /警告/);
  await capture('carpark-warning-zh.png');

  await page.locator('#cpScenarioB').click();
  const origin = clock;
  clock = origin + 27000; app.carpark.tick(); await waitBay('B2-02', 'normal');
  clock = origin + 28000; app.carpark.tick(); await waitBay('B2-02', 'warning');
  await page.locator('.cp-alert-item').filter({ hasText: 'B2-02' }).waitFor();
  assert.equal(await page.locator('.cp-alert-item').count(), 1);
  clock = origin + 41000; app.carpark.tick(); await waitBay('B2-02', 'warning');
  clock = origin + 42000; app.carpark.tick(); await waitBay('B2-02', 'danger');
  await bay('B2-02').click(); assert.equal(await page.locator('#cpSelectedPeak').innerText(), '80.0');
  await page.locator('.cp-alert-item[data-level="danger"]').waitFor();
  // Test-only loss-of-feed summary; retain the actual scenario frame and alert.
  const beforeOutage = app.carpark.snapshot();
  await page.evaluate(state => {
    const bays = state.bays.map(bay => bay.id === 'B2-02' ? { ...bay, noData: true } : bay);
    const data = JSON.stringify({ type: 'bays', report: { session: state.session, bays, sourceType: 'simulation' } });
    for (const socket of window.qaSockets) socket.dispatchEvent(new MessageEvent('message', { data }));
  }, beforeOutage);
  assert.match(await page.locator('.cp-alert-item[data-level="danger"]').innerText(), /無資料/);
  await page.evaluate(state => {
    const data = JSON.stringify({ type: 'bays', report: { session: state.session, bays: state.bays, sourceType: 'simulation' } });
    for (const socket of window.qaSockets) socket.dispatchEvent(new MessageEvent('message', { data }));
  }, beforeOutage);
  await capture('carpark-danger-zh.png');
  await page.setViewportSize({ width: 390, height: 844 }); await overflow(page);
  assert.equal(await bay('B2-02').getAttribute('aria-pressed'), 'true');
  await capture('carpark-danger-zh-mobile.png');
  await page.locator('#langButton').click();
  assert.equal(await page.locator('#carparkView').evaluate(element => /[\u3400-\u9fff]/.test(element.innerText)), false);
  await overflow(page);

  const retained = app.carpark.snapshot();
  await context.setOffline(true);
  await page.locator('#cpConnection[data-connected="false"]').waitFor();
  assert.equal(await bay('B2-02').getAttribute('data-status'), 'danger');
  assert.equal(await bay('B2-02').getAttribute('data-no-data'), 'true');
  assert.equal(await page.locator('.cp-bay[data-status="normal"]').count(), 0);
  assert.equal(await page.locator('#cpScenarioB').isDisabled(), true);
  await context.setOffline(false); await page.locator('#cpReconnect').click();
  await page.locator('#cpConnection[data-connected="true"]').waitFor();
  await page.route('**/api/demo/reset', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"test-only failure"}' }));
  await page.locator('#cpReset').click(); await page.locator('#cpError').waitFor();
  assert.equal(app.carpark.snapshot().session.id, retained.session.id);
  assert.equal(await bay('B2-02').getAttribute('data-status'), 'danger');
  await page.unroute('**/api/demo/reset'); await page.locator('#cpReset').click();
  await page.locator('#cpAlertCount').filter({ hasText: /^0$/ }).waitFor();
  step(); await waitBay('B2-02', 'normal');
  await page.evaluate(old => {
    const data = JSON.stringify({ type: 'bays', report: { session: old.session, bays: old.bays, sourceType: 'simulation' } });
    for (const socket of window.qaSockets) socket.dispatchEvent(new MessageEvent('message', { data }));
  }, retained);
  assert.equal(await bay('B2-02').getAttribute('data-status'), 'normal');
  assert.equal(await page.locator('.cp-alert-item').count(), 0);

  await page.locator('#thermalTab').click(); await page.locator('#thermalTemperature').filter({ hasNotText: '—' }).waitFor();
  assert.equal(await page.locator('#carparkView').isVisible(), false);
  assert.equal(await page.locator('#thermalView').getAttribute('data-mode'), 'nasa');
  assert.equal(await page.locator('.verified').evaluate(element => element.classList.contains('is-simulation')), false);
  await page.locator('#carparkTab').click(); step(); await waitBay('B2-02', 'normal');

  const publicContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const publicPage = await publicContext.newPage(); publicPage.on('pageerror', error => errors.push(error.message));
  await publicPage.route('**/api/carpark', route => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await publicPage.goto(base + '/?view=carpark&lang=en', { waitUntil: 'networkidle' });
  await publicPage.locator('#cpServiceNotice').waitFor();
  assert.match(await publicPage.locator('#cpServiceNotice').innerText(), /Run the local service/);
  assert.equal(await publicPage.locator('#cpScenarioA').isDisabled(), true);
  assert.equal(await publicPage.locator('.cp-bay[data-status="normal"]').count(), 0);
  assert.equal(await publicPage.locator('.cp-bay[data-status="no_data"]').count(), 12);
  await overflow(publicPage);
  await capture('carpark-static-en-mobile.png', publicPage);
  await publicPage.locator('#thermalTab').click(); await publicPage.locator('#thermalTemperature').filter({ hasNotText: '—' }).waitFor();
  assert.equal(await publicPage.locator('#thermalView').getAttribute('data-mode'), 'nasa'); await publicContext.close();

  assert.ok(writes.length >= 4); assert.ok(writes.every(item => ['/api/demo/scenario', '/api/demo/reset'].includes(item.route)));
  assert.ok(writes.filter(item => item.route === '/api/demo/scenario').every(item => item.input.ai === false));
  assert.equal((await (await fetch(base + '/api/events')).json()).events.length, 0);
  assert.equal((await (await fetch(base + '/api/fleet')).json()).records.length, 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, twelveBays: true, deterministicAB: true, reset: true, bilingual: true, keyboardAndFocus: true, disconnectRetainsDanger: true, staleSessionIgnored: true, failedWriteRetainsState: true, staticRequiresService: true, nasaPreserved: true, mobileOverflow: false, aiCalls: 0, pageErrors: errors, output }, null, 2));
} finally { await browser.close(); await app.close(); }
