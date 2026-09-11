import { Skeleton, SkeletonField } from '@/components/ui/Skeleton';

export default function SettleWithFriendLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-7 w-44" />

      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <SkeletonField labelWidth="w-20" />
        <SkeletonField labelWidth="w-28" className="h-16" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}
