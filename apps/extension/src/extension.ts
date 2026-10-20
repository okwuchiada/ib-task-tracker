import { hostname } from 'node:os';
import { join } from 'node:path';
import type { ApiTask } from '@task-tracker/shared';
import * as vscode from 'vscode';
import { ApiClient, ApiError } from './api';
import { applyPrefix, isReplaceablePrefix } from './commitPrefix';
import { deleteCredentials, readCredentials, writeCredentials } from './credentials';
import type { API as GitAPI, GitExtension, Repository } from './git';
import { copyHookScripts, inspectRepo, installHooks } from './hooksInstaller';

const SECRET_KEY = 'taskTracker.apiToken';
const ACTIVE_TASK_KEY = 'taskTracker.activeTask';
const HOOKS_PROMPTED_KEY = 'taskTracker.hooksPrompted';

let context: vscode.ExtensionContext;
let statusBar: vscode.StatusBarItem;
let git: GitAPI | undefined;

function serverUrl(): string {
  return vscode.workspace.getConfiguration('taskTracker').get<string>('serverUrl', 'https://ib-task-tracker-lilac.vercel.app').replace(/\/+$/, '');
}

async function client(requireAuth = true): Promise<ApiClient> {
  const token = await context.secrets.get(SECRET_KEY);
  if (!token && requireAuth) {
    const choice = await vscode.window.showWarningMessage('Task Tracker: you are not signed in.', 'Sign In');
    if (choice === 'Sign In') await signIn();
    const fresh = await context.secrets.get(SECRET_KEY);
    if (!fresh) throw new Error('Not signed in');
    return new ApiClient(serverUrl(), fresh);
  }
  return new ApiClient(serverUrl(), token);
}

// ---------- active task ----------

function activeTask(): ApiTask | undefined {
  return context.workspaceState.get<ApiTask>(ACTIVE_TASK_KEY);
}

async function setActiveTask(task: ApiTask | undefined) {
  const previous = activeTask();
  await context.workspaceState.update(ACTIVE_TASK_KEY, task);
  updateStatusBar();
  if (task) prefillAll(previous?.taskId !== task.taskId);
}

function updateStatusBar() {
  const task = activeTask();
  statusBar.text = task ? `$(tag) ${task.taskId}` : '$(tag) No task';
  statusBar.tooltip = task
    ? new vscode.MarkdownString(`**${task.taskId}**\n\n${task.title}\n\n_Click to switch task_`)
    : 'Task Tracker: click to select or create a task';
  statusBar.show();
}

// ---------- commit message ----------

function prefillRepo(repo: Repository, force: boolean) {
  const task = activeTask();
  const enabled = vscode.workspace.getConfiguration('taskTracker').get<boolean>('prefillCommitMessage', true);
  if (!task || !enabled) return;
  const current = repo.inputBox.value;
  // On a task switch, swap the prefix but keep what was typed; otherwise only fill an empty box.
  if (force || isReplaceablePrefix(current)) {
    const next = applyPrefix(current, task.type, task.taskId);
    if (next !== current) repo.inputBox.value = next;
  }
}

function prefillAll(force: boolean) {
  git?.repositories.forEach((r) => prefillRepo(r, force));
}

function watchRepository(repo: Repository) {
  // After a commit the input box is cleared; put the prefix back.
  context.subscriptions.push(repo.state.onDidChange(() => prefillRepo(repo, false)));
  prefillRepo(repo, false);
  void maybePromptHooks(repo);
}

async function insertTaskId() {
  let task = activeTask();
  if (!task) {
    await selectTask();
    task = activeTask();
    if (!task) return;
  }
  const repos = git?.repositories ?? [];
  if (!repos.length) {
    await vscode.env.clipboard.writeText(task.taskId);
    vscode.window.showInformationMessage(`No Git repository open. Copied ${task.taskId} to the clipboard.`);
    return;
  }
  for (const repo of repos) repo.inputBox.value = applyPrefix(repo.inputBox.value, task.type, task.taskId);
  void vscode.commands.executeCommand('workbench.view.scm');
}

// ---------- auth ----------

async function signIn(): Promise<boolean> {
  try {
    const session = await vscode.authentication.getSession('github', ['read:user', 'read:org'], { createIfNone: true });
    const { apiToken, user } = await new ApiClient(serverUrl()).exchangeGithubToken(session.accessToken, hostname());
    await context.secrets.store(SECRET_KEY, apiToken);
    writeCredentials({ serverUrl: serverUrl(), token: apiToken, login: user.login });
    vscode.window.showInformationMessage(`Task Tracker: signed in as ${user.login}${user.role === 'ADMIN' ? ' (admin)' : ''}.`);
    return true;
  } catch (err) {
    showError(err, 'Sign-in failed');
    return false;
  }
}

async function signOut() {
  await context.secrets.delete(SECRET_KEY);
  deleteCredentials();
  await setActiveTask(undefined);
  vscode.window.showInformationMessage('Task Tracker: signed out. Revoke old tokens on the dashboard under your profile.');
}

