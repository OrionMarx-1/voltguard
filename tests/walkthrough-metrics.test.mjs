import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionTiming } from '../scripts/walkthrough-metrics.mjs';

const alert = { id: 'a', bayId: 'B2-03', sessionId: 'session', createdAt: '2026-10-12T03:00:00.100Z' };
const decision = { alertId: 'a', bayId: 'B2-03', sessionId: 'session', at: '2026-10-12T03:00:03.456Z', viewedMs: 2100 };
test('developer walk durations use precise server timestamps rather than a browser estimate', () => {
  assert.deepEqual(decisionTiming(alert, decision), { alertCreatedAt: alert.createdAt, decisionAt: decision.at, alertToDecisionSeconds: 3.356, viewedSeconds: 2.1 });
  const escalated = { ...alert, updatedAt: '2026-10-12T03:00:02Z', level: 'danger' };
  assert.equal(decisionTiming(escalated, decision).alertToDecisionSeconds, 3.356);
  assert.equal(decisionTiming(alert, { ...decision, at: alert.createdAt }).alertToDecisionSeconds, 0);
});
test('walk durations reject missing/reversed times and cross-alert, cross-bay or cross-session records', () => {
  for (const changed of [{ alertId: 'other' }, { bayId: 'B2-02' }, { sessionId: 'other' }, { at: 'invalid' }, { at: '2026-10-12T02:59:59Z' }]) assert.throws(() => decisionTiming(alert, { ...decision, ...changed }));
  assert.throws(() => decisionTiming({ ...alert, createdAt: null }, decision));
  assert.throws(() => decisionTiming(null, decision));
});
