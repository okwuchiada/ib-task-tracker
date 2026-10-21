import Link from 'next/link';
import { createGroup } from '@/lib/actions';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { Empty, Field, formatDate, PageHeader, StatusBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
      <Card size="sm" className="mb-6">
        <form action={createGroup} className="flex flex-wrap items-end gap-3 px-(--card-spacing)">
          <Field label="Name">
            <Input name="name" required minLength={2} placeholder="Release 2026-10-15" className="w-64" />
          </Field>
          <Field label="Description" className="flex-1">
            <Input name="description" placeholder="Optional" />
          </Field>
          <Button>New group</Button>
        </form>
      </Card>

      <Card className="py-0">
        {groups.length === 0 ? (
          <Empty>No groups yet.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="whitespace-normal">
                    <Link href={`/groups/${g.id}`} className="link">
                      {g.name}
                    </Link>
                    {g.description && <div className="text-xs text-muted-foreground">{g.description}</div>}
                  </TableCell>
                  <TableCell>
                    <StatusBadge>{g.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{g._count.items}</TableCell>
                  <TableCell>{g.createdBy.login}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(g.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
