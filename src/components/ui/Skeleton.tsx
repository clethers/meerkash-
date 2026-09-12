import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-slate-200 dark:bg-white/10', className)} />;
}

/** A "label + input" row — the shape shared by nearly every form page. */
export function SkeletonField({
  labelWidth = 'w-24',
  className = 'h-10',
}: {
  labelWidth?: string;
  className?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Skeleton className={cn('h-3.5', labelWidth)} />
      <Skeleton className={cn('w-full rounded-xl', className)} />
    </div>
  );
}

/** A `.card` list of avatar + two-line rows — the shape shared by groups, friends, members and activity lists. */
export function SkeletonRows({
  count = 3,
  avatarClassName = 'h-11 w-11',
}: {
  count?: number;
  avatarClassName?: string;
}) {
  return (
    <ul className="card divide-y divide-slate-100 dark:divide-white/10 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 p-4">
          <Skeleton className={cn('shrink-0 rounded-full', avatarClassName)} />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-14" />
        </li>
      ))}
    </ul>
  );
}
