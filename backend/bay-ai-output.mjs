import { BayAIError } from './ai-provider.mjs';
import { bayFrameImage } from './frame-image.mjs';
export const BAY_AI_RATIONALE_INSTRUCTION = 'No digits in either rationale, including temperatures, time offsets and cell counts. Do not copy measurements from the input. Describe changes and distribution in words only. rationale_zh must be Traditional Chinese; rationale_en must be English.';
export const BAY_AI_SCHEMA = Object.freeze({ type: 'object', additionalProperties: false, required: ['cause', 'recommendation', 'rationale_zh', 'rationale_en', 'next_steps'], properties: {
  cause: { type: 'string', enum: ['battery_zone_anomaly', 'brake_residual_heat', 'recently_parked', 'engine_or_exhaust', 'sun_or_ambient', 'undetermined'] },
  recommendation: { type: 'string', enum: ['escalate', 'maintain', 'downgrade'] }, rationale_zh: { type: 'string', maxLength: 80 }, rationale_en: { type: 'string', maxLength: 300 },
  next_steps: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string', enum: ['observe', 'dispatch_patrol', 'notify_manager', 'call_999'] } }
} });
export function validateBayAIOutput(output, level) {
  const fail = code => { throw new BayAIError(code); };
  if (!output || Array.isArray(output) || Object.keys(output).sort().join(',') !== 'cause,next_steps,rationale_en,rationale_zh,recommendation' || !BAY_AI_SCHEMA.properties.cause.enum.includes(output.cause) || !BAY_AI_SCHEMA.properties.recommendation.enum.includes(output.recommendation)) fail('AI_OUTPUT_SCHEMA');
  for (const [field, limit] of [['rationale_zh', 80], ['rationale_en', 300]]) {
    const text = output[field];
    if (typeof text !== 'string' || !text.trim() || [...text].length > limit) fail('AI_OUTPUT_RATIONALE');
    if (/\p{N}/u.test(text) || /confirmed safe|guarantee|certainly safe|no risk|fireproof|turn off|power off|disconnect|extinguish|fire blanket|open.*battery|ventilation|disassembl|確保安全|確認安全|保證|毫無風險|斷電|切斷|滅火|防火毯|通風|拆卸|保证|断电|灭火|通风/i.test(text)) fail('AI_OUTPUT_LANGUAGE');
  }
  if (!/\p{Script=Han}/u.test(output.rationale_zh) || !/[a-z]/i.test(output.rationale_en) || /\p{Script=Han}/u.test(output.rationale_en)) fail('AI_OUTPUT_LANGUAGE');
  if (!Array.isArray(output.next_steps) || !output.next_steps.length || new Set(output.next_steps).size !== output.next_steps.length || output.next_steps.some(value => !BAY_AI_SCHEMA.properties.next_steps.items.enum.includes(value))) fail('AI_OUTPUT_STEPS');
  if (output.recommendation === 'downgrade' && (level === 'danger' || ['battery_zone_anomaly', 'undetermined'].includes(output.cause))) fail('AI_OUTPUT_DOWNGRADE');
  if (output.next_steps.includes('call_999') && output.recommendation !== 'escalate') fail('AI_OUTPUT_CALL');
  return structuredClone(output);
}
export function prepareBayAIInput(detail, alert) {
  const at = Date.parse(detail.frame.capturedAt), past = seconds => detail.history.find(item => Date.parse(item.capturedAt) === at - seconds * 1000)?.peakC ?? null;
  const evidence = { hotspotRegion: detail.hotspot?.labels ?? null, peakC: detail.assessment.peakC, peak10SecondsAgoC: past(10), peak30SecondsAgoC: past(30), riseCPerS: detail.assessment.riseCPerS,
    cellsAbove60C: detail.frame.temperaturesC.flat().filter(value => value !== null && value > 60).length, ruleLevel: detail.assessment.thermal, alertLevel: alert.level, isChargingBay: detail.bay.charging, isCharging: detail.summary.isCharging };
  return { system: 'Return only a JSON object matching the supplied schema. Explain the hotspot shape and distribution, temperature trend and charging context to a control-room operator. The supplied hotspot region is computed from installation geometry and is authoritative; do not guess a different location. Never downgrade a danger alert, a battery-zone anomaly or an undetermined cause. Return Traditional Chinese and English rationales together; no digits, safety guarantees, firefighting, disconnecting power, ventilation or disassembly instructions. Next steps are operator choices only. Do not declare a fire or claim certainty. The image covers only the outward-facing vehicle end at an angle across the aisle. Missing pixels and absent past samples are missing evidence, not normal results. ' + BAY_AI_RATIONALE_INSTRUCTION,
    text: JSON.stringify(evidence), imagePng: bayFrameImage(detail.frame.temperaturesC), schema: BAY_AI_SCHEMA };
}
