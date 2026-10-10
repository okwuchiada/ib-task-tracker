import type { User } from '@prisma/client';
import { buildTaskId, type CreateTaskRequest } from '@task-tracker/shared';
import { prisma } from './db';
import { HttpError } from './http';
import { taskInclude } from './serialize';

/**
 * Allocates the next per-project sequence number and creates the task in one transaction.
 * The UPDATE … RETURNING takes a row lock on the project, so concurrent creates never share a number.
 */
export async function createTask(user: User, input: CreateTaskRequest) {
  return prisma.$transaction(async (tx) => {
    const env = await tx.environment.findFirst({ where: { id: input.environmentId, active: true } });
    if (!env) throw new HttpError(400, 'Unknown or inactive environment');

    const rows = await tx.$queryRaw<{ code: string; seq: number }[]>`
      UPDATE "Project" SET "nextSeq" = "nextSeq" + 1
      WHERE "id" = ${input.projectId} AND "active" = true
      RETURNING "code", "nextSeq" - 1 AS "seq"`;
    if (!rows.length) throw new HttpError(400, 'Unknown or inactive project');
    const seq = Number(rows[0].seq);

    const task = await tx.task.create({
      data: {
        taskId: buildTaskId({ projectCode: rows[0].code, environment: env.name, type: input.type, seq }),
        projectId: input.projectId,
        environmentId: env.id,
        type: input.type,
        seq,
        title: input.title,
        description: input.description || null,
        createdById: user.id,
      },
      include: taskInclude,
    });

    if (input.groupId) {
      const group = await tx.taskGroup.findFirst({ where: { id: input.groupId, status: 'OPEN' } });
      if (!group) throw new HttpError(400, 'Group not found or not open');
      await tx.taskGroupItem.create({ data: { groupId: group.id, taskRef: task.id, addedById: user.id } });
    }

    return task;
  });
}
