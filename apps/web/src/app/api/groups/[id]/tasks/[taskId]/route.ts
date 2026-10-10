import { canEditGroup } from '@/lib/access';
import { requireApiUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/db';
import { handle, HttpError, json } from '@/lib/http';

/** Removing is allowed for the group owner, an admin, or whoever added the task. */
export const DELETE = handle(
  async (req: Request, ctx: { params: Promise<{ id: string; taskId: string }> }) => {
    const user = await requireApiUser(req);
    const { id, taskId } = await ctx.params;
    const item = await prisma.taskGroupItem.findFirst({
      where: { groupId: id, task: { taskId } },
      include: { group: true },
    });
    if (!item) throw new HttpError(404, 'Task is not in this group');
    if (!canEditGroup(user, item.group) && item.addedById !== user.id) {
      throw new HttpError(403, 'Not allowed to change this group');
    }
    await prisma.taskGroupItem.delete({
      where: { groupId_taskRef: { groupId: id, taskRef: item.taskRef } },
    });
    return json({ ok: true });
  },
);
