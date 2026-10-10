import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { isOrgMember, upsertGithubUser, type GithubProfile } from './github';

declare module 'next-auth' {
  interface Session {
    userId?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub({ authorization: { params: { scope: 'read:user read:org' } } })],
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin', error: '/signin' },
  callbacks: {
    async signIn({ account }) {
      const org = process.env.ALLOWED_GITHUB_ORG?.trim();
      if (!org) return true;
      if (!account?.access_token) return false;
      return (await isOrgMember(account.access_token, org)) ? true : '/signin?error=org';
    },
    async jwt({ token, profile }) {
      // `profile` is only present on the sign-in request.
      if (profile) {
        const user = await upsertGithubUser(profile as unknown as GithubProfile);
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.uid === 'string') session.userId = token.uid;
      return session;
    },
  },
});
