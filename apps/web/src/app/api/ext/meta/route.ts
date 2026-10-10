import { TASK_TYPES, type ApiMeta } from '@task-tracker/shared';
import { requireApiUser } from '@/lib/apiAuth';
import { prisma } from '@/lib/db';
import { handle, json } from '@/lib/http';

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  const [projects, environments] = await Promise.all([
    prisma.project.findMany({ where: { active: true }, orderBy: { code: 'asc' } }),
    prisma.environment.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
  ]);
  const meta: ApiMeta = {
    projects: projects.map((p) => ({ id: p.id, code: p.code, name: p.name })),
    environments: environments.map((e) => ({ id: e.id, name: e.name })),
    taskTypes: [...TASK_TYPES],
  };
  return json({ ...meta, user: { login: user.login, role: user.role } });
});
