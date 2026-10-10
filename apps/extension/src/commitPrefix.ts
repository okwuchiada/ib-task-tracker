import { buildCommitPrefix, COMMIT_SUBJECT_REGEX } from '@task-tracker/shared/taskId';

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
