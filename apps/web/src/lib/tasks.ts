import type { User } from '@prisma/client';
import { buildTaskId, randomTaskSeq, type CreateTaskRequest } from '@task-tracker/shared';
import { prisma } from './db';
import { HttpError } from './http';
import { taskInclude } from './serialize';

const MAX_SEQ_ATTEMPTS = 10;

/**
 * Picks a random 6-digit number not yet used in the project and creates the task in one transaction.
 * The @@unique([projectId, seq]) constraint still guards against two concurrent creates picking the same number.
 */
export async function createTask(user: User, input: CreateTaskRequest) {
  return prisma.$transaction(async (tx) => {
    const env = await tx.environment.findFirst({ where: { id: input.environmentId, active: true } });
    if (!env) throw new HttpError(400, 'Unknown or inactive environment');

    const project = await tx.project.findFirst({ where: { id: input.projectId, active: true } });
    if (!project) throw new HttpError(400, 'Unknown or inactive project');

    let seq = 0;
    for (let attempt = 0; attempt < MAX_SEQ_ATTEMPTS && !seq; attempt++) {
      const candidate = randomTaskSeq();
      const taken = await tx.task.findUnique({ where: { projectId_seq: { projectId: project.id, seq: candidate } } });
      if (!taken) seq = candidate;
    }
    if (!seq) throw new HttpError(503, 'Could not allocate a task number, please retry');

    let taskId: string;
    try {
      taskId = buildTaskId({ projectCode: project.code, environment: env.name, type: input.type, seq });
    } catch (err) {
      // Codes and names are validated in the admin pages, but can still be edited straight in the database.
      throw new HttpError(400, `${err instanceof Error ? err.message : err}. Ask an admin to fix it.`);
    }

    const task = await tx.task.create({
      data: {
        taskId,
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
