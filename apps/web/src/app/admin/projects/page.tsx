import { createProject, setProjectActive, updateProject } from '@/lib/actions';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';
import { Empty, Field, Mono, PageHeader, StatusBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default async function ProjectsPage() {
  await requireAdmin();
  const projects = await prisma.project.findMany({
    include: { _count: { select: { tasks: true } } },
    orderBy: { code: 'asc' },
  });

  return (
    <>
      <PageHeader title="Projects" description="Project codes are the first part of every task ID and cannot be changed once created." />
      <Card size="sm" className="mb-6">
        <form action={createProject} className="flex flex-wrap items-end gap-3 px-(--card-spacing)">
          <Field label="Code">
            <Input name="code" required pattern="[A-Za-z0-9]{2,10}" placeholder="IPO" className="w-28 font-mono uppercase" />
          </Field>
          <Field label="Name" className="flex-1">
            <Input name="name" required placeholder="Invest app" />
          </Field>
          <Button>Add project</Button>
        </form>
      </Card>

      <Card className="py-0">
        {projects.length === 0 ? (
          <Empty>No projects yet.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Mono>{p.code}</Mono>
                  </TableCell>
                  <TableCell>
                    <form action={updateProject.bind(null, p.id)} className="flex gap-2">
                      <Input name="name" defaultValue={p.name} aria-label={`${p.code} name`} className="h-8 flex-1" />
                      <Button variant="outline" size="sm">
                        Rename
                      </Button>
                    </form>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p._count.tasks}</TableCell>
                  <TableCell>
                    {p.active ? <StatusBadge tone="OPEN">active</StatusBadge> : <StatusBadge tone="ARCHIVED">inactive</StatusBadge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={setProjectActive.bind(null, p.id, !p.active)}>
                      <Button variant="outline" size="xs">
                        {p.active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
