import { randomUUID } from 'node:crypto';
import { CARPARK_LAYOUT } from '../dist/carpark/layout.mjs';
import { ValidationError } from '../dist/safety.mjs';
import { createBayMonitor } from './bays.mjs';
import { createSimulationPlayer } from './sim/player.mjs';

export function createDemoCarpark({ db, broadcast, now = Date.now, autoStart = true, setIntervalFn, clearIntervalFn }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS demo_sessions(id TEXT PRIMARY KEY, started_at TEXT NOT NULL, scenario TEXT, ai_enabled INTEGER NOT NULL, ai_requested INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS bay_alerts(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE, bay_id TEXT NOT NULL, level TEXT NOT NULL, status TEXT NOT NULL, escalation_source TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_bay_alerts_session ON bay_alerts(session_id);
    CREATE TABLE IF NOT EXISTS bay_decisions(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE, alert_id TEXT NOT NULL REFERENCES bay_alerts(id) ON DELETE CASCADE, bay_id TEXT NOT NULL, at TEXT NOT NULL, record TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_bay_decisions_session_bay ON bay_decisions(session_id,bay_id);
  `);
  let session;
  function persistAlert(alert) {
    db.prepare(`INSERT INTO bay_alerts(id,session_id,bay_id,level,status,escalation_source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET level=excluded.level,status=excluded.status,escalation_source=excluded.escalation_source,updated_at=excluded.updated_at`)
      .run(alert.id, alert.sessionId, alert.bayId, alert.level, alert.status, alert.escalationSource, alert.createdAt, alert.updatedAt);
  }
  const monitor = createBayMonitor({ now, onAlert(event, alert) {
    persistAlert(alert); broadcast('alert', { event, alert });
  }, onDecision(decision, alert) {
    db.exec('BEGIN IMMEDIATE');
    try {
      persistAlert(alert);
      db.prepare('INSERT INTO bay_decisions(id,session_id,alert_id,bay_id,at,record) VALUES(?,?,?,?,?,?)')
        .run(decision.id, decision.sessionId, decision.alertId, decision.bayId, decision.at, JSON.stringify(decision));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  } });
  const player = createSimulationPlayer({ now, setIntervalFn, clearIntervalFn,
    onFrame: frame => monitor.ingestSimulation(frame),
    onTick: () => broadcast('bays', { session: { ...session }, bays: monitor.summaries(), sourceType: 'simulation', exportable: false })
  });
  function newSession(scenario = null, aiRequested = true) {
    const next = { id: randomUUID(), startedAt: new Date(now()).toISOString(), scenario, aiRequested, aiEnabled: false, aiConfigured: false, sourceType: 'simulation', timeCompressed: true, exportable: false };
    db.exec('BEGIN IMMEDIATE');
    try {
      if (session) db.prepare('DELETE FROM demo_sessions WHERE id=?').run(session.id);
      db.prepare('INSERT INTO demo_sessions(id,started_at,scenario,ai_enabled,ai_requested) VALUES(?,?,?,?,?)').run(next.id, next.startedAt, scenario, 0, Number(aiRequested));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    session = next;
    // Includes the target bay's frame/rate history: its first frame has no slope.
    monitor.reset(session.id, { scenario });
    player.reset(scenario);
    return snapshot();
  }
  function snapshot() {
    return { schemaVersion: 'voltguard-carpark-state-1', layout: CARPARK_LAYOUT, session: { ...session }, bays: monitor.summaries() };
  }
  function detail(id) {
    return {
      ...monitor.detail(id), session: { ...session }, sourceType: 'simulation', exportable: false,
      decisions: db.prepare('SELECT record FROM bay_decisions WHERE session_id=? AND bay_id=? ORDER BY rowid').all(session.id, id).map(row => JSON.parse(row.record)),
      ai: { status: 'unavailable', errorCode: session.aiRequested ? 'BAY_AI_NOT_IMPLEMENTED' : 'AI_DISABLED' }
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
      broadcast('decision', { sessionId: session.id, bayId: result.decision.bayId, alertId: id, decisionId: result.decision.id, sourceType: 'simulation', exportable: false });
      broadcast('alert', { event: 'decision', alert: result.alert });
      const state = snapshot(); broadcast('bays', { session: state.session, bays: state.bays, sourceType: 'simulation', exportable: false });
      return { ...result, session: { ...session }, sourceType: 'simulation', exportable: false };
    },
    alerts: () => ({ session: { ...session }, alerts: monitor.alerts(), sourceType: 'simulation', exportable: false }),
    reset: () => newSession(), tick: player.tick, close: player.stop
  };
}
