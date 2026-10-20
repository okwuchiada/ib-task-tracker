export const TASK_TYPES = ['feat', 'fix', 'chore', 'refactor', 'docs', 'test', 'perf', 'hotfix'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const COMMIT_TYPES = [
  'feat',
  'fix',
  'chore',
  'refactor',
  'docs',
  'test',
  'perf',
  'style',
  'build',
  'ci',
  'revert',
  'hotfix',
] as const;
export type CommitType = (typeof COMMIT_TYPES)[number];

export const PROJECT_CODE_REGEX = /^[A-Z0-9]{2,10}$/;
export const ENVIRONMENT_NAME_REGEX = /^[A-Za-z]{2,20}$/;

const TASK_ID_BODY = `([A-Z0-9]{2,10})-([A-Za-z]{2,20})-(${TASK_TYPES.join('|')})-Q(\\d+)`;
/** Matches any task ID, including older ones with short numbers (e.g. Q1), so existing tasks can still be looked up. */
export const TASK_ID_REGEX = new RegExp(`^${TASK_ID_BODY}$`);
/** What new commits must use: exactly six digits after the Q. */
export const COMMIT_TASK_ID_REGEX = new RegExp(`^([A-Z0-9]{2,10})-([A-Za-z]{2,20})-(${TASK_TYPES.join('|')})-Q(\\d{6})$`);
const TASK_ID_ANYWHERE = new RegExp(`\\b${TASK_ID_BODY}\\b`);

/** `type(scope): subject` — the scope is validated separately so we can give a precise error. */
export const COMMIT_SUBJECT_REGEX = new RegExp(`^(${COMMIT_TYPES.join('|')})\\(([^)]*)\\): (.*)$`);

const EXEMPT_PREFIXES = ['Merge ', 'Revert "', 'fixup! ', 'squash! ', 'amend! '];

export interface TaskIdParts {
  projectCode: string;
  environment: string;
  type: TaskType;
  seq: number;
}

/** Task numbers are random 6-digit values, e.g. Q123450, so IDs don't reveal how many tasks exist. */
export const TASK_SEQ_MIN = 100000;
export const TASK_SEQ_MAX = 999999;

export function randomTaskSeq(): number {
  return TASK_SEQ_MIN + Math.floor(Math.random() * (TASK_SEQ_MAX - TASK_SEQ_MIN + 1));
}

export function buildTaskId(parts: TaskIdParts): string {
  if (!PROJECT_CODE_REGEX.test(parts.projectCode)) {
    throw new Error(`Invalid project code "${parts.projectCode}" (2-10 uppercase letters/digits)`);
  }
  if (!ENVIRONMENT_NAME_REGEX.test(parts.environment)) {
    throw new Error(`Invalid environment "${parts.environment}" (2-20 letters)`);
  }
  if (!TASK_TYPES.includes(parts.type)) {
    throw new Error(`Invalid task type "${parts.type}"`);
  }
  if (!Number.isInteger(parts.seq) || parts.seq < TASK_SEQ_MIN || parts.seq > TASK_SEQ_MAX) {
    throw new Error(`Invalid sequence ${parts.seq}`);
  }
  return `${parts.projectCode}-${parts.environment}-${parts.type}-Q${parts.seq}`;
}

export function parseTaskId(value: string): TaskIdParts | null {
  const m = TASK_ID_REGEX.exec(value);
  if (!m) return null;
  return { projectCode: m[1], environment: m[2], type: m[3] as TaskType, seq: Number(m[4]) };
}

export function isValidTaskId(value: string): boolean {
  return TASK_ID_REGEX.test(value);
}

export function buildCommitPrefix(commitType: string, taskId: string): string {
  return `${commitType}(${taskId}): `;
}

/** First non-comment, non-empty line of a commit message (what git uses as the subject). */
export function commitSubject(message: string): string {
  for (const line of message.split(/\r?\n/)) {
    if (line.startsWith('#')) continue;
    if (line.trim() === '') continue;
    return line.trim();
  }
  return '';
}

export type CommitCheck =
  | { ok: true; exempt: true }
  | { ok: true; commitType: CommitType; taskId: string }
  | { ok: false; reason: string };

export function checkCommitMessage(message: string): CommitCheck {
  const subject = commitSubject(message);
  if (EXEMPT_PREFIXES.some((p) => subject.startsWith(p))) {
    return { ok: true, exempt: true };
  }
  const m = COMMIT_SUBJECT_REGEX.exec(subject);
  if (!m) {
    return {
      ok: false,
      reason: `Commit message must look like "<type>(<TASK-ID>): <description>", e.g. "feat(IPO-Prod-fix-Q123450): Readjust the layout". Allowed types: ${COMMIT_TYPES.join(', ')}.`,
    };
  }
  const [, commitType, scope, description] = m;
  if (!COMMIT_TASK_ID_REGEX.test(scope)) {
    return {
      ok: false,
      reason: `"${scope}" is not a valid task ID. Expected <PROJECT>-<ENV>-<TYPE>-Q<6 digits>, e.g. IPO-Prod-fix-Q123450.`,
    };
  }
  if (description.trim() === '') {
    return { ok: false, reason: 'Commit description after the task ID is empty.' };
  }
  return { ok: true, commitType: commitType as CommitType, taskId: scope };
}

/** Finds a task ID anywhere in the subject line, so reverts of tagged commits still link to their task. */
export function extractTaskIdFromMessage(message: string): string | null {
  const m = TASK_ID_ANYWHERE.exec(commitSubject(message));
  return m ? m[0] : null;
}

/** Turns any git remote URL into a stable `host/owner/repo` key. */
export function normalizeRepoUrl(url: string): string {
  let s = url.trim();
  // scp-like syntax: git@host:owner/repo.git
  const scp = /^[^@/\s]+@([^:/\s]+):(?!\d+\/)(.+)$/.exec(s);
  if (scp) {
    s = `${scp[1]}/${scp[2]}`;
  } else {
    s = s.replace(/^[a-z+]+:\/\//i, ''); // scheme
    s = s.replace(/^[^@/]+@/, ''); // credentials
    s = s.replace(/^([^/:]+):\d+\//, '$1/'); // port
  }
  return s
    .replace(/\/+$/, '')
    .replace(/\.git$/i, '')
    .toLowerCase();
}

/** `-x` appends "(cherry picked from commit …)" so the copy can be recognised when it is pushed. */
export function buildCherryPickCommand(shas: string[]): string {
  return shas.length ? `git cherry-pick -x ${shas.join(' ')}` : '';
}

const CHERRY_PICK_TRAILER = /\(cherry picked from commit ([0-9a-f]{7,64})\)/i;

/** SHA of the original commit when this commit was made with `git cherry-pick -x`. */
export function extractCherryPickSource(message: string): string | null {
  const m = CHERRY_PICK_TRAILER.exec(message);
  return m ? m[1].toLowerCase() : null;
}
