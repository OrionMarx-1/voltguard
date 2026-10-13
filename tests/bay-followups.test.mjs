import test from 'node:test';
import assert from 'node:assert/strict';
import { createBayFollowups, FOLLOWUP_DELAY_SECONDS, patrolReport } from '../backend/bay-followups.mjs';

test('patrol copy is scenario-specific and always labelled as an on-site report', () => {
  assert.equal(FOLLOWUP_DELAY_SECONDS, 8);
  assert.match(patrolReport('A').zh, /前輪熱/);
  assert.match(patrolReport('B').en, /underbody heat is obvious/);
  assert.match(patrolReport('C').zh, /輪轂熱/);
  assert.match(patrolReport('C').en, /hub is warm/);
  assert.match(patrolReport(null).en, /no obvious underbody heat/);
});

test('close-up and patrol stay pending for eight simulation seconds, then return one labelled snapshot and sentence', () => {
  const followups = createBayFollowups();
  followups.reset('session-c', 'C');
  followups.requestFromDecision({ bayId: 'B2-04', alertId: 'alert-c', extras: ['request_closeup', 'dispatch_patrol'] });
  const pending = followups.forBay('B2-04');
  assert.equal(pending.closeup.status, 'pending'); assert.equal(pending.closeup.frame, null);
  assert.equal(pending.patrol.status, 'pending'); assert.equal(pending.patrol.text_en, null);
  assert.equal(pending.closeup.sourceType, 'simulation'); assert.equal(pending.closeup.exportable, false);
  assert.equal(followups.setSecond(7).length, 0);
  assert.equal(followups.forBay('B2-04').closeup.status, 'pending');
  const newly = followups.setSecond(8, { capturedAt: '2026-10-09T00:00:08Z' });
  assert.equal(newly.length, 2);
  const ready = followups.forBay('B2-04');
  assert.equal(ready.closeup.status, 'ready');
  assert.equal(ready.closeup.hotspot.zone, 'wheel');
  assert.equal(ready.closeup.hotspot.row, 19); assert.equal(ready.closeup.hotspot.col, 8);
  assert.ok(ready.closeup.frame.temperaturesC[19][9] < 50);
  assert.ok(ready.closeup.frame.temperaturesC[19][8] > ready.closeup.frame.temperaturesC[19][9]);
  assert.equal(ready.closeup.frame.view, 'closeup');
  assert.equal(ready.closeup.frame.sourceType, 'simulation');
  assert.equal(ready.closeup.frame.exportable, false);
  assert.equal(ready.closeup.frame.capturedAt, '2026-10-09T00:00:08Z');
  assert.match(ready.closeup.note.en, /not a live CCTV/);
  assert.match(ready.patrol.text_zh, /輪轂熱/);
  assert.equal(followups.setSecond(9).length, 0);
  const duplicate = followups.request({ bayId: 'B2-04', alertId: 'alert-c', kind: 'closeup' });
  assert.equal(duplicate.status, 'ready');
  followups.reset('session-2', 'A');
  assert.equal(followups.forBay('B2-04').closeup, null);
  assert.equal(followups.forBay('B2-04').patrol, null);
});

test('a close-up on a non-scenario bay uses the baseline frame; invalid kinds are rejected', () => {
  const followups = createBayFollowups();
  followups.reset('session-c', 'C');
  followups.request({ bayId: 'B2-01', alertId: 'other', kind: 'closeup' });
  followups.request({ bayId: 'B2-01', alertId: 'other', kind: 'patrol' });
  followups.setSecond(8, { capturedAt: '2026-10-09T00:00:08Z' });
  const closeup = followups.forBay('B2-01').closeup;
  assert.ok(closeup.frame.temperaturesC[19][8] < 40);
  assert.match(followups.forBay('B2-01').patrol.text_en, /hub is warm/);
  followups.reset('session-base', null);
  followups.request({ bayId: 'B2-01', alertId: 'other', kind: 'patrol' });
  followups.setSecond(8);
  assert.match(followups.forBay('B2-01').patrol.text_en, /no obvious underbody heat/);
  assert.throws(() => followups.request({ bayId: 'B2-01', alertId: 'other', kind: 'cctv' }), /FOLLOWUP_KIND/);
  assert.throws(() => createBayFollowups({ delaySeconds: 0 }), /FOLLOWUP_DELAY/);
});
