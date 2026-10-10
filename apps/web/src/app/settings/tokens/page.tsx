import { revokeToken } from '@/lib/actions';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { Badge, Empty, formatDateTime, PageHeader } from '@/components/ui';

export default async function TokensPage() {
  const user = await requireUser();
  const tokens = await prisma.apiToken.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });

  return (
    <>
      <PageHeader
        title="Extension tokens"
        description="One token is created each time you sign in from VS Code. Revoke any you no longer use."
      />
      <div className="card overflow-x-auto">
        {tokens.length === 0 ? (
          <Empty>No tokens. Run “Task Tracker: Sign In” in VS Code.</Empty>
        ) : (
          <table className="table w-full">
            <thead>
              <tr>
                <th>Label</th>
                <th>Created</th>
                <th>Last used</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id}>
                  <td>{t.label}</td>
                  <td className="text-zinc-500">{formatDateTime(t.createdAt)}</td>
                  <td className="text-zinc-500">{t.lastUsedAt ? formatDateTime(t.lastUsedAt) : 'never'}</td>
                  <td className="text-right">
                    {t.revokedAt ? (
                      <Badge tone="ARCHIVED">revoked</Badge>
                    ) : (
                      <form action={revokeToken.bind(null, t.id)}>
                        <button className="btn btn-sm">Revoke</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
