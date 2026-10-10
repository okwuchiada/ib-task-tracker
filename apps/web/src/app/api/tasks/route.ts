import { createTaskRequest } from '@task-tracker/shared';
import { taskVisibilityWhere } from '@/lib/access';
import { requireApiUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/db';
import { handle, json } from '@/lib/http';
import { taskInclude, toApiTask } from '@/lib/serialize';
import { buildTaskFilterWhere } from '@/lib/taskFilters';
import { createTask } from '@/lib/tasks';

/** `?mine=1` limits to the caller's tasks; other filters match the dashboard's query string. */
export const GET = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const tasks = await prisma.task.findMany({
    where: {
      AND: [
        await taskVisibilityWhere(user),
        buildTaskFilterWhere(params),
        params.mine === '1' ? { createdById: user.id } : {},
      ],
    },
    include: taskInclude,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(params.limit) || 100, 500),
  });
  return json({ tasks: tasks.map(toApiTask) });
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  const input = createTaskRequest.parse(await req.json());
  const task = await createTask(user, input);
  return json({ task: toApiTask(task) }, 201);
});
