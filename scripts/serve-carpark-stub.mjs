import { createVoltGuardServer } from '../backend/server.mjs';
import { createBayAIStub } from '../backend/testing/bay-ai-stub.mjs';
const port = Number(process.env.VOLTGUARD_STUB_PORT ?? 4183);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid stub preview port');
const app = await createVoltGuardServer({ databasePath: ':memory:', copilotOptions: { apiKey: '' }, carparkOptions: { provider: createBayAIStub() } });
app.server.listen(port, '127.0.0.1', () => console.log(`TEST STUB ONLY; no provider calls: http://127.0.0.1:${port}/?view=carpark`));
process.on('SIGINT', async () => { await app.close(); process.exit(0); });
