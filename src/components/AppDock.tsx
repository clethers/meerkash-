import { getUnreadCount } from '@/lib/actions/notifications';
import { getIncomingFriendRequests } from '@/lib/data/friends';
import { getCurrentUser } from '@/lib/data/groups';
import { AppDockClient } from './AppDockClient';

// Fetched here (rather than passed down from the layout) so it runs in
// parallel with the page's own data instead of blocking the whole tree —
// same reasoning as AppNav.
export async function AppDock() {
  const [me, unread, incomingRequests] = await Promise.all([
    getCurrentUser(),
    getUnreadCount(),
    getIncomingFriendRequests(),
  ]);
  if (!me) return null;

  return (
    <AppDockClient
      avatarName={me.display_name}
      avatarUrl={me.avatar_url}
      pendingRequests={incomingRequests.length}
      unread={unread}
    />
  );
}
