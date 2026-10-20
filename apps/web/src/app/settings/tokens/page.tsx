import { revokeToken } from '@/lib/actions';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { Empty, formatDateTime, PageHeader, StatusBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default async function TokensPage() {
  const user = await requireUser();
  const tokens = await prisma.apiToken.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });

  return (
    <>
      <PageHeader
        title="Extension tokens"
        description="One token is created each time you sign in from VS Code. Revoke any you no longer use."
      />
      <Card className="py-0">
        {tokens.length === 0 ? (
          <Empty>No tokens. Run “Task Tracker: Sign In” in VS Code.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.label}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(t.createdAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{t.lastUsedAt ? formatDateTime(t.lastUsedAt) : 'never'}</TableCell>
                  <TableCell className="text-right">
                    {t.revokedAt ? (
                      <StatusBadge tone="ARCHIVED">revoked</StatusBadge>
                    ) : (
                      <form action={revokeToken.bind(null, t.id)}>
                        <Button variant="destructive" size="xs">
                          Revoke
                        </Button>
                      </form>
                    )}
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
