import test from 'node:test';
import assert from 'node:assert/strict';
import { createBayDetailLoader } from '../dist/carpark/detail-loader.mjs';
import { drawBayFrame, trendGeometry } from '../dist/carpark/detail-render.mjs';
import { frameAt } from '../backend/sim/scenarios.mjs';
import { hotspotRegion } from '../dist/carpark/layout.mjs';
import { temperatureColor } from '../dist/thermal-map.mjs';
import { createViewingClock } from '../dist/carpark/decision-panel.mjs';

const settle = () => new Promise(setImmediate);
test('viewing duration follows opening a bay/session, survives frame updates, and restarts when returning from another page', () => {
  let now = 10; const clock = createViewingClock(() => now);
  clock.open('session/B2-02'); assert.equal(clock.elapsed(), 0);
  now = 1010; clock.open('session/B2-02'); assert.equal(clock.elapsed(), 1000);
  clock.open('session/B2-03'); now = 2010; assert.equal(clock.elapsed(), 1000);
  clock.reset(); clock.open('session/B2-03'); now = 2110; assert.equal(clock.elapsed(), 100);
  clock.open('new-session/B2-03'); assert.equal(clock.elapsed(), 0);
});
const target = (seq = 1, bayId = 'B2-02', sessionId = 'session-1') => ({ seq, bayId, sessionId });
const detail = ({ seq, bayId, sessionId }) => ({ bay: { id: bayId }, session: { id: sessionId }, sourceType: 'simulation', exportable: false, frame: seq === null ? null : { seq, bayId, sourceType: 'simulation' } });
function deferredLoader() {
  const calls = [];
  const loader = createBayDetailLoader({ onChange: () => {}, fetchDetail: (id, signal) => new Promise((resolve, reject) => calls.push({ id, signal, resolve, reject })) });
  return { loader, calls };
}

test('detail reads coalesce ticks, accept a newer server frame, and stop rereading caught-up frames', async () => {
  const { loader, calls } = deferredLoader();
  loader.update(target()); await settle();
  loader.update(target(2)); loader.update(target(3)); assert.equal(calls.length, 1);
  calls[0].resolve(detail(target())); await settle(); assert.equal(calls.length, 2);
  calls[1].resolve(detail(target(4))); await settle();
  assert.equal(loader.state.detail.frame.seq, 4); assert.equal(loader.state.loading, false);
  loader.update(target(4)); await settle(); assert.equal(calls.length, 2);
});

test('decision revisions refresh details without a new temperature frame, and a retry during a read is queued', async () => {
  const { loader, calls } = deferredLoader();
  loader.update({ ...target(), revision: 0 }); await settle();
  loader.update({ ...target(), revision: 1 }); calls[0].resolve(detail(target())); await settle();
  assert.equal(calls.length, 2); loader.retry(); calls[1].resolve(detail(target())); await settle();
  assert.equal(calls.length, 3); calls[2].resolve({ ...detail(target()), decisions: ['test-only record'] }); await settle();
  assert.deepEqual(loader.state.detail.decisions, ['test-only record']);
  loader.update({ ...target(), revision: 1 }); await settle(); assert.equal(calls.length, 3);
});

test('late replies cannot overwrite another selected bay or a new reset session, even if abort is ignored', async () => {
  const { loader, calls } = deferredLoader();
  loader.update(target()); await settle(); loader.update(target(1, 'B2-03')); await settle();
  assert.equal(calls[0].signal.aborted, true); assert.equal(loader.state.detail, null);
  calls[1].resolve(detail(target(1, 'B2-03'))); await settle();
  calls[0].resolve(detail(target())); await settle(); assert.equal(loader.state.detail.bay.id, 'B2-03');
  loader.update(target(1, 'B2-03', 'session-2')); await settle(); assert.equal(loader.state.detail, null);
  calls[2].resolve(detail(target(1, 'B2-03', 'session-2'))); await settle();
  assert.equal(loader.state.detail.session.id, 'session-2');
  loader.update(target(2, 'B2-03', 'session-2')); await settle();
  loader.update(target(1, 'B2-03', 'session-3')); await settle();
  assert.equal(calls[3].signal.aborted, true);
  calls[4].resolve(detail(target(1, 'B2-03', 'session-3'))); await settle();
  calls[3].resolve(detail(target(2, 'B2-03', 'session-2'))); await settle();
  assert.equal(loader.state.detail.session.id, 'session-3'); assert.equal(loader.state.detail.frame.seq, 1);
  loader.close(); assert.equal(loader.state.detail, null);
});

