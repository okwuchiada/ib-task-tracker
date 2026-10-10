import type { User } from '@prisma/client';
import { prisma } from './db';
import { HttpError } from './http';

export interface GithubProfile {
  id: number | string;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
}

const GH_HEADERS = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };

export async function fetchGithubUser(accessToken: string): Promise<GithubProfile> {
  const res = await fetch('https://api.github.com/user', {
    headers: { ...GH_HEADERS, Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new HttpError(401, 'GitHub token rejected');
  return (await res.json()) as GithubProfile;
}

export async function isOrgMember(accessToken: string, org: string): Promise<boolean> {
  const res = await fetch(`https://api.github.com/user/memberships/orgs/${encodeURIComponent(org)}`, {
    headers: { ...GH_HEADERS, Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) return false;
  const body = (await res.json()) as { state?: string };
  return body.state === 'active';
}

/** Throws 403 when ALLOWED_GITHUB_ORG is set and the token's user is not an active member. */
export async function assertOrgAllowed(accessToken: string): Promise<void> {
  const org = process.env.ALLOWED_GITHUB_ORG?.trim();
  if (org && !(await isOrgMember(accessToken, org))) {
    throw new HttpError(403, `You must be a member of the ${org} GitHub organization`);
  }
}

function adminLogins(): Set<string> {
  return new Set(
    (process.env.ADMIN_GITHUB_LOGINS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Creates or refreshes the user for a GitHub profile. Logins in ADMIN_GITHUB_LOGINS are promoted, never demoted. */
export async function upsertGithubUser(profile: GithubProfile): Promise<User> {
  const githubId = String(profile.id);
  const isBootstrapAdmin = adminLogins().has(profile.login.toLowerCase());
  return prisma.user.upsert({
    where: { githubId },
    create: {
      githubId,
      login: profile.login,
      name: profile.name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      role: isBootstrapAdmin ? 'ADMIN' : 'MEMBER',
    },
    update: {
      login: profile.login,
      name: profile.name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      ...(isBootstrapAdmin ? { role: 'ADMIN' } : {}),
    },
  });
}
