import { assessTelemetry, normalizeTelemetry } from '../dist/safety.mjs';
import { hotspotRegion } from '../dist/carpark/layout.mjs';
import { SCENARIOS, frameAt } from '../backend/sim/scenarios.mjs';

// Console demonstration only. This artificial clock never enters stored telemetry.
const epoch = Date.parse('2026-10-09T00:00:00.000Z');
const allSeconds = process.argv.includes('--all');
console.log('仿真演示 · 演示时间已压缩 · 仅计算，不存储、不导出、不调用 AI');
for (const scenario of Object.values(SCENARIOS)) {
  let previous = null;
  const rows = [];
  for (let t = 0; t <= scenario.durationSeconds; t++) {
    const now = epoch + t * 1000;
    const record = normalizeTelemetry({
      assetId: scenario.bayId, mode: 'live', source: 'simulation console demo only',
      timestamp: new Date(now).toISOString(), temperaturesC: frameAt(scenario.name, t)
    });
    const result = assessTelemetry(record, previous, { now });
    if (allSeconds || [0, 1, 27, 28, 30, 41, 42, 46, 50, 60].includes(t)) {
      rows.push({ second: t, peakC: Number(result.peakC.toFixed(1)), riseCPerS: result.riseCPerS === null ? null : Number(result.riseCPerS.toFixed(2)), rule: result.thermal, zone: hotspotRegion(record.temperaturesC).zone });
    }
    previous = record;
  }
  console.log(`场景 ${scenario.name} · ${scenario.bayId} · 首帧清空旧历史`);
  console.table(rows);
}
