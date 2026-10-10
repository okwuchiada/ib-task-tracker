import { createEnvironment, setEnvironmentActive } from '@/lib/actions';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';
import { Badge, Empty, PageHeader } from '@/components/ui';

export default async function EnvironmentsPage() {
  await requireAdmin();
  const environments = await prisma.environment.findMany({
    include: { _count: { select: { tasks: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  return (
    <>
      <PageHeader title="Environments" description="The second part of a task ID, e.g. Prod in IPO-Prod-fix-Q1234." />
      <form action={createEnvironment} className="card mb-6 flex flex-wrap items-end gap-3 p-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Name
          <input name="name" required pattern="[A-Za-z]{2,20}" placeholder="Staging" className="input w-48" />
        </label>
        <button className="btn btn-primary">Add environment</button>
      </form>

      <div className="card overflow-x-auto">
        {environments.length === 0 ? (
          <Empty>No environments yet.</Empty>
        ) : (
          <table className="table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th className="text-right">Tasks</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {environments.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td className="text-right tabular-nums">{e._count.tasks}</td>
                  <td>{e.active ? <Badge tone="OPEN">active</Badge> : <Badge tone="ARCHIVED">inactive</Badge>}</td>
                  <td className="text-right">
                    <form action={setEnvironmentActive.bind(null, e.id, !e.active)}>
                      <button className="btn btn-sm">{e.active ? 'Deactivate' : 'Activate'}</button>
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
