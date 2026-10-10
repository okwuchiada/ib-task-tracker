import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Shared between the extension and the git hooks. Hooks run outside VS Code and can't read
 * its secret storage, so the API token is also kept in a user-only file.
 */
export interface Credentials {
  serverUrl: string;
  token: string;
  login: string;
}

export const CONFIG_DIR = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'task-tracker');
export const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json');
export const QUEUE_FILE = join(CONFIG_DIR, 'queue.jsonl');

export function readCredentials(): Credentials | null {
  try {
    const c = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf8')) as Credentials;
    return c.serverUrl && c.token ? c : null;
  } catch {
    return null;
  }
}

export function writeCredentials(c: Credentials): void {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(c, null, 2), { mode: 0o600 });
}

export function deleteCredentials(): void {
  rmSync(CREDENTIALS_FILE, { force: true });
}
