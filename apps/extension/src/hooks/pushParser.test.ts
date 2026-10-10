import { describe, expect, it } from 'vitest';
import { branchName, dedupeCommits, parseLog, parsePushRefs, summarizeResults } from './pushParser';

const Z = '0'.repeat(40);

describe('parsePushRefs', () => {
  it('parses refs and drops deletions', () => {
    const stdin = `refs/heads/main aaa refs/heads/main bbb\n(delete) ${Z} refs/heads/old ccc\n`;
    expect(parsePushRefs(stdin)).toEqual([
      { localRef: 'refs/heads/main', localSha: 'aaa', remoteRef: 'refs/heads/main', remoteSha: 'bbb' },
    ]);
  });
});

describe('branchName', () => {
  it('strips refs/heads/', () => {
    expect(branchName('refs/heads/feature/x')).toBe('feature/x');
  });
});

describe('parseLog', () => {
  it('keeps only commits with a task id', () => {
    const out =
      'abc\x00Ada\x00ada@x.io\x002026-10-10T10:00:00+01:00\x00feat(IPO-Prod-fix-Q1): one\n\nbody\n\x1e\n' +
      "def\x00Ada\x00ada@x.io\x002026-10-10T11:00:00+01:00\x00Merge branch 'main'\n\x1e\n";
    const commits = parseLog(out, 'git@github.com:o/r.git', 'main');
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({
      sha: 'abc',
      repo: 'git@github.com:o/r.git',
      branch: 'main',
      authorEmail: 'ada@x.io',
      message: 'feat(IPO-Prod-fix-Q1): one\n\nbody',
    });
    expect(commits[0].committedAt.toISOString()).toBe('2026-10-10T09:00:00.000Z');
  });
});

describe('summarizeResults', () => {
  it('counts recorded commits and lists skipped ones with the reason', () => {
    expect(
      summarizeResults([
        { sha: 'aaaaaaaaaa', status: 'recorded', taskId: 'IPO-Prod-fix-Q1' },
        { sha: 'bbbbbbbbbb', status: 'skipped', reason: 'unknown task IPO-Prod-fix-Q9' },
      ]),
    ).toEqual(['recorded 1 commit(s) on the dashboard.', 'skipped bbbbbbb: unknown task IPO-Prod-fix-Q9.']);
  });

  it('says nothing when there were no results', () => {
    expect(summarizeResults([])).toEqual([]);
  });
});

describe('dedupeCommits', () => {
  it('keeps one entry per repo + sha, the latest one', () => {
    const c = (sha: string, repo: string, branch: string) =>
      ({ sha, repo, branch, message: 'm', committedAt: new Date(0) }) as const;
    expect(dedupeCommits([c('aaa', 'r1', 'old'), c('bbb', 'r1', 'x'), c('AAA', 'r1', 'new'), c('aaa', 'r2', 'y')])).toEqual([
      c('bbb', 'r1', 'x'),
      c('AAA', 'r1', 'new'),
      c('aaa', 'r2', 'y'),
    ]);
  });
});
