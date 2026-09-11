import { ExpenseFormSkeleton } from '@/components/expenses/ExpenseFormSkeleton';
import { Skeleton } from '@/components/ui/Skeleton';

export default function EditExpenseLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-28" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      <ExpenseFormSkeleton />
    </div>
  );
}
