import { Skeleton, SkeletonField } from '@/components/ui/Skeleton';

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-8 w-20 rounded-xl" />
      </div>

      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
        <SkeletonField labelWidth="w-24" />
        <SkeletonField labelWidth="w-16" />
        <SkeletonField labelWidth="w-32" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}
