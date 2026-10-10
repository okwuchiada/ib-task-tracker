import { extractTaskIdFromMessage } from '@task-tracker/shared/taskId';
import type { RecordCommitRequest, RecordResult } from '@task-tracker/shared';

export const ZERO_SHA = /^0+$/;

export interface PushRef {
  localRef: string;
  localSha: string;
  remoteRef: string;
  remoteSha: string;
}

/** Parses the lines git gives a pre-push hook on stdin. Deletions (local sha all zeros) are dropped. */
export function parsePushRefs(stdin: string): PushRef[] {
  return stdin
    .split('\n')
    .map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length === 4)
    .map(([localRef, localSha, remoteRef, remoteSha]) => ({ localRef, localSha, remoteRef, remoteSha }))
    .filter((r) => !ZERO_SHA.test(r.localSha));
}

export function branchName(ref: string): string {
  return ref.replace(/^refs\/heads\//, '');
}

export const LOG_FORMAT = '%H%x00%an%x00%ae%x00%cI%x00%B%x1e';

/** Parses `git log --format=LOG_FORMAT` output, keeping only commits that carry a task ID. */
export function parseLog(output: string, repo: string, branch: string): RecordCommitRequest[] {
  return output
    .split('\x1e')
    .map((r) => r.replace(/^\n/, ''))
    .filter(Boolean)
    .map((r) => {
      const [sha, authorName, authorEmail, date, ...rest] = r.split('\x00');
      return {
        sha,
        repo,
        branch,
        authorName,
        authorEmail,
        committedAt: new Date(date),
        message: rest.join('\x00').trim(),
      };
    })
    .filter((c) => c.sha && extractTaskIdFromMessage(c.message));
}

/** Hook output lines: how many commits were recorded, and why any were skipped. */
export function summarizeResults(results: RecordResult[]): string[] {
  const recorded = results.filter((r) => r.status === 'recorded').length;
  const lines: string[] = [];
  if (recorded) lines.push(`recorded ${recorded} commit(s) on the dashboard.`);
  for (const r of results) {
    if (r.status === 'skipped') lines.push(`skipped ${r.sha.slice(0, 7)}: ${r.reason}.`);
  }
  return lines;
}

/** Drops repeats of the same repo + sha (e.g. a queued commit pushed again), keeping the latest. */
export function dedupeCommits(commits: RecordCommitRequest[]): RecordCommitRequest[] {
  const byKey = new Map<string, RecordCommitRequest>();
  for (const c of commits) {
    const key = `${c.repo}@${c.sha.toLowerCase()}`;
    byKey.delete(key);
    byKey.set(key, c);
  }
  return [...byKey.values()];
}
