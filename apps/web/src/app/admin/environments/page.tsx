import { createEnvironment, setEnvironmentActive } from '@/lib/actions';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';
import { Empty, Field, PageHeader, StatusBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default async function EnvironmentsPage() {
  await requireAdmin();
  const environments = await prisma.environment.findMany({
    include: { _count: { select: { tasks: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  return (
    <>
      <PageHeader title="Environments" description="The second part of a task ID, e.g. Prod in IPO-Prod-fix-Q123450." />
      <Card size="sm" className="mb-6">
        <form action={createEnvironment} className="flex flex-wrap items-end gap-3 px-(--card-spacing)">
          <Field label="Name">
            <Input name="name" required pattern="[A-Za-z]{2,20}" placeholder="Staging" className="w-48" />
          </Field>
          <Button>Add environment</Button>
        </form>
      </Card>

      <Card className="py-0">
        {environments.length === 0 ? (
          <Empty>No environments yet.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {environments.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{e._count.tasks}</TableCell>
                  <TableCell>
                    {e.active ? <StatusBadge tone="OPEN">active</StatusBadge> : <StatusBadge tone="ARCHIVED">inactive</StatusBadge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={setEnvironmentActive.bind(null, e.id, !e.active)}>
                      <Button variant="outline" size="xs">
                        {e.active ? 'Deactivate' : 'Activate'}
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
