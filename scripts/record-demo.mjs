import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createVoltGuardServer} from '../backend/server.mjs';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/Admin1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const app=await createVoltGuardServer({databasePath:':memory:',copilotOptions:{apiKey:''}});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
let context;try{
 context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',recordVideo:{dir:path.resolve('.sites-runtime/demo-recording'),size:{width:1280,height:900}}});
 const page=await context.newPage();await page.goto(`http://127.0.0.1:${app.server.address().port}/?lang=en`,{waitUntil:'networkidle'});await page.locator('#thermalTemperature').filter({hasNotText:'—'}).waitFor();
 await page.evaluate(()=>{const note=document.createElement('div');note.textContent='Recorded prototype · 3 Oct 2026 · Historical NASA data · No vehicle connected · AI not configured';Object.assign(note.style,{position:'fixed',bottom:'0',left:'0',right:'0',padding:'10px',background:'#ffffff',color:'#17313f',fontSize:'14px',textAlign:'center',borderTop:'1px solid #bcd1dd',zIndex:'1000'});document.body.append(note);});
 await page.waitForTimeout(2000);const box=await page.locator('#thermal3d').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.55,{steps:20});await page.mouse.up();await page.waitForTimeout(1800);
 await page.locator('#thermalScrub').evaluate(el=>{el.value=Math.round(Number(el.max)*.25);el.dispatchEvent(new Event('input',{bubbles:true}));});await page.waitForTimeout(1500);await page.locator('#thermalPeak').click();await page.waitForTimeout(1800);
 await page.locator('#thermalHandover').click();await page.locator('#opsRecordHeader').waitFor();await page.locator('.ops-review').scrollIntoViewIfNeeded();await page.waitForTimeout(2000);
 await page.locator('#copilotPanel>summary').click();await page.locator('#cpQuery').fill('999');await page.locator('#cpSearch').click();await page.locator('#copilotPanel').scrollIntoViewIfNeeded();await page.waitForTimeout(3500);
 await page.locator('#fieldToggle').click();await page.locator('.ops-review').scrollIntoViewIfNeeded();await page.waitForTimeout(2500);await page.locator('#fieldExit').click();await page.locator('#fieldInspect').count();
 const video=page.video();await context.close();context=null;await video.saveAs(path.resolve('pitch/demo-backup.webm'));console.log(JSON.stringify({recorded:true,output:'pitch/demo-backup.webm',measuredData:'NASA B0005 cycle 168',voiceover:false,realApiCall:false,realVehicle:false,rehearsalEvidence:false}));
}finally{if(context)await context.close();await browser.close();await app.close();}
