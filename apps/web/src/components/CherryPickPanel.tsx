'use client';

import { buildCherryPickCommand } from '@task-tracker/shared';
import { useMemo, useState } from 'react';
import { CopyButton } from './CopyButton';

export interface PanelCommit {
  sha: string;
  branch: string;
  subject: string;
  committedAt: string;
  taskId: string;
}

export interface PanelRepo {
  repo: string;
  commits: PanelCommit[];
  copies: PanelCommit[];
}

export function CherryPickPanel({ repos }: { repos: PanelRepo[] }) {
  const branches = useMemo(
    () => [...new Set(repos.flatMap((r) => r.commits.map((c) => c.branch)))].sort(),
    [repos],
  );
  const [branch, setBranch] = useState('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const toggle = (sha: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(sha)) next.delete(sha);
      else next.add(sha);
      return next;
    });

  if (repos.length === 0) {
    return <p className="p-4 text-sm text-zinc-500">No pushed commits in this group yet.</p>;
  }

  return (
    <div className="space-y-6 p-4">
      {branches.length > 1 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500">Only commits first pushed to</span>
          <select className="input" value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">any branch</option>
            {branches.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
      )}

      {repos.map((r) => {
        const visible = r.commits.filter((c) => !branch || c.branch === branch);
        const picked = visible.filter((c) => !excluded.has(c.sha));
        const cmd = buildCherryPickCommand(picked.map((c) => c.sha));
        return (
          <div key={r.repo}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="font-mono text-sm font-medium">{r.repo}</h3>
              <span className="text-xs text-zinc-500">
                {picked.length} of {visible.length} selected
              </span>
            </div>
            <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {visible.map((c) => (
                <li key={c.sha}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <input type="checkbox" className="mt-1" checked={!excluded.has(c.sha)} onChange={() => toggle(c.sha)} />
                    <span className="font-mono text-xs text-zinc-500">{c.sha.slice(0, 10)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.subject}</span>
                      <span className="text-xs text-zinc-500">
                        {c.branch} · {new Date(c.committedAt).toLocaleString('en-GB')}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {r.copies.length > 0 && (
              <p className="mt-2 text-xs text-zinc-500">
                {r.copies.length} commit{r.copies.length > 1 ? 's are' : ' is'} already a cherry-pick of another commit and
                left out.
              </p>
            )}
            <div className="mt-3 flex items-start gap-2">
              <code className="flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-800">
                {cmd || '# nothing selected'}
              </code>
              <CopyButton text={cmd} label="Copy command" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
