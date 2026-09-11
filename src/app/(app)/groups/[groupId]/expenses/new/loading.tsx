import { ExpenseFormSkeleton } from '@/components/expenses/ExpenseFormSkeleton';
import { Skeleton } from '@/components/ui/Skeleton';

export default function NewExpenseLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-7 w-36" />
      <ExpenseFormSkeleton />
    </div>
  );
}
