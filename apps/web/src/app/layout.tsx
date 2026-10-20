import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOutAction } from '@/lib/actions';
import { getCurrentUser } from '@/lib/session';
import { cn } from '@/lib/utils';
import { ThemeToggle, themeInitScript } from '@/components/ThemeToggle';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/ui/button';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Task Tracker',
  description: 'Task IDs, commits and cherry-pick groups for the team',
};

const NAV_LINK = 'text-muted-foreground transition-colors hover:text-foreground';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    // The init script sets the .dark class before hydration, so React would otherwise warn about it.
    <html lang="en" suppressHydrationWarning className={cn('font-sans', inter.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        {user && (
          <header className="border-b bg-card">
            <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
              <Link href="/" className="font-semibold tracking-tight">
                Task Tracker
              </Link>
              <Link href="/" className={NAV_LINK}>
                Tasks
              </Link>
              <Link href="/groups" className={NAV_LINK}>
                Groups
              </Link>
              {user.role === 'ADMIN' && (
                <>
                  <Link href="/admin/users" className={NAV_LINK}>
                    Team &amp; access
                  </Link>
                  <Link href="/admin/projects" className={NAV_LINK}>
                    Projects
                  </Link>
                  <Link href="/admin/environments" className={NAV_LINK}>
                    Environments
                  </Link>
                </>
              )}
              <div className="ml-auto flex items-center gap-3">
                <ThemeToggle />
                <Link href="/settings/tokens" className={cn('flex items-center gap-2', NAV_LINK)}>
                  <Avatar src={user.avatarUrl} login={user.login} className="size-6" />
                  {user.login}
                </Link>
                <form action={signOutAction}>
                  <Button variant="outline" size="sm">
                    Sign out
                  </Button>
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
