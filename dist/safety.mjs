// Shared by the browser and the local ingestion service. No LLM decision path.
export const POLICY = Object.freeze({ version: 'prototype-1', warningTempC: 60, dangerTempC: 80, warningRiseCPerS: 1, dangerRiseCPerS: 2, validatedForVehicles: false });
export class ValidationError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new ValidationError(code); };
const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
export function normalizeTelemetry(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('OBJECT_REQUIRED');
  if (!/^[A-Za-z0-9_-]{1,48}$/.test(input.assetId || '')) fail('ASSET_ID');
  if (!['historical', 'live'].includes(input.mode)) fail('MODE');
  if (typeof input.source !== 'string' || !/^[\p{L}\p{N} _.,:/()-]{1,120}$/u.test(input.source)) fail('SOURCE');
  if (typeof input.timestamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(input.timestamp) || !Number.isFinite(Date.parse(input.timestamp))) fail('TIMESTAMP');
  const [year, month, day] = input.timestamp.slice(0,10).split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year,month,0)).getUTCDate()) fail('TIMESTAMP');
  if (input.operatingState !== undefined && !['driving','parked','charging','unknown'].includes(input.operatingState)) fail('OPERATING_STATE');
  const matrix = input.temperaturesC;
  if (!Array.isArray(matrix) || matrix.length < 1 || matrix.length > 64 || !Array.isArray(matrix[0]) || matrix[0].length < 1 || matrix[0].length > 64) fail('MATRIX');
  const cols = matrix[0].length;
  if (matrix.some(row => !Array.isArray(row) || row.length !== cols || row.some(value => value !== null && !finite(value, -60, 1000)))) fail('TEMPERATURE');
  if (matrix.length * cols > 4096 || matrix.flat().every(value => value === null)) fail('NO_MEASUREMENTS');
  for (const [key, min, max] of [['voltageV', 0, 2000], ['currentA', -10000, 10000], ['socPercent', 0, 100], ['capacityAh', 0, 10000], ['initialCapacityAh', 0.000001, 10000]]) {
    if (input[key] !== undefined && input[key] !== null && !finite(input[key], min, max)) fail(key.toUpperCase());
  }
  if ((input.capacityAh == null) !== (input.initialCapacityAh == null)) fail('CAPACITY_BASELINE');
  // Whitelist only: VIN, registration, location, driver details and free text are never retained.
  const record = { assetId: input.assetId, mode: input.mode, source: input.source, timestamp: new Date(input.timestamp).toISOString(), temperaturesC: matrix.map(row => row.slice()) };
  for (const key of ['voltageV', 'currentA', 'socPercent', 'capacityAh', 'initialCapacityAh']) if (input[key] != null) record[key] = input[key];
  if(input.operatingState)record.operatingState=input.operatingState;
  return record;
}
export function assessTelemetry(record, previous = null, { now = Date.now() } = {}) {
  const grid = record.temperaturesC, values = grid.flat().filter(v => v !== null);
  const peakC = Math.max(...values), missingSensors = grid.flat().length - values.length;
  const timestamp = Date.parse(record.timestamp), ageSeconds = (now - timestamp) / 1000;
  let riseCPerS = null, intervalSeconds = null;
  if (previous && previous.assetId === record.assetId && previous.mode === record.mode && previous.source === record.source) {
    intervalSeconds = (timestamp - Date.parse(previous.timestamp)) / 1000;
    if (intervalSeconds <= 0) fail('OUT_OF_ORDER');
    if (intervalSeconds <= 30 && previous.temperaturesC.length === grid.length && previous.temperaturesC[0].length === grid[0].length) {
      const rates = grid.flat().map((value, index) => {
        const before = previous.temperaturesC.flat()[index];
        return value === null || before === null ? null : (value - before) / intervalSeconds;
      }).filter(v => v !== null);
      if (rates.length) riseCPerS = Math.max(...rates);
    }
  }
  let thermal = peakC >= POLICY.dangerTempC || (riseCPerS !== null && riseCPerS >= POLICY.dangerRiseCPerS) ? 'danger' : peakC >= POLICY.warningTempC || (riseCPerS !== null && riseCPerS >= POLICY.warningRiseCPerS) ? 'warning' : 'normal';
  const quality = record.mode === 'historical' ? 'historical' : ageSeconds < -5 ? 'future' : ageSeconds > 15 ? 'stale' : missingSensors ? 'partial' : 'current';
  // Missing evidence cannot downgrade a measured warning/danger. No rate => no 'normal' assertion.
  if (thermal === 'normal' && (riseCPerS === null || missingSensors || ['stale', 'future'].includes(quality))) thermal = 'unknown';
  const sohPercent = record.capacityAh == null ? null : record.capacityAh / record.initialCapacityAh * 100;
  return { thermal, peakC, riseCPerS, intervalSeconds, quality, sensorCount: values.length, missingSensors, sohPercent, maintenance: sohPercent === null ? 'unknown' : sohPercent < 75 ? 'review' : sohPercent < 90 ? 'watch' : 'normal', policy: POLICY.version };
}
export function assessNasaCycle(cycle) {
  const rate = cycle.maxFiveSecondRiseCPerS, peak = cycle.tempMaxC;
  return { thermal: peak >= 80 || rate >= 2 ? 'danger' : peak >= 60 || rate >= 1 ? 'warning' : 'normal', peakC: peak, riseCPerS: rate, intervalSeconds: 5, quality: 'historical', sensorCount: 1, missingSensors: 0, sohPercent: cycle.sohPercent, maintenance: cycle.sohPercent < 75 ? 'review' : cycle.sohPercent < 90 ? 'watch' : 'normal', policy: POLICY.version };
}
export function createReport(record, assessment, provenance = 'user_supplied_unverified') {
  return { schemaVersion: 'voltguard-report-1', generatedAt: new Date().toISOString(), provenance, record, assessment, policy: POLICY, limitations: ['Prototype thresholds; not vehicle-calibrated or certified.', 'Not a fire prediction, fire alarm replacement or an automatic vehicle-control system.', 'Historical measurements are not a live BMS connection.', 'Temperature sensor layout is supplied, not inferred; missing sensors remain missing.'] };
}
