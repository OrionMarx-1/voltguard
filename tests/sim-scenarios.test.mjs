import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTelemetry, assessTelemetry } from '../dist/safety.mjs';
import { CARPARK_LAYOUT, hotspotRegion } from '../dist/carpark/layout.mjs';
import { SCENARIOS, DEMO_BAYS, frameAt, bayFrameAt } from '../backend/sim/scenarios.mjs';

// Artificial clock and source are test fixtures, never measured records or persisted events.
const epoch = Date.parse('2026-10-09T00:00:00.000Z');
function recordAt(bayId, matrix, t) {
  return normalizeTelemetry({
    assetId: bayId, mode: 'live', source: 'simulation rule test only',
    timestamp: new Date(epoch + t * 1000).toISOString(), temperaturesC: matrix
  });
}
const assess = (record, previous, t) => assessTelemetry(record, previous, { now: epoch + t * 1000 });

test('synthetic frames have a fixed 24 by 32 shape, deterministic values, and independent output arrays', () => {
  for (const kind of ['A', 'B', 'C', 'normal', 'empty']) {
    for (const t of [0, 28, 42, 60, 100]) {
      const matrix = frameAt(kind, t);
      assert.equal(matrix.length, 24);
      assert.ok(matrix.every(row => row.length === 32 && row.every(value => Number.isFinite(value) && value >= -60 && value <= 1000)));
      assert.deepEqual(matrix, frameAt(kind, t));
      matrix[0][0] = 999;
      assert.notEqual(frameAt(kind, t)[0][0], 999);
    }
  }
  assert.throws(() => frameAt('measured', 0), /SIMULATION_SCENARIO/);
  for (const t of [-1, NaN, Infinity, '0']) assert.throws(() => frameAt('A', t), /SIMULATION_TIME/);
});

test('synthetic baseline ranges and hotspot kernel match the documented installation view', () => {
  const empty = frameAt('empty', 0), normal = frameAt('normal', 0);
  assert.ok(empty.flat().every(value => value >= 27.7 && value <= 28.3));
  for (const [zone, low, high] of [['end', 30, 35], ['wheel', 30, 33], ['underbody', 28, 29]]) {
    const cells = CARPARK_LAYOUT.zones.find(item => item.id === zone).rects;
    for (const rect of cells) {
      for (let row = rect.rows[0]; row <= rect.rows[1]; row++) {
        for (let col = rect.cols[0]; col <= rect.cols[1]; col++) assert.ok(normal[row][col] >= low && normal[row][col] <= high);
      }
    }
  }
  for (const name of ['A', 'B']) {
    const matrix = frameAt(name, 0), { row, col } = SCENARIOS[name].hotspot;
    const delta = matrix[row][col] - normal[row][col];
    for (const [distance, weight] of [[0, 1], [1, 0.7], [2, 0.4], [3, 0.15], [4, 0]]) {
      assert.ok(Math.abs(matrix[row - distance][col] - normal[row - distance][col] - delta * weight) < 1e-10);
    }
  }
});

test('scenario A immediately warns at the front wheel and stays warning through the last held frame', () => {
  let previous = null;
  for (let t = 0; t <= 65; t++) {
    const record = recordAt('B2-03', frameAt('A', t), t);
    const result = assess(record, previous, t), hotspot = hotspotRegion(record.temperaturesC);
    assert.equal(result.thermal, 'warning', `A t=${t}`);
    assert.equal(hotspot.zone, 'wheel');
    assert.equal(hotspot.row, 19); assert.equal(hotspot.col, 5);
    assert.equal(result.peakC, 68 - 0.1 * Math.min(t, 60));
    assert.equal(result.riseCPerS, t === 0 ? null : 0);
    previous = record;
  }
  assert.deepEqual(frameAt('A', 60), frameAt('A', 100));
});

test('scenario B first connects, warns at second 28, reaches danger at second 42, and never reaches the danger rise threshold', () => {
  let previous = null;
  for (let t = 0; t <= 60; t++) {
    const record = recordAt('B2-02', frameAt('B', t), t);
    const result = assess(record, previous, t), hotspot = hotspotRegion(record.temperaturesC);
    const expected = t === 0 ? 'unknown' : t < 28 ? 'normal' : t < 42 ? 'warning' : 'danger';
    assert.equal(result.thermal, expected, `B t=${t}`);
    assert.equal(hotspot.zone, 'underbody');
    assert.equal(hotspot.row, 21); assert.equal(hotspot.col, 15);
    assert.ok(result.riseCPerS === null || result.riseCPerS < 2, `B danger rise at t=${t}`);
    const expectedRise = t === 0 ? null : t <= 30 ? 0.8 : t <= 46 ? 1.5 : 0;
    if (expectedRise === null) assert.equal(result.riseCPerS, null);
    else assert.ok(Math.abs(result.riseCPerS - expectedRise) < 1e-10);
    if (t === 28) assert.ok(Math.abs(result.peakC - 60.4) < 1e-10);
    if (t === 42) assert.equal(result.peakC, 80);
    if (t >= 46) assert.equal(result.peakC, 86);
    previous = record;
  }
  assert.deepEqual(frameAt('B', 50), frameAt('B', 100));
});

