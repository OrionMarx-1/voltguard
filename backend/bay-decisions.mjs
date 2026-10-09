export class DecisionError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function normalizeDecision(input, alert, ai = null) {
  const reject = code => { throw new DecisionError(code); };
  const keys = ['level', 'extras', 'aiStance', 'aiRunId', 'operator', 'viewedMs'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !keys.includes(key))) reject('DECISION_INPUT');
  const operator = typeof input.operator === 'string' ? input.operator.trim() : '';
  if (!operator || [...operator].length > 20 || /\p{Cc}/u.test(operator)) reject('OPERATOR');
  if (!Number.isSafeInteger(input.viewedMs) || input.viewedMs < 0) reject('VIEWED_MS');
  if (![null, 'downgrade', 'maintain', 'escalate'].includes(input.level)) reject('DECISION_LEVEL');
  if (!Array.isArray(input.extras) || input.extras.some(action => !['dispatch_patrol', 'notify_manager', 'call_999'].includes(action)) || new Set(input.extras).size !== input.extras.length) reject('DECISION_EXTRAS');
  if (!['none', 'confirmed', 'rejected'].includes(input.aiStance)) reject('AI_UNAVAILABLE');
  const available = ai?.status === 'available' && ai.ok === true && ai.levelAtRequest === alert.level;
  if (input.aiStance === 'none' && input.aiRunId !== null) reject('AI_UNAVAILABLE');
  if (input.aiStance !== 'none') {
    if (!available) reject('AI_UNAVAILABLE');
    if (input.aiRunId !== ai.id || ai.alertId !== alert.id || ai.sessionId !== alert.sessionId) reject('AI_STALE');
    if (!input.level) reject('DECISION_LEVEL');
    const effective = input.extras.includes('call_999') ? 'escalate' : input.level;
    if (input.aiStance === 'confirmed' && effective !== ai.output.recommendation) reject('AI_LEVEL_MISMATCH');
    if (input.aiStance === 'confirmed' && effective === 'downgrade' && ['battery_zone_anomaly', 'undetermined'].includes(ai.output.cause)) reject('DANGER_NO_DOWNGRADE');
  }
  if (!input.level && !input.extras.length) reject('DECISION_EMPTY');
  if (alert.level === 'danger' && input.level === 'downgrade') reject('DANGER_NO_DOWNGRADE');
  return { operator, operatorVerified: false, viewedMs: input.viewedMs,
    level: input.extras.includes('call_999') ? 'escalate' : input.level, extras: [...input.extras], aiStance: input.aiStance, aiRunId: input.aiRunId, aiUnavailable: !available };
}
