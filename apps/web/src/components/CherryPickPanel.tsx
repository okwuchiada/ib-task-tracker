'use client';

import { buildCherryPickCommand } from '@task-tracker/shared';
import { useMemo, useState } from 'react';
import { CopyButton } from './CopyButton';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

/** Radix Select can't have an empty value, so "any branch" uses this. */
const ANY_BRANCH = '__any__';

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
    return <p className="p-4 text-sm text-muted-foreground">No pushed commits in this group yet.</p>;
  }

  return (
    <div className="space-y-6 p-4">
      {branches.length > 1 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Only commits first pushed to</span>
          <Select value={branch || ANY_BRANCH} onValueChange={(v) => setBranch(v === ANY_BRANCH ? '' : v)}>
            <SelectTrigger size="sm" aria-label="Branch">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_BRANCH}>any branch</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
              <span className="text-xs text-muted-foreground">
                {picked.length} of {visible.length} selected
              </span>
            </div>
            <ul className="divide-y rounded-md border">
              {visible.map((c) => (
                <li key={c.sha}>
                  <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                    <Checkbox className="mt-0.5" checked={!excluded.has(c.sha)} onCheckedChange={() => toggle(c.sha)} />
                    <span className="font-mono text-xs text-muted-foreground">{c.sha.slice(0, 10)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.subject}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.branch} · {new Date(c.committedAt).toLocaleString('en-GB')}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {r.copies.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {r.copies.length} commit{r.copies.length > 1 ? 's are' : ' is'} already a cherry-pick of another commit and
                left out.
              </p>
            )}
            <div className="mt-3 flex items-start gap-2">
              <code className="flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted p-2 text-xs">
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
