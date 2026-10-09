import {normalizeTelemetry,assessTelemetry,assessNasaCycle,createReport,ValidationError} from './safety.mjs';

const fail=code=>{throw new ValidationError(code);};
export const NASA_CELLS=Object.freeze(['B0005','B0006','B0007','B0018']);
export function validateNasaReference(ref){
  if(!ref||ref.dataset!=='nasa-ames-pcoe'||!NASA_CELLS.includes(ref.cell)||!Number.isInteger(ref.dischargeCycle)||ref.dischargeCycle<1||ref.dischargeCycle>(ref.cell==='B0018'?132:168)||!Number.isInteger(ref.sampleIndex)||ref.sampleIndex<0)fail('NASA_REFERENCE');
  return {dataset:'nasa-ames-pcoe',cell:ref.cell,dischargeCycle:ref.dischargeCycle,sampleIndex:ref.sampleIndex};
}
export function buildNasaReport(cell,cycle,sampleIndex=0){
  const sourceRef=validateNasaReference({dataset:'nasa-ames-pcoe',cell,dischargeCycle:cycle.dischargeCycle,sampleIndex});
  const point=cycle.samples[sampleIndex];if(!point)fail('NASA_SAMPLE');
  const record={assetId:cell,mode:'historical',source:'NASA Ames PCoE',timestamp:cycle.recordedAt,temperaturesC:[[point.c]],voltageV:point.v,currentA:point.a,capacityAh:cycle.capacityAh,sourceCycle:cycle.sourceCycle,dischargeCycle:cycle.dischargeCycle,sampleElapsedSeconds:point.t};
  return {...createReport(record,assessNasaCycle(cycle),'bundled_nasa_record'),assessmentScope:'full_discharge_cycle',sourceRef};
}
async function aliasHash(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('').slice(0,16);}

// All file conclusions and audit fields are untrusted. Rebuild from measurements.
// NASA provenance is restored ONLY by exact comparison with a bundled source record.
export async function decodeMeasuredImport(input,{loadNasaCycle}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('OBJECT_REQUIRED');
  if(input.schemaVersion!==undefined){
    if(input.schemaVersion!=='voltguard-report-1')fail('REPORT_SCHEMA');
    if(input.provenance==='bundled_nasa_record'){
      if(!input.sourceRef)fail('NASA_REFERENCE');
      const ref=validateNasaReference(input.sourceRef);
      const cycle=await loadNasaCycle(ref),canonical=buildNasaReport(ref.cell,cycle,ref.sampleIndex);
      const record=input.record;
      if(!record||![ref.cell,await aliasHash(ref.cell)].includes(record.assetId))fail('REPORT_MISMATCH');
      for(const [key,value] of Object.entries(canonical.record))if(key!=='assetId'&&JSON.stringify(record[key])!==JSON.stringify(value))fail('REPORT_MISMATCH');
      return {report:canonical,records:[canonical.record],nasaReference:ref};
    }
    input={records:[...(input.previousMeasurement?[input.previousMeasurement]:[]),input.record]};
  }
  const supplied=input.records??[input];
  if(!Array.isArray(supplied)||supplied.length<1||supplied.length>1000)fail('RECORD_COUNT');
  const records=[];let previous=null,report=null;
  for(const item of supplied){
    const record=normalizeTelemetry(item);
    if(record.mode!=='historical')fail('HISTORICAL_REQUIRED');
    if(previous&&(record.assetId!==previous.assetId||record.source!==previous.source||record.temperaturesC.length!==previous.temperaturesC.length||record.temperaturesC[0].length!==previous.temperaturesC[0].length))fail('PREVIOUS_CHANNEL');
    report=createReport(record,assessTelemetry(record,previous));
    if(previous)report.previousMeasurement=previous;
    records.push(record);previous=record;
  }
  return {report,records,nasaReference:null};
}
