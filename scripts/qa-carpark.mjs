import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createVoltGuardServer } from '../backend/server.mjs';
import { temperatureColor } from '../dist/thermal-map.mjs';
import { VEHICLE_NEUTRAL_COLOR, VEHICLE_TIRE_COLOR } from '../dist/carpark/vehicle-colors.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Admin1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let clock = Date.now();
const app = await createVoltGuardServer({ databasePath: ':memory:', copilotOptions: { apiKey: '' }, carparkOptions: { now: () => clock, autoStart: false } });
await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${app.server.address().port}`, output = path.resolve('.sites-runtime/qa-carpark-v14');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1120 }, serviceWorkers: 'block' });
const page = await context.newPage(), errors = [], writes = [], detailReads = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.method() === 'POST') writes.push({ route: new URL(request.url()).pathname, input: request.postDataJSON() }); });
page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/bays/')) detailReads.push(new URL(request.url()).pathname); });
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
async function waitDetail(id) {
  const actual = app.carpark.detail(id);
  await page.waitForFunction(({ id, session, seq }) => {
    const panel = document.querySelector('#cpSelectedPanel'), image = document.querySelector('#cpThermalImage');
    return panel.dataset.detailBay === id && panel.dataset.detailSession === session && image.dataset.frameSeq === (seq === null ? '' : String(seq));
  }, { id, session: actual.session.id, seq: actual.frame?.seq ?? null });
}
async function checkHotspot(id, region) {
  await waitDetail(id); const actual = app.carpark.detail(id), { row, col } = actual.hotspot;
  assert.equal(await page.locator('#cpThermalImage').getAttribute('data-region'), region);
  assert.equal(Number(await page.locator('#cpThermalImage').getAttribute('data-peak')), actual.assessment.peakC);
  const pixel = await page.locator('#cpThermalImage').evaluate((canvas, { row, col }) => [...canvas.getContext('2d').getImageData(col * 8 + 4, row * 8 + 4, 1, 1).data], { row, col });
  assert.deepEqual(pixel, [...temperatureColor(actual.hotspot.temperatureC).match(/\d+/g).map(Number), 255]);
}
try {
  await page.goto(base + '/?view=carpark&lang=en', { waitUntil: 'networkidle' });
  await page.locator('#cpConnection[data-connected="true"]').waitFor();
  assert.equal(await page.locator('#carparkView').isVisible(), true);
  assert.equal(await page.locator('#thermalView').isVisible(), false);
  assert.equal(await page.locator('.cp-bay').count(), 6);
  assert.deepEqual(await page.locator('.cp-bay').evaluateAll(bays => bays.map(bay => bay.dataset.bay)), ['B2-01', 'B2-02', 'B2-03', 'B2-04', 'B2-05', 'B2-06']);
  assert.equal(await page.locator('.cp-bay').evaluateAll(bays => new Set(bays.map(bay => bay.getBoundingClientRect().top)).size), 1);
  assert.equal(app.carpark.snapshot().layout.bays.every(bay => bay.charging), true);
  assert.equal(app.carpark.detail('B2-03').summary.occupied, false);
  assert.equal(await bay('B2-02').getAttribute('data-status'), 'no_data');
  assert.match(await bay('B2-02').innerText(), /Connecting/);
  await waitDetail('B2-02'); assert.equal(await page.locator('#cpRiseRate').innerText(), '—');
  assert.match(await page.locator('#cpRuleLevel').innerText(), /Insufficient data/);
  assert.equal(await page.locator('#cpNoRate').isVisible(), true);
  step(); await waitBay('B2-02', 'normal');
  assert.equal(await page.locator('.cp-bay[data-status="normal"]').count(), 5);
  assert.match(await bay('B2-06').innerText(), /No data/);
  assert.match(await page.locator('#cpNoDataBays').innerText(), /B2-06/);
  assert.match(await page.locator('.cp-demo-banner').innerText(), /Simulation demo.*Demo time is compressed/s);
  assert.match(await page.locator('.verified').innerText(), /Simulation/);
  assert.equal(await page.locator('#cpAiToggle').isDisabled(), true);
  await overflow(page);
  await waitDetail('B2-02');
  await page.locator('#cpVehicle3D:not([hidden]) .cp-vehicle-canvas').waitFor();
  assert.match(await page.locator('#cpVehicle3D').innerText(), /Schematic, not a real vehicle model/);
  assert.equal(await page.locator('#cpThermalImage').isVisible(), true);
  await page.evaluate(() => scrollTo(0, 0));
  const firstScreen = await page.evaluate(() => {
    const visible = id => { const box = document.getElementById(id).getBoundingClientRect(); return box.top < innerHeight && box.bottom > 0; };
    return {
      floor: visible('cpBayGrid'), thermal: visible('cpThermalImage'), vehicle: visible('cpVehicle3D'),
      evidenceLeft: document.getElementById('cpEvidencePanel').getBoundingClientRect().left,
      floorRight: document.getElementById('cpBayGrid').getBoundingClientRect().right
    };
  });
  assert.equal(firstScreen.floor, true); assert.equal(firstScreen.thermal, true); assert.equal(firstScreen.vehicle, true);
  assert.ok(firstScreen.evidenceLeft >= firstScreen.floorRight - 1);
  assert.equal(await page.locator('#cpThermalImage').evaluate(canvas => [canvas.width, canvas.height].join('×')), '256×192');
  assert.ok(detailReads.every(route => route === '/api/bays/B2-02'));
  await capture('carpark-baseline-en.png');

  await bay('B2-02').focus(); await page.keyboard.press('ArrowDown');
  assert.equal(await bay('B2-02').evaluate(element => element === document.activeElement), true);
  assert.equal(await page.locator('#cpSelectedId').innerText(), 'B2-02');
  await page.keyboard.press('ArrowRight');
  assert.equal(await bay('B2-03').evaluate(element => element === document.activeElement), true);
  assert.equal(await page.locator('#cpSelectedId').innerText(), 'B2-03');
  await waitDetail('B2-03'); assert.equal(await page.locator('#cpVehicle3D').isVisible(), true);
  assert.equal(await page.locator('#cpVehicleHost').getAttribute('data-vehicle'), 'false');
  assert.equal(await page.locator('#cpVehicleHost').getAttribute('data-hotspot'), 'null');
  assert.equal(await page.locator('#cpVehicleHost').getAttribute('data-charging-cable'), 'false');
  step(); await page.waitForFunction(() => document.querySelector('[data-bay="B2-03"]').dataset.frameSeq === '3');
  assert.equal(await bay('B2-03').evaluate(element => element === document.activeElement), true);

  await page.locator('#cpScenarioA').click(); await waitBay('B2-03', 'warning');
  step(); await waitBay('B2-02', 'normal');
  await page.locator('.cp-alert-item').filter({ hasText: 'B2-03' }).waitFor();
  await bay('B2-03').click(); assert.match(await page.locator('#cpSelectedStatus').innerText(), /Warning/);
  assert.equal(app.carpark.detail('B2-03').summary.occupied, true);
  assert.equal(app.carpark.detail('B2-03').summary.isCharging, false);
  assert.match(await bay('B2-03').innerText(), /Not charging/);
  assert.equal(await page.locator('#cpScenarioA').getAttribute('aria-pressed'), 'true');
  assert.equal(app.carpark.snapshot().session.aiRequested, false);
  await checkHotspot('B2-03', 'wheel'); assert.match(await page.locator('#cpHotspot').innerText(), /Front wheels/);
  await page.locator('#cpVehicle3D:not([hidden]) .cp-vehicle-canvas').waitFor();
  const wheelColors = JSON.parse(await page.locator('#cpVehicleHost').getAttribute('data-zone-colors'));
  assert.equal(wheelColors.wheel.color, temperatureColor(app.carpark.detail('B2-03').hotspot.temperatureC));
  assert.equal(await page.locator('#cpVehicleHost').getAttribute('data-body-color'), VEHICLE_NEUTRAL_COLOR);
  assert.equal(await page.locator('#cpVehicleHost').getAttribute('data-rear-wheel-color'), VEHICLE_TIRE_COLOR);
  assert.equal(JSON.parse(await page.locator('#cpVehicleHost').getAttribute('data-hotspot')).color, wheelColors.wheel.color);
  assert.equal(await page.locator('#cpRuleLevel').innerText(), 'Warning');
  assert.equal(await page.locator('#cpRiseRate').innerText(), '0.00 °C/s');
  assert.equal(await page.locator('#cpTrend').getAttribute('data-samples'), '2');
  await page.locator('#langButton').click();
  assert.match(await page.locator('#carparkView').innerText(), /仿真演示/); assert.match(await bay('B2-03').innerText(), /警告/);
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
  await checkHotspot('B2-02', 'underbody'); assert.match(await page.locator('#cpHotspot').innerText(), /車底/);
  assert.equal(await page.locator('#cpRiseRate').innerText(), '1.50 °C/s');
  assert.equal(await page.locator('#cpRuleLevel').innerText(), '危險');
  assert.equal(await page.locator('#cpTrend').getAttribute('data-samples'), '5');
  assert.equal(await page.locator('#cpTrend').getAttribute('data-segments'), '3');
  await page.locator('.cp-alert-item[data-level="danger"]').waitFor();
  // Test-only loss-of-feed summary; retain the actual scenario frame and alert.
  const beforeOutage = app.carpark.snapshot();
  await page.evaluate(state => {
    const bays = state.bays.map(bay => bay.id === 'B2-02' ? { ...bay, noData: true } : bay);
    const data = JSON.stringify({ type: 'bays', report: { session: state.session, bays, sourceType: 'simulation' } });
    for (const socket of window.qaSockets) socket.dispatchEvent(new MessageEvent('message', { data }));
  }, beforeOutage);
  assert.match(await page.locator('.cp-alert-item[data-level="danger"]').innerText(), /無資料/);
  assert.equal(await page.locator('#cpSelectedPanel').getAttribute('data-detail-stale'), 'true');
  assert.match(await page.locator('#cpDetailNotice').innerText(), /最後畫面/);
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

  // A failed selected-bay read must retain the real last frame and offer retry.
  const lastSeq = await page.locator('#cpThermalImage').getAttribute('data-frame-seq');
  await page.route('**/api/bays/B2-02', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  step(); await page.locator('#cpDetailRetry').waitFor();
  assert.equal(await page.locator('#cpThermalImage').getAttribute('data-frame-seq'), lastSeq);
  assert.equal(await page.locator('#cpSelectedPanel').getAttribute('data-detail-stale'), 'true');
  assert.match(await page.locator('#cpDetailNotice').innerText(), /could not be read/);
  await page.unroute('**/api/bays/B2-02'); await page.locator('#cpDetailRetry').click();
  await waitDetail('B2-02'); assert.equal(await page.locator('#cpSelectedPanel').getAttribute('data-detail-stale'), 'false');

  // Hold an actual HTTP reply, change selection, then release the old reply.
  let release, reached;
  const gate = new Promise(resolve => { release = resolve; }), reachedGate = new Promise(resolve => { reached = resolve; });
  const delayed = app.carpark.detail('B2-03');
  await page.route('**/api/bays/B2-03', async route => { reached(); await gate; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(delayed) }).catch(() => {}); });
  await bay('B2-03').click(); await reachedGate;
  assert.equal(await page.locator('#cpFrameContent').isVisible(), false);
  await bay('B2-02').click(); await waitDetail('B2-02'); release();
  await page.unroute('**/api/bays/B2-03');
  assert.equal(await page.locator('#cpSelectedPanel').getAttribute('data-detail-bay'), 'B2-02');
  assert.equal(await page.locator('#cpThermalImage').getAttribute('data-region'), 'underbody');
  await bay('B2-06').click(); await waitDetail('B2-06');
  assert.equal(await page.locator('#cpVehicle3D').isVisible(), true);
  assert.equal(await page.locator('.cp-vehicle-canvas').count(), 1);
  assert.equal(await page.locator('#cpVehicleHost').getAttribute('data-vehicle'), 'false');
  assert.equal(await page.locator('#cpVehicleHost').getAttribute('data-hotspot'), 'null');
  assert.equal(await page.locator('#cpVehicleHost').getAttribute('data-charging-cable'), 'false');
  assert.equal(await page.locator('#cpVehicleHost').getAttribute('data-charger'), 'true');
  assert.equal(await page.locator('#cpFrameContent').isVisible(), false);
  assert.equal(await page.locator('#cpDetailEmpty').isVisible(), true);
  await bay('B2-02').click(); await waitDetail('B2-02');

  const retained = app.carpark.snapshot();
  await context.setOffline(true);
  await page.locator('#cpConnection[data-connected="false"]').waitFor();
  assert.equal(await bay('B2-02').getAttribute('data-status'), 'danger');
  assert.equal(await bay('B2-02').getAttribute('data-no-data'), 'true');
  assert.equal(await page.locator('.cp-bay[data-status="normal"]').count(), 0);
  assert.equal(await page.locator('#cpScenarioB').isDisabled(), true);
  assert.equal(await page.locator('#cpScenarioC').isDisabled(), true);
  assert.equal(await page.locator('#cpFrameContent').isVisible(), true);
  assert.equal(await page.locator('#cpSelectedPanel').getAttribute('data-detail-stale'), 'true');
  assert.match(await page.locator('#cpDetailNotice').innerText(), /last image and rule/);
  await context.setOffline(false); await page.locator('#cpReconnect').click();
  await page.locator('#cpConnection[data-connected="true"]').waitFor();
  await page.route('**/api/demo/reset', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"test-only failure"}' }));
  await page.locator('#cpReset').click(); await page.locator('#cpError').waitFor();
  assert.equal(app.carpark.snapshot().session.id, retained.session.id);
  assert.equal(await bay('B2-02').getAttribute('data-status'), 'danger');
  await page.unroute('**/api/demo/reset'); await page.locator('#cpReset').click();
  await page.locator('#cpAlertCount').filter({ hasText: /^0$/ }).waitFor();
  step(); await waitBay('B2-02', 'normal');
  await waitDetail('B2-02');
  assert.equal(await page.locator('#cpTrend').getAttribute('data-samples'), '2');
  assert.equal(await page.locator('#cpRuleLevel').innerText(), 'Normal');
  await page.evaluate(old => {
    const data = JSON.stringify({ type: 'bays', report: { session: old.session, bays: old.bays, sourceType: 'simulation' } });
    for (const socket of window.qaSockets) socket.dispatchEvent(new MessageEvent('message', { data }));
  }, retained);
  assert.equal(await bay('B2-02').getAttribute('data-status'), 'normal');
  assert.equal(await page.locator('.cp-alert-item').count(), 0);

  await page.locator('#cpScenarioC').click(); await waitBay('B2-04', 'warning');
  await bay('B2-04').click();
  assert.equal(await page.locator('#cpScenarioC').getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('#cpScenario').innerText(), /Junction heat/);
  await checkHotspot('B2-04', 'wheel');
  assert.ok(app.carpark.detail('B2-04').frame.temperaturesC[19][9] > 60);
  await capture('carpark-junction-en.png');

  await page.evaluate(() => document.getElementById('thermalTab').click()); await page.locator('#thermalTemperature').filter({ hasNotText: '—' }).waitFor();
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
  assert.equal(await publicPage.locator('#cpScenarioC').isDisabled(), true);
  assert.equal(await publicPage.locator('.cp-bay[data-status="normal"]').count(), 0);
  assert.equal(await publicPage.locator('.cp-bay[data-status="no_data"]').count(), 6);
  assert.equal(await publicPage.locator('#cpFrameContent').isVisible(), false);
  await overflow(publicPage);
  await capture('carpark-static-en-mobile.png', publicPage);
  await publicPage.evaluate(() => document.getElementById('thermalTab').click()); await publicPage.locator('#thermalTemperature').filter({ hasNotText: '—' }).waitFor();
  assert.equal(await publicPage.locator('#thermalView').getAttribute('data-mode'), 'nasa'); await publicContext.close();

  assert.ok(writes.length >= 4); assert.ok(writes.every(item => ['/api/demo/scenario', '/api/demo/reset'].includes(item.route)));
  assert.ok(writes.filter(item => item.route === '/api/demo/scenario').every(item => item.input.ai === false));
  assert.equal((await (await fetch(base + '/api/events')).json()).events.length, 0);
  assert.equal((await (await fetch(base + '/api/fleet')).json()).records.length, 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, sixChargingBaysInOneRow: true, deterministicAB: true, scenarioCJunction: true, thermalPixelsAndHotspots: true, serverRuleAndRate: true, timestampedTrendGaps: true, detailFailureAndRetry: true, lateDetailIgnored: true, selectedBayOnly: true, reset: true, bilingual: true, keyboardAndFocus: true, disconnectRetainsDanger: true, staleSessionIgnored: true, failedWriteRetainsState: true, staticRequiresService: true, nasaPreserved: true, mobileOverflow: false, aiCalls: 0, pageErrors: errors, output }, null, 2));
} finally { await browser.close(); await app.close(); }
