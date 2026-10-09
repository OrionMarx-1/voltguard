import { drawBayFrame } from './detail-render.mjs';
import { hotspotRegion } from './layout.mjs';
import { createAIView } from './ai-view.mjs';

const words = {
  zh: { operator: '值班員名稱或代號', unverified: '未驗證身份 · 1–20 字', placeholder: '例如 P1', title: '保安決定',
    unavailable: 'AI 說明不可用 · 直接選擇級別', pending: '待處理', processing: '處理中', downgraded: '已降級 · 觀察中',
    downgrade: '降級 · 觀察', maintain: '維持', escalate: '升級為危險', extrasOnly: '只記錄附加動作', level: '選擇級別', extras: '附加動作',
    dispatch_patrol: '派人查看', notify_manager: '通知經理', call_999: '撥打 999', submit: '記錄決定', saving: '正在記錄…',
    noAlert: '此車位沒有未結束告警。', dangerLock: '危險級別不得降級；可維持、升級或記錄附加動作。',
    recordOnly: '只記錄你的選擇；系統不會自動通知或撥號。', emergency: '危險告警：請依現場應變計劃安排處置。',
    callLink: '手動撥打 999', history: '本次演示決定記錄', noHistory: '尚無決定記錄。', simulation: '仿真 · 不可匯出',
    snapshot: '操作時的服務端最新幀', duration: '查看時長', saved: '決定已記錄。', failed: '記錄結果未確認；請重讀詳情後再試。',
    OPERATOR: '請輸入 1–20 字的值班員名稱或代號。', ALERT_NOT_ACTIVE: '告警已結束或演示已重置，請重新查看。',
    DANGER_NO_DOWNGRADE: '告警已升為危險，不能降級。', AI_UNAVAILABLE: 'AI 說明不可用，請直接選擇級別。',
    AI_STALE: 'AI 建議已更新或作廢，請重新選擇。', AI_LEVEL_MISMATCH: '級別已偏離 AI 建議，請駁回後自行選擇。', DECISION_LEVEL: '請選擇級別。',
    DECISION_EMPTY: '請選擇級別或至少一項附加動作。', CSRF: '服務已重啟，請重新連線。', frame: '幀', aiNone: '未依據 AI', none: '無' },
  en: { operator: 'Operator name or code', unverified: 'Identity unverified · 1–20 characters', placeholder: 'For example, P1', title: 'Operator decision',
    unavailable: 'AI explanation unavailable · Choose a level directly', pending: 'Pending', processing: 'In progress', downgraded: 'Downgraded · Observing',
    downgrade: 'Downgrade · Observe', maintain: 'Maintain', escalate: 'Escalate to danger', extrasOnly: 'Additional actions only', level: 'Choose a level', extras: 'Additional actions',
    dispatch_patrol: 'Dispatch patrol', notify_manager: 'Notify manager', call_999: 'Call 999', submit: 'Record decision', saving: 'Recording…',
    noAlert: 'This bay has no active alert.', dangerLock: 'Danger cannot be downgraded. Maintain, escalate or record additional actions.',
    recordOnly: 'Records your choices only. No automatic notifications or calls.', emergency: 'Danger alert: arrange a response under the site emergency plan.',
    callLink: 'Manually call 999', history: 'Decisions in this demo session', noHistory: 'No decisions recorded.', simulation: 'Simulation · Not exportable',
    snapshot: 'Latest service frame at the time of the operation', duration: 'Viewing time', saved: 'Decision recorded.', failed: 'Recording result unconfirmed. Reload details before trying again.',
    OPERATOR: 'Enter an operator name or code of 1–20 characters.', ALERT_NOT_ACTIVE: 'The alert ended or the demo was reset. Reload the bay.',
    DANGER_NO_DOWNGRADE: 'The alert is now danger and cannot be downgraded.', AI_UNAVAILABLE: 'AI explanation unavailable. Choose a level directly.',
    AI_STALE: 'The AI suggestion changed or was invalidated. Choose again.', AI_LEVEL_MISMATCH: 'The level differs from the suggestion. Reject it and choose a level.', DECISION_LEVEL: 'Choose a level.',
    DECISION_EMPTY: 'Choose a level or at least one additional action.', CSRF: 'The service restarted. Reconnect first.', frame: 'Frame', aiNone: 'No AI reference', none: 'None' }
};
export function createViewingClock(now = () => performance.now()) {
  let key = null, startedAt = now();
  return { open(next) { if (next !== key) { key = next; startedAt = now(); } }, elapsed: () => Math.max(0, Math.round(now() - startedAt)), reset() { key = null; } };
}
export function createDecisionPanel({ host, operatorHost, language, request, onSaved }) {
  const $ = id => host.querySelector(`#${id}`), c = () => words[language()];
  operatorHost.innerHTML = '<label for="cpOperator" id="cpOperatorLabel"></label><input id="cpOperator" maxlength="20" autocomplete="off" aria-describedby="cpOperatorNote"><small id="cpOperatorNote"></small>';
  const operator = operatorHost.querySelector('input');
  try { operator.value = localStorage.getItem('voltguard.carpark.operator') ?? ''; } catch { /* Storage is optional. */ }
  operator.addEventListener('input', () => { try { localStorage.setItem('voltguard.carpark.operator', operator.value); } catch {} });
  host.innerHTML = `<div id="cpAiPanel" class="cp-ai-panel"></div><div class="cp-decision-heading"><h3 id="cpDecisionTitle"></h3><span id="cpDecisionStatus"></span></div>
    <p id="cpNoActiveAlert" class="cp-detail-small"></p><form id="cpDecisionForm"><fieldset id="cpLevelChoices"><legend id="cpLevelLegend"></legend>
    ${['downgrade', 'maintain', 'escalate', ''].map(value => `<label><input type="radio" name="cpDecisionLevel" value="${value}" id="cpLevel${value || 'extras'}"><span data-dp="${value || 'extrasOnly'}"></span></label>`).join('')}</fieldset>
    <p id="cpDangerLock" class="cp-detail-small" hidden></p><fieldset><legend id="cpExtrasLegend"></legend>${['dispatch_patrol', 'notify_manager', 'call_999'].map(action => `<label><input type="checkbox" id="cpExtra_${action}" value="${action}"><span data-dp="${action}"></span></label>`).join('')}</fieldset>
    <p id="cpRecordOnly" class="cp-detail-small"></p><button id="cpDecisionSubmit" class="cp-button" type="submit"></button></form>
    <p id="cpDecisionFeedback" role="status" hidden></p><p id="cpDangerGuidance" class="cp-detail-small" hidden></p><a id="cpCall999" href="tel:999" hidden></a>
    <div class="cp-history-heading"><h3 id="cpDecisionHistoryTitle"></h3><span id="cpDecisionCount">0</span></div><p id="cpHistoryLabel" class="cp-detail-small"></p><div id="cpDecisionHistory"></div>`;
  let context = null, selectionKey = '', formKey = '', historyKey = '', busy = false, feedback = '';
  let aiStance = 'none', aiRunId = null;
  const renderAI = createAIView({ host: $('cpAiPanel'), language, onChoose(stance, ai) {
    aiStance = stance; aiRunId = ai.id;
    host.querySelectorAll('input').forEach(input => { input.checked = false; });
    if (stance === 'confirmed') {
      $(`cpLevel${ai.output.recommendation}`).checked = true;
      for (const extra of ai.output.next_steps) if (extra !== 'observe') $(`cpExtra_${extra}`).checked = true;
    }
    render(context);
  } });
  const viewingClock = createViewingClock();
  const node = (tag, text, className) => { const result = document.createElement(tag); if (text !== undefined) result.textContent = text; if (className) result.className = className; return result; };
  function render(next) {
    context = next;
    const key = `${next.sessionId}/${next.bayId}`;
    if (key !== selectionKey) { selectionKey = key; viewingClock.open(key); feedback = ''; }
    const alert = next.alert, id = `${key}/${alert?.id ?? ''}`;
    if (id !== formKey) { formKey = id; aiStance = 'none'; aiRunId = null; host.querySelectorAll('input').forEach(input => { input.checked = false; }); }
    const currentAI = renderAI({ ...next, busy: next.busy || busy });
    if (aiRunId && aiRunId !== currentAI?.id) {
      aiStance = 'none'; aiRunId = null; host.querySelectorAll('input').forEach(input => { input.checked = false; });
    }
    operatorHost.querySelector('#cpOperatorLabel').textContent = c().operator;
    operatorHost.querySelector('#cpOperatorNote').textContent = c().unverified; operator.placeholder = c().placeholder;
    host.querySelectorAll('[data-dp]').forEach(element => { element.textContent = c()[element.dataset.dp]; });
    for (const [id, text] of Object.entries({ cpDecisionTitle: c().title, cpNoActiveAlert: c().noAlert,
      cpLevelLegend: c().level, cpExtrasLegend: c().extras, cpDangerLock: c().dangerLock, cpRecordOnly: c().recordOnly,
      cpDangerGuidance: c().emergency, cpCall999: c().callLink, cpDecisionHistoryTitle: c().history, cpHistoryLabel: c().simulation })) $(id).textContent = text;
    $('cpDecisionForm').hidden = !alert; $('cpNoActiveAlert').hidden = Boolean(alert);
    $('cpDecisionStatus').textContent = alert ? c()[alert.status] : '';
    $('cpDangerLock').hidden = alert?.level !== 'danger'; $('cpDangerGuidance').hidden = alert?.level !== 'danger';
    const enabled = Boolean(alert && next.connected && next.detailReady && !next.busy && !busy);
    $('cpDecisionForm').querySelectorAll('input, button').forEach(input => { input.disabled = !enabled; });
    $('cpLeveldowngrade').disabled = !enabled || alert?.level === 'danger';
    if (alert?.level === 'danger') $('cpLeveldowngrade').checked = false;
    $('cpDecisionSubmit').textContent = busy ? c().saving : c().submit;
    $('cpDecisionFeedback').hidden = !feedback; $('cpDecisionFeedback').textContent = c()[feedback] ?? c().failed;
    $('cpDecisionFeedback').dataset.result = feedback === 'saved' ? 'saved' : 'error';
    const records = next.decisions ?? [];
    $('cpCall999').hidden = !records.some(row => row.extras.includes('call_999'));
    $('cpDecisionCount').textContent = String(records.length);
    const signature = JSON.stringify([key, language(), records.map(row => row.id)]);
    if (historyKey === signature) return;
    historyKey = signature; $('cpDecisionHistory').replaceChildren();
    if (!records.length) { $('cpDecisionHistory').append(node('p', c().noHistory, 'cp-detail-small')); return; }
    for (const record of [...records].reverse()) {
      const entry = node('details', undefined, 'cp-decision-record'); entry.dataset.decisionId = record.id;
      entry.append(node('summary', `${record.operator} · ${c()[record.level] ?? c().extrasOnly} · ${new Date(record.at).toLocaleTimeString(language() === 'zh' ? 'zh-HK' : 'en-GB', { hour12: false })}`));
      entry.append(node('p', `${c().unverified} · ${c().simulation}`, 'cp-detail-small'));
      entry.append(node('p', `${record.levelBefore === 'danger' ? (language() === 'zh' ? '危險' : 'Danger') : (language() === 'zh' ? '警告' : 'Warning')} → ${record.levelAfter === 'danger' ? (language() === 'zh' ? '危險' : 'Danger') : (language() === 'zh' ? '警告' : 'Warning')}`, 'cp-detail-small'));
      const stance = record.aiStance === 'none' ? c().aiNone : language() === 'zh' ? (record.aiStance === 'confirmed' ? '採用 AI 建議' : '拒絕 AI 建議') : (record.aiStance === 'confirmed' ? 'AI suggestion accepted' : 'AI suggestion rejected');
      entry.append(node('p', `${record.extras.map(action => c()[action]).join(' / ') || c().none} · ${stance}`, 'cp-detail-small'));
      entry.append(node('p', `${c().duration}: ${(record.viewedMs / 1000).toFixed(1)} s · ${c().frame} ${record.frameSeq}`, 'cp-detail-small'));
      entry.append(node('p', c().snapshot, 'cp-detail-small'));
      const canvas = node('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${c().simulation}, ${record.bayId}, ${c().frame} ${record.frameSeq}`);
      drawBayFrame(canvas, record.frame.temperaturesC, hotspotRegion(record.frame.temperaturesC, next.config.endFacingCamera)); entry.append(canvas);
      if (record.aiRun?.frame) {
        entry.append(node('p', `${language() === 'zh' ? 'AI 分析時的幀' : 'Frame used for AI analysis'} · ${record.aiRun.frameSeq}`, 'cp-detail-small'));
        const aiCanvas = node('canvas'); aiCanvas.setAttribute('role', 'img'); aiCanvas.setAttribute('aria-label', language() === 'zh' ? 'AI 分析時的幀' : 'Frame used for AI analysis');
        drawBayFrame(aiCanvas, record.aiRun.frame.temperaturesC, record.aiRun.hotspot); entry.append(aiCanvas);
        if (record.aiRun.output) entry.append(node('p', record.aiRun.output[`rationale_${language()}`], 'cp-detail-small'));
      }
      entry.append(node('p', record.frame.capturedAt, 'cp-detail-small')); $('cpDecisionHistory').append(entry);
    }
  }
  function edited() {
    if ($('cpExtra_call_999').checked) $('cpLevelescalate').checked = true;
    if (aiStance === 'confirmed' && host.querySelector('input[name="cpDecisionLevel"]:checked')?.value !== context.ai?.output?.recommendation) aiStance = 'rejected';
  }
  $('cpDecisionForm').querySelectorAll('input').forEach(input => input.addEventListener('change', edited));
  $('cpDecisionForm').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !context?.alert || !context.connected || !context.detailReady) return;
    const captured = { ...context }, key = selectionKey;
    const input = { level: host.querySelector('input[name="cpDecisionLevel"]:checked')?.value || null,
      extras: [...host.querySelectorAll('input[type="checkbox"]:checked')].map(item => item.value), operator: operator.value.trim(),
      viewedMs: viewingClock.elapsed(), aiStance, aiRunId };
    if (!input.operator || [...input.operator].length > 20) { feedback = 'OPERATOR'; render(context); operator.focus(); return; }
    if (!input.level && !input.extras.length) { feedback = 'DECISION_EMPTY'; render(context); return; }
    if (input.aiStance !== 'none' && !input.level) { feedback = 'DECISION_EMPTY'; render(context); return; }
    busy = true; feedback = ''; render(context);
    try {
      const result = await request(`/api/alerts/${captured.alert.id}/decisions`, input);
      if (selectionKey === key) { feedback = 'saved'; aiStance = 'none'; aiRunId = null; host.querySelectorAll('input').forEach(item => { item.checked = false; }); }
      await onSaved(result);
    } catch (error) { if (selectionKey === key) feedback = error.message; }
    finally { busy = false; render(context); }
  });
  return { render, resetViewing() { selectionKey = ''; viewingClock.reset(); } };
}
