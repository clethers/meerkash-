'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { AddExpenseButton } from '@/components/AddExpenseButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Wordmark } from '@/components/Wordmark';
import { GLASS_SURFACE } from '@/lib/ui/glass';
import { cn } from '@/lib/utils';
import type { Group } from '@/types/db';

export function AppNavClient({ groups, unread }: { groups: Group[]; unread: number }) {
  return (
    <nav className={cn('relative flex h-16 items-center justify-between rounded-3xl px-4', GLASS_SURFACE)}>
      <AddExpenseButton groups={groups} />

      <Link href="/groups" className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
        <Wordmark />
      </Link>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Link
          href="/notifications"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          className={cn(
            'relative flex h-11 w-11 items-center justify-center rounded-full text-slate-600 dark:text-slate-300',
            'transition-[background-color,transform] duration-200 ease-out',
            'hover:scale-110 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 motion-reduce:hover:scale-100',
          )}
        >
          <Bell size={20} />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-night" />
          ) : null}
        </Link>
      </div>
    </nav>
  );
}
