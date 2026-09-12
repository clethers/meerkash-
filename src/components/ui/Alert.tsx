import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function Alert({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'error' | 'success' | 'warning';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    info: 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10',
    error: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-900/50',
    success: 'bg-brand-50 dark:bg-brand-950/40 text-brand-800 dark:text-brand-200 border-brand-200 dark:border-brand-900/50',
    warning: 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-900/50',
  } as const;

  return (
    <div className={cn('rounded-xl border px-4 py-3 text-sm', tones[tone], className)} role="status">
      {children}
    </div>
  );
}
