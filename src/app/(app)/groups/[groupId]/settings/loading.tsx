import { GroupHeaderSkeleton } from '@/components/groups/GroupHeaderSkeleton';
import { Skeleton, SkeletonField } from '@/components/ui/Skeleton';

export default function GroupSettingsLoading() {
  return (
    <div className="space-y-6">
      <GroupHeaderSkeleton />

      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        <SkeletonField labelWidth="w-20" />
        <SkeletonField labelWidth="w-32" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      <Skeleton className="h-16 rounded-xl" />
    </div>
  );
}
