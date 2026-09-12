import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SectionLabel({
  as: Tag = 'h2',
  children,
  className,
}: {
  as?: 'h2' | 'h3';
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag className={cn('text-sm font-semibold text-slate-700 dark:text-slate-200', className)}>
      {children}
    </Tag>
  );
}
