import { drawBayFrame } from './detail-render.mjs';
import { zoneLabels } from './layout.mjs';
import { escalateActionLabel, aiUnavailableMessage } from './operator-copy.mjs';

const words = {
  zh: { title: 'AI 說明', stub: '測試替身 · 預設輸出 · 非真實模型', waiting: '正在等待 AI 說明…', unavailable: 'AI 說明不可用 · 請直接選擇級別',
    confirm: '採用建議並預填', reject: '拒絕建議 · 自行選擇級別', observe: '繼續觀察', dispatch_patrol: '派人查看', notify_manager: '通知經理', call_999: '撥打 999', request_closeup: '調取特寫熱成像',
    downgrade: '降級 · 觀察', maintain: '維持', escalate: '升級為危險', battery_zone_anomaly: '車底區域異常', brake_residual_heat: '輪區餘熱', recently_parked: '剛停泊', engine_or_exhaust: '引擎或排氣區熱源', sun_or_ambient: '日照或環境', undetermined: '原因未定',
    limit: '仿真 · 不可匯出。只覆蓋朝外的一端，不能排除遮擋或車內異常；AI 僅供參考，危險告警不可降級。', hotspot: '程式定位', history: '本次演示 AI 執行記錄', frame: 'AI 分析時的幀',
    AI_NOT_CONFIGURED: 'AI 未配置', AI_DISABLED: 'AI 已關閉', AI_NO_ALERT: '沒有可分析的告警', AI_TIMEOUT: '等待逾時', AI_REFUSAL: '模型拒絕回覆', AI_STALE: '結果已作廢', AI_PROVIDER_RATE_LIMIT: '服務繁忙', AI_JSON: '回覆不是有效 JSON', AI_INCOMPLETE: '回覆不完整', AI_UNAVAILABLE: '服務不可用', AI_STORAGE: 'AI 記錄寫入失敗', invalid: '回覆未通過校驗', status_available: '已通過校驗', status_stale: '已作廢', status_waiting: '等待中', status_unavailable: '不可用' },
  en: { title: 'AI explanation', stub: 'TEST STUB · Preset output · Not a real model', waiting: 'Waiting for an AI explanation…', unavailable: 'AI explanation unavailable · Choose a level directly',
    confirm: 'Use suggestion to prefill', reject: 'Reject suggestion · Choose a level', observe: 'Continue observing', dispatch_patrol: 'Dispatch patrol', notify_manager: 'Notify manager', call_999: 'Call 999', request_closeup: 'Request close-up thermal',
    downgrade: 'Downgrade · Observe', maintain: 'Maintain', escalate: 'Escalate to danger', battery_zone_anomaly: 'Underbody anomaly', brake_residual_heat: 'Wheel residual heat', recently_parked: 'Recently parked', engine_or_exhaust: 'Engine or exhaust heat', sun_or_ambient: 'Sun or ambient heat', undetermined: 'Undetermined cause',
    limit: 'Simulation · Not exportable. Only the outward-facing end is covered; occlusion or internal anomalies cannot be excluded. AI is advisory; danger cannot be downgraded.', hotspot: 'Program location', history: 'AI runs in this demo session', frame: 'Frame used for AI analysis',
    AI_NOT_CONFIGURED: 'AI is not configured', AI_DISABLED: 'AI is switched off', AI_NO_ALERT: 'No alert to analyse', AI_TIMEOUT: 'Waiting timed out', AI_REFUSAL: 'Model refused', AI_STALE: 'Result invalidated', AI_PROVIDER_RATE_LIMIT: 'Service busy', AI_JSON: 'Invalid JSON response', AI_INCOMPLETE: 'Incomplete response', AI_UNAVAILABLE: 'Service unavailable', AI_STORAGE: 'AI record could not be saved', invalid: 'Response failed validation', status_available: 'Validated', status_stale: 'Invalidated', status_waiting: 'Waiting', status_unavailable: 'Unavailable' }
};

// Receipt time is monotonic and repeated reads never restart a run's wait budget.
export function createAIWaitClock(now = () => performance.now()) {
  let key = null, deadline = 0;
  return ai => {
    if (ai?.id !== key) { key = ai?.id; deadline = now() + Math.min(10000, Math.max(0, ai?.remainingMs ?? 9000)); }
    return ai?.status === 'waiting' && now() >= deadline ? { ...ai, status: 'unavailable', errorCode: 'AI_TIMEOUT' } : ai;
  };
}

export function aiFrameContext(ai, currentFrameSeq) {
  return { frameSeq: Number.isSafeInteger(ai?.frameSeq) ? ai.frameSeq : null,
    earlier: Number.isSafeInteger(ai?.frameSeq) && Number.isSafeInteger(currentFrameSeq) && ai.frameSeq < currentFrameSeq };
}

