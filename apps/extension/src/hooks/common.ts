import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CONFIG_DIR, QUEUE_FILE, readCredentials, type Credentials } from '../credentials';

export { readCredentials, type Credentials };

export const log = (msg: string) => process.stderr.write(`task-tracker: ${msg}\n`);

export async function apiFetch(
  creds: Credentials,
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 3000, ...rest } = init;
  return fetch(`${creds.serverUrl.replace(/\/+$/, '')}${path}`, {
    ...rest,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.token}`, ...rest.headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** Commits that couldn't be sent (offline / server down) are kept here and retried on the next push. */
export function readQueue<T>(): T[] {
  try {
    return readFileSync(QUEUE_FILE, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as T);
  } catch {
    return [];
  }
}

/** Replaces the queue with `items` (empty clears it). */
export function writeQueue(items: unknown[]): void {
  if (!items.length) {
    try {
      writeFileSync(QUEUE_FILE, '');
    } catch {
      // nothing queued
    }
    return;
  }
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(QUEUE_FILE, items.map((i) => JSON.stringify(i)).join('\n') + '\n', { mode: 0o600 });
}
