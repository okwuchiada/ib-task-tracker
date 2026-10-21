import { buildCherryPickCommand } from '@task-tracker/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canEditTask, findVisibleTask } from '@/lib/access';
import { addTaskToGroup, removeTaskFromGroup, updateTaskDetails, updateTaskStatus } from '@/lib/actions';
import { planCherryPick } from '@/lib/cherryPick';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { CopyButton } from '@/components/CopyButton';
import { Empty, formatDate, formatDateTime, Mono, PageHeader, StatusBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormSelect } from '@/components/FormSelect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

export default async function TaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const user = await requireUser();
  const { taskId } = await params;
  const task = await findVisibleTask(user, taskId, {
    project: true,
    environment: true,
    createdBy: true,
    commits: { orderBy: { committedAt: 'asc' } },
    groupItems: { include: { group: true } },
  });
  if (!task) notFound();

  const editable = canEditTask(user, task);
  const openGroups = await prisma.taskGroup.findMany({
    where: { status: 'OPEN', items: { none: { taskRef: task.id } } },
    orderBy: { createdAt: 'desc' },
  });
  const plan = planCherryPick(task.commits.map((c) => ({ ...c, taskId: task.taskId })));

  return (
    <>
      <PageHeader
        title={task.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Mono>{task.taskId}</Mono>
            <CopyButton text={task.taskId} label="Copy ID" />
            <StatusBadge>{task.status}</StatusBadge>
          </span>
        }
        actions={
          editable &&
          (['OPEN', 'DONE', 'CANCELLED'] as const)
            .filter((s) => s !== task.status)
            .map((s) => (
              <form key={s} action={updateTaskStatus.bind(null, task.taskId, s)}>
                <Button variant={s === 'DONE' ? 'default' : 'outline'}>
                  {s === 'OPEN' ? 'Reopen' : s === 'DONE' ? 'Mark done' : 'Cancel task'}
                </Button>
              </form>
            ))
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="gap-0 pb-0">
            <CardHeader className="border-b">
              <CardTitle>Commits ({task.commits.length})</CardTitle>
            </CardHeader>
            {task.commits.length === 0 ? (
              <Empty>No pushed commits yet. Commits are recorded when they are pushed.</Empty>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SHA</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {task.commits.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="align-top">
                          <Mono>{c.sha.slice(0, 10)}</Mono>
                          {c.cherryPickOf && (
                            <div className="text-xs text-muted-foreground">copy of {c.cherryPickOf.slice(0, 10)}</div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-sm align-top">
                          <div className="truncate">{c.message.split('\n')[0]}</div>
                          <div className="text-xs text-muted-foreground">{c.repo}</div>
                        </TableCell>
                        <TableCell className="align-top">{c.branch}</TableCell>
                        <TableCell className="align-top text-muted-foreground">{formatDateTime(c.committedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="space-y-2 border-t p-4">
                  {plan.map((p) => {
                    const cmd = buildCherryPickCommand(p.commits.map((c) => c.sha));
                    return (
                      cmd && (
                        <div key={p.repo}>
                          <div className="mb-1 text-xs text-muted-foreground">{p.repo}</div>
                          <div className="flex items-start gap-2">
                            <code className="flex-1 overflow-x-auto rounded-md bg-muted p-2 text-xs">{cmd}</code>
                            <CopyButton text={cmd} />
                          </div>
                        </div>
                      )
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          {editable && (
            <Card>
              <CardHeader>
                <CardTitle>Edit details</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={updateTaskDetails.bind(null, task.taskId)} className="space-y-3">
                  <Input name="title" defaultValue={task.title} required minLength={3} aria-label="Title" />
                  <Textarea
                    name="description"
                    defaultValue={task.description ?? ''}
                    rows={4}
                    aria-label="Description"
                    placeholder="Description, links, notes for documentation"
                  />
                  <Button>Save</Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">Project</dt>
                <dd>
                  {task.project.code} · {task.project.name}
                </dd>
                <dt className="text-muted-foreground">Environment</dt>
                <dd>{task.environment.name}</dd>
                <dt className="text-muted-foreground">Type</dt>
                <dd>{task.type}</dd>
                <dt className="text-muted-foreground">Developer</dt>
                <dd>{task.createdBy.login}</dd>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDate(task.createdAt)}</dd>
              </dl>
              {!editable && task.description && <p className="mt-1 whitespace-pre-wrap">{task.description}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Groups</CardTitle>
            </CardHeader>
            <CardContent>
              {task.groupItems.length === 0 && <p className="text-muted-foreground">Not in any group.</p>}
              <ul className="space-y-2">
                {task.groupItems.map((gi) => (
                  <li key={gi.groupId} className="flex items-center justify-between gap-2">
                    <Link href={`/groups/${gi.groupId}`} className="link">
                      {gi.group.name}
                    </Link>
                    <form action={removeTaskFromGroup.bind(null, gi.groupId, task.id)}>
                      <Button variant="outline" size="xs">
                        Remove
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
              {openGroups.length > 0 && (
                <form
                  action={async (form: FormData) => {
                    'use server';
                    form.set('taskId', task.taskId);
                    await addTaskToGroup(String(form.get('groupId')), form);
                  }}
                  className="flex gap-2"
                >
                  <FormSelect
                    name="groupId"
                    aria-label="Group"
                    className="w-full min-w-0 flex-1"
                    defaultValue={openGroups[0].id}
                    options={openGroups.map((g) => ({ value: g.id, label: g.name }))}
                  />
                  <Button variant="outline">Add</Button>
                </form>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
