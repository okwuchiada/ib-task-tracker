'use server';

import { ENVIRONMENT_NAME_REGEX, PROJECT_CODE_REGEX } from '@task-tracker/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { canEditGroup, canEditTask, findVisibleTask } from './access';
import { signIn, signOut } from './auth';
import { prisma } from './db';
import { requireAdmin, requireUser } from './session';
import { generateApiToken, hashToken } from './tokens';

function str(form: FormData, key: string) {
  return String(form.get(key) ?? '').trim();
}

export async function signInWithGithub() {
  await signIn('github', { redirectTo: '/' });
}

export async function signOutAction() {
  await signOut({ redirectTo: '/signin' });
}

// ---- Projects & environments (admin) ----

export async function createProject(form: FormData) {
  await requireAdmin();
  const code = str(form, 'code').toUpperCase();
  const name = str(form, 'name');
  if (!PROJECT_CODE_REGEX.test(code)) throw new Error('Project code must be 2-10 uppercase letters or digits');
  if (!name) throw new Error('Project name is required');
  await prisma.project.create({ data: { code, name } });
  revalidatePath('/admin/projects');
}

export async function updateProject(id: string, form: FormData) {
  await requireAdmin();
  const name = str(form, 'name');
  if (name) await prisma.project.update({ where: { id }, data: { name } });
  revalidatePath('/admin/projects');
}

export async function setProjectActive(id: string, active: boolean) {
  await requireAdmin();
  await prisma.project.update({ where: { id }, data: { active } });
  revalidatePath('/admin/projects');
}

export async function createEnvironment(form: FormData) {
  await requireAdmin();
  const name = str(form, 'name');
  if (!ENVIRONMENT_NAME_REGEX.test(name)) throw new Error('Environment name must be 2-20 letters');
  const max = await prisma.environment.aggregate({ _max: { sortOrder: true } });
  await prisma.environment.create({ data: { name, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  revalidatePath('/admin/environments');
}

export async function setEnvironmentActive(id: string, active: boolean) {
  await requireAdmin();
  await prisma.environment.update({ where: { id }, data: { active } });
  revalidatePath('/admin/environments');
}

// ---- Users & access (admin) ----

export async function setUserRole(userId: string, role: 'ADMIN' | 'MEMBER') {
  const admin = await requireAdmin();
  if (userId === admin.id && role !== 'ADMIN') throw new Error('You cannot remove your own admin role');
  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath('/admin/users');
}

export async function setViewAllProjects(userId: string, viewAllProjects: boolean) {
  await requireAdmin();
  await prisma.user.update({ where: { id: userId }, data: { viewAllProjects } });
  revalidatePath('/admin/users');
}

/** Replaces the user's project grants with the checked projects. */
export async function setProjectAccess(userId: string, form: FormData) {
  const admin = await requireAdmin();
  const projectIds = form.getAll('projectId').map(String);
  await prisma.$transaction([
    prisma.projectAccess.deleteMany({ where: { userId, projectId: { notIn: projectIds } } }),
    ...projectIds.map((projectId) =>
      prisma.projectAccess.upsert({
        where: { userId_projectId: { userId, projectId } },
        update: {},
        create: { userId, projectId, grantedById: admin.id },
      }),
    ),
  ]);
  revalidatePath('/admin/users');
}

// ---- Tokens ----

export type CreateTokenState = { token?: string; label?: string; error?: string };

/** Creates an API token for CI (e.g. the record-commits GitHub workflow). The raw token is returned once. */
export async function createApiToken(_prev: CreateTokenState, form: FormData): Promise<CreateTokenState> {
  const user = await requireUser();
  const label = str(form, 'label');
  if (label.length < 2 || label.length > 80) return { error: 'Give the token a name (2-80 characters).' };
  const token = generateApiToken();
  await prisma.apiToken.create({ data: { userId: user.id, tokenHash: hashToken(token), label } });
  revalidatePath('/settings/tokens');
  return { token, label };
}

export async function revokeToken(id: string) {
  const user = await requireUser();
  await prisma.apiToken.updateMany({
    where: { id, revokedAt: null, ...(user.role === 'ADMIN' ? {} : { userId: user.id }) },
    data: { revokedAt: new Date() },
  });
  revalidatePath('/settings/tokens');
}

// ---- Tasks ----

export async function updateTaskStatus(taskId: string, status: 'OPEN' | 'DONE' | 'CANCELLED') {
  const user = await requireUser();
  const task = await findVisibleTask(user, taskId);
  if (!task || !canEditTask(user, task)) throw new Error('Not allowed');
  await prisma.task.update({ where: { id: task.id }, data: { status } });
  revalidatePath(`/tasks/${taskId}`);
}

export async function updateTaskDetails(taskId: string, form: FormData) {
  const user = await requireUser();
  const task = await findVisibleTask(user, taskId);
  if (!task || !canEditTask(user, task)) throw new Error('Not allowed');
  const title = str(form, 'title');
  if (title.length < 3) throw new Error('Title is too short');
  await prisma.task.update({
    where: { id: task.id },
    data: { title, description: str(form, 'description') || null },
  });
  revalidatePath(`/tasks/${taskId}`);
}

// ---- Groups ----

export async function createGroup(form: FormData) {
  const user = await requireUser();
  const name = str(form, 'name');
  if (name.length < 2) throw new Error('Group name is too short');
  const group = await prisma.taskGroup.create({
    data: { name, description: str(form, 'description') || null, createdById: user.id },
  });
  redirect(`/groups/${group.id}`);
}

export async function setGroupStatus(groupId: string, status: 'OPEN' | 'SHIPPED' | 'ARCHIVED') {
  const user = await requireUser();
  const group = await prisma.taskGroup.findUniqueOrThrow({ where: { id: groupId } });
  if (!canEditGroup(user, group)) throw new Error('Not allowed');
  await prisma.taskGroup.update({ where: { id: groupId }, data: { status } });
  revalidatePath(`/groups/${groupId}`);
}

export async function addTaskToGroup(groupId: string, form: FormData) {
  const user = await requireUser();
  const taskId = str(form, 'taskId');
  const group = await prisma.taskGroup.findUniqueOrThrow({ where: { id: groupId } });
  if (group.status !== 'OPEN') throw new Error('Group is not open');
  const task = await findVisibleTask(user, taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  await prisma.taskGroupItem.upsert({
    where: { groupId_taskRef: { groupId, taskRef: task.id } },
    update: {},
    create: { groupId, taskRef: task.id, addedById: user.id },
  });
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/tasks/${taskId}`);
}

export async function removeTaskFromGroup(groupId: string, taskRef: string) {
  const user = await requireUser();
  const item = await prisma.taskGroupItem.findUniqueOrThrow({
    where: { groupId_taskRef: { groupId, taskRef } },
    include: { group: true, task: true },
  });
  if (!canEditGroup(user, item.group) && item.addedById !== user.id) throw new Error('Not allowed');
  await prisma.taskGroupItem.delete({ where: { groupId_taskRef: { groupId, taskRef } } });
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/tasks/${item.task.taskId}`);
}
