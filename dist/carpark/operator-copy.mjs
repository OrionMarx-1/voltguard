// Operator-facing labels. Internal error codes stay in the AI run history.
export function escalateActionLabel(alertLevel, zh) {
  return alertLevel === 'danger'
    ? (zh ? '記錄處置（危險）' : 'Record as danger')
    : (zh ? '升級為危險' : 'Escalate to danger');
}

export function aiUnavailableMessage({ waiting, code, zh }) {
  if (waiting) return zh ? '正在等待 AI 說明…' : 'Waiting for an AI explanation…';
  if (code === 'AI_DISABLED') return zh ? 'AI 說明不可用 · AI 已關閉 · 請看熱圖後自行選擇級別' : 'AI explanation unavailable · AI is switched off · Look at the thermal image and choose a level';
  if (code === 'AI_NOT_CONFIGURED') return zh ? 'AI 說明不可用 · AI 未配置 · 請看熱圖後自行選擇級別' : 'AI explanation unavailable · AI is not configured · Look at the thermal image and choose a level';
  return zh ? 'AI 說明不可用 · 請看熱圖後自行選擇級別' : 'AI explanation unavailable · Look at the thermal image and choose a level';
}
