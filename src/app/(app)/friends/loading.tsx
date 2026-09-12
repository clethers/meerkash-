import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';

export default function FriendsLoading() {
  return (
    <div className="flex flex-1 flex-col space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Skeleton className="h-10 w-full rounded-xl" />

      <SkeletonRows count={4} />
    </div>
  );
}
