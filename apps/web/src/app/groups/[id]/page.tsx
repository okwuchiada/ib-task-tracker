import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canEditGroup, taskVisibilityWhere } from '@/lib/access';
import { addTaskToGroup, removeTaskFromGroup, setGroupStatus } from '@/lib/actions';
import { planCherryPick } from '@/lib/cherryPick';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { CherryPickPanel, type PanelRepo } from '@/components/CherryPickPanel';
import { Badge, Empty, Mono, PageHeader } from '@/components/ui';

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const group = await prisma.taskGroup.findUnique({ where: { id }, include: { createdBy: true } });
  if (!group) notFound();

  const visibility = await taskVisibilityWhere(user);
  const [items, totalItems] = await Promise.all([
    prisma.taskGroupItem.findMany({
      where: { groupId: id, task: visibility },
      include: { task: { include: { createdBy: true, commits: true } } },
      orderBy: { addedAt: 'asc' },
    }),
    prisma.taskGroupItem.count({ where: { groupId: id } }),
  ]);
  const hidden = totalItems - items.length;
  const editable = canEditGroup(user, group);

  const plan = planCherryPick(items.flatMap((i) => i.task.commits.map((c) => ({ ...c, taskId: i.task.taskId }))));
  const toPanel = (c: (typeof plan)[number]['commits'][number]) => ({
    sha: c.sha,
    branch: c.branch,
    subject: c.message.split('\n')[0],
    committedAt: c.committedAt.toISOString(),
    taskId: c.taskId,
  });
  const repos: PanelRepo[] = plan.map((p) => ({ repo: p.repo, commits: p.commits.map(toPanel), copies: p.copies.map(toPanel) }));

  const warnings = [
    ...items.filter((i) => i.task.commits.length === 0).map((i) => `${i.task.taskId} has no pushed commits.`),
    ...items.filter((i) => i.task.status === 'OPEN').map((i) => `${i.task.taskId} is still open.`),
  ];

  return (
    <>
      <PageHeader
        title={group.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{group.status}</Badge>
            <span>created by {group.createdBy.login}</span>
            {group.description && <span>· {group.description}</span>}
          </span>
        }
        actions={
          editable &&
          (['OPEN', 'SHIPPED', 'ARCHIVED'] as const)
            .filter((s) => s !== group.status)
            .map((s) => (
              <form key={s} action={setGroupStatus.bind(null, group.id, s)}>
                <button className="btn">{s === 'OPEN' ? 'Reopen' : s === 'SHIPPED' ? 'Mark shipped' : 'Archive'}</button>
              </form>
            ))
        }
      />

      <section className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">Tasks ({items.length})</h2>
          {group.status === 'OPEN' && (
            <form action={addTaskToGroup.bind(null, group.id)} className="flex gap-2">
              <input name="taskId" required placeholder="IPO-Prod-fix-Q1234" className="input w-56 font-mono" />
              <button className="btn">Add task</button>
            </form>
          )}
        </div>
        {items.length === 0 ? (
          <Empty>No tasks in this group yet.</Empty>
        ) : (
          <table className="table w-full">
            <thead>
              <tr>
                <th>Task ID</th>
                <th>Title</th>
                <th>Developer</th>
                <th>Status</th>
                <th className="text-right">Commits</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.taskRef}>
                  <td className="whitespace-nowrap">
                    <Link href={`/tasks/${i.task.taskId}`} className="link">
                      <Mono>{i.task.taskId}</Mono>
                    </Link>
                  </td>
                  <td>{i.task.title}</td>
                  <td>{i.task.createdBy.login}</td>
                  <td>
                    <Badge>{i.task.status}</Badge>
                  </td>
                  <td className="text-right tabular-nums">{i.task.commits.length}</td>
                  <td className="text-right">
                    {(editable || i.addedById === user.id) && (
                      <form action={removeTaskFromGroup.bind(null, group.id, i.taskRef)}>
                        <button className="btn btn-sm">Remove</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {hidden > 0 && (
          <p className="border-t border-zinc-200 px-4 py-2 text-xs text-amber-700 dark:border-zinc-800 dark:text-amber-400">
            {hidden} more task{hidden > 1 ? 's are' : ' is'} in this group but hidden because you don’t have access to
            {hidden > 1 ? ' their projects' : ' its project'}. Ask an admin for access before cherry-picking.
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">Cherry-pick</h2>
        {warnings.length > 0 && (
          <ul className="mx-4 mt-4 list-disc rounded bg-amber-50 py-2 pl-8 pr-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <CherryPickPanel repos={repos} />
      </section>
    </>
  );
}
