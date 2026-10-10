import { recordCommitsRequest } from '@task-tracker/shared';
import { requireApiUser } from '@/lib/apiAuth';
import { recordCommits } from '@/lib/commits';
import { handle, json } from '@/lib/http';

/** Called by the pre-push hook with every commit being pushed. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  const { commits } = recordCommitsRequest.parse(await req.json());
  return json({ results: await recordCommits(user, commits) });
});
