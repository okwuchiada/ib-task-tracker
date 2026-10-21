import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canEditGroup, taskVisibilityWhere } from '@/lib/access';
import { addTaskToGroup, removeTaskFromGroup, setGroupStatus } from '@/lib/actions';
import { planCherryPick } from '@/lib/cherryPick';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { CherryPickPanel, type PanelRepo } from '@/components/CherryPickPanel';
import { Empty, Mono, PageHeader, StatusBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
            <StatusBadge>{group.status}</StatusBadge>
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
                <Button variant={s === 'SHIPPED' ? 'default' : 'outline'}>
                  {s === 'OPEN' ? 'Reopen' : s === 'SHIPPED' ? 'Mark shipped' : 'Archive'}
                </Button>
              </form>
            ))
        }
      />

      <Card className="mb-6 gap-0 pb-0">
        <CardHeader className="border-b">
          <CardTitle>Tasks ({items.length})</CardTitle>
          {group.status === 'OPEN' && (
            <CardAction>
              <form action={addTaskToGroup.bind(null, group.id)} className="flex gap-2">
                <Input name="taskId" required placeholder="IPO-Prod-fix-Q123450" aria-label="Task ID" className="w-56 font-mono" />
                <Button variant="outline">Add task</Button>
              </form>
            </CardAction>
          )}
        </CardHeader>
        {items.length === 0 ? (
          <Empty>No tasks in this group yet.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Developer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Commits</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.taskRef}>
                  <TableCell>
                    <Link href={`/tasks/${i.task.taskId}`} className="link">
                      <Mono>{i.task.taskId}</Mono>
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-normal">{i.task.title}</TableCell>
                  <TableCell>{i.task.createdBy.login}</TableCell>
                  <TableCell>
                    <StatusBadge>{i.task.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{i.task.commits.length}</TableCell>
                  <TableCell className="text-right">
                    {(editable || i.addedById === user.id) && (
                      <form action={removeTaskFromGroup.bind(null, group.id, i.taskRef)}>
                        <Button variant="outline" size="xs">
                          Remove
                        </Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {hidden > 0 && (
          <p className="border-t px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
            {hidden} more task{hidden > 1 ? 's are' : ' is'} in this group but hidden because you don’t have access to
            {hidden > 1 ? ' their projects' : ' its project'}. Ask an admin for access before cherry-picking.
          </p>
        )}
      </Card>

      <Card className="gap-0 pb-0">
        <CardHeader className="border-b">
          <CardTitle>Cherry-pick</CardTitle>
        </CardHeader>
        {warnings.length > 0 && (
          <ul className="mx-4 mt-4 list-disc rounded-md bg-amber-50 py-2 pr-3 pl-8 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <CherryPickPanel repos={repos} />
      </Card>
    </>
  );
}
