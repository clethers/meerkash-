import { Skeleton } from '@/components/ui/Skeleton';

export default function ExpenseDetailLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-32" />

      <div className="card p-5">
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-3.5 w-2/5" />
          </div>
          <Skeleton className="h-7 w-20 shrink-0" />
        </div>

        <Skeleton className="mt-4 h-4 w-1/2" />

        <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>

        <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
          <Skeleton className="h-8 w-20 rounded-xl" />
          <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </div>
  );
}
