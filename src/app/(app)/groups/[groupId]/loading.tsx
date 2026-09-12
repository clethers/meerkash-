import { GroupHeaderSkeleton } from '@/components/groups/GroupHeaderSkeleton';
import { Skeleton } from '@/components/ui/Skeleton';

export default function GroupLoading() {
  return (
    <div className="space-y-6">
      <GroupHeaderSkeleton />

      <div className="card overflow-hidden">
        <div className="space-y-2 px-5 py-4">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="space-y-3 border-t border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-16 rounded-2xl" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-36 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