// ---------- tasks ----------

async function createTask() {
  const api = await client();
  const meta = await withProgress('Loading projects…', () => api.meta());
  if (!meta.projects.length) {
    vscode.window.showWarningMessage('No projects exist yet. Ask an admin to add one on the dashboard.');
    return;
  }

  const project = await vscode.window.showQuickPick(
    meta.projects.map((p) => ({ label: p.code, description: p.name, id: p.id })),
    { title: 'Create task (1/4): project', placeHolder: 'Project' },
  );
  if (!project) return;

  const env = await vscode.window.showQuickPick(
    meta.environments.map((e) => ({ label: e.name, id: e.id })),
    { title: 'Create task (2/4): environment', placeHolder: 'Environment' },
  );
  if (!env) return;

  const type = await vscode.window.showQuickPick(meta.taskTypes, { title: 'Create task (3/4): type', placeHolder: 'fix, feat…' });
  if (!type) return;

  const title = await vscode.window.showInputBox({
    title: 'Create task (4/4): title',
    prompt: `${project.label}-${env.label}-${type}-Q…`,
    placeHolder: 'Readjust the layout of invest app',
    validateInput: (v) => (v.trim().length < 3 ? 'At least 3 characters' : undefined),
  });
  if (!title) return;

  const groupId = await pickGroup(api, true);
  if (groupId === null) return; // cancelled

  const { task } = await withProgress('Creating task…', () =>
    api.createTask({
      projectId: project.id,
      environmentId: env.id,
      type: type as never,
      title: title.trim(),
      groupId: groupId || undefined,
    }),
  );
  await setActiveTask(task);
  await vscode.env.clipboard.writeText(task.taskId);
  const choice = await vscode.window.showInformationMessage(
    `Created ${task.taskId} (copied to clipboard). It is now your active task.`,
    'Open in Dashboard',
  );
  if (choice) void vscode.env.openExternal(vscode.Uri.parse(`${serverUrl()}/tasks/${task.taskId}`));
}

/** Returns a group id, '' for "no group", or null if cancelled. */
async function pickGroup(api: ApiClient, optional: boolean): Promise<string | null> {
  const { groups } = await api.openGroups();
  type Item = vscode.QuickPickItem & { id: string };
  const items: Item[] = [
    ...(optional ? [{ label: '$(dash) No group', id: '' }] : []),
    { label: '$(add) New group…', id: '__new__' },
    ...groups.map((g) => ({ label: g.name, description: `${g.taskCount} task(s)`, id: g.id })),
  ];
  const picked = await vscode.window.showQuickPick(items, {
    title: optional ? 'Add to a group? (optional)' : 'Add to group',
    placeHolder: 'Groups bundle related tasks for cherry-picking',
  });
  if (!picked) return null;
  if (picked.id !== '__new__') return picked.id;
  const name = await vscode.window.showInputBox({
    title: 'New group name',
    placeHolder: 'Release 2026-10-15',
    validateInput: (v) => (v.trim().length < 2 ? 'At least 2 characters' : undefined),
  });
  if (!name) return null;
  const { group } = await api.createGroup(name.trim());
  return group.id;
}

async function selectTask() {
  const api = await client();
  const { tasks } = await withProgress('Loading your tasks…', () => api.myOpenTasks());
  type Item = vscode.QuickPickItem & { task?: ApiTask; action?: 'create' | 'clear' | 'byId' };
  const items: Item[] = [
    { label: '$(add) Create new task…', action: 'create' },
    { label: '$(search) Use a task ID…', description: "e.g. a teammate's task", action: 'byId' },
    ...(activeTask() ? [{ label: '$(close) Clear active task', action: 'clear' as const }] : []),
    { label: 'Your open tasks', kind: vscode.QuickPickItemKind.Separator },
    ...tasks.map((t) => ({
      label: t.taskId,
      description: t.title,
      detail: `${t.project.name} · ${new Date(t.createdAt).toLocaleDateString()}`,
      task: t,
    })),
  ];
  const picked = await vscode.window.showQuickPick(items, { title: 'Select task', matchOnDescription: true });
  if (!picked) return;
  if (picked.action === 'create') return createTask();
  if (picked.action === 'clear') return setActiveTask(undefined);
  if (picked.action === 'byId') {
    const id = await vscode.window.showInputBox({ title: 'Task ID', placeHolder: 'IPO-Prod-fix-Q1234' });
    if (!id) return;
    const { task } = await api.getTask(id.trim());
    return setActiveTask(task);
  }
  if (picked.task) await setActiveTask(picked.task);
}

async function markDone() {
  const task = activeTask();
  if (!task) return vscode.window.showInformationMessage('No active task.');
  const ok = await vscode.window.showWarningMessage(`Mark ${task.taskId} as done?`, { modal: true }, 'Mark done');
  if (!ok) return;
  const api = await client();
  await api.updateTaskStatus(task.taskId, 'DONE');
  await setActiveTask(undefined);
  vscode.window.showInformationMessage(`${task.taskId} marked done.`);
}

