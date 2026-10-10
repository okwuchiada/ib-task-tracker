import { z } from 'zod';
import { TASK_TYPES } from './taskId';

export const extAuthRequest = z.object({ githubToken: z.string().min(1) });

export const createTaskRequest = z.object({
  projectId: z.string().min(1),
  environmentId: z.string().min(1),
  type: z.enum(TASK_TYPES),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  groupId: z.string().min(1).optional(),
});
export type CreateTaskRequest = z.infer<typeof createTaskRequest>;

export const updateTaskRequest = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(['OPEN', 'DONE', 'CANCELLED']).optional(),
});

export const recordCommitRequest = z.object({
  sha: z.string().regex(/^[0-9a-f]{7,64}$/i),
  repo: z.string().min(1).max(500),
  branch: z.string().max(500).default(''),
  message: z.string().min(1).max(20000),
  authorName: z.string().max(200).optional(),
  authorEmail: z.string().max(320).optional(),
  committedAt: z.coerce.date(),
});

/** The pre-push hook sends every pushed commit in one request. */
export const recordCommitsRequest = z.object({ commits: z.array(recordCommitRequest).min(1).max(500) });
export type RecordCommitRequest = z.infer<typeof recordCommitRequest>;

/** Per-commit outcome of POST /api/commits. Commits with no or an unknown task ID are skipped. */
export type RecordResult =
  | { sha: string; status: 'recorded'; taskId: string }
  | { sha: string; status: 'skipped'; reason: string };

export const createGroupRequest = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
});

export const addGroupTaskRequest = z.object({ taskId: z.string().min(1) });

/** Shapes returned to the extension. */
export interface ApiUser {
  id: string;
  login: string;
  name: string | null;
  role: 'ADMIN' | 'MEMBER';
}

export interface ApiTask {
  id: string;
  taskId: string;
  title: string;
  type: string;
  status: 'OPEN' | 'DONE' | 'CANCELLED';
  project: { code: string; name: string };
  environment: string;
  createdBy: string;
  createdAt: string;
}

export interface ApiMeta {
  projects: { id: string; code: string; name: string }[];
  environments: { id: string; name: string }[];
  taskTypes: string[];
}

export interface ApiGroup {
  id: string;
  name: string;
  status: 'OPEN' | 'SHIPPED' | 'ARCHIVED';
  taskCount: number;
}
