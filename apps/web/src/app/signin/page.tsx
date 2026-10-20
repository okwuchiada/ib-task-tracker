import { redirect } from 'next/navigation';
import { signInWithGithub } from '@/lib/actions';
import { getCurrentUser } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const ERRORS: Record<string, string> = {
  org: 'Your GitHub account is not a member of the allowed organization.',
  AccessDenied: 'Access denied.',
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect('/');
  const { error } = await searchParams;
  return (
    <Card className="mx-auto mt-24 max-w-sm text-center">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Task Tracker</CardTitle>
        <CardDescription>Sign in with the GitHub account you use for commits.</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{ERRORS[error] ?? 'Sign-in failed.'}</p>
        )}
        <form action={signInWithGithub}>
          <Button className="w-full">Sign in with GitHub</Button>
        </form>
      </CardContent>
    </Card>
  );
}
