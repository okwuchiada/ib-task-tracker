import type { Prisma, Role } from '@prisma/client';
import { prisma } from './db';

export interface AccessUser {
  id: string;
  role: Role;
  viewAllProjects: boolean;
}

export function canSeeAllProjects(user: AccessUser): boolean {
  return user.role === 'ADMIN' || user.viewAllProjects;
}

/** Pure part of the visibility rule, kept separate so it can be unit-tested. */
export function buildTaskVisibilityWhere(user: AccessUser, grantedProjectIds: string[]): Prisma.TaskWhereInput {
  if (canSeeAllProjects(user)) return {};
  const or: Prisma.TaskWhereInput[] = [{ createdById: user.id }];
  if (grantedProjectIds.length) or.push({ projectId: { in: grantedProjectIds } });
  return { OR: or };
}

/** Prisma `where` limiting tasks to what `user` may see. Every task query must go through this. */
export async function taskVisibilityWhere(user: AccessUser): Promise<Prisma.TaskWhereInput> {
  if (canSeeAllProjects(user)) return {};
  const grants = await prisma.projectAccess.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });
  return buildTaskVisibilityWhere(
    user,
    grants.map((g) => g.projectId),
  );
}

export function canEditTask(user: AccessUser, task: { createdById: string }): boolean {
  return user.role === 'ADMIN' || task.createdById === user.id;
}

export function canEditGroup(user: AccessUser, group: { createdById: string }): boolean {
  return user.role === 'ADMIN' || group.createdById === user.id;
}

/** Finds a task by its public ID (e.g. IPO-Prod-fix-Q1) if the user may see it. */
export async function findVisibleTask<I extends Prisma.TaskInclude = {}>(
  user: AccessUser,
  taskId: string,
  include?: I,
): Promise<Prisma.TaskGetPayload<{ include: I }> | null> {
  const visibility = await taskVisibilityWhere(user);
  return prisma.task.findFirst({ where: { AND: [{ taskId }, visibility] }, include }) as Promise<Prisma.TaskGetPayload<{
    include: I;
  }> | null>;
}
