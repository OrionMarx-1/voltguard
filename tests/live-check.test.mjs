import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildNasaReport} from '../dist/evidence.mjs';
import {createCopilot,prepareCopilotEvidence} from '../backend/copilot.mjs';
import {runLiveCheck} from '../scripts/live-copilot-check.mjs';
const cycle=JSON.parse(await readFile(new URL('../dist/data/cells/b0005/cycles/168.json',import.meta.url),'utf8')),report=buildNasaReport('B0005',cycle,0);
// Provider replies below are EXPLICIT TEST STUBS, never app data or a claimed API call.
const reply=()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({explanation:'Laboratory evidence review with limited sensor coverage.',evidence_ids:['E1'],uncertainty_codes:prepareCopilotEvidence(report).requiredUncertainty,source_ids:[]})}]}]})});
test('live check refuses to run without a key and makes no provider call',async()=>{
 let calls=0;const result=await runLiveCheck({copilot:createCopilot({apiKey:'',fetchImpl:async()=>{calls++;}}),report});
 assert.equal(result.ok,false);assert.equal(result.error,'AI_NOT_CONFIGURED');assert.equal(calls,0);
});
test('live check runs en, cached en and zh, waiting past the rate limit, without exposing the key',async()=>{
 const key='sk-test-only-never-real-0123456789';let time=0,calls=0;const languages=[];
 const copilot=createCopilot({apiKey:key,now:()=>time,fetchImpl:async(_url,options)=>{calls++;languages.push(JSON.parse(options.body).instructions.includes('Traditional Chinese')?'zh':'en');return reply();}});
 const result=await runLiveCheck({copilot,report,wait:async ms=>{time+=ms;}});
 assert.equal(result.ok,true);assert.deepEqual(result.steps.map(s=>[s.name,s.cached]),[['en-first',false],['en-repeat-cache',true],['zh-first',false]]);
 assert.equal(calls,2);assert.deepEqual(languages,['en','zh']);assert.equal(JSON.stringify(result).includes(key),false);
});
test('live check reports provider failures as error codes, not as success',async()=>{
 const result=await runLiveCheck({copilot:createCopilot({apiKey:'test-only',fetchImpl:async()=>({ok:false,status:403})}),report,wait:async()=>{}});
 assert.equal(result.ok,false);assert.equal(result.steps[0].error,'AI_PROVIDER_ERROR');
});
