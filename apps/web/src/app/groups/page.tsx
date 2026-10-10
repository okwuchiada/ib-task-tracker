import Link from 'next/link';
import { createGroup } from '@/lib/actions';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { Badge, Empty, formatDate, PageHeader } from '@/components/ui';

export default async function GroupsPage() {
  await requireUser();
  const groups = await prisma.taskGroup.findMany({
    include: { createdBy: true, _count: { select: { items: true } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  return (
    <>
      <PageHeader
        title="Groups"
        description="Bundle related tasks (a release, a larger feature) to cherry-pick all their commits together."
      />
      <form action={createGroup} className="card mb-6 flex flex-wrap items-end gap-3 p-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Name
          <input name="name" required minLength={2} placeholder="Release 2026-10-15" className="input w-64" />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-500">
          Description
          <input name="description" placeholder="Optional" className="input" />
        </label>
        <button className="btn btn-primary">New group</button>
      </form>

      <div className="card overflow-x-auto">
        {groups.length === 0 ? (
          <Empty>No groups yet.</Empty>
        ) : (
          <table className="table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th className="text-right">Tasks</th>
                <th>Created by</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td>
                    <Link href={`/groups/${g.id}`} className="link">
                      {g.name}
                    </Link>
                    {g.description && <div className="text-xs text-zinc-500">{g.description}</div>}
                  </td>
                  <td>
                    <Badge>{g.status}</Badge>
                  </td>
                  <td className="text-right tabular-nums">{g._count.items}</td>
                  <td>{g.createdBy.login}</td>
                  <td className="whitespace-nowrap text-zinc-500">{formatDate(g.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
