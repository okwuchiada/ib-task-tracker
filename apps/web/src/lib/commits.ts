import type { User } from '@prisma/client';
import {
  extractCherryPickSource,
  extractTaskIdFromMessage,
  normalizeRepoUrl,
  type RecordCommitRequest,
  type RecordResult,
} from '@task-tracker/shared';
import { prisma } from './db';

/**
 * Links pushed commits to their tasks. Commits without a task ID (merges etc.) or with an
 * unknown ID are skipped rather than failing the batch, so a push is never blocked by this.
 */
export async function recordCommits(user: User, commits: RecordCommitRequest[]): Promise<RecordResult[]> {
  const results: RecordResult[] = [];
  const taskCache = new Map<string, string | null>();

  for (const c of commits) {
    const taskId = extractTaskIdFromMessage(c.message);
    if (!taskId) {
      results.push({ sha: c.sha, status: 'skipped', reason: 'no task ID' });
      continue;
    }
    if (!taskCache.has(taskId)) {
      const task = await prisma.task.findUnique({ where: { taskId }, select: { id: true } });
      taskCache.set(taskId, task?.id ?? null);
    }
    const taskRef = taskCache.get(taskId);
    if (!taskRef) {
      results.push({ sha: c.sha, status: 'skipped', reason: `unknown task ${taskId}` });
      continue;
    }

    const sha = c.sha.toLowerCase();
    const repo = normalizeRepoUrl(c.repo);
    await prisma.commit.upsert({
      where: { repo_sha: { repo, sha } },
      // The first branch a commit was pushed to is where it originated; keep it.
      update: { message: c.message, taskRef },
      create: {
        sha,
        repo,
        branch: c.branch,
        message: c.message,
        authorName: c.authorName ?? null,
        authorEmail: c.authorEmail ?? null,
        cherryPickOf: extractCherryPickSource(c.message),
        committedAt: c.committedAt,
        taskRef,
        recordedById: user.id,
      },
    });
    results.push({ sha, status: 'recorded', taskId });
  }
  return results;
}
