// UI state only: never persist imported/live measurements or generated data.
export const THERMAL_STATE_KEY='vg-thermal-state-v1';
export function readThermalState(storage){
 try{
  const s=JSON.parse(storage.getItem(THERMAL_STATE_KEY));
  const maxCycles={B0005:168,B0006:168,B0007:168,B0018:132};
  if(!s||s.version!==1||s.mode!=='nasa'||!Object.hasOwn(maxCycles,s.cell)||!Number.isInteger(s.cycle)||s.cycle<1||s.cycle>maxCycles[s.cell]||!Number.isInteger(s.sample)||s.sample<0||s.sample>100000)return null;
  return {cell:s.cell,cycle:s.cycle,sample:s.sample,selection:{row:0,col:0},display3d:typeof s.display3d==='boolean'?s.display3d:null};
 }catch{return null;}
}
export function saveThermalState(storage,state){
 if(state.mode!=='nasa')return;
 try{storage.setItem(THERMAL_STATE_KEY,JSON.stringify({version:1,mode:'nasa',cell:state.cell,cycle:state.cycle,sample:state.sample,display3d:state.display3d}));}catch{}
}
export function thermalAlertKind(assessment){return ['warning','danger'].includes(assessment?.thermal)?assessment.thermal:null;}
