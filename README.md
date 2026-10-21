# Task Tracker

Every commit carries a task ID so fixes and features are easy to find and cherry-pick:

```
feat(IPO-Prod-fix-Q123450): Readjust the layout of invest app
     └┬┘ └┬─┘ └┬┘ └──┬──┘
  project env type  number (random 6 digits, unique per project)
```

- **VS Code extension** (`apps/extension`): sign in with GitHub, create a task ID, and get the commit box pre-filled. It also installs git hooks that check task IDs and record pushed commits.
- **Dashboard + API** (`apps/web`): Next.js 15, Prisma 6 and Neon Postgres. It shows every task with its developer, project and commits, groups related tasks, and generates cherry-pick commands.
- **Shared rules** (`packages/shared`): the task ID and commit message format, used by both.

## How it works

1. A developer runs **Task Tracker: Create Task** and picks the project, environment and type, then enters a title. The server returns a new ID with a random 6-digit number, e.g. `IPO-Prod-fix-Q482913`, which becomes the active task (shown in the status bar).
2. The commit box is pre-filled with `fix(IPO-Prod-fix-Q482913): `. If you use VS Code's commit message generator (the sparkle button), the extension puts the task ID back into the generated message: `feat: add toggle` becomes `feat(IPO-Prod-fix-Q482913): add toggle`, and a message without a type gets the task's type. Turn this off with `taskTracker.keepTaskIdInGeneratedMessages`.
3. The **commit-msg** hook rejects messages without a valid `type(TASK-ID): description` and IDs the server doesn't know. If the server can't be reached, it only checks the format and prints a warning. Merge, revert, `fixup!` and `squash!` messages are allowed through.
4. The **pre-push** hook sends the commits being pushed to the dashboard. Only pushed commits are recorded, so local commits that were amended or rebased never appear. It reports any commit the server skipped (for example an unknown task ID). If the server is down, commits are queued in `~/.config/task-tracker/queue.jsonl` and sent with the next push. A push is never blocked.

   The **Record commits** workflow (`.github/workflows/record-commits.yml`) does the same from GitHub on every push, so commits are recorded even for teammates without the hook. To turn it on, create a token on the dashboard under **Extension tokens** and add it as the repository secret `TASK_TRACKER_TOKEN` (**Settings → Secrets and variables → Actions**). Set the variable `TASK_TRACKER_URL` only if the dashboard isn't at the default production URL. Sending a commit twice is harmless.
5. On GitHub, the **Commit messages** workflow (`.github/workflows/commit-messages.yml`) checks every new commit in each push and pull request with the same rule, so commits made with `--no-verify` or without the extension are still caught. Make it a required status check on `main` so commits with bad messages can't be merged.
6. On the dashboard, put related tasks into a **group** (a release, a feature). The group page lists every commit from all of its tasks, oldest first, grouped by repo, with a `git cherry-pick -x …` command. Commits that are themselves cherry-picks (they carry the `-x` trailer) are left out, so they aren't picked twice.

### Who sees what

| | Sees | Can edit |
|---|---|---|
| Admin | everything | everything, plus projects, environments, team access |
| Member | own tasks, plus projects an admin shared with them, or everything if "View all projects" is on | own tasks and groups |

Admins manage this under **Team & access**. The commit-msg hook accepts any real task ID, whoever owns it, so working on a teammate's task is fine.

## Setup

Requirements: Node 20+ (24 recommended), git, and a [Neon](https://neon.tech) database.

```bash
npm install
cp apps/web/.env.example apps/web/.env   # then fill it in, see below
```

### 1. Neon

In the Neon console, copy two connection strings into `apps/web/.env`:
- `DATABASE_URL`: the **pooled** connection string (its host contains `-pooler`).
- `DIRECT_URL`: the direct connection string (used for migrations).

```bash
cd apps/web
npx prisma migrate deploy            # creates the tables from prisma/migrations
npm run db:seed                      # environments Prod/Staging/Dev and project IPO
```

### 2. GitHub OAuth app (dashboard login)

GitHub → Settings → Developer settings → **OAuth Apps** → New:
- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

Put the client ID and secret in `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`. Generate `AUTH_SECRET` with `openssl rand -base64 32`. Put your GitHub login in `ADMIN_GITHUB_LOGINS`. Optionally, set `ALLOWED_GITHUB_ORG` to restrict sign-in to members of your organization.

For production, create a second OAuth app whose URLs use your deployed domain.

### 3. Run the dashboard

```bash
npm run dev            # from the repo root, http://localhost:3000
```

### 4. Build and install the extension

```bash
cd apps/extension
npm run package        # produces task-tracker-0.2.0.vsix
code --install-extension task-tracker-0.2.0.vsix
```

To publish a build for the team, bump `version` in `apps/extension/package.json`, commit, then push a matching tag (`git tag ext-v0.2.0 && git push origin ext-v0.2.0`). The **Release extension** workflow runs the tests, packages the `.vsix` and attaches it to a GitHub Release.

Share the `.vsix` with the team. In VS Code, set **Task Tracker: Server Url** (`taskTracker.serverUrl`) to the dashboard URL, then run **Task Tracker: Sign In**. VS Code's built-in GitHub login is used, so there are no passwords.

To develop the extension, open `apps/extension` in VS Code and press **F5**.

### Repos that use husky (or another hook manager)

If a repo sets `core.hooksPath`, the extension doesn't overwrite your hooks. It opens a snippet to add to `.husky/commit-msg` and `.husky/pre-push` instead:

```sh
node "$(git rev-parse --git-common-dir)/task-tracker/commit-msg.js" "$1"
node "$(git rev-parse --git-common-dir)/task-tracker/pre-push.js" "$@"
```

Existing plain `.git/hooks` scripts are kept and called first.

## Deploying (Vercel)

1. Import the repo and set **Root Directory** to `apps/web`.
2. Add the same environment variables as in `.env`.
3. Set the build command to `prisma migrate deploy && next build`.

## Extension commands

| Command | What it does |
|---|---|
| Task Tracker: Sign In / Sign Out | GitHub sign-in; stores an API token |
| Task Tracker: Create Task | project → environment → type → title → optional group |
| Task Tracker: Select Task | switch the active task (yours, or any ID) |
| Task Tracker: Insert Task ID in Commit Message | also a button in the Source Control title bar |
| Task Tracker: Copy Active Task ID | |
| Task Tracker: Add Active Task to Group | |
| Task Tracker: Mark Active Task Done | |
| Task Tracker: Install Git Hooks | the extension also offers this once per repo |
| Task Tracker: Open Dashboard | |

## Development

After changing `apps/web/prisma/schema.prisma`, run `npx prisma migrate dev --name <change>` in `apps/web` and commit the new folder in `prisma/migrations`.

```bash
npm test               # all unit tests
npm run typecheck      # all workspaces
```

API routes (all accept `Authorization: Bearer <token>` or a dashboard session):

| Method | Path | |
|---|---|---|
| POST | `/api/ext/auth` | GitHub token → API token |
| GET | `/api/ext/meta` | projects, environments, task types |
| GET/POST | `/api/tasks` | list (with dashboard filters, `mine=1`) / create |
| GET/PATCH | `/api/tasks/:taskId` | read / update title, description, status |
| GET | `/api/tasks/:taskId/exists` | used by the commit-msg hook |
| GET | `/api/tasks/export` | CSV with the same filters |
| POST | `/api/commits` | used by the pre-push hook |
| GET/POST | `/api/groups` | list / create |
| POST | `/api/groups/:id/tasks` | add a task |
| DELETE | `/api/groups/:id/tasks/:taskId` | remove a task |
