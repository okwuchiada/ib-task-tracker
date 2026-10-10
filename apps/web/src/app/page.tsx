import { TASK_TYPES } from '@task-tracker/shared';
import Link from 'next/link';
import { canSeeAllProjects, taskVisibilityWhere } from '@/lib/access';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { buildTaskFilterWhere, type TaskFilterParams } from '@/lib/taskFilters';
import { CopyButton } from '@/components/CopyButton';
import { Badge, Empty, formatDate, Mono, PageHeader } from '@/components/ui';

const PAGE_SIZE = 50;

export default async function TasksPage({ searchParams }: { searchParams: Promise<TaskFilterParams & { page?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const where = { AND: [await taskVisibilityWhere(user), buildTaskFilterWhere(params)] };

  const [tasks, total, projects, environments, devs] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { project: true, environment: true, createdBy: true, _count: { select: { commits: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.task.count({ where }),
    prisma.project.findMany({ orderBy: { code: 'asc' } }),
    prisma.environment.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.user.findMany({ orderBy: { login: 'asc' }, select: { login: true } }),
  ]);

  const qs = new URLSearchParams(
    Object.entries(params).filter(([k, v]) => k !== 'page' && typeof v === 'string' && v) as [string, string][],
  );
  const pageLink = (p: number) => `/?${new URLSearchParams([...qs, ['page', String(p)]])}`;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Tasks"
        description={
          canSeeAllProjects(user)
            ? 'All tasks across every project.'
            : 'Tasks you created, plus projects an admin has shared with you.'
        }
        actions={
          <a className="btn" href={`/api/tasks/export?${qs}`}>
            Export CSV
          </a>
        }
      />

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-3" method="get">
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Search
          <input name="q" defaultValue={params.q} placeholder="Task ID or title" className="input w-56" />
        </label>
        <Select name="project" label="Project" value={params.project} options={projects.map((p) => p.code)} />
        <Select name="env" label="Environment" value={params.env} options={environments.map((e) => e.name)} />
        <Select name="type" label="Type" value={params.type} options={[...TASK_TYPES]} />
        <Select name="status" label="Status" value={params.status} options={['OPEN', 'DONE', 'CANCELLED']} />
        <Select name="dev" label="Developer" value={params.dev} options={devs.map((d) => d.login)} />
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          From
          <input type="date" name="from" defaultValue={params.from} className="input" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          To
          <input type="date" name="to" defaultValue={params.to} className="input" />
        </label>
        <button className="btn btn-primary">Filter</button>
        {qs.size > 0 && (
          <Link href="/" className="btn">
            Clear
          </Link>
        )}
      </form>

      <div className="card overflow-x-auto">
        {tasks.length === 0 ? (
          <Empty>No tasks yet. Create one from VS Code with “Task Tracker: Create Task”.</Empty>
        ) : (
          <table className="table w-full">
            <thead>
              <tr>
                <th>Task ID</th>
                <th>Title</th>
                <th>Developer</th>
                <th>Status</th>
                <th className="text-right">Commits</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Link href={`/tasks/${t.taskId}`} className="link">
                        <Mono>{t.taskId}</Mono>
                      </Link>
                      <CopyButton text={t.taskId} label="Copy" />
                    </div>
                  </td>
                  <td className="max-w-md">{t.title}</td>
                  <td className="whitespace-nowrap">{t.createdBy.login}</td>
                  <td>
                    <Badge>{t.status}</Badge>
                  </td>
                  <td className="text-right tabular-nums">{t._count.commits}</td>
                  <td className="whitespace-nowrap text-zinc-500">{formatDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <span>
            {total} tasks · page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link className="btn btn-sm" href={pageLink(page - 1)}>
                Previous
              </Link>
            )}
            {page < pages && (
              <Link className="btn btn-sm" href={pageLink(page + 1)}>
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: string[] }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-500">
      {label}
      <select name={name} defaultValue={value ?? ''} className="input">
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
