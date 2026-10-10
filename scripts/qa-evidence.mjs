import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createVoltGuardServer} from '../backend/server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/Admin1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const app=await createVoltGuardServer({databasePath:':memory:'});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${app.server.address().port}`,out=path.resolve('.sites-runtime/qa-v9');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const temperature=()=>page.locator('.ops-reading>div>strong').first().innerText();
try{
 await page.goto(base+'/?view=thermal&lang=en',{waitUntil:'networkidle'});await page.locator('#thermalTemperature').filter({hasNotText:'—'}).waitFor();
 await page.locator('#thermalScrub').evaluate(el=>{el.value=0;el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await page.locator('#thermalTemperature').innerText(),'25.09');await page.locator('#thermalHandover').click();
 assert.match(await temperature(),/25.09/);await page.locator('#opsSave').click();await page.locator('.ops-event').waitFor();
 await page.locator('[data-report]').click();assert.match(await temperature(),/25.09/);
 await page.locator('[data-action="acknowledge"]').click();await page.locator('[data-action="close"]').waitFor();await page.locator('[data-action="close"]').click();
 await page.locator('.ops-event strong').filter({hasText:'Closed'}).waitFor();await page.locator('[data-history]').click();
 await page.locator('.ops-history-timeline li').first().waitFor();assert.equal(await page.locator('.ops-history-timeline li').count(),3);
 assert.deepEqual(await page.locator('.ops-history-timeline li').evaluateAll(items=>items.map(item=>item.dataset.action)),['created','acknowledge','close']);
 const historyDownload=page.waitForEvent('download');await page.locator('#opsHistoryExport').click();await(await historyDownload).saveAs(path.join(out,'processing-history.json'));
 const audit=JSON.parse(await fs.readFile(path.join(out,'processing-history.json'),'utf8'));assert.equal(audit.event.report.sourceRef.sampleIndex,0);
 await page.screenshot({path:path.join(out,'history-en-desktop.png')});await page.keyboard.press('Escape');assert.equal(await page.locator('#opsHistoryDialog').isVisible(),false);
 const reportDownload=page.waitForEvent('download');await page.locator('#opsJson').click();const download=await reportDownload;await download.saveAs(path.join(out,'selected-sample-report.json'));
 const saved=JSON.parse(await fs.readFile(path.join(out,'selected-sample-report.json'),'utf8'));assert.equal(saved.sourceRef.sampleIndex,0);assert.equal(saved.record.temperaturesC[0][0],25.0933);
 // Real exported evidence: reload it after selecting a different cell. Computed
 // conclusions in a file are deliberately ignored; sensor values are never seeded.
 await page.locator('[data-ops-cell="B0018"]').click();await page.locator('#opsRecordHeader').filter({hasText:'B0018'}).waitFor();
 saved.assessment={thermal:'danger'};saved.policy={validatedForVehicles:true};
 await page.locator('#opsFile').setInputFiles({name:'actual-export-with-untrusted-conclusion.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
 await page.locator('#opsMessage').filter({hasText:'Report reloaded'}).waitFor();assert.match(await temperature(),/25.09/);assert.equal(await page.locator('.ops-decision strong').innerText(),'No threshold crossed');
 await page.locator('#opsInspect').click();await page.locator('#thermalView').waitFor();assert.equal(await page.locator('#thermalTemperature').innerText(),'25.09');
 await page.locator('#thermalHandover').click();const mismatch=structuredClone(saved);mismatch.record.temperaturesC[0][0]=38.3718;
 await page.locator('#opsFile').setInputFiles({name:'mismatched-source-report.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(mismatch))});
 await page.locator('#opsMessage').filter({hasText:'do not match'}).waitFor();assert.match(await temperature(),/25.09/);
 await page.locator('[data-history]').click();await page.locator('.ops-history-timeline li').first().waitFor();
 // Change language through the same event used by the language control while a modal is open.
 await page.evaluate(()=>document.getElementById('langButton').click());assert.equal(await page.locator('#opsHistoryTitle').innerText(),'評估處理時間線');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:path.join(out,'history-zh-mobile.png')});await page.keyboard.press('Escape');
 const historyPath='**/api/events/*/history';await page.route(historyPath,route=>route.abort());await page.locator('[data-history]').click();
 await page.locator('#opsHistoryRetry').waitFor();assert.equal(await page.locator('#opsHistoryExport').isDisabled(),true);await page.unroute(historyPath);
 await page.locator('#opsHistoryRetry').click();await page.locator('.ops-history-timeline li').first().waitFor();assert.equal(await page.locator('#opsHistoryExport').isEnabled(),true);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,selectedSamplePersisted:true,reportRoundTrip:true,recomputedConclusion:true,mismatchRejected:true,threeDimensionalRoundTrip:true,auditOrder:true,auditExport:true,bilingualModal:true,mobile:true,historyRetry:true,output:out}));
}finally{await browser.close();await app.close();}
