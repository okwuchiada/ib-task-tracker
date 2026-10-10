import { redirect } from 'next/navigation';
import { signInWithGithub } from '@/lib/actions';
import { getCurrentUser } from '@/lib/session';

const ERRORS: Record<string, string> = {
  org: 'Your GitHub account is not a member of the allowed organization.',
  AccessDenied: 'Access denied.',
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect('/');
  const { error } = await searchParams;
  return (
    <div className="mx-auto mt-24 max-w-sm card p-8 text-center">
      <h1 className="text-lg font-semibold">Task Tracker</h1>
      <p className="mt-2 text-sm text-zinc-500">Sign in with the GitHub account you use for commits.</p>
      {error && <p className="mt-4 rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{ERRORS[error] ?? 'Sign-in failed.'}</p>}
      <form action={signInWithGithub} className="mt-6">
        <button className="btn btn-primary w-full">Sign in with GitHub</button>
      </form>
    </div>
  );
}
