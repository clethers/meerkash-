import { GroupHeaderSkeleton } from '@/components/groups/GroupHeaderSkeleton';
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';

export default function ActivityLoading() {
  return (
    <div className="flex flex-1 flex-col space-y-6">
      <GroupHeaderSkeleton />

      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3.5 w-64" />
      </div>

      <SkeletonRows count={6} avatarClassName="h-[30px] w-[30px]" />
    </div>
  );
}
