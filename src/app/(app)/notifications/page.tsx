import { NotificationList } from '@/components/NotificationList';
import { EmptyState } from '@/components/ui/EmptyState';
import { getNotifications } from '@/lib/actions/notifications';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const notifications = await getNotifications();

  return (
    <div className="flex flex-1 flex-col space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Notifications</h1>
        <p className="mt-1 text-sm text-slate-600">
          Only things that affect your balance, your expenses or your access to a group.
        </p>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            title="Nothing to catch up on"
            description="You'll hear from us when someone adds you to an expense, sends a payment, or changes something that moves your balance."
          />
        </div>
      ) : (
        <NotificationList notifications={notifications} />
      )}
    </div>
  );
}
