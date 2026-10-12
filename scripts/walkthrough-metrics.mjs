// Read-only developer-walkthrough metrics, calculated from server records.
export function decisionTiming(alert, decision) {
  if (!alert || !decision || alert.id !== decision.alertId || alert.bayId !== decision.bayId || alert.sessionId !== decision.sessionId) throw Error('WALKTHROUGH_RECORD_MISMATCH');
  const start = Date.parse(alert.createdAt), end = Date.parse(decision.at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw Error('WALKTHROUGH_TIMESTAMP');
  return { alertCreatedAt: alert.createdAt, decisionAt: decision.at, alertToDecisionSeconds: (end - start) / 1000,
    viewedSeconds: decision.viewedMs / 1000 };
}
