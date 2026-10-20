import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOutAction } from '@/lib/actions';
import { getCurrentUser } from '@/lib/session';
import { ThemeToggle, themeInitScript } from '@/components/ThemeToggle';
import './globals.css';

export const metadata: Metadata = {
  title: 'Task Tracker',
  description: 'Task IDs, commits and cherry-pick groups for the team',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    // The init script sets data-theme before hydration, so React would otherwise warn about it.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {user && (
          <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
              <Link href="/" className="font-semibold tracking-tight">
                Task Tracker
              </Link>
              <Link href="/" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                Tasks
              </Link>
              <Link href="/groups" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                Groups
              </Link>
              {user.role === 'ADMIN' && (
                <>
                  <Link href="/admin/users" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                    Team &amp; access
                  </Link>
                  <Link href="/admin/projects" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                    Projects
                  </Link>
                  <Link href="/admin/environments" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                    Environments
                  </Link>
                </>
              )}
              <div className="ml-auto flex items-center gap-3">
                <ThemeToggle />
                <Link href="/settings/tokens" className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  {user.avatarUrl && <img src={user.avatarUrl} alt="" className="h-6 w-6 rounded-full" />}
                  {user.login}
                </Link>
                <form action={signOutAction}>
                  <button className="btn btn-sm">Sign out</button>
                </form>
              </div>
            </nav>
          </header>
        )}
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
