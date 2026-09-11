import { Skeleton } from '@/components/ui/Skeleton';

export default function SettleUpLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-7 w-40" />

      <div className="space-y-3">
        <Skeleton className="h-3.5 w-28" />
        <div className="card space-y-3 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
          <Skeleton className="h-9 w-full rounded-xl" />
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-3.5 w-24" />
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
