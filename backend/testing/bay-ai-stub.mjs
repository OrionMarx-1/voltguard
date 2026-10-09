import { BayAIError } from '../ai-provider.mjs';

// Explicit test fixture, never a provider fallback or a measurement of AI ability.
export function createBayAIStub({ mode = 'success', delayMs = 350 } = {}) {
  return { configured: true, kind: 'test_stub', async complete({ text, signal }) {
    await new Promise((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); reject(new BayAIError('AI_CANCELLED')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, delayMs);
      signal?.addEventListener('abort', cancel, { once: true }); if (signal?.aborted) cancel();
    });
    if (mode === 'error') throw new BayAIError('AI_PROVIDER_ERROR');
    if (mode === 'refusal') throw new BayAIError('AI_REFUSAL');
    const evidence = JSON.parse(text), wheel = evidence.hotspotRegion?.en === 'Front wheels' || evidence.hotspotRegion?.en === 'Rear wheels';
    const output = wheel ? { cause: 'brake_residual_heat', recommendation: evidence.alertLevel === 'danger' ? 'maintain' : 'downgrade',
      rationale_zh: '測試替身的預設說明：熱點集中在車輪位置，供操作流程驗證。', rationale_en: 'Preset test-stub explanation: the hotspot is concentrated near the wheel, for workflow testing.', next_steps: ['observe'] } :
      { cause: 'battery_zone_anomaly', recommendation: 'escalate', rationale_zh: '測試替身的預設說明：車底熱點持續升溫，供操作流程驗證。', rationale_en: 'Preset test-stub explanation: the underbody hotspot is rising, for workflow testing.', next_steps: ['dispatch_patrol', 'notify_manager'] };
    if (mode === 'invalid') output.rationale_en = 'Guaranteed safe 99';
    if (mode === 'always_downgrade') { output.cause = 'brake_residual_heat'; output.recommendation = 'downgrade'; output.next_steps = ['observe']; }
    return { json: output, model: 'test-stub-not-a-real-model', latencyMs: delayMs };
  } };
}
