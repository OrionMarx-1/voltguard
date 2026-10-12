import test from 'node:test';
import assert from 'node:assert/strict';
import { frameAt } from '../backend/sim/scenarios.mjs';
import { temperatureColor } from '../dist/thermal-map.mjs';
import { vehicleColors, VEHICLE_NEUTRAL_COLOR } from '../dist/carpark/vehicle-colors.mjs';

const options = { occupied: true, noData: false }, grid = value => Array.from({ length: 24 }, () => Array(32).fill(value));
test('A heats only the wheel region with the exact shared 2D palette; normal region maxima remain neutral', () => {
  const frame = frameAt('A', 0), copy = structuredClone(frame), result = vehicleColors(frame, options);
  assert.equal(result.visible, true); assert.equal(result.zones.wheel.peakC, 68); assert.equal(result.zones.wheel.hot, true);
  assert.equal(result.zones.wheel.color, temperatureColor(68));
  assert.equal(result.zones.end.color, VEHICLE_NEUTRAL_COLOR); assert.equal(result.zones.underbody.color, VEHICLE_NEUTRAL_COLOR);
  assert.equal(result.zones.end.hot, false); assert.equal(result.zones.underbody.hot, false); assert.deepEqual(frame, copy);
});
test('B maps warning and danger underbody peaks using inclusive temperature boundaries and the same palette clamps', () => {
  for (const [seconds, value] of [[28, frameAt('B', 28)[21][15]], [42, 80], [50, 86]]) {
    const result = vehicleColors(frameAt('B', seconds), options);
    assert.equal(result.zones.underbody.peakC, value); assert.equal(result.zones.underbody.color, temperatureColor(value));
  }
  for (const value of [59.999, 60, 80, 1000]) {
    const result = vehicleColors(grid(value), options);
    for (const zone of Object.values(result.zones)) { assert.equal(zone.hot, value >= 60); assert.equal(zone.color, value < 60 ? VEHICLE_NEUTRAL_COLOR : temperatureColor(value)); }
  }
});
test('no-data, disconnected, empty and malformed frames never produce a vehicle or temperature colors', () => {
  for (const [frame, settings] of [[frameAt('A', 0), { occupied: true, noData: true }], [frameAt('A', 0), { occupied: false, noData: false }],
    [null, options], [grid(null), options], [[[80]], options], [grid(80).slice(1), options], [grid(80), {}]]) {
    const result = vehicleColors(frame, settings); assert.equal(result.visible, false);
    for (const zone of Object.values(result.zones)) { assert.equal(zone.peakC, null); assert.equal(zone.color, null); assert.equal(zone.hot, false); }
  }
});
test('missing zone pixels remain missing, and peaks outside the configured vehicle zones never color the body', () => {
  const frame = grid(null); frame[19][5] = 62; frame[0][0] = 90;
  const result = vehicleColors(frame, options);
  assert.equal(result.visible, true); assert.equal(result.zones.wheel.peakC, 62); assert.equal(result.zones.wheel.color, temperatureColor(62));
  for (const zone of ['end', 'underbody']) { assert.equal(result.zones[zone].peakC, null); assert.equal(result.zones[zone].color, temperatureColor(null)); }
  frame[19][5] = null; assert.equal(vehicleColors(frame, options).visible, false);
});
