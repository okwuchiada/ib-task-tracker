import { describe, expect, it } from 'vitest';
import { planCherryPick, type PickCommit } from './cherryPick';

const c = (sha: string, repo: string, day: number, extra: Partial<PickCommit> = {}): PickCommit => ({
  sha,
  repo,
  branch: 'main',
  message: `feat(IPO-Prod-fix-Q1): ${sha}`,
  committedAt: new Date(2026, 0, day),
  taskId: 'IPO-Prod-fix-Q1',
  cherryPickOf: null,
  ...extra,
});

describe('planCherryPick', () => {
  it('groups by repo and sorts oldest first', () => {
    const plan = planCherryPick([c('b', 'r1', 3), c('a', 'r1', 1), c('z', 'r0', 2)]);
    expect(plan.map((p) => p.repo)).toEqual(['r0', 'r1']);
    expect(plan[1].commits.map((x) => x.sha)).toEqual(['a', 'b']);
  });

  it('separates commits that are already cherry-picks', () => {
    const plan = planCherryPick([c('a', 'r1', 1), c('a2', 'r1', 5, { cherryPickOf: 'a' })]);
    expect(plan[0].commits.map((x) => x.sha)).toEqual(['a']);
    expect(plan[0].copies.map((x) => x.sha)).toEqual(['a2']);
  });

  it('drops duplicates', () => {
    const plan = planCherryPick([c('a', 'r1', 1), c('a', 'r1', 1, { taskId: 'IPO-Prod-fix-Q2' })]);
    expect(plan[0].commits).toHaveLength(1);
  });
});
