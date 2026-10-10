import type { ApiGroup, ApiMeta, ApiTask, ApiUser, CreateTaskRequest } from '@task-tracker/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class ApiClient {
  constructor(
    private serverUrl: string,
    private token?: string,
  ) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.serverUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...init.headers,
        },
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      throw new ApiError(0, `Could not reach Task Tracker at ${this.serverUrl} (${describeFetchError(err)})`);
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`);
    return body as T;
  }

  exchangeGithubToken(githubToken: string, host: string) {
    return this.request<{ apiToken: string; user: ApiUser }>('/api/ext/auth', {
      method: 'POST',
      body: JSON.stringify({ githubToken }),
      headers: { 'x-client-host': host },
    });
  }

  meta() {
    return this.request<ApiMeta>('/api/ext/meta');
  }

  createTask(input: CreateTaskRequest) {
    return this.request<{ task: ApiTask }>('/api/tasks', { method: 'POST', body: JSON.stringify(input) });
  }

  myOpenTasks() {
    return this.request<{ tasks: ApiTask[] }>('/api/tasks?mine=1&status=OPEN&limit=200');
  }

  getTask(taskId: string) {
    return this.request<{ task: ApiTask }>(`/api/tasks/${encodeURIComponent(taskId)}`);
  }

  updateTaskStatus(taskId: string, status: ApiTask['status']) {
    return this.request<{ task: ApiTask }>(`/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  openGroups() {
    return this.request<{ groups: ApiGroup[] }>('/api/groups?status=OPEN');
  }

  createGroup(name: string) {
    return this.request<{ group: ApiGroup }>('/api/groups', { method: 'POST', body: JSON.stringify({ name }) });
  }

  addTaskToGroup(groupId: string, taskId: string) {
    return this.request<{ ok: true }>(`/api/groups/${encodeURIComponent(groupId)}/tasks`, {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    });
  }
}

/** fetch only says "fetch failed"; the useful part (ECONNREFUSED, a timeout, a proxy error…) is in `cause`. */
function describeFetchError(err: unknown): string {
  if (err instanceof Error && err.name === 'TimeoutError') return 'no response after 15s';
  const cause = err instanceof Error ? (err.cause as { code?: string; message?: string } | undefined) : undefined;
  return cause?.code || cause?.message || (err instanceof Error ? err.message : String(err));
}