test('read failure retains the last valid frame, avoids a retry loop, and supports explicit retry', async () => {
  const { loader, calls } = deferredLoader();
  loader.update(target()); await settle(); calls[0].resolve(detail(target())); await settle();
  loader.update(target(2)); await settle(); calls[1].reject(Error('offline')); await settle();
  assert.equal(loader.state.error, true); assert.equal(loader.state.detail.frame.seq, 1);
  loader.update(target(2)); await settle(); assert.equal(calls.length, 2);
  loader.retry(); await settle(); calls[2].resolve(detail(target(2))); await settle();
  assert.equal(loader.state.error, false); assert.equal(loader.state.detail.frame.seq, 2);
});

test('wrong bay/session/source, exportable frames and outdated HTTP replies are rejected', async () => {
  for (const bad of [detail(target(1)), detail(target(2, 'B2-03')), detail(target(2, 'B2-02', 'old-session')), { ...detail(target(2)), sourceType: 'measured' }, { ...detail(target(2)), exportable: true }, detail(target(null))]) {
    const { loader, calls } = deferredLoader(); loader.update(target(2)); await settle(); calls[0].resolve(bad); await settle();
    assert.equal(loader.state.error, true); assert.equal(loader.state.detail, null); assert.equal(calls.length, 1);
  }
  const { loader, calls } = deferredLoader(); loader.update(target(null, 'B2-06')); await settle();
  calls[0].resolve(detail(target(null, 'B2-06'))); await settle(); assert.equal(loader.state.error, false);
  loader.update(target(null, 'B2-06')); await settle(); assert.equal(calls.length, 1);
});

test('thermal renderer paints all 768 pixels with the shared fixed palette, hatches null, and outlines configured regions', () => {
  const fills = [], rectangles = [], arcs = [], lines = [];
  const context = { beginPath() {}, stroke() {}, moveTo(...args) { lines.push(args); }, lineTo(...args) { lines.push(args); },
    fillRect(...args) { fills.push({ colour: this.fillStyle, args }); }, strokeRect(...args) { rectangles.push(args); }, arc(...args) { arcs.push(args); } };
  const canvas = { getContext: () => context }, matrix = frameAt('B', 42);
  matrix[0][0] = null; matrix[0][1] = -60; matrix[0][2] = 1000;
  const hotspot = hotspotRegion(matrix); drawBayFrame(canvas, matrix, hotspot);
  assert.equal(canvas.width, 256); assert.equal(canvas.height, 192); assert.equal(context.imageSmoothingEnabled, false);
  assert.equal(fills.length, 768); assert.equal(fills[0].colour, temperatureColor(null));
  assert.equal(fills[1].colour, temperatureColor(20)); assert.equal(fills[2].colour, temperatureColor(80));
  assert.deepEqual(fills[21 * 32 + 15].args, [120, 168, 8, 8]); assert.equal(fills[21 * 32 + 15].colour, temperatureColor(80));
  assert.equal(rectangles.length, 5); assert.equal(lines.length, 2); assert.deepEqual(arcs[0].slice(0, 3), [20, 4, 6]);
  assert.throws(() => drawBayFrame(canvas, [[30]], null), /BAY_FRAME_MATRIX/);
  const before = frameAt('normal', 0); before[0][0] = Infinity;
  assert.throws(() => drawBayFrame(canvas, before, null), /BAY_FRAME_MATRIX/);
});

test('trend uses real seconds, retains null/gap breaks, clips the last minute, and includes temperatures above the image palette', () => {
  const start = Date.parse('2026-10-09T00:00:00Z'), at = second => new Date(start + second * 1000).toISOString();
  const history = [[0, 30], [1, 31], [2, 32], [3, null], [4, 35], [60, 86], [61, 87]].map(([second, peakC]) => ({ capturedAt: at(second), peakC }));
  const result = trendGeometry(history, at(60));
  assert.deepEqual(result.points.map(point => point.value), [31, 32, 35, 86]);
  assert.equal(result.paths.length, 3); assert.equal(result.points.at(-1).x, 288);
  assert.equal(result.max, 90); assert.equal(result.min, 20); assert.ok(result.points.at(-1).y > 8);
  assert.equal(Number((result.points[1].x - result.points[0].x).toFixed(2)), 4.6);
  assert.deepEqual(trendGeometry([], null).points, []);
});
