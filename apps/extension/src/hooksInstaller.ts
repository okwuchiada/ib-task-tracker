import { execFile } from 'node:child_process';
import { chmod, copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
export const HOOK_MARKER = 'task-tracker-hook';
const HOOKS = ['commit-msg', 'pre-push'] as const;

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, { cwd });
  return stdout.trim();
}

async function exists(p: string): Promise<boolean> {
  return stat(p).then(
    () => true,
    () => false,
  );
}

function wrapperScript(hook: (typeof HOOKS)[number]): string {
  const run = `node "$(git rev-parse --git-common-dir)/task-tracker/${hook}.js" "$@"`;
  const orig = `"$(dirname "$0")/${hook}.task-tracker-orig"`;
  const guard = `command -v node >/dev/null 2>&1 || { echo "task-tracker: node not found, skipping" >&2; exit 0; }`;
  if (hook === 'pre-push') {
    // git sends the pushed refs on stdin; both the original hook and ours need them.
    return `#!/bin/sh
# ${HOOK_MARKER}: installed by the Task Tracker VS Code extension
INPUT=$(cat)
if [ -x ${orig} ]; then printf '%s\\n' "$INPUT" | ${orig} "$@" || exit $?; fi
${guard}
printf '%s\\n' "$INPUT" | ${run}
`;
  }
  return `#!/bin/sh
# ${HOOK_MARKER}: installed by the Task Tracker VS Code extension
if [ -x ${orig} ]; then ${orig} "$@" || exit $?; fi
${guard}
${run}
`;
}

export interface RepoHookInfo {
  commonDir: string;
  hooksDir: string;
  /** core.hooksPath points inside the work tree (husky, lefthook…): we won't write there. */
  managedHooksPath: boolean;
  installed: boolean;
}

export async function inspectRepo(root: string): Promise<RepoHookInfo> {
  const resolve = (p: string) => (isAbsolute(p) ? p : join(root, p));
  const commonDir = resolve(await git(root, ['rev-parse', '--git-common-dir']));
  const hooksDir = resolve(await git(root, ['rev-parse', '--git-path', 'hooks']));
  const hooksPath = await git(root, ['config', '--get', 'core.hooksPath']).catch(() => '');
  const managedHooksPath = !!hooksPath && !resolve(hooksPath).startsWith(commonDir);
  let installed = true;
  for (const hook of HOOKS) {
    const content = await readFile(join(hooksDir, hook), 'utf8').catch(() => '');
    if (!content.includes(HOOK_MARKER) && !content.includes('task-tracker/')) installed = false;
  }
  return { commonDir, hooksDir, managedHooksPath, installed };
}

/** Copies the bundled hook scripts into <git-common-dir>/task-tracker. Safe to run on every activation. */
export async function copyHookScripts(extensionDistDir: string, commonDir: string): Promise<void> {
  const target = join(commonDir, 'task-tracker');
  await mkdir(target, { recursive: true });
  for (const hook of HOOKS) {
    await copyFile(join(extensionDistDir, 'hooks', `${hook}.js`), join(target, `${hook}.js`));
  }
}

export type InstallResult = { kind: 'installed' } | { kind: 'manual'; snippet: string };

export async function installHooks(root: string, extensionDistDir: string): Promise<InstallResult> {
  const info = await inspectRepo(root);
  await copyHookScripts(extensionDistDir, info.commonDir);

  if (info.managedHooksPath) {
    // Hooks are committed to the repo (e.g. .husky/). Ask the developer to add one line to each.
    return {
      kind: 'manual',
      snippet: [
        '# .husky/commit-msg (or your hook manager equivalent)',
        'node "$(git rev-parse --git-common-dir)/task-tracker/commit-msg.js" "$1"',
        '',
        '# .husky/pre-push',
        'node "$(git rev-parse --git-common-dir)/task-tracker/pre-push.js" "$@"',
      ].join('\n'),
    };
  }

  await mkdir(info.hooksDir, { recursive: true });
  for (const hook of HOOKS) {
    const path = join(info.hooksDir, hook);
    const current = await readFile(path, 'utf8').catch(() => null);
    if (current !== null && !current.includes(HOOK_MARKER)) {
      // Keep the existing hook and chain to it.
      const origPath = `${path}.task-tracker-orig`;
      if (!(await exists(origPath))) await rename(path, origPath);
    }
    await writeFile(path, wrapperScript(hook));
    await chmod(path, 0o755);
  }
  return { kind: 'installed' };
}
