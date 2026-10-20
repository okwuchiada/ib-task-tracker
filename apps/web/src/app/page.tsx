import { TASK_TYPES } from '@task-tracker/shared';
import { DownloadIcon } from 'lucide-react';
import Link from 'next/link';
import { canSeeAllProjects, taskVisibilityWhere } from '@/lib/access';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { buildTaskFilterWhere, type TaskFilterParams } from '@/lib/taskFilters';
import { CopyButton } from '@/components/CopyButton';
import { Empty, formatDate, Mono, PageHeader, StatusBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TaskFilters } from '@/components/TaskFilters';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
          <Button variant="outline" asChild>
            <a href={`/api/tasks/export?${qs}`}>
              <DownloadIcon />
              Export CSV
            </a>
          </Button>
        }
      />

      <Card size="sm" className="mb-4">
        <TaskFilters
          options={{
            projects: projects.map((p) => p.code),
            environments: environments.map((e) => e.name),
            types: [...TASK_TYPES],
            statuses: ['OPEN', 'DONE', 'CANCELLED'],
            devs: devs.map((d) => d.login),
          }}
        />
      </Card>

      <Card className="py-0">
        {tasks.length === 0 ? (
          <Empty>No tasks yet. Create one from VS Code with “Task Tracker: Create Task”.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Developer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Commits</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link href={`/tasks/${t.taskId}`} className="link">
                        <Mono>{t.taskId}</Mono>
                      </Link>
                      <CopyButton text={t.taskId} label="Copy" />
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal">{t.title}</TableCell>
                  <TableCell>{t.createdBy.login}</TableCell>
                  <TableCell>
                    <StatusBadge>{t.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t._count.commits}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {total} tasks · page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageLink(page - 1)}>Previous</Link>
              </Button>
            )}
            {page < pages && (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageLink(page + 1)}>Next</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

