import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { RecordCommitRequest, RecordResult } from '@task-tracker/shared';
import { apiFetch, log, readCredentials, readQueue, writeQueue } from './common';
import {
  branchName,
  dedupeCommits,
  LOG_FORMAT,
  parseLog,
  parsePushRefs,
  summarizeResults,
  ZERO_SHA,
} from './pushParser';

const MAX_COMMITS = 500;

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** Commits in `localSha` that the remote doesn't have yet. */
function newCommits(remote: string, localSha: string, remoteSha: string): string[] {
  const ranges = ZERO_SHA.test(remoteSha)
    ? [[localSha, '--not', `--remotes=${remote}`]]
    : [[`${remoteSha}..${localSha}`], [localSha, '--not', `--remotes=${remote}`]]; // fallback if remoteSha isn't local
  for (const range of ranges) {
    try {
      return git(['rev-list', `--max-count=${MAX_COMMITS}`, ...range])
        .split('\n')
        .filter(Boolean);
    } catch {
      // try the next range
    }
  }
  return [];
}

/**
 * git pre-push hook. Sends every pushed commit that carries a task ID to the dashboard.
 * Only pushed commits are recorded so amended/rebased local commits never show up.
 * Never blocks the push: failures are queued and retried on the next push.
 */
async function main(): Promise<void> {
  const [remote = 'origin', remoteUrl = ''] = process.argv.slice(2);
  const refs = parsePushRefs(readFileSync(0, 'utf8'));
  const creds = readCredentials();

  const commits: RecordCommitRequest[] = [];
  for (const ref of refs) {
    const shas = newCommits(remote, ref.localSha, ref.remoteSha);
    if (!shas.length) continue;
    const out = git(['log', '--no-walk=unsorted', `--format=${LOG_FORMAT}`, ...shas]);
    commits.push(...parseLog(out, remoteUrl || remote, branchName(ref.remoteRef)));
  }

  const queued = readQueue<RecordCommitRequest>();
  const batch = dedupeCommits([...queued, ...commits]);
  if (!batch.length) return;

  if (!creds) {
    writeQueue(batch);
    log(`not signed in; ${commits.length} commit(s) queued until you sign in from VS Code.`);
    return;
  }

  const results: RecordResult[] = [];
  let sent = 0;
  try {
    for (; sent < batch.length; sent += MAX_COMMITS) {
      const res = await apiFetch(creds, '/api/commits', {
        method: 'POST',
        body: JSON.stringify({ commits: batch.slice(sent, sent + MAX_COMMITS) }),
        timeoutMs: 5000,
      });
      if (!res.ok) throw new Error(`server returned ${res.status}`);
      const body = (await res.json().catch(() => ({}))) as { results?: RecordResult[] };
      results.push(...(body.results ?? []));
    }
    if (queued.length) writeQueue([]);
  } catch (err) {
    // Keep only what the server hasn't accepted yet, so nothing is queued twice.
    writeQueue(batch.slice(sent));
    log(`could not record ${batch.length - sent} commit(s) (${err instanceof Error ? err.message : err}); queued for the next push.`);
  }
  for (const line of summarizeResults(results)) log(line);
}

main().then(
  () => process.exit(0),
  (err) => {
    log(`unexpected error, push continues: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(0);
  },
);
