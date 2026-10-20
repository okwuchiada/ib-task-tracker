import { buildCommitPrefix, COMMIT_SUBJECT_REGEX, COMMIT_TYPES, isValidTaskId } from '@task-tracker/shared/taskId';

/**
 * Puts `type(TASK-ID): ` at the start of the commit message, replacing an existing prefix
 * and keeping whatever the developer already typed after it.
 */
export function applyPrefix(current: string, commitType: string, taskId: string): string {
  const prefix = buildCommitPrefix(commitType, taskId);
  const [first = '', ...rest] = current.split('\n');
  const m = COMMIT_SUBJECT_REGEX.exec(first);
  const subject = m ? m[3] : first.replace(/^\s+/, '');
  return [prefix + subject, ...rest].join('\n');
}

/** True when the message is empty or only holds a prefix for some other task. */
export function isReplaceablePrefix(current: string): boolean {
  if (current.trim() === '') return true;
  const m = COMMIT_SUBJECT_REGEX.exec(current);
  return !!m && m[3].trim() === '' && !current.includes('\n');
}

/** True when the subject line already carries `type(TASK-ID): `. */
export function hasTaskIdPrefix(message: string): boolean {
  const m = COMMIT_SUBJECT_REGEX.exec(message.split('\n')[0]);
  return !!m && isValidTaskId(m[2]);
}

/** `feat: x`, `fix(ui): x`, `feat!: x` — the conventional-commit prefix generators like to write. */
const CONVENTIONAL_PREFIX = new RegExp(`^(${COMMIT_TYPES.join('|')})(\\([^)]*\\))?!?:\\s*`);

/**
 * Puts the task ID into a message that was written without it (e.g. by the commit message generator).
 * A conventional type the generator chose is kept and only its scope is replaced; otherwise the task type is used.
 */
export function addTaskId(message: string, taskType: string, taskId: string): string {
  const [first = '', ...rest] = message.replace(/^\s*\n/, '').split('\n');
  const subject = first.trim();
  const m = CONVENTIONAL_PREFIX.exec(subject);
  const line = m
    ? buildCommitPrefix(m[1], taskId) + subject.slice(m[0].length)
    : buildCommitPrefix(taskType, taskId) + subject;
  return [line, ...rest].join('\n');
}

/** Up to this many new characters between two looks at the box is the developer typing, not a generator. */
const TYPING_DELTA = 3;

/** How many characters `current` adds over `previous`, ignoring the parts both share at the start and end. */
function insertedLength(previous: string, current: string): number {
  let start = 0;
  while (start < previous.length && start < current.length && previous[start] === current[start]) start++;
  let end = 0;
  while (
    end < previous.length - start &&
    end < current.length - start &&
    previous[previous.length - 1 - end] === current[current.length - 1 - end]
  ) {
    end++;
  }
  return current.length - start - end;
}

/**
 * True when the box held the task prefix (or nothing) and something replaced it in one go with a
 * message that has no task ID: the commit message generator, or a paste. Deleting the prefix or
 * typing over it by hand is left alone.
 */
export function wasReplacedWithoutTaskId(previous: string, current: string): boolean {
  if (current.trim() === '' || hasTaskIdPrefix(current)) return false;
  if (previous.trim() !== '' && !hasTaskIdPrefix(previous)) return false;
  return insertedLength(previous, current) > TYPING_DELTA;
}
