import { requireApiUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/db';
import { handle, json } from '@/lib/http';

/**
 * Used by the commit-msg hook. Deliberately ignores visibility: anyone may commit against
 * any real task ID (e.g. when fixing a colleague's task on a shared branch).
 */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ taskId: string }> }) => {
  await requireApiUser(req);
  const task = await prisma.task.findUnique({
    where: { taskId: (await ctx.params).taskId },
    select: { taskId: true, status: true },
  });
  return task ? json({ exists: true, status: task.status }) : json({ exists: false }, 404);
});
