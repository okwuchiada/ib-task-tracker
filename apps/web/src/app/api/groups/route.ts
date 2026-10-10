import { createGroupRequest, type ApiGroup } from '@task-tracker/shared';
import { requireApiUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/db';
import { handle, json } from '@/lib/http';

export const GET = handle(async (req: Request) => {
  await requireApiUser(req);
  const status = new URL(req.url).searchParams.get('status');
  const groups = await prisma.taskGroup.findMany({
    where: status === 'OPEN' || status === 'SHIPPED' || status === 'ARCHIVED' ? { status } : {},
    include: { _count: { select: { items: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const result: ApiGroup[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    status: g.status,
    taskCount: g._count.items,
  }));
  return json({ groups: result });
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  const input = createGroupRequest.parse(await req.json());
  const group = await prisma.taskGroup.create({
    data: { name: input.name, description: input.description || null, createdById: user.id },
  });
  return json({ group: { id: group.id, name: group.name, status: group.status, taskCount: 0 } }, 201);
});
