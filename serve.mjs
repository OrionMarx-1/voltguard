import { createVoltGuardServer } from './backend/server.mjs';
const port = Number(process.env.VOLTGUARD_PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid VOLTGUARD_PORT');
const app = await createVoltGuardServer();
app.server.listen(port, '127.0.0.1', () => console.log(`VoltGuard: http://127.0.0.1:${port} (local SQLite; live gateway requires VOLTGUARD_INGEST_TOKEN)`));
process.on('SIGINT', async () => { await app.close(); process.exit(0); });
