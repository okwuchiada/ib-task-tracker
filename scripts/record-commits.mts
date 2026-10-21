/**
 * CI: sends every commit in a git range that carries a task ID to the dashboard, like the pre-push hook,
 * so commits are recorded even when the pusher has no hooks installed. The server upserts by repo + SHA,
 * so commits the hook already sent are harmless. Runs with plain Node (type stripping), no install needed.
 *
 *   TASK_TRACKER_URL=… TASK_TRACKER_TOKEN=… REPO_URL=… BRANCH=… node scripts/record-commits.mts <base>..<head>
 */
import { execFileSync } from 'node:child_process';
import { extractTaskIdFromMessage } from '../packages/shared/src/taskId.ts';

const BATCH = 500;

const range = process.argv[2];
const { TASK_TRACKER_URL, TASK_TRACKER_TOKEN, REPO_URL, BRANCH = '' } = process.env;
if (!range || !TASK_TRACKER_URL || !TASK_TRACKER_TOKEN || !REPO_URL) {
  console.error('usage: TASK_TRACKER_URL=… TASK_TRACKER_TOKEN=… REPO_URL=… [BRANCH=…] node scripts/record-commits.mts <base>..<head>');
  process.exit(2);
}

const log = execFileSync('git', ['log', '--format=%H%x00%an%x00%ae%x00%cI%x00%B%x1e', range], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const commits = log
  .split('\x1e')
  .map((entry) => entry.replace(/^\n/, ''))
  .filter(Boolean)
  .map((entry) => {
    const [sha, authorName, authorEmail, committedAt, ...rest] = entry.split('\x00');
    return { sha, repo: REPO_URL, branch: BRANCH, authorName, authorEmail, committedAt, message: rest.join('\x00').trim() };
  })
  .filter((c) => extractTaskIdFromMessage(c.message))
  .reverse(); // oldest first, like the hook

if (!commits.length) {
  console.log(`No commits with a task ID in ${range}.`);
  process.exit(0);
}

let recorded = 0;
for (let i = 0; i < commits.length; i += BATCH) {
  const res = await fetch(`${TASK_TRACKER_URL.replace(/\/+$/, '')}/api/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TASK_TRACKER_TOKEN}` },
    body: JSON.stringify({ commits: commits.slice(i, i + BATCH) }),
  });
  if (!res.ok) {
    console.log(`::error title=Task Tracker::Server returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  const { results = [] } = (await res.json()) as {
    results?: { sha: string; status: 'recorded' | 'skipped'; taskId?: string; reason?: string }[];
  };
  for (const r of results) {
    if (r.status === 'recorded') recorded++;
    // ::warning:: shows as an annotation on the run, e.g. a typo in a task ID.
    else console.log(`::warning title=Commit not recorded::${r.sha.slice(0, 7)}: ${r.reason}`);
  }
}
console.log(`Recorded ${recorded} of ${commits.length} commit(s) with a task ID in ${range}.`);
