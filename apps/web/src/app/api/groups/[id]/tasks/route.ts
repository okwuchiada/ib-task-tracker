import { addGroupTaskRequest } from '@task-tracker/shared';
import { findVisibleTask } from '@/lib/access';
import { requireApiUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/db';
import { handle, HttpError, json } from '@/lib/http';

/** Anyone who can see a task may add it to an open group. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(req);
  const { taskId } = addGroupTaskRequest.parse(await req.json());
  const group = await prisma.taskGroup.findUnique({ where: { id: (await ctx.params).id } });
  if (!group) throw new HttpError(404, 'Group not found');
  if (group.status !== 'OPEN') throw new HttpError(409, 'Group is not open');
  const task = await findVisibleTask(user, taskId);
  if (!task) throw new HttpError(404, 'Task not found');
  await prisma.taskGroupItem.upsert({
    where: { groupId_taskRef: { groupId: group.id, taskRef: task.id } },
    update: {},
    create: { groupId: group.id, taskRef: task.id, addedById: user.id },
  });
  return json({ ok: true }, 201);
});
