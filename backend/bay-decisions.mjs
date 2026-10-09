export class DecisionError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function normalizeDecision(input, alert) {
  const reject = code => { throw new DecisionError(code); };
  const keys = ['level', 'extras', 'aiStance', 'aiRunId', 'operator', 'viewedMs'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !keys.includes(key))) reject('DECISION_INPUT');
  const operator = typeof input.operator === 'string' ? input.operator.trim() : '';
  if (!operator || [...operator].length > 20 || /\p{Cc}/u.test(operator)) reject('OPERATOR');
  if (!Number.isSafeInteger(input.viewedMs) || input.viewedMs < 0) reject('VIEWED_MS');
  if (![null, 'downgrade', 'maintain', 'escalate'].includes(input.level)) reject('DECISION_LEVEL');
  if (!Array.isArray(input.extras) || input.extras.some(action => !['dispatch_patrol', 'notify_manager', 'call_999'].includes(action)) || new Set(input.extras).size !== input.extras.length) reject('DECISION_EXTRAS');
  if (input.aiStance !== 'none' || input.aiRunId !== null) reject('AI_UNAVAILABLE');
  if (!input.level && !input.extras.length) reject('DECISION_EMPTY');
  if (alert.level === 'danger' && input.level === 'downgrade') reject('DANGER_NO_DOWNGRADE');
  return { operator, operatorVerified: false, viewedMs: input.viewedMs,
    level: input.extras.includes('call_999') ? 'escalate' : input.level, extras: [...input.extras], aiStance: 'none', aiRunId: null, aiUnavailable: true };
}
