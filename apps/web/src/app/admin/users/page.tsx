import { setProjectAccess, setUserRole, setViewAllProjects } from '@/lib/actions';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';
import { Avatar } from '@/components/Avatar';
import { PageHeader, StatusBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

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
            <Card key={u.id} size="sm">
              <CardContent className="flex flex-row flex-wrap items-start gap-x-8 gap-y-4">
                <div className="flex min-w-48 items-center gap-3">
                  <Avatar src={u.avatarUrl} login={u.login} />
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {u.login}
                      {u.role === 'ADMIN' && <StatusBadge>ADMIN</StatusBadge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {u.name ?? '—'} · {u._count.tasks} tasks
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <form action={setUserRole.bind(null, u.id, u.role === 'ADMIN' ? 'MEMBER' : 'ADMIN')}>
                    <Button variant="outline" size="sm" disabled={u.id === admin.id}>
                      {u.role === 'ADMIN' ? 'Make member' : 'Make admin'}
                    </Button>
                  </form>
                  {u.role !== 'ADMIN' && (
                    <form action={setViewAllProjects.bind(null, u.id, !u.viewAllProjects)}>
                      <Button variant={u.viewAllProjects ? 'default' : 'outline'} size="sm">
                        View all projects: {u.viewAllProjects ? 'on' : 'off'}
                      </Button>
                    </form>
                  )}
                </div>

                <div className="flex-1">
                  {seesAll ? (
                    <p className="text-muted-foreground">
                      {u.role === 'ADMIN' ? 'Admins see every project.' : 'Can see every project.'}
                    </p>
                  ) : (
                    <form action={setProjectAccess.bind(null, u.id)} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="text-muted-foreground">Project access:</span>
                      {projects.map((p) => (
                        <Label key={p.id} className="font-mono text-xs font-normal">
                          <Checkbox name="projectId" value={p.id} defaultChecked={granted.has(p.id)} />
                          {p.code}
                        </Label>
                      ))}
                      <Button variant="outline" size="sm">
                        Save access
                      </Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
