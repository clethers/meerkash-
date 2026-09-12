import { Skeleton } from '@/components/ui/Skeleton';

/** Matches GroupHeader's layout so the tab row doesn't jump once real data lands. */
export function GroupHeaderSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 pb-px">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-t-lg" />
        ))}
      </div>
    </div>
  );
}
