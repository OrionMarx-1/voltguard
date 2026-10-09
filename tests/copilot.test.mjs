import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {buildNasaReport} from '../dist/evidence.mjs';
import {createCopilot,prepareCopilotEvidence,validateCopilotOutput} from '../backend/copilot.mjs';
import {measuredHeatmap} from '../backend/measured-image.mjs';
import {retrieveGuidance} from '../dist/guidance.mjs';
import {createVoltGuardServer} from '../backend/server.mjs';
const cycle=JSON.parse(await readFile(new URL('../dist/data/cells/b0005/cycles/168.json',import.meta.url),'utf8')),report=buildNasaReport('B0005',cycle,0);
// Provider replies below are EXPLICIT TEST STUBS, never app data or a claimed API call.
const valid=evidence=>({explanation:'The recorded thermal result and capacity review address different conditions. The laboratory record supports an evidence review with limited sensor coverage.',evidence_ids:['E1','E4','E5'],uncertainty_codes:evidence.requiredUncertainty,source_ids:[]});
test('official keyword retrieval returns verifiable sources without inventing answers',()=>{assert.equal(retrieveGuidance('999').results[0].id,'fsd-call');assert.equal(retrieveGuidance('逃生','zh').results[0].id,'fsd-escape');assert.equal(retrieveGuidance('fire blanket').results.some(s=>s.summary.includes('blanket')),false);assert.equal(retrieveGuidance('obscure unsupported question').results.length,0);assert.throws(()=>retrieveGuidance('a'.repeat(241)));});
test('multimodal image uses exactly the actual NASA measurement, without interpolation',()=>{const png=Buffer.from(measuredHeatmap(report.record.temperaturesC).split(',')[1],'base64');assert.equal(png.readUInt32BE(16),8);assert.equal(png.readUInt32BE(20),8);const idat=png.subarray(41,png.length-16),pixels=inflateSync(idat);assert.equal(pixels.length,8*(1+8*3));assert.deepEqual([...pixels.subarray(1,4)],[63,161,153]);});
test('model payload removes identifiers and text; output guard rejects invented claims',()=>{const evidence=prepareCopilotEvidence(report);assert.equal(JSON.stringify(evidence).includes('B0005'),false);assert.equal(JSON.stringify(evidence).includes('2008'),false);assert.deepEqual(validateCopilotOutput(valid(evidence),evidence),valid(evidence));for(const patch of [{explanation:'The battery is confirmed safe.'},{explanation:'Temperature is 85 degrees.'},{explanation:'切斷電源，再使用防火毯。'},{source_ids:['made-up-source']},{uncertainty_codes:[]},{evidence_ids:[]}])assert.throws(()=>validateCopilotOutput({...valid(evidence),...patch},evidence));});
test('unconfigured AI never fabricates a reply; structured request/cache/failure contracts',async()=>{
 await assert.rejects(createCopilot({apiKey:''}).diagnose(report),e=>e.code==='AI_NOT_CONFIGURED');
 let calls=0,time=1000,payload;const api=createCopilot({apiKey:'test-only-no-network',now:()=>time,fetchImpl:async(url,options)=>{calls++;payload=JSON.parse(options.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(valid(prepareCopilotEvidence(report)))}]}]})};}});
 const first=await api.diagnose(report);assert.equal(first.cached,false);assert.equal(first.ruleStatus.thermal,'normal');assert.equal(first.ruleStatus.maintenance,'review');assert(first.limitations.includes('single_sensor'));assert.equal(payload.model,'gpt-4o');assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);assert.match(payload.input[0].content[1].image_url,/^data:image\/png;base64,/);
 time+=100;assert.equal((await api.diagnose(report)).cached,true);assert.equal(calls,1);time+=30001;await api.diagnose(report);assert.equal(calls,2);
 await assert.rejects(createCopilot({apiKey:'test-only',fetchImpl:async()=>{throw new Error('test network failure');}}).diagnose(report),e=>e.code==='AI_UNAVAILABLE');
 await assert.rejects(createCopilot({apiKey:'test-only',timeoutMs:5,fetchImpl:async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))))}).diagnose(report),e=>e.code==='AI_TIMEOUT');
});
test('local endpoint enforces consent/CSRF, verifies NASA evidence, never persists AI',async()=>{
 const app=await createVoltGuardServer({databasePath:':memory:',copilotOptions:{apiKey:''}});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.server.address().port}`;
 try{const health=await(await fetch(base+'/api/health')).json();assert.equal(health.aiConfigured,false);const request=(input,csrf=true)=>fetch(base+'/api/copilot/diagnose',{method:'POST',headers:{'Content-Type':'application/json',...(csrf?{'X-VoltGuard-CSRF':health.csrf}:{})},body:JSON.stringify(input)});
 assert.equal((await request({report,language:'en',consent:true},false)).status,403);
 assert.equal((await request({report,language:'en',consent:false})).status,422);
 const honest=await request({report,language:'en',consent:true});assert.equal(honest.status,503);assert.equal((await honest.json()).error,'AI_NOT_CONFIGURED');
 const altered=structuredClone(report);altered.record.temperaturesC[0][0]++;assert.equal((await request({report:altered,language:'en',consent:true})).status,422);
 assert.equal((await(await fetch(base+'/api/events')).json()).events.length,0);assert.equal((await(await fetch(base+'/api/copilot/rag?q=999&lang=en')).json()).results[0].id,'fsd-call');
 }finally{await app.close();}
});
