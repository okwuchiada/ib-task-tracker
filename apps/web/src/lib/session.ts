import { redirect } from 'next/navigation';
import { auth } from './auth';
import { prisma } from './db';

/** Reads the user fresh from the DB so role/access changes apply immediately. */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.userId) return null;
  return prisma.user.findUnique({ where: { id: session.userId } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/signin');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/');
  return user;
}
