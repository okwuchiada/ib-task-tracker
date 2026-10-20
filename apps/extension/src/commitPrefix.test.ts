import { describe, expect, it } from 'vitest';
import { addTaskId, applyPrefix, hasTaskIdPrefix, isReplaceablePrefix, wasReplacedWithoutTaskId } from './commitPrefix';

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

const ID = 'TT-Dev-feat-Q814727';

describe('hasTaskIdPrefix', () => {
  it.each([
    [`feat(${ID}): x`, true],
    ['feat(ui): x', false],
    ['feat: x', false],
    ['Add a toggle', false],
  ])('%j -> %s', (input, expected) => {
    expect(hasTaskIdPrefix(input)).toBe(expected);
  });
});

describe('addTaskId', () => {
  it('adds the task type to a plain generated message', () => {
    expect(addTaskId('Add dark mode toggle', 'feat', ID)).toBe(`feat(${ID}): Add dark mode toggle`);
  });

  it("keeps the generator's conventional type", () => {
    expect(addTaskId('fix: handle empty box', 'feat', ID)).toBe(`fix(${ID}): handle empty box`);
  });

  it('replaces a generated scope and drops the breaking-change mark', () => {
    expect(addTaskId('refactor(ui)!: split header', 'feat', ID)).toBe(`refactor(${ID}): split header`);
  });

  it('keeps the body', () => {
    expect(addTaskId('Add toggle\n\n- header button\n- saved per browser', 'feat', ID)).toBe(
      `feat(${ID}): Add toggle\n\n- header button\n- saved per browser`,
    );
  });

  it('skips a leading blank line', () => {
    expect(addTaskId('\nAdd toggle', 'feat', ID)).toBe(`feat(${ID}): Add toggle`);
  });
});

describe('wasReplacedWithoutTaskId', () => {
  const prefix = `feat(${ID}): `;

  it('catches a generated message replacing the prefix', () => {
    expect(wasReplacedWithoutTaskId(prefix, 'feat: add dark mode toggle')).toBe(true);
  });

  it('catches a generated message in an empty box', () => {
    expect(wasReplacedWithoutTaskId('', 'Add dark mode toggle')).toBe(true);
  });

  it('catches a message streamed in over a restored prefix', () => {
    expect(wasReplacedWithoutTaskId(`${prefix}Add dark`, 'Add dark mode')).toBe(true);
  });

  it('leaves the developer deleting the prefix one character at a time', () => {
    expect(wasReplacedWithoutTaskId(prefix, prefix.slice(0, -2))).toBe(false);
    expect(wasReplacedWithoutTaskId(`feat(${ID}):`, `feat(${ID}`)).toBe(false);
  });

  it('leaves the developer editing the type inside the prefix', () => {
    expect(wasReplacedWithoutTaskId(prefix, `fat(${ID}): `)).toBe(false);
  });

  it('leaves the developer selecting the whole prefix and typing over it', () => {
    expect(wasReplacedWithoutTaskId(prefix, 'W')).toBe(false);
  });

  it('leaves the developer typing into an empty box', () => {
    expect(wasReplacedWithoutTaskId('', 'A')).toBe(false);
  });

  it('leaves a message the developer already wrote without an ID', () => {
    expect(wasReplacedWithoutTaskId('my own message', 'my own message, longer')).toBe(false);
  });

  it('does nothing once the ID is there', () => {
    expect(wasReplacedWithoutTaskId(prefix, `${prefix}Add toggle`)).toBe(false);
  });
});
