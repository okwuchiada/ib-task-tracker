import type { User } from '@prisma/client';
import { prisma } from './db';
import { HttpError } from './http';
import { getCurrentUser } from './session';
import { hashToken } from './tokens';

/** Resolves the caller from a `Bearer tt_…` API token (extension / git hooks) or the dashboard session. */
export async function getApiUser(req: Request): Promise<User | null> {
  const header = req.headers.get('authorization');
  if (header?.startsWith('Bearer ')) {
    const token = await prisma.apiToken.findUnique({
      where: { tokenHash: hashToken(header.slice(7).trim()) },
      include: { user: true },
    });
    if (!token || token.revokedAt) return null;
    if (!token.lastUsedAt || Date.now() - token.lastUsedAt.getTime() > 60_000) {
      await prisma.apiToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });
    }
    return token.user;
  }
  return getCurrentUser();
}

export async function requireApiUser(req: Request): Promise<User> {
  const user = await getApiUser(req);
  if (!user) throw new HttpError(401, 'Not signed in. Run "Task Tracker: Sign In" in VS Code.');
  return user;
}
