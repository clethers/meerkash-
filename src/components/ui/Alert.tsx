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
    info: 'bg-slate-100 text-slate-700 border-slate-200',
    error: 'bg-rose-50 text-rose-800 border-rose-200',
    success: 'bg-brand-50 text-brand-800 border-brand-200',
    warning: 'bg-amber-50 text-amber-900 border-amber-200',
  } as const;

  return (
    <div className={cn('rounded-xl border px-4 py-3 text-sm', tones[tone], className)} role="status">
      {children}
    </div>
  );
}
