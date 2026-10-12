// Opt-in developer walkthrough of the actual serve.mjs process. Uses the real
// wall clock and UI; never creates a provider, advances scenarios or calls 999.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { decisionTiming } from './walkthrough-metrics.mjs';

if (process.argv.slice(2).join(' ') !== '--run') throw Error('Explicit --run required: AI-enabled scenarios consume API usage on the running server.');
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Admin1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base = 'http://127.0.0.1:4173', directory = path.resolve('.sites-runtime/phase2-walkthrough');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' }), errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  window.walkClicks = [];
  document.addEventListener('click', event => { const target = event.target.closest('button,input'); if (target) window.walkClicks.push({ id: target.id || target.dataset.bay || target.className, at: new Date().toISOString() }); }, true);
});
const report = { checkedAt: new Date().toISOString(), execution: 'developer_walkthrough', browser: 'Headless Edge via Playwright', server: base,
  clock: 'Real server wall clock; no injected clock or accelerated scenario jumps.', userTest: false, audioHeard: 'Not observed: no speaker audio is returned by this environment.', paths: [], errors };
const detail = async id => (await page.request.get(base + '/api/bays/' + id)).json();
const bay = id => page.locator(`.cp-bay[data-bay="${id}"]`);
async function aiSettled(id) {
  await page.waitForFunction(() => ['available', 'unavailable'].includes(document.querySelector('#cpAiPanel')?.dataset.aiStatus), undefined, { timeout: 15000 });
  return (await detail(id)).ai;
}
try {
  await page.goto(base + '/?view=carpark', { waitUntil: 'networkidle' });
  await page.locator('#cpConnection[data-connected="true"]').waitFor();
  assert.equal(await page.locator('.cp-bay').count(), 6);
  await page.locator('#cpOperator').fill('DEV-WALK');
  report.audioEnablePrompt = await page.locator('#cpReminderEnable').innerText();
  await page.locator('#cpReminderEnable').click();
  report.audioEnabled = await page.locator('#cpReminderEnable').isHidden();
  for (const [scenario, aiEnabled] of [['A', true], ['A', false], ['B', true], ['B', false]]) {
    await page.locator('#cpReset').click(); await page.locator('#cpAlertCount').filter({ hasText: /^0$/ }).waitFor();
    if (aiEnabled) await page.locator('#cpAiToggle').check(); else await page.locator('#cpAiToggle').uncheck();
    await page.evaluate(() => { window.walkClicks = []; });
    const id = scenario === 'A' ? 'B2-03' : 'B2-02';
    await page.locator('#cpScenario' + scenario).click();
    await bay(id).click();
    await bay(id).and(page.locator('[data-status="warning"]')).waitFor({ timeout: 35000 });
    const warning = await detail(id);
    console.log(JSON.stringify({ path: `${scenario}-${aiEnabled ? 'AI-on' : 'AI-off'}`, stage: 'warning', alertCreatedAt: warning.alert.createdAt }));
    const row = { scenario, aiEnabled, warningAt: warning.alert.createdAt, aiAtWarning: await aiSettled(id), occupied: warning.summary.occupied,
      isCharging: warning.summary.isCharging, chargingBay: warning.bay.charging };
    if (scenario === 'A' && aiEnabled) {
      // Inspect whether the initial suggestion changes when history becomes sufficient.
      await page.waitForFunction(() => Number(document.querySelector('#cpThermalImage')?.dataset.frameSeq) >= 31, undefined, { timeout: 35000 });
      row.aiAfterThirtySeconds = (await detail(id)).ai;
    }
    if (scenario === 'B') {
      await bay(id).and(page.locator('[data-status="danger"]')).waitFor({ timeout: 35000 });
      const danger = await detail(id); row.dangerAt = danger.alert.updatedAt; row.aiAtDanger = await aiSettled(id);
      assert.equal(await page.locator('#cpLeveldowngrade').isDisabled(), true);
      console.log(JSON.stringify({ path: `${scenario}-${aiEnabled ? 'AI-on' : 'AI-off'}`, stage: 'danger', dangerAt: row.dangerAt }));
    }
    row.aiDisplay = await page.locator('#cpAiPanel').innerText();
    row.detailDisplay = await page.locator('#cpSelectedPanel').innerText();
    row.noDataDisplay = await bay('B2-06').innerText(); assert.match(row.noDataDisplay, /無資料|No data/);
    const current = await detail(id), run = current.ai, targetLevel = scenario === 'A' ? 'downgrade' : 'escalate';
    row.intendedLevel = targetLevel;
    if (run.status === 'available' && run.output.recommendation === targetLevel) {
      await page.locator('#cpAiConfirm').click(); row.aiChoice = 'confirmed';
    } else {
      if (run.status === 'available') { await page.locator('#cpAiReject').click(); row.aiChoice = 'rejected'; } else row.aiChoice = 'unavailable';
      await page.locator('#cpLevel' + targetLevel).check();
    }
    await page.locator('#cpDecisionSubmit').click();
    await page.waitForFunction(() => document.querySelector('#cpDecisionCount').textContent === '1');
    const after = await detail(id), decision = after.decisions[0];
    row.timing = decisionTiming(current.alert, decision); row.decision = decision;
    if (row.dangerAt) row.dangerToDecisionSeconds = (Date.parse(decision.at) - Date.parse(row.dangerAt)) / 1000;
    row.clicks = await page.evaluate(() => window.walkClicks); row.screenshot = path.join(directory, `${scenario}-${aiEnabled ? 'on' : 'off'}.png`);
    await page.screenshot({ path: row.screenshot, fullPage: true }); report.paths.push(row);
    console.log(JSON.stringify({ path: `${scenario}-${aiEnabled ? 'AI-on' : 'AI-off'}`, stage: 'saved', seconds: row.timing.alertToDecisionSeconds, aiStatus: run.status, recommendation: run.output?.recommendation ?? null, aiChoice: row.aiChoice }));
  }
  assert.deepEqual(errors, []);
  report.completed = true;
  const filename = path.join(directory, `walkthrough-${report.checkedAt.replace(/[:.]/g, '-')}.json`);
  await writeFile(filename, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ completed: true, saved: filename, audioEnabled: report.audioEnabled, paths: report.paths.length }));
} finally { await browser.close(); }
