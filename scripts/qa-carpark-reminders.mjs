import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createVoltGuardServer } from '../backend/server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Admin1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let clock = Date.now();
const app = await createVoltGuardServer({ databasePath: ':memory:', copilotOptions: { apiKey: '' },
  carparkOptions: { now: () => clock, autoStart: false, provider: { configured: false, complete: () => assert.fail('Reminder QA must never call a model') } } });
await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${app.server.address().port}`, output = path.resolve('.sites-runtime/qa-carpark-reminders-phase2');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
await context.addInitScript(time => {
  window.qaTime = time; Date.now = () => window.qaTime;
  window.qaAudioContexts = 0; window.qaOscillators = [];
  const Native = window.AudioContext;
  window.AudioContext = class extends Native {
    constructor(...args) { super(...args); window.qaAudioContexts++; }
    createOscillator() {
      const oscillator = super.createOscillator(), record = {}; window.qaOscillators.push(record);
      const setFrequency = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
      oscillator.frequency.setValueAtTime = (hz, at) => { record.hz = hz; return setFrequency(hz, at); };
      const start = oscillator.start.bind(oscillator), stop = oscillator.stop.bind(oscillator);
      oscillator.start = at => { record.startAt = at; start(at); };
      oscillator.stop = at => { (record.stops ??= []).push(at ?? null); stop(at); };
      return oscillator;
    }
  };
}, clock);
const page = await context.newPage(), errors = [], writes = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/\/decisions$/.test(request.url())) writes.push(request.postDataJSON()); });
const bay = id => page.locator(`.cp-bay[data-bay="${id}"]`);
const row = () => page.locator('.cp-alert-row').first();
async function tick(seconds) { clock += seconds * 1000; await page.evaluate(time => { window.qaTime = time; }, clock); app.carpark.tick(); }
async function age(id, seconds) { await page.waitForFunction(({ id, seconds }) => document.querySelector(`.cp-bay[data-bay="${id}"] .cp-bay-pending-age`).textContent.includes(`${seconds} s`), { id, seconds }); }
async function count(n) { await page.waitForFunction(n => document.querySelector('#cpDecisionCount').textContent === String(n), n); }
try {
  await page.goto(base + '/?view=carpark&lang=en', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('#cpReminderEnable').innerText(), 'Click to enable alert sounds');
  assert.equal(await page.locator('#cpGlobalMute').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.evaluate(() => window.qaAudioContexts), 0);
  await page.locator('#cpScenarioA').click(); await bay('B2-03').click();
  await row().locator('.cp-alert-mute').waitFor(); await tick(59);
  assert.equal(await bay('B2-03').getAttribute('data-overdue'), 'false');
  await tick(1); await age('B2-03', 60);
  assert.equal(await bay('B2-03').getAttribute('data-status'), 'warning');
  assert.equal(await row().getAttribute('data-overdue'), 'true');
  assert.equal(await bay('B2-03').evaluate(element => getComputedStyle(element).animationName), 'cp-overdue');
  assert.equal(await row().evaluate(element => getComputedStyle(element).animationName), 'cp-overdue');
  assert.equal(await page.evaluate(() => window.qaOscillators.length), 0);
  await page.locator('#cpReminderEnable').click(); await page.waitForFunction(() => document.querySelector('#cpReminderEnable').hidden);
  assert.deepEqual(await page.evaluate(() => window.qaOscillators.map(node => node.hz)), [880, 880]);
  await row().locator('.cp-alert-mute').click(); assert.match(await row().locator('.cp-alert-mute').innerText(), /Muted: 60 s left/);
  assert.equal(app.carpark.detail('B2-03').decisions.length, 0);
  await tick(59); await page.waitForFunction(() => document.querySelector('.cp-alert-mute').textContent.includes('1 s left'));
  const mutedCount = await page.evaluate(() => window.qaOscillators.length);
  await tick(1); await page.waitForFunction(() => !document.querySelector('.cp-alert-mute').disabled);
  assert.equal(await page.evaluate(() => window.qaOscillators.length), mutedCount + 2);
  await page.locator('#cpGlobalMute').click(); assert.equal(await page.locator('#cpGlobalMute').getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('#cpGlobalMute').innerText(), /Sounds: muted/);
  await row().locator('.cp-alert-mute').click();
  await page.reload({ waitUntil: 'networkidle' }); await row().locator('.cp-alert-mute').waitFor();
  await bay('B2-03').click();
  assert.equal(await page.locator('#cpGlobalMute').getAttribute('aria-pressed'), 'false'); assert.equal(await row().locator('.cp-alert-mute').isEnabled(), true);
  await age('B2-03', 120); assert.equal(app.carpark.detail('B2-03').alert.pendingSeconds, 120);
  await page.locator('#langButton').click(); assert.equal(await page.locator('#cpReminderEnable').innerText(), '點擊啟用提醒音');
  assert.match(await bay('B2-03').innerText(), /已 120 秒未處理/);
  await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(output, 'warning-overdue-muted-zh-mobile.png'), fullPage: true });
  await page.locator('#langButton').click(); await page.locator('#cpOperator').fill('P1');
  await page.locator('#cpExtra_dispatch_patrol').check(); await page.locator('#cpDecisionSubmit').click(); await count(1);
  assert.equal(app.carpark.detail('B2-03').alert.pendingSeconds, 120); assert.equal(await bay('B2-03').getAttribute('data-overdue'), 'true');
  await page.locator('#cpLevelmaintain').check(); await page.locator('#cpDecisionSubmit').click(); await count(2);
  await page.waitForFunction(() => document.querySelector('.cp-bay[data-bay="B2-03"]').dataset.overdue === 'false');
  assert.equal(await row().getAttribute('data-overdue'), 'false'); assert.equal(await row().locator('.cp-alert-mute').count(), 0);

  await page.locator('#cpScenarioB').click(); await tick(28); await bay('B2-02').click();
  await row().locator('.cp-alert-mute').waitFor();
  await page.locator('#cpReminderEnable').click(); await page.waitForFunction(() => document.querySelector('#cpReminderEnable').hidden);
  await tick(14); await page.locator('.cp-bay[data-bay="B2-02"][data-status="danger"]').waitFor();
  await page.waitForFunction(() => window.qaOscillators.filter(node => node.hz === 1320).length === 3);
  await tick(15); assert.equal(await bay('B2-02').getAttribute('data-overdue'), 'false');
  await tick(1); await age('B2-02', 30); assert.equal(await bay('B2-02').getAttribute('data-status'), 'danger');
  assert.equal(await row().getAttribute('data-overdue'), 'true');
  assert.deepEqual(writes.map(write => write.level), [null, 'maintain']); assert.ok(writes.every(write => !('muted' in write)));
  assert.equal(app.carpark.detail('B2-02').ai.status, 'unavailable'); assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, enableGesture: true, webAudioScheduleChecked: true, speakerOutputNotAsserted: true, serverAgeSurvivesRefresh: true,
    warningAndDangerFlash: true, levelUnchanged: true, singleMuteExpiry: true, browserOnlyMute: true, handledStops: true, aiIndependent: true, realProviderCalls: 0, mobileOverflow: false, pageErrors: errors, output }, null, 2));
} finally { await browser.close(); await app.close(); }
