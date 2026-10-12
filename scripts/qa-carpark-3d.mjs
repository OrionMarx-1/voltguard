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
const app = await createVoltGuardServer({ databasePath: ':memory:', copilotOptions: { apiKey: '' }, carparkOptions: { autoStart: false, now: () => clock,
  provider: { configured: false, complete: () => assert.fail('3D QA must not call a real model') } } });
await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${app.server.address().port}`, output = path.resolve('.sites-runtime/qa-carpark-3d-round7');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
const page = await context.newPage(), errors = [], requests = [];
page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push(request.url()));
const bay = id => page.locator(`.cp-bay[data-bay="${id}"]`);
const step = seconds => { clock += seconds * 1000; app.carpark.tick(); };
async function vehicle(id) { await page.waitForFunction(id => document.querySelector('#cpVehicleHost').dataset.frameSeq === document.querySelector(`.cp-bay[data-bay="${id}"]`).dataset.frameSeq && document.querySelector('#cpVehicleHost').dataset.vehicle === 'true', id); }
async function renderedColor(color, present = true) {
  const rgb = color.match(/\d+/g).map(Number);
  const count = await page.locator('.cp-vehicle-canvas').evaluate((canvas, rgb) => {
    // Synchronously request a real controls redraw, then inspect the framebuffer.
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 1, cancelable: true }));
    const gl = canvas.getContext('webgl2'), pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let matches = 0;
    for (let index = 0; index < pixels.length; index += 4) if (rgb.every((value, channel) => Math.abs(value - pixels[index + channel]) <= 1)) matches++;
    return matches;
  }, rgb);
  if (present) assert.ok(count > 10, `Expected visible hotspot pixels for ${color}, got ${count}`);
  else assert.equal(count, 0, `An empty/no-data bay must not retain thermal pixels for ${color}`);
}
async function bodyAndCharger(charging) {
  assert.equal(await page.locator('#cpVehicleHost').getAttribute('data-body-color'), VEHICLE_NEUTRAL_COLOR);
  assert.equal(await page.locator('#cpVehicleHost').getAttribute('data-rear-wheel-color'), VEHICLE_TIRE_COLOR);
  assert.equal(await page.locator('#cpVehicleHost').getAttribute('data-charger'), 'true');
  assert.equal(await page.locator('#cpVehicleHost').getAttribute('data-charging-cable'), String(charging));
}
async function emptyBay() {
  assert.equal(await page.locator('#cpVehicle3D').isVisible(), true); assert.equal(await page.locator('.cp-vehicle-canvas').count(), 1);
  assert.equal(await page.locator('#cpVehicleHost').getAttribute('data-vehicle'), 'false');
  assert.equal(await page.locator('#cpVehicleHost').getAttribute('data-hotspot'), 'null');
  await bodyAndCharger(false); await renderedColor(temperatureColor(68), false); await renderedColor(temperatureColor(80), false);
}
try {
  await page.goto(base + '/?view=carpark&lang=en', { waitUntil: 'networkidle' });
  step(1); await vehicle('B2-02');
  assert.equal(await page.locator('#cpVehicle3D').isVisible(), true);
  assert.equal(await page.locator('#cpThermalImage').isVisible(), true); assert.equal(await page.locator('.cp-bay').count(), 6);
  assert.match(await page.locator('#cpVehicle3D').innerText(), /Simulation.*Schematic, not a real vehicle model/s);
  const normal = JSON.parse(await page.locator('#cpVehicleHost').getAttribute('data-zone-colors'));
  assert.equal(Object.values(normal).every(zone => zone.color === VEHICLE_NEUTRAL_COLOR && !zone.hot), true);
  await bodyAndCharger(true);
  const camera = JSON.parse(await page.locator('#cpVehicleHost').getAttribute('data-camera-position'));
  assert.ok(camera[0] < 0 && camera[1] > 2 && camera[2] > 4);

  await bay('B2-03').click(); await page.waitForFunction(() => document.querySelector('#cpSelectedPanel').dataset.detailBay === 'B2-03');
  await emptyBay(); await page.locator('#cpVehicle3D').screenshot({ path: path.join(output, 'empty-bay-en.png') });
  assert.equal(await page.locator('#cpThermalImage').isVisible(), true);
  await page.locator('#cpScenarioA').click(); await vehicle('B2-03');
  const wheel = JSON.parse(await page.locator('#cpVehicleHost').getAttribute('data-zone-colors'));
  assert.equal(wheel.wheel.color, temperatureColor(68)); await renderedColor(wheel.wheel.color);
  await bodyAndCharger(false);
  const wheelSpot = JSON.parse(await page.locator('#cpVehicleHost').getAttribute('data-hotspot'));
  assert.equal(wheelSpot.color, temperatureColor(68)); assert.equal(wheelSpot.zone, 'wheel'); assert.ok(wheelSpot.x < -1 && wheelSpot.z > 1);
  await page.locator('.cp-frame-views').screenshot({ path: path.join(output, 'A-wheel-en.png') });
  await page.locator('#cpScenarioB').click(); step(28); await bay('B2-02').click(); await vehicle('B2-02');
  const warningSpot = JSON.parse(await page.locator('#cpVehicleHost').getAttribute('data-hotspot'));
  assert.equal(warningSpot.color, temperatureColor(app.carpark.detail('B2-02').hotspot.temperatureC));
  assert.equal(warningSpot.zone, 'underbody'); assert.ok(warningSpot.y < .4 && warningSpot.z > 2.2);
  await renderedColor(warningSpot.color); await bodyAndCharger(true);
  step(14); await vehicle('B2-02');
  const underbody = JSON.parse(await page.locator('#cpVehicleHost').getAttribute('data-zone-colors'));
  assert.equal(underbody.underbody.color, temperatureColor(80)); await renderedColor(underbody.underbody.color);
  const dangerSpot = JSON.parse(await page.locator('#cpVehicleHost').getAttribute('data-hotspot'));
  assert.equal(dangerSpot.color, temperatureColor(80)); assert.equal(dangerSpot.zone, 'underbody');
  assert.deepEqual([dangerSpot.x, dangerSpot.y, dangerSpot.z], [warningSpot.x, warningSpot.y, warningSpot.z]); await bodyAndCharger(true);
  await page.locator('.cp-frame-views').screenshot({ path: path.join(output, 'B-underbody-en.png') });
  assert.equal(await page.locator('#cpThermalImage').getAttribute('data-region'), 'underbody');
  await page.locator('#langButton').click(); assert.match(await page.locator('#cpVehicle3D').innerText(), /示意，非實車模型/);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator('.cp-frame-views').screenshot({ path: path.join(output, 'B-underbody-zh-mobile.png') });
  await bay('B2-06').click(); await page.waitForFunction(() => document.querySelector('#cpSelectedPanel').dataset.detailBay === 'B2-06');
  await emptyBay(); assert.equal(await page.locator('#cpFrameContent').isVisible(), false);
  await page.locator('#cpVehicle3D').screenshot({ path: path.join(output, 'no-data-bay-zh-mobile.png') });
  const missing = JSON.parse(await page.locator('#cpVehicleHost').getAttribute('data-zone-colors'));
  assert.equal(Object.values(missing).every(zone => zone.peakC === null && zone.color === null), true);

  await bay('B2-02').click(); await vehicle('B2-02');
  await page.locator('.cp-vehicle-canvas').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  assert.equal(await page.locator('#cpVehicle3D').isVisible(), false); assert.equal(await page.locator('#cpVehicleFallback').isVisible(), true);
  assert.equal(await page.locator('#cpThermalImage').isVisible(), true); assert.equal(await page.locator('.cp-bay').count(), 6);

  const blocked = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await blocked.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return /webgl/.test(type) ? null : original.call(this, type, ...args); }; });
  const fallback = await blocked.newPage(); fallback.on('pageerror', error => errors.push(error.message));
  await fallback.goto(base + '/?view=carpark&lang=en', { waitUntil: 'networkidle' });
  await fallback.locator('#cpVehicleFallback').waitFor();
  assert.equal(await fallback.locator('#cpVehicle3D').isVisible(), false); assert.equal(await fallback.locator('#cpThermalImage').isVisible(), true);
  assert.equal(await fallback.locator('.cp-bay').count(), 6); assert.equal(await fallback.locator('#cpScenarioA').isEnabled(), true);
  await fallback.locator('#cpScenarioA').click(); await fallback.locator('.cp-bay[data-bay="B2-03"]').click();
  await fallback.locator('#cpLevelmaintain').waitFor({ state: 'visible' });
  assert.equal(await fallback.locator('#cpLevelmaintain').isEnabled(), true);
  assert.equal(await fallback.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await blocked.close();
  assert.equal(requests.every(url => url.startsWith(base)), true); assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, sixBays: true, schematicLabel: true, sharedPaletteAndRenderedPixels: true, twoDKept: true,
    neutralBodyAndRearWheels: true, singleHotspotLocations: true, chargerAndConditionalCable: true, missingAndEmptyHaveNoBodyOrHotspot: true,
    contextLossFallback: true, unavailableWebGLFallback: true, mobileOverflow: false, realProviderCalls: 0, pageErrors: errors, output }, null, 2));
} finally { await browser.close(); await app.close(); }
