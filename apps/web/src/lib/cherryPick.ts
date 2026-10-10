export interface PickCommit {
  sha: string;
  repo: string;
  branch: string;
  message: string;
  committedAt: Date;
  taskId: string;
  cherryPickOf: string | null;
}

export interface RepoPlan {
  repo: string;
  /** Original commits, oldest first: the order to cherry-pick them in. */
  commits: PickCommit[];
  /** Commits that are themselves cherry-picks (`-x` trailer) of another commit; not picked again. */
  copies: PickCommit[];
}

/** Groups commits by repo and orders them for cherry-picking. */
export function planCherryPick(commits: PickCommit[]): RepoPlan[] {
  const byRepo = new Map<string, RepoPlan>();
  const seen = new Set<string>();
  for (const c of commits) {
    const key = `${c.repo}@${c.sha}`;
    if (seen.has(key)) continue; // same commit linked through two tasks
    seen.add(key);
    let plan = byRepo.get(c.repo);
    if (!plan) {
      plan = { repo: c.repo, commits: [], copies: [] };
      byRepo.set(c.repo, plan);
    }
    (c.cherryPickOf ? plan.copies : plan.commits).push(c);
  }
  const byDate = (a: PickCommit, b: PickCommit) =>
    a.committedAt.getTime() - b.committedAt.getTime() || a.sha.localeCompare(b.sha);
  return [...byRepo.values()]
    .map((p) => ({ ...p, commits: p.commits.sort(byDate), copies: p.copies.sort(byDate) }))
    .sort((a, b) => a.repo.localeCompare(b.repo));
}
