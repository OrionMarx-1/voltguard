import test from 'node:test';
import assert from 'node:assert/strict';
import {readThermalState,saveThermalState,thermalAlertKind,THERMAL_STATE_KEY} from '../dist/thermal-ux.mjs';
test('thermal session stores navigation only, validates NASA cell/cycle, tolerates blocked storage',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 assert.equal(readThermalState(storage),null);
 saveThermalState(storage,{mode:'nasa',cell:'B0005',cycle:50,sample:20,display3d:false,record:{private:'excluded'}});
 assert.deepEqual(readThermalState(storage),{cell:'B0005',cycle:50,sample:20,display3d:false,selection:{row:0,col:0}});
 assert.equal(values.get(THERMAL_STATE_KEY).includes('private'),false);
 const original=values.get(THERMAL_STATE_KEY);saveThermalState(storage,{mode:'live'});saveThermalState(storage,{mode:'import'});assert.equal(values.get(THERMAL_STATE_KEY),original);
 for(const invalid of ['not-json',JSON.stringify({version:1,mode:'nasa',cell:'B0018',cycle:168,sample:0}),JSON.stringify({version:1,mode:'nasa',cell:'B0005',cycle:50,sample:-1}),JSON.stringify({version:1,mode:'import',cell:'B0005',cycle:50,sample:0})]){values.set(THERMAL_STATE_KEY,invalid);assert.equal(readThermalState(storage),null);}
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};assert.equal(readThermalState(blocked),null);assert.doesNotThrow(()=>saveThermalState(blocked,{mode:'nasa'}));
});
test('alert UI mapping does not conflate maintenance, unknown evidence, or normal with thermal escalation',()=>{
 // Pure UI status contracts, not generated telemetry or demonstration records.
 assert.equal(thermalAlertKind({thermal:'danger'}),'danger');assert.equal(thermalAlertKind({thermal:'warning'}),'warning');
 for(const a of [null,{thermal:'unknown'},{thermal:'normal',maintenance:'review'},{thermal:'normal',quality:'stale'}])assert.equal(thermalAlertKind(a),null);
});
