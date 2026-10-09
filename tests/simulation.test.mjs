import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSimulation} from '../dist/thermal-simulation.mjs';
test('explicit deterministic demo scenarios use shared rules without exposing a telemetry report',()=>{
 for(const type of ['normal','warning','danger']){
  const s=buildSimulation(type);assert.equal(s.kind,'simulation');assert.equal(s.assessment.thermal,type);assert.equal(s.assessment.quality,'simulation');assert.equal(s.assessment.riseCPerS,0);assert.equal(s.assessment.sohPercent,null);assert.equal(s.matrix.length,4);assert.ok(s.matrix.every(row=>row.length===4));assert.deepEqual(s,buildSimulation(type));assert.equal(Object.hasOwn(s,'record'),false);assert.equal(Object.hasOwn(s,'timestamp'),false);assert.ok(Object.isFrozen(s.matrix[0]));
 }
 assert.equal(buildSimulation('normal').matrix[2][2],35);assert.equal(buildSimulation('warning').matrix[2][2],62);assert.equal(buildSimulation('danger').matrix[2][2],85.4);assert.throws(()=>buildSimulation('vehicle'),/SIMULATION_SCENARIO/);
});
