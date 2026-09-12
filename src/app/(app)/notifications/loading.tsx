import { Skeleton } from '@/components/ui/Skeleton';

export default function NotificationsLoading() {
  return (
    <div className="flex flex-1 flex-col space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="card divide-y divide-slate-100 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2 px-4 py-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
