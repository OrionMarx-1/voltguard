import test from 'node:test';
import assert from 'node:assert/strict';
import { CARPARK_LAYOUT, zoneAt, zoneLabels, hotspotRegion } from '../dist/carpark/layout.mjs';

const grid = value => Array.from({ length: 24 }, () => Array(32).fill(value));

test('B2 configuration has twelve distinct bays, two rows, and six charging bays', () => {
  assert.equal(CARPARK_LAYOUT.schemaVersion, 'voltguard-carpark-1');
  assert.equal(CARPARK_LAYOUT.floor, 'B2');
  assert.deepEqual(CARPARK_LAYOUT.frame, { rows: 24, cols: 32 });
  assert.deepEqual(CARPARK_LAYOUT.bays.map(bay => bay.id), Array.from({ length: 12 }, (_, i) => `B2-${String(i + 1).padStart(2, '0')}`));
  assert.equal(new Set(CARPARK_LAYOUT.bays.map(bay => `${bay.row}:${bay.col}`)).size, 12);
  for (const [index, bay] of CARPARK_LAYOUT.bays.entries()) {
    assert.equal(bay.row, Math.floor(index / 6));
    assert.equal(bay.col, index % 6);
    assert.equal(bay.charging, index < 6);
    assert.equal(bay.endFacingCamera, 'front');
  }
  assert.ok(Object.isFrozen(CARPARK_LAYOUT.zones[0].rects[0].rows));
  assert.throws(() => { CARPARK_LAYOUT.bays[0].charging = false; }, TypeError);
});

test('all installation rectangles stay in frame, never overlap, and leave other pixels explicit', () => {
  const covered = new Map();
  for (const zone of CARPARK_LAYOUT.zones) {
    for (const rect of zone.rects) {
      assert.ok(rect.rows[0] >= 0 && rect.rows[1] < 24 && rect.rows[0] <= rect.rows[1]);
      assert.ok(rect.cols[0] >= 0 && rect.cols[1] < 32 && rect.cols[0] <= rect.cols[1]);
      for (let row = rect.rows[0]; row <= rect.rows[1]; row++) {
        for (let col = rect.cols[0]; col <= rect.cols[1]; col++) {
          const pixel = `${row}:${col}`;
          assert.equal(covered.has(pixel), false, `overlap at ${pixel}`);
          covered.set(pixel, zone.id);
        }
      }
    }
  }
  const counts = { end: 0, wheel: 0, underbody: 0, other: 0 };
  for (let row = 0; row < 24; row++) {
    for (let col = 0; col < 32; col++) {
      const zone = zoneAt(row, col);
      assert.equal(zone, covered.get(`${row}:${col}`) ?? 'other');
      counts[zone]++;
    }
  }
  assert.deepEqual(counts, { end: 330, wheel: 120, underbody: 70, other: 248 });
  assert.equal(zoneAt(13, 3), 'end');
  assert.equal(zoneAt(14, 3), 'wheel');
  assert.equal(zoneAt(18, 9), 'end');
  assert.equal(zoneAt(19, 9), 'underbody');
  assert.equal(zoneAt(23, 28), 'wheel');
  assert.equal(zoneAt(23, 29), 'other');
  for (const pixel of [[-1, 0], [24, 0], [0, 32], [0.5, 0]]) assert.throws(() => zoneAt(...pixel), /FRAME_PIXEL/);
});

test('front/rear orientation changes bilingual labels without changing geometry', () => {
  assert.deepEqual(zoneLabels('end', 'front'), { zh: '車頭', en: 'Front end' });
  assert.deepEqual(zoneLabels('end', 'rear'), { zh: '車尾', en: 'Rear end' });
  assert.deepEqual(zoneLabels('wheel', 'front'), { zh: '前輪', en: 'Front wheels' });
  assert.deepEqual(zoneLabels('wheel', 'rear'), { zh: '後輪', en: 'Rear wheels' });
  for (const zone of ['underbody', 'other']) assert.deepEqual(zoneLabels(zone, 'front'), zoneLabels(zone, 'rear'));
  assert.throws(() => zoneLabels('wheel', 'side'), /CAMERA_FACING/);
  assert.throws(() => zoneLabels('battery'), /FRAME_ZONE/);
});

test('hotspot is the first maximum in row/column order, with missing and other pixels respected', () => {
  const matrix = grid(28);
  matrix[0][0] = null;
  matrix[19][5] = 68;
  matrix[19][23] = 68;
  matrix[21][15] = 68;
  const original = structuredClone(matrix);
  assert.deepEqual(hotspotRegion(matrix), { row: 19, col: 5, temperatureC: 68, zone: 'wheel', labels: zoneLabels('wheel') });
  assert.equal(hotspotRegion(matrix, 'rear').labels.zh, '後輪');
  matrix[21][15] = 80;
  assert.equal(hotspotRegion(matrix).zone, 'underbody');
  matrix[2][30] = 86;
  assert.equal(hotspotRegion(matrix).zone, 'other');
  assert.deepEqual(original[19], matrix[19]);
  assert.equal(hotspotRegion(grid(-60)).temperatureC, -60);
  assert.equal(hotspotRegion(grid(1000)).temperatureC, 1000);
  assert.throws(() => hotspotRegion(grid(null)), /NO_MEASUREMENTS/);
  for (const bad of [[], [[30]], grid(28).slice(1)]) assert.throws(() => hotspotRegion(bad), /FRAME_MATRIX/);
  for (const value of [NaN, Infinity, '80', undefined, -61, 1001]) {
    const bad = grid(28); bad[23][31] = value;
    assert.throws(() => hotspotRegion(bad), /TEMPERATURE/);
  }
});
