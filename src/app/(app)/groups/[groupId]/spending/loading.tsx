import { GroupHeaderSkeleton } from '@/components/groups/GroupHeaderSkeleton';
import { Skeleton } from '@/components/ui/Skeleton';

export default function SpendingLoading() {
  return (
    <div className="flex flex-1 flex-col space-y-6">
      <GroupHeaderSkeleton />

      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>

      <div className="card space-y-4 p-4">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-24 shrink-0" />
            <Skeleton className="h-3 flex-1 rounded-full" />
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>

      <div className="card space-y-4 p-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    </div>
  );
}
