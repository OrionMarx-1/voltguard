import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { normalizeTelemetry, assessTelemetry, assessNasaCycle } from '../dist/safety.mjs';
import { createVoltGuardServer } from '../backend/server.mjs';
import {buildNasaReport,decodeMeasuredImport} from '../dist/evidence.mjs';
import {createHash} from 'node:crypto';

const nasa = JSON.parse(await readFile(new URL('../dist/data/cells/b0005/cycles/168.json', import.meta.url)));
const record = {assetId:'test-hardware-alias',mode:'historical',source:'NASA contract test',timestamp:'2008-05-27T20:45:00Z',temperaturesC:[[nasa.samples[0].c]]};
// UTC and rule-boundary fixtures below test the API contract, not NASA timezone or a real fire.
// None of these fixtures are served as application data or seeded into the user event database.
test('measured NASA cycle retains thermal/maintenance separation', () => {
  const a=assessNasaCycle(nasa);assert.equal(a.thermal,'normal');assert.equal(a.maintenance,'review');assert.equal(a.sensorCount,1);assert.equal(a.peakC,41.051);
});
test('report round trips rebuild measured evidence rather than trusting conclusions or provenance',async()=>{
  const report=buildNasaReport('B0005',nasa,3),loadNasaCycle=async ref=>{assert.equal(ref.cell,'B0005');assert.equal(ref.dischargeCycle,168);return nasa;};
  const restored=await decodeMeasuredImport({...report,assessment:{thermal:'danger'},policy:{validatedForVehicles:true},VIN:'must-not-retain'},{loadNasaCycle});
  assert.equal(restored.report.assessment.thermal,'normal');assert.equal(restored.report.policy.validatedForVehicles,false);
  assert.equal(restored.report.record.temperaturesC[0][0],nasa.samples[3].c);assert.equal(restored.report.record.sampleElapsedSeconds,nasa.samples[3].t);assert.equal(restored.report.VIN,undefined);
  const privateReport=structuredClone(report);privateReport.record.assetId=createHash('sha256').update('B0005').digest('hex').slice(0,16);
  assert.equal((await decodeMeasuredImport(privateReport,{loadNasaCycle})).nasaReference.sampleIndex,3);
  const altered=structuredClone(report);altered.record.temperaturesC[0][0]=nasa.samples[4].c;
  await assert.rejects(decodeMeasuredImport(altered,{loadNasaCycle}),/REPORT_MISMATCH/);
  await assert.rejects(decodeMeasuredImport({...report,sourceRef:{...report.sourceRef,cell:'..'}},{loadNasaCycle}),/NASA_REFERENCE/);
  await assert.rejects(decodeMeasuredImport({...report,sourceRef:undefined},{loadNasaCycle}),/NASA_REFERENCE/);
  const snapshot={schemaVersion:'voltguard-report-1',provenance:'claimed_verified',record:{...record,VIN:'stripped'},assessment:{thermal:'normal'},eventHistory:[{action:'close'}]};
  const imported=await decodeMeasuredImport(snapshot);assert.equal(imported.report.provenance,'user_supplied_unverified');assert.equal(imported.report.assessment.thermal,'unknown');assert.equal(imported.report.eventHistory,undefined);assert.equal(imported.report.record.VIN,undefined);
  await assert.rejects(decodeMeasuredImport({...snapshot,record:{...record,mode:'live'}}),/HISTORICAL_REQUIRED/);
  const current={...record,timestamp:'2008-05-27T20:45:28.900Z',temperaturesC:[[nasa.samples[1].c]]};
  const sequence=await decodeMeasuredImport({records:[record,current]});
  const repeated=await decodeMeasuredImport(sequence.report);assert.deepEqual(repeated.report.assessment,sequence.report.assessment);assert.deepEqual(repeated.report.previousMeasurement,sequence.report.previousMeasurement);
});
test('invalid measurements and personally identifying fields', () => {
  const stripped=normalizeTelemetry({...record,VIN:'not-retained',driver:'not-retained',location:'not-retained'});
  assert.equal(stripped.VIN,undefined);assert.equal(stripped.driver,undefined);assert.equal(stripped.location,undefined);
  for(const matrix of [[[null]],[[NaN]],[[Infinity]],[[1],[2,3]],[["30"]],[],[[1001]]]) assert.throws(()=>normalizeTelemetry({...record,temperaturesC:matrix}));
  assert.throws(()=>normalizeTelemetry({...record,timestamp:'2008-05-27 20:45'}));
  assert.throws(()=>normalizeTelemetry({...record,capacityAh:1}));
});
test('missing slope and missing sensors never assert normal', () => {
  assert.equal(assessTelemetry(normalizeTelemetry(record)).thermal,'unknown');
  const next={...record,timestamp:'2008-05-27T20:45:10Z',temperaturesC:[[nasa.samples[0].c]]};
  assert.equal(assessTelemetry(next,record).thermal,'normal');
  assert.throws(()=>assessTelemetry(record,next),/OUT_OF_ORDER/);
  assert.equal(assessTelemetry({...next,timestamp:'2008-05-27T20:46:00Z'},record).thermal,'unknown');
  assert.equal(assessTelemetry({...record,temperaturesC:[[record.temperaturesC[0][0],null]]}).thermal,'unknown');
});
test('inclusive prototype boundaries and stale live quality', () => {
  assert.equal(assessTelemetry({...record,temperaturesC:[[60]]}).thermal,'warning');
  assert.equal(assessTelemetry({...record,temperaturesC:[[80]]}).thermal,'danger');
  const second={...record,timestamp:'2008-05-27T20:45:01Z',temperaturesC:[[record.temperaturesC[0][0]+2]]};
  assert.equal(assessTelemetry(second,record).thermal,'danger');
  assert.equal(assessTelemetry({...record,mode:'live'}).quality,'stale');
});
test('authorized live contract, rate persistence and unresolved thermal closure guard', async()=>{
  const token='isolated-live-contract-test-token';
  const app=await createVoltGuardServer({databasePath:':memory:',ingestToken:token});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  try{
    const health=await(await fetch(base+'/api/health')).json();
    const now=Date.now()-1000;
    const send=async(temperature,seconds)=>fetch(base+'/api/telemetry/ingest',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({...record,mode:'live',timestamp:new Date(now+seconds*1000).toISOString(),temperaturesC:[[temperature]],operatingState:'driving'})});
    const first=await(await send(nasa.samples[0].c,0)).json();assert.equal(first.report.assessment.thermal,'unknown');
    const second=await(await send(nasa.samples[1].c,1)).json();assert.equal(second.report.assessment.thermal,'normal');
    const fleet=await(await fetch(base+'/api/fleet')).json();assert.equal(fleet.records[0].assessment.thermal,'normal');assert.equal(fleet.records[0].record.operatingState,'driving');
    assert.equal((await send(nasa.samples[0].c,0)).status,422);
    // 80°C is strictly an isolated rule-boundary fixture, not a measured fire.
    await send(80,2);
    const events=await(await fetch(base+'/api/events')).json();assert.equal(events.events[0].kind,'thermal');
    const id=events.events[0].id;
    const action=action=>fetch(base+`/api/events/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json','X-Voltguard-Csrf':health.csrf},body:JSON.stringify({action})});
    assert.equal((await action('acknowledge')).status,200);assert.equal((await action('close')).status,409);
    await send(nasa.samples[1].c,3);assert.equal((await action('close')).status,200);
  }finally{await app.close();}
});
test('local service: real record, persistence, CSRF, transition audit and WebSocket', async () => {
  const directory=await mkdtemp(path.join(os.tmpdir(),'voltguard-tests-'));
  const db=path.join(directory,'test.sqlite');
  const app=await createVoltGuardServer({databasePath:db,ingestToken:'test-only-contract-token-123456789'});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  let ws;
  try {
    const health=await(await fetch(base+'/api/health')).json();
    const request=async(route,method,body,headers={})=>fetch(base+route,{method,headers:{'Content-Type':'application/json','X-Voltguard-Csrf':health.csrf,...headers},body:body?JSON.stringify(body):undefined});
    const sw=await fetch(base+'/sw.js');assert.match(sw.headers.get('content-type'),/javascript/);
    assert.equal((await request('/api/records/nasa','POST',{cell:'B0005',cycle:168},{'X-Voltguard-Csrf':''})).status,403);
    ws=new WebSocket(base.replace('http','ws')+'/ws');
    const connected=await new Promise((resolve,reject)=>{ws.addEventListener('message',e=>resolve(JSON.parse(e.data)),{once:true});ws.addEventListener('error',reject,{once:true});});
    assert.equal(connected.type,'connected');
    const pushed=new Promise(resolve=>ws.addEventListener('message',e=>resolve(JSON.parse(e.data)),{once:true}));
    const saved=await(await request('/api/records/nasa','POST',{cell:'B0005',cycle:168,sampleIndex:3})).json();
    assert.equal(saved.report.assessment.thermal,'normal');assert.equal(saved.report.assessment.maintenance,'review');
    assert.match(saved.report.record.assetId,/^[0-9a-f]{16}$/);assert.equal((await pushed).type,'telemetry');
    assert.equal(saved.report.record.temperaturesC[0][0],nasa.samples[3].c);assert.equal(saved.report.sourceRef.sampleIndex,3);
    assert.equal((await request('/api/records/nasa','POST',{cell:'B0005',cycle:168,sampleIndex:-1})).status,422);
    const duplicate=await(await request('/api/records/nasa','POST',{cell:'B0005',cycle:168,sampleIndex:5})).json();assert.equal(duplicate.duplicate,true);assert.equal(duplicate.report.sourceRef.sampleIndex,3);
    const list=await(await fetch(base+'/api/events')).json();assert.equal(list.events.length,1);assert.equal(list.events[0].kind,'maintenance');
    const id=list.events[0].id;
    const historyRoute=`/api/events/${id}/history`;
    assert.deepEqual((await(await fetch(base+historyRoute)).json()).history.map(item=>item.action),['created']);
    assert.equal((await request(`/api/events/${id}`,'PATCH',{action:'close'})).status,409);
    assert.equal((await request(`/api/events/${id}`,'PATCH',{action:'acknowledge'})).status,200);
    assert.equal((await request(`/api/events/${id}`,'PATCH',{action:'acknowledge'})).status,409);
    assert.equal((await request(`/api/events/${id}`,'PATCH',{action:'close'})).status,200);
    const audit=await(await fetch(base+historyRoute)).json();assert.deepEqual(audit.history.map(item=>item.action),['created','acknowledge','close']);assert.equal(audit.event.report.sourceRef.sampleIndex,3);
    assert.equal((await fetch(base+'/api/events/999999/history')).status,404);
    assert.equal((await fetch(base+historyRoute,{headers:{Origin:'https://foreign.invalid'}})).status,403);
    assert.equal((await request('/api/telemetry/ingest','POST',{...record,mode:'live'})).status,401);
    assert.equal((await request('/api/telemetry/ingest','POST',{...record,mode:'live'},{Authorization:'Bearer test-only-contract-token-123456789'})).status,422);
    const foreign=await fetch(base+'/api/health',{headers:{Origin:'https://foreign.invalid'}});assert.equal(foreign.status,403);
    const missing=await fetch(base+'/api/missing');assert.equal(missing.status,404);
  } finally {ws?.close();await app.close();}
  const restarted=await createVoltGuardServer({databasePath:db});
  await new Promise(resolve=>restarted.server.listen(0,'127.0.0.1',resolve));
  try{const restartBase=`http://127.0.0.1:${restarted.server.address().port}`,data=await(await fetch(restartBase+'/api/events')).json();assert.equal(data.events[0].status,'closed');const audit=await(await fetch(restartBase+`/api/events/${data.events[0].id}/history`)).json();assert.deepEqual(audit.history.map(item=>item.action),['created','acknowledge','close']);}
  finally{await restarted.close();}
});
