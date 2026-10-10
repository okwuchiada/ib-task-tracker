import { createProject, setProjectActive, updateProject } from '@/lib/actions';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';
import { Badge, Empty, Mono, PageHeader } from '@/components/ui';

export default async function ProjectsPage() {
  await requireAdmin();
  const projects = await prisma.project.findMany({
    include: { _count: { select: { tasks: true } } },
    orderBy: { code: 'asc' },
  });

  return (
    <>
      <PageHeader title="Projects" description="Project codes are the first part of every task ID and cannot be changed once created." />
      <form action={createProject} className="card mb-6 flex flex-wrap items-end gap-3 p-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Code
          <input name="code" required pattern="[A-Za-z0-9]{2,10}" placeholder="IPO" className="input w-28 font-mono uppercase" />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-500">
          Name
          <input name="name" required placeholder="Invest app" className="input" />
        </label>
        <button className="btn btn-primary">Add project</button>
      </form>

      <div className="card overflow-x-auto">
        {projects.length === 0 ? (
          <Empty>No projects yet.</Empty>
        ) : (
          <table className="table w-full">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th className="text-right">Tasks</th>
                <th>Next ID</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Mono>{p.code}</Mono>
                  </td>
                  <td>
                    <form action={updateProject.bind(null, p.id)} className="flex gap-2">
                      <input name="name" defaultValue={p.name} className="input flex-1" />
                      <button className="btn btn-sm">Rename</button>
                    </form>
                  </td>
                  <td className="text-right tabular-nums">{p._count.tasks}</td>
                  <td>
                    <Mono>Q{p.nextSeq}</Mono>
                  </td>
                  <td>{p.active ? <Badge tone="OPEN">active</Badge> : <Badge tone="ARCHIVED">inactive</Badge>}</td>
                  <td className="text-right">
                    <form action={setProjectActive.bind(null, p.id, !p.active)}>
                      <button className="btn btn-sm">{p.active ? 'Deactivate' : 'Activate'}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
