import type { Prisma } from '@prisma/client';

export interface TaskFilterParams {
  q?: string;
  project?: string;
  env?: string;
  type?: string;
  dev?: string;
  status?: string;
  from?: string;
  to?: string;
}

const STATUSES = new Set(['OPEN', 'DONE', 'CANCELLED']);

/** Turns dashboard query-string filters into a Prisma `where` (combined with visibility by the caller). */
export function buildTaskFilterWhere(p: TaskFilterParams): Prisma.TaskWhereInput {
  const and: Prisma.TaskWhereInput[] = [];
  if (p.q?.trim()) {
    const q = p.q.trim();
    and.push({
      OR: [
        { taskId: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  if (p.project) and.push({ project: { code: p.project } });
  if (p.env) and.push({ environment: { name: p.env } });
  if (p.type) and.push({ type: p.type });
  if (p.dev) and.push({ createdBy: { login: p.dev } });
  if (p.status && STATUSES.has(p.status)) and.push({ status: p.status as 'OPEN' | 'DONE' | 'CANCELLED' });
  const from = p.from ? new Date(p.from) : null;
  const to = p.to ? new Date(p.to) : null;
  if (from && !isNaN(from.getTime())) and.push({ createdAt: { gte: from } });
  if (to && !isNaN(to.getTime())) {
    to.setUTCDate(to.getUTCDate() + 1); // inclusive end date
    and.push({ createdAt: { lt: to } });
  }
  return and.length ? { AND: and } : {};
}
