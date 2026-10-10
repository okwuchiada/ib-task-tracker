import { readFileSync } from 'node:fs';
import { checkCommitMessage } from '@task-tracker/shared/taskId';
import { apiFetch, log, readCredentials } from './common';

/**
 * git commit-msg hook. Rejects messages without a valid `type(TASK-ID): description`, and IDs the
 * server doesn't know. If the server can't be reached it falls back to the format check only.
 */
async function main(): Promise<number> {
  const file = process.argv[2];
  if (!file) return 0;
  const check = checkCommitMessage(readFileSync(file, 'utf8'));

  if (!check.ok) {
    log(check.reason);
    log('Tip: run "Task Tracker: Insert Task ID in Commit Message" in VS Code, or bypass once with --no-verify.');
    return 1;
  }
  if ('exempt' in check) return 0;

  const creds = readCredentials();
  if (!creds) {
    log('not signed in (run "Task Tracker: Sign In" in VS Code). Only the format was checked.');
    return 0;
  }

  try {
    const res = await apiFetch(creds, `/api/tasks/${encodeURIComponent(check.taskId)}/exists`);
    if (res.status === 404) {
      log(`task ${check.taskId} does not exist. Create it with "Task Tracker: Create Task" in VS Code.`);
      return 1;
    }
    if (res.status === 401) {
      log('your Task Tracker token is invalid or revoked; sign in again in VS Code. Only the format was checked.');
      return 0;
    }
    if (!res.ok) {
      log(`server returned ${res.status}; only the format was checked.`);
      return 0;
    }
    const body = (await res.json()) as { status?: string };
    if (body.status && body.status !== 'OPEN') {
      log(`warning: task ${check.taskId} is ${body.status}.`);
    }
    return 0;
  } catch {
    log(`could not reach ${creds.serverUrl}; only the format was checked.`);
    return 0;
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    log(`unexpected error, commit allowed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(0);
  },
);