test('the scenario-start contract drops baseline history so a frame jump cannot cause a false danger', () => {
  for (const name of ['A', 'B', 'C']) {
    const bayId = SCENARIOS[name].bayId;
    const old = recordAt(bayId, bayFrameAt(bayId, 0), 0);
    const first = recordAt(bayId, bayFrameAt(bayId, 1, { scenario: name, scenarioTime: 0 }), 1);
    assert.equal(assess(first, old, 1).thermal, 'danger', `${name}: stale history reproduces the frame-jump error`);
    const reconnected = assess(first, null, 1);
    assert.equal(reconnected.thermal, name === 'B' ? 'unknown' : 'warning');
    assert.equal(reconnected.riseCPerS, null);
    const second = recordAt(bayId, bayFrameAt(bayId, 2, { scenario: name, scenarioTime: 1 }), 2);
    assert.equal(assess(second, first, 2).thermal, name === 'B' ? 'normal' : 'warning');
  }
});

test('all baseline bays follow their occupancy/charging configuration and never trigger a rule alert over a full oscillation', () => {
  assert.deepEqual(DEMO_BAYS.filter(bay => bay.occupied).map(bay => bay.bayId), ['B2-01', 'B2-02', 'B2-04', 'B2-05']);
  assert.deepEqual(DEMO_BAYS.filter(bay => bay.isCharging).map(bay => bay.bayId), ['B2-01', 'B2-02', 'B2-04', 'B2-05']);
  assert.equal(DEMO_BAYS.filter(bay => bay.emitsFrames).length, 5);
  for (const bay of DEMO_BAYS) {
    assert.equal(bay.sourceType, 'simulation');
    let previous = null;
    for (let t = 0; t <= 20; t++) {
      const matrix = bayFrameAt(bay.bayId, t);
      if (!bay.emitsFrames) { assert.equal(matrix, null); continue; }
      const record = recordAt(bay.bayId, matrix, t), result = assess(record, previous, t);
      assert.equal(result.thermal, t === 0 ? 'unknown' : 'normal', `${bay.bayId} t=${t}`);
      if (t > 0) assert.ok(Math.abs(result.riseCPerS) <= 0.063);
      previous = record;
    }
  }
  for (const kind of ['normal', 'empty']) {
    const baseline = frameAt(kind, 0);
    for (const [t, delta] of [[5, 0.2], [15, -0.2], [20, 0]]) {
      assert.ok(frameAt(kind, t).flat().every((value, index) => Math.abs(value - baseline.flat()[index] - delta) < 1e-10));
    }
  }
});

test('scenario routing changes only its target bay, keeps the missing bay missing, and uses separate clocks', () => {
  for (const scenario of ['A', 'B', 'C']) {
    for (const bay of DEMO_BAYS) {
      const matrix = bayFrameAt(bay.bayId, 105, { scenario, scenarioTime: 28 });
      const expected = !bay.emitsFrames ? null : bay.bayId === SCENARIOS[scenario].bayId ? frameAt(scenario, 28) : bayFrameAt(bay.bayId, 105);
      assert.deepEqual(matrix, expected);
    }
  }
  assert.throws(() => bayFrameAt('B2-13', 0), /BAY_ID/);
  assert.throws(() => bayFrameAt('B2-02', 0, { scenario: 'D' }), /SIMULATION_SCENARIO/);
  assert.throws(() => bayFrameAt('B2-02', 0, { scenario: 'B', scenarioTime: -1 }), /SIMULATION_TIME/);
});

test('scenario C stays warning at the wheel-underbody junction and a close-up isolates the wheel', () => {
  let previous = null;
  for (let t = 0; t <= 45; t++) {
    const record = recordAt('B2-04', frameAt('C', t), t);
    const result = assess(record, previous, t), hotspot = hotspotRegion(record.temperaturesC);
    assert.equal(result.thermal, 'warning', `C t=${t}`);
    assert.equal(hotspot.zone, 'wheel');
    assert.equal(hotspot.row, 19); assert.equal(hotspot.col, 8);
    assert.ok(Math.abs(result.peakC - (65 + 0.05 * Math.min(t, 40))) < 1e-10);
    assert.ok(record.temperaturesC[19][8] > record.temperaturesC[19][9]);
    assert.ok(record.temperaturesC[19][9] > 60);
    if (t === 0) assert.equal(result.riseCPerS, null);
    else if (t <= 40) assert.ok(Math.abs(result.riseCPerS - 0.05) < 1e-10);
    else assert.equal(result.riseCPerS, 0);
    previous = record;
  }
  const closeup = frameAt('C', 8, { closeup: true }), closeHotspot = hotspotRegion(closeup);
  assert.equal(closeHotspot.zone, 'wheel'); assert.equal(closeHotspot.row, 19); assert.equal(closeHotspot.col, 8);
  assert.ok(closeup[19][9] < 50);
  assert.deepEqual(frameAt('C', 40), frameAt('C', 80));
  assert.throws(() => frameAt('C', 0, { closeup: 'yes' }), /SIMULATION_CLOSEUP/);
});
