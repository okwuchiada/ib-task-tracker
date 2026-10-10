import { taskVisibilityWhere } from '@/lib/access';
import { requireApiUser } from '@/lib/apiAuth';
import { toCsv } from '@/lib/csv';
import { prisma } from '@/lib/db';
import { handle } from '@/lib/http';
import { buildTaskFilterWhere } from '@/lib/taskFilters';

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const tasks = await prisma.task.findMany({
    where: { AND: [await taskVisibilityWhere(user), buildTaskFilterWhere(params)] },
    include: {
      project: true,
      environment: true,
      createdBy: true,
      _count: { select: { commits: true } },
      groupItems: { include: { group: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const csv = toCsv(
    ['Task ID', 'Title', 'Type', 'Project', 'Environment', 'Status', 'Developer', 'Created', 'Commits', 'Groups', 'Description'],
    tasks.map((t) => [
      t.taskId,
      t.title,
      t.type,
      t.project.code,
      t.environment.name,
      t.status,
      t.createdBy.login,
      t.createdAt,
      t._count.commits,
      t.groupItems.map((g) => g.group.name).join('; '),
      t.description,
    ]),
  );
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tasks-${date}.csv"`,
    },
  });
});
