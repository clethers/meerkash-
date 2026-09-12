import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ink/20 dark:border-white/15 bg-receipt dark:bg-white/5 px-6 py-12 text-center">
      <p className="font-medium text-slate-800 dark:text-slate-100">{title}</p>
      {description ? <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
      {action}
    </div>
  );
}
