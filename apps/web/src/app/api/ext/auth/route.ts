import { extAuthRequest, type ApiUser } from '@task-tracker/shared';
import { prisma } from '@/lib/db';
import { assertOrgAllowed, fetchGithubUser, upsertGithubUser } from '@/lib/github';
import { handle, json } from '@/lib/http';
import { generateApiToken, hashToken } from '@/lib/tokens';

/** Exchanges a GitHub token from VS Code's built-in GitHub auth for a Task Tracker API token. */
export const POST = handle(async (req: Request) => {
  const { githubToken } = extAuthRequest.parse(await req.json());
  const profile = await fetchGithubUser(githubToken);
  await assertOrgAllowed(githubToken);
  const user = await upsertGithubUser(profile);

  const apiToken = generateApiToken();
  const host = req.headers.get('x-client-host')?.slice(0, 80) || 'unknown host';
  await prisma.apiToken.create({
    data: { userId: user.id, tokenHash: hashToken(apiToken), label: `VS Code (${host})` },
  });

  const apiUser: ApiUser = { id: user.id, login: user.login, name: user.name, role: user.role };
  return json({ apiToken, user: apiUser });
});