export function createAIView({ host, language, onChoose }) {
  host.innerHTML = '<h3 id="cpAiTitle"></h3><p id="cpAiStub" class="cp-ai-stub" hidden></p><p id="cpAiUnavailable" role="status" class="cp-detail-small"></p><div id="cpAiOutput" hidden><strong id="cpAiRecommendation"></strong><p id="cpAiRationale"></p><p id="cpAiSteps" class="cp-detail-small"></p><p id="cpAiHotspot" class="cp-detail-small"></p><p id="cpAiLimit" class="cp-detail-small"></p><div class="cp-ai-actions"><button id="cpAiConfirm" class="cp-button" type="button"></button><button id="cpAiReject" class="cp-button" type="button"></button></div></div><details id="cpAiHistory"><summary id="cpAiHistoryTitle"></summary><div id="cpAiRuns"></div></details>';
  const $ = id => host.querySelector(`#${id}`), wait = createAIWaitClock();
  const frameStamp = document.createElement('p'); frameStamp.id = 'cpAiFrame'; frameStamp.className = 'cp-detail-small'; frameStamp.hidden = true;
  $('cpAiTitle').after(frameStamp);
  let current = null, historyKey = '';
  const node = (tag, text) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; return element; };
  $('cpAiConfirm').addEventListener('click', () => current && onChoose('confirmed', current));
  $('cpAiReject').addEventListener('click', () => current && onChoose('rejected', current));
  return next => {
    const c = words[language()], ai = wait(next.ai);
    const matches = ai?.alertId === next.alert?.id && ai?.sessionId === next.sessionId && ai?.levelAtRequest === next.alert?.level;
    current = matches && ai.status === 'available' && ai.ok && next.connected ? ai : null;
    const waiting = matches && ai.status === 'waiting';
    const code = matches ? ai.errorCode : next.ai?.errorCode || 'AI_STALE';
    host.dataset.aiStatus = current ? 'available' : waiting ? 'waiting' : 'unavailable';
    host.dataset.aiRunId = current?.id ?? '';
    const frameContext = aiFrameContext(matches ? ai : null, next.currentFrameSeq);
    frameStamp.hidden = frameContext.frameSeq === null; frameStamp.dataset.earlier = String(frameContext.earlier);
    frameStamp.textContent = frameContext.frameSeq === null ? '' : `${c.frame} ${frameContext.frameSeq}${frameContext.earlier ? (language() === 'zh' ? ' · 說明基於較早畫面' : ' · Explanation uses an earlier frame') : ''}`;
    $('cpAiTitle').textContent = c.title; $('cpAiStub').hidden = !ai?.testStub; $('cpAiStub').textContent = c.stub;
    $('cpAiUnavailable').hidden = Boolean(current); $('cpAiUnavailable').textContent = aiUnavailableMessage({ waiting, code, zh: language() === 'zh' });
    $('cpAiOutput').hidden = !current; $('cpAiConfirm').disabled = !current || !next.detailReady || next.busy; $('cpAiReject').disabled = !current || !next.detailReady || next.busy;
    $('cpAiConfirm').textContent = c.confirm; $('cpAiReject').textContent = c.reject;
    if (current) {
      $('cpAiRecommendation').textContent = `${current.output.recommendation === 'escalate' ? escalateActionLabel(next.alert?.level, language() === 'zh') : c[current.output.recommendation]} · ${c[current.output.cause]}`;
      $('cpAiRationale').textContent = current.output[`rationale_${language()}`];
      $('cpAiSteps').textContent = current.output.next_steps.map(step => c[step]).join(' / ');
      $('cpAiHotspot').textContent = `${c.hotspot}: ${current.hotspot?.labels?.[language()] ?? '—'}`;
      $('cpAiLimit').textContent = c.limit;
    }
    $('cpAiHistoryTitle').textContent = c.history;
    const signature = JSON.stringify([next.sessionId, next.bayId, language(), (next.aiRuns ?? []).map(run => [run.id, run.status, run.errorCode, run.model, run.latencyMs])]);
    if (historyKey !== signature) {
      historyKey = signature; $('cpAiRuns').replaceChildren();
      for (const run of [...(next.aiRuns ?? [])].reverse()) {
        const item = node('details'); item.dataset.aiRunId = run.id;
        item.append(node('summary', `${run.model ?? '—'} · ${c[`status_${run.status}`]} · ${run.latencyMs === null ? '—' : Math.round(run.latencyMs) + ' ms'}`));
        item.append(node('p', `${c.frame} · ${run.frameSeq} · ${run.errorCode ? (c[run.errorCode] ?? c.invalid) : c[run.output?.recommendation] ?? '—'}`));
        if (run.output) item.append(node('p', run.output[`rationale_${language()}`]));
        if (run.frame) { const canvas = node('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', c.frame); drawBayFrame(canvas, run.frame.temperaturesC, run.hotspot); item.append(canvas); }
        $('cpAiRuns').append(item);
      }
    }
    return current;
  };
}
