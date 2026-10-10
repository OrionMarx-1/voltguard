// Prototype reminder parameters. These never change a rule level or record a decision.
export const TONES = Object.freeze({
  warning: Object.freeze({ frequencyHz: 880, durationMs: 120, gapMs: 80, count: 2 }),
  danger: Object.freeze({ frequencyHz: 1320, durationMs: 80, gapMs: 50, count: 3 })
});
export const reminderCycleKey = alert => `${alert.id}/${alert.pendingSince}`;
export const reminderKey = alert => `${reminderCycleKey(alert)}/${alert.level}`;
export function reminderPolicy(alert) {
  const pending = alert?.status === 'pending' && Boolean(TONES[alert.level]);
  // Age is supplied by the server, never reconstructed from the browser wall clock.
  const seconds = Number.isFinite(alert?.pendingSeconds) ? Math.max(0, alert.pendingSeconds) : 0;
  const overdue = pending && seconds >= (alert.level === 'danger' ? 30 : 60);
  return { pending, seconds, overdue, repeatMs: overdue ? 5000 : 10000, tone: pending ? TONES[alert.level] : null };
}
export function highestReminder(alerts, { enabled = true, globalMuted = false, mutedUntil = new Map(), now = 0 } = {}) {
  if (!enabled || globalMuted) return null;
  return alerts.filter(alert => reminderPolicy(alert).pending && (mutedUntil.get(reminderCycleKey(alert)) ?? 0) <= now)
    .sort((a, b) => (a.level === 'danger' ? 0 : 1) - (b.level === 'danger' ? 0 : 1) ||
      Number(reminderPolicy(b).overdue) - Number(reminderPolicy(a).overdue) || a.pendingSince.localeCompare(b.pendingSince) || a.id.localeCompare(b.id))[0] ?? null;
}
