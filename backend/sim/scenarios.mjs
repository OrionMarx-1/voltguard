import { CARPARK_LAYOUT, zoneAt } from '../../dist/carpark/layout.mjs';
import { ValidationError } from '../../dist/safety.mjs';

// Every value in this module is synthetic, not a physical model or a measurement.
// These pure functions do not write telemetry, events, reports or AI results.
export const SCENARIOS = Object.freeze({
  A: Object.freeze({ name: 'A', sourceType: 'simulation', bayId: 'B2-03', durationSeconds: 60, hotspot: Object.freeze({ row: 19, col: 5 }) }),
  B: Object.freeze({ name: 'B', sourceType: 'simulation', bayId: 'B2-02', durationSeconds: 50, hotspot: Object.freeze({ row: 21, col: 15 }) })
});

const occupied = new Set(['B2-01', 'B2-02', 'B2-04', 'B2-05']);
const charging = new Set(['B2-01', 'B2-02', 'B2-04', 'B2-05']);
export const DEMO_BAYS = Object.freeze(CARPARK_LAYOUT.bays.map(bay => Object.freeze({
  bayId: bay.id,
  occupied: occupied.has(bay.id),
  isCharging: charging.has(bay.id),
  emitsFrames: bay.id !== 'B2-06',
  sourceType: 'simulation'
})));

function checkTime(t) {
  if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) throw new ValidationError('SIMULATION_TIME');
}

function baseTemperature(row, col, vehicle) {
  const pattern = ((row * 7 + col * 11) % 13) / 12;
  const zone = vehicle ? zoneAt(row, col) : 'other';
  if (zone === 'end') return 30 + 5 * pattern;
  if (zone === 'wheel') return 30 + 3 * pattern;
  if (zone === 'underbody') return 28 + pattern;
  return 28 + 0.6 * (pattern - 0.5);
}

// Radial kernel: 100%, 70%, 40%, 15% at distances 0, 1, 2, 3;
// interpolate between rings, taper to zero at distance 4.
function hotspotWeight(distance) {
  if (distance >= 4) return 0;
  const weights = [1, 0.7, 0.4, 0.15, 0];
  const ring = Math.floor(distance);
  return weights[ring] + (weights[ring + 1] - weights[ring]) * (distance - ring);
}

export function frameAt(kind, t) {
  if (!['A', 'B', 'normal', 'empty'].includes(kind)) throw new ValidationError('SIMULATION_SCENARIO');
  checkTime(t);
  const scenario = SCENARIOS[kind];
  const vehicle = kind !== 'empty';
  // Only baseline bays oscillate; scenario centre temperatures follow the exact PRD schedule.
  const ripple = scenario ? 0 : 0.2 * Math.sin(2 * Math.PI * t / 20);
  let hotspotDelta = 0;
  if (scenario) {
    const seconds = Math.min(t, scenario.durationSeconds);
    const centreC = kind === 'A' ? 68 - 0.1 * seconds
      : seconds <= 30 ? 38 + 0.8 * seconds : Math.min(86, 62 + 1.5 * (seconds - 30));
    hotspotDelta = centreC - baseTemperature(scenario.hotspot.row, scenario.hotspot.col, true);
  }
  return Array.from({ length: CARPARK_LAYOUT.frame.rows }, (_, row) =>
    Array.from({ length: CARPARK_LAYOUT.frame.cols }, (_, col) => {
      const weight = scenario ? hotspotWeight(Math.hypot(row - scenario.hotspot.row, col - scenario.hotspot.col)) : 0;
      return baseTemperature(row, col, vehicle) + ripple + hotspotDelta * weight;
    })
  );
}

// t is time since service start; scenarioTime is time since scenario start.
// The future player must clear this bay's previous-frame history before t=0
// of a scenario. A pure generator cannot reset the service's rule history.
export function bayFrameAt(bayId, t, { scenario = null, scenarioTime = t } = {}) {
  const bay = DEMO_BAYS.find(item => item.bayId === bayId);
  if (!bay) throw new ValidationError('BAY_ID');
  checkTime(t);
  if (scenario !== null && !Object.hasOwn(SCENARIOS, scenario)) throw new ValidationError('SIMULATION_SCENARIO');
  if (scenario !== null) checkTime(scenarioTime);
  if (!bay.emitsFrames) return null;
  if (scenario !== null && SCENARIOS[scenario].bayId === bayId) return frameAt(scenario, scenarioTime);
  return frameAt(bay.occupied ? 'normal' : 'empty', t);
}
