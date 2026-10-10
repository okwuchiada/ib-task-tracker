import { describe, expect, it } from 'vitest';
import { applyPrefix, isReplaceablePrefix } from './commitPrefix';

describe('applyPrefix', () => {
  it('fills an empty box', () => {
    expect(applyPrefix('', 'fix', 'IPO-Prod-fix-Q1')).toBe('fix(IPO-Prod-fix-Q1): ');
  });

  it('keeps text already typed', () => {
    expect(applyPrefix('Readjust layout', 'feat', 'IPO-Prod-fix-Q1')).toBe('feat(IPO-Prod-fix-Q1): Readjust layout');
  });

  it('replaces an existing prefix and keeps the body', () => {
    expect(applyPrefix('fix(IPO-Prod-fix-Q1): x\n\nbody', 'feat', 'IPO-Dev-feat-Q2')).toBe(
      'feat(IPO-Dev-feat-Q2): x\n\nbody',
    );
  });
});

describe('isReplaceablePrefix', () => {
  it.each([
    ['', true],
    ['fix(IPO-Prod-fix-Q1): ', true],
    ['fix(IPO-Prod-fix-Q1): started typing', false],
    ['some message', false],
  ])('%j -> %s', (input, expected) => {
    expect(isReplaceablePrefix(input)).toBe(expected);
  });
});
