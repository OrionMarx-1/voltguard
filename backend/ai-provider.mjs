export class BayAIError extends Error { constructor(code) { super(code); this.code = code; } }

// Provider errors are reduced to fixed codes; response bodies and credentials
// never enter logs, public errors or run records. One deadline covers fallback.
export function createAIProvider({ apiKey = process.env.VOLTGUARD_AI_API_KEY ?? '', baseUrl = process.env.VOLTGUARD_AI_BASE_URL ?? '', model = process.env.VOLTGUARD_AI_MODEL ?? '', enabled = process.env.VOLTGUARD_AI_ENABLED === 'true', fetchImpl = globalThis.fetch, clock = () => performance.now() } = {}) {
  let endpoint = null;
  try { const url = new URL(baseUrl); if ((url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) && !url.username && !url.password && !url.search && !url.hash) endpoint = baseUrl.replace(/\/$/, '') + '/chat/completions'; } catch {}
  const configured = Boolean(enabled && endpoint && apiKey.trim() && model.trim());
  return { configured, kind: 'provider', model, async complete({ system, text, imagePng, schema, timeoutMs = 9000, signal }) {
    if (!configured) throw new BayAIError('AI_NOT_CONFIGURED');
    const controller = new AbortController(), started = clock(); let rejectDeadline;
    const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
    const cancel = () => { controller.abort(); rejectDeadline(new BayAIError('AI_CANCELLED')); };
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    const timer = setTimeout(() => { controller.abort(); rejectDeadline(new BayAIError('AI_TIMEOUT')); }, timeoutMs);
    try {
      return await Promise.race([deadline, (async () => {
        // The schema must survive a json_object fallback, where the API no
        // longer receives it through response_format.
        const messages = [{ role: 'system', content: `${system}\nRequired output JSON schema:\n${JSON.stringify(schema)}` }, { role: 'user', content: [...(text ? [{ type: 'text', text }] : []), { type: 'image_url', image_url: { url: imagePng, detail: 'low' } }] }];
        let requests = 0;
        for (const type of ['json_schema', 'json_object']) {
          requests++;
          const response = await fetchImpl(endpoint, { method: 'POST', redirect: 'error', signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({ model, store: false, messages, response_format: type === 'json_schema' ? { type, json_schema: { name: 'voltguard_bay_explanation', strict: true, schema } } : { type } }) });
          const data = await response.json().catch(() => { throw new BayAIError('AI_JSON'); });
          if (JSON.stringify(data).includes(apiKey)) throw new BayAIError('AI_PROVIDER_ERROR');
          if (!response.ok) {
            const unsupported = [400, 422].includes(response.status) && (data.error?.param === 'response_format' || /json_schema/.test(data.error?.message ?? '')) && /unsupported|not.supported/i.test(`${data.error?.code ?? ''} ${data.error?.message ?? ''}`);
            if (type === 'json_schema' && unsupported) continue;
            throw new BayAIError(response.status === 429 ? 'AI_PROVIDER_RATE_LIMIT' : 'AI_PROVIDER_ERROR');
          }
          const choice = data.choices?.[0];
          if (choice?.message?.refusal) throw new BayAIError('AI_REFUSAL');
          if (choice?.finish_reason !== 'stop') throw new BayAIError('AI_INCOMPLETE');
          let json; try { json = JSON.parse(choice.message.content); } catch { throw new BayAIError('AI_JSON'); }
          return { json, latencyMs: Math.max(0, clock() - started), model, responseFormat: type, requests };
        }
      })()]);
    } catch (error) { throw error instanceof BayAIError ? error : new BayAIError('AI_UNAVAILABLE'); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
  } };
}
