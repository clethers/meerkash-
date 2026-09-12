import { GroupHeaderSkeleton } from '@/components/groups/GroupHeaderSkeleton';
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';

export default function MembersLoading() {
  return (
    <div className="space-y-6">
      <GroupHeaderSkeleton />

      <div className="card space-y-3 p-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full rounded-xl" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <SkeletonRows count={3} avatarClassName="h-[38px] w-[38px]" />
      </div>
    </div>
  );
}
