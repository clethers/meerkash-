import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';

export default function FriendLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-20" />

      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-48" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="space-y-2 px-5 py-4">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-36 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-16" />
        <SkeletonRows count={4} avatarClassName="h-4 w-4 rounded-none" />
      </div>
    </div>
  );
}
