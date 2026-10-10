import { updateTaskRequest } from '@task-tracker/shared';
import { canEditTask, findVisibleTask } from '@/lib/access';
import { requireApiUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/db';
import { handle, HttpError, json } from '@/lib/http';
import { taskInclude, toApiTask } from '@/lib/serialize';

type Ctx = { params: Promise<{ taskId: string }> };

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireApiUser(req);
  const task = await findVisibleTask(user, (await ctx.params).taskId, taskInclude);
  if (!task) throw new HttpError(404, 'Task not found');
  return json({ task: toApiTask(task) });
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireApiUser(req);
  const task = await findVisibleTask(user, (await ctx.params).taskId);
  if (!task) throw new HttpError(404, 'Task not found');
  if (!canEditTask(user, task)) throw new HttpError(403, 'Only the task owner or an admin can change it');
  const data = updateTaskRequest.parse(await req.json());
  const updated = await prisma.task.update({ where: { id: task.id }, data, include: taskInclude });
  return json({ task: toApiTask(updated) });
});
