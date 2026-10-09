import {assessTelemetry} from './safety.mjs';
// Explicit deterministic demonstration fixtures. Never a measured telemetry record.
// Two identical synthetic frames, one synthetic second apart, supply a zero rise
// rate for the shared rules. No vehicle, voltage, current or acquisition is claimed.
export function buildSimulation(scenario){
 if(!['normal','warning','danger'].includes(scenario))throw new RangeError('SIMULATION_SCENARIO');
 const matrix=Array.from({length:4},(_,r)=>Array.from({length:4},(_,c)=>{
  const d=Math.max(Math.abs(r-2),Math.abs(c-2)),offset=(r*4+c)%5;
  if(scenario==='normal')return 33+(offset+2)%5;
  if(r===2&&c===2)return scenario==='warning'?62:85.4;
  if(d===1)return (scenario==='warning'?45:55)+offset*2;
  return scenario==='warning'?33+offset:40+offset*2;
 }));
 const common={assetId:'SIM-DEMO',source:'voltguard-simulator',mode:'historical',temperaturesC:matrix};
 const before={...common,timestamp:'2000-01-01T00:00:00Z'},after={...common,timestamp:'2000-01-01T00:00:01Z'};
 const assessment={...assessTelemetry(after,before),quality:'simulation'};
 matrix.forEach(Object.freeze);Object.freeze(matrix);Object.freeze(assessment);
 return Object.freeze({kind:'simulation',scenario,matrix,assessment,syntheticIntervalSeconds:1});
}
