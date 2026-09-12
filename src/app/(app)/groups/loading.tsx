import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton';

export default function GroupsLoading() {
  return (
    <div className="flex flex-1 flex-col space-y-6">
      <div className="flex gap-4 px-0.5 pb-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex w-14 shrink-0 flex-col items-center gap-1.5">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-2.5 w-10" />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      <div className="space-y-1.5">
        <Skeleton className="h-4 w-28" />
        <SkeletonRows count={2} avatarClassName="h-[30px] w-[30px]" />
      </div>

      <SkeletonRows count={4} />
    </div>
  );
}
