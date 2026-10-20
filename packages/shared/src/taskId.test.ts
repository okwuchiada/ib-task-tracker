import { describe, expect, it } from 'vitest';
import {
  buildCherryPickCommand,
  buildCommitPrefix,
  buildTaskId,
  extractCherryPickSource,
  checkCommitMessage,
  extractTaskIdFromMessage,
  normalizeRepoUrl,
  parseTaskId,
  randomTaskSeq,
  TASK_SEQ_MAX,
  TASK_SEQ_MIN,
} from './taskId';

describe('randomTaskSeq', () => {
  it('returns a 6-digit number', () => {
    for (let i = 0; i < 1000; i++) {
      const seq = randomTaskSeq();
      expect(Number.isInteger(seq)).toBe(true);
      expect(seq).toBeGreaterThanOrEqual(TASK_SEQ_MIN);
      expect(seq).toBeLessThanOrEqual(TASK_SEQ_MAX);
    }
  });
});

describe('buildTaskId', () => {
  it('builds the documented format', () => {
    expect(buildTaskId({ projectCode: 'IPO', environment: 'Prod', type: 'fix', seq: 123450 })).toBe(
      'IPO-Prod-fix-Q123450',
    );
  });

  it('rejects a number that is not six digits', () => {
    expect(() => buildTaskId({ projectCode: 'IPO', environment: 'Prod', type: 'fix', seq: 1234 })).toThrow();
  });

  it('rejects an unknown task type', () => {
    expect(() =>
      buildTaskId({ projectCode: 'IPO', environment: 'Prod', type: 'oops' as never, seq: 1 }),
    ).toThrow();
  });

  it('rejects a lowercase project code', () => {
    expect(() => buildTaskId({ projectCode: 'ipo', environment: 'Prod', type: 'fix', seq: 1 })).toThrow();
  });
});

describe('parseTaskId', () => {
  it('parses a valid id', () => {
    expect(parseTaskId('IPO-Prod-fix-Q1234')).toEqual({
      projectCode: 'IPO',
      environment: 'Prod',
      type: 'fix',
      seq: 1234,
    });
  });

  it('returns null for garbage', () => {
    expect(parseTaskId('IPO-Prod-fix-1234')).toBeNull();
    expect(parseTaskId('IPO-Prod-nope-Q1')).toBeNull();
    expect(parseTaskId('')).toBeNull();
  });
});

describe('checkCommitMessage', () => {
  it('accepts the documented example', () => {
    const r = checkCommitMessage('feat(IPO-Prod-fix-Q123450): Readjust the layout of invest app');
    expect(r).toEqual({ ok: true, commitType: 'feat', taskId: 'IPO-Prod-fix-Q123450' });
  });

  it.each(['Q1', 'Q12345', 'Q1234567'])('rejects a task number that is not six digits (%s)', (q) => {
    expect(checkCommitMessage(`feat(IPO-Prod-fix-${q}): x`).ok).toBe(false);
  });

  it('allows a commit type different from the task type', () => {
    expect(checkCommitMessage('chore(IPO-Prod-fix-Q123450): bump deps').ok).toBe(true);
  });

  it('only looks at the first line', () => {
    expect(checkCommitMessage('fix(IPO-Dev-feat-Q900001): subject\n\nbody text').ok).toBe(true);
  });

  it('ignores git comment lines', () => {
    expect(checkCommitMessage('# Please enter\nfix(IPO-Dev-feat-Q900001): subject').ok).toBe(true);
  });

  it('rejects a missing task id', () => {
    const r = checkCommitMessage('feat: no task');
    expect(r.ok).toBe(false);
  });

  it('rejects a malformed task id', () => {
    const r = checkCommitMessage('feat(IPO-1234): bad id');
    expect(r).toMatchObject({ ok: false });
  });

  it('rejects an empty subject', () => {
    expect(checkCommitMessage('feat(IPO-Prod-fix-Q123450): ').ok).toBe(false);
  });

  it.each([
    "Merge branch 'main' into feature",
    'Merge pull request #12 from org/branch',
    'Revert "feat(IPO-Prod-fix-Q1): x"',
    'fixup! feat(IPO-Prod-fix-Q1): x',
    'squash! something',
    'amend! something',
  ])('exempts %s', (msg) => {
    expect(checkCommitMessage(msg)).toMatchObject({ ok: true, exempt: true });
  });
});

describe('extractTaskIdFromMessage', () => {
  it('finds the id in a conventional subject', () => {
    expect(extractTaskIdFromMessage('feat(IPO-Prod-fix-Q12): x')).toBe('IPO-Prod-fix-Q12');
  });

  it('finds the id in a revert of a tagged commit', () => {
    expect(extractTaskIdFromMessage('Revert "feat(IPO-Prod-fix-Q12): x"')).toBe('IPO-Prod-fix-Q12');
  });

  it('returns null when there is none', () => {
    expect(extractTaskIdFromMessage('Merge branch main')).toBeNull();
  });
});

describe('buildCommitPrefix', () => {
  it('builds type(id): ', () => {
    expect(buildCommitPrefix('feat', 'IPO-Prod-fix-Q1')).toBe('feat(IPO-Prod-fix-Q1): ');
  });
});

describe('normalizeRepoUrl', () => {
  it.each([
    ['git@github.com:Org/Repo.git', 'github.com/org/repo'],
    ['https://github.com/Org/Repo.git', 'github.com/org/repo'],
    ['https://user:token@github.com/org/repo', 'github.com/org/repo'],
    ['ssh://git@gitlab.example.com:2222/team/app.git', 'gitlab.example.com/team/app'],
    ['https://github.com/org/repo/', 'github.com/org/repo'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeRepoUrl(input)).toBe(expected);
  });
});

describe('buildCherryPickCommand', () => {
  it('joins shas in the given order', () => {
    expect(buildCherryPickCommand(['aaa', 'bbb'])).toBe('git cherry-pick -x aaa bbb');
  });

  it('returns empty string for no shas', () => {
    expect(buildCherryPickCommand([])).toBe('');
  });
});

describe('extractCherryPickSource', () => {
  it('reads the -x trailer', () => {
    const msg = 'feat(IPO-Prod-fix-Q1): x\n\n(cherry picked from commit ABCDEF1234567)';
    expect(extractCherryPickSource(msg)).toBe('abcdef1234567');
  });

  it('returns null without a trailer', () => {
    expect(extractCherryPickSource('feat(IPO-Prod-fix-Q1): x')).toBeNull();
  });
});
