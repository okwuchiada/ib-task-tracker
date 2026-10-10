import type { Environment, Project, Task, User } from '@prisma/client';
import type { ApiTask } from '@task-tracker/shared';

export type TaskWithRelations = Task & { project: Project; environment: Environment; createdBy: User };

export const taskInclude = { project: true, environment: true, createdBy: true } as const;

export function toApiTask(task: TaskWithRelations): ApiTask {
  return {
    id: task.id,
    taskId: task.taskId,
    title: task.title,
    type: task.type,
    status: task.status,
    project: { code: task.project.code, name: task.project.name },
    environment: task.environment.name,
    createdBy: task.createdBy.login,
    createdAt: task.createdAt.toISOString(),
  };
}
