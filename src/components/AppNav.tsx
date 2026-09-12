import { getUnreadCount } from '@/lib/actions/notifications';
import { getMyGroupsList } from '@/lib/data/groups';
import { AppNavClient } from './AppNavClient';

// Fetched here (rather than passed down from the layout) so it runs in
// parallel with the page's own data instead of blocking the whole tree —
// same reasoning as AppDock.
export async function AppNav() {
  const [groups, unread] = await Promise.all([getMyGroupsList(), getUnreadCount()]);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <AppNavClient groups={groups} unread={unread} />
    </header>
  );
}
