import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createVoltGuardServer} from '../backend/server.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/Admin1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const app=await createVoltGuardServer({databasePath:':memory:'});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${app.server.address().port}`,out=path.resolve('.sites-runtime/qa-v8');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base+'/?lang=en&view=operations',{waitUntil:'networkidle'});await page.locator('#opsRecordHeader').waitFor();
 assert.match(await page.locator('#opsRecordHeader').innerText(),/B0005/);
 assert.equal(await page.locator('#opsLibrary button').count(),4);
 assert.equal(await page.locator('.ops-metric.thermal strong').innerText(),'0');
 assert.equal(await page.locator('.ops-metric.maintenance strong').innerText(),'3');
 await page.locator('[data-ops-cell="B0018"]').click();await page.locator('#opsRecordHeader').filter({hasText:'B0018'}).waitFor();
 assert.match(await page.locator('#opsMeasurements').innerText(),/38.37/);
 await page.locator('#opsInspect').click();await page.locator('#thermalMapMeta').filter({hasText:'B0018 / 132'}).waitFor();
 assert.equal(await page.locator('#thermalTemperature').innerText(),'38.37');
 await page.locator('#thermalHandover').click();assert.match(await page.locator('#opsRecordHeader').innerText(),/B0018/);
 const failedPath='**/data/cells/b0006/cycles/168.json';await page.route(failedPath,route=>route.abort());
 await page.locator('[data-ops-cell="B0006"]').click();await page.locator('#opsMessage').filter({hasText:'could not be loaded'}).waitFor();
 assert.match(await page.locator('#opsRecordHeader').innerText(),/B0018/);
 assert.equal(await page.locator('#opsNasa').isEnabled(),true);await page.unroute(failedPath);
 await page.locator('[data-ops-cell="B0006"]').click();await page.locator('#opsRecordHeader').filter({hasText:'B0006'}).waitFor();
 assert.match(await page.locator('#opsMeasurements').innerText(),/58.25/);
 await page.locator('.ops-guidance summary').click();assert.equal(await page.locator('#opsChecklist li').count(),4);
 await page.locator('.ops-guidance summary').click();await page.locator('#langButton').click();await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'workbench-zh-mobile.png'),fullPage:true});
 // Simulate ONLY static hosting capabilities, not sensor data. Public mode has no API.
 const publicPage=await context.newPage();publicPage.on('pageerror',e=>errors.push(e.message));
 await publicPage.route('**/api/health',route=>route.fulfill({status:404,body:'not available'}));
 await publicPage.setViewportSize({width:1440,height:1000});await publicPage.goto(base+'/?lang=en&view=operations',{waitUntil:'networkidle'});
 await publicPage.locator('#opsServiceText').filter({hasText:'Public workspace'}).waitFor();await publicPage.locator('#opsRecordHeader').waitFor();
 assert.equal(await publicPage.locator('#opsSave').isDisabled(),true);
 assert.equal(await publicPage.locator('#opsJson').isEnabled(),true);assert.equal(await publicPage.locator('#opsPrint').isEnabled(),true);
 assert.match(await publicPage.locator('#opsEvents').innerText(),/no connected durable event service/);
 assert.equal(await publicPage.locator('.ops-metric.gateway strong').innerText(),'—');
 assert.equal(/[\u3400-\u9fff]/.test((await publicPage.locator('body').innerText()).replace('中文','')),false);
 await publicPage.screenshot({path:path.join(out,'workbench-public-en.png'),fullPage:true});
 await publicPage.locator('#langButton').click();await publicPage.screenshot({path:path.join(out,'workbench-public-zh.png'),fullPage:true});
 // Check usable text enlargement independently of the normal mobile layout.
 await publicPage.locator('html').evaluate(el=>el.style.fontSize='32px');
 assert.equal(await publicPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,autoLoad:true,trueHistoricalCounts:true,latestB0018Cycle:true,threeDimensionalHandover:true,loadFailurePreservesEvidence:true,guidanceDisclosure:true,mobile:true,publicStorageBoundary:true,bilingual:true,textEnlargement:true,output:out}));
}finally{await browser.close();await app.close();}