async function addToGroup() {
  const task = activeTask();
  if (!task) return vscode.window.showInformationMessage('Select a task first.');
  const api = await client();
  const groupId = await pickGroup(api, false);
  if (!groupId) return;
  await api.addTaskToGroup(groupId, task.taskId);
  vscode.window.showInformationMessage(`${task.taskId} added to group.`);
}

// ---------- hooks ----------

function distDir() {
  return join(context.extensionPath, 'dist');
}

async function installHooksCommand(repo?: Repository) {
  const repos = repo ? [repo] : (git?.repositories ?? []);
  if (!repos.length) return vscode.window.showWarningMessage('Open a Git repository first.');
  for (const r of repos) {
    const result = await installHooks(r.rootUri.fsPath, distDir());
    if (result.kind === 'installed') {
      vscode.window.showInformationMessage(`Task Tracker hooks installed in ${r.rootUri.fsPath}.`);
    } else {
      const doc = await vscode.workspace.openTextDocument({ content: result.snippet, language: 'shellscript' });
      await vscode.window.showTextDocument(doc);
      vscode.window.showWarningMessage(
        'This repo manages git hooks itself (core.hooksPath, e.g. husky). Add the lines shown to your hook files.',
      );
    }
  }
}

async function maybePromptHooks(repo: Repository) {
  const root = repo.rootUri.fsPath;
  try {
    const info = await inspectRepo(root);
    if (info.installed) {
      await copyHookScripts(distDir(), info.commonDir); // keep scripts in sync with this extension version
      return;
    }
    const prompted = context.workspaceState.get<string[]>(HOOKS_PROMPTED_KEY, []);
    const enabled = vscode.workspace.getConfiguration('taskTracker').get<boolean>('promptToInstallHooks', true);
    if (!enabled || prompted.includes(root)) return;
    await context.workspaceState.update(HOOKS_PROMPTED_KEY, [...prompted, root]);
    const choice = await vscode.window.showInformationMessage(
      `Install Task Tracker git hooks in ${repo.rootUri.path.split('/').pop()}? They check task IDs in commit messages and record pushed commits.`,
      'Install',
      'Not now',
    );
    if (choice === 'Install') await installHooksCommand(repo);
  } catch {
    // not a git repo we can inspect
  }
}

// ---------- helpers ----------

function withProgress<T>(title: string, fn: () => Promise<T>): Promise<T> {
  return Promise.resolve(vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title }, fn));
}

function showError(err: unknown, prefix = 'Task Tracker') {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === 'Not signed in') return;
  if (err instanceof ApiError && err.status === 401) {
    void vscode.window.showErrorMessage('Task Tracker: your session expired.', 'Sign In').then((c) => c && signIn());
    return;
  }
  void vscode.window.showErrorMessage(`${prefix}: ${msg}`);
}

function command(id: string, fn: (...args: never[]) => unknown) {
  context.subscriptions.push(
    vscode.commands.registerCommand(id, async (...args: never[]) => {
      try {
        await fn(...args);
      } catch (err) {
        showError(err);
      }
    }),
  );
}

export async function activate(ctx: vscode.ExtensionContext) {
  context = ctx;

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBar.command = 'taskTracker.selectTask';
  ctx.subscriptions.push(statusBar);
  updateStatusBar();

  command('taskTracker.signIn', signIn);
  command('taskTracker.signOut', signOut);
  command('taskTracker.createTask', createTask);
  command('taskTracker.selectTask', selectTask);
  command('taskTracker.insertTaskId', insertTaskId);
  command('taskTracker.markDone', markDone);
  command('taskTracker.addToGroup', addToGroup);
  command('taskTracker.installHooks', () => installHooksCommand());
  command('taskTracker.copyTaskId', async () => {
    const task = activeTask();
    if (!task) return vscode.window.showInformationMessage('No active task.');
    await vscode.env.clipboard.writeText(task.taskId);
    vscode.window.setStatusBarMessage(`Copied ${task.taskId}`, 2000);
  });
  command('taskTracker.openDashboard', () => vscode.env.openExternal(vscode.Uri.parse(serverUrl())));

  // Keep the hooks' credentials file pointing at the configured server.
  ctx.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (!e.affectsConfiguration('taskTracker.serverUrl')) return;
      const creds = readCredentials();
      if (creds) writeCredentials({ ...creds, serverUrl: serverUrl() });
    }),
  );

  const gitExt = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (gitExt) {
    git = (gitExt.isActive ? gitExt.exports : await gitExt.activate()).getAPI(1);
    git.repositories.forEach(watchRepository);
    ctx.subscriptions.push(git.onDidOpenRepository(watchRepository));
  }

  if (!(await ctx.secrets.get(SECRET_KEY))) {
    const choice = await vscode.window.showInformationMessage(
      'Task Tracker: sign in with GitHub to create task IDs.',
      'Sign In',
    );
    if (choice === 'Sign In') await signIn();
  }
}

export function deactivate() {}
