import { buildCherryPickCommand } from '@task-tracker/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canEditTask, findVisibleTask } from '@/lib/access';
import { addTaskToGroup, removeTaskFromGroup, updateTaskDetails, updateTaskStatus } from '@/lib/actions';
import { planCherryPick } from '@/lib/cherryPick';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { CopyButton } from '@/components/CopyButton';
import { Badge, Empty, formatDate, formatDateTime, Mono, PageHeader } from '@/components/ui';

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
            <Badge>{task.status}</Badge>
          </span>
        }
        actions={
          editable &&
          (['OPEN', 'DONE', 'CANCELLED'] as const)
            .filter((s) => s !== task.status)
            .map((s) => (
              <form key={s} action={updateTaskStatus.bind(null, task.taskId, s)}>
                <button className="btn">{s === 'OPEN' ? 'Reopen' : s === 'DONE' ? 'Mark done' : 'Cancel task'}</button>
              </form>
            ))
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
              Commits ({task.commits.length})
            </h2>
            {task.commits.length === 0 ? (
              <Empty>No pushed commits yet. Commits are recorded when they are pushed.</Empty>
            ) : (
              <>
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>SHA</th>
                      <th>Message</th>
                      <th>Branch</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {task.commits.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Mono>{c.sha.slice(0, 10)}</Mono>
                          {c.cherryPickOf && <div className="text-xs text-zinc-500">copy of {c.cherryPickOf.slice(0, 10)}</div>}
                        </td>
                        <td className="max-w-sm">
                          <div className="truncate">{c.message.split('\n')[0]}</div>
                          <div className="text-xs text-zinc-500">{c.repo}</div>
                        </td>
                        <td className="whitespace-nowrap">{c.branch}</td>
                        <td className="whitespace-nowrap text-zinc-500">{formatDateTime(c.committedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="space-y-2 p-4">
                  {plan.map((p) => {
                    const cmd = buildCherryPickCommand(p.commits.map((c) => c.sha));
                    return (
                      cmd && (
                        <div key={p.repo}>
                          <div className="mb-1 text-xs text-zinc-500">{p.repo}</div>
                          <div className="flex items-start gap-2">
                            <code className="flex-1 overflow-x-auto rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-800">{cmd}</code>
                            <CopyButton text={cmd} />
                          </div>
                        </div>
                      )
                    );
                  })}
                </div>
              </>
            )}
          </section>

          {editable && (
            <section className="card p-4">
              <h2 className="mb-3 text-sm font-semibold">Edit details</h2>
              <form action={updateTaskDetails.bind(null, task.taskId)} className="space-y-3">
                <input name="title" defaultValue={task.title} className="input w-full" required minLength={3} />
                <textarea
                  name="description"
                  defaultValue={task.description ?? ''}
                  rows={4}
                  className="input w-full"
                  placeholder="Description, links, notes for documentation"
                />
                <button className="btn btn-primary">Save</button>
              </form>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="card p-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-zinc-500">Project</dt>
              <dd>
                {task.project.code} · {task.project.name}
              </dd>
              <dt className="text-zinc-500">Environment</dt>
              <dd>{task.environment.name}</dd>
              <dt className="text-zinc-500">Type</dt>
              <dd>{task.type}</dd>
              <dt className="text-zinc-500">Developer</dt>
              <dd>{task.createdBy.login}</dd>
              <dt className="text-zinc-500">Created</dt>
              <dd>{formatDate(task.createdAt)}</dd>
            </dl>
            {!editable && task.description && <p className="mt-4 whitespace-pre-wrap">{task.description}</p>}
          </section>

          <section className="card p-4 text-sm">
            <h2 className="mb-3 font-semibold">Groups</h2>
            {task.groupItems.length === 0 && <p className="text-zinc-500">Not in any group.</p>}
            <ul className="space-y-2">
              {task.groupItems.map((gi) => (
                <li key={gi.groupId} className="flex items-center justify-between gap-2">
                  <Link href={`/groups/${gi.groupId}`} className="link">
                    {gi.group.name}
                  </Link>
                  <form action={removeTaskFromGroup.bind(null, gi.groupId, task.id)}>
                    <button className="btn btn-sm">Remove</button>
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
                className="mt-4 flex gap-2"
              >
                <select name="groupId" className="input flex-1" required>
                  {openGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <button className="btn">Add</button>
              </form>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
