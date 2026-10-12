import { randomUUID } from 'node:crypto';
import { BayAIError } from './ai-provider.mjs';
import { bayAIEvidence, prepareBayAIInput, validateBayAIOutput } from './bay-ai-output.mjs';

export function publicAIRun(run) { const { rejectedOutput, ...safe } = run; return structuredClone(safe); }
export function createBayAI({ provider, now = Date.now, clock = () => performance.now(), timeoutMs = 9000, onRun = () => {}, onChange = () => {} }) {
  let sessionId = null, enabled = false, closed = false;
  const latest = new Map(), active = new Set(), queue = [];
  const current = job => !closed && job.run.sessionId === sessionId;
  const publish = job => {
    if (!current(job)) return;
    try { onRun(structuredClone(job.run)); }
    catch { job.run.status = 'unavailable'; job.run.ok = false; job.run.output = null; job.run.errorCode = 'AI_STORAGE'; }
    // AI persistence/broadcast failures must not interrupt rule-frame handling.
    try { onChange(publicAIRun(job.run)); } catch { /* Next detail read reports the current state. */ }
  };
  function invalidate(job, persist = true) {
    job.invalid = true; job.controller?.abort();
    if (!active.has(job)) clearTimeout(job.timer);
    job.run.status = 'stale'; job.run.errorCode = 'AI_STALE';
    if (persist) publish(job);
  }
  function fail(job, code) {
    if (job.invalid || !current(job)) return;
    job.run.status = 'unavailable'; job.run.ok = false; job.run.output = null; job.run.errorCode = code;
    job.run.latencyMs = Math.max(0, clock() - job.createdMono); publish(job);
  }
  function pump() {
    if (closed) return;
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].invalid || queue[i].run.status !== 'waiting') queue.splice(i, 1);
    while (active.size < 2) {
      const index = queue.findIndex(job => !job.invalid && job.run.status === 'waiting' && ![...active].some(other => other.run.alertId === job.run.alertId));
      if (index < 0) return;
      const job = queue.splice(index, 1)[0];
      if (!current(job)) continue;
      const remaining = timeoutMs - (clock() - job.createdMono);
      if (remaining <= 0) { clearTimeout(job.timer); fail(job, 'AI_TIMEOUT'); continue; }
      active.add(job); job.controller = new AbortController();
      const deadline = new Promise((_, reject) => { job.rejectDeadline = reject; });
      Promise.race([deadline, Promise.resolve().then(() => provider.complete({ ...job.input, timeoutMs: remaining, signal: job.controller.signal }))]).then(result => {
        if (job.invalid || !current(job)) return;
        if (clock() - job.createdMono >= timeoutMs) throw new BayAIError('AI_TIMEOUT');
        job.run.model = typeof result.model === 'string' ? result.model.slice(0, 120) : 'unknown';
        job.run.rejectedOutput = result.json;
        job.run.output = validateBayAIOutput(result.json, job.run.levelAtRequest, JSON.parse(job.input.text));
        delete job.run.rejectedOutput;
        job.run.status = 'available'; job.run.ok = true; job.run.errorCode = null;
        job.run.latencyMs = Math.max(0, clock() - job.createdMono); publish(job);
      }).catch(error => fail(job, error instanceof BayAIError ? error.code : 'AI_UNAVAILABLE')).finally(() => {
        if (job.invalid && current(job)) { job.run.latencyMs = Math.max(0, clock() - job.createdMono); publish(job); }
        clearTimeout(job.timer); active.delete(job); pump();
      });
    }
  }
  return {
    reset(id, requested) {
      for (const job of latest.values()) invalidate(job, false);
      queue.splice(0); latest.clear(); sessionId = id; enabled = Boolean(requested && provider.configured); closed = false;
    },
    trigger(alert, detail) {
      if (closed || !enabled || alert.sessionId !== sessionId) return;
      const previous = latest.get(alert.id); if (previous) invalidate(previous);
      const job = { createdMono: clock(), invalid: false, controller: null, input: prepareBayAIInput(detail, alert),
        run: { id: randomUUID(), alertId: alert.id, bayId: alert.bayId, sessionId, levelAtRequest: alert.level, frameSeq: detail.frame.seq, frame: structuredClone(detail.frame),
          createdAt: new Date(now()).toISOString(), status: 'waiting', model: provider.model ?? null, latencyMs: null, ok: false, errorCode: null, output: null,
          hotspot: structuredClone(detail.hotspot), sourceType: 'simulation', exportable: false, testStub: provider.kind === 'test_stub' } };
      latest.set(alert.id, job); publish(job);
      job.timer = setTimeout(() => {
        job.controller?.abort();
        if (active.has(job)) job.rejectDeadline(new BayAIError('AI_TIMEOUT'));
        else { fail(job, 'AI_TIMEOUT'); pump(); }
      }, Math.max(0, timeoutMs - (clock() - job.createdMono)));
      queue.push(job); pump();
    },
    refresh(alert, detail) {
      if (closed || !enabled || alert?.status !== 'pending' || alert.sessionId !== sessionId || !detail?.frame) return false;
      const previous = latest.get(alert.id);
      // Lifecycle callbacks already requested this exact frame during ingestion.
      if (!previous || detail.frame.seq <= previous.run.frameSeq) return false;
      const sent = JSON.parse(previous.input.text), next = bayAIEvidence(detail, alert);
      const gainedHistory = ['peak10SecondsAgoC', 'peak30SecondsAgoC'].some(key => sent[key] === null && Number.isFinite(next[key]));
      const changedRegion = sent.hotspotRegionId !== next.hotspotRegionId;
      const elapsed = Date.parse(detail.frame.capturedAt) - Date.parse(previous.run.frame.capturedAt);
      if (!gainedHistory && !changedRegion && (!Number.isFinite(elapsed) || elapsed < 10000)) return false;
      this.trigger(alert, detail); return true;
    },
    invalidate(alertId) { const job = latest.get(alertId); if (job) invalidate(job); },
    latest(alertId) {
      const job = latest.get(alertId);
      if (!job) return { status: 'unavailable', errorCode: enabled ? 'AI_NO_ALERT' : provider.configured ? 'AI_DISABLED' : 'AI_NOT_CONFIGURED', testStub: provider.kind === 'test_stub' };
      return { ...publicAIRun(job.run), remainingMs: Math.max(0, timeoutMs - (clock() - job.createdMono)) };
    },
    close() {
      closed = true; for (const job of latest.values()) invalidate(job, false);
      for (const job of active) { clearTimeout(job.timer); job.controller?.abort(); job.rejectDeadline(new BayAIError('AI_CANCELLED')); }
      queue.splice(0); latest.clear();
    },
    get activeCount() { return active.size; }
  };
}
