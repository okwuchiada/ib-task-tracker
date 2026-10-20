/**
 * CI check: every non-merge commit in a git range must follow `type(TASK-ID): description`,
 * using the same rule as the commit-msg hook. Runs with plain Node (type stripping), no install needed.
 *
 *   node scripts/check-commit-messages.mts <base>..<head>
 */
import { execFileSync } from 'node:child_process';
import { checkCommitMessage } from '../packages/shared/src/taskId.ts';

const range = process.argv[2];
if (!range) {
  console.error('usage: node scripts/check-commit-messages.mts <base>..<head>');
  process.exit(2);
}

const log = execFileSync('git', ['log', '--no-merges', '--format=%H%x00%B%x1e', range], { encoding: 'utf8' });
const commits = log
  .split('\x1e')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [sha, message] = entry.split('\x00');
    return { sha, message };
  });

let failures = 0;
for (const { sha, message } of commits) {
  const check = checkCommitMessage(message);
  if (check.ok) continue;
  failures++;
  const subject = message.split('\n')[0];
  // ::error:: shows the message as an annotation on the workflow run.
  console.log(`::error title=Bad commit message ${sha.slice(0, 7)}::"${subject}" - ${check.reason}`);
}

console.log(`Checked ${commits.length} commit(s) in ${range}: ${failures} failed.`);
if (failures) {
  console.log('Fix them with "git rebase -i" (reword) and force-push.');
  process.exit(1);
}
