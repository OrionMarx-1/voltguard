import test from 'node:test';
import assert from 'node:assert/strict';
import { frameAt } from '../backend/sim/scenarios.mjs';
import { temperatureColor } from '../dist/thermal-map.mjs';
import { vehicleColors, vehicleHotspotPosition, VEHICLE_NEUTRAL_COLOR, VEHICLE_TIRE_COLOR } from '../dist/carpark/vehicle-colors.mjs';

const options = { occupied: true, noData: false }, grid = value => Array.from({ length: 24 }, () => Array(32).fill(value));
test('A preserves region peaks, keeps the body neutral and places the shared-palette hotspot at the left front wheel', () => {
  const frame = frameAt('A', 0), copy = structuredClone(frame), result = vehicleColors(frame, options);
  assert.equal(result.visible, true); assert.equal(result.zones.wheel.peakC, 68); assert.equal(result.zones.wheel.hot, true);
  assert.equal(result.zones.wheel.color, temperatureColor(68));
  assert.equal(result.zones.end.color, VEHICLE_NEUTRAL_COLOR); assert.equal(result.zones.underbody.color, VEHICLE_NEUTRAL_COLOR);
  assert.equal(result.zones.end.hot, false); assert.equal(result.zones.underbody.hot, false); assert.deepEqual(frame, copy);
  assert.equal(result.bodyColor, VEHICLE_NEUTRAL_COLOR); assert.equal(result.rearWheelColor, VEHICLE_TIRE_COLOR);
  assert.deepEqual(result.hotspot, { row: 19, col: 5, peakC: 68, ...vehicleHotspotPosition(19, 5), color: temperatureColor(68) });
  assert.ok(result.hotspot.x < -1 && result.hotspot.y > .2 && result.hotspot.y < .8 && result.hotspot.z > 1);
  assert.equal(result.hotspot.zone, 'wheel'); assert.equal(result.chargingCable, false);
});
test('B maps warning and danger underbody peaks using inclusive temperature boundaries and the same palette clamps', () => {
  for (const [seconds, value] of [[28, frameAt('B', 28)[21][15]], [42, 80], [50, 86]]) {
    const result = vehicleColors(frameAt('B', seconds), options);
    assert.equal(result.zones.underbody.peakC, value); assert.equal(result.zones.underbody.color, temperatureColor(value));
    assert.equal(result.bodyColor, VEHICLE_NEUTRAL_COLOR); assert.equal(result.rearWheelColor, VEHICLE_TIRE_COLOR);
    assert.deepEqual(result.hotspot, { row: 21, col: 15, peakC: value, ...vehicleHotspotPosition(21, 15), color: temperatureColor(value) });
    assert.equal(result.hotspot.zone, 'underbody'); assert.ok(Math.abs(result.hotspot.x) < .1 && result.hotspot.y < .4 && result.hotspot.z > 2.2);
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
    assert.equal(result.hotspot, null); assert.equal(result.chargingCable, false);
    assert.equal(result.bodyColor, VEHICLE_NEUTRAL_COLOR); assert.equal(result.rearWheelColor, VEHICLE_TIRE_COLOR);
    for (const zone of Object.values(result.zones)) { assert.equal(zone.peakC, null); assert.equal(zone.color, null); assert.equal(zone.hot, false); }
  }
});
test('missing zone pixels remain missing, and peaks outside the configured vehicle zones never color the body', () => {
  const frame = grid(null); frame[19][5] = 62; frame[0][0] = 90;
  const result = vehicleColors(frame, options);
  assert.equal(result.visible, true); assert.equal(result.zones.wheel.peakC, 62); assert.equal(result.zones.wheel.color, temperatureColor(62));
  assert.equal(result.hotspot, null); assert.equal(result.bodyColor, VEHICLE_NEUTRAL_COLOR);
  for (const zone of ['end', 'underbody']) { assert.equal(result.zones[zone].peakC, null); assert.equal(result.zones[zone].color, temperatureColor(null)); }
  frame[19][5] = null; assert.equal(vehicleColors(frame, options).visible, false);
});
test('schematic cell mapping is bounded, moves left to right and downward, and covers only the configured front zones', () => {
  for (const [row, col] of [[-1, 5], [24, 5], [19, -1], [19, 32], [19.5, 5], [19, NaN], [0, 0], [23, 31]]) assert.equal(vehicleHotspotPosition(row, col), null);
  const left = vehicleHotspotPosition(14, 3), right = vehicleHotspotPosition(14, 28);
  assert.equal(left.zone, 'wheel'); assert.equal(right.zone, 'wheel'); assert.ok(left.x < 0 && right.x > 0);
  assert.equal(left.z, right.z); assert.ok(vehicleHotspotPosition(23, 3).y < left.y);
  assert.ok(vehicleHotspotPosition(19, 9).x < vehicleHotspotPosition(19, 22).x);
  assert.ok(vehicleHotspotPosition(23, 9).y < vehicleHotspotPosition(19, 9).y);
  const end = vehicleHotspotPosition(4, 3); assert.equal(end.zone, 'end'); assert.ok(end.z > 2);
  assert.ok(end.x < vehicleHotspotPosition(4, 28).x); assert.ok(end.y > vehicleHotspotPosition(18, 9).y);
});
test('only one actual maximum is mapped; ties take the first row and column, missing pixels are not filled', () => {
  const frame = grid(null); frame[19][5] = 68; frame[19][6] = 68; frame[21][15] = 68; frame[14][23] = NaN;
  assert.deepEqual(vehicleColors(frame, options).hotspot, { row: 19, col: 5, peakC: 68, ...vehicleHotspotPosition(19, 5), color: temperatureColor(68) });
  frame[4][3] = 68; const earliest = vehicleColors(frame, options).hotspot;
  assert.equal(earliest.row, 4); assert.equal(earliest.col, 3); assert.equal(earliest.zone, 'end');
  frame[0][0] = 68; assert.equal(vehicleColors(frame, options).hotspot, null);
});
test('charging cable requires a visible occupied vehicle and the charging flag; rear wheels never use temperature colors', () => {
  for (const scenario of ['A', 'B', 'C']) {
    const frame = frameAt(scenario, 42), charging = vehicleColors(frame, { ...options, isCharging: true });
    assert.equal(charging.chargingCable, true); assert.equal(charging.rearWheelColor, VEHICLE_TIRE_COLOR);
    assert.equal(vehicleColors(frame, options).chargingCable, false);
    for (const settings of [{ occupied: false, noData: false }, { occupied: true, noData: true }]) {
      const result = vehicleColors(frame, { ...settings, isCharging: true });
      assert.equal(result.chargingCable, false); assert.equal(result.hotspot, null); assert.equal(result.visible, false);
    }
  }
});
