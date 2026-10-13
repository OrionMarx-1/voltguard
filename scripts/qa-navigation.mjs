import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createVoltGuardServer } from '../backend/server.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Admin1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const app = await createVoltGuardServer({ databasePath: ':memory:', copilotOptions: { apiKey: '' },
  carparkOptions: { provider: { configured: false, kind: 'provider', complete: () => assert.fail('Navigation QA must not call AI') } } });
await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${app.server.address().port}`, output = path.resolve('.sites-runtime/qa-navigation-v18');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
async function carpark(p = page) {
  await p.locator('#carparkView').waitFor(); await p.locator('.cp-bay').nth(5).waitFor();
  assert.equal(await p.locator('#carparkTab').getAttribute('aria-current'), 'page');
  assert.equal(await p.locator('#nasaNav').isVisible(), false);
  assert.equal(await p.locator('#primaryNav').isVisible(), false);
  assert.equal(await p.locator('#rulesTab').isVisible(), false);
}
async function openNasa(view, p = page) {
  const url = new URL(p.url()); url.searchParams.set('view', view);
  await p.goto(url.toString(), { waitUntil: 'networkidle' });
}
async function nasaChrome(p = page) {
  assert.equal(await p.locator('#primaryNav').isVisible(), true);
  assert.equal(await p.locator('#carparkTab').isVisible(), true);
  assert.equal(await p.locator('#rulesTab').isVisible(), false);
  assert.equal(await p.locator('#nasaNav').isVisible(), true);
}
async function noOverflow(p = page) { assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); }
async function shot(name) { await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0); }); await page.screenshot({ path: path.join(output, name), fullPage: true }); }
try {
  await page.goto(base + '/?lang=en', { waitUntil: 'networkidle' }); await carpark();
  assert.equal(await page.locator('#primaryNav > button').count(), 2);
  assert.match(await page.locator('#contextValue').innerText(), /Simulation/);
  await shot('home-en-desktop.png');
  await page.locator('#cpScenarioA').click(); await page.locator('.cp-bay[data-bay="B2-03"][data-status="warning"]').waitFor();
  const session = app.carpark.snapshot().session.id;
  await openNasa('fleet'); await page.locator('#fleetRows .fleet-row').first().waitFor(); await nasaChrome();
  assert.equal(await page.locator('#carparkTab').innerText(), 'Back to bay monitor');
  assert.equal(await page.locator('#nasaNav > button').count(), 4);
  assert.equal(await page.locator('#fleetView').isVisible(), true);
  assert.equal(await page.locator('.verified').evaluate(el => el.classList.contains('is-simulation')), false);
  assert.match(await page.locator('#contextValue').innerText(), /NASA/);
  await page.locator('[data-cell="B0018"]').click(); await page.locator('#recordTitle').filter({ hasText: 'B0018' }).waitFor();
  assert.equal(await page.locator('#detailView').isVisible(), true);
  await page.locator('#thermalTab').click(); await page.locator('#thermalTemperature').filter({ hasNotText: '—' }).waitFor();
  assert.equal(await page.locator('#thermalView').getAttribute('data-mode'), 'nasa');
  await page.locator('#operationsTab').click(); await page.locator('#opsRecordHeader').waitFor();
  await shot('rules-operations-en-desktop.png');
  await page.locator('#carparkTab').click(); await carpark();
  assert.equal(app.carpark.snapshot().session.id, session);
  assert.equal(app.carpark.snapshot().session.scenario, 'A');
  await openNasa('operations'); assert.equal(await page.locator('#operationsView').isVisible(), true); await nasaChrome();
  await page.locator('#langButton').click(); assert.equal(await page.locator('#carparkTab').innerText(), '返回車位監控');
  await page.setViewportSize({ width: 390, height: 844 }); await noOverflow(); await shot('rules-zh-mobile.png');
  await page.locator('#carparkTab').click(); await carpark(); await noOverflow(); await shot('home-zh-mobile.png');
  await page.locator('#langButton').click(); await noOverflow();
  await page.addStyleTag({ content: 'html {font-size:24px}' }); await noOverflow();
  await openNasa('fleet'); await page.addStyleTag({ content: 'html {font-size:24px}' }); await noOverflow(); await nasaChrome();

  // A slow NASA index must not block the default homepage or replay fleet navigation.
  const delayed = await context.newPage(); delayed.on('pageerror', error => errors.push(error.message));
  let release; const gate = new Promise(resolve => { release = resolve; });
  await delayed.route('**/data/fleet-summary.json*', async route => { await gate; await route.continue(); });
  await delayed.goto(base + '/?lang=en', { waitUntil: 'domcontentloaded' }); await carpark(delayed);
  await delayed.locator('#cpScenarioB').click();
  release(); await delayed.waitForFunction(() => window.voltguard.ready); await carpark(delayed);
  assert.equal(app.carpark.snapshot().session.scenario, 'B'); await delayed.close();

  const failed = await context.newPage(); failed.on('pageerror', error => errors.push(error.message));
  await failed.route('**/data/fleet-summary.json*', route => route.fulfill({ status: 503, body: '{}' }));
  await failed.goto(base + '/?lang=en', { waitUntil: 'networkidle' }); await carpark(failed);
  assert.equal(await failed.locator('#error').isVisible(), false);
  await failed.locator('#cpReset').click(); await failed.close();

  for (const [view, selector] of [['fleet', '#fleetView'], ['detail', '#detailView'], ['thermal', '#thermalView'], ['operations', '#operationsView']]) {
    await page.goto(base + `/?view=${view}&cell=B0018&lang=en`, { waitUntil: 'networkidle' });
    await page.locator(selector).waitFor(); await nasaChrome();
    assert.equal(await page.locator('#carparkTab').innerText(), 'Back to bay monitor');
    if (view === 'detail') assert.match(await page.locator('#recordTitle').innerText(), /B0018/);
  }
  await page.goto(base + '/?view=unknown&lang=en', { waitUntil: 'networkidle' }); await carpark();

  const hosted = await context.newPage(); hosted.on('pageerror', error => errors.push(error.message));
  await hosted.route('**/api/**', route => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await hosted.goto(base + '/?lang=en', { waitUntil: 'networkidle' }); await carpark(hosted);
  await hosted.locator('#cpServiceNotice').waitFor(); assert.equal(await hosted.locator('#cpScenarioA').isDisabled(), true);
  await openNasa('fleet', hosted); await hosted.locator('#fleetRows .fleet-row').first().waitFor();
  assert.equal(await hosted.locator('#fleetRows .fleet-row').count(), 4); await hosted.close();

  const offlineContext = await browser.newContext({ viewport: { width: 390, height: 844 } }), offline = await offlineContext.newPage();
  offline.on('pageerror', error => errors.push(error.message));
  await offline.goto(base + '/?lang=en', { waitUntil: 'networkidle' }); await carpark(offline);
  await offline.evaluate(() => navigator.serviceWorker.ready); await offline.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  // An already controlled page reloads once when a replacement worker takes
  // over, so old cached modules cannot keep the old flat navigation alive.
  await offline.reload({ waitUntil: 'networkidle' }); await carpark(offline);
  const upgraded = offline.waitForEvent('framenavigated', { predicate: frame => frame === offline.mainFrame() });
  await offline.evaluate(() => { void navigator.serviceWorker.register('./sw.js?qa-upgrade=1'); });
  await upgraded; await carpark(offline); await offline.waitForLoadState('networkidle');
  await offlineContext.setOffline(true); await offline.reload({ waitUntil: 'load' }); await carpark(offline);
  await offline.evaluate(() => document.getElementById('fleetTab').click()); await offline.locator('#fleetRows .fleet-row').first().waitFor(); await noOverflow(offline);
  assert.equal(await offline.locator('#fleetRows .fleet-row').count(), 4); await offlineContext.close();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, defaultCarpark: true, nasaTabHiddenOnHome: true, nasaSubviewsPreserved: true,
    remembersNASASubview: true, legacyDeepLinks: true, simulationSessionPreserved: true, slowAndFailedNASAIsolated: true,
    publicAndOfflineBoundaries: true, serviceWorkerUpgradeReload: true, bilingual: true, mobileOverflow: false, realProviderCalls: 0, pageErrors: errors, output }, null, 2));
} finally { await browser.close(); await app.close(); }
