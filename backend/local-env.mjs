import { fileURLToPath } from 'node:url';

// Only command-line entrypoints load private configuration. Imported server
// factories and ordinary tests never pick up the real provider credentials.
export function loadLocalEnv({ filename = fileURLToPath(new URL('../.env', import.meta.url)), load = process.loadEnvFile } = {}) {
  try { load(filename); return true; }
  catch (error) {
    if (error.code === 'ENOENT') return false;
    throw new Error('ENV_FILE_UNREADABLE'); // Do not echo file contents or errors.
  }
}
