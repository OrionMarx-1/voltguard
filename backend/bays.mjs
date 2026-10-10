import { randomUUID } from 'node:crypto';
import { CARPARK_LAYOUT, hotspotRegion } from '../dist/carpark/layout.mjs';
import { normalizeTelemetry, assessTelemetry, ValidationError } from '../dist/safety.mjs';
import { DEMO_BAYS, SCENARIOS } from './sim/scenarios.mjs';
import { normalizeDecision, DecisionError } from './bay-decisions.mjs';
import { POLICY } from '../dist/safety.mjs';

export const BAY_POLICY = Object.freeze({ noDataAfterMs: 5000, historyFrames: 60, normalForMs: 10000, reopenDeltaC: 3 });

// Simulation is assigned by this in-process channel, never by a frame's own claim.
// Frames stay in memory; alerts persist separately through onAlert.
export function createBayMonitor({ now = Date.now, onAlert = () => {}, onDecision = () => {}, getAI = () => null } = {}) {
  let sessionId = null;
  let activeScenario = null;
  const states = new Map();
  function reset(id, { scenario = null } = {}) {
    if (scenario !== null && !['A', 'B'].includes(scenario)) throw new ValidationError('SIMULATION_SCENARIO');
    sessionId = id;
    activeScenario = scenario;
    states.clear();
    for (const bay of CARPARK_LAYOUT.bays) states.set(bay.id, { bay, frames: [], alert: null, normalSince: null, downgradePeak: null });
  }
  reset(null);
  const stateFor = id => {
    const state = states.get(id);
    if (!state) throw new ValidationError('BAY_ID');
    return state;
  };
  function ingestSimulation(input) {
    if (!sessionId) throw new ValidationError('DEMO_SESSION');
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('FRAME_OBJECT');
    if (input.schemaVersion !== 'voltguard-frame-1') throw new ValidationError('FRAME_SCHEMA');
    const state = stateFor(input.bayId);
    if (!Number.isSafeInteger(input.seq) || input.seq < 0) throw new ValidationError('FRAME_SEQUENCE');
    const previous = state.frames.at(-1);
    if (previous && input.seq <= previous.frame.seq) throw new ValidationError('FRAME_SEQUENCE');
    const { rows, cols } = CARPARK_LAYOUT.frame;
    if (!Array.isArray(input.temperaturesC) || input.temperaturesC.length !== rows || input.temperaturesC.some(row => !Array.isArray(row) || row.length !== cols)) {
      throw new ValidationError('FRAME_MATRIX');
    }
    const record = normalizeTelemetry({ assetId: input.bayId, mode: 'live', source: 'VoltGuard carpark simulation', timestamp: input.capturedAt, temperaturesC: input.temperaturesC });
    const receivedAt = now();
    const assessment = assessTelemetry(record, previous?.record ?? null, { now: receivedAt });
    const frame = { schemaVersion: 'voltguard-frame-1', bayId: input.bayId, seq: input.seq, capturedAt: record.timestamp, temperaturesC: record.temperaturesC, sourceType: 'simulation' };
    state.frames.push({ frame, record, assessment, receivedAt, hotspot: hotspotRegion(record.temperaturesC, state.bay.endFacingCamera) });
    if (state.frames.length > BAY_POLICY.historyFrames) state.frames.shift();
    const at = new Date(receivedAt).toISOString();
    if (!state.alert && ['warning', 'danger'].includes(assessment.thermal)) {
      state.alert = { id: randomUUID(), sessionId, bayId: input.bayId, level: assessment.thermal, status: 'pending', pendingSince: at, escalationSource: 'rule', createdAt: at, updatedAt: at, sourceType: 'simulation' };
      onAlert('created', structuredClone(state.alert));
    } else if (state.alert?.level === 'warning' && assessment.thermal === 'danger') {
      if (state.alert.status !== 'pending') state.alert.pendingSince = at;
      state.alert.level = 'danger';
      state.alert.escalationSource = 'rule';
      state.alert.status = 'pending';
      state.normalSince = null;
      state.alert.updatedAt = at;
      onAlert('escalated', structuredClone(state.alert));
    } else if (state.alert?.status === 'downgraded' && (assessment.peakC >= state.downgradePeak + BAY_POLICY.reopenDeltaC || assessment.riseCPerS >= POLICY.warningRiseCPerS)) {
      state.alert.status = 'pending'; state.alert.pendingSince = at; state.alert.updatedAt = at; state.normalSince = null;
      onAlert('reopened', structuredClone(state.alert));
    }
    if (state.alert && state.alert.status !== 'pending') {
      const uninterrupted = previous && receivedAt - previous.receivedAt <= BAY_POLICY.noDataAfterMs && Date.parse(frame.capturedAt) - Date.parse(previous.frame.capturedAt) <= BAY_POLICY.noDataAfterMs && previous.assessment.thermal === 'normal';
      if (assessment.thermal !== 'normal') state.normalSince = null;
      else if (state.normalSince === null || !uninterrupted) state.normalSince = receivedAt;
      if (state.normalSince !== null && receivedAt - state.normalSince >= BAY_POLICY.normalForMs) {
        const closed = { ...state.alert, status: 'closed', updatedAt: at, closedAt: at };
        onAlert('closed', closed); state.alert = null; state.normalSince = null; state.downgradePeak = null;
      }
    }
    return summary(state, receivedAt);
  }
  function summary(state, at = now()) {
    const latest = state.frames.at(-1), demo = DEMO_BAYS.find(bay => bay.bayId === state.bay.id);
    const disconnected = !latest || at - latest.receivedAt > BAY_POLICY.noDataAfterMs;
    const insufficient = !latest || latest.assessment.thermal === 'unknown';
    const noData = disconnected || insufficient;
    const ruleLevel = latest?.assessment.thermal;
    const status = state.alert?.level ?? (['warning', 'danger'].includes(ruleLevel) ? ruleLevel : noData ? 'no_data' : 'normal');
    return {
      id: state.bay.id, status, noData,
      connecting: Boolean(latest && !disconnected && insufficient && latest.assessment.riseCPerS === null),
      peakC: latest?.assessment.peakC ?? null, riseCPerS: latest?.assessment.riseCPerS ?? null,
      isCharging: demo.isCharging, occupied: demo.occupied || SCENARIOS[activeScenario]?.bayId === state.bay.id,
      alertId: state.alert?.id ?? null, alertStatus: state.alert?.status ?? null, frameSeq: latest?.frame.seq ?? null,
      pendingSince: state.alert?.pendingSince ?? null, pendingSeconds: pendingSeconds(state.alert, at)
    };
  }
  const summaries = () => [...states.values()].map(state => summary(state));
  function pendingSeconds(alert, at = now()) {
    return alert?.status === 'pending' && alert.pendingSince ? Math.max(0, Math.floor((at - Date.parse(alert.pendingSince)) / 1000)) : null;
  }
  function alerts() {
    return [...states.values()].filter(state => state.alert).map(state => ({
      ...state.alert, pendingSeconds: pendingSeconds(state.alert), noData: summary(state).noData,
      recovered: !summary(state).noData && state.frames.at(-1)?.assessment.thermal === 'normal'
    })).sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || (a.level === 'danger' ? 0 : 1) - (b.level === 'danger' ? 0 : 1) || a.createdAt.localeCompare(b.createdAt) || a.bayId.localeCompare(b.bayId));
  }
  function decide(alertId, input) {
    const state = [...states.values()].find(item => item.alert?.id === alertId);
    if (!state) throw new DecisionError('ALERT_NOT_ACTIVE');
    const choice = normalizeDecision(input, state.alert, getAI(state.alert)), latest = state.frames.at(-1);
    const at = now(), next = { ...state.alert, updatedAt: new Date(at).toISOString() };
    if (choice.level === 'escalate') { next.level = 'danger'; next.escalationSource = state.alert.level === 'danger' ? state.alert.escalationSource : 'operator'; next.status = 'processing'; }
    else if (choice.level) next.status = choice.level === 'downgrade' ? 'downgraded' : 'processing';
    if (choice.level) next.pendingSince = null;
    const decision = { id: randomUUID(), ...choice, alertId, bayId: state.bay.id, at: next.updatedAt,
      levelBefore: state.alert.level, levelAfter: next.level, frameSeq: latest.frame.seq, frame: structuredClone(latest.frame), sessionId, sourceType: 'simulation', exportable: false };
    // Persist before publishing or changing memory, so failed writes are reversible.
    onDecision(structuredClone(decision), structuredClone(next));
    state.alert = next;
    if (choice.level) {
      state.downgradePeak = choice.level === 'downgrade' ? latest.assessment.peakC : null;
      state.normalSince = !summary(state, at).noData && latest.assessment.thermal === 'normal' ? at : null;
    }
    return { decision, alert: structuredClone(next) };
  }
  function detail(id) {
    const state = stateFor(id), latest = state.frames.at(-1);
    return structuredClone({
      bay: state.bay, summary: summary(state), frame: latest?.frame ?? null,
      assessment: latest?.assessment ?? null, hotspot: latest?.hotspot ?? null,
      history: state.frames.map(item => ({ seq: item.frame.seq, capturedAt: item.frame.capturedAt, peakC: item.assessment.peakC })),
      alert: alerts().find(alert => alert.bayId === id) ?? null
    });
  }
  return { reset, ingestSimulation, summaries, alerts, detail, decide };
}
