import { getUnreadCount } from '@/lib/actions/notifications';
import { getMyGroupsList } from '@/lib/data/groups';
import { AppNavClient } from './AppNavClient';

// Fetched here (rather than passed down from the layout) so it runs in
// parallel with the page's own data instead of blocking the whole tree —
// same reasoning as AppDock.
export async function AppNav() {
  const [groups, unread] = await Promise.all([getMyGroupsList(), getUnreadCount()]);

  return (
    <div className="sticky top-3 z-20 mx-auto w-full max-w-4xl px-4">
      <AppNavClient groups={groups} unread={unread} />
    </div>
  );
}
