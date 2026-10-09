import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { normalizeTelemetry, assessTelemetry, createReport, ValidationError } from '../dist/safety.mjs';
import {buildNasaReport,decodeMeasuredImport} from '../dist/evidence.mjs';
import {createCopilot,CopilotError} from './copilot.mjs';
import {retrieveGuidance} from './rag.mjs';

const project = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = path.join(project, 'dist');
export async function createVoltGuardServer({ databasePath = path.join(project, '.sites-runtime', 'voltguard.sqlite'), ingestToken = process.env.VOLTGUARD_INGEST_TOKEN || '', copilotOptions={} } = {}) {
  const copilot=createCopilot(copilotOptions);
  if (databasePath !== ':memory:') await mkdir(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS telemetry(id INTEGER PRIMARY KEY, asset TEXT NOT NULL, mode TEXT NOT NULL, source TEXT NOT NULL, measured_at TEXT NOT NULL, report TEXT NOT NULL, UNIQUE(asset,mode,source,measured_at));
    CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, telemetry_id INTEGER NOT NULL REFERENCES telemetry(id), asset TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES events(id), action TEXT NOT NULL, at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_audit_event_id ON audit(event_id,id); PRAGMA optimize;`);
  const clients = new Set(), csrf = randomBytes(24).toString('hex');
  const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
  function latest(asset, source) {
    const row = db.prepare("SELECT report FROM telemetry WHERE asset=? AND source=? AND mode='live' ORDER BY measured_at DESC LIMIT 1").get(asset, source);
    return row ? JSON.parse(row.report) : null;
  }
  const events = () => db.prepare('SELECT e.*, t.report FROM events e JOIN telemetry t ON e.telemetry_id=t.id ORDER BY e.id DESC LIMIT 100').all().map(row => ({ ...row, report: JSON.parse(row.report) }));
  function sendFrame(socket, value) {
    const data = Buffer.from(JSON.stringify(value));
    const head = data.length < 126 ? Buffer.from([0x81, data.length]) : Buffer.from([0x81, 126, data.length >> 8, data.length & 255]);
    if (!socket.destroyed && socket.writableLength < 262144) socket.write(Buffer.concat([head, data]));
    else socket.destroy();
  }
  function broadcast(type, report = null) { for (const socket of clients) sendFrame(socket, { type, report }); }
  function store(report) {
    // Asset IDs must be hardware aliases, not VINs/plates. Hash aliases at the local persistence boundary.
    report.record.assetId = hash(report.record.assetId);
    const r = report.record;
    db.exec('BEGIN IMMEDIATE');
    try {
      const inserted = db.prepare('INSERT OR IGNORE INTO telemetry(asset,mode,source,measured_at,report) VALUES(?,?,?,?,?)').run(r.assetId, r.mode, r.source, r.timestamp, JSON.stringify(report));
      if (!inserted.changes) { const stored=db.prepare('SELECT report FROM telemetry WHERE asset=? AND mode=? AND source=? AND measured_at=?').get(r.assetId,r.mode,r.source,r.timestamp);db.exec('COMMIT'); return { duplicate: true, report:JSON.parse(stored.report) }; }
      const kind = ['danger', 'warning'].includes(report.assessment.thermal) ? 'thermal' : report.assessment.maintenance === 'review' ? 'maintenance' : null;
      const now = new Date().toISOString();
      if (kind) {
        // Only live alerts coalesce; historical reviews stay associated with their original record.
        const active = r.mode === 'live' ? db.prepare("SELECT e.id FROM events e JOIN telemetry t ON e.telemetry_id=t.id WHERE e.asset=? AND e.kind=? AND e.status!='closed' AND t.mode='live' AND t.source=? ORDER BY e.id DESC LIMIT 1").get(r.assetId, kind, r.source) : null;
        if (active) {db.prepare("UPDATE events SET telemetry_id=?,updated_at=? WHERE id=?").run(inserted.lastInsertRowid, now, active.id);db.prepare('INSERT INTO audit(event_id,action,at) VALUES(?,?,?)').run(active.id,'measurement',now);}
        else {const saved=db.prepare('INSERT INTO events(telemetry_id,asset,kind,created_at,updated_at) VALUES(?,?,?,?,?)').run(inserted.lastInsertRowid, r.assetId, kind, now, now);db.prepare('INSERT INTO audit(event_id,action,at) VALUES(?,?,?)').run(saved.lastInsertRowid,'created',now);}
      }
      db.exec('COMMIT');
      broadcast('telemetry', report);
      return { duplicate: false, report };
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); };
  function trusted(req) {
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) return false;
    return !req.headers.origin || req.headers.origin === `http://${req.headers.host}`;
  }
  async function body(req) {
    if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new ValidationError('CONTENT_TYPE');
    let size = 0, chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 262144) throw new ValidationError('BODY_TOO_LARGE'); chunks.push(chunk); }
    try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new ValidationError('JSON'); }
  }
  function authorized(req) {
    const provided = Buffer.from((req.headers.authorization || '').replace(/^Bearer /, '')), expected = Buffer.from(ingestToken);
    return expected.length >= 24 && expected.length === provided.length && timingSafeEqual(expected, provided);
  }
  const server = http.createServer(async (req, res) => {
    try {
      if (!trusted(req)) return json(res, 403, { error: 'ORIGIN' });
      const url = new URL(req.url, 'http://127.0.0.1'), route = url.pathname;
      if (route === '/api/health' && req.method === 'GET') return json(res, 200, { storage: 'sqlite', liveIngestConfigured: ingestToken.length >= 24, aiConfigured: copilot.configured, aiModel:'gpt-4o', aiScope:'local_opt_in', csrf });
      if(route==='/api/copilot/rag'&&req.method==='GET'){
        try{return json(res,200,retrieveGuidance(url.searchParams.get('q')||'',url.searchParams.get('lang')));}catch{throw new ValidationError('QUERY');}
      }
      if (route === '/api/events' && req.method === 'GET') return json(res, 200, { events: events() });
      const historyMatch=/^\/api\/events\/([1-9]\d*)\/history$/.exec(route);
      if(historyMatch&&req.method==='GET'){
        const id=Number(historyMatch[1]);if(!Number.isSafeInteger(id))return json(res,404,{error:'EVENT_NOT_FOUND'});
        const row=db.prepare('SELECT e.*,t.report FROM events e JOIN telemetry t ON e.telemetry_id=t.id WHERE e.id=?').get(id);
        if(!row)return json(res,404,{error:'EVENT_NOT_FOUND'});
        const history=db.prepare('SELECT id,action,at FROM audit WHERE event_id=? ORDER BY id DESC LIMIT 200').all(id).reverse();
        const total=db.prepare('SELECT COUNT(*) AS total FROM audit WHERE event_id=?').get(id).total;
        return json(res,200,{schemaVersion:'voltguard-event-history-1',event:{...row,report:JSON.parse(row.report)},history,historyTotal:total,historyTruncated:total>history.length,limitations:['Local development log; not cryptographically tamper-proof.','No authenticated operator identity is recorded.','Older records may not have a creation action in the audit table.','Returns the latest 200 actions only when more exist; truncation is explicit.']});
      }
      if (route === '/api/fleet' && req.method === 'GET') {
        const rows = db.prepare("SELECT report FROM telemetry WHERE id IN (SELECT MAX(id) FROM telemetry WHERE mode='live' GROUP BY asset,source)").all();
        return json(res, 200, { records: rows.map(row => { const report = JSON.parse(row.report); const refreshed = assessTelemetry(report.record); return { ...report, assessment: { ...report.assessment, quality: refreshed.quality, thermal: ['stale','future','partial'].includes(refreshed.quality) && report.assessment.thermal === 'normal' ? 'unknown' : report.assessment.thermal } }; }) });
      }
      if (route === '/api/telemetry/evaluate' && req.method === 'POST') {
        const record = normalizeTelemetry(await body(req));
        return json(res, 200, createReport(record, assessTelemetry(record)));
      }
      if (route === '/api/telemetry/ingest' && req.method === 'POST') {
        if (!authorized(req)) return json(res, 401, { error: ingestToken.length >= 24 ? 'TOKEN' : 'INGEST_NOT_CONFIGURED' });
        const record = normalizeTelemetry(await body(req));
        if (record.mode !== 'live') throw new ValidationError('LIVE_REQUIRED');
        const age = (Date.now() - Date.parse(record.timestamp)) / 1000;
        if (age > 15 || age < -5) throw new ValidationError('STALE_OR_FUTURE');
        const previous = latest(hash(record.assetId), record.source);
        // restore the alias only in memory for same-channel slope comparison
        if (previous) previous.record.assetId = record.assetId;
        const assessment = assessTelemetry(record, previous?.record);
        return json(res, 201, store(createReport(record, assessment, 'authorized_gateway_unverified_measurements')));
      }
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-voltguard-csrf'] !== csrf) return json(res, 403, { error: 'CSRF' });
      if(route==='/api/copilot/diagnose'&&req.method==='POST'){
        const input=await body(req);if(input.consent!==true)throw new ValidationError('AI_CONSENT');
        if(!['en','zh'].includes(input.language))throw new ValidationError('LANGUAGE');
        let report;
        if(input.report?.record?.mode==='live'){
          const r=normalizeTelemetry(input.report.record),stored=db.prepare("SELECT report FROM telemetry WHERE asset=? AND source=? AND measured_at=? AND mode='live'").get(r.assetId,r.source,r.timestamp);
          if(!stored)throw new ValidationError('LIVE_RECORD_NOT_STORED');
          report=JSON.parse(stored.report);const refreshed=assessTelemetry(report.record);
          report.assessment={...report.assessment,quality:refreshed.quality,thermal:['stale','future','partial'].includes(refreshed.quality)&&report.assessment.thermal==='normal'?'unknown':report.assessment.thermal};
        }else{
          report=(await decodeMeasuredImport(input.report,{loadNasaCycle:async ref=>JSON.parse(await readFile(path.join(root,'data','cells',ref.cell.toLowerCase(),'cycles',`${String(ref.dischargeCycle).padStart(3,'0')}.json`),'utf8'))})).report;
        }
        return json(res,200,await copilot.diagnose(report,input.language));
      }
      if (route === '/api/records/nasa' && req.method === 'POST') {
        const input = await body(req);
        if (!['B0005', 'B0006', 'B0007', 'B0018'].includes(input.cell) || !Number.isInteger(input.cycle) || input.cycle < 1 || input.cycle > (input.cell === 'B0018' ? 132 : 168)) throw new ValidationError('NASA_RECORD');
        const c = JSON.parse(await readFile(path.join(root, 'data', 'cells', input.cell.toLowerCase(), 'cycles', `${String(input.cycle).padStart(3, '0')}.json`), 'utf8'));
        // NASA source provides a naive lab date, not UTC. Preserve that date as provenance, not as live timestamp.
        const report=buildNasaReport(input.cell,c,input.sampleIndex??0);
        return json(res, 201, store(report));
      }
      if (route === '/api/records/import' && req.method === 'POST') {
        const input = await body(req);
        const record = normalizeTelemetry(input.record || input);
        const previous = input.previous ? normalizeTelemetry(input.previous) : null;
        if (record.mode !== 'historical') throw new ValidationError('HISTORICAL_REQUIRED');
        if (previous && (previous.mode !== 'historical' || previous.assetId !== record.assetId || previous.source !== record.source)) throw new ValidationError('PREVIOUS_CHANNEL');
        const report = createReport(record, assessTelemetry(record, previous));
        if (previous) { previous.assetId = hash(previous.assetId); report.previousMeasurement = previous; }
        return json(res, 201, store(report));
      }
      const eventMatch = /^\/api\/events\/(\d+)$/.exec(route);
      if (eventMatch && req.method === 'PATCH') {
        const { action } = await body(req), event = db.prepare('SELECT * FROM events WHERE id=?').get(Number(eventMatch[1]));
        if (!event) return json(res, 404, { error: 'EVENT_NOT_FOUND' });
        if (!['acknowledge', 'close'].includes(action)) throw new ValidationError('ACTION');
        if (event.status === 'closed') return json(res, 409, { error: 'EVENT_CLOSED' });
        if(action==='acknowledge'&&event.status==='acknowledged')return json(res,409,{error:'EVENT_ACKNOWLEDGED'});
        if (action === 'close' && event.status !== 'acknowledged') return json(res, 409, { error: 'ACKNOWLEDGE_FIRST' });
        const report = JSON.parse(db.prepare('SELECT report FROM telemetry WHERE id=?').get(event.telemetry_id).report);
        if (action === 'close' && report.record.mode === 'live' && event.kind === 'thermal') {
          const current = latest(event.asset, report.record.source);
          const assessment = current ? assessTelemetry(current.record) : null;
          // Cannot close active danger/warning or stale/partial/no-slope evidence.
          if (!assessment || assessment.quality !== 'current' || current.assessment.thermal !== 'normal') return json(res, 409, { error: 'UNRESOLVED_THERMAL' });
        }
        const now = new Date().toISOString();
        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('UPDATE events SET status=?,updated_at=? WHERE id=?').run(action === 'close' ? 'closed' : 'acknowledged', now, event.id);
          db.prepare('INSERT INTO audit(event_id,action,at) VALUES(?,?,?)').run(event.id, action, now);
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        broadcast('events');
        return json(res, 200, { events: events() });
      }
      if (route.startsWith('/api/')) return json(res, 404, { error: 'API_NOT_FOUND' });
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'METHOD' });
      let decoded;
      try { decoded = decodeURIComponent(route); } catch { return json(res, 400, { error: 'PATH' }); }
      const filename = path.resolve(root, decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, ''));
      const relative = path.relative(root, filename);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return json(res, 403, { error: 'PATH' });
      const mime = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css' };
      const data = await readFile(filename);
      res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (error instanceof CopilotError) json(res,error.status,{error:error.code});
      else if (error instanceof ValidationError) json(res, 422, { error: error.code });
      else if (error.code === 'ENOENT') json(res, 404, { error: 'NOT_FOUND' });
      else { console.error('VoltGuard request failed:', error.name); json(res, 500, { error: 'INTERNAL' }); }
    }
  });
  server.on('upgrade', (req, socket) => {
    if (!trusted(req) || req.url !== '/ws' || req.headers['sec-websocket-version'] !== '13' || !/^[A-Za-z0-9+/]{22}==$/.test(req.headers['sec-websocket-key'] || '')) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    clients.add(socket); sendFrame(socket, { type: 'connected', mode: 'local_live_gateway' });
    // This is a receive-only subscription. Incoming application frames are not ingestion.
    socket.on('data', () => socket.end(Buffer.from([0x88, 0x00])));
    socket.on('error', () => clients.delete(socket)); socket.on('close', () => clients.delete(socket));
  });
  const heartbeat = setInterval(() => broadcast('heartbeat'), 10000); heartbeat.unref();
  server.on('close', () => { clearInterval(heartbeat); db.close(); });
  return { server, close: () => { for (const client of clients) client.destroy(); return new Promise(resolve => server.close(resolve)); } };
}
