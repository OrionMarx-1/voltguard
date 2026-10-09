import { randomUUID } from 'node:crypto';
import { CARPARK_LAYOUT } from '../dist/carpark/layout.mjs';
import { ValidationError } from '../dist/safety.mjs';
import { createBayMonitor } from './bays.mjs';
import { createSimulationPlayer } from './sim/player.mjs';
import { createAIProvider } from './ai-provider.mjs';
import { createBayAI, publicAIRun } from './bay-ai.mjs';

export function createDemoCarpark({ db, broadcast, now = Date.now, autoStart = true, setIntervalFn, clearIntervalFn, provider = createAIProvider(), aiOptions = {} }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS demo_sessions(id TEXT PRIMARY KEY, started_at TEXT NOT NULL, scenario TEXT, ai_enabled INTEGER NOT NULL, ai_requested INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS bay_alerts(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE, bay_id TEXT NOT NULL, level TEXT NOT NULL, status TEXT NOT NULL, escalation_source TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_bay_alerts_session ON bay_alerts(session_id);
    CREATE TABLE IF NOT EXISTS bay_decisions(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE, alert_id TEXT NOT NULL REFERENCES bay_alerts(id) ON DELETE CASCADE, bay_id TEXT NOT NULL, at TEXT NOT NULL, record TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_bay_decisions_session_bay ON bay_decisions(session_id,bay_id);
    CREATE TABLE IF NOT EXISTS bay_ai_runs(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE, alert_id TEXT NOT NULL REFERENCES bay_alerts(id) ON DELETE CASCADE, bay_id TEXT NOT NULL, record TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_bay_ai_session_bay ON bay_ai_runs(session_id,bay_id);
  `);
  let session, ai;
  function persistAlert(alert) {
    db.prepare(`INSERT INTO bay_alerts(id,session_id,bay_id,level,status,escalation_source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET level=excluded.level,status=excluded.status,escalation_source=excluded.escalation_source,updated_at=excluded.updated_at`)
      .run(alert.id, alert.sessionId, alert.bayId, alert.level, alert.status, alert.escalationSource, alert.createdAt, alert.updatedAt);
  }
  const monitor = createBayMonitor({ now, onAlert(event, alert) {
    persistAlert(alert); broadcast('alert', { event, alert });
    if (['created', 'escalated', 'reopened'].includes(event)) ai?.trigger(alert, monitor.detail(alert.bayId));
    else if (event === 'closed') ai?.invalidate(alert.id);
  }, onDecision(decision, alert) {
    db.exec('BEGIN IMMEDIATE');
    try {
      persistAlert(alert);
      db.prepare('INSERT INTO bay_decisions(id,session_id,alert_id,bay_id,at,record) VALUES(?,?,?,?,?,?)')
        .run(decision.id, decision.sessionId, decision.alertId, decision.bayId, decision.at, JSON.stringify(decision));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }, getAI: alert => ai?.latest(alert.id) });
  ai = createBayAI({ ...aiOptions, provider, now, onRun(run) {
    if (run.sessionId !== session?.id) return;
    db.prepare('INSERT INTO bay_ai_runs(id,session_id,alert_id,bay_id,record) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record')
      .run(run.id, run.sessionId, run.alertId, run.bayId, JSON.stringify(run));
  }, onChange(run) {
    broadcast('ai', { sessionId: run.sessionId, bayId: run.bayId, alertId: run.alertId, runId: run.id, status: run.status, errorCode: run.errorCode, sourceType: 'simulation', exportable: false, testStub: run.testStub });
  } });
  const player = createSimulationPlayer({ now, setIntervalFn, clearIntervalFn,
    onFrame: frame => monitor.ingestSimulation(frame),
    onTick: () => broadcast('bays', { session: { ...session }, bays: monitor.summaries(), sourceType: 'simulation', exportable: false })
  });
  function newSession(scenario = null, aiRequested = true) {
    const next = { id: randomUUID(), startedAt: new Date(now()).toISOString(), scenario, aiRequested, aiEnabled: aiRequested && provider.configured, aiConfigured: provider.configured,
      aiMode: provider.kind === 'test_stub' ? 'test_stub' : provider.configured ? 'provider' : 'unconfigured', sourceType: 'simulation', timeCompressed: true, exportable: false };
    db.exec('BEGIN IMMEDIATE');
    try {
      if (session) db.prepare('DELETE FROM demo_sessions WHERE id=?').run(session.id);
      db.prepare('INSERT INTO demo_sessions(id,started_at,scenario,ai_enabled,ai_requested) VALUES(?,?,?,?,?)').run(next.id, next.startedAt, scenario, Number(next.aiEnabled), Number(aiRequested));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    session = next;
    ai.reset(session.id, session.aiEnabled);
    // Includes the target bay's frame/rate history: its first frame has no slope.
    monitor.reset(session.id, { scenario });
    player.reset(scenario);
    return snapshot();
  }
  function snapshot() {
    return { schemaVersion: 'voltguard-carpark-state-1', layout: CARPARK_LAYOUT, session: { ...session }, bays: monitor.summaries() };
  }
  function detail(id) {
    const current = monitor.detail(id);
    const lookup = runId => { const row = db.prepare('SELECT record FROM bay_ai_runs WHERE id=? AND session_id=?').get(runId, session.id); return row ? publicAIRun(JSON.parse(row.record)) : null; };
    return {
      ...current, session: { ...session }, sourceType: 'simulation', exportable: false,
      decisions: db.prepare('SELECT record FROM bay_decisions WHERE session_id=? AND bay_id=? ORDER BY rowid').all(session.id, id).map(row => { const decision = JSON.parse(row.record); return { ...decision, aiRun: decision.aiRunId ? lookup(decision.aiRunId) : null }; }),
      aiRuns: db.prepare('SELECT record FROM bay_ai_runs WHERE session_id=? AND bay_id=? ORDER BY rowid').all(session.id, id).map(row => publicAIRun(JSON.parse(row.record))),
      ai: !session.aiRequested ? { status: 'unavailable', errorCode: 'AI_DISABLED', testStub: provider.kind === 'test_stub' } : ai.latest(current.alert?.id)
    };
  }
  function play(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['name', 'ai'].includes(key))) throw new ValidationError('DEMO_CONTROL');
    if (!['A', 'B'].includes(input.name)) throw new ValidationError('SIMULATION_SCENARIO');
    if (typeof input.ai !== 'boolean') throw new ValidationError('DEMO_AI_SWITCH');
    return newSession(input.name, input.ai);
  }
  newSession();
  if (autoStart) player.start();
  return {
    snapshot, detail, play,
    decide(id, input) {
      const result = monitor.decide(id, input);
      if (result.decision.levelBefore === 'warning' && result.alert.level === 'danger') ai.trigger(result.alert, monitor.detail(result.alert.bayId));
      broadcast('decision', { sessionId: session.id, bayId: result.decision.bayId, alertId: id, decisionId: result.decision.id, sourceType: 'simulation', exportable: false });
      broadcast('alert', { event: 'decision', alert: result.alert });
      const state = snapshot(); broadcast('bays', { session: state.session, bays: state.bays, sourceType: 'simulation', exportable: false });
      return { ...result, session: { ...session }, sourceType: 'simulation', exportable: false };
    },
    alerts: () => ({ session: { ...session }, alerts: monitor.alerts(), sourceType: 'simulation', exportable: false }),
    reset: () => newSession(), tick: player.tick, close: () => { player.stop(); ai.close(); }
  };
}
