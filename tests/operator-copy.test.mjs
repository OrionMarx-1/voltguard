import test from 'node:test';
import assert from 'node:assert/strict';
import { escalateActionLabel, aiUnavailableMessage } from '../dist/carpark/operator-copy.mjs';

test('escalate label records danger instead of upgrading when the alert is already danger', () => {
  assert.equal(escalateActionLabel('warning', true), '升級為危險');
  assert.equal(escalateActionLabel('warning', false), 'Escalate to danger');
  assert.equal(escalateActionLabel('danger', true), '記錄處置（危險）');
  assert.equal(escalateActionLabel('danger', false), 'Record as danger');
});

test('unavailable copy tells the operator to use the thermal image and keeps codes off the main line', () => {
  assert.match(aiUnavailableMessage({ waiting: false, code: 'AI_OUTPUT_LANGUAGE', zh: true }), /請看熱圖後自行選擇級別/);
  assert.match(aiUnavailableMessage({ waiting: false, code: 'AI_TIMEOUT', zh: false }), /Look at the thermal image/);
  assert.equal(aiUnavailableMessage({ waiting: false, code: 'AI_OUTPUT_LANGUAGE', zh: false }).includes('validation'), false);
  assert.equal(aiUnavailableMessage({ waiting: false, code: 'AI_TIMEOUT', zh: true }).includes('逾時'), false);
  assert.match(aiUnavailableMessage({ waiting: false, code: 'AI_DISABLED', zh: false }), /switched off/);
  assert.match(aiUnavailableMessage({ waiting: true, zh: true }), /正在等待/);
});
