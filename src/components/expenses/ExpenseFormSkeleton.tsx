import { Skeleton, SkeletonField } from '@/components/ui/Skeleton';

/** Matches ExpenseForm's/DirectExpenseForm's layout — shared by the new-expense and edit-expense pages, for both groups and friends. */
export function ExpenseFormSkeleton() {
  return (
    <div className="card space-y-4 p-5">
      <SkeletonField labelWidth="w-32" />
      <SkeletonField labelWidth="w-16" />
      <SkeletonField labelWidth="w-20" />
      <SkeletonField labelWidth="w-20" />

      <div className="space-y-1.5">
        <Skeleton className="h-3.5 w-24" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>

      <SkeletonField labelWidth="w-28" className="h-16" />
      <Skeleton className="h-10 w-40 rounded-xl" />
    </div>
  );
}
