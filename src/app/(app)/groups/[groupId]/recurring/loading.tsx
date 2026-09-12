import { GroupHeaderSkeleton } from '@/components/groups/GroupHeaderSkeleton';
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';

export default function RecurringLoading() {
  return (
    <div className="space-y-6">
      <GroupHeaderSkeleton />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3.5 w-72" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <SkeletonRows count={3} avatarClassName="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}
