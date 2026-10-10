import { highestReminder, reminderKey, reminderCycleKey, reminderPolicy } from './reminders.mjs';

export function createReminderAudio({ contextFactory = () => new (window.AudioContext ?? window.webkitAudioContext)(), clock = () => performance.now() } = {}) {
  let context = null, enabled = false, lastKey = null, lastPlayed = -Infinity;
  let previousPending = new Set();
  const active = new Set();
  function stop() {
    for (const oscillator of active) { try { oscillator.stop(); } catch { /* Already ended. */ } }
    active.clear();
  }
  function play(tone) {
    stop();
    for (let index = 0; index < tone.count; index++) {
      const oscillator = context.createOscillator(), gain = context.createGain();
      const start = context.currentTime + index * (tone.durationMs + tone.gapMs) / 1000, end = start + tone.durationMs / 1000;
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(tone.frequencyHz, start);
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.06, start + .005);
      gain.gain.setValueAtTime(.06, end - .005); gain.gain.linearRampToValueAtTime(0, end);
      oscillator.connect(gain); gain.connect(context.destination); active.add(oscillator);
      oscillator.onended = () => { active.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start); oscillator.stop(end);
    }
  }
  return {
    get enabled() { return enabled && context?.state === 'running'; },
    async enable() {
      try { context ??= contextFactory(); await context.resume(); enabled = context.state === 'running'; }
      catch { enabled = false; }
      return enabled;
    },
    tick(alerts, options = {}) {
      const alert = highestReminder(alerts, { ...options, enabled: enabled && context?.state === 'running' });
      const pending = new Set(alerts.filter(item => highestReminder([item], { ...options, enabled: true })).map(reminderCycleKey));
      const newlyPending = [...pending].some(key => !previousPending.has(key)); previousPending = pending;
      if (!alert) { stop(); lastKey = null; return null; }
      const key = reminderKey(alert), at = clock(), policy = reminderPolicy(alert);
      if (newlyPending || key !== lastKey || at - lastPlayed >= policy.repeatMs) {
        play(policy.tone); lastKey = key; lastPlayed = at;
        return { level: alert.level, ...policy.tone };
      }
      return null;
    },
    close() { stop(); enabled = false; lastKey = null; context?.close().catch(() => {}); }
  };
}
