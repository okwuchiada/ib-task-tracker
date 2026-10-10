import { setProjectAccess, setUserRole, setViewAllProjects } from '@/lib/actions';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';
import { Badge, PageHeader } from '@/components/ui';

export default async function UsersPage() {
  const admin = await requireAdmin();
  const [users, projects] = await Promise.all([
    prisma.user.findMany({
      include: { projectAccess: true, _count: { select: { tasks: true } } },
      orderBy: { login: 'asc' },
    }),
    prisma.project.findMany({ where: { active: true }, orderBy: { code: 'asc' } }),
  ]);

  return (
    <>
      <PageHeader
        title="Team & access"
        description="Members see only their own tasks unless you share projects with them or turn on “View all projects”. Team members appear here after their first sign-in."
      />
      <div className="space-y-3">
        {users.map((u) => {
          const granted = new Set(u.projectAccess.map((a) => a.projectId));
          const seesAll = u.role === 'ADMIN' || u.viewAllProjects;
          return (
            <div key={u.id} className="card flex flex-wrap items-start gap-x-8 gap-y-4 p-4">
              <div className="flex min-w-48 items-center gap-3">
                {u.avatarUrl && <img src={u.avatarUrl} alt="" className="h-9 w-9 rounded-full" />}
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {u.login}
                    {u.role === 'ADMIN' && <Badge>ADMIN</Badge>}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {u.name ?? '—'} · {u._count.tasks} tasks
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 text-sm">
                <form action={setUserRole.bind(null, u.id, u.role === 'ADMIN' ? 'MEMBER' : 'ADMIN')}>
                  <button className="btn btn-sm" disabled={u.id === admin.id}>
                    {u.role === 'ADMIN' ? 'Make member' : 'Make admin'}
                  </button>
                </form>
                {u.role !== 'ADMIN' && (
                  <form action={setViewAllProjects.bind(null, u.id, !u.viewAllProjects)}>
                    <button className={`btn btn-sm ${u.viewAllProjects ? 'btn-primary' : ''}`}>
                      View all projects: {u.viewAllProjects ? 'on' : 'off'}
                    </button>
                  </form>
                )}
              </div>

              <div className="flex-1">
                {seesAll ? (
                  <p className="text-sm text-zinc-500">
                    {u.role === 'ADMIN' ? 'Admins see every project.' : 'Can see every project.'}
                  </p>
                ) : (
                  <form action={setProjectAccess.bind(null, u.id)} className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <span className="text-zinc-500">Project access:</span>
                    {projects.map((p) => (
                      <label key={p.id} className="flex items-center gap-1.5">
                        <input type="checkbox" name="projectId" value={p.id} defaultChecked={granted.has(p.id)} />
                        <span className="font-mono text-xs">{p.code}</span>
                      </label>
                    ))}
                    <button className="btn btn-sm">Save access</button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
