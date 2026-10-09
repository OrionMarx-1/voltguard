import test from 'node:test';
import assert from 'node:assert/strict';
import { CARPARK_LAYOUT } from '../dist/carpark/layout.mjs';
import { displayBay, countBayStates, bayInDirection, displayAlerts } from '../dist/carpark/state.mjs';

test('UI loses normal certainty on disconnect while retaining known warning/danger and the last reading', () => {
  for (const status of ['normal', 'warning', 'danger', 'no_data']) {
    const bay = { id: 'B2-02', status, noData: status === 'no_data', connecting: false, peakC: 80 };
    const result = displayBay(bay, false);
    assert.equal(result.status, ['warning', 'danger'].includes(status) ? status : 'no_data');
    assert.equal(result.noData, true); assert.equal(result.peakC, 80);
    assert.equal(bay.status, status); assert.equal(bay.noData, status === 'no_data');
  }
});

test('missing/unknown/connecting summaries never appear normal and invalid temperatures remain unavailable', () => {
  assert.equal(displayBay(undefined).status, 'no_data'); assert.equal(displayBay(undefined).peakC, null);
  for (const bay of [{ status: 'unknown' }, { status: 'normal', noData: true }, { status: 'no_data', connecting: true }]) {
    assert.equal(displayBay(bay).status, 'no_data'); assert.equal(displayBay(bay).noData, true);
  }
  assert.equal(displayBay({ status: 'no_data', connecting: true }).connecting, true);
  assert.equal(displayBay({ status: 'no_data', connecting: true }, false).connecting, false);
  for (const peakC of [NaN, Infinity, '80', null]) assert.equal(displayBay({ status: 'no_data', peakC }).peakC, null);
  assert.equal(displayBay({ status: 'warning', noData: true }).status, 'warning');
});

test('counts use the four displayed states and do not count offline normal bays as normal', () => {
  const bays = ['normal', 'normal', 'warning', 'danger', 'no_data'].map(status => ({ status, noData: status === 'no_data' }));
  assert.deepEqual(countBayStates(bays), { normal: 2, warning: 1, danger: 1, no_data: 1 });
  assert.deepEqual(countBayStates(bays, false), { normal: 0, warning: 1, danger: 1, no_data: 3 });
});

test('alert missing-data badges follow the latest bay summary without lowering the alert level', () => {
  const alert = { id: 'test-alert', bayId: 'B2-02', level: 'danger', noData: false };
  assert.equal(displayAlerts([alert], [{ id: 'B2-02', status: 'danger', noData: true }])[0].noData, true);
  assert.equal(displayAlerts([{ ...alert, noData: true }], [{ id: 'B2-02', status: 'danger', noData: false }])[0].noData, false);
  for (const [bays, connected] of [[[], true], [[{ id: 'B2-02', status: 'danger', noData: false }], false]]) {
    const result = displayAlerts([alert], bays, connected)[0];
    assert.equal(result.noData, true); assert.equal(result.level, 'danger');
  }
  assert.equal(alert.noData, false);
});

test('arrow-key focus follows the physical two-by-six layout and does not wrap at boundaries', () => {
  const bays = CARPARK_LAYOUT.bays;
  assert.equal(bayInDirection(bays, 'B2-01', 'ArrowRight'), 'B2-02');
  assert.equal(bayInDirection(bays, 'B2-02', 'ArrowDown'), 'B2-08');
  assert.equal(bayInDirection(bays, 'B2-08', 'ArrowUp'), 'B2-02');
  assert.equal(bayInDirection(bays, 'B2-08', 'ArrowLeft'), 'B2-07');
  for (const [id, key] of [['B2-01', 'ArrowLeft'], ['B2-01', 'ArrowUp'], ['B2-06', 'ArrowRight'], ['B2-12', 'ArrowDown']]) assert.equal(bayInDirection(bays, id, key), id);
  assert.equal(bayInDirection(bays, 'B2-02', 'Enter'), 'B2-02');
});
